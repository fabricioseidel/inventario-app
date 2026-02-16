# 📤 Cómo la App Móvil Carga Archivos a Supabase Storage

## 🎯 Resumen
La app móvil **Expo/React Native** sube comprobantes (imágenes) a **Supabase Storage** usando el **método de Supabase SDK** con archivos en formato **ArrayBuffer**, no FormData.

---

## 📍 Lugar de Implementación

**Archivo principal:** `src/utils/supabaseStorage.js`

**Función principal:** `uploadReceiptToSupabase(localUri, saleId)`

**Usado en:**
- `src/screens/SellScreen.js` - Carga comprobante al registrar pago por transferencia
- `src/screens/SalesHistoryScreen.js` - Carga comprobante desde el historial

---

## 🔧 Método Exacto de Carga

### **1️⃣ Leer el archivo como Base64**

```javascript
// Convertir archivo local (file://) a Base64
const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
});
```

**Entrada:** URI local del archivo (ejemplo: `file:///storage/emulated/0/...imagen.jpg`)
**Salida:** String en formato Base64

---

### **2️⃣ Convertir Base64 a ArrayBuffer**

```javascript
const base64ToArrayBuffer = (base64String) => {
    const chars = [];
    let i = 0;
    while (i < base64String.length) {
        const a = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.indexOf(base64String.charAt(i++));
        const b = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.indexOf(base64String.charAt(i++));
        const c = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.indexOf(base64String.charAt(i++));
        const d = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'.indexOf(base64String.charAt(i++));
        
        const bitmap = (a << 18) | (b << 12) | (c << 6) | d;
        chars.push((bitmap >> 16) & 255);
        if (c != 64) chars.push((bitmap >> 8) & 255);
        if (d != 64) chars.push(bitmap & 255);
    }
    return new Uint8Array(chars).buffer;
};

const buffer = base64ToArrayBuffer(base64);
```

**Entrada:** String Base64
**Salida:** `ArrayBuffer` (datos binarios)

---

### **3️⃣ Generar nombre de archivo único**

```javascript
// Formato: comprobante-{saleId}-{timestamp}-{random}.{extension}
function generateReceiptFileName(saleId, extension = 'jpg') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const ext = extension.toLowerCase().replace('.', '');
    return `comprobante-${saleId}-${timestamp}-${random}.${ext}`;
}

// Extraer extensión del URI
function getFileExtension(uri) {
    if (!uri) return 'jpg';
    const match = uri.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    if (match && match[1]) {
        return match[1].toLowerCase();
    }
    return 'jpg';
}

// Usar
const extension = getFileExtension(localUri);        // ej: 'jpg'
const fileName = generateReceiptFileName(saleId, extension);  // ej: 'comprobante-123-1731234567890-a1b2c3d4.jpg'
```

---

### **4️⃣ Subir ArrayBuffer a Supabase Storage**

```javascript
// Determinar tipo MIME según extensión
let contentType = 'image/jpeg';
if (extension === 'png') contentType = 'image/png';
else if (extension === 'webp') contentType = 'image/webp';
else if (extension === 'heic' || extension === 'heif') contentType = 'image/heic';

// Subir usando el SDK de Supabase
const { data, error } = await supabase.storage
    .from('uploads')  // ← Nombre del bucket
    .upload(fileName, buffer, {
        contentType,        // 'image/jpeg', 'image/png', etc.
        cacheControl: '3600',
        upsert: false,
    });

if (error) {
    throw new Error(`Error al subir archivo: ${error.message}`);
}
```

**Parámetros:**
- `'uploads'` - Nombre del bucket en Supabase
- `fileName` - Nombre único del archivo
- `buffer` - ArrayBuffer con los datos binarios
- `contentType` - Tipo MIME (image/jpeg, image/png, etc.)
- `cacheControl` - Tiempo de caché en segundos (3600 = 1 hora)
- `upsert` - Si `false`, no sobrescribe archivos existentes

---

### **5️⃣ Construir URL pública**

```javascript
const publicUrl = `https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/${fileName}`;

// Ejemplo resultado:
// https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/comprobante-123-1731234567890-a1b2c3d4.jpg
```

---

## 📊 Flujo Completo

