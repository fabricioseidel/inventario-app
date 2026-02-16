# 📋 Guía de Logs - Sistema de Comprobantes

## 🎯 Descripción General

El sistema ahora incluye logs detallados en **4 funciones críticas** que te permitirán diagnosticar rápidamente cualquier problema:

1. **Upload** - Subida de comprobante a Supabase Storage
2. **Venta** - Registro de venta en SellScreen
3. **Historial** - Adjuntar comprobante a venta existente en SalesHistoryScreen
4. **Sincronización** - Envío y descarga de ventas desde/hacia Supabase Cloud

---

## 📤 1. UPLOAD A SUPABASE STORAGE

**Archivo:** `src/utils/supabaseStorage.js`  
**Función:** `uploadReceiptToSupabase(localUri, saleId)`

### Logs Mostrados:

```
═══════════════════════════════════════════════════════
📤 [UPLOAD INICIO] Subiendo comprobante a Supabase Storage
═══════════════════════════════════════════════════════
⏰ Timestamp: 2025-11-20T14:30:45.123Z
📝 Sale ID: temp-1234567890-abc123
📁 URI Local: file:///data/user/0/...

⏳ [PASO 1] Leyendo archivo como base64...
✅ Base64 leído: 45612 caracteres

✅ Extensión detectada: .jpg
✅ Content-Type: image/jpeg
✅ Nombre de archivo generado: comprobante-123-1700500245123-x7y8z9.jpg

⏳ [PASO 2] Convirtiendo base64 a ArrayBuffer...
✅ ArrayBuffer creado: 34209 bytes

⏳ [PASO 3] Subiendo archivo a Supabase Storage...
   Bucket: 'uploads'
   Archivo: comprobante-123-1700500245123-x7y8z9.jpg
   Tamaño: 33.41 KB

⏱️ Tiempo de request: 1234ms

✅ [PASO 4] Construyendo URL pública...
   URL: https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/comprobante-123-1700500245123-x7y8z9.jpg

═══════════════════════════════════════════════════════
✅ [UPLOAD EXITOSO] Comprobante subido en 1234ms
═══════════════════════════════════════════════════════
📤 URL Final: https://...
```

### ❌ Si Falla:

```
═══════════════════════════════════════════════════════
❌ [ERROR UPLOAD] Falló después de 234ms
═══════════════════════════════════════════════════════
Error Type: TypeError
Error Message: Cannot read property 'charCodeAt' of undefined
Error Stack: at base64ToArrayBuffer...
Sale ID: temp-1234567890-abc123
Local URI: file:///data/user/0/...
```

---

## 📱 2. REGISTRO DE VENTA EN SELLSCREEN

**Archivo:** `src/screens/SellScreen.js`  
**Función:** `pay()` callback

### Logs Mostrados:

```
═══════════════════════════════════════════════════════
📤 [VENTA] Iniciando proceso de pago con comprobante
═══════════════════════════════════════════════════════
Método de pago: TRANSFERENCIA
Total venta: $45000
Comprobante detectado: Sí
Tipo: image
Nombre: IMG_123.jpg

⏳ [PASO 1] Subiendo comprobante a Supabase...
   ID temporal: temp-1700500245123-xyz789

⏳ [PASO 2] Comprobante subido exitosamente
   URL: https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/comprobante-temp-xyz789-1700500245123-abc.jpg

═══════════════════════════════════════════════════════

⏳ [PASO 3] Registrando venta en base de datos local...
Payload: {
  method: 'transferencia',
  amountPaid: 45000,
  hasReceipt: true,
  receiptUrl: '✅ Presente'
}

✅ Venta registrada en local correctamente
```

### ❌ Si Falla:

```
═══════════════════════════════════════════════════════
❌ [ERROR] Fallo al subir comprobante
═══════════════════════════════════════════════════════
Error: ENOENT: no such file or directory, open 'file:///...'
Stack: at FileSystem.readAsStringAsync...
Sale ID temporal: temp-1700500245123
```

---

## 📎 3. ADJUNTAR COMPROBANTE EN HISTORIAL

**Archivo:** `src/screens/SalesHistoryScreen.js`  
**Función:** `persistProof(localUri, displayName)`

### Logs Mostrados (Archivo Local):

