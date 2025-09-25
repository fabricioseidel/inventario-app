// debug-config.js
// Configuración para debug de errores comunes

console.log('🔍 DIAGNÓSTICO DE ERRORES EXPO');
console.log('====================================');

// Verificar configuración del proyecto
console.log('📱 Configuración del proyecto:');

// Leer package.json
const fs = require('fs');
const path = require('path');

try {
  const packagePath = path.join(__dirname, 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  console.log('✅ Nombre:', packageJson.name);
  console.log('✅ Versión:', packageJson.version);
  console.log('✅ Main:', packageJson.main);
  console.log('✅ Expo SDK:', packageJson.dependencies?.expo || 'No encontrado');
  
} catch (e) {
  console.log('❌ Error leyendo package.json:', e.message);
}

// Verificar app.json
try {
  const appPath = path.join(__dirname, 'app.json');
  const appJson = JSON.parse(fs.readFileSync(appPath, 'utf8'));
  
  console.log('\n📱 Configuración Expo:');
  console.log('✅ Nombre:', appJson.expo?.name);
  console.log('✅ Slug:', appJson.expo?.slug);
  console.log('✅ Versión:', appJson.expo?.version);
  console.log('✅ SDK Version:', appJson.expo?.sdkVersion);
  console.log('✅ Platforms:', appJson.expo?.platforms);
  
} catch (e) {
  console.log('❌ Error leyendo app.json:', e.message);
}

// Verificar archivos principales
console.log('\n📁 Archivos principales:');
const mainFiles = ['App.js', 'index.js', 'metro.config.js'];
mainFiles.forEach(file => {
  try {
    if (fs.existsSync(path.join(__dirname, file))) {
      console.log(`✅ ${file} existe`);
    } else {
      console.log(`❌ ${file} NO existe`);
    }
  } catch (e) {
    console.log(`❌ Error verificando ${file}:`, e.message);
  }
});

// Verificar estructura src/
console.log('\n📂 Estructura src/:');
const srcPath = path.join(__dirname, 'src');
if (fs.existsSync(srcPath)) {
  try {
    const srcContents = fs.readdirSync(srcPath);
    console.log('✅ Carpeta src/ contiene:', srcContents.join(', '));
  } catch (e) {
    console.log('❌ Error leyendo src/:', e.message);
  }
} else {
  console.log('❌ Carpeta src/ no existe');
}

console.log('\n====================================');
console.log('🔍 DIAGNÓSTICO COMPLETADO');
console.log('====================================');

// Errores comunes y soluciones
console.log('\n🚨 ERRORES COMUNES Y SOLUCIONES:');
console.log('');
console.log('1. "Unable to resolve module":');
console.log('   Solución: npm install && npx expo r -c');
console.log('');
console.log('2. "Network request failed":');
console.log('   Solución: Verificar conexión WiFi/datos');
console.log('');
console.log('3. "Something went wrong":');
console.log('   Solución: npx expo start --tunnel --clear');
console.log('');
console.log('4. "Metro bundler issues":');
console.log('   Solución: npx expo start --reset-cache');
console.log('');
console.log('5. "Expo Go version mismatch":');
console.log('   Solución: Actualizar Expo Go en la tienda');
console.log('');
console.log('====================================');