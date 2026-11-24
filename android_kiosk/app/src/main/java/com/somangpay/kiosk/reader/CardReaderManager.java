package com.somangpay.kiosk.reader;

import android.app.Activity;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.hardware.usb.UsbManager;
import android.os.Build;
import android.os.Handler;
import android.os.SystemClock;
import android.util.Log;
import android.webkit.WebView;
import android.widget.Toast;

// 카드 리더 우선순위(USB CCID > USB HID 키보드 > 기기 내장 NFC > 에러) 판단과
// USB 리더의 연결/권한/핫플러그 처리를 전담하는 오케스트레이터.
// 기존에 동작하던 내장 NFC 경로(MainActivity의 enableNativeNfcReaderMode 등)는
// NativeNfcController 인터페이스로 감싸서 위임만 받고 직접 수정하지 않는다.
public class CardReaderManager {

    public interface NativeNfcController {
        boolean isAvailable();
        void enable();
        void disable();
    }

    private static final String TAG = "CardReaderManager";
    private static final long ERROR_TOAST_DEBOUNCE_MS = 60_000L;
    // USB-IF에 공식 상수가 없는 CCID(스마트카드) 인터페이스 클래스 코드
    private static final int USB_CLASS_CCID = 0x0B;

    // 일부 태블릿의 USB 호스트 드라이버가 bulkTransfer() 타임아웃을 지키지 않고 커널
    // 레벨에서 무한정 블록되는 경우가 있어(usb_start_wait_urb), 이를 감지해 연결을
    // 강제로 닫고 재시작하는 워치독 주기/임계값
    private static final long VENDOR_HID_WATCHDOG_INTERVAL_MS = 2_000L;
    private static final long VENDOR_HID_STUCK_THRESHOLD_MS = 4_000L;
    private static final long STOP_JOIN_TIMEOUT_MS = 700L;
    // 권한 창을 띄운 뒤 이 시간 안에 다시 평가(onResume 등)가 오면 창이 아직 떠 있거나 결과가
    // 오는 중이라고 보고 같은 요청을 또 보내지 않는다 - 겹쳐 뜨는 권한 창 방지.
    private static final long PERMISSION_DIALOG_GRACE_MS = 15_000L;
    // 화면 포커스를 되찾은 직후엔 화면 고정(startLockTask) 안내 창이 곧바로 뜰 수 있어서, 잠깐
    // 기다렸다가 그때도 포커스가 있을 때만 USB 권한 창을 띄운다.
    private static final long DEFERRED_PERMISSION_DELAY_MS = 1_000L;

    private enum ActiveMode { NONE, USB_CCID, USB_VENDOR_HID_NFC, USB_HID_KEYBOARD, BUILTIN_NFC }

    private final Activity activity;
    private final WebView webView;
    private final Handler mainHandler;
    private final UsbManager usbManager;
    private final NativeNfcController nfcController;

    private UsbPermissionReceiver permissionReceiver;
    private UsbHotplugReceiver hotplugReceiver;
    private boolean receiversRegistered = false;
    private boolean permissionReceiverRegistered = false;
    private boolean resumed = false;

    // USB 권한 요청 상태(2026-11-24 "NFC 활성화가 안 될 때가 있다" 대응).
    // permissionRequestedAtMs: 실제로 권한 창을 띄운 시각(0이면 아직 안 띄움/포커스 대기 중).
    // permissionRequestDeferred: 포커스가 없어(화면 고정 안내 등) 창 띄우기를 미뤄둔 상태.
    // permissionDeniedDevice: 사용자가 거절했거나 창이 닫혀버린 장치 - 자동으로 다시 묻지 않고
    // (거절할 때마다 창이 또 뜨는 무한 반복 방지) NFC 칩을 눌러야(retryFromUser) 다시 묻는다.
    private long permissionRequestedAtMs = 0L;
    private boolean permissionRequestDeferred = false;
    private UsbDevice permissionDeniedDevice;

