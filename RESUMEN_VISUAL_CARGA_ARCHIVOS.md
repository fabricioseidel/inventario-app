# 🚀 RESUMEN VISUAL: Carga de Archivos a Supabase Storage

## 📋 Tabla Comparativa

| Aspecto | App Móvil (React Native) | Página Web (Alternativa) |
|--------|--------------------------|-------------------------|
| **Lectura de archivo** | `FileSystem.readAsStringAsync(uri, {encoding: Base64})` | `File.arrayBuffer()` o `FileReader` |
| **Formato de datos** | Base64 string → ArrayBuffer | ArrayBuffer directamente |
| **Método de carga** | `supabase.storage.from('bucket').upload(file, buffer)` | `supabase.storage.from('bucket').upload(file, buffer)` |
| **Tipo de contenido** | `contentType: 'image/jpeg'` | `contentType: 'image/jpeg'` |
| **Usa FormData** | ❌ No | ❌ No (usa ArrayBuffer) |
| **Usa fetch() manual** | ❌ No (usa SDK) | ❌ No (usa SDK) |
| **URL pública** | Construida manualmente | Construida manualmente |

---

## 🔄 Flujo Visual Paso a Paso

```
┌─────────────────────────────────────────────────────────────────┐
│                    INICIO: USUARIO SELECCIONA IMAGEN             │
│                    (SellScreen.js o SalesHistoryScreen.js)       │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│          PASO 1: FileSystem.readAsStringAsync()                  │
│                                                                   │
│  Entrada:  file:///storage/emulated/0/Documents/image.jpg       │
│  Procesa:  Lee bytes del archivo                                │
│  Salida:   "iVBORw0KGgoAAAANSUhEUgAAAAUA..." (Base64 string)  │
│  Tamaño:   3MB de archivo → 4MB de Base64                        │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│          PASO 2: base64ToArrayBuffer()                           │
│                                                                   │
│  Entrada:  "iVBORw0KGgoAAAANSUhEUgAAAAUA..." (string)          │
│  Procesa:  Decodifica 4 chars Base64 → 3 bytes                  │
│  Salida:   ArrayBuffer (datos binarios puros)                    │
│  Tamaño:   4MB Base64 → 3MB ArrayBuffer                          │
│                                                                   │
│  Algoritmo:                                                      │
│    1. Toma 4 caracteres Base64: "iVBO"                          │
│    2. Convierte a valores 0-63: [8, 21, 1, 14]                 │
│    3. Combina bits: (8<<18) | (21<<12) | (1<<6) | 14            │
│    4. Extrae 3 bytes: [137, 80, 78] (0x89, 0x50, 0x4E)         │
│    5. Repite para todos los caracteres                           │
│    6. Retorna Uint8Array(bytes).buffer                           │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│          PASO 3: Generar nombre único                            │
│                                                                   │
│  Función: generateReceiptFileName(saleId, extension)            │
│  Formato:  comprobante-{saleId}-{timestamp}-{random}.{ext}      │
│  Ejemplo:  comprobante-123-1731234567890-a1b2c3d4.jpg           │
│                                                                   │
│  Garantías:                                                      │
│    - Timestamp: Único por milisegundo                            │
│    - Random: 8 caracteres aleatorios                             │
│    - Resultado: Imposible duplicado en años                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│          PASO 4: supabase.storage.upload()                       │
│                                                                   │
│  const { data, error } = await supabase.storage                 │
│      .from('uploads')                    ← Bucket name           │
│      .upload(fileName, buffer, {                                │
│          contentType: 'image/jpeg',      ← MIME type            │
│          cacheControl: '3600',           ← Cache 1 hora         │
│          upsert: false                   ← No sobrescribir      │
│      });                                                         │
│                                                                   │
│  Parámetro clave: buffer = ArrayBuffer                           │
│                  (NO FormData)                                   │
│                                                                   │
│  Qué envía internamente:                                         │
│    - Content-Type: image/jpeg (en headers)                       │
│    - Body: bytes binarios puros del ArrayBuffer                 │
│    - No multipart/form-data                                      │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                    [PETICIÓN HTTP PUT]
┌─────────────────────────────────────────────────────────────────┐
│  PUT https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/      │
│      object/uploads/comprobante-123-1731234567890-a1b2c3d4.jpg  │
│                                                                   │
│  Headers:                                                        │
│    Content-Type: image/jpeg                                      │
│    Authorization: Bearer {SUPABASE_SERVICE_KEY}                  │
│    Cache-Control: max-age=3600                                   │
│    x-upsert: false                                               │
│                                                                   │
│  Body: <3MB de datos binarios puros>                             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
                  [RESPUESTA DE SUPABASE]
┌─────────────────────────────────────────────────────────────────┐
│  HTTP 200 OK                                                     │
│                                                                   │
│  Response:                                                       │
│  {                                                               │
│    "name": "comprobante-123-1731234567890-a1b2c3d4.jpg",       │
│    "id": "...",                                                  │
│    "updated_at": "2025-11-20T...",                               │
│    "created_at": "2025-11-20T...",                               │
│    "last_accessed_at": null,                                     │
│    "metadata": {                                                 │
│      "size": 3145728,                                            │
│      "mimetype": "image/jpeg"                                    │
│    }                                                             │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│          PASO 5: Construir URL pública                           │
│                                                                   │
│  Patrón: https://{PROJECT_ID}.supabase.co/storage/v1/          │
│          object/public/{bucket}/{fileName}                       │
│                                                                   │
│  Resultado:                                                      │
│  https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/          │
│  object/public/uploads/comprobante-123-1731234567890-a1b2c3d4.jpg│
│                                                                   │
│  Función:                                                        │
│  const publicUrl = `https://nuuoooqfbuwodagvmmsf.supabase.co/   │
│      storage/v1/object/public/uploads/${fileName}`;             │
└─────────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────────┐
│              FIN: Guardar URL en Base de Datos                   │
│                                                                   │
│  await recordSale(cart, {                                        │
│      paymentMethod: 'transferencia',                            │
│      transferReceiptUri: publicUrl,    ← URL guardada           │
│      transferReceiptName: 'image.jpg'                           │
│  });                                                             │
│                                                                   │
│  La URL puede ser:                                               │
│    - Descargada por otros dispositivos                           │
│    - Mostrada en la app                                          │
│    - Compartida en reportes                                      │
│    - Accedida sin autenticación (es pública)                    │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎯 Puntos Clave

### **¿Qué es el ArrayBuffer?**
- Representación binaria pura de los datos
- 3 MB de imagen → 3 MB de ArrayBuffer (sin overhead)
- Base64 (texto) → ArrayBuffer (binario)
- Formato que Supabase SDK entiende nativamente

### **¿Por qué no FormData?**
- FormData es para multipart/form-data (más lento)
- Supabase SDK maneja esto automáticamente con ArrayBuffer
- ArrayBuffer es directo y eficiente

### **¿Por qué no fetch() manual?**
```javascript
// ❌ Forma complicada (sin SDK):
const response = await fetch('...', {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: arrayBuffer
});

