package com.somangpay.kiosk;

import android.app.Notification;
import android.content.SharedPreferences;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// 입금 문자 자동감지(관리자 앱 전용, BuildConfig.SMS_DETECT_ENABLED로 게이팅)의 두 번째 경로.
// SmsReceiver는 android.provider.Telephony.SMS_RECEIVED_ACTION만 잡는데, 은행 알림이 RCS(리치
// 문자)나 은행 앱 자체 푸시로 오면 이 브로드캐스트가 아예 발생하지 않아 SmsReceiver가 못 잡는다.
// NotificationListenerService는 발신 경로(SMS/RCS/푸시)와 무관하게 기기에 뜨는 모든 알림을
// 가로챌 수 있어 이 빈틈을 메운다 - 단, SmsReceiver와 달리 "알림 접근" 권한은 런타임 팝업이
// 아니라 사용자가 설정 화면에서 직접 켜야 한다(MainActivity.openNotificationAccessSettings 참고).
//
// 같은 실제 입금이 SmsReceiver와 이 서비스 양쪽으로 동시에 들어올 수 있으므로(진짜 SMS는 알림창
// 에도 함께 뜬다), 중복 등록 방지는 여기서 하지 않고 웹(admin.js의 dedup 로직)에서 발신자명+금액
// 기준으로 처리한다 - 파싱 규칙과 마찬가지로 서버/네이티브 재배포 없이 조정 가능해야 하기 때문.
//
// 파싱 로직은 여기 두지 않고 원본 그대로 window.onNotificationReceived(packageName, title, text)로
// 웹에 넘긴다 - SmsReceiver/UpdateManager와 동일한 브릿지 패턴.
public class BankNotificationListener extends NotificationListenerService {

    private static final String TAG = "SomangBankNotifListener";
    private static final String PREFS_NAME = "notification_listener_prefs";
    private static final String PREF_PENDING_QUEUE = "pending_notification_queue";
    private static final int MAX_QUEUE_SIZE = 20; // 무한정 쌓이는 것 방지

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

        String titleStr = title == null ? "" : title.toString();
        String textStr = text.toString();

        Log.d(TAG, "알림 감지: pkg=" + packageName + ", title=" + titleStr);

        if (!MainActivity.deliverNotificationToWebIfAlive(packageName, titleStr, textStr)) {
            Log.d(TAG, "웹뷰가 아직 없어(프로세스 종료 등) 대기열에 저장함");
            enqueuePendingNotification(packageName, titleStr, textStr);
        }
    }

    private void enqueuePendingNotification(String packageName, String title, String text) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        try {
            JSONArray queue = new JSONArray(prefs.getString(PREF_PENDING_QUEUE, "[]"));
            JSONObject entry = new JSONObject();
            entry.put("packageName", packageName);
            entry.put("title", title);
            entry.put("text", text);
            queue.put(entry);
            while (queue.length() > MAX_QUEUE_SIZE) {
                queue.remove(0);
            }
            prefs.edit().putString(PREF_PENDING_QUEUE, queue.toString()).apply();
        } catch (JSONException e) {
            Log.e(TAG, "알림 대기열 저장 실패", e);
        }
    }

    // 앱이 (다시) 열렸을 때 프로세스가 죽어있는 동안 쌓인 알림을 전부 꺼내 웹으로 흘려보내고 큐를 비운다.
    static void drainPendingNotificationQueue(android.content.Context context, PendingNotificationDeliverer deliverer) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, android.content.Context.MODE_PRIVATE);
        String raw = prefs.getString(PREF_PENDING_QUEUE, "[]");
        if ("[]".equals(raw)) return;
        try {
            JSONArray queue = new JSONArray(raw);
            for (int i = 0; i < queue.length(); i++) {
                JSONObject entry = queue.getJSONObject(i);
                deliverer.deliver(entry.getString("packageName"), entry.getString("title"), entry.getString("text"));
            }
        } catch (JSONException e) {
            Log.e(TAG, "알림 대기열 복원 실패", e);
        } finally {
            prefs.edit().remove(PREF_PENDING_QUEUE).apply();
        }
    }

    interface PendingNotificationDeliverer {
        void deliver(String packageName, String title, String text);
    }
}