```
═══════════════════════════════════════════════════════
📎 [ADJUNTAR COMPROBANTE] Procesando archivo
═══════════════════════════════════════════════════════
⏰ Timestamp: 2025-11-20T14:30:45.123Z
🆔 Sale ID: 42
📁 URI: file:///data/user/0/com.example/cache/IMG_123.jpg
📝 Nombre: IMG_123.jpg

⏳ [PASO 1] Detectado archivo local - procediendo con upload
[... logs de upload ...]

✅ [PASO 2] Archivo subido a Supabase
   URL: https://nuuoooqfbuwodagvmmsf.supabase.co/...

⏳ [PASO 3] Actualizando venta en base de datos local...
✅ BD local actualizada

⏳ [PASO 4] Recargando detalle de venta...
✅ Venta actualizada en lista

═══════════════════════════════════════════════════════
✅ [ÉXITO] Comprobante procesado en 3456ms
═══════════════════════════════════════════════════════
Tipo: Archivo nuevo
URL Final: https://nuuoooqfbuwodagvmmsf.supabase.co/...
```

### Logs Mostrados (URL Remota):

```
⏳ [PASO 1] Detectada URL remota - usando directamente
   URL: https://nuuoooqfbuwodagvmmsf.supabase.co/...

⏳ [PASO 3] Actualizando venta en base de datos local...
✅ [ÉXITO] Comprobante procesado en 234ms

Tipo: URL remota
URL Final: https://...
```

### ❌ Si Falla:

```
═══════════════════════════════════════════════════════
❌ [ERROR] Falló al procesar comprobante (567ms)
═══════════════════════════════════════════════════════
Error Type: ReferenceError
Error Message: updateSaleTransferReceipt is not defined
Stack: at persistProof...
Sale ID: 42
URI: file:///data/user/0/...
```

---

## 📥📤 4. SINCRONIZACIÓN (SYNC)

**Archivo:** `src/sync.js`

### 4.1 UPLOAD (pushSales)

**Función:** `pushSales()`

```
═══════════════════════════════════════════════════════
📤 [SYNC UPLOAD] Sincronizando ventas con Supabase
═══════════════════════════════════════════════════════
⏰ Timestamp: 2025-11-20T14:30:45.123Z
📱 Device ID: android-1700500200123-xyz789
👤 Vendedor: MARIANA
📊 Ventas pendientes: 3

───────────────────────────────────────────────────────
📋 Venta: android-1700500200123-xyz789-sale-001
   Total: $45000
   Método: transferencia
   Comprobante: ✅ Sí
   Items: 2

⏳ Enviando RPC 'apply_sale'...
✅ [RPC OK] Completado en 567ms
   ID en Supabase: 42

───────────────────────────────────────────────────────
📋 Venta: android-1700500200123-xyz789-sale-002
   Total: $15000
   Método: efectivo
   Comprobante: ❌ No
   Items: 1

⏳ Enviando RPC 'apply_sale'...
✅ [RPC OK] Completado en 423ms
   ID en Supabase: 43

═══════════════════════════════════════════════════════
✅ [SYNC UPLOAD COMPLETADO] 1234ms
═══════════════════════════════════════════════════════
✅ Exitosas: 2
❌ Errores: 0
📊 Total: 2
```

### ❌ Si Falla (Ejemplo):

```
───────────────────────────────────────────────────────
⏳ Enviando RPC 'apply_sale'...
❌ [ERROR RPC] Fallo después de 234ms
   Código: 400
   Mensaje: "p_transfer_receipt_uri: value too long"
   Venta: android-1700500200123-xyz789-sale-001
   Payload: {...}
```

### 4.2 DOWNLOAD (pullSales)

**Función:** `pullSales()`

```
═══════════════════════════════════════════════════════
📥 [SYNC DOWNLOAD] Descargando ventas desde Supabase
═══════════════════════════════════════════════════════
⏰ Timestamp: 2025-11-20T14:30:45.123Z
📱 Device ID: android-1700500200123-xyz789
🕐 Desde: 2025-11-20T14:20:00.000Z

⏳ [PASO 1] Consultando tabla 'sales'...
✅ Query completada en 234ms
📊 Ventas encontradas: 2

───────────────────────────────────────────────────────
📋 Venta remota: 41
   Total: $25000
   Método: transferencia
   Dispositivo origen: android-1700500150000-abc123
   Timestamp: 2025-11-20T14:25:30.000Z
   Comprobante: ✅ Sí

   Items (JSON): 2

⏳ Insertando en BD local...
✅ Insertada en BD local (12ms)

───────────────────────────────────────────────────────
📋 Venta remota: 40
   Total: $10000
   Método: efectivo
   Dispositivo origen: android-1700500100000-xyz789
   Timestamp: 2025-11-20T14:24:15.000Z
   Comprobante: ❌ No

   Items (JSON): 1

⏳ Insertando en BD local...
✅ Insertada en BD local (8ms)

═══════════════════════════════════════════════════════
✅ [SYNC DOWNLOAD COMPLETADO] 456ms
═══════════════════════════════════════════════════════
✅ Insertadas: 2
❌ Errores: 0
📊 Total procesadas: 2
```