```
archivo.jpg (local: file://...)
    ↓
FileSystem.readAsStringAsync() → Base64 string
    ↓
base64ToArrayBuffer() → ArrayBuffer
    ↓
supabase.storage.from('uploads').upload(fileName, buffer, {...})
    ↓
{ data: {...}, error: null }
    ↓
Construir URL pública → https://...uploads/comprobante-123-...jpg
    ↓
Guardar URL en base de datos
```

---

## 🔑 Configuración de Supabase (en `src/supabaseClient.js`)

```javascript
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://nuuoooqfbuwodagvmmsf.supabase.co';
export const SUPABASE_SERVICE_KEY = 'eyJhbGc...'; // Service Role Key

export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
});
```

**Bucket:** `uploads`
**Acceso público:** Sí (URLs públicas sin autenticación)
**Carpeta en bucket:** Raíz (no hay subcarpetas, solo archivo.jpg)

---

## 📥 Cómo Se Usa en Pantallas

### **SellScreen.js - Al registrar pago**

```javascript
import { uploadReceiptToSupabase } from '../utils/supabaseStorage';

// Dentro de la función pay()
const proof = method === 'transferencia' ? transferProof : null;

if (proof && proof.kind === 'image') {
    const tempSaleId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    receiptUrl = await uploadReceiptToSupabase(proof.uri, tempSaleId);
    receiptName = proof.name;
}

// receiptUrl → Se guarda en la BD con los datos de la venta
```

### **SalesHistoryScreen.js - Desde historial**

```javascript
import { uploadReceiptToSupabase } from '../utils/supabaseStorage';

// Dentro de persistProof()
if (localUri.startsWith('file://') || localUri.includes('Documents')) {
    uploadedUrl = await uploadReceiptToSupabase(localUri, detail.sale.id);
    uploadedName = displayName || getFileDisplayName(localUri);
}

// uploadedUrl → Se actualiza en la BD
```

---

## ⚠️ Puntos Importantes

### **NO usa FormData**
- ❌ FormData no se utiliza
- ❌ multipart/form-data no se utiliza
- ✅ Se usa **ArrayBuffer** directamente

### **NO usa fetch() o axios()**
- ❌ No hay llamadas POST/PUT manuales
- ✅ Se usa el **método `.upload()` del SDK de Supabase**

### **Archivo completamente leído en memoria**
- La app lee el archivo completo como Base64
- Lo convierte a ArrayBuffer
- Lo sube en una única petición

### **Extensión y MIME type**
- Se detecta automáticamente de la URI
- Se soportan: JPG, PNG, WEBP, HEIC/HEIF
- El tipo MIME se envía en headers

---

## 🔐 Seguridad

**Bucket:** Configurado con acceso público para lectura de URLs
**Upload:** Requiere autenticación (Supabase Service Key)
**Nombre de archivo:** Único con timestamp + random para evitar colisiones

---

## 💡 Para Replicar en Otra Plataforma

Si necesitas replicar esto en una página web, tienes dos opciones:

### **Opción 1: Usar el mismo método (recomendado)**
```javascript
// En navegador web
const file = inputFileElement.files[0];
const arrayBuffer = await file.arrayBuffer(); // O FileReader para compatibilidad

const { data, error } = await supabase.storage
    .from('uploads')
    .upload(fileName, arrayBuffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
    });
```

### **Opción 2: Usar FormData (alternativa)**
```javascript
const formData = new FormData();
formData.append('file', file);

// Subir manualmente (sin SDK de Supabase)
const response = await fetch('https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/uploads/' + fileName, {
    method: 'POST',
    headers: {
        'Authorization': 'Bearer ' + SUPABASE_SERVICE_KEY,
        'x-upsert': 'false'
    },
    body: formData
});
```

**Recomendación:** Usar **Opción 1** (SDK de Supabase) es más simple y confiable.

---

## 📋 Resumen de Código a Copiar

Para adaptar a página web o app en otro lenguaje:

```javascript
// PASO 1: Leer archivo
const base64 = await readFileAsBase64(filePath);

// PASO 2: Convertir a ArrayBuffer
const arrayBuffer = base64ToArrayBuffer(base64);

// PASO 3: Generar nombre único
const fileName = `comprobante-${saleId}-${Date.now()}-${randomString()}.jpg`;

// PASO 4: Subir
const { data, error } = await supabase.storage
    .from('uploads')
    .upload(fileName, arrayBuffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false,
    });

// PASO 5: Usar URL pública
const publicUrl = `https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/${fileName}`;
```

---

**Última actualización:** 20 de Noviembre de 2025
