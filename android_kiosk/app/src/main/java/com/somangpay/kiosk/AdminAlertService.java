package com.somangpay.kiosk;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.util.Log;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.UnsupportedEncodingException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.TimeUnit;

import okhttp3.OkHttpClient;
import okhttp3.Request;
import okhttp3.Response;
import okhttp3.WebSocket;
import okhttp3.WebSocketListener;

// 관리자 앱 전용(BuildConfig.SMS_DETECT_ENABLED로 시작 여부 게이팅, DepositAutoDetector와 동일한
// 플래그 재사용 - 둘 다 "이 빌드가 관리자 앱인가"만 따진다). 안드로이드 시스템 WebView가 Web Push
// API(PushManager) 자체를 지원하지 않아(admin.html 상단 주석 참고) 관리자 APK 안에서는 서버가
// 보내는 웹푸시(미매칭 입금 발생/결제 발생/셀프충전 완료)를 받을 방법이 원천적으로 없다.
//
// 이걸 우회하기 위해 포그라운드 서비스로 기존 실시간 인프라(/ws/admin, ws_manager.py)에 직접
// 붙어서 "alert" 타입 메시지(notify_admins_alert - "refresh"와는 별개 타입이라 브라우저/PWA의
// ws-client.js는 그대로 무시함)를 받으면 네이티브 알림으로 띄운다. 포그라운드 서비스가 필요한
// 이유: 안드로이드 8+(API 26)부터 일반 백그라운드 서비스는 앱이 백그라운드로 가면 시스템이 짧은
// 유예 시간 뒤 강제 종료한다 - 배터리 최적화 예외("제한 없음")를 켜둬도 이 규칙 자체는 우회되지
// 않고, 포그라운드 서비스만이 구글이 공식으로 보장하는 유일한 예외다(대신 상태바에 상시 알림이
// 뜨는 게 그 대가).
public class AdminAlertService extends Service {
    private static final String TAG = "SomangAdminAlert";
    private static final String SERVICE_CHANNEL_ID = "admin_alert_service";
    private static final String ALERT_CHANNEL_ID = "admin_alert_push";
    private static final int SERVICE_NOTIF_ID = 1001;
    // 로그인 전(토큰 없음)엔 이 주기로 재시도 - admin.js가 로그인하면 saveAdminToken()으로
    // DepositAutoDetector의 SharedPreferences에 즉시 반영되므로 다음 재시도 때 바로 붙는다.
    private static final long RETRY_NO_TOKEN_MS = 30_000;
    private static final long RECONNECT_MS = 5_000;

    private OkHttpClient client;
    private WebSocket webSocket;
    private Handler handler;
    private volatile boolean stopped = false;

    static void start(Context context) {
        Intent intent = new Intent(context, AdminAlertService.class);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            context.startForegroundService(intent);
        } else {
            context.startService(intent);
        }
    }

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new Handler(Looper.getMainLooper());
        // 서버가 20초 주기로 ping을 보내지만(main.py WS_PING_INTERVAL), 이동통신망 유휴 NAT가
        // 그보다 먼저 끊을 수 있어 OkHttp 자체 핑도 같이 건다 - 끊기면 onFailure/onClosed로
        // 즉시 감지돼 재연결된다.
        client = new OkHttpClient.Builder()
                .pingInterval(30, TimeUnit.SECONDS)
                .build();
        startForeground(SERVICE_NOTIF_ID, buildServiceNotification());
        connect();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        return START_STICKY; // 시스템이 메모리 압박으로 죽여도 다시 띄워 재연결 시도
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null; // 바인딩 안 씀 - MainActivity는 start()로 던지기만 하고 끝
    }

    @Override
    public void onDestroy() {
        stopped = true;
        handler.removeCallbacksAndMessages(null);
        if (webSocket != null) webSocket.close(1000, null);
        super.onDestroy();
    }

    private void connect() {
        if (stopped) return;
        String token = DepositAutoDetector.getAdminToken(this);
        String wsUrl = isBlank(token) ? null : buildWsUrl(token);
        if (wsUrl == null) {
            handler.postDelayed(this::connect, RETRY_NO_TOKEN_MS);
            return;
        }

        Request request = new Request.Builder().url(wsUrl).build();
        webSocket = client.newWebSocket(request, new WebSocketListener() {
            @Override
            public void onMessage(WebSocket ws, String text) {
                handleMessage(text);
            }

            @Override
            public void onClosed(WebSocket ws, int code, String reason) {
                scheduleReconnect();
            }

            @Override
            public void onFailure(WebSocket ws, Throwable t, Response response) {
                Log.w(TAG, "WS 연결 실패: " + t.getMessage());
                scheduleReconnect();
            }
        });
    }

    private void scheduleReconnect() {
        if (stopped) return;
        handler.postDelayed(this::connect, RECONNECT_MS);
    }

    private void handleMessage(String text) {
        try {
            JSONObject json = new JSONObject(text);
            if (!"alert".equals(json.optString("type"))) return; // "refresh"/"ping" 등은 무시
            String title = json.optString("title", "소망페이 관리자");
            String body = json.optString("body", "");
            showAlertNotification(title, body);
        } catch (JSONException e) {
            Log.w(TAG, "메시지 파싱 실패: " + e.getMessage());
        }
    }

    // BuildConfig.TARGET_URL(예: "https://somangpay.duckdns.org/admin")에서 호스트:포트만 뽑아
    // wss:// 기준 /ws/admin URL을 만든다 - DepositAutoDetector.apiBaseUrl()과 동일한 방식.
    private String buildWsUrl(String token) {
        try {
            URI uri = new URI(BuildConfig.TARGET_URL);
            String scheme = "https".equals(uri.getScheme()) ? "wss" : "ws";
            String base = scheme + "://" + uri.getHost() + (uri.getPort() != -1 ? ":" + uri.getPort() : "");
            return base + "/ws/admin?token=" + URLEncoder.encode(token, StandardCharsets.UTF_8.name());
        } catch (URISyntaxException | UnsupportedEncodingException e) {
            return null;
        }
    }

    // 포그라운드 서비스 유지를 위한 상시 알림 - IMPORTANCE_MIN이라 상태바 아이콘만 뜨고
    // 헤드업/소리는 없다. 실제 알림 내용(showAlertNotification)과는 다른 채널.
    private Notification buildServiceNotification() {
        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = getSystemService(NotificationManager.class);
            NotificationChannel channel = new NotificationChannel(
                    SERVICE_CHANNEL_ID, "관리자 알림 연결 상태", NotificationManager.IMPORTANCE_MIN);
            nm.createNotificationChannel(channel);
            builder = new Notification.Builder(this, SERVICE_CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }
        return builder
                .setContentTitle("소망페이 관리자 알림 대기 중")
                .setSmallIcon(R.mipmap.ic_launcher)
                .setOngoing(true)
                .build();
    }

    private void showAlertNotification(String title, String body) {
        if (Build.VERSION.SDK_INT >= 33
                && checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
            return; // 권한 없으면 조용히 건너뜀
        }
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;

        Notification.Builder builder;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    ALERT_CHANNEL_ID, "관리자 알림", NotificationManager.IMPORTANCE_HIGH);
            nm.createNotificationChannel(channel);
            builder = new Notification.Builder(this, ALERT_CHANNEL_ID);
        } else {
            builder = new Notification.Builder(this);
        }
        Notification notification = builder
                .setSmallIcon(R.mipmap.ic_launcher)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .build();
        nm.notify((int) System.currentTimeMillis(), notification);
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }
}
