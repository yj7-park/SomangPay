package com.somangpay.kiosk.reader;

import android.hardware.usb.UsbDeviceConnection;
import android.hardware.usb.UsbEndpoint;
import android.hardware.usb.UsbInterface;
import android.util.Log;

import java.util.Arrays;

// NFC-X 리더(VID 0x0483 / PID 0x4343)의 벤더 전용 HID 리포트 프로토콜로 카드 UID를 폴링한다.
// 표준 HID boot 키보드/CCID가 아니라 커스텀 리포트 포맷이라, OS의 HID 입력 경로를 타지 않고
// 인터럽트 엔드포인트(EP OUT 0x02 / EP IN 0x82)에 직접 64바이트 리포트를 주고받는다.
// 실기기에서 nfctool.exe 실행 중 캡처한 USB 트래픽(Wireshark+USBPcap)으로 프로토콜을 확인함:
//   요청: 55 00 69 00 00 ff 00...00 (64바이트, 커맨드 0x0069 = 카드 폴링)
//   응답(카드 있음): 55 00 69 00 <len> 01 <type> <UID 4~7바이트> <고정 트레일러 13바이트> <checksum 2바이트>
// "카드 없음" 응답은 실캡처로 확인하지 못해 found 플래그(offset 5) != 1을 근거로 best-effort 처리.
public class VendorHidUidReader implements Runnable {

    public interface Callback {
        void onUidRead(String hexUid);
        void onSessionFailed();
    }

    private static final String TAG = "VendorHidUidReader";

    private static final int REPORT_SIZE = 64;
    private static final int CMD_POLL_CARD = 0x0069;

    // 캡처 관찰상 카드 스캔 사이클이 최대 ~700ms 걸렸음. 여유를 두어 타임아웃 설정.
    private static final int TRANSFER_TIMEOUT_MS = 1500;
    private static final int LOOP_DELAY_MS = 200;

    private final UsbDeviceConnection connection;
    private final UsbInterface usbInterface;
    private final UsbEndpoint endpointIn;
    private final UsbEndpoint endpointOut;
    private final Callback callback;

    private volatile boolean running = true;
    private String lastUid = null;
    // 이 기기(태블릿)의 USB 호스트 드라이버가 UsbDeviceConnection.bulkTransfer()의 timeout
    // 인자를 지키지 않고 usb_start_wait_urb에서 무한정 블록되는 경우가 관찰됨(커널/드라이버
    // 이슈, 알려진 Android bulkTransfer 타임아웃 미준수 버그와 동일 증상). 자바 레벨
    // 타임아웃만으로는 복구가 안 되므로, 마지막으로 폴링 사이클이 "완료"된 시각을 기록해
    // CardReaderManager의 워치독이 멈춤을 감지하고 연결을 강제로 닫아 재시작할 수 있게 한다.
    private volatile long lastActivityAt = System.currentTimeMillis();

    public long millisSinceLastActivity() {
        return System.currentTimeMillis() - lastActivityAt;
    }

    public VendorHidUidReader(UsbDeviceConnection connection, UsbInterface usbInterface,
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
        Log.d(TAG, "Vendor HID polling thread started");
        while (running) {
            try {
                byte[] uidBytes = pollForUid();
                lastActivityAt = System.currentTimeMillis();
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
                Log.e(TAG, "Vendor HID transfer failed, ending session: " + e.getMessage());
                running = false;
                callback.onSessionFailed();
                return;
            }

            try {
                Thread.sleep(LOOP_DELAY_MS);
            } catch (InterruptedException ignored) {
                running = false;
            }
        }
        Log.d(TAG, "Vendor HID polling thread stopped");
    }

    // 0x0069(카드 폴링) 리포트를 보내고 응답을 파싱한다. 카드가 없거나 응답이
    // 비정상이면 null을 반환한다(에러가 아닌 "카드 없음" 상태로 취급).
    private byte[] pollForUid() {
        byte[] command = buildReport(CMD_POLL_CARD, new byte[]{0x00, (byte) 0xFF});

        // Android UsbDeviceConnection.bulkTransfer()는 인터럽트 엔드포인트에도 그대로 쓸 수 있다.
        int sent = connection.bulkTransfer(endpointOut, command, command.length, TRANSFER_TIMEOUT_MS);
        if (sent < 0) {
            throw new RuntimeException("interrupt OUT transfer failed");
        }

        byte[] response = new byte[REPORT_SIZE];
        int received = connection.bulkTransfer(endpointIn, response, response.length, TRANSFER_TIMEOUT_MS);
        if (received < 8) {
            return null;
        }

        if ((response[0] & 0xFF) != 0x55 || response[1] != 0x00) {
            return null;
        }
        int echoedCommand = (response[2] & 0xFF) | ((response[3] & 0xFF) << 8);
        if (echoedCommand != CMD_POLL_CARD) {
            return null;
        }

        int dataLength = response[4] & 0xFF;
        int found = response[5] & 0xFF;
        if (found != 1) {
            return null; // 카드 없음
        }

        // dataLength = found(1) + cardType(1) + UID길이 + 고정 트레일러(13)
        int uidLen = dataLength - 15;
        if (uidLen <= 0 || 7 + uidLen > received) {
            return null;
        }

        return Arrays.copyOfRange(response, 7, 7 + uidLen);
    }

    private byte[] buildReport(int command, byte[] extra) {
        byte[] report = new byte[REPORT_SIZE];
        report[0] = 0x55;
        report[1] = 0x00;
        report[2] = (byte) (command & 0xFF);
        report[3] = (byte) ((command >> 8) & 0xFF);
        if (extra != null) {
            System.arraycopy(extra, 0, report, 4, Math.min(extra.length, report.length - 4));
        }
        return report;
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
