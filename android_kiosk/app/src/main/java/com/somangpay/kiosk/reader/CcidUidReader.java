package com.somangpay.kiosk.reader;

import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.util.Log;

import java.util.Arrays;

// USB CCID(PC/SC) 스마트카드 리더에서 카드 UID를 폴링하는 최소 구현.
// 실기기(5YOA NFCSCM) 미확보 상태에서 USB CCID 클래스 스펙과
// ACR122U류 리더의 관례("FF CA 00 00 00" get-UID pseudo-APDU)를 기반으로 작성한
// best-effort 구현이며, 실기기로 바이트 오프셋 검증이 필요하다.
public class CcidUidReader implements Runnable {

    public interface Callback {
        void onUidRead(String hexUid);
        void onSessionFailed();
    }

    private static final String TAG = "CcidUidReader";

    private static final byte PC_TO_RDR_XFR_BLOCK = 0x6F;
    private static final byte RDR_TO_PC_DATA_BLOCK = (byte) 0x80;

    private static final byte[] GET_UID_APDU = {(byte) 0xFF, (byte) 0xCA, 0x00, 0x00, 0x00};

    private static final int POLL_INTERVAL_MS = 300;
    private static final int TRANSFER_TIMEOUT_MS = 1000;

    private final UsbDeviceConnection connection;
    private final UsbInterface usbInterface;
    private final UsbEndpoint endpointIn;
    private final UsbEndpoint endpointOut;
    private final Callback callback;

    private volatile boolean running = true;
    private byte sequence = 0;
    private String lastUid = null;

    public CcidUidReader(UsbDeviceConnection connection, UsbInterface usbInterface,
                          UsbEndpoint endpointIn, UsbEndpoint endpointOut, Callback callback) {
        this.connection = connection;
        this.usbInterface = usbInterface;
        this.endpointIn = endpointIn;
        this.endpointOut = endpointOut;
        this.callback = callback;
    }

    public void stop() {
        running = false;
    }

    @Override
    public void run() {
        Log.d(TAG, "CCID polling thread started");
        while (running) {
            try {
                byte[] uidBytes = requestUid();
                if (uidBytes != null && uidBytes.length > 0) {
                    String hexUid = bytesToHex(uidBytes);
                    if (!hexUid.equals(lastUid)) {
                        lastUid = hexUid;
                        callback.onUidRead(hexUid);
                    }
                } else {
                    // 카드가 리더 위에 없음 -> 다음 태깅 시 재인식되도록 상태 초기화
                    lastUid = null;
                }
            } catch (Exception e) {
                Log.e(TAG, "CCID transfer failed, ending session: " + e.getMessage());
                running = false;
                callback.onSessionFailed();
                return;
            }

            try {
                Thread.sleep(POLL_INTERVAL_MS);
            } catch (InterruptedException ignored) {
                running = false;
            }
        }
        Log.d(TAG, "CCID polling thread stopped");
    }

    // PC_to_RDR_XfrBlock으로 get-UID APDU를 보내고 RDR_to_PC_DataBlock 응답을 파싱한다.
    // 카드가 없거나 응답이 비정상이면 null을 반환한다(에러가 아닌 "카드 없음" 상태로 취급).
    private byte[] requestUid() {
        byte seq = sequence++;
        byte[] command = buildXfrBlock(GET_UID_APDU, seq);

        int sent = connection.bulkTransfer(endpointOut, command, command.length, TRANSFER_TIMEOUT_MS);
        if (sent < 0) {
            throw new RuntimeException("bulkTransfer OUT failed");
        }

        byte[] response = new byte[Math.max(endpointIn.getMaxPacketSize(), 64) + 64];
        int received = connection.bulkTransfer(endpointIn, response, response.length, TRANSFER_TIMEOUT_MS);
        if (received < 10 || response[0] != RDR_TO_PC_DATA_BLOCK) {
            return null;
        }

        int dataLength = (response[1] & 0xFF) | ((response[2] & 0xFF) << 8)
                | ((response[3] & 0xFF) << 16) | ((response[4] & 0xFF) << 24);
        if (dataLength <= 2 || 10 + dataLength > received) {
            return null;
        }

        byte[] data = Arrays.copyOfRange(response, 10, 10 + dataLength);
        byte sw1 = data[data.length - 2];
        byte sw2 = data[data.length - 1];
        if (sw1 != (byte) 0x90 || sw2 != 0x00) {
            return null;
        }

        return Arrays.copyOfRange(data, 0, data.length - 2);
    }

    private byte[] buildXfrBlock(byte[] apdu, byte seq) {
        byte[] header = new byte[10];
        header[0] = PC_TO_RDR_XFR_BLOCK;
        header[1] = (byte) (apdu.length & 0xFF);
        header[2] = (byte) ((apdu.length >> 8) & 0xFF);
        header[3] = (byte) ((apdu.length >> 16) & 0xFF);
        header[4] = (byte) ((apdu.length >> 24) & 0xFF);
        header[5] = 0x00; // bSlot
        header[6] = seq;  // bSeq
        header[7] = 0x00; // bBWI
        header[8] = 0x00; // wLevelParameter low byte
        header[9] = 0x00; // wLevelParameter high byte

        byte[] out = new byte[header.length + apdu.length];
        System.arraycopy(header, 0, out, 0, header.length);
        System.arraycopy(apdu, 0, out, header.length, apdu.length);
        return out;
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