### ❌ Si Falla (Ejemplo):

```
═══════════════════════════════════════════════════════
❌ [ERROR QUERY] Fallo después of 123ms
═══════════════════════════════════════════════════════
Error: "Unauthorized"
Código: 401
```

---

## 🔍 Cómo Leer los Logs

### En Android Studio (Logcat):

1. Abre Android Studio
2. Abajo: **Logcat** tab
3. Filtra por:
   - `uploadReceipt` → Solo logs de upload
   - `SYNC UPLOAD` → Sincronización up
   - `SYNC DOWNLOAD` → Sincronización down
   - `[VENTA]` → Logs de pago
   - `[ADJUNTAR` → Logs de historial

### En React Native Debug:

```javascript
// Desde la consola de RN:
// Busca los separadores === para ver el inicio y fin de cada operación
```

---

## 🎯 Checklist de Debugging

Si los comprobantes no se suben, verifica en este orden:

```
1. ¿Aparece "[UPLOAD INICIO]"?
   ❌ → El método uploadReceiptToSupabase no se ejecutó
   ✅ → Continúa

2. ¿Aparece "Base64 leído"?
   ❌ → El archivo no puede leerse (permiso o ruta inválida)
   ✅ → Continúa

3. ¿Aparece "[PASO 3] Subiendo archivo"?
   ❌ → Error en conversión base64 → ArrayBuffer
   ✅ → Continúa

4. ¿Aparece "[ERROR RPC]" en SYNC UPLOAD?
   ❌ → Comprobante subió pero sync falló (ver el error específico)
   ✅ → Todo está bien

5. ¿Aparece "[SYNC DOWNLOAD COMPLETADO]"?
   ❌ → No se descargaron ventas de otros dispositivos
   ✅ → Los comprobantes están sincronizados en todos lados
```

---

## 📊 Métricas Esperadas

| Operación | Tiempo Esperado | Máximo Aceptable |
|-----------|-----------------|-----------------|
| Base64 lectura | 50-200ms | 500ms |
| Conversión a ArrayBuffer | 5-20ms | 50ms |
| Upload a Supabase | 500-2000ms | 5000ms |
| RPC apply_sale | 100-500ms | 2000ms |
| Inserción local | 5-50ms | 200ms |
| Query sales remoto | 50-300ms | 1000ms |

---

## 💡 Ejemplos de Problemas Comunes

### "property 'atob' doesn't exist"
```
❌ ANTES: const binaryString = atob(base64);
✅ DESPUÉS: Buffer.from(base64Data, 'base64').toString('binary')
✅ YA CORREGIDO en la versión actual
```

### "Cannot read property 'charCodeAt' of undefined"
```
Significa que Buffer.from() no funcionó
✅ Solución: Actualiza Expo a última versión que incluya polyfill
```

### Venta sin comprobante después de upload exitoso
```
❌ El upload fue exitoso pero recordSale no incluyó la URL
✅ Verifica que receiptUrl se pasa a recordSale() en payload
```

---

## 📞 Información para Reportar Errores

Si un comprobante falla, copia estos logs:

1. El BLOQUE completo entre `═══════════════════════════════════════════════════════`
2. Todos los mensajes `[PASO X]` y su estado
3. El tiempo total de ejecución
4. El tipo de error exacto
5. El Sale ID involucrado

---

## ✅ Estado Actual

✅ **Todos los logs implementados y probados**  
✅ **Buffer en lugar de atob para compatibilidad React Native**  
✅ **Timestamps detallados en cada paso**  
✅ **Información de error completa**  
✅ **Métricas de rendimiento incluidas**

**Commit:** `21b98d0`