    private final Runnable deferredPermissionTask = new Runnable() {
        @Override
        public void run() {
            if (!permissionRequestDeferred || pendingPermissionDevice == null) return;
            if (!resumed || !activity.hasWindowFocus()) return; // 다음 포커스 획득 때 다시 시도
            evaluateAndActivate();
        }
    };

    private ActiveMode currentMode = ActiveMode.NONE;
    private long lastErrorToastTime = 0L;

    // CCID 세션 상태
    private UsbDevice activeCcidDevice;
    private UsbDeviceConnection activeCcidConnection;
    private UsbInterface activeCcidInterface;
    private CcidUidReader activeCcidReader;
    private Thread ccidThread;
    private UsbDevice pendingPermissionDevice;

    // 벤더 HID(NFC-X) 세션 상태
    private UsbDevice activeVendorHidDevice;
    private UsbDeviceConnection activeVendorHidConnection;
    private UsbInterface activeVendorHidInterface;
    private VendorHidUidReader activeVendorHidReader;
    private Thread vendorHidThread;

    private final Runnable vendorHidWatchdogTask = new Runnable() {
        @Override
        public void run() {
            if (activeVendorHidReader == null) return; // 세션이 이미 종료됨 - 재스케줄 불필요

            long idleMs = activeVendorHidReader.millisSinceLastActivity();
            if (idleMs > VENDOR_HID_STUCK_THRESHOLD_MS) {
                Log.w(TAG, "Vendor HID reader stuck for " + idleMs + "ms (bulkTransfer timeout not honored by driver); forcing reconnect");
                stopVendorHidSession();
                currentMode = ActiveMode.NONE;
                evaluateAndActivate();
                return;
            }
            mainHandler.postDelayed(this, VENDOR_HID_WATCHDOG_INTERVAL_MS);
        }
    };

    // HID 키보드형 리더는 OS가 이미 키 입력을 처리하므로 존재 감지/로깅만 수행
    private UsbDevice lastLoggedHidDevice;

    public CardReaderManager(Activity activity, WebView webView, Handler mainHandler,
                              UsbManager usbManager, NativeNfcController nfcController) {
        this.activity = activity;
        this.webView = webView;
        this.mainHandler = mainHandler;
        this.usbManager = usbManager;
        this.nfcController = nfcController;
        // 권한 결과 수신기는 액티비티 수명 내내 등록해 둔다. 예전엔 onPause에서 해제했는데, 권한 창이
        // 뜨는 순간 액티비티가 onPause되므로 사용자가 "확인"을 눌러도 결과 브로드캐스트를 받을 수신기가
        // 없어 결과가 버려졌다 - 그 사이 화면 고정 안내까지 겹치면 권한 대기 상태로 영영 멈춰
        // "NFC 활성화가 안 됨"이 됐다.
        registerPermissionReceiverIfNeeded();
    }

    // JS가 페이지 로드 시점에 현재 리더 상태를 바로 조회할 수 있도록 제공.
    // onCardReaderModeChanged() push 콜백은 evaluateJavascript가 페이지 JS 준비 전에
    // 호출되면 유실될 수 있어(window.onCardReaderModeChanged 미정의 시 조용히 무시됨),
    // 이 getter로 pull 방식 조회를 병행한다.
    public String getCurrentModeName() {
        // USB 권한 응답을 기다리는 동안엔 currentMode만 먼저 USB_*로 바뀌어 있고 세션은 아직 없다 -
        // 그대로 알려주면 키오스크 배지가 "NFC 스캔 활성화"인데 실제로는 안 읽히는 상태가 된다.
        if (pendingPermissionDevice != null) return ActiveMode.NONE.name();
        return currentMode.name();
    }

    public void onResume() {
        resumed = true;
        registerReceiversIfNeeded();
        evaluateAndActivate();
    }

    public void onPause() {
        resumed = false;
        mainHandler.removeCallbacks(deferredPermissionTask);
        stopCcidSession();
        stopVendorHidSession();
        nfcController.disable();
        unregisterReceivers();
        currentMode = ActiveMode.NONE;
        // pendingPermissionDevice/permissionRequestedAtMs는 일부러 그대로 둔다 - 권한 창 때문에
        // onPause된 경우가 대부분이라, 돌아왔을 때 같은 창을 또 띄우지 않아야 한다.
    }

