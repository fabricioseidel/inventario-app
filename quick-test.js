// quick-test.js
// Test rápido de funcionalidad usando simulación simple

console.log('🧪 INICIANDO PRUEBAS DE FUNCIONALIDAD');
console.log('==========================================');

// Test 1: Verificar estructura de datos de producto
console.log('\n📦 TEST 1: Estructura de datos de producto');
const testProduct = {
  barcode: '7894900011517',
  name: 'Producto Test',
  category: 'Pruebas',
  purchasePrice: 100,
  salePrice: 150,
  stock: 10,
  soldByWeight: 0
};

const requiredFields = ['barcode', 'name', 'salePrice'];
let productValid = true;
requiredFields.forEach(field => {
  if (!testProduct[field]) {
    console.log(`❌ Campo faltante: ${field}`);
    productValid = false;
  }
});

if (productValid) {
  console.log('✅ Estructura de producto válida');
} else {
  console.log('❌ Estructura de producto inválida');
}

// Test 2: Verificar estructura de venta
console.log('\n💰 TEST 2: Estructura de datos de venta');
const testSale = {
  items: [
    {
      barcode: testProduct.barcode,
      name: testProduct.name,
      qty: 2,
      unit_price: testProduct.salePrice
    }
  ],
  total: 300,
  paymentMethod: 'efectivo',
  amountPaid: 300,
  change: 0
};

const saleValid = testSale.items.length > 0 && testSale.total > 0 && testSale.paymentMethod;
if (saleValid) {
  console.log('✅ Estructura de venta válida');
} else {
  console.log('❌ Estructura de venta inválida');
}

// Test 3: Validar cálculos
console.log('\n🧮 TEST 3: Validación de cálculos');
const calculatedTotal = testSale.items.reduce((sum, item) => sum + (item.qty * item.unit_price), 0);
const expectedTotal = testSale.total;

if (calculatedTotal === expectedTotal) {
  console.log('✅ Cálculos de total correctos');
} else {
  console.log(`❌ Error en cálculos: esperado ${expectedTotal}, calculado ${calculatedTotal}`);
}

// Test 4: Validar métodos de pago
console.log('\n💳 TEST 4: Métodos de pago');
const validPaymentMethods = ['efectivo', 'debito', 'credito', 'transferencia'];
const testMethod = testSale.paymentMethod;

if (validPaymentMethods.includes(testMethod)) {
  console.log('✅ Método de pago válido');
} else {
  console.log(`❌ Método de pago inválido: ${testMethod}`);
}

// Test 5: Validar formato de código de barras
console.log('\n🏷️ TEST 5: Formato de código de barras');
const barcodePattern = /^\d{8,14}$/; // 8-14 dígitos
const testBarcode = testProduct.barcode;

if (barcodePattern.test(testBarcode)) {
  console.log('✅ Formato de código de barras válido');
} else {
  console.log(`❌ Formato de código de barras inválido: ${testBarcode}`);
}

// Test 6: Validar rangos de precios
console.log('\n💲 TEST 6: Validación de precios');
const purchasePrice = testProduct.purchasePrice;
const salePrice = testProduct.salePrice;

let priceValid = true;
if (purchasePrice < 0 || salePrice < 0) {
  console.log('❌ Precios no pueden ser negativos');
  priceValid = false;
}
if (salePrice < purchasePrice) {
  console.log('⚠️ Precio de venta menor al de compra (pérdida)');
}
if (priceValid && salePrice >= 0) {
  console.log('✅ Precios válidos');
}

// Test 7: Validar stock
console.log('\n📦 TEST 7: Validación de stock');
const stock = testProduct.stock;
if (stock < 0) {
  console.log('❌ Stock no puede ser negativo');
} else {
  console.log('✅ Stock válido');
}

console.log('\n==========================================');
console.log('🎉 PRUEBAS BÁSICAS COMPLETADAS');
console.log('==========================================');

// Resumen de problemas detectados
const problems = [];

if (!productValid) problems.push('Estructura de producto inválida');
if (!saleValid) problems.push('Estructura de venta inválida');
if (calculatedTotal !== expectedTotal) problems.push('Error en cálculos');
if (!validPaymentMethods.includes(testMethod)) problems.push('Método de pago inválido');
if (!barcodePattern.test(testBarcode)) problems.push('Código de barras inválido');
if (purchasePrice < 0 || salePrice < 0) problems.push('Precios negativos');
if (stock < 0) problems.push('Stock negativo');

if (problems.length === 0) {
  console.log('🎉 TODAS LAS PRUEBAS PASARON - NO SE DETECTARON PROBLEMAS CRÍTICOS');
} else {
  console.log('⚠️ PROBLEMAS DETECTADOS:');
  problems.forEach(problem => console.log(`   • ${problem}`));
}

console.log('\n📝 NOTA: Estas son pruebas básicas de lógica y estructura de datos.');
console.log('Para pruebas completas de funcionalidad, ejecuta la app con Expo.');