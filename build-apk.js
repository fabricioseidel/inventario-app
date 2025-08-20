#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🔨 Building APK without Android Studio...');

// Verificar si existe gradlew
const gradlewPath = path.join(__dirname, 'android', 'gradlew.bat');
if (!fs.existsSync(gradlewPath)) {
    console.error('❌ No se encuentra gradlew.bat en android/');
    process.exit(1);
}

try {
    // Cambiar al directorio android
    process.chdir(path.join(__dirname, 'android'));
    
    console.log('📦 Compilando APK debug...');
    
    // Intentar compilar sin JAVA_HOME (usando el wrapper)
    execSync('gradlew.bat assembleDebug', { 
        stdio: 'inherit',
        env: { 
            ...process.env,
            JAVA_OPTS: '-Xmx2048m',
            GRADLE_OPTS: '-Xmx2048m -Dorg.gradle.daemon=false'
        }
    });
    
    console.log('✅ APK creado exitosamente!');
    console.log('📁 Ubicación: android/app/build/outputs/apk/debug/app-debug.apk');
    
    // Verificar si el APK existe
    const apkPath = path.join('app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
    if (fs.existsSync(apkPath)) {
        const stats = fs.statSync(apkPath);
        console.log(`📊 Tamaño: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);
        console.log('🚀 Listo para instalar con: adb install -r android/app/build/outputs/apk/debug/app-debug.apk');
    }
    
} catch (error) {
    console.error('❌ Error durante la compilación:');
    console.error(error.message);
    
    // Sugerencias de solución
    console.log('\n🔧 Soluciones posibles:');
    console.log('1. Instalar JDK 11: https://adoptium.net/');
    console.log('2. Configurar JAVA_HOME en variables de entorno');
    console.log('3. Instalar Android SDK: https://developer.android.com/studio');
    
    process.exit(1);
}
