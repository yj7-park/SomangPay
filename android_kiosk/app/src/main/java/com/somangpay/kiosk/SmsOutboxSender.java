package com.somangpay.kiosk;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.os.Build;
import android.telephony.SmsManager;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

// 문자 발송 대기열(백엔드 sms_outbox) 처리기 - 관리자 앱 전용(BuildConfig.SMS_DETECT_ENABLED).
//
// 웹/PWA 관리자 화면이나 백엔드는 문자를 DB 대기열에 넣기만 하고, 이 기기가 "문자 발송"이 켜져
// 있으면 AdminAlertService가 20초마다(또는 "sms" 갱신 신호를 받으면 즉시) pollAsync를 불러
// POST /api/admin/sms/claim으로 가져간 뒤 SmsManager로 이 폰의 번호/요금제로 보내고 결과를
// /api/admin/sms/{id}/result로 보고한다. 기본값은 꺼짐 - 관리자 APK가 여러 대 깔려 있어도
// 설정 탭에서 켠 기기만 발송에 참여한다(여러 대가 켜져 있어도 서버가 한 건을 한 기기에만 준다).
final class SmsOutboxSender {
    private static final String TAG = "SomangSmsOutbox";
    private static final String PREFS_NAME = "somang_sms_sender_prefs";
    private static final String PREF_ENABLED = "enabled";
    private static final String PREF_DEVICE_ID = "device_id";
    // 통신사 전송 결과(sentIntent)를 기다리는 최대 시간 - 넘기면 "결과 확인 못 함"으로 보고.
    private static final long SENT_RESULT_TIMEOUT_SEC = 60;

    // 폴링/발송은 한 줄로만 - 동시에 두 번 claim해서 순서가 꼬이거나 같은 기기가 한도를 빨리
    // 소진하지 않게 단일 스레드로 직렬화하고, 이미 대기 중인 폴링이 있으면 더 쌓지 않는다.
    private static final ExecutorService EXECUTOR = Executors.newSingleThreadExecutor();
    private static final AtomicBoolean POLL_QUEUED = new AtomicBoolean(false);

    private SmsOutboxSender() {}

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    static boolean isEnabled(Context context) {
        return prefs(context).getBoolean(PREF_ENABLED, false);
    }

    static void setEnabled(Context context, boolean enabled) {
        prefs(context).edit().putBoolean(PREF_ENABLED, enabled).apply();
    }

    static boolean hasPermission(Context context) {
        return Build.VERSION.SDK_INT < Build.VERSION_CODES.M
                || context.checkSelfPermission(android.Manifest.permission.SEND_SMS) == PackageManager.PERMISSION_GRANTED;
    }

