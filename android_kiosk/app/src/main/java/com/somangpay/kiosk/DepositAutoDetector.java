package com.somangpay.kiosk;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

// 입금 문자/알림 자동감지의 실제 처리(필터 -> 정규식 파싱 -> 중복 확인 -> 백엔드 등록)를 웹뷰(JS)
// 없이 여기서 직접 끝낸다. 예전에는 SmsReceiver/BankNotificationListener가 원본 그대로
// window.onSmsReceived/onNotificationReceived로 웹뷰에 넘기기만 하고, 웹뷰가 없으면(프로세스
// 종료 상태) 그냥 대기열에 쌓아뒀다가 "다음에 관리자가 앱을 열 때"까지 처리를 미뤘다 - 앱이
// 완전히 꺼져 있는 동안은 입금이 실시간으로 반영되지 않는 문제가 있었다.
//
// 설정(발신번호/알림 패키지·제목 필터, 정규식)과 관리자 토큰은 admin.js가 저장/변경될 때마다
// AndroidInterface.saveAdminToken()/saveDetectSettings()를 통해 여기 SharedPreferences로도
// 같이 미러링된다 - 그래야 웹뷰가 없는 상태에서도 이 클래스가 최신 설정으로 동작할 수 있다.
// (기본값은 admin.js의 SMS_DETECT_*_DEFAULT와 동일하게 맞춰뒀다 - 처음 설치해서 아직 설정을
// 한 번도 저장 안 한 상태에서도 NH농협 포맷 기준으로 바로 동작하게 하기 위함.)
//
// 처리 순서(필터 -> 정규식 -> 값 검증 -> 중복 확인(peek) -> 등록 시도 -> 결과에 따라 중복 확인
// 커밋)는 "이 기기에 로그인이 안 돼 있다는 이유만으로 진짜 입금을 무시하지 말자"는 요청 반영.
// 기존엔 인증(토큰 존재 여부)을 정규식 파싱보다 먼저 확인해서, 토큰이 없으면 파싱조차 안 하고
// 그냥 버렸다 - 하지만 정규식(REGEX_DEFAULT)이 마스킹된 계좌번호(?<account>)까지 캡처해서
// 매칭됐다면 이미 "우리 계좌로 들어온 입금"이라는 게 메시지 내용만으로 확인된 것이라, 이
// 기기의 로그인 여부와는 무관하게 등록을 시도하는 게 맞다. 그래서 지금은 토큰이 비어있어도
// 일단 백엔드에 등록을 시도하고(비어있으면 "Bearer " 헤더도 안 붙임), 서버가 401(인증 없음/
// 만료)로 거절할 때만 중복 확인 키 커밋을 건너뛴다 - 그래야 나중에 이 기기든 다른 관리자
// 기기든 유효한 토큰이 생겼을 때 같은 입금을 다시 시도할 여지가 남는다(반대로 커밋해버리면
// 토큰이 생겨도 그 입금은 "이미 처리된 것"으로 영영 등록 못 하게 된다).
final class DepositAutoDetector {
    private static final String TAG = "SomangDepositDetect";

    private static final String PREFS_NAME = "somang_admin_detect_prefs";
    private static final String PREF_ADMIN_TOKEN = "admin_token";
    private static final String PREF_SMS_SENDER = "sms_sender_filter";
    private static final String PREF_PUSH_PACKAGE = "push_package_filter";
    private static final String PREF_PUSH_TITLE = "push_title_filter";
    private static final String PREF_REGEX = "detect_regex";
    private static final String PREF_SEEN_KEYS = "seen_detection_keys";
    private static final String PREF_LOG_QUEUE = "native_log_queue";

    private static final String SMS_SENDER_DEFAULT = "1588-2100";
    private static final String PUSH_PACKAGE_DEFAULT = "com.samsung.android.messaging";
    private static final String PUSH_TITLE_DEFAULT = "NH농협";
    // 잔액 뒤에 붙는 마스킹된 계좌번호(?<account>, 예: "355-**-123456-01")는 선택 그룹(?:...)? -
    // 은행/문자 포맷에 따라 없을 수도 있어서 없어도 기존처럼 그대로 매칭된다. 있으면 로그에
    // 남겨 "우리 계좌가 맞다"는 근거를 남긴다(아래 process()의 인증 우회 판단 근거).
    private static final String REGEX_DEFAULT =
            "입금\\s*(?<amount>[\\d,]+)원[\\s\\S]*?(?<date>\\d{2}/\\d{2})\\s+(?<time>\\d{2}:\\d{2})[\\s\\S]*?(?<name>[가-힣]{2,10})\\s*잔액(?<balance>[\\d,]+)원(?:[\\s\\S]*?(?<account>\\d[\\d*]{1,6}[-*][\\d*-]{3,}))?";

