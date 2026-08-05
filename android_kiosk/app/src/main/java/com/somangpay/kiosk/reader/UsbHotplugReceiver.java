package com.somangpay.kiosk.reader;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.util.Log;

// D8 컴파일러 호환성 확보를 위해 익명 클래스를 피하고 명명 클래스로 정의(MainActivity의 기존 컨벤션과 동일)
public class UsbHotplugReceiver extends BroadcastReceiver {

    private static final String TAG = "UsbHotplugReceiver";

    private final CardReaderManager manager;

    public UsbHotplugReceiver(CardReaderManager manager) {
        this.manager = manager;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        String action = intent.getAction();
        UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);

        if (UsbManager.ACTION_USB_DEVICE_ATTACHED.equals(action)) {
            Log.d(TAG, "USB device attached: " + (device != null ? device.getDeviceName() : "unknown"));
            manager.evaluateAndActivate();
        } else if (UsbManager.ACTION_USB_DEVICE_DETACHED.equals(action)) {
            Log.d(TAG, "USB device detached: " + (device != null ? device.getDeviceName() : "unknown"));
            manager.onUsbDetached(device);
        }
    }
}