// ✅ Forma simple (con SDK):
const { data, error } = await supabase.storage
    .from('uploads')
    .upload(fileName, arrayBuffer, { contentType: 'image/jpeg' });
```

---

## 📊 Tamaños de Datos

| Etapa | Formato | Tamaño (ejemplo archivo 3MB) |
|-------|---------|------------------------------|
| Archivo original | .jpg | 3.0 MB |
| Leído como Base64 | string | 4.0 MB |
| Como ArrayBuffer | binary | 3.0 MB |
| Enviado a Supabase | binary | 3.0 MB |
| Guardado en Storage | binary | 3.0 MB |

---

## 🔐 Seguridad

| Componente | Dato | Privacidad |
|-----------|------|-----------|
| **URI local** | `file:///storage/emulated/.../image.jpg` | Solo en dispositivo |
| **Base64 string** | `iVBORw0KGg...` | En memoria durante carga |
| **ArrayBuffer** | bytes binarios | En memoria durante carga |
| **URL pública** | `https://.../uploads/comprobante-123-...jpg` | Pública (sin autenticación) |

**Nota:** Los 3 primeros son temporales, la URL pública es la que se guarda en BD.

---

## 🎓 Ejemplo Paso a Paso en Código

```javascript
// 1. Usuario selecciona imagen
const imageUri = 'file:///storage/emulated/0/DCIM/image.jpg';

// 2. Leer como Base64
const base64 = await FileSystem.readAsStringAsync(imageUri, {
    encoding: FileSystem.EncodingType.Base64
});
// base64 ahora es: "iVBORw0KGgoAAAANSUhEUg..." (4MB string)

// 3. Convertir a ArrayBuffer (omitido para brevedad, ver código completo)
const buffer = base64ToArrayBuffer(base64);
// buffer ahora es: Uint8Array([137, 80, 78, 71, ...]).buffer (3MB binary)

// 4. Generar nombre
const fileName = generateReceiptFileName('sale-123', 'jpg');
// fileName = "comprobante-sale-123-1731234567890-a1b2c3d4.jpg"

// 5. Subir a Supabase
const { data, error } = await supabase.storage
    .from('uploads')
    .upload(fileName, buffer, {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: false
    });

// 6. Construir URL
const publicUrl = `https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/${fileName}`;
// publicUrl = "https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/comprobante-sale-123-1731234567890-a1b2c3d4.jpg"

// 7. Guardar en BD
await recordSale(cart, {
    paymentMethod: 'transferencia',
    transferReceiptUri: publicUrl  // ← Esta URL se guarda
});
```

