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
        if (notification == null || notification.extras == null) return;

        Bundle extras = notification.extras;
        CharSequence title = extras.getCharSequence(Notification.EXTRA_TITLE);
        // 확장(BigText) 알림은 원문이 EXTRA_BIG_TEXT에, 접힌 알림은 EXTRA_TEXT에 들어있다 -
        // 은행 알림은 여러 줄이라 BigText 쪽에 전체 내용이 있는 경우가 많아 우선 사용한다.
        CharSequence bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
        CharSequence text = bigText != null ? bigText : extras.getCharSequence(Notification.EXTRA_TEXT);
        if (text == null || text.length() == 0) return;

        final String titleStr = title == null ? "" : title.toString();
        final String textStr = text.toString();
        final String pkg = packageName;

        Log.d(TAG, "알림 감지: pkg=" + pkg + ", title=" + titleStr);

        // 네트워크 호출이 있어 메인 스레드에서 바로 처리할 수 없다.
        final android.content.Context appContext = getApplicationContext();
        new Thread(() -> {
            try {
                DepositAutoDetector.processPush(appContext, pkg, titleStr, textStr);
            } catch (Exception e) {
                Log.e(TAG, "입금 자동감지 처리 실패", e);
            }
        }).start();
    }
}
