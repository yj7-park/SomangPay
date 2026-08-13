package com.somangpay.kiosk;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.content.Context;
import android.content.DialogInterface;
import android.content.pm.ActivityInfo;
import android.hardware.usb.UsbManager;
import android.nfc.NfcAdapter;
import android.nfc.Tag;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.util.Log;
import android.view.View;
import android.webkit.JsResult;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.somangpay.kiosk.reader.CardReaderManager;
import java.lang.ref.WeakReference;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends Activity implements NfcAdapter.ReaderCallback, Runnable,
        TextToSpeech.OnInitListener, CardReaderManager.NativeNfcController {

    private static final String TAG = "SomangKioskNative";
    // 대상 URL/락다운 여부는 플레이버별로 build.gradle의 buildConfigField가 주입한다
    // (kiosk/admin/user - app/build.gradle 참고). 카드 리더 브릿지는 세 플레이버가 공유한다.

    private WebView webView;
    private NfcAdapter nfcAdapter;
    private Handler mainHandler;
    private String lastScannedUid = "";
    private CardReaderManager cardReaderManager;
    private UpdateManager updateManager;
    static TextToSpeech tts;

    // SmsReceiver(매니페스트에 정적 등록됨)가 문자를 받았을 때, 지금 액티비티/웹뷰가 살아있으면
    // 바로 웹으로 전달할 수 있도록 약한 참조로 현재 인스턴스를 들고 있는다 - onCreate에서 채우고
    // onDestroy에서 비운다(onResume/onPause에 걸면 백그라운드 상태에서 온 문자를 놓치게 된다).
    private static WeakReference<MainActivity> currentInstance;

    // SmsReceiver.onReceive()에서 호출 - 웹뷰가 살아있으면 바로 전달하고 true, 없으면(프로세스가
    // 완전히 종료된 상태) false를 반환해 SmsReceiver가 대기열에 남기도록 한다.
    static boolean deliverSmsToWebIfAlive(String sender, String body) {
        MainActivity activity = currentInstance != null ? currentInstance.get() : null;
        if (activity == null || activity.webView == null || activity.mainHandler == null) return false;
        final String safeSender = sender == null ? "" : sender;
        activity.mainHandler.post(() -> activity.webView.evaluateJavascript(
                "window.onSmsReceived && window.onSmsReceived("
                        + org.json.JSONObject.quote(safeSender) + ","
                        + org.json.JSONObject.quote(body) + ");",
                null));
        return true;
    }

    // BankNotificationListener.onNotificationPosted()에서 호출 - deliverSmsToWebIfAlive와 동일한 패턴.
    static boolean deliverNotificationToWebIfAlive(String packageName, String title, String text) {
        MainActivity activity = currentInstance != null ? currentInstance.get() : null;
        if (activity == null || activity.webView == null || activity.mainHandler == null) return false;
        final String safePackage = packageName == null ? "" : packageName;
        final String safeTitle = title == null ? "" : title;
        activity.mainHandler.post(() -> activity.webView.evaluateJavascript(
                "window.onNotificationReceived && window.onNotificationReceived("
                        + org.json.JSONObject.quote(safePackage) + ","
                        + org.json.JSONObject.quote(safeTitle) + ","
                        + org.json.JSONObject.quote(text) + ");",
                null));
        return true;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 전용 키오스크 단말기 빌드에서만 강제로 가로 고정 모드(LANDSCAPE)로 설정 -
        // admin/user는 직원 개인 휴대폰에서 쓰므로 기기 방향을 자유롭게 따라간다.
        if (BuildConfig.KIOSK_LOCKDOWN_ENABLED) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
        }

        mainHandler = new Handler(Looper.getMainLooper());
        nfcAdapter = NfcAdapter.getDefaultAdapter(this);

        // Fullscreen Hide Status / Navigation Bars
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN |
                View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
        );

        webView = new WebView(this);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }
        setContentView(webView);

        WebSettings webSettings = webView.getSettings();
        webSettings.setJavaScriptEnabled(true);
        webSettings.setDomStorageEnabled(true);
        webSettings.setAllowFileAccess(true);
        webSettings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);

        // 길게 눌러 텍스트 선택/복사 메뉴, 링크·이미지 컨텍스트 메뉴(새 탭에서 열기, 이미지 저장 등)가
        // 뜨는 것을 차단 - true를 반환해 롱클릭 이벤트를 여기서 소비하고 WebView 기본 동작으로 넘기지 않는다.
        // (CSS의 user-select:none과 함께 적용해야 선택 핸들 자체가 아예 생기지 않는다 - style.css 참고)
        // 전용 키오스크 단말기 전용 동작 - admin/user는 일반 앱처럼 길게 눌러 복사/공유가 가능해야 한다.
        if (BuildConfig.KIOSK_LOCKDOWN_ENABLED) {
            webView.setOnLongClickListener(v -> true);
        }
        webView.setHapticFeedbackEnabled(false);

        // 카드 리더 우선순위(USB CCID > USB HID 키보드 > 내장 NFC > 에러) 오케스트레이터 초기화
        cardReaderManager = new CardReaderManager(this, webView, mainHandler,
                (UsbManager) getSystemService(Context.USB_SERVICE), this);

        // JavaScript에서 NFC 리더 재활성화 요청을 수신할 수 있도록 인터페이스 등록
        webView.addJavascriptInterface(new KioskWebAppInterface(this), "AndroidInterface");

        webView.setWebChromeClient(new KioskWebChromeClient());

        webView.setWebViewClient(new KioskWebViewClient());

        // 서비스워커(sw.js) 등록/fetch는 WebViewClient.shouldInterceptRequest를 타지 않고
        // 별도의 ServiceWorkerClientCompat 경로로만 들어오기 때문에, 이것도 같은 ngrok
        // 바이패스 로직으로 가로채지 않으면 sw.js가 인터스티셜 HTML(text/html)을 받아
        // "unsupported MIME type" 에러로 등록에 실패한다.
        if (androidx.webkit.WebViewFeature.isFeatureSupported(androidx.webkit.WebViewFeature.SERVICE_WORKER_BASIC_USAGE)
                && androidx.webkit.WebViewFeature.isFeatureSupported(androidx.webkit.WebViewFeature.SERVICE_WORKER_SHOULD_INTERCEPT_REQUEST)) {
            androidx.webkit.ServiceWorkerControllerCompat.getInstance().setServiceWorkerClient(
                    new androidx.webkit.ServiceWorkerClientCompat() {
                        @Override
                        public android.webkit.WebResourceResponse shouldInterceptRequest(android.webkit.WebResourceRequest request) {
                            return KioskWebViewClient.fetchWithNgrokBypass(request);
                        }
                    });
        }

        // ngrok 인터스티셜 페이지 바이패스 헤더 추가
        Map<String, String> extraHeaders = new HashMap<>();
        extraHeaders.put("ngrok-skip-browser-warning", "true");
        webView.loadUrl(BuildConfig.TARGET_URL, extraHeaders);

        // 인앱 업데이트 - 스토어를 거치지 않는 사이드로드 배포라 앱이 직접 새 버전을 감지해야 한다.
        // 페이지 로드 직후 곧바로 체크하면 웹 쪽 JS(onUpdateAvailable 리스너)가 아직 준비되지 않았을
        // 수 있어 몇 초 지연 후 자동 체크(수동 트리거 아님)를 1회 수행한다. 업데이트 발견 시 콜백은
        // window.onUpdateAvailable로 전달되고, "자동 업데이트" 설정이 켜져 있으면 UpdateManager가
        // 이어서 바로 다운로드까지 진행한다(설정 꺼짐이 기본값 - 웹 UI의 업데이트 아이콘을 눌러야 진행).
        updateManager = new UpdateManager(this, webView, mainHandler);
        mainHandler.postDelayed(() -> updateManager.checkForUpdate(false), 3000);

        // 2. 런타임 기기 카메라(CAMERA) 권한 체크 및 팝업 요청
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            if (checkSelfPermission(android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.CAMERA}, 102);
            }
        }

        // 3. 입금 문자 자동감지 - 관리자 앱 전용(SMS_DETECT_ENABLED, build.gradle 참고).
        // SmsReceiver는 onResume/onPause로 등록/해제하지 않는다 - 앱이 백그라운드에 있을 때(예:
        // 문자 앱으로 전환) 도착한 실제 입금 문자를 놓쳐버리는 게 실사용에서 확인됐다. 대신
        // AndroidManifest.xml에 정적으로 등록해 시스템이 프로세스 상태와 무관하게 깨워서 전달하고,
        // 지금 이 액티비티가 살아있으면 currentInstance를 통해 바로 웹으로, 죽어있었으면
        // SmsReceiver가 대기열에 남겨둔 걸 여기서 웹뷰가 준비된 뒤 흘려보낸다.
        currentInstance = new WeakReference<>(this);
        if (BuildConfig.SMS_DETECT_ENABLED) {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M
                    && checkSelfPermission(android.Manifest.permission.RECEIVE_SMS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.RECEIVE_SMS}, 104);
            }
            mainHandler.postDelayed(
                    () -> SmsReceiver.drainPendingSmsQueue(this, MainActivity::deliverSmsToWebIfAlive), 3000);

            // 4. 입금 알림 자동감지(2번째 경로) - BankNotificationListener. "알림 접근" 권한은
            // RECEIVE_SMS와 달리 requestPermissions()로 팝업을 띄울 수 없어 여기서 자동 요청하지
            // 않는다 - 웹 UI(설정 탭)가 isNotificationAccessGranted()로 현재 상태를 보여주고,
            // 꺼져있으면 openNotificationAccessSettings()로 관리자가 직접 설정 화면에서 켜게 한다.
            mainHandler.postDelayed(
                    () -> BankNotificationListener.drainPendingNotificationQueue(
                            this, MainActivity::deliverNotificationToWebIfAlive), 3000);
        }

        // TTS 엔진 초기화
        tts = new TextToSpeech(this, this);

        Log.d(TAG, "Native App Initialized with URL: " + BuildConfig.TARGET_URL);
    }

    @Override
    public void onInit(int status) {
        if (status == TextToSpeech.SUCCESS) {
            tts.setLanguage(Locale.KOREAN);
            Log.d(TAG, "TTS Engine initialized with Korean locale");
        } else {
            Log.e(TAG, "TTS Initialization failed");
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        // 카메라 권한 다이얼로그 등 시스템 오버레이가 뜨면 액티비티가 onPause()되었다가 돌아오는데,
        // WebView 자체의 onPause()/onResume()을 호출해주지 않으면 일부 기기(특히 하드웨어 가속
        // WebView)에서 서페이스가 재게시(repaint)되지 않고 그대로 검은 화면에 멈춰버린다.
        // Activity.onResume()만으로는 WebView 내부 렌더링/타이머가 자동으로 재개되지 않는다.
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
        }
        cardReaderManager.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (webView != null) {
            webView.onPause();
            webView.pauseTimers();
        }
        cardReaderManager.onPause();
    }

    @Override
    protected void onDestroy() {
        super.onDestroy();
        if (currentInstance != null && currentInstance.get() == this) {
            currentInstance = null;
        }
    }

    // 화면 고정(Screen Pinning) 자동 진입 - Device Owner가 아니어도 앱이 스스로 요청 가능한
    // OS 기본 기능으로, 홈/최근 앱 버튼(제스처)을 비활성화한다. 최초 진입 시 시스템이 짧은
    // 안내를 보여줄 수 있고, 해제하려면 뒤로가기+최근앱 버튼을 동시에 길게 눌러야 한다
    // (기기에 화면 잠금 PIN이 설정되어 있으면 해제 시 PIN도 함께 요구하도록 설정 가능 -
    // 설정 > 보안 > 화면 고정 > "고정 해제 시 PIN 요청").
    // 이미 고정된 상태에서 다시 호출하면 예외가 발생하므로 현재 상태를 먼저 확인한다.
    private void enterKioskLockTaskIfNeeded() {
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        if (am == null) return;
        if (am.getLockTaskModeState() == ActivityManager.LOCK_TASK_MODE_NONE) {
            try {
                startLockTask();
                Log.d(TAG, "화면 고정(Screen Pinning) 진입 요청 완료");
            } catch (Exception e) {
                Log.e(TAG, "화면 고정 진입 실패: " + e.getMessage());
            }
        }
    }

    // 전용 키오스크 단말기 빌드에서만 시스템 뒤로가기(하단 버튼/제스처)를 완전히 무시 -
    // 키오스크는 단일 화면이라 뒤로 나갈 곳이 없고, 기본 동작(super 호출)을 두면 액티비티가
    // 그대로 종료되어 앱 밖으로 빠져나가 버린다. admin/user는 일반 앱처럼 정상 동작해야 한다.
    @Override
    public void onBackPressed() {
        if (BuildConfig.KIOSK_LOCKDOWN_ENABLED) {
            return;
        }
        super.onBackPressed();
    }

    // 시스템 다이얼로그(권한 요청, 알림 패널 등)로 포커스가 빠졌다가 돌아올 때마다 몰입모드를
    // 재적용 - onCreate에서 한 번만 걸면 그 사이 상태바/내비게이션 바가 다시 나타난 채로 남는다.
    // 화면 고정(Screen Pinning) 진입도 여기서 함께 시도한다 - onResume()은 액티비티/태스크가
    // 아직 시스템에 "포그라운드"로 완전히 인식되기 전에 호출될 수 있어 startLockTask()가
    // "Invalid task, not in foreground" 예외로 실패하는 경우가 있고, onWindowFocusChanged(true)가
    // 실제로 화면을 붙잡은(포커스를 얻은) 시점을 더 안정적으로 알려준다.
    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_FULLSCREEN |
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
            if (BuildConfig.KIOSK_LOCKDOWN_ENABLED) {
                enterKioskLockTaskIfNeeded();
            }
        }
    }

    // CardReaderManager.NativeNfcController 구현 - 기존 내장 NFC 메서드에 위임
    @Override
    public boolean isAvailable() {
        return nfcAdapter != null;
    }

    @Override
    public void enable() {
        enableNativeNfcReaderMode();
    }

    @Override
    public void disable() {
        disableNativeNfcReaderMode();
    }

    // 카메라 종료 후 JS가 리더 재활성화를 요청할 때 KioskWebAppInterface에서 호출
    void reevaluateCardReaders() {
        cardReaderManager.evaluateAndActivate();
    }

    // 카메라 시작 시 JS가 리더 일시정지를 요청할 때 KioskWebAppInterface에서 호출
    void pauseCardReaderForCamera() {
        cardReaderManager.pauseBuiltinNfcForCamera();
    }

    // JS가 페이지 로드 시점에 현재 카드 리더 상태를 동기적으로 조회할 때 KioskWebAppInterface에서 호출
    String getCurrentCardReaderMode() {
        return cardReaderManager.getCurrentModeName();
    }

    // 아래 업데이트 관련 메서드들은 모두 KioskWebAppInterface(JS 브릿지)의 위임 대상 -
    // 웹 UI의 업데이트 배지/설정 모달이 이 메서드들을 통해 UpdateManager를 제어한다.
    String getAppVersionInfo() {
        return updateManager.getAppVersionInfoJson();
    }

    void checkForUpdate() {
        updateManager.checkForUpdate(true);
    }

    void startUpdateDownload() {
        updateManager.startUpdateDownload();
    }

    boolean getAutoUpdateEnabled() {
        return updateManager.isAutoUpdateEnabled();
    }

    void setAutoUpdateEnabled(boolean enabled) {
        updateManager.setAutoUpdateEnabled(enabled);
    }

    // 입금 알림 자동감지(BankNotificationListener)용 "알림 접근" 권한 상태 조회/설정화면 열기 -
    // 웹 UI(설정 탭)의 상태 표시/버튼이 KioskWebAppInterface를 통해 호출한다.
    boolean isNotificationAccessGranted() {
        String enabledListeners = android.provider.Settings.Secure.getString(
                getContentResolver(), "enabled_notification_listeners");
        return enabledListeners != null && enabledListeners.contains(getPackageName());
    }

    void openNotificationAccessSettings() {
        try {
            startActivity(new android.content.Intent(
                    android.provider.Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS));
        } catch (Exception e) {
            Log.e(TAG, "알림 접근 설정 화면 열기 실패: " + e.getMessage());
        }
    }

    // JS의 화면 방향 전환 요청 처리 - Screen Orientation API의 lock()은 전체화면(Fullscreen API) 상태가
    // 아니면 WebView에서 지원되지 않아 실패하므로, 이미 시작 시점에 쓰던 setRequestedOrientation()을
    // 그대로 재사용해 네이티브 레벨에서 처리한다. 설치 여부와 무관하게 항상 동작한다.
    void setKioskOrientation(String mode) {
        if ("portrait".equals(mode)) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_PORTRAIT);
        } else if ("landscape".equals(mode)) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);
        }
    }

    public void enableNativeNfcReaderMode() {
        if (nfcAdapter != null) {
            int flags = NfcAdapter.FLAG_READER_NFC_A |
                        NfcAdapter.FLAG_READER_NFC_B |
                        NfcAdapter.FLAG_READER_NFC_F |
                        NfcAdapter.FLAG_READER_NFC_V |
                        NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK;

            Bundle options = new Bundle();
            options.putInt(NfcAdapter.EXTRA_READER_PRESENCE_CHECK_DELAY, 100);

            nfcAdapter.enableReaderMode(this, this, flags, options);
            Log.d(TAG, "Native ReaderMode Enabled Successfully!");
        }
    }

    private void disableNativeNfcReaderMode() {
        if (nfcAdapter != null) {
            nfcAdapter.disableReaderMode(this);
        }
    }

    // Android Native Hardware NFC Tag Callback (Runs in 0.001 sec)
    @Override
    public void onTagDiscovered(Tag tag) {
        byte[] rawIdBytes = tag.getId();
        if (rawIdBytes == null) return;

        String hexUid = bytesToHex(rawIdBytes);

        // 1. IsoDep (스마트폰 HCE / 고성능 카드) APDU 파싱
        android.nfc.tech.IsoDep isoDep = android.nfc.tech.IsoDep.get(tag);
        if (isoDep != null) {
            try {
                isoDep.connect();
                isoDep.setTimeout(500);
                byte[] histBytes = isoDep.getHistoricalBytes();
                byte[] hiBytes = isoDep.getHiLayerResponse();
                
                if (histBytes != null && histBytes.length > 2) {
                    hexUid = "FIXED_HIST_" + bytesToHex(histBytes);
                } else if (hiBytes != null && hiBytes.length > 2) {
                    hexUid = "FIXED_HI_" + bytesToHex(hiBytes);
                }
                isoDep.close();
            } catch (Exception e) {
                Log.d(TAG, "IsoDep Parse Fallback: " + e.getMessage());
            }
        }

        // 2. Ndef 고정 레코드 파싱
        try {
            android.nfc.tech.Ndef ndef = android.nfc.tech.Ndef.get(tag);
            if (ndef != null) {
                ndef.connect();
                android.nfc.NdefMessage msg = ndef.getNdefMessage();
                if (msg != null && msg.getRecords().length > 0) {
                    byte[] payload = msg.getRecords()[0].getPayload();
                    if (payload != null && payload.length > 0) {
                        hexUid = "FIXED_NDEF_" + bytesToHex(payload);
                    }
                }
                ndef.close();
            }
        } catch (Exception ignored) {}

        this.lastScannedUid = hexUid;
        Log.d(TAG, "⚡ Native Hardware NFC Tag Discovered! UID: " + this.lastScannedUid);

        // Dispatch directly to JS WebView
        mainHandler.post(this);
    }

    @Override
    public void run() {
        if (webView != null && lastScannedUid != null && !lastScannedUid.isEmpty()) {
            webView.evaluateJavascript("window.onAndroidNfcScanned('" + lastScannedUid + "');", null);
        }
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X:", b));
        }
        if (sb.length() > 0) {
            sb.deleteCharAt(sb.length() - 1);
        }
        return sb.toString();
    }
}

