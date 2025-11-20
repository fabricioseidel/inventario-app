# 📋 CHEAT SHEET: Carga de Archivos a Supabase (1 página)

## El Método en 30 segundos

```javascript
// 1. Leer archivo → Base64
const base64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64
});

// 2. Base64 → ArrayBuffer
const buffer = base64ToArrayBuffer(base64);

// 3. Generar nombre único
const fileName = `comprobante-${id}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;

// 4. Subir
const { data, error } = await supabase.storage
    .from('uploads')
    .upload(fileName, buffer, { contentType: 'image/jpeg' });

// 5. Usar URL
const url = `https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/${fileName}`;
```

---

## Funciones Necesarias

```javascript
// Helper 1: Convertir Base64 a ArrayBuffer
const base64ToArrayBuffer = (base64String) => {
    const chars = [];
    let i = 0;
    const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    while (i < base64String.length) {
        const a = base64Chars.indexOf(base64String.charAt(i++));
        const b = base64Chars.indexOf(base64String.charAt(i++));
        const c = base64Chars.indexOf(base64String.charAt(i++));
        const d = base64Chars.indexOf(base64String.charAt(i++));
        const bitmap = (a << 18) | (b << 12) | (c << 6) | d;
        chars.push((bitmap >> 16) & 255);
        if (c != 64) chars.push((bitmap >> 8) & 255);
        if (d != 64) chars.push(bitmap & 255);
    }
    return new Uint8Array(chars).buffer;
};

// Helper 2: Generar nombre
const generateFileName = (saleId, ext = 'jpg') => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    return `comprobante-${saleId}-${timestamp}-${random}.${ext}`;
};

// Helper 3: Extraer extensión
const getExtension = (uri) => {
    if (!uri) return 'jpg';
    const match = uri.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    return match && match[1] ? match[1].toLowerCase() : 'jpg';
};

// Main: Subir archivo
async function uploadReceiptToSupabase(localUri, saleId) {
    const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64
    });
    const buffer = base64ToArrayBuffer(base64);
    const ext = getExtension(localUri);
    const fileName = generateFileName(saleId, ext);
    
    const { data, error } = await supabase.storage
        .from('uploads')
        .upload(fileName, buffer, {
            contentType: ext === 'png' ? 'image/png' : 'image/jpeg',
            cacheControl: '3600',
            upsert: false
        });
    
    if (error) throw error;
    
    return `https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/${fileName}`;
}
```

---

## Imports Necesarios

```javascript
import * as FileSystem from 'expo-file-system';
import { supabase } from '../supabaseClient';
```

---

## Uso en Pantallas

```javascript
// En SellScreen.js → pay()
const url = await uploadReceiptToSupabase(proof.uri, tempSaleId);

// En SalesHistoryScreen.js → persistProof()
const url = await uploadReceiptToSupabase(localUri, saleId);

// Después: guardar url en BD
await recordSale(cart, { transferReceiptUri: url });
```

---

## Checklist Rápido

- [ ] Bucket "uploads" existe en Supabase
- [ ] Bucket es público (Public read)
- [ ] supabaseClient.js usa SERVICE_KEY
- [ ] Archivo supabaseStorage.js existe
- [ ] Funciones importadas en pantallas
- [ ] URLs generadas: `https://...uploads/comprobante-*.jpg`
- [ ] URLs funciona en navegador

---

## Errores Comunes

| Error | Fix |
|-------|-----|
| `not a function` | Agregar `import` |
| `413 Payload Too Large` | Archivo >100MB → comprimir |
| `404 Not Found` | Verificar URL (PROJECT_ID correcto) |
| `403 Forbidden` | Usar SERVICE_KEY, no ANON_KEY |
| `400 Bad Request` | Bucket no existe → crear "uploads" |
| `undefined buffer` | Base64 inválido → verificar lectura |

---

## Métodos Alternativos (NO usar)

```javascript
// ❌ NO USAR FormData
const form = new FormData();
form.append('file', blob);
await fetch('...', { body: form });

// ❌ NO USAR fetch manual
await fetch('...', {
    method: 'PUT',
    body: file
});

// ✅ USA ESTO:
await supabase.storage.from('uploads').upload(fileName, buffer);
```

---

## En Otras Plataformas

### Web (React/Vue)
```javascript
const buffer = await file.arrayBuffer();
const { data, error } = await supabase.storage
    .from('uploads').upload(fileName, buffer, { contentType: file.type });
```

### Node.js/Express
```javascript
const buffer = req.file.buffer;
const { data, error } = await supabase.storage
    .from('uploads').upload(fileName, buffer, { contentType: file.mimetype });
```

### Python/FastAPI
```python
contents = await file.read()
response = supabase.storage.from_('uploads').upload(fileName, contents)
```

---

## Variables Necesarias

| Variable | Valor | Dónde |
|----------|-------|-------|
| `SUPABASE_URL` | `https://nuuoooqfbuwodagvmmsf.supabase.co` | supabaseClient.js |
| `SUPABASE_SERVICE_KEY` | `eyJhbGc...` | supabaseClient.js |
| `BUCKET_NAME` | `uploads` | código |
| `PROJECT_ID` | `nuuoooqfbuwodagvmmsf` | URL pública |

---

## Debugging

```javascript
// Log básicos
console.log('URI:', uri);
console.log('Base64 size:', base64.length);
console.log('Buffer size:', buffer.byteLength);
console.log('File name:', fileName);
console.log('Upload result:', data, error);
console.log('Public URL:', publicUrl);

// Test manual
curl -X PUT "https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/uploads/test.jpg" \
  -H "Authorization: Bearer SERVICE_KEY" \
  -H "Content-Type: image/jpeg" \
  --data-binary "@image.jpg"
```

---

## Pasos Resumen

```
1. Archivo local (file://...)
   ↓
2. Base64 string (iVBORw0KGgo...)
   ↓
3. ArrayBuffer (bytes binarios)
   ↓
4. supabase.storage.upload()
   ↓
5. URL pública (https://...uploads/...)
   ↓
6. Guardar en BD
```

---

**Print this page | Keep it handy | Reference always**

Última actualización: 20 de Noviembre de 2025