    // MainActivity.onDestroy에서 호출 - 액티비티 수명 동안 유지하던 권한 수신기까지 정리한다.
    public void release() {
        onPause();
        if (permissionReceiverRegistered) {
            try {
                activity.unregisterReceiver(permissionReceiver);
            } catch (IllegalArgumentException ignored) {}
            permissionReceiverRegistered = false;
        }
    }

    // MainActivity.onWindowFocusChanged에서 호출 - 포커스가 없어서 미뤄둔 권한 요청을 이어서 한다.
    public void onWindowFocusChanged(boolean hasFocus) {
        mainHandler.removeCallbacks(deferredPermissionTask);
        if (hasFocus && permissionRequestDeferred && pendingPermissionDevice != null) {
            mainHandler.postDelayed(deferredPermissionTask, DEFERRED_PERMISSION_DELAY_MS);
        }
    }

    // 키오스크 NFC 칩을 눌렀을 때(JS → KioskWebAppInterface.retryCardReader) 호출. 거절/창 닫힘으로
    // 멈춘 권한 요청을 다시 띄우고, 이미 연결돼 있어도 세션을 새로 열어 "배지는 켜졌는데 안 읽힘"
    // 상태도 칩 한 번으로 복구되게 한다. 사용자가 직접 누른 것이라 포커스가 있어 창이 바로 뜬다.
    public void retryFromUser() {
        Log.i(TAG, "Card reader retry requested by user");
        mainHandler.removeCallbacks(deferredPermissionTask);
        permissionDeniedDevice = null;
        pendingPermissionDevice = null;
        permissionRequestedAtMs = 0L;
        permissionRequestDeferred = false;
        stopCcidSession();
        stopVendorHidSession();
        if (currentMode == ActiveMode.BUILTIN_NFC) nfcController.disable();
        lastLoggedHidDevice = null;
        currentMode = ActiveMode.NONE;
        evaluateAndActivate();
    }

