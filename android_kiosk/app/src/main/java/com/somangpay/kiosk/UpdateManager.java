package com.somangpay.kiosk;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.provider.Settings;
import android.util.Log;
import android.webkit.WebView;
import androidx.core.content.FileProvider;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.security.SecureRandom;
import java.security.cert.X509Certificate;
import javax.net.ssl.HttpsURLConnection;
import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import org.json.JSONException;
import org.json.JSONObject;

// 스토어를 거치지 않는 사이드로드 배포(APK 직접 다운로드/설치)이므로 앱이 스스로 최신 버전을
// 감지하고 내려받아 설치 화면까지 띄워줘야 한다. 서버의 version.json에서 플레이버별 최신
// versionCode/apkUrl을 읽어 BuildConfig.VERSION_CODE와 비교하고, 다운로드/설치는 JS(웹 UI)의
// 요청에 따라 수행한다 - 진행 상태는 window.onUpdateXxx 콜백으로 웹 쪽에 알려준다
// (MainActivity.run()이 NFC 스캔 결과를 window.onAndroidNfcScanned로 넘기는 것과 동일한 패턴).
class UpdateManager {

    private static final String TAG = "SomangKioskUpdate";
    private static final String PREFS_NAME = "update_prefs";
    private static final String PREF_AUTO_UPDATE = "auto_update_enabled";
    private static final String DOWNLOAD_FILE_NAME = "update.apk";

    private final Activity activity;
    private final WebView webView;
    private final Handler mainHandler;
    private final SharedPreferences prefs;

    private volatile boolean checkInProgress = false;
    private volatile boolean downloadInProgress = false;
    private volatile String pendingUpdateApkUrl = null;