---

## 💾 Datos en Supabase

### Base de Datos (sales table)
```
id    | transfer_receipt_uri                                              | transfer_receipt_name
------|-------------------------------------------------------------------|-----------------------
123   | https://...uploads/comprobante-123-1731234567890-a1b2c3d4.jpg   | image.jpg
124   | https://...uploads/comprobante-124-1731234568000-b2c3d4e5.jpg   | foto.jpg
```

### Storage (uploads bucket)
```
/uploads/
  ├── comprobante-123-1731234567890-a1b2c3d4.jpg (3.0 MB)
  ├── comprobante-124-1731234568000-b2c3d4e5.jpg (2.5 MB)
  └── comprobante-125-1731234568100-c3d4e5f6.jpg (3.2 MB)
```

---

## 🚦 Estados y Errores

| Paso | Éxito | Error | Acción |
|------|-------|-------|--------|
| Leer archivo | Base64 obtenido | IOException | Archivo no encontrado |
| Convertir a ArrayBuffer | Buffer creado | (raro) | Archivo corrupto |
| Generar nombre | Nombre único | (imposible) | - |
| Subir a Supabase | data ≠ null | error ≠ null | Quota excedida, sin conexión |
| Construir URL | URL válida | - | Usar patrón URL |
| Guardar en BD | Éxito | Error BD | Reintentar |

---

## ✅ Checklist de Implementación

- [ ] Importar `FileSystem` de `expo-file-system`
- [ ] Importar `supabase` de `../supabaseClient`
- [ ] Crear función `base64ToArrayBuffer()`
- [ ] Crear función `generateReceiptFileName()`
- [ ] Crear función `getFileExtension()`
- [ ] Crear función `uploadReceiptToSupabase()`
- [ ] Importar en `SellScreen.js`
- [ ] Llamar en función `pay()`
- [ ] Importar en `SalesHistoryScreen.js`
- [ ] Llamar en función `persistProof()`
- [ ] Probar con una imagen pequeña (<1MB)
- [ ] Probar con una imagen grande (>5MB)
- [ ] Verificar URL pública en navegador
- [ ] Guardar URL correctamente en BD

---

**Última actualización:** 20 de Noviembre de 2025