    static boolean hasTelephony(Context context) {
        return context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_TELEPHONY);
    }

    // 배터리 최적화 예외(설정 > 배터리 > "제한 없음")인지 - 아니면 절전(Doze) 중에 폴링이 멈춘다.
    static boolean isIgnoringBatteryOptimizations(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;
        android.os.PowerManager pm = (android.os.PowerManager) context.getSystemService(Context.POWER_SERVICE);
        return pm != null && pm.isIgnoringBatteryOptimizations(context.getPackageName());
    }

    // 기기별 고정 식별자 - 앱 데이터를 지우지 않는 한 유지된다(ANDROID_ID 대신 앱 자체 UUID).
    static synchronized String deviceId(Context context) {
        SharedPreferences p = prefs(context);
        String id = p.getString(PREF_DEVICE_ID, null);
        if (id == null || id.isEmpty()) {
            id = UUID.randomUUID().toString();
            p.edit().putString(PREF_DEVICE_ID, id).apply();
        }
        return id;
    }

    static String deviceName() {
        String model = Build.MODEL == null ? "" : Build.MODEL;
        String maker = Build.MANUFACTURER == null ? "" : Build.MANUFACTURER;
        return (model.toLowerCase().startsWith(maker.toLowerCase()) ? model : maker + " " + model).trim();
    }

    // 웹 설정 화면용 상태(JS 브릿지 getSmsSenderStatus).
    static String statusJson(Context context) {
        JSONObject o = new JSONObject();
        try {
            o.put("enabled", isEnabled(context));
            o.put("permission", hasPermission(context));
            o.put("telephony", hasTelephony(context));
            o.put("deviceId", deviceId(context));
            o.put("deviceName", deviceName());
            o.put("batteryUnrestricted", isIgnoringBatteryOptimizations(context));
        } catch (Exception ignored) {
        }
        return o.toString();
    }

    static void pollAsync(Context context) {
        if (!BuildConfig.SMS_DETECT_ENABLED) return;
        Context app = context.getApplicationContext();
        if (!isEnabled(app) || !hasPermission(app)) return;
        if (!POLL_QUEUED.compareAndSet(false, true)) return;
        EXECUTOR.execute(() -> {
            POLL_QUEUED.set(false);
            try {
                pollOnce(app);
            } catch (Exception e) {
                Log.w(TAG, "폴링 실패: " + e.getMessage());
            }
        });
    }

    private static void pollOnce(Context context) throws Exception {
        String token = DepositAutoDetector.getAdminToken(context);
        String apiBase = DepositAutoDetector.apiBaseUrl();
        if (token == null || token.trim().isEmpty() || apiBase == null) return;

        // 한 번에 가져온 묶음을 다 보내고 나서도 대기열이 남아 있을 수 있어, 빈 응답이 올 때까지
        // 몇 번 더 돈다(상한을 둬서 한 폴링이 너무 오래 붙잡지 않게).
        for (int round = 0; round < 4; round++) {
            JSONObject claim = new JSONObject();
            claim.put("device_id", deviceId(context));
            claim.put("device_name", deviceName());
            claim.put("limit", 5);
            String resp = postJson(apiBase + "/api/admin/sms/claim", token, claim);
            if (resp == null) return;
            JSONArray items = new JSONArray(resp);
            if (items.length() == 0) return;

            for (int i = 0; i < items.length(); i++) {
                JSONObject item = items.getJSONObject(i);
                int id = item.getInt("id");
                String error = send(context, id, item.getString("to_phone"), item.getString("body"));
                JSONObject result = new JSONObject();
                result.put("device_id", deviceId(context));
                result.put("success", error == null);
                if (error != null) result.put("error", error);
                // 결과 보고가 유실되면 서버는 멈춘 건으로 보고 다른 기기에 다시 줘서 같은 문자가 두 번
                // 나갈 수 있다 - 이미 보낸 뒤라 보고만큼은 몇 번 더 시도한다.
                for (int attempt = 0; attempt < 3; attempt++) {
                    if (postJson(apiBase + "/api/admin/sms/" + id + "/result", token, result) != null) break;
                    Thread.sleep(3000);
                }
            }
        }
    }

    // 실제 발송. 성공이면 null, 실패면 사람이 읽을 사유. 긴 문자는 여러 조각(멀티파트)으로 나가고,
    // 조각마다 오는 전송 결과를 모두 기다려 하나라도 실패면 실패로 본다.
    private static String send(Context context, int id, String phone, String body) {
        SmsManager sm;
        try {
            sm = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
                    ? context.getSystemService(SmsManager.class)
                    : SmsManager.getDefault();
        } catch (Exception e) {
            return "문자 기능을 사용할 수 없음: " + e.getMessage();
        }
        if (sm == null) return "문자 기능을 사용할 수 없는 기기";

        ArrayList<String> parts = sm.divideMessage(body);
        if (parts == null || parts.isEmpty()) return "보낼 내용이 비어 있음";

        // 문자마다 고유한 액션을 써서 동시에 도착한 다른 문자의 결과와 섞이지 않게 한다.
        String action = context.getPackageName() + ".SMS_SENT." + id;
        CountDownLatch latch = new CountDownLatch(parts.size());
        AtomicReference<String> firstError = new AtomicReference<>(null);
        BroadcastReceiver receiver = new BroadcastReceiver() {
            @Override
            public void onReceive(Context c, Intent intent) {
                int code = getResultCode();
                if (code != Activity.RESULT_OK) firstError.compareAndSet(null, describeError(code));
                latch.countDown();
            }
        };
        IntentFilter filter = new IntentFilter(action);
        if (Build.VERSION.SDK_INT >= 33) {
            context.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            context.registerReceiver(receiver, filter);
        }

        try {
            int piFlags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.M ? PendingIntent.FLAG_IMMUTABLE : 0;
            ArrayList<PendingIntent> sentIntents = new ArrayList<>();
            for (int i = 0; i < parts.size(); i++) {
                Intent sent = new Intent(action).setPackage(context.getPackageName());
                sentIntents.add(PendingIntent.getBroadcast(context, id * 16 + i, sent, piFlags));
            }
            if (parts.size() == 1) {
                sm.sendTextMessage(phone, null, parts.get(0), sentIntents.get(0), null);
            } else {
                sm.sendMultipartTextMessage(phone, null, parts, sentIntents, null);
            }
            if (!latch.await(SENT_RESULT_TIMEOUT_SEC, TimeUnit.SECONDS)) {
                return "전송 결과를 확인하지 못함(실제로는 전송됐을 수 있음)";
            }
            return firstError.get();
        } catch (SecurityException e) {
            return "문자 발송 권한 없음";
        } catch (Exception e) {
            Log.e(TAG, "발송 실패", e);
            return "발송 중 오류: " + e.getMessage();
        } finally {
            try {
                context.unregisterReceiver(receiver);
            } catch (Exception ignored) {
            }
        }
    }

    private static String describeError(int code) {
        switch (code) {
            case SmsManager.RESULT_ERROR_GENERIC_FAILURE: return "전송 실패(일반 오류)";
            case SmsManager.RESULT_ERROR_RADIO_OFF: return "전송 실패(비행기 모드 또는 무선 꺼짐)";
            case SmsManager.RESULT_ERROR_NULL_PDU: return "전송 실패(메시지 생성 오류)";
            case SmsManager.RESULT_ERROR_NO_SERVICE: return "전송 실패(통신 서비스 없음)";
            case SmsManager.RESULT_ERROR_LIMIT_EXCEEDED: return "전송 실패(기기 발송 한도 초과)";
            default: return "전송 실패(오류 코드 " + code + ")";
        }
    }

    // 성공(2xx)이면 응답 본문, 아니면 null.
    private static String postJson(String urlStr, String token, JSONObject payload) {
        HttpURLConnection conn = null;
        try {
            conn = (HttpURLConnection) new URL(urlStr).openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            conn.setRequestProperty("Authorization", "Bearer " + token);
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(15000);
            conn.setDoOutput(true);
            try (OutputStream os = conn.getOutputStream()) {
                os.write(payload.toString().getBytes(StandardCharsets.UTF_8));
            }
            int code = conn.getResponseCode();
            if (code < 200 || code >= 300) {
                Log.w(TAG, urlStr + " -> HTTP " + code);
                return null;
            }
            try (InputStream is = conn.getInputStream()) {
                ByteArrayOutputStream bos = new ByteArrayOutputStream();
                byte[] buf = new byte[4096];
                int n;
                while ((n = is.read(buf)) != -1) bos.write(buf, 0, n);
                return new String(bos.toByteArray(), StandardCharsets.UTF_8);
            }
        } catch (Exception e) {
            Log.w(TAG, urlStr + " 호출 실패: " + e.getMessage());
            return null;
        } finally {
            if (conn != null) conn.disconnect();
        }
    }
}
