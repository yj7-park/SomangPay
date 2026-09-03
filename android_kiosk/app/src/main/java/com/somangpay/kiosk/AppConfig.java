package com.somangpay.kiosk;

// 빌드 타입별로 WebView 가 붙을 URL 을 고른다. release = 운영(BuildConfig.TARGET_URL),
// debug = 개발 서버(BuildConfig.DEV_TARGET_URL, build.gradle 의 devTargetHost). 세 플레이버
// (kiosk/admin/user)가 각자 자기 경로(/kiosk·/admin·/user)로 두 URL 을 모두 갖고 있다.
// 코드에서 BuildConfig.TARGET_URL 을 직접 쓰지 말고 이 상수를 쓸 것.
public final class AppConfig {
    private AppConfig() {}

    public static final String TARGET_URL =
            BuildConfig.DEBUG ? BuildConfig.DEV_TARGET_URL : BuildConfig.TARGET_URL;
}
