package com.somangpay.kiosk;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

// 입금 문자 자동감지(관리자 앱 전용, BuildConfig.SMS_DETECT_ENABLED로 게이팅)의 두 번째 경로.
// SmsReceiver는 android.provider.Telephony.SMS_RECEIVED_ACTION만 잡는데, 은행 알림이 RCS(리치
// 문자)나 은행 앱 자체 푸시로 오면 이 브로드캐스트가 아예 발생하지 않아 SmsReceiver가 못 잡는다.
// NotificationListenerService는 발신 경로(SMS/RCS/푸시)와 무관하게 기기에 뜨는 모든 알림을
// 가로챌 수 있어 이 빈틈을 메운다 - 단, SmsReceiver와 달리 "알림 접근" 권한은 런타임 팝업이
// 아니라 사용자가 설정 화면에서 직접 켜야 한다(MainActivity.openNotificationAccessSettings 참고).
//
// 파싱/등록/중복 확인은 DepositAutoDetector가 웹뷰 생존 여부와 무관하게 직접 끝낸다(SmsReceiver와
// 동일한 이유 - 앱이 완전히 꺼져 있어도 실시간으로 처리되어야 하므로). 패키지명/제목 필터도
// DepositAutoDetector 안에서 확인한다(admin.js와 동일한 필터).
public class BankNotificationListener extends NotificationListenerService {

    private static final String TAG = "SomangBankNotifListener";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (!BuildConfig.SMS_DETECT_ENABLED) return; // 매니페스트는 세 플레이버가 공유 - 관리자 앱이 아니면 무시
        if (sbn == null) return;

        String packageName = sbn.getPackageName();
        if (getPackageName().equals(packageName)) return; // 우리 앱 자체 알림(업데이트 등)은 제외

        Notification notification = sbn.getNotification();
        if (notification == null || notification.extras == null) {
            // 여기서도 조용히 버리지 않고 로그를 남긴다 - "알림은 왔는데 extras가 아예 없더라"도
            // 진단에 필요한 정보다.
            Log.w(TAG, "알림 감지했지만 extras 없음: pkg=" + packageName);
            final android.content.Context ctxNoExtras = getApplicationContext();
            new Thread(() -> {
                try {
                    DepositAutoDetector.processPush(ctxNoExtras, packageName, "", "");
                } catch (Exception e) {
                    Log.e(TAG, "입금 자동감지 처리 실패", e);
                }
            }).start();
            return;
        }

        Bundle extras = notification.extras;
        CharSequence title = extras.getCharSequence(Notification.EXTRA_TITLE);
        // 은행 알림 본문이 들어올 수 있는 필드가 스타일에 따라 다르다 - 확장(BigText) 알림은
        // EXTRA_BIG_TEXT, 목록형(InboxStyle, 여러 줄을 한 줄씩 따로 쌓는 스타일) 알림은
        // EXTRA_TEXT_LINES(줄 배열)에 실제 내용이 있고 EXTRA_TEXT/EXTRA_BIG_TEXT는 비어있거나
        // "새 메시지 3개"처럼 요약문만 있을 수 있다 - EXTRA_TEXT_LINES를 놓치면 "알림은 오는데
        // 내용이 안 잡힌다"는 문제가 생긴다. 우선순위: BigText > TextLines(줄바꿈으로 합침) > Text.
        CharSequence bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        CharSequence[] textLines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES);
        CharSequence text = extras.getCharSequence(Notification.EXTRA_TEXT);

        String bodyStr;
        if (bigText != null && bigText.length() > 0) {
            bodyStr = bigText.toString();
        } else if (textLines != null && textLines.length > 0) {
            StringBuilder sb = new StringBuilder();
            for (CharSequence line : textLines) {
                if (sb.length() > 0) sb.append("\n");
                sb.append(line == null ? "" : line.toString());
            }
            bodyStr = sb.toString();
        } else {
            bodyStr = text == null ? "" : text.toString();
        }

        final String titleStr = title == null ? "" : title.toString();
        final String pkg = packageName;

        // "민감한 내용이라 저장 안 함" 같은 예외 없이 - 본문이 비어있어도(추출 필드가 전부
        // null이었어도) 그대로 넘긴다. 필터/파싱 단계에서 자연스럽게 "filtered"나 "parse_fail"로
        // 로그에 남으므로, 여기서 미리 걸러내지 않는 게 "알림이 왔었다"는 사실 자체를 보존한다.
        Log.d(TAG, "알림 감지: pkg=" + pkg + ", title=" + titleStr + ", bodyLen=" + bodyStr.length());

        // 네트워크 호출이 있어 메인 스레드에서 바로 처리할 수 없다.
        final android.content.Context appContext = getApplicationContext();
        final String bodyForThread = bodyStr;
        new Thread(() -> {
            try {
                DepositAutoDetector.processPush(appContext, pkg, titleStr, bodyForThread);
            } catch (Exception e) {
                Log.e(TAG, "입금 자동감지 처리 실패", e);
            }
        }).start();
    }
}
