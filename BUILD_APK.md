## Build APK mediante GitHub Actions

1. Haz push a `master` o `main`.
2. GitHub Actions ejecutará `.github/workflows/build-apk.yml`.
3. Una vez completado, abre la pestaña **Actions**, entra al workflow y descarga el artefacto `app-debug-apk`.

El APK generado contiene el bundle y funciona sin conectarse a Expo.

## Build APK local (debug)

```bash
npm install
cd android
./gradlew assembleDebug
```

El archivo queda en `android/app/build/outputs/apk/debug/app-debug.apk`.

## Build release firmada

1. Crea un keystore y colócalo en `android/app/`.
2. Configura `android/app/build.gradle` (`signingConfigs` y `buildTypes.release`).
3. Ejecuta `./gradlew assembleRelease` para obtener `app-release.apk`.
