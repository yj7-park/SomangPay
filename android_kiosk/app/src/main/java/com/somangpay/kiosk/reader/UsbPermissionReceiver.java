package com.somangpay.kiosk.reader;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbManager;
import android.util.Log;

// D8 컴파일러 호환성 확보를 위해 익명 클래스를 피하고 명명 클래스로 정의(MainActivity의 기존 컨벤션과 동일)
public class UsbPermissionReceiver extends BroadcastReceiver {

    public static final String ACTION_USB_PERMISSION = "com.somangpay.kiosk.USB_PERMISSION";
    private static final String TAG = "UsbPermissionReceiver";

    private final CardReaderManager manager;

    public UsbPermissionReceiver(CardReaderManager manager) {
        this.manager = manager;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!ACTION_USB_PERMISSION.equals(intent.getAction())) return;

        UsbDevice device = intent.getParcelableExtra(UsbManager.EXTRA_DEVICE);
        boolean granted = intent.getBooleanExtra(UsbManager.EXTRA_PERMISSION_GRANTED, false);
        Log.d(TAG, "USB permission result: granted=" + granted
                + " device=" + (device != null ? device.getDeviceName() : "null"));
        manager.onUsbPermissionResult(device, granted);
    }
}
