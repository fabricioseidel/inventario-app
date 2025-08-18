# Instrucciones para generar APK de OlivoMarket

## Método 1: EAS Build (Recomendado)

1. Crear cuenta gratuita en https://expo.dev
2. Ejecutar en terminal:
   ```
   npx eas-cli login
   npx eas-cli build --platform android --profile preview
   ```
3. Esperar el build (5-15 minutos)
4. Descargar el APK generado
5. Instalar en tu teléfono

## Método 2: Build Local (Más complejo)

1. Instalar Android Studio y Java JDK
2. Configurar variables de entorno ANDROID_HOME
3. Ejecutar:
   ```
   npx expo prebuild
   cd android
   ./gradlew assembleRelease
   ```
4. El APK estará en: `android/app/build/outputs/apk/release/`

## Uso Actual

Por ahora, usa **Expo Go** siguiendo estos pasos:

1. Instala Expo Go desde Play Store
2. Escanea el código QR que aparece en la terminal
3. ¡La app funcionará completamente!

## Base de Datos

- **Local**: SQLite (funciona sin internet)
- **Nube**: Para usar Supabase, edita `src/supabaseClient.js` y agrega tu URL y ANON KEY

## Funciones Disponibles

✅ Escaneo de códigos de barras con cámara
✅ CRUD completo de productos
✅ Gestión de categorías
✅ Base de datos local SQLite
✅ Exportación a CSV y JSON
✅ Sincronización con Supabase (opcional)
✅ Funciona offline y online

## Permisos

La app solicitará permisos de:
- Cámara (para escanear códigos)
- Almacenamiento (para exportar archivos)
