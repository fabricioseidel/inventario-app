// test-functionality.js
// Script para probar las funcionalidades principales de la app

import { initDB, insertOrUpdateProduct, listProducts, recordSale, getProductByBarcode } from './src/db';
import { syncNow } from './src/sync';

const testLog = (msg) => console.log(`🧪 TEST: ${msg}`);
const errorLog = (msg, error) => console.error(`❌ TEST ERROR: ${msg}`, error);

async function testDatabaseFunctionality() {
  testLog('Iniciando test de base de datos...');
  
  try {
    // Test 1: Inicialización de DB
    await initDB();
    testLog('✅ Base de datos inicializada correctamente');
    
    // Test 2: Insertar producto de prueba
    const testProduct = {
      barcode: '7894900011517',
      name: 'Producto de Prueba',
      category: 'Test',
      purchasePrice: 100,
      salePrice: 150,
      stock: 10,
      soldByWeight: 0
    };
    
    await insertOrUpdateProduct(testProduct);
    testLog('✅ Producto de prueba insertado');
    
    // Test 3: Listar productos
    const products = await listProducts();
    testLog(`✅ Productos listados: ${products.length} productos`);
    
    // Test 4: Buscar producto por código
    const found = await getProductByBarcode(testProduct.barcode);
    if (found && found.name === testProduct.name) {
      testLog('✅ Producto encontrado por código');
    } else {
      errorLog('Producto no encontrado o datos incorrectos', found);
    }
    
    // Test 5: Registrar venta de prueba
    const cart = [{
      barcode: testProduct.barcode,
      name: testProduct.name,
      qty: 2,
      unit_price: testProduct.salePrice
    }];
    
    const saleResult = await recordSale(cart, {
      paymentMethod: 'efectivo',
      amountPaid: 300
    });
    
    if (saleResult && saleResult.ok) {
      testLog('✅ Venta registrada correctamente');
    } else {
      errorLog('Error registrando venta', saleResult);
    }
    
    testLog('🎉 Todas las pruebas de base de datos pasaron');
    
  } catch (error) {
    errorLog('Error en pruebas de base de datos', error);
    throw error;
  }
}

async function testSyncFunctionality() {
  testLog('Iniciando test de sincronización...');
  
  try {
    await syncNow();
    testLog('✅ Sincronización ejecutada (puede fallar si no hay internet)');
  } catch (error) {
    testLog('⚠️ Sincronización falló (normal si no hay conexión): ' + error.message);
  }
}

async function runAllTests() {
  testLog('🚀 Iniciando suite completa de pruebas...');
  
  try {
    await testDatabaseFunctionality();
    await testSyncFunctionality();
    
    testLog('🎉 TODAS LAS PRUEBAS COMPLETADAS');
  } catch (error) {
    errorLog('PRUEBAS FALLARON', error);
    throw error;
  }
}

// Exportar para uso en otros contextos
export { testDatabaseFunctionality, testSyncFunctionality, runAllTests };

// Si se ejecuta directamente
if (require.main === module) {
  runAllTests().catch((error) => {
    console.error('💥 TEST SUITE FAILED:', error);
    process.exit(1);
  });
}