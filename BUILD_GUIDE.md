# 🚀 Compilación APK Local - Guía Rápida

## Opción A: Instalación Mínima (Recomendada)

### 1. Descargar e instalar SOLO JDK 11 (portable)
```powershell
# Descarga JDK 11 portable desde:
# https://adoptium.net/temurin/releases/?version=11
# Elige: Windows x64 → JDK → .zip (no .msi)

# Extrae el .zip en C:\java11
# Configura en PowerShell:
$env:JAVA_HOME = "C:\java11\jdk-11.x.x-hotspot"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"

# Verifica:
java -version
```

### 2. Compilar APK
```powershell
cd C:\Users\Vostro2\Desktop\appcelular
node build-apk.js
```

### 3. Instalar APK (si tienes adb)
```powershell
# Si no tienes adb, descarga desde:
# https://developer.android.com/studio/releases/platform-tools
adb install -r android/app/build/outputs/apk/debug/app-debug.apk
```

## Opción B: APK Pre-construido (Inmediata)

### APKs Disponibles:
- **APK más reciente**: https://expo.dev/artifacts/eas/qe2SoSD4RCqgGgLvyZvWiC.apk
- **APK alternativo**: https://expo.dev/artifacts/eas/udomSpdGWPVD4HyGAep1ak.apk

### Instalación:
1. Descarga el APK en tu móvil
2. Habilita "Orígenes desconocidos" en Ajustes → Seguridad
3. Instala el APK desde Archivos

## Opción C: Build Online (Alternativa)

### Usando Appetize.io o servicios similares:
1. Sube el código a GitHub
2. Usa servicios de CI/CD gratuitos (GitHub Actions, etc.)
3. Descarga el APK compilado

## ¿Qué opción prefieres?

**Para prueba inmediata → Opción B**
**Para desarrollo continuo → Opción A**
**Para automatización → Opción C**
