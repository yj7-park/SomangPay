package com.somangpay.kiosk;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// 입금 문자 자동감지(관리자 앱 전용, BuildConfig.SMS_DETECT_ENABLED로 게이팅). AndroidManifest.xml에
// 정적으로 등록되어 있다 - SMS_RECEIVED는 안드로이드 8+ 백그라운드 브로드캐스트 제한에서 예외로
// 취급되는 몇 안 되는 액션 중 하나라, 이렇게 등록해두면 앱이 백그라운드에 있거나 프로세스가 완전히
// 종료된 상태에서도 시스템이 이 리시버를 깨워 문자를 전달해준다(반대로 onResume/onPause에 걸어
// 동적으로 등록/해제하면 앱이 포그라운드일 때 온 문자만 잡힌다 - 실사용에서 문자 앱으로 잠깐
// 전환했다가 온 입금 문자를 놓치는 문제가 확인되어 이 방식으로 바꿨다).
//
// 파싱 로직(발신번호 필터, 정규식)은 여기 두지 않고 원본 그대로 window.onSmsReceived(sender, body)
// 로 웹에 넘긴다 - UpdateManager/NFC와 동일한 브릿지 패턴으로, 은행이 문자 포맷을 바꾸거나 파싱
// 규칙을 조정할 때마다 앱을 다시 빌드/배포하지 않아도 되게 하기 위함이다.
public class SmsReceiver extends BroadcastReceiver {

    private static final String TAG = "SomangKioskSms";
    private static final String PREFS_NAME = "sms_receiver_prefs";
    private static final String PREF_PENDING_QUEUE = "pending_sms_queue";
    private static final int MAX_QUEUE_SIZE = 20; // 무한정 쌓이는 것 방지

    // 매니페스트가 리플렉션으로 인스턴스화할 때 필요한 public 기본 생성자
    public SmsReceiver() {
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        if (!BuildConfig.SMS_DETECT_ENABLED) return; // 매니페스트는 세 플레이버가 공유 - 관리자 앱이 아니면 무시

        SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (messages == null || messages.length == 0) return;

        // 장문 문자는 여러 PDU 조각으로 나뉘어 도착하므로 본문을 이어붙인다.
        String sender = messages[0].getOriginatingAddress();
        StringBuilder bodyBuilder = new StringBuilder();
        for (SmsMessage msg : messages) {
            if (msg.getMessageBody() != null) bodyBuilder.append(msg.getMessageBody());
        }
        String body = bodyBuilder.toString();

        Log.d(TAG, "SMS received from " + sender);

        if (!MainActivity.deliverSmsToWebIfAlive(sender, body)) {
            // 지금 웹뷰가 없다(프로세스가 완전히 종료된 상태) - 다음에 앱이 열릴 때 처리하도록 남겨둔다.
            enqueuePendingSms(context, sender, body);
        }
    }

    private static void enqueuePendingSms(Context context, String sender, String body) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        try {
            JSONArray queue = new JSONArray(prefs.getString(PREF_PENDING_QUEUE, "[]"));
            JSONObject entry = new JSONObject();
            entry.put("sender", sender == null ? "" : sender);
            entry.put("body", body);
            queue.put(entry);
            while (queue.length() > MAX_QUEUE_SIZE) {
                queue.remove(0);
            }
            prefs.edit().putString(PREF_PENDING_QUEUE, queue.toString()).apply();
        } catch (JSONException e) {
            Log.e(TAG, "SMS 대기열 저장 실패", e);
        }
    }

    // 앱이 (다시) 열렸을 때 프로세스가 죽어있는 동안 쌓인 문자를 전부 꺼내 웹으로 흘려보내고 큐를 비운다.
    static void drainPendingSmsQueue(Context context, PendingSmsDeliverer deliverer) {
        SharedPreferences prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        String raw = prefs.getString(PREF_PENDING_QUEUE, "[]");
        if ("[]".equals(raw)) return;
        try {
            JSONArray queue = new JSONArray(raw);
            for (int i = 0; i < queue.length(); i++) {
                JSONObject entry = queue.getJSONObject(i);
                deliverer.deliver(entry.getString("sender"), entry.getString("body"));
            }
        } catch (JSONException e) {
            Log.e(TAG, "SMS 대기열 복원 실패", e);
        } finally {
            prefs.edit().remove(PREF_PENDING_QUEUE).apply();
        }
    }

    interface PendingSmsDeliverer {
        void deliver(String sender, String body);
    }
}