    UpdateManager(Activity activity, WebView webView, Handler mainHandler) {
        this.activity = activity;
        this.webView = webView;
        this.mainHandler = mainHandler;
        this.prefs = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    boolean isAutoUpdateEnabled() {
        return prefs.getBoolean(PREF_AUTO_UPDATE, false);
    }

    void setAutoUpdateEnabled(boolean enabled) {
        prefs.edit().putBoolean(PREF_AUTO_UPDATE, enabled).apply();
    }

    String getAppVersionInfoJson() {
        JSONObject o = new JSONObject();
        try {
            o.put("versionName", BuildConfig.VERSION_NAME);
            o.put("versionCode", BuildConfig.VERSION_CODE);
            o.put("flavor", BuildConfig.FLAVOR);
            o.put("autoUpdateEnabled", isAutoUpdateEnabled());
        } catch (JSONException ignored) {
        }
        return o.toString();
    }

    // manual=true면 사용자가 설정 화면에서 직접 "지금 확인"을 눌러 온 것 - 결과가 "업데이트 없음"이거나
    // 네트워크 실패여도 onUpdateError/onUpdateCheckResult로 조용히 알려준다. manual=false(앱 실행 시
    // 자동 체크)에서는 실패해도 사용자에게 에러를 띄우지 않고 로그만 남긴다.
    void checkForUpdate(final boolean manual) {
        if (checkInProgress) return;
        checkInProgress = true;

        new Thread(() -> {
            try {
                URL manifestUrl = buildVersionManifestUrl();
                String body = httpGetString(manifestUrl);
                JSONObject root = new JSONObject(body);
                JSONObject flavorInfo = root.optJSONObject(BuildConfig.FLAVOR);
                if (flavorInfo == null) {
                    throw new IOException("version.json에 " + BuildConfig.FLAVOR + " 항목이 없습니다");
                }

                int remoteVersionCode = flavorInfo.getInt("versionCode");
                String remoteVersionName = flavorInfo.optString("versionName", "");
                String apkUrlRaw = flavorInfo.getString("apkUrl");
                URL resolvedApkUrl = new URL(manifestUrl, apkUrlRaw);
                boolean available = remoteVersionCode > BuildConfig.VERSION_CODE;
                if (available) {
                    pendingUpdateApkUrl = resolvedApkUrl.toString();
                } else {
                    pendingUpdateApkUrl = null;
                }

                JSONObject result = new JSONObject();
                result.put("available", available);
                result.put("currentVersionCode", BuildConfig.VERSION_CODE);
                result.put("latestVersionCode", remoteVersionCode);
                result.put("latestVersionName", remoteVersionName);
                result.put("manual", manual);

                mainHandler.post(() -> {
                    checkInProgress = false;
                    evaluateJs("window.onUpdateCheckResult && window.onUpdateCheckResult(" + result + ");");
                    if (available) {
                        evaluateJs("window.onUpdateAvailable && window.onUpdateAvailable(" + result + ");");
                        if (isAutoUpdateEnabled()) {
                            startUpdateDownload();
                        }
                    }
                });
            } catch (Exception e) {
                Log.w(TAG, "checkForUpdate failed: " + e.getMessage());
                mainHandler.post(() -> {
                    checkInProgress = false;
                    if (manual) {
                        evaluateJs("window.onUpdateError && window.onUpdateError(" +
                                JSONObject.quote("업데이트 확인에 실패했습니다: " + e.getMessage()) + ");");
                    }
                });
            }
        }).start();
    }

    void startUpdateDownload() {
        if (downloadInProgress) return;
        if (pendingUpdateApkUrl == null) {
            evaluateJs("window.onUpdateError && window.onUpdateError(" +
                    JSONObject.quote("먼저 업데이트를 확인해주세요.") + ");");
            return;
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
                && !activity.getPackageManager().canRequestPackageInstalls()) {
            evaluateJs("window.onUpdateError && window.onUpdateError(" +
                    JSONObject.quote("설치 권한이 필요합니다. 권한 화면에서 허용 후 다시 시도해주세요.") + ");");
            try {
                Intent intent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
                        Uri.parse("package:" + activity.getPackageName()));
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                activity.startActivity(intent);
            } catch (Exception e) {
                Log.w(TAG, "설치 권한 설정 화면을 열 수 없음: " + e.getMessage());
            }
            return;
        }

        downloadInProgress = true;
        final String apkUrlString = pendingUpdateApkUrl;

        new Thread(() -> {
            File outFile = new File(activity.getExternalFilesDir(null), DOWNLOAD_FILE_NAME);
            try {
                downloadToFile(new URL(apkUrlString), outFile);
                mainHandler.post(() -> {
                    downloadInProgress = false;
                    evaluateJs("window.onUpdateDownloadProgress && window.onUpdateDownloadProgress(100);");
                    evaluateJs("window.onUpdateDownloadComplete && window.onUpdateDownloadComplete();");
                    launchInstall(outFile);
                });
            } catch (Exception e) {
                Log.w(TAG, "APK 다운로드 실패: " + e.getMessage());
                mainHandler.post(() -> {
                    downloadInProgress = false;
                    evaluateJs("window.onUpdateError && window.onUpdateError(" +
                            JSONObject.quote("업데이트 파일 다운로드에 실패했습니다: " + e.getMessage()) + ");");
                });
            }
        }).start();
    }

    private void launchInstall(File apkFile) {
        if (!apkFile.exists()) {
            evaluateJs("window.onUpdateError && window.onUpdateError(" +
                    JSONObject.quote("다운로드된 설치 파일을 찾을 수 없습니다.") + ");");
            return;
        }
        try {
            Uri apkUri = FileProvider.getUriForFile(activity,
                    activity.getPackageName() + ".fileprovider", apkFile);
            Intent installIntent = new Intent(Intent.ACTION_VIEW);
            installIntent.setDataAndType(apkUri, "application/vnd.android.package-archive");
            installIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            activity.startActivity(installIntent);
        } catch (Exception e) {
            Log.w(TAG, "설치 화면을 열 수 없음: " + e.getMessage());
            evaluateJs("window.onUpdateError && window.onUpdateError(" +
                    JSONObject.quote("설치 화면을 열 수 없습니다: " + e.getMessage()) + ");");
        }
    }

    private void evaluateJs(String js) {
        if (webView != null) {
            webView.evaluateJavascript(js, null);
        }
    }

    // TARGET_URL(예: https://host/kiosk, http://host/admin)에서 스킴+호스트만 뽑아
    // 세 플레이버가 공통으로 참조하는 /version.json 위치를 만든다.
    private URL buildVersionManifestUrl() throws IOException {
        URL target = new URL(AppConfig.TARGET_URL);
        return new URL(target.getProtocol() + "://" + target.getAuthority() + "/version.json");
    }