// D8 컴파일러 호환성 확보를 위해 익명 클래스 사용을 피하고 WebChromeClient를 상속받는 명명 클래스 정의
class KioskWebChromeClient extends android.webkit.WebChromeClient {
    @Override
    public void onPermissionRequest(final android.webkit.PermissionRequest request) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
            request.grant(request.getResources());
        }
    }

    @Override
    public boolean onJsAlert(android.webkit.WebView view, String url, String message, JsResult result) {
        new AlertDialog.Builder(view.getContext())
            .setMessage(message)
            .setPositiveButton(android.R.string.ok, (d, w) -> result.confirm())
            .setOnCancelListener(d -> result.cancel())
            .show();
        return true;
    }

    @Override
    public boolean onJsConfirm(android.webkit.WebView view, String url, String message, JsResult result) {
        new AlertDialog.Builder(view.getContext())
            .setMessage(message)
            .setPositiveButton("확인", (d, w) -> result.confirm())
            .setNegativeButton("취소", (d, w) -> result.cancel())
            .setOnCancelListener(d -> result.cancel())
            .show();
        return true;
    }
}

// D8 컴파일러 호환성 확보를 위해 WebViewClient를 상속받는 명명 클래스 정의
class KioskWebViewClient extends android.webkit.WebViewClient {