    private static final int MAX_SEEN_KEYS = 200;
    private static final int MAX_LOG_QUEUE = 50;

    private DepositAutoDetector() {
    }

    private static SharedPreferences prefs(Context context) {
        return context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    // KioskWebAppInterface.saveAdminToken()/saveDetectSettings()에서 호출 - admin.js가 로그인/설정
    // 저장할 때마다 최신 값을 여기로도 미러링한다.
    static void saveAdminToken(Context context, String token) {
        prefs(context).edit().putString(PREF_ADMIN_TOKEN, token).apply();
    }

    static void saveDetectSettings(Context context, String sender, String regex, String pushPackage, String pushTitle) {
        prefs(context).edit()
                .putString(PREF_SMS_SENDER, sender == null ? "" : sender)
                .putString(PREF_REGEX, regex == null ? "" : regex)
                .putString(PREF_PUSH_PACKAGE, pushPackage == null ? "" : pushPackage)
                .putString(PREF_PUSH_TITLE, pushTitle == null ? "" : pushTitle)
                .apply();
    }

    // SmsReceiver.onReceive()가 백그라운드 스레드에서 호출한다 - 네트워크 호출을 포함하므로
    // 메인 스레드에서 직접 부르면 안 된다.
    static void processSms(Context context, String sender, String body) {
        String filterSender = prefs(context).getString(PREF_SMS_SENDER, SMS_SENDER_DEFAULT).trim();
        if (!isBlank(filterSender) && (sender == null || !sender.contains(filterSender))) {
            return; // 감지 대상이 아니면 로그도 안 남기고 무시 (admin.js와 동일한 방침)
        }
        process(context, "SMS", sender, null, body);
    }

    // BankNotificationListener.onNotificationPosted()가 백그라운드 스레드에서 호출한다.
    static void processPush(Context context, String packageName, String title, String text) {
        SharedPreferences p = prefs(context);
        String filterPackage = p.getString(PREF_PUSH_PACKAGE, PUSH_PACKAGE_DEFAULT).trim();
        if (!isBlank(filterPackage) && !filterPackage.equals(packageName)) return;
        String filterTitle = p.getString(PREF_PUSH_TITLE, PUSH_TITLE_DEFAULT).trim();
        if (!isBlank(filterTitle) && !filterTitle.equals(title)) return;

        String body = isBlank(title) ? text : title + "\n" + text;
        process(context, "PUSH", packageName, packageName, body);
    }

    // originLabel: 로그에 남길 발신자 표시용(SMS면 전화번호, PUSH면 패키지명) - sender/packageName은
    // 소스에 따라 어느 한쪽만 실제 값이고 나머지는 null이라 로그 JSON 만들 때 이 값 하나로 처리한다.
    private static void process(Context context, String source, String originLabel, String packageName, String body) {
        SharedPreferences p = prefs(context);
        // 토큰이 비어있어도 여기서 바로 포기하지 않는다 - 정규식이 매칭되면(특히 계좌번호까지
        // 잡히면) 등록을 일단 시도한다. registerBankTransaction()이 blank 토큰을 그대로 들고
        // 시도해서 서버가 401을 주면 그때 인증 관련 로그를 남긴다.
        String token = p.getString(PREF_ADMIN_TOKEN, null);

        String regexStr = p.getString(PREF_REGEX, REGEX_DEFAULT).trim();
        if (isBlank(regexStr)) regexStr = REGEX_DEFAULT;

        Matcher m;
        try {
            m = Pattern.compile(regexStr).matcher(body);
        } catch (Exception e) {
            log(context, source, originLabel, packageName, body, "regex_error", "정규식 오류: " + e.getMessage());
            return;
        }
        if (!m.find()) {
            log(context, source, originLabel, packageName, body, "parse_fail", "정규식이 이름/금액 캡처 그룹과 일치하는 부분을 찾지 못함");
            return;
        }

        String name = safe(group(m, "name"));
        String amountRaw = safe(group(m, "amount"));
        if (name.isEmpty() || amountRaw.isEmpty()) {
            log(context, source, originLabel, packageName, body, "parse_fail", "정규식이 이름/금액 캡처 그룹과 일치하는 부분을 찾지 못함");
            return;
        }

        long amount;
        try {
            amount = Long.parseLong(amountRaw.replaceAll("[,\\s]", ""));
        } catch (NumberFormatException e) {
            amount = 0;
        }
        if (amount <= 0) {
            log(context, source, originLabel, packageName, body, "invalid_value",
                    "추출된 값이 올바르지 않음 (이름: \"" + name + "\", 금액: " + amount + ")");
            return;
        }

        String account = safe(group(m, "account"));
        String dedupKey = name + "|" + amountRaw.trim() + "|" + safe(group(m, "date")) + "|"
                + safe(group(m, "time")) + "|" + safe(group(m, "balance"));
        if (isDuplicate(context, dedupKey)) {
            log(context, source, originLabel, packageName, body, "duplicate",
                    name + " / " + amount + "원 - 이름·금액·날짜·시각·잔액이 동일한 내용이 이미 처리되어 건너뜀 (SMS/알림 중복 수신)");
            return;
        }

        registerBankTransaction(context, source, originLabel, packageName, body, name, amount, account, token, dedupKey);
    }

    private static String group(Matcher m, String name) {
        try {
            return m.group(name);
        } catch (IllegalArgumentException e) {
            return null; // 정규식에 이 이름의 캡처 그룹 자체가 없음 - admin.js와 동일하게 조용히 빈 값 취급
        }
    }

    // 커밋 없이 조회만 한다 - 실제 등록(registerBankTransaction) 결과가 인증 실패가 아닐 때만
    // commitSeen()으로 확정한다. 여기서 바로 커밋해버리면, 등록 시도가 인증 문제로 실패한
    // 입금이 "이미 처리된 것"으로 기록돼 나중에 토큰이 생겨도 다시 시도할 수 없게 된다.
    private static synchronized boolean isDuplicate(Context context, String key) {
        SharedPreferences p = prefs(context);
        try {
            JSONArray arr = new JSONArray(p.getString(PREF_SEEN_KEYS, "[]"));
            for (int i = 0; i < arr.length(); i++) {
                if (key.equals(arr.getString(i))) return true;
            }
            return false;
        } catch (JSONException e) {
            Log.e(TAG, "중복 감지 키 확인 실패", e);
            return false;
        }
    }

    private static synchronized void commitSeen(Context context, String key) {
        SharedPreferences p = prefs(context);
        try {
            JSONArray arr = new JSONArray(p.getString(PREF_SEEN_KEYS, "[]"));
            arr.put(key);
            while (arr.length() > MAX_SEEN_KEYS) arr.remove(0);
            p.edit().putString(PREF_SEEN_KEYS, arr.toString()).apply();
        } catch (JSONException e) {
            Log.e(TAG, "중복 감지 키 저장 실패", e);
        }
    }

    private static void registerBankTransaction(Context context, String source, String originLabel,
                                                 String packageName, String body, String name, long amount,
                                                 String account, String token, String dedupKey) {
        String apiBase = apiBaseUrl();
        if (apiBase == null) {
            log(context, source, originLabel, packageName, body, "network_error", "관리자 앱의 접속 주소를 확인할 수 없음");
            return; // 네트워크 설정 문제 - dedup 커밋 안 함(재시도 가능하게)
        }

        HttpURLConnection conn = null;
        try {
            URL url = new URL(apiBase + "/api/admin/bank-transactions");
            conn = (HttpURLConnection) url.openConnection();
            conn.setRequestMethod("POST");
            conn.setRequestProperty("Content-Type", "application/json");
            // 토큰이 비어있어도(로그인 전) 그냥 시도한다 - Authorization 헤더 자체를 생략하면
            // 서버가 명확한 401("관리자 인증이 필요합니다")을 준다.
            if (!isBlank(token)) {
                conn.setRequestProperty("Authorization", "Bearer " + token);
            }
            conn.setConnectTimeout(10000);
            conn.setReadTimeout(10000);
            conn.setDoOutput(true);

            JSONObject payload = new JSONObject();
            payload.put("external_txn_id", source + "_NATIVE_" + System.currentTimeMillis());
            payload.put("amount", amount);
            payload.put("depositor_name", name);

            try (OutputStream os = conn.getOutputStream()) {
                os.write(payload.toString().getBytes(StandardCharsets.UTF_8));
            }

            int code = conn.getResponseCode();
            if (code == 401) {
                String accountNote = isBlank(account) ? "" : " (계좌번호 " + account + " 확인됨 - 내용은 확실하지만 인증이 없어 등록 못 함)";
                log(context, source, originLabel, packageName, body, "auth_skip",
                        (isBlank(token)
                            ? "이 기기에 저장된 관리자 인증 토큰이 없어 등록하지 못함"
                            : "관리자 세션이 만료됨 - 앱을 열어 다시 로그인해 주세요")
                        + accountNote);
                return; // 인증 문제 - dedup 커밋 안 함(토큰이 생기면 같은 건을 다시 시도할 수 있게)
            }
            if (code < 200 || code >= 300) {
                log(context, source, originLabel, packageName, body, "register_fail",
                        "백엔드 등록 실패 (HTTP " + code + ")");
                commitSeen(context, dedupKey);
                return;
            }

            commitSeen(context, dedupKey);
            log(context, source, originLabel, packageName, body, "success",
                    name + " / " + amount + "원으로 등록 완료 (앱이 꺼져 있는 동안 자동 처리됨)"
                        + (isBlank(account) ? "" : " (계좌번호 " + account + " 확인됨)"));
        } catch (Exception e) {
            Log.e(TAG, "입금 등록 API 호출 실패", e);
            log(context, source, originLabel, packageName, body, "network_error", "네트워크 오류: " + e.getMessage());
            // 네트워크 예외 - dedup 커밋 안 함(재시도 가능하게)
        } finally {
            if (conn != null) conn.disconnect();
        }
    }

    // BuildConfig.TARGET_URL(예: "http://125.248.31.132:8080/admin")에서 호스트:포트만 뽑아
    // API 기본 주소("http://125.248.31.132:8080")를 만든다.
    private static String apiBaseUrl() {
        try {
            URL u = new URL(BuildConfig.TARGET_URL);
            String base = u.getProtocol() + "://" + u.getHost();
            if (u.getPort() != -1) base += ":" + u.getPort();
            return base;
        } catch (Exception e) {
            return null;
        }
    }

    // 처리 결과(성공/필터링/실패 등)를 웹뷰가 살아있으면 바로, 없으면 대기열에 남겨 다음에
    // 앱이 열릴 때 한꺼번에 화면의 "수신 로그"로 흘려보낸다 - MainActivity.deliverNativeLogToWebIfAlive
    // /drainNativeLogQueue 참고. 실제 백엔드 등록은 이미 여기서 끝난 뒤라, 웹 쪽(admin.js)은
    // 이 로그를 다시 처리(재등록)하지 않고 화면에 표시만 한다(중복 등록 방지).
    private static void log(Context context, String source, String originLabel, String packageName,
                             String body, String outcome, String detail) {
        JSONObject entry = new JSONObject();
        try {
            entry.put("source", source);
            if ("SMS".equals(source)) {
                entry.put("sender", originLabel == null ? "" : originLabel);
            } else {
                entry.put("packageName", packageName == null ? "" : packageName);
            }
            entry.put("body", body == null ? "" : body);
            entry.put("outcome", outcome);
            entry.put("detail", detail);
        } catch (JSONException e) {
            Log.e(TAG, "로그 엔트리 생성 실패", e);
            return;
        }

        if (!MainActivity.deliverNativeLogToWebIfAlive(entry.toString())) {
            enqueueLog(context, entry);
        }
    }

    private static synchronized void enqueueLog(Context context, JSONObject entry) {
        SharedPreferences p = prefs(context);
        try {
            JSONArray queue = new JSONArray(p.getString(PREF_LOG_QUEUE, "[]"));
            queue.put(entry);
            while (queue.length() > MAX_LOG_QUEUE) queue.remove(0);
            p.edit().putString(PREF_LOG_QUEUE, queue.toString()).apply();
        } catch (JSONException e) {
            Log.e(TAG, "로그 대기열 저장 실패", e);
        }
    }

    // 앱이 (다시) 열렸을 때 프로세스가 죽어있는 동안 처리된 로그를 전부 꺼내 웹으로 흘려보내고
    // 대기열을 비운다. MainActivity.onCreate에서 호출.
    static void drainLogQueue(Context context, LogDeliverer deliverer) {
        SharedPreferences p = prefs(context);
        String raw = p.getString(PREF_LOG_QUEUE, "[]");
        if ("[]".equals(raw)) return;
        try {
            JSONArray queue = new JSONArray(raw);
            for (int i = 0; i < queue.length(); i++) {
                deliverer.deliver(queue.getJSONObject(i).toString());
            }
        } catch (JSONException e) {
            Log.e(TAG, "로그 대기열 복원 실패", e);
        } finally {
            p.edit().remove(PREF_LOG_QUEUE).apply();
        }
    }

    private static boolean isBlank(String s) {
        return s == null || s.trim().isEmpty();
    }

    private static String safe(String s) {
        return s == null ? "" : s.trim();
    }

    interface LogDeliverer {
        void deliver(String entryJson);
    }
}
