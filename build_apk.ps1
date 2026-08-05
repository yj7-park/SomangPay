$env:JAVA_HOME = "C:\Program Files\Android\Android Studio\jbr"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

$SDK = "C:\Users\LSH-DeskTop\AppData\Local\Android\Sdk"
$BUILD_TOOLS = "$SDK\build-tools\34.0.0"
$PLATFORM = "$SDK\platforms\android-34\android.jar"
$JAVA = "$env:JAVA_HOME\bin\java.exe"
$JAVAC = "$env:JAVA_HOME\bin\javac.exe"

$ROOT = "d:\Workspace\SomangPay\SomangPay\android_kiosk"
$APP = "$ROOT\app"
$OUT = "$ROOT\out"

if (Test-Path -Path $OUT) {
    Remove-Item -Path "$OUT\*" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item -Path $OUT -Recurse -Force -ErrorAction SilentlyContinue
}

New-Item -ItemType Directory -Path "$OUT\bin" -Force | Out-Null
New-Item -ItemType Directory -Path "$OUT\res" -Force | Out-Null
New-Item -ItemType Directory -Path "$OUT\obj" -Force | Out-Null

Write-Host "1. Compiling Android Resources with AAPT2..."
& "$BUILD_TOOLS\aapt2.exe" compile --dir "$APP\src\main\res" -o "$OUT\res\compiled.zip"

Write-Host "2. Linking AAPT2 Package..."
& "$BUILD_TOOLS\aapt2.exe" link -o "$OUT\bin\app-unsigned.apk" `
    -I $PLATFORM `
    --manifest "$APP\src\main\AndroidManifest.xml" `
    --min-sdk-version 24 `
    --target-sdk-version 34 `
    --version-code 15 `
    --version-name "1.0.15" `
    --java "$OUT\obj" `
    --auto-add-overlay

Write-Host "3. Compiling Java Source Files (Java 8 Target)..."
$javaSources = Get-ChildItem -Recurse "$APP\src\main\java" -Filter "*.java" | ForEach-Object { $_.FullName }
$rJava = Get-ChildItem -Recurse "$OUT\obj" -Filter "*.java" | ForEach-Object { $_.FullName }

& $JAVAC -source 1.8 -target 1.8 -cp $PLATFORM -d "$OUT\bin" $javaSources $rJava

Write-Host "4. Converting Class Files to DEX with D8..."
$classFiles = Get-ChildItem -Recurse "$OUT\bin\*.class" | ForEach-Object { $_.FullName }
& "$BUILD_TOOLS\d8.bat" --output "$OUT\bin" --lib $PLATFORM $classFiles

Write-Host "5. Adding classes.dex to APK Archive Root..."
Push-Location "$OUT\bin"
& "$BUILD_TOOLS\aapt.exe" add "app-unsigned.apk" "classes.dex"
Pop-Location

Write-Host "6. Signing APK with Debug Keystore..."
$keystore = "$env:USERPROFILE\.android\debug.keystore"
if (-not (Test-Path $keystore)) {
    & "$env:JAVA_HOME\bin\keytool.exe" -genkeypair -v `
        -keystore $keystore -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 `
        -dname "CN=Android Debug,O=Android,C=US" -storepass android -keypass android
}

& "$BUILD_TOOLS\apksigner.bat" sign --ks $keystore --ks-pass pass:android --key-pass pass:android `
    --out "$OUT\bin\SomangPayKiosk.apk" "$OUT\bin\app-unsigned.apk"

Write-Host "?Ž‰ APK Build Completed Successfully! Output: $OUT\bin\SomangPayKiosk.apk"