    private static final String TAG = "KioskWebViewClient";

    @Override
    public void onReceivedSslError(android.webkit.WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) {
        // 사설 SSL 인증서(Self-Signed Certificate) 오류 무시하고 https 접속 진행
        handler.proceed();
    }

    // WebView.loadUrl()의 추가 헤더는 최초 진입 페이지 요청에만 적용되고 그 페이지가
    // 불러오는 <script src>, sw.js 등 하위 리소스 요청에는 전달되지 않는다. ngrok 무료
    // 터널은 이 헤더가 없는 모든 요청에 경고 인터스티셜(HTML)을 끼워 넣어서, 정적 JS
    // 파일이 "Unexpected token '<'" 파싱 에러로 깨지는 원인이 된다. 모든 GET 리소스
    // 요청을 직접 가로채 헤더를 붙여 재요청하는 방식으로 우회한다.
    // (WebView는 POST 요청에는 이 콜백을 호출하지 않으므로 POST API 호출에는 적용되지 않음)
    @Override
    public android.webkit.WebResourceResponse shouldInterceptRequest(
            android.webkit.WebView view, android.webkit.WebResourceRequest request) {
        return fetchWithNgrokBypass(request);
    }

    // 일반 페이지 리소스(shouldInterceptRequest)와 서비스워커 요청(ServiceWorkerClientCompat)이
    // 공유하는 실제 fetch 로직. 서비스워커 등록/fetch는 WebViewClient가 아니라 별도의
    // ServiceWorkerClientCompat 경로를 타기 때문에 이 메서드를 양쪽에서 재사용한다.
    static android.webkit.WebResourceResponse fetchWithNgrokBypass(android.webkit.WebResourceRequest request) {
        String scheme = request.getUrl().getScheme();
        if (!"http".equals(scheme) && !"https".equals(scheme)) {
            return null;
        }
        if (!"GET".equalsIgnoreCase(request.getMethod())) {
            // WebResourceRequest는 POST 등 비-GET 요청의 바디를 노출하지 않아 여기서
            // 안전하게 재현(replay)할 방법이 없다. ngrok 인터스티셜은 정적 리소스
            // GET 요청에서만 문제가 되었으므로, GET만 가로채고 그 외(특히 결제 API
            // POST 호출)는 WebView 기본 네트워크 스택으로 그대로 흘려보낸다.
            return null;
        }

        java.net.HttpURLConnection connection = null;
        try {
            java.net.URL url = new java.net.URL(request.getUrl().toString());
            connection = (java.net.HttpURLConnection) url.openConnection();
            connection.setInstanceFollowRedirects(true);
            connection.setConnectTimeout(10_000);
            connection.setReadTimeout(10_000);

            Map<String, String> requestHeaders = request.getRequestHeaders();
            if (requestHeaders != null) {
                for (Map.Entry<String, String> header : requestHeaders.entrySet()) {
                    connection.setRequestProperty(header.getKey(), header.getValue());
                }
            }
            connection.setRequestProperty("ngrok-skip-browser-warning", "true");

            int statusCode = connection.getResponseCode();
            java.io.InputStream stream = statusCode >= 400 ? connection.getErrorStream() : connection.getInputStream();

            String contentType = connection.getContentType();
            String mimeType = "application/octet-stream";
            String encoding = "utf-8";
            if (contentType != null) {
                String[] parts = contentType.split(";");
                mimeType = parts[0].trim();
                for (String part : parts) {
                    String trimmed = part.trim();
                    if (trimmed.toLowerCase(Locale.US).startsWith("charset=")) {
                        encoding = trimmed.substring("charset=".length()).trim();
                    }
                }
            }

            return new android.webkit.WebResourceResponse(mimeType, encoding, stream);
        } catch (Exception e) {
            Log.w(TAG, "fetchWithNgrokBypass failed for " + request.getUrl() + ": " + e.getMessage());
            if (connection != null) connection.disconnect();
            return null;
        }
    }
}