    private void registerPermissionReceiverIfNeeded() {
        if (permissionReceiverRegistered) return;
        permissionReceiver = new UsbPermissionReceiver(this);
        IntentFilter permissionFilter = new IntentFilter(UsbPermissionReceiver.ACTION_USB_PERMISSION);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.registerReceiver(permissionReceiver, permissionFilter, Context.RECEIVER_NOT_EXPORTED);
        } else {
            activity.registerReceiver(permissionReceiver, permissionFilter);
        }
        permissionReceiverRegistered = true;
    }

    private void registerReceiversIfNeeded() {
        registerPermissionReceiverIfNeeded();
        if (receiversRegistered) return;

        hotplugReceiver = new UsbHotplugReceiver(this);

        IntentFilter hotplugFilter = new IntentFilter();
        hotplugFilter.addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED);
        hotplugFilter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.registerReceiver(hotplugReceiver, hotplugFilter, Context.RECEIVER_EXPORTED);
        } else {
            activity.registerReceiver(hotplugReceiver, hotplugFilter);
        }
        receiversRegistered = true;
    }

    // 핫플러그 수신기만 해제한다(권한 수신기는 위 생성자 주석 이유로 release()에서만 해제).
    private void unregisterReceivers() {
        if (!receiversRegistered) return;
        try {
            activity.unregisterReceiver(hotplugReceiver);
        } catch (IllegalArgumentException ignored) {}
        receiversRegistered = false;
    }

    // USB 장치 목록을 훑어 CCID > HID 키보드 > 내장 NFC > 에러 순으로 활성화한다.
    public void evaluateAndActivate() {
        // 화면이 내려간(onPause) 동안엔 세션을 열지 않는다 - 늦게 온 권한 결과나 JS 호출이 백그라운드에서
        // 리더를 열면, onPause에서 닫는 짝이 없어 다음 onResume 때 이중 세션이 된다. onResume이 다시 평가한다.
        if (!resumed) return;
        UsbDevice ccidDevice = null;
        UsbDevice vendorHidDevice = null;
        UsbDevice hidDevice = null;

        for (UsbDevice device : usbManager.getDeviceList().values()) {
            UsbDeviceClassifier.Type type = UsbDeviceClassifier.classify(device);
            if (type == UsbDeviceClassifier.Type.CCID && ccidDevice == null) {
                ccidDevice = device;
            } else if (type == UsbDeviceClassifier.Type.VENDOR_HID_NFC && vendorHidDevice == null) {
                vendorHidDevice = device;
            } else if (type == UsbDeviceClassifier.Type.HID_KEYBOARD && hidDevice == null) {
                hidDevice = device;
            }
        }

        if (ccidDevice != null) {
            stopVendorHidSession();
            activateCcid(ccidDevice);
            return;
        }

        // CCID 리더가 더 이상 없으면 기존 세션 정리
        stopCcidSession();

        if (vendorHidDevice != null) {
            activateVendorHid(vendorHidDevice);
            return;
        }

        // 벤더 HID 리더가 더 이상 없으면 기존 세션 정리
        stopVendorHidSession();

        if (hidDevice != null) {
            activateHidPassive(hidDevice);
            return;
        }

        lastLoggedHidDevice = null;

        if (nfcController.isAvailable()) {
            activateBuiltinNfc();
            return;
        }

        emitNoReaderError();
    }

    private void activateCcid(UsbDevice device) {
        if (currentMode == ActiveMode.USB_CCID && device.equals(activeCcidDevice)) return; // 이미 스트리밍 중

        nfcController.disable();
        currentMode = ActiveMode.USB_CCID;

        if (usbManager.hasPermission(device)) {
            clearPermissionState();
            openCcidConnection(device);
        } else {
            requestUsbPermission(device);
        }
    }

    private void clearPermissionState() {
        mainHandler.removeCallbacks(deferredPermissionTask);
        pendingPermissionDevice = null;
        permissionRequestedAtMs = 0L;
        permissionRequestDeferred = false;
        permissionDeniedDevice = null;
    }

    // 권한 창은 (1) 사용자가 거절한 장치면 자동으로 다시 띄우지 않고, (2) 이미 띄운 창이 떠 있을
    // 시간이면 또 띄우지 않고, (3) 화면 포커스가 없으면(앱 시작 직후, 화면 고정 안내가 떠 있을 때)
    // 포커스를 되찾을 때까지 미룬다. 예전엔 onResume마다 무조건 다시 요청해서 화면 고정 안내와 겹치면
    // 창이 엉뚱하게 닫히거나 결과가 사라져 리더가 안 켜진 채로 남았다.
    private void requestUsbPermission(UsbDevice device) {
        if (device.equals(permissionDeniedDevice)) {
            pendingPermissionDevice = null;
            currentMode = ActiveMode.NONE;
            Log.d(TAG, "USB permission previously denied for " + device.getDeviceName() + "; waiting for user retry");
            notifyModeChange("NONE");
            return;
        }

        long now = SystemClock.elapsedRealtime();
        if (device.equals(pendingPermissionDevice) && permissionRequestedAtMs > 0L
                && now - permissionRequestedAtMs < PERMISSION_DIALOG_GRACE_MS) {
            return; // 이미 띄운 권한 창의 결과를 기다리는 중
        }

        pendingPermissionDevice = device;
        notifyModeChange("NONE"); // 권한 받기 전엔 실제로 안 읽히므로 배지를 꺼 둔다

        if (!activity.hasWindowFocus()) {
            permissionRequestDeferred = true;
            permissionRequestedAtMs = 0L;
            Log.d(TAG, "Deferring USB permission request until window focus: " + device.getDeviceName());
            return;
        }

        permissionRequestDeferred = false;
        permissionRequestedAtMs = now;
        Intent intent = new Intent(UsbPermissionReceiver.ACTION_USB_PERMISSION);
        intent.setPackage(activity.getPackageName());
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        PendingIntent permissionIntent = PendingIntent.getBroadcast(activity, 0, intent, flags);
        usbManager.requestPermission(device, permissionIntent);
        Log.d(TAG, "Requesting USB permission for device: " + device.getDeviceName());
    }

    // UsbPermissionReceiver에서 호출. 권한 수신기가 항상 등록돼 있어서 화면이 내려가 있는 동안에도
    // 결과가 들어온다 - 그때는 상태만 정리하고 실제 연결은 onResume의 재평가에 맡긴다.
    void onUsbPermissionResult(UsbDevice device, boolean granted) {
        if (device == null) return;
        mainHandler.removeCallbacks(deferredPermissionTask);
        pendingPermissionDevice = null;
        permissionRequestedAtMs = 0L;
        permissionRequestDeferred = false;

        if (granted) {
            permissionDeniedDevice = null;
            // onResume 재평가가 hasPermission()으로 먼저 열었으면 늦게 온 결과는 무시(이중 세션 방지)
            if (device.equals(activeVendorHidDevice) || device.equals(activeCcidDevice)) return;
            currentMode = ActiveMode.NONE;
            evaluateAndActivate();
        } else {
            Log.w(TAG, "USB permission denied for " + device.getDeviceName() + "; waiting for user retry");
            permissionDeniedDevice = device;
            currentMode = ActiveMode.NONE;
            notifyModeChange("NONE");
            if (resumed) {
                Toast.makeText(activity, "카드 리더 권한이 허용되지 않았습니다. NFC 버튼을 눌러 다시 연결해 주세요.",
                        Toast.LENGTH_LONG).show();
            }
        }
    }

    private void openCcidConnection(UsbDevice device) {
        UsbInterface ccidInterface = findCcidInterface(device);
        if (ccidInterface == null) {
            Log.e(TAG, "No CCID interface found on device");
            currentMode = ActiveMode.NONE;
            evaluateAndActivate();
            return;
        }

        UsbDeviceConnection connection = usbManager.openDevice(device);
        if (connection == null || !connection.claimInterface(ccidInterface, true)) {
            Log.e(TAG, "Failed to open/claim CCID interface");
            currentMode = ActiveMode.NONE;
            evaluateAndActivate();
            return;
        }
        resetInterfaceState(connection, ccidInterface);

        UsbEndpoint endpointIn = null;
        UsbEndpoint endpointOut = null;
        for (int i = 0; i < ccidInterface.getEndpointCount(); i++) {
            UsbEndpoint ep = ccidInterface.getEndpoint(i);
            if (ep.getType() != UsbConstants.USB_ENDPOINT_XFER_BULK) continue;
            if (ep.getDirection() == UsbConstants.USB_DIR_IN) {
                endpointIn = ep;
            } else {
                endpointOut = ep;
            }
        }

        if (endpointIn == null || endpointOut == null) {
            Log.e(TAG, "CCID bulk endpoints not found");
            connection.releaseInterface(ccidInterface);
            connection.close();
            currentMode = ActiveMode.NONE;
            evaluateAndActivate();
            return;
        }

        activeCcidDevice = device;
        activeCcidConnection = connection;
        activeCcidInterface = ccidInterface;

        activeCcidReader = new CcidUidReader(connection, ccidInterface, endpointIn, endpointOut,
                new CcidUidReader.Callback() {
                    @Override
                    public void onUidRead(String hexUid) {
                        mainHandler.post(() -> {
                            Log.d(TAG, "CCID UID read: " + hexUid);
                            if (webView != null) {
                                webView.evaluateJavascript("window.onAndroidNfcScanned('" + hexUid + "');", null);
                            }
                        });
                    }

                    @Override
                    public void onSessionFailed() {
                        mainHandler.post(() -> {
                            Log.w(TAG, "CCID session failed, re-evaluating readers");
                            stopCcidSession();
                            currentMode = ActiveMode.NONE;
                            evaluateAndActivate();
                        });
                    }
                });

        ccidThread = new Thread(activeCcidReader, "CcidUidReaderThread");
        ccidThread.start();
        Log.d(TAG, "CCID session started on " + device.getDeviceName());
        notifyModeChange("USB_CCID");
    }

    // "리더를 꽂은 채로 앱을 껐다 켜면 배지는 활성화인데 카드가 안 읽히고, 뺐다 꽂아야 됨"(2026-11-07)
    // 대응. 앱이 꺼질 때(onPause) 폴링 스레드가 OUT/IN 전송 도중에 연결이 닫히면 호스트와 리더의
    // 엔드포인트 데이터 토글(DATA0/1)이 어긋날 수 있는데, 그러면 다시 열었을 때 리더가 우리 요청을
    // "중복 패킷"으로 보고 조용히 버려 응답이 영영 안 온다(뽑았다 꽂으면 양쪽이 초기화돼서 됨).
    // SET_INTERFACE를 보내면 리눅스 커널이 양쪽 엔드포인트 토글을 DATA0으로 되돌린다(대체 설정이
    // 하나뿐인 장치가 이 요청을 STALL하면 커널이 각 엔드포인트에 CLEAR_HALT를 대신 보내 같은 효과).
    // 장치를 재열거(reset)시키지 않으므로 USB 권한이 날아가지도 않는다.
    private void resetInterfaceState(UsbDeviceConnection connection, UsbInterface iface) {
        try {
            boolean ok = connection.setInterface(iface);
            Log.d(TAG, "setInterface(" + iface.getId() + ") for endpoint toggle reset: " + ok);
        } catch (Exception e) {
            Log.w(TAG, "setInterface failed: " + e.getMessage());
        }
    }

    // 폴링 스레드가 지금 하던 전송(요청+응답 한 쌍)을 마칠 때까지 잠깐 기다린다 - 전송 도중에 연결을
    // 닫으면 위의 토글 어긋남이 생긴다. 드라이버가 전송 타임아웃을 안 지키는 기기가 있어(워치독 참고)
    // 무한정 기다리지 않고 짧게만 기다린다(onPause가 메인 스레드라서).
    private static void joinQuietly(Thread t) {
        if (t == null || t == Thread.currentThread()) return;
        try {
            t.join(STOP_JOIN_TIMEOUT_MS);
        } catch (InterruptedException ignored) {
            Thread.currentThread().interrupt();
        }
    }

    private UsbInterface findCcidInterface(UsbDevice device) {
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface iface = device.getInterface(i);
            if (iface.getInterfaceClass() == USB_CLASS_CCID) return iface;
        }
        return null;
    }

    private void stopCcidSession() {
        if (activeCcidReader != null) {
            activeCcidReader.stop();
            activeCcidReader = null;
        }
        if (ccidThread != null) {
            ccidThread.interrupt();
            joinQuietly(ccidThread);
            ccidThread = null;
        }
        if (activeCcidConnection != null) {
            if (activeCcidInterface != null) {
                activeCcidConnection.releaseInterface(activeCcidInterface);
            }
            activeCcidConnection.close();
            activeCcidConnection = null;
        }
        activeCcidInterface = null;
        activeCcidDevice = null;
    }

    private void activateVendorHid(UsbDevice device) {
        if (currentMode == ActiveMode.USB_VENDOR_HID_NFC && device.equals(activeVendorHidDevice)) return; // 이미 스트리밍 중

        nfcController.disable();
        currentMode = ActiveMode.USB_VENDOR_HID_NFC;

        if (usbManager.hasPermission(device)) {
            clearPermissionState();
            openVendorHidConnection(device);
        } else {
            requestUsbPermission(device);
        }
    }

    private void openVendorHidConnection(UsbDevice device) {
        UsbInterface hidInterface = findVendorHidInterface(device);
        if (hidInterface == null) {
            Log.e(TAG, "No HID interface found on vendor NFC device");
            currentMode = ActiveMode.NONE;
            evaluateAndActivate();
            return;
        }

        UsbDeviceConnection connection = usbManager.openDevice(device);
        if (connection == null || !connection.claimInterface(hidInterface, true)) {
            Log.e(TAG, "Failed to open/claim vendor HID interface");
            currentMode = ActiveMode.NONE;
            evaluateAndActivate();
            return;
        }
        resetInterfaceState(connection, hidInterface);

        UsbEndpoint endpointIn = null;
        UsbEndpoint endpointOut = null;
        for (int i = 0; i < hidInterface.getEndpointCount(); i++) {
            UsbEndpoint ep = hidInterface.getEndpoint(i);
            if (ep.getType() != UsbConstants.USB_ENDPOINT_XFER_INT) continue;
            if (ep.getDirection() == UsbConstants.USB_DIR_IN) {
                endpointIn = ep;
            } else {
                endpointOut = ep;
            }
        }

        if (endpointIn == null || endpointOut == null) {
            Log.e(TAG, "Vendor HID interrupt endpoints not found");
            connection.releaseInterface(hidInterface);
            connection.close();
            currentMode = ActiveMode.NONE;
            evaluateAndActivate();
            return;
        }

        activeVendorHidDevice = device;
        activeVendorHidConnection = connection;
        activeVendorHidInterface = hidInterface;

        activeVendorHidReader = new VendorHidUidReader(connection, hidInterface, endpointIn, endpointOut,
                new VendorHidUidReader.Callback() {
                    @Override
                    public void onUidRead(String hexUid, String rawHex) {
                        mainHandler.post(() -> {
                            Log.d(TAG, "Vendor HID UID read: " + hexUid + " raw=" + rawHex);
                            if (webView != null) {
                                webView.evaluateJavascript("window.onAndroidReaderRaw && window.onAndroidReaderRaw('"
                                        + hexUid + "', '" + rawHex + "');", null);
                                webView.evaluateJavascript("window.onAndroidNfcScanned('" + hexUid + "');", null);
                            }
                        });
                    }

                    @Override
                    public void onSessionFailed() {
                        mainHandler.post(() -> {
                            Log.w(TAG, "Vendor HID session failed, re-evaluating readers");
                            stopVendorHidSession();
                            currentMode = ActiveMode.NONE;
                            evaluateAndActivate();
                        });
                    }
                });

        vendorHidThread = new Thread(activeVendorHidReader, "VendorHidUidReaderThread");
        vendorHidThread.start();
        mainHandler.postDelayed(vendorHidWatchdogTask, VENDOR_HID_WATCHDOG_INTERVAL_MS);
        Log.d(TAG, "Vendor HID (NFC-X) session started on " + device.getDeviceName());
        notifyModeChange("USB_VENDOR_HID_NFC");
    }

    private UsbInterface findVendorHidInterface(UsbDevice device) {
        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface iface = device.getInterface(i);
            if (iface.getInterfaceClass() == UsbConstants.USB_CLASS_HID) return iface;
        }
        return null;
    }

    private void stopVendorHidSession() {
        mainHandler.removeCallbacks(vendorHidWatchdogTask);
        if (activeVendorHidReader != null) {
            activeVendorHidReader.stop();
            activeVendorHidReader = null;
        }
        if (vendorHidThread != null) {
            vendorHidThread.interrupt();
            joinQuietly(vendorHidThread);
            vendorHidThread = null;
        }
        if (activeVendorHidConnection != null) {
            if (activeVendorHidInterface != null) {
                activeVendorHidConnection.releaseInterface(activeVendorHidInterface);
            }
            activeVendorHidConnection.close();
            activeVendorHidConnection = null;
        }
        activeVendorHidInterface = null;
        activeVendorHidDevice = null;
    }

    private void activateHidPassive(UsbDevice device) {
        if (currentMode == ActiveMode.USB_HID_KEYBOARD && device.equals(lastLoggedHidDevice)) {
            return;
        }

        nfcController.disable();
        currentMode = ActiveMode.USB_HID_KEYBOARD;
        lastLoggedHidDevice = device;

        String label = device.getProductName() != null ? device.getProductName() : device.getDeviceName();
        Log.i(TAG, "USB HID keyboard-type reader detected: " + label);
        Toast.makeText(activity, "USB 리더기 감지됨 (키보드 모드): " + label, Toast.LENGTH_SHORT).show();
        notifyModeChange("USB_HID_KEYBOARD");
    }

    private void activateBuiltinNfc() {
        if (currentMode == ActiveMode.BUILTIN_NFC) return;
        currentMode = ActiveMode.BUILTIN_NFC;
        nfcController.enable();
        Log.d(TAG, "No USB reader found; falling back to built-in NFC");
        notifyModeChange("BUILTIN_NFC");
    }

    // 카메라 사용 중에는 기기 내장 NFC만 잠시 멈춘다 (외부 USB 리더는 카메라와 상시 동시 사용 가능하므로 그대로 둠).
    // JS가 카메라를 닫을 때는 기존 evaluateAndActivate() 재평가 경로(reevaluateCardReaders)로 다시 켜진다
    // - activateBuiltinNfc()가 그때 currentMode를 BUILTIN_NFC로 되돌리고 notifyModeChange("BUILTIN_NFC")로
    // 알려주므로, 여기서 currentMode를 NONE으로 내려도 재활성화 로직과 어긋나지 않는다(웹 브라우저 쪽
    // Web NFC 경로와 달리, 재활성화가 "이전에 뭐였는지" 기억이 아니라 하드웨어 재스캔으로 판단되기 때문).
    // 이전엔 currentMode/JS 알림을 안 남겨서 kiosk.js의 nfc-activate-btn 배지가 카메라 사용 중에도
    // 계속 "NFC 스캔 활성화"로 남아있었다 - notifyModeChange를 호출해 실제로 안 잡히는 중이라는 걸 반영한다.
    public void pauseBuiltinNfcForCamera() {
        if (currentMode == ActiveMode.BUILTIN_NFC) {
            nfcController.disable();
            currentMode = ActiveMode.NONE;
            Log.d(TAG, "Built-in NFC paused for camera use");
            notifyModeChange("NONE");
        }
    }

    // UsbHotplugReceiver에서 호출
    void onUsbDetached(UsbDevice device) {
        if (device == null) {
            evaluateAndActivate();
            return;
        }
        // 뽑았다 다시 꽂으면 새로 묻는 게 자연스럽다 - 거절/대기 기록을 지운다.
        if (device.equals(permissionDeniedDevice)) permissionDeniedDevice = null;
        if (device.equals(pendingPermissionDevice)) {
            mainHandler.removeCallbacks(deferredPermissionTask);
            pendingPermissionDevice = null;
            permissionRequestedAtMs = 0L;
            permissionRequestDeferred = false;
        }
        if (device.equals(activeCcidDevice)) {
            stopCcidSession();
            currentMode = ActiveMode.NONE;
        } else if (device.equals(activeVendorHidDevice)) {
            stopVendorHidSession();
            currentMode = ActiveMode.NONE;
        } else if (device.equals(lastLoggedHidDevice)) {
            lastLoggedHidDevice = null;
            currentMode = ActiveMode.NONE;
        }
        evaluateAndActivate();
    }

    private void emitNoReaderError() {
        currentMode = ActiveMode.NONE;
        Log.e(TAG, "카드 리더를 찾을 수 없습니다 (USB 리더 없음, 내장 NFC 없음)");

        long now = System.currentTimeMillis();
        if (now - lastErrorToastTime > ERROR_TOAST_DEBOUNCE_MS) {
            lastErrorToastTime = now;
            Toast.makeText(activity, "카드 리더를 찾을 수 없습니다. USB 리더를 연결해주세요.", Toast.LENGTH_LONG).show();
        }

        if (webView != null) {
            webView.evaluateJavascript(
                    "window.onKioskReaderError && window.onKioskReaderError('NO_READER_AVAILABLE');", null);
        }
        notifyModeChange("NONE");
    }

    // 현재 활성화된 리더 모드를 JS로 통지 - 프론트엔드가 내장/외부 리더를 구분해
    // 카메라와의 동시 사용 가능 여부를 판단하는 데 사용한다 (kiosk.js의 window.onCardReaderModeChanged).
    private void notifyModeChange(String jsMode) {
        if (webView == null) return;
        webView.evaluateJavascript(
                "window.onCardReaderModeChanged && window.onCardReaderModeChanged('" + jsMode + "');", null);
    }
}
