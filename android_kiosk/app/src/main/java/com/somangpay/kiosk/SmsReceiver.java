package com.somangpay.kiosk;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;

// 입금 문자 자동감지(관리자 앱 전용, BuildConfig.SMS_DETECT_ENABLED로 게이팅). AndroidManifest.xml에
// 정적으로 등록되어 있다 - SMS_RECEIVED는 안드로이드 8+ 백그라운드 브로드캐스트 제한에서 예외로
// 취급되는 몇 안 되는 액션 중 하나라, 이렇게 등록해두면 앱이 백그라운드에 있거나 프로세스가 완전히
// 종료된 상태에서도 시스템이 이 리시버를 깨워 문자를 전달해준다(반대로 onResume/onPause에 걸어
// 동적으로 등록/해제하면 앱이 포그라운드일 때 온 문자만 잡힌다 - 실사용에서 문자 앱으로 잠깐
// 전환했다가 온 입금 문자를 놓치는 문제가 확인되어 이 방식으로 바꿨다).
//
// 파싱/등록은 DepositAutoDetector가 직접 끝낸다(웹뷰가 떠 있는지와 무관하게) - 예전에는 원본
// 그대로 window.onSmsReceived(sender, body)로 웹에 넘기고 웹뷰가 없으면 대기열에 쌓아 "다음에
// 앱을 열 때"까지 미뤘는데, 그러면 앱이 완전히 꺼져 있는 동안은 입금이 실시간 반영되지 않았다.
// 네트워크 호출이 있어 메인 스레드에서 바로 처리할 수 없으므로 goAsync()로 시스템에 "아직 안
// 끝났다"고 알려두고 백그라운드 스레드에서 처리한 뒤 finish()한다.
public class SmsReceiver extends BroadcastReceiver {

    private static final String TAG = "SomangKioskSms";

    // 매니페스트가 리플렉션으로 인스턴스화할 때 필요한 public 기본 생성자
    public SmsReceiver() {
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        // onReceive 자체가 호출되는지부터 무조건 로그로 남긴다 - 이후 조건문에서 조용히 return하면
        // "리시버가 아예 안 불렸다"와 "불렸는데 조건에 막혔다"를 로그만 보고는 구분할 수 없어서,
        // 실기기에서 문자가 감지 안 될 때 원인 파악이 안 되는 문제가 있었다.
        Log.d(TAG, "onReceive called, action=" + intent.getAction() + ", SMS_DETECT_ENABLED=" + BuildConfig.SMS_DETECT_ENABLED);

        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;
        if (!BuildConfig.SMS_DETECT_ENABLED) return; // 매니페스트는 세 플레이버가 공유 - 관리자 앱이 아니면 무시

        SmsMessage[] messages = Telephony.Sms.Intents.getMessagesFromIntent(intent);
        if (messages == null || messages.length == 0) {
            Log.w(TAG, "getMessagesFromIntent()가 빈 배열/null을 반환함 - intent extras: " + intent.getExtras());
            return;
        }

        // 장문 문자는 여러 PDU 조각으로 나뉘어 도착하므로 본문을 이어붙인다.
        final String sender = messages[0].getOriginatingAddress();
        StringBuilder bodyBuilder = new StringBuilder();
        for (SmsMessage msg : messages) {
            if (msg.getMessageBody() != null) bodyBuilder.append(msg.getMessageBody());
        }
        final String body = bodyBuilder.toString();

        Log.d(TAG, "SMS received from " + sender + ", body=" + body);

        final Context appContext = context.getApplicationContext();
        final PendingResult pendingResult = goAsync();
        new Thread(() -> {
            try {
                DepositAutoDetector.processSms(appContext, sender, body);
            } catch (Exception e) {
                Log.e(TAG, "입금 자동감지 처리 실패", e);
            } finally {
                pendingResult.finish();
            }
        }).start();
    }
}