// D8 컴파일러 호환성 확보를 위해 Runnable을 구현하는 JavascriptInterface 클래스 정의
class KioskWebAppInterface implements Runnable {
    private final MainActivity activity;

    KioskWebAppInterface(MainActivity activity) {
        this.activity = activity;
    }

    @android.webkit.JavascriptInterface
    public void reenableNfcReader() {
        // 카메라 종료 후 수신된 요청을 UI 스레드에서 안전하게 실행하여 NFC 리더 재등록
        activity.runOnUiThread(this);
    }

    @android.webkit.JavascriptInterface
    public String getCurrentReaderMode() {
        return activity.getCurrentCardReaderMode();
    }

    @android.webkit.JavascriptInterface
    public void setOrientation(String mode) {
        // Activity API는 메인 스레드에서만 호출 가능 - JS 인터페이스 콜백은 별도 스레드에서 실행됨
        activity.runOnUiThread(() -> activity.setKioskOrientation(mode));
    }

    @android.webkit.JavascriptInterface
    public void pauseReaderForCamera() {
        // 카메라 사용 시작 시 JS가 호출 - 기기 내장 NFC만 잠시 멈춤(외부 USB 리더는 영향 없음)
        activity.runOnUiThread(() -> activity.pauseCardReaderForCamera());
    }

