package com.somangpay.kiosk;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.Handler;
import android.provider.Telephony;
import android.telephony.SmsMessage;
import android.util.Log;
import android.webkit.WebView;
import org.json.JSONObject;

// 입금 문자 자동감지(관리자 앱 전용, BuildConfig.SMS_DETECT_ENABLED로 게이팅 - MainActivity 참고).
// 은행 알림 문자를 파싱하는 로직(발신번호 필터, 정규식)은 일부러 여기 두지 않고 원본 그대로
// window.onSmsReceived(sender, body)로 웹에 넘긴다 - UpdateManager/NFC와 동일한 브릿지 패턴으로,
// 은행이 문자 포맷을 바꾸거나 파싱 규칙을 조정할 때마다 앱을 다시 빌드/배포하지 않아도 되게 하기 위함이다.
class SmsReceiver extends BroadcastReceiver {

    private static final String TAG = "SomangKioskSms";

    private final WebView webView;
    private final Handler mainHandler;
    private boolean registered = false;

    SmsReceiver(WebView webView, Handler mainHandler) {
        this.webView = webView;
        this.mainHandler = mainHandler;
    }

    void register(Context context) {
        if (registered) return;
        context.registerReceiver(this, new IntentFilter(Telephony.Sms.Intents.SMS_RECEIVED_ACTION));
        registered = true;
    }

    void unregister(Context context) {
        if (!registered) return;
        try {
            context.unregisterReceiver(this);
        } catch (IllegalArgumentException e) {
            // 이미 해제되어 있었던 경우 - 무시
        }
        registered = false;
    }

    @Override
    public void onReceive(Context context, Intent intent) {
        if (!Telephony.Sms.Intents.SMS_RECEIVED_ACTION.equals(intent.getAction())) return;

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

        if (webView == null || mainHandler == null) return;
        mainHandler.post(() -> webView.evaluateJavascript(
                "window.onSmsReceived && window.onSmsReceived("
                        + JSONObject.quote(sender == null ? "" : sender) + ","
                        + JSONObject.quote(body) + ");",
                null));
    }
}
