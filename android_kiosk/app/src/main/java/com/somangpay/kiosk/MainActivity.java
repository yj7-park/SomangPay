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
import android.graphics.Color;
import android.hardware.Camera;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.tts.TextToSpeech;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.webkit.JsResult;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import com.journeyapps.barcodescanner.BarcodeResult;
import com.journeyapps.barcodescanner.DecoratedBarcodeView;
import com.journeyapps.barcodescanner.camera.CameraSettings;
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

    // 인라인(비-전체화면) 네이티브 QR 스캐너 - admin.html의 점선 박스(#admin-qr-native-camera-slot)
    // 위치/크기에 맞춰 겹쳐 그려진다. cameraFlipButton도 같은 FrameLayout의 형제 뷰라 카메라
    // 프리뷰 위로 정상적으로 그려진다(SurfaceView punch-through 문제 없음 - DecoratedBarcodeView가
    // 이미 내부적으로 뷰파인더 오버레이를 같은 방식으로 그린다).
    private FrameLayout rootLayout;
    private DecoratedBarcodeView qrScannerView;
    private Button qrCameraFlipButton;
    private static final String QR_PREFS_NAME = "somang_qr_prefs";
    private static final String QR_PREF_FRONT_CAMERA = "qr_front_camera";

    // DepositAutoDetector가 입금 문자/알림을 처리(등록/필터링/실패 등)하고 나서, 지금
    // 액티비티/웹뷰가 살아있으면 바로 결과를 웹의 "수신 로그"로 보여줄 수 있도록 약한 참조로
    // 현재 인스턴스를 들고 있는다 - onCreate에서 채우고 onDestroy에서 비운다(onResume/onPause에
    // 걸면 백그라운드 상태에서 처리된 건을 놓치게 된다).
    private static WeakReference<MainActivity> currentInstance;

    // DepositAutoDetector.log()에서 호출 - 실제 등록(백엔드 API 호출)은 이미 끝난 뒤이므로 여기서는
    // 결과를 화면에 "표시"만 한다(window.onNativeDetectionLogged, admin.js 참고 - 다시 등록을
    // 시도하지 않음). 웹뷰가 살아있으면 바로 전달하고 true, 없으면(프로세스가 완전히 종료된 상태)
    // false를 반환해 DepositAutoDetector가 대기열에 남기도록 한다.
    static boolean deliverNativeLogToWebIfAlive(String entryJson) {
        MainActivity activity = currentInstance != null ? currentInstance.get() : null;
        if (activity == null || activity.webView == null || activity.mainHandler == null) return false;
        activity.mainHandler.post(() -> activity.webView.evaluateJavascript(
                "window.onNativeDetectionLogged && window.onNativeDetectionLogged("
                        + org.json.JSONObject.quote(entryJson) + ");",
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

        // Fullscreen Hide Status / Navigation Bars - 전용 키오스크 단말기 빌드에서만.
        // admin/user는 직원 개인 휴대폰에서 쓰므로 시간/배터리 등이 보이는 상태바를 그대로 둔다.
        if (BuildConfig.KIOSK_LOCKDOWN_ENABLED) {
            getWindow().getDecorView().setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_FULLSCREEN |
                    View.SYSTEM_UI_FLAG_HIDE_NAVIGATION |
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
            );
        }

        webView = new WebView(this);
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.KITKAT) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        // WebView 위에 인라인 QR 카메라 프리뷰 + 전환 버튼을 겹쳐 그리기 위한 루트 컨테이너.
        // 두 뷰 모두 처음엔 크기 0/GONE 상태로 추가해두고, startNativeQrScan()이 JS가 넘겨준
        // 화면 좌표로 위치/크기를 잡은 뒤 보여준다.
        rootLayout = new FrameLayout(this);
        rootLayout.addView(webView, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        qrScannerView = new DecoratedBarcodeView(this);
        qrScannerView.setVisibility(View.GONE);
        rootLayout.addView(qrScannerView, new FrameLayout.LayoutParams(0, 0));

        qrCameraFlipButton = new Button(this);
        qrCameraFlipButton.setText("전환");
        qrCameraFlipButton.setAllCaps(false);
        qrCameraFlipButton.setTextColor(Color.WHITE);
        qrCameraFlipButton.setBackgroundColor(Color.argb(160, 0, 0, 0));
        qrCameraFlipButton.setVisibility(View.GONE);
        qrCameraFlipButton.setOnClickListener(v -> flipNativeQrCamera());
        rootLayout.addView(qrCameraFlipButton, new FrameLayout.LayoutParams(
                FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.LEFT));

        setContentView(rootLayout);

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
        // 문자 앱으로 전환)는 물론 프로세스가 완전히 종료된 상태에서도 AndroidManifest.xml에
        // 정적으로 등록된 리시버가 시스템에 의해 깨워지고, DepositAutoDetector가 웹뷰 없이도
        // 직접 파싱/등록까지 끝낸다(처리 결과만 currentInstance를 통해 웹의 "수신 로그"로 보여줌).
        currentInstance = new WeakReference<>(this);
        if (BuildConfig.SMS_DETECT_ENABLED) {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M
                    && checkSelfPermission(android.Manifest.permission.RECEIVE_SMS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.RECEIVE_SMS}, 104);
            }
            // 앱이 죽어있는 동안 DepositAutoDetector가 처리해둔 결과(성공/필터링/실패 등)를
            // 웹뷰가 준비된 뒤 한꺼번에 "수신 로그"로 흘려보낸다 - 이미 등록까지 끝난 뒤라
            // 여기서 다시 처리(재등록)하지 않는다.
            mainHandler.postDelayed(
                    () -> DepositAutoDetector.drainLogQueue(this, MainActivity::deliverNativeLogToWebIfAlive), 3000);

            // 4. 입금 알림 자동감지(2번째 경로) - BankNotificationListener. "알림 접근" 권한은
            // RECEIVE_SMS와 달리 requestPermissions()로 팝업을 띄울 수 없어 여기서 자동 요청하지
            // 않는다 - 웹 UI(설정 탭)가 isNotificationAccessGranted()로 현재 상태를 보여주고,
            // 꺼져있으면 openNotificationAccessSettings()로 관리자가 직접 설정 화면에서 켜게 한다.
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
        if (qrScannerView != null && qrScannerView.getVisibility() == View.VISIBLE) {
            qrScannerView.resume();
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
        if (qrScannerView != null) {
            qrScannerView.pause();
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
    //
    // screenPinningUserDisabled가 켜져 있으면 아무것도 하지 않는다 - 웹 UI의 자물쇠 버튼으로
    // 관리자가 명시적으로 고정을 풀었을 때, onWindowFocusChanged가 포커스를 다시 얻을 때마다
    // (거의 매 상호작용마다) 자동으로 재진입시켜버리면 버튼으로 푼 게 곧바로 무효화된다.
    private boolean screenPinningUserDisabled = false;

    private void enterKioskLockTaskIfNeeded() {
        if (screenPinningUserDisabled) return;
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

    // 설정 버튼 옆 자물쇠 버튼(kiosk.html)이 호출 - 지금 고정돼 있으면 풀고(이후
    // onWindowFocusChanged의 자동 재진입도 막고), 풀려 있으면 다시 고정한다.
    boolean isKioskLockdownEnabled() {
        return BuildConfig.KIOSK_LOCKDOWN_ENABLED;
    }

    boolean isScreenPinningActive() {
        ActivityManager am = (ActivityManager) getSystemService(Context.ACTIVITY_SERVICE);
        return am != null && am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
    }

    // KioskWebAppInterface.toggleScreenPinning()이 runOnUiThread로 이 메서드를 큐에 올리기만
    // 하고 바로 리턴하므로, JS가 호출 직후 isScreenPinningActive()를 곧바로 다시 물어보면
    // 아직 실행 전(비동기) 상태를 읽어 아이콘이 한 박자 늦게/틀리게 그려질 수 있다 - 실제 변경이
    // (이 메서드 안에서, UI 스레드 위에서) 끝난 뒤 여기서 직접 웹으로 콜백해 갱신을 트리거한다.
    void toggleScreenPinning() {
        if (!BuildConfig.KIOSK_LOCKDOWN_ENABLED) return;
        if (isScreenPinningActive()) {
            try {
                stopLockTask();
                screenPinningUserDisabled = true;
                Log.d(TAG, "화면 고정(Screen Pinning) 해제 요청 완료 (버튼)");
            } catch (Exception e) {
                Log.e(TAG, "화면 고정 해제 실패: " + e.getMessage());
            }
        } else {
            screenPinningUserDisabled = false;
            enterKioskLockTaskIfNeeded();
        }
        if (webView != null) {
            webView.evaluateJavascript("window.refreshKioskPinButtonUi && window.refreshKioskPinButtonUi();", null);
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
        if (hasFocus && BuildConfig.KIOSK_LOCKDOWN_ENABLED) {
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

    // ============ 인라인 네이티브 QR 스캔 (zxing-android-embedded, DecoratedBarcodeView 임베드) ============
    // 관리자/회원 앱은 http 대신 https로 접속하면 웹소켓(wss)이 WebView에서 막히는 문제 때문에
    // 계속 http로 접속한다 - 그런데 브라우저의 getUserMedia(웹 카메라 API)는 http 같은 "비보안
    // 컨텍스트"에서는 OS 카메라 권한을 이미 줬어도 아예 동작하지 않는다(별개의 제약). 그래서
    // 웹 카메라 대신 이 네이티브 스캐너를 쓴다. 예전에는 별도의 전체화면 CaptureActivity를
    // 띄웠지만(#28), 그러면 WebView 뒤 화면 전체를 카메라가 덮어버려서 요청에 따라 대신
    // DecoratedBarcodeView를 WebView와 같은 FrameLayout(rootLayout)의 형제 뷰로 두고, JS가
    // getBoundingClientRect()로 넘겨준 #admin-qr-native-camera-slot의 화면 좌표에 정확히 겹쳐
    // 그린다 - 별도 액티비티가 없으므로 화면 전환/뒤로가기 취소 개념 자체가 없다.
    // 좌표는 CSS px(=dp) 단위로 오므로 density를 곱해 실 픽셀로 변환해야 한다.
    void startNativeQrScan(double cssX, double cssY, double cssWidth, double cssHeight) {
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M
                && checkSelfPermission(android.Manifest.permission.CAMERA) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
            new AlertDialog.Builder(this)
                    .setMessage("카메라 권한이 꺼져 있습니다. 기기 설정 > 앱 > 권한에서 카메라 권한을 켜주세요.")
                    .setPositiveButton(android.R.string.ok, (d, w) -> d.dismiss())
                    .show();
            return;
        }
        if (qrScannerView == null) return;

        float density = getResources().getDisplayMetrics().density;
        int x = Math.round((float) cssX * density);
        int y = Math.round((float) cssY * density);
        int width = Math.round((float) cssWidth * density);
        int height = Math.round((float) cssHeight * density);
        if (width <= 0 || height <= 0) return;

        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) qrScannerView.getLayoutParams();
        params.width = width;
        params.height = height;
        params.leftMargin = x;
        params.topMargin = y;
        params.gravity = Gravity.TOP | Gravity.LEFT;
        qrScannerView.setLayoutParams(params);
        qrScannerView.setVisibility(View.VISIBLE);

        int buttonMargin = Math.round(6 * density);
        FrameLayout.LayoutParams btnParams = (FrameLayout.LayoutParams) qrCameraFlipButton.getLayoutParams();
        btnParams.leftMargin = x + width - buttonMargin; // 실제 폭은 wrap_content라 우측 정렬로 보정
        btnParams.topMargin = y + buttonMargin;
        btnParams.gravity = Gravity.TOP | Gravity.LEFT;
        qrCameraFlipButton.setLayoutParams(btnParams);
        qrCameraFlipButton.setVisibility(View.VISIBLE);
        qrCameraFlipButton.bringToFront();
        // wrap_content라 실제 폭을 모른 채로 leftMargin을 잡았으므로, 레이아웃 확정 후
        // 실측 폭을 이용해 우측 끝에 정확히 붙도록 한 번 더 보정한다.
        final int rightEdge = x + width - buttonMargin;
        qrCameraFlipButton.post(() -> {
            FrameLayout.LayoutParams p = (FrameLayout.LayoutParams) qrCameraFlipButton.getLayoutParams();
            p.leftMargin = rightEdge - qrCameraFlipButton.getWidth();
            qrCameraFlipButton.setLayoutParams(p);
        });

        CameraSettings settings = new CameraSettings();
        int camId = findCameraId(isNativeQrFrontFacing());
        if (camId >= 0) settings.setRequestedCameraId(camId);
        qrScannerView.setCameraSettings(settings);
        qrScannerView.resume();
        qrScannerView.decodeContinuous(result -> onNativeQrDecoded(result));

        pauseCardReaderForCamera();
    }

    private void onNativeQrDecoded(BarcodeResult result) {
        String scannedText = result.getText();
        if (scannedText == null || webView == null) return;
        webView.evaluateJavascript(
                "window.onAndroidQrScanned && window.onAndroidQrScanned("
                        + org.json.JSONObject.quote(scannedText) + ");",
                null);
    }

    // admin.js가 QR 모드를 벗어나거나(NFC 탭 전환, 모달 닫기) 화면이 파괴될 때 호출 -
    // 카메라를 끄고 NFC 리더를 재활성화한다.
    void stopNativeQrScan() {
        if (qrScannerView != null) {
            qrScannerView.pause();
            qrScannerView.setVisibility(View.GONE);
        }
        if (qrCameraFlipButton != null) {
            qrCameraFlipButton.setVisibility(View.GONE);
        }
        if (cardReaderManager != null) {
            cardReaderManager.evaluateAndActivate();
        }
    }

    // 우상단 네이티브 "전환" 버튼(HTML이 아니라 네이티브 View인 이유는 클래스 상단 주석 참고) -
    // 전/후면 선호도를 SharedPreferences에 저장해두고 같은 위치/크기로 카메라만 다시 연다.
    private void flipNativeQrCamera() {
        if (qrScannerView == null || qrScannerView.getVisibility() != View.VISIBLE) return;
        setNativeQrFrontFacing(!isNativeQrFrontFacing());

        FrameLayout.LayoutParams params = (FrameLayout.LayoutParams) qrScannerView.getLayoutParams();
        float density = getResources().getDisplayMetrics().density;
        startNativeQrScan(params.leftMargin / density, params.topMargin / density,
                params.width / density, params.height / density);
    }

    private boolean isNativeQrFrontFacing() {
        return getSharedPreferences(QR_PREFS_NAME, MODE_PRIVATE).getBoolean(QR_PREF_FRONT_CAMERA, false);
    }

    private void setNativeQrFrontFacing(boolean front) {
        getSharedPreferences(QR_PREFS_NAME, MODE_PRIVATE).edit().putBoolean(QR_PREF_FRONT_CAMERA, front).apply();
    }

    // CameraSettings.setRequestedCameraId(int)는 카메라 ID를 그대로 받을 뿐 전/후면을 모르므로,
    // Camera.CameraInfo로 실제 방향을 조회해 원하는 방향의 첫 카메라 ID를 찾는다(기기별 카메라
    // 개수/열거 순서에 안전).
    private int findCameraId(boolean front) {
        try {
            int count = Camera.getNumberOfCameras();
            Camera.CameraInfo info = new Camera.CameraInfo();
            for (int i = 0; i < count; i++) {
                Camera.getCameraInfo(i, info);
                boolean isFront = info.facing == Camera.CameraInfo.CAMERA_FACING_FRONT;
                if (isFront == front) return i;
            }
        } catch (Exception e) {
            Log.w(TAG, "findCameraId failed: " + e.getMessage());
        }
        return -1;
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

    // admin.js가 이 메서드의 존재 여부(typeof ... === "function")로 네이티브 QR 스캔 지원을
    // 감지한다 - 앱 안(이 브릿지가 있는 곳)에서는 이걸로 스캔하고, 일반 브라우저는 기존
    // getUserMedia 경로를 그대로 쓴다. 결과는 window.onAndroidQrScanned(text)로 돌아온다.
    // x/y/width/height는 카메라를 겹쳐 그릴 #admin-qr-native-camera-slot의 화면 좌표(CSS px) -
    // admin.js가 getBoundingClientRect()로 계산해 넘긴다.
    @android.webkit.JavascriptInterface
    public void startQrScan(double x, double y, double width, double height) {
        activity.runOnUiThread(() -> activity.startNativeQrScan(x, y, width, height));
    }

    // QR 모드를 벗어나거나(NFC 탭 전환, 모달 닫기) 카메라를 끌 때 admin.js가 호출.
    @android.webkit.JavascriptInterface
    public void stopQrScan() {
        activity.runOnUiThread(activity::stopNativeQrScan);
    }

    // kiosk.js가 설정 버튼 옆 자물쇠 버튼을 이 값들로 켜고(kiosk 락다운 빌드일 때만) 아이콘을
    // 현재 화면 고정 상태에 맞춰 그린다.
    @android.webkit.JavascriptInterface
    public boolean isKioskLockdownEnabled() {
        return activity.isKioskLockdownEnabled();
    }

    // admin.js가 로그인(PIN 인증) 성공 시 호출 - DepositAutoDetector가 앱이 완전히 꺼진 상태
    // (웹뷰 없음)에서도 백엔드에 직접 입금을 등록할 수 있도록 토큰을 SharedPreferences로
    // 미러링해둔다. SharedPreferences 쓰기만 하므로 UI 스레드로 안 넘겨도 안전하다.
    @android.webkit.JavascriptInterface
    public void saveAdminToken(String token) {
        DepositAutoDetector.saveAdminToken(activity.getApplicationContext(), token);
    }

    // admin.js가 자동감지 설정을 저장/초기화/로드할 때마다 호출 - saveAdminToken과 같은 이유로
    // 발신번호·알림 패키지/제목 필터·정규식을 SharedPreferences에도 같이 저장해둔다.
    @android.webkit.JavascriptInterface
    public void saveDetectSettings(String sender, String regex, String pushPackage, String pushTitle) {
        DepositAutoDetector.saveDetectSettings(activity.getApplicationContext(), sender, regex, pushPackage, pushTitle);
    }

    @android.webkit.JavascriptInterface
    public boolean isScreenPinningActive() {
        return activity.isScreenPinningActive();
    }

    @android.webkit.JavascriptInterface
    public void toggleScreenPinning() {
        activity.runOnUiThread(activity::toggleScreenPinning);
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