    @android.webkit.JavascriptInterface
    public String getAppVersionInfo() {
        return activity.getAppVersionInfo();
    }

    @android.webkit.JavascriptInterface
    public void checkForUpdate() {
        activity.runOnUiThread(activity::checkForUpdate);
    }

    @android.webkit.JavascriptInterface
    public void startUpdateDownload() {
        activity.runOnUiThread(activity::startUpdateDownload);
    }

    @android.webkit.JavascriptInterface
    public boolean getAutoUpdateEnabled() {
        return activity.getAutoUpdateEnabled();
    }

    @android.webkit.JavascriptInterface
    public void setAutoUpdateEnabled(boolean enabled) {
        activity.setAutoUpdateEnabled(enabled);
    }

    @android.webkit.JavascriptInterface
    public boolean isNotificationAccessGranted() {
        return activity.isNotificationAccessGranted();
    }

    @android.webkit.JavascriptInterface
    public void openNotificationAccessSettings() {
        activity.runOnUiThread(() -> activity.openNotificationAccessSettings());
    }

    @android.webkit.JavascriptInterface
    public void speakText(final String text) {
        // 네이티브 Android TTS로 음성 출력 (WebView speechSynthesis 대체)
        if (MainActivity.tts != null) {
            MainActivity.tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, "kiosk_tts");
        }
    }

    @Override
    public void run() {
        android.util.Log.d("SomangKioskNative", "Re-evaluating card readers after camera shutdown...");
        activity.reevaluateCardReaders();
    }
}