    private String httpGetString(URL url) throws IOException {
        HttpURLConnection connection = openConnection(url);
        connection.setConnectTimeout(8_000);
        connection.setReadTimeout(8_000);
        connection.setRequestProperty("ngrok-skip-browser-warning", "true");
        try {
            int status = connection.getResponseCode();
            if (status >= 400) {
                throw new IOException("HTTP " + status);
            }
            java.io.ByteArrayOutputStream buffer = new java.io.ByteArrayOutputStream();
            try (InputStream in = connection.getInputStream()) {
                byte[] chunk = new byte[4096];
                int n;
                while ((n = in.read(chunk)) != -1) {
                    buffer.write(chunk, 0, n);
                }
            }
            return buffer.toString("UTF-8");
        } finally {
            connection.disconnect();
        }
    }

    private void downloadToFile(URL url, File dest) throws IOException {
        HttpURLConnection connection = openConnection(url);
        connection.setConnectTimeout(15_000);
        connection.setReadTimeout(15_000);
        connection.setInstanceFollowRedirects(true);
        connection.setRequestProperty("ngrok-skip-browser-warning", "true");
        try {
            int status = connection.getResponseCode();
            if (status != HttpURLConnection.HTTP_OK) {
                throw new IOException("HTTP " + status);
            }
            long total = connection.getContentLengthLong();
            long downloaded = 0;
            int lastReportedPercent = -1;
            try (InputStream in = connection.getInputStream();
                 FileOutputStream out = new FileOutputStream(dest)) {
                byte[] buf = new byte[8192];
                int n;
                while ((n = in.read(buf)) != -1) {
                    out.write(buf, 0, n);
                    downloaded += n;
                    if (total > 0) {
                        int percent = (int) (downloaded * 100 / total);
                        if (percent != lastReportedPercent) {
                            lastReportedPercent = percent;
                            final int percentFinal = percent;
                            mainHandler.post(() -> evaluateJs(
                                    "window.onUpdateDownloadProgress && window.onUpdateDownloadProgress(" + percentFinal + ");"));
                        }
                    }
                }
            }
        } finally {
            connection.disconnect();
        }
    }

    // 키오스크(https) 플레이버는 자체서명 인증서를 쓰고, WebView 쪽은 이미
    // KioskWebViewClient.onReceivedSslError()에서 무조건 proceed()하는 동일한 신뢰 모델을 쓰고
    // 있다(자체서명이라 검증을 강화해도 실질 보안 이득이 없다는 기존 결정 - build.gradle admin
    // 플레이버 주석 참고). DownloadManager/기본 HttpsURLConnection은 이 우회를 타지 않아 그대로
    // 쓰면 인증서 검증 실패로 업데이트 체크/다운로드가 막히므로, 이 클래스가 여는 연결에 한해
    // JVM 전역이 아닌 개별 인스턴스 단위로 동일한 신뢰 우회를 적용한다.
    private static HttpURLConnection openConnection(URL url) throws IOException {
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        if (connection instanceof HttpsURLConnection) {
            HttpsURLConnection https = (HttpsURLConnection) connection;
            https.setSSLSocketFactory(trustAllSslContext().getSocketFactory());
            https.setHostnameVerifier((hostname, session) -> true);
        }
        return connection;
    }

    private static volatile SSLContext trustAllSslContextInstance;

    private static SSLContext trustAllSslContext() throws IOException {
        if (trustAllSslContextInstance != null) return trustAllSslContextInstance;
        try {
            TrustManager[] trustAll = new TrustManager[]{new X509TrustManager() {
                @Override
                public void checkClientTrusted(X509Certificate[] chain, String authType) {
                }

                @Override
                public void checkServerTrusted(X509Certificate[] chain, String authType) {
                }

                @Override
                public X509Certificate[] getAcceptedIssuers() {
                    return new X509Certificate[0];
                }
            }};
            SSLContext context = SSLContext.getInstance("TLS");
            context.init(null, trustAll, new SecureRandom());
            trustAllSslContextInstance = context;
            return context;
        } catch (Exception e) {
            throw new IOException("SSLContext 초기화 실패: " + e.getMessage());
        }
    }
}
