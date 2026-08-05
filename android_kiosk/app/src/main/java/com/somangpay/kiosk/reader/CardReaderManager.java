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

    private enum ActiveMode { NONE, USB_CCID, USB_HID_KEYBOARD, BUILTIN_NFC }

    private final Activity activity;
    private final WebView webView;
    private final Handler mainHandler;
    private final UsbManager usbManager;
    private final NativeNfcController nfcController;

    private UsbPermissionReceiver permissionReceiver;
    private UsbHotplugReceiver hotplugReceiver;
    private boolean receiversRegistered = false;

    private ActiveMode currentMode = ActiveMode.NONE;
    private long lastErrorToastTime = 0L;

    // CCID 세션 상태
    private UsbDevice activeCcidDevice;
    private UsbDeviceConnection activeCcidConnection;
    private UsbInterface activeCcidInterface;
    private CcidUidReader activeCcidReader;
    private Thread ccidThread;
    private UsbDevice pendingPermissionDevice;

    // HID 키보드형 리더는 OS가 이미 키 입력을 처리하므로 존재 감지/로깅만 수행
    private UsbDevice lastLoggedHidDevice;

    public CardReaderManager(Activity activity, WebView webView, Handler mainHandler,
                              UsbManager usbManager, NativeNfcController nfcController) {
        this.activity = activity;
        this.webView = webView;
        this.mainHandler = mainHandler;
        this.usbManager = usbManager;
        this.nfcController = nfcController;
    }

    public void onResume() {
        registerReceiversIfNeeded();
        evaluateAndActivate();
    }

    public void onPause() {
        stopCcidSession();
        nfcController.disable();
        unregisterReceivers();
        currentMode = ActiveMode.NONE;
    }

    private void registerReceiversIfNeeded() {
        if (receiversRegistered) return;

        permissionReceiver = new UsbPermissionReceiver(this);
        hotplugReceiver = new UsbHotplugReceiver(this);

        IntentFilter permissionFilter = new IntentFilter(UsbPermissionReceiver.ACTION_USB_PERMISSION);
        IntentFilter hotplugFilter = new IntentFilter();
        hotplugFilter.addAction(UsbManager.ACTION_USB_DEVICE_ATTACHED);
        hotplugFilter.addAction(UsbManager.ACTION_USB_DEVICE_DETACHED);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            activity.registerReceiver(permissionReceiver, permissionFilter, Context.RECEIVER_NOT_EXPORTED);
            activity.registerReceiver(hotplugReceiver, hotplugFilter, Context.RECEIVER_EXPORTED);
        } else {
            activity.registerReceiver(permissionReceiver, permissionFilter);
            activity.registerReceiver(hotplugReceiver, hotplugFilter);
        }
        receiversRegistered = true;
    }

    private void unregisterReceivers() {
        if (!receiversRegistered) return;
        try {
            activity.unregisterReceiver(permissionReceiver);
        } catch (IllegalArgumentException ignored) {}
        try {
            activity.unregisterReceiver(hotplugReceiver);
        } catch (IllegalArgumentException ignored) {}
        receiversRegistered = false;
    }

    // USB 장치 목록을 훑어 CCID > HID 키보드 > 내장 NFC > 에러 순으로 활성화한다.
    public void evaluateAndActivate() {
        UsbDevice ccidDevice = null;
        UsbDevice hidDevice = null;

        for (UsbDevice device : usbManager.getDeviceList().values()) {
            UsbDeviceClassifier.Type type = UsbDeviceClassifier.classify(device);
            if (type == UsbDeviceClassifier.Type.CCID && ccidDevice == null) {
                ccidDevice = device;
            } else if (type == UsbDeviceClassifier.Type.HID_KEYBOARD && hidDevice == null) {
                hidDevice = device;
            }
        }

        if (ccidDevice != null) {
            activateCcid(ccidDevice);
            return;
        }

        // CCID 리더가 더 이상 없으면 기존 세션 정리
        stopCcidSession();

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
        if (currentMode == ActiveMode.USB_CCID) {
            if (device.equals(activeCcidDevice)) return; // 이미 스트리밍 중
            if (device.equals(pendingPermissionDevice)) return; // 권한 응답 대기 중
        }

        nfcController.disable();
        currentMode = ActiveMode.USB_CCID;

        if (usbManager.hasPermission(device)) {
            openCcidConnection(device);
        } else {
            requestUsbPermission(device);
        }
    }

    private void requestUsbPermission(UsbDevice device) {
        pendingPermissionDevice = device;
        Intent intent = new Intent(UsbPermissionReceiver.ACTION_USB_PERMISSION);
        intent.setPackage(activity.getPackageName());
        int flags = Build.VERSION.SDK_INT >= Build.VERSION_CODES.S ? PendingIntent.FLAG_MUTABLE : 0;
        PendingIntent permissionIntent = PendingIntent.getBroadcast(activity, 0, intent, flags);
        usbManager.requestPermission(device, permissionIntent);
        Log.d(TAG, "Requesting USB permission for CCID device: " + device.getDeviceName());
    }

    // UsbPermissionReceiver에서 호출
    void onUsbPermissionResult(UsbDevice device, boolean granted) {
        if (device == null || !device.equals(pendingPermissionDevice)) return;
        pendingPermissionDevice = null;

        if (granted) {
            openCcidConnection(device);
        } else {
            Log.w(TAG, "USB permission denied for " + device.getDeviceName() + "; re-evaluating readers");
            currentMode = ActiveMode.NONE;
            evaluateAndActivate();
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
    // JS가 카메라를 닫을 때는 기존 evaluateAndActivate() 재평가 경로(reevaluateCardReaders)로 다시 켜진다.
    public void pauseBuiltinNfcForCamera() {
        if (currentMode == ActiveMode.BUILTIN_NFC) {
            nfcController.disable();
            Log.d(TAG, "Built-in NFC paused for camera use");
        }
    }

    // UsbHotplugReceiver에서 호출
    void onUsbDetached(UsbDevice device) {
        if (device == null) {
            evaluateAndActivate();
            return;
        }
        if (device.equals(activeCcidDevice)) {
            stopCcidSession();
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
