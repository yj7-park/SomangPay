package com.somangpay.kiosk;

import android.app.Activity;
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

        // 카드 리더 우선순위(USB CCID > USB HID 키보드 > 내장 NFC > 에러) 오케스트레이터 초기화
        cardReaderManager = new CardReaderManager(this, webView, mainHandler,
                (UsbManager) getSystemService(Context.USB_SERVICE), this);

        // JavaScript에서 NFC 리더 재활성화 요청을 수신할 수 있도록 인터페이스 등록
        webView.addJavascriptInterface(new KioskWebAppInterface(this), "AndroidInterface");

        webView.setWebChromeClient(new KioskWebChromeClient());

        webView.setWebViewClient(new KioskWebViewClient());
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
    @Override
    public void onReceivedSslError(android.webkit.WebView view, android.webkit.SslErrorHandler handler, android.net.http.SslError error) {
        // 사설 SSL 인증서(Self-Signed Certificate) 오류 무시하고 https 접속 진행
        handler.proceed();
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
