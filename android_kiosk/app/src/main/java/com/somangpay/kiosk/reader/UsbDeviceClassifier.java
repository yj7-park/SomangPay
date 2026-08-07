package com.somangpay.kiosk.reader;

import android.hardware.usb.UsbConstants;
import android.hardware.usb.UsbDevice;
import android.hardware.usb.UsbInterface;

// 표준 클래스 코드(CCID/HID 부트 키보드)는 인터페이스 클래스 코드로, 벤더 전용
// 프로토콜을 쓰는 리더(NFC-X)는 VID/PID로 판별한다.
public class UsbDeviceClassifier {

    // USB-IF에 공식 상수가 없는 CCID(스마트카드) 클래스 코드
    private static final int USB_CLASS_CCID = 0x0B;
    private static final int HID_SUBCLASS_BOOT = 0x01;
    private static final int HID_PROTOCOL_KEYBOARD = 0x01;

    // NFC-X 리더(STMicro 칩셋)는 CCID도 HID 부트 키보드도 아닌, 벤더 전용 HID 리포트
    // 프로토콜(Class 3 / SubClass 0 / Prot 0)을 쓴다. 클래스 코드만으로는 다른 벤더
    // HID 장치와 구분이 안 되므로 VID/PID로 특정한다.
    // 실기기 USB 캡처(Wireshark+USBPcap, nfctool.exe 트래픽)로 프로토콜을 확인함.
    private static final int VENDOR_ID_NFC_X = 0x0483;
    private static final int PRODUCT_ID_NFC_X = 0x4343;

    public enum Type {
        CCID,
        HID_KEYBOARD,
        VENDOR_HID_NFC,
        UNKNOWN
    }

    public static Type classify(UsbDevice device) {
        if (device == null) return Type.UNKNOWN;

        if (device.getVendorId() == VENDOR_ID_NFC_X && device.getProductId() == PRODUCT_ID_NFC_X) {
            return Type.VENDOR_HID_NFC;
        }

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
