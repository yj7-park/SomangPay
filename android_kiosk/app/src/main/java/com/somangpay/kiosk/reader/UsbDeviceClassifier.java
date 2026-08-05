package com.somangpay.kiosk.reader;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbInterface;

// USB VID/PID를 모르는 상태(실기기 미확보)에서도 동작하도록, 인터페이스 클래스 코드로 리더 종류를 판별한다.
public class UsbDeviceClassifier {

    // USB-IF에 공식 상수가 없는 CCID(스마트카드) 클래스 코드
    private static final int USB_CLASS_CCID = 0x0B;
    private static final int HID_SUBCLASS_BOOT = 0x01;
    private static final int HID_PROTOCOL_KEYBOARD = 0x01;

    public enum Type {
        CCID,
        HID_KEYBOARD,
        UNKNOWN
    }

    public static Type classify(UsbDevice device) {
        if (device == null) return Type.UNKNOWN;

        for (int i = 0; i < device.getInterfaceCount(); i++) {
            UsbInterface iface = device.getInterface(i);

            if (iface.getInterfaceClass() == USB_CLASS_CCID) {
                return Type.CCID;
            }

            if (iface.getInterfaceClass() == UsbConstants.USB_CLASS_HID
                    && iface.getInterfaceSubclass() == HID_SUBCLASS_BOOT
                    && iface.getInterfaceProtocol() == HID_PROTOCOL_KEYBOARD) {
                return Type.HID_KEYBOARD;
            }
        }

        return Type.UNKNOWN;
    }

    private UsbDeviceClassifier() {}
}
