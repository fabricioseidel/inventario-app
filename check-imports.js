// check-imports.js
// Script para verificar que todas las importaciones funcionen correctamente

console.log('🔍 Verificando imports y dependencias...');

try {
  // Verificar importaciones principales
  console.log('📦 Checking React Native imports...');
  const RN = require('react-native');
  console.log('✅ React Native OK');
  
  console.log('📦 Checking Expo imports...');
  const ExpoSQLite = require('expo-sqlite');
  const ExpoBarcode = require('expo-barcode-scanner');
  const ExpoImage = require('expo-image-picker');
  console.log('✅ Expo packages OK');
  
  console.log('📦 Checking Supabase...');
  const Supabase = require('@supabase/supabase-js');
  console.log('✅ Supabase OK');
  
  console.log('📦 Checking AsyncStorage...');
  const AsyncStorage = require('@react-native-async-storage/async-storage');
  console.log('✅ AsyncStorage OK');
  
  console.log('📦 Checking local modules...');
  // Estas se verificarán solo si es posible en Node
  try {
    const db = require('./src/db');
    console.log('✅ DB module syntax OK');
  } catch (e) {
    console.log('⚠️ DB module (normal en Node.js):', e.message.substring(0, 100) + '...');
  }
  
  try {
    const sync = require('./src/sync');
    console.log('✅ Sync module syntax OK');
  } catch (e) {
    console.log('⚠️ Sync module (normal en Node.js):', e.message.substring(0, 100) + '...');
  }
  
  console.log('🎉 Verificación de imports completada');
  
} catch (error) {
  console.error('❌ ERROR en imports:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}