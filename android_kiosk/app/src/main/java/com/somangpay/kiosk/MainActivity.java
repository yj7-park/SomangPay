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
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

public class MainActivity extends Activity implements NfcAdapter.ReaderCallback, Runnable,
        TextToSpeech.OnInitListener, CardReaderManager.NativeNfcController {

    private static final String TAG = "SomangKioskNative";
    private static final String KIOSK_URL = "https://deeply-concrete-mullet.ngrok-free.app/kiosk";

    private WebView webView;
    private NfcAdapter nfcAdapter;
    private Handler mainHandler;
    private String lastScannedUid = "";
    private CardReaderManager cardReaderManager;
    static TextToSpeech tts;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 앱 시작 시 강제로 가로 고정 모드(LANDSCAPE)로 설정
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE);

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
        webView.setOnLongClickListener(v -> true);
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
        webView.loadUrl(KIOSK_URL, extraHeaders);

        // 2. 런타임 기기 카메라(CAMERA) 권한 체크 및 팝업 요청
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
            if (checkSelfPermission(android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.CAMERA}, 102);
            }
        }

        // TTS 엔진 초기화
        tts = new TextToSpeech(this, this);

        Log.d(TAG, "Native Kiosk App Initialized with URL: " + KIOSK_URL);
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
        cardReaderManager.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        cardReaderManager.onPause();
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

    // 시스템 뒤로가기(하단 버튼/제스처)를 완전히 무시 - 키오스크는 단일 화면이라 뒤로 나갈 곳이
    // 없고, 기본 동작(super 호출)을 두면 액티비티가 그대로 종료되어 앱 밖으로 빠져나가 버린다.
    @Override
    public void onBackPressed() {
        // 의도적으로 아무 것도 하지 않음
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
            enterKioskLockTaskIfNeeded();
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
