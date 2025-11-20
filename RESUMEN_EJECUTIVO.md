# 🎯 RESUMEN EJECUTIVO: Carga de Archivos a Supabase

**Tiempo de lectura:** 5 minutos

---

## ¿Qué necesitas saber?

### 📌 En una frase
La app móvil carga imágenes a **Supabase Storage** usando **ArrayBuffer** (no FormData), genera una URL pública y la guarda en la base de datos.

---

## 🔑 5 Pasos Clave

```javascript
// 1️⃣ Leer archivo como Base64
const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,
});

// 2️⃣ Convertir Base64 a ArrayBuffer (decodificación manual)
const buffer = base64ToArrayBuffer(base64);

// 3️⃣ Generar nombre único
const fileName = `comprobante-${saleId}-${Date.now()}-${random}.jpg`;

// 4️⃣ Subir usando Supabase SDK
const { data, error } = await supabase.storage
    .from('uploads')
    .upload(fileName, buffer, { contentType: 'image/jpeg' });

// 5️⃣ Usar URL pública
const publicUrl = `https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/${fileName}`;
```

---

## 📁 Archivo Principal

**`src/utils/supabaseStorage.js`**

Contiene:
- `uploadReceiptToSupabase(localUri, saleId)` - Función principal
- `base64ToArrayBuffer(base64String)` - Convierte Base64 a ArrayBuffer
- `generateReceiptFileName(saleId, extension)` - Genera nombre único
- `getFileExtension(uri)` - Extrae extensión del archivo

**Tamaño:** ~150 líneas de código bien comentado

---

## 🌍 Dónde se usa

| Pantalla | Función | Cuándo |
|----------|---------|--------|
| **SellScreen.js** | `pay()` | Al confirmar pago por transferencia |
| **SalesHistoryScreen.js** | `persistProof()` | Al agregar comprobante después de venta |

---

## ❓ Preguntas Frecuentes

### **P1: ¿Por qué ArrayBuffer y no FormData?**
R: ArrayBuffer es más eficiente. FormData es para HTML forms (más pesado). El SDK de Supabase prefiere ArrayBuffer y maneja todo automáticamente.

### **P2: ¿Qué pasa si la imagen es muy grande?**
R: Si es >100MB, Supabase rechaza. Solución: comprimir imagen antes con `expo-image-manipulator`.

### **P3: ¿La URL es segura?**
R: Sí. Es pública pero única (con timestamp + random). Solo quien tenga la URL puede verla.

### **P4: ¿Funciona sin internet?**
R: No. La carga requiere conexión HTTP a Supabase. Sin internet, la función falla con error.

### **P5: ¿Puedo usar con otra plataforma web?**
R: Sí. El método es el mismo: `file.arrayBuffer()` en navegador → `supabase.storage.upload()`.

---

## 🚀 Para Implementar en Otro Lado

### Página Web (React/Vue)
```javascript
const file = inputElement.files[0];
const buffer = await file.arrayBuffer();

const { data, error } = await supabase.storage
    .from('uploads')
    .upload(fileName, buffer, { contentType: file.type });
```

### Backend (Node.js)
```javascript
const buffer = await fs.readFileAsync(filePath);

const { data, error } = await supabase.storage
    .from('uploads')
    .upload(fileName, buffer, { contentType: 'image/jpeg' });
```

### Python
```python
with open(filePath, 'rb') as f:
    buffer = f.read()

response = supabase.storage.from_('uploads').upload(fileName, buffer)
```

**Concepto igual, sintaxis diferente.**

---

## ⚠️ Errores Comunes

| Error | Causa | Fix |
|-------|-------|-----|
| `not a function` | No importada la función | Agregar `import` |
| `413 Payload Too Large` | Archivo >100MB | Comprimir imagen |
| `404 Not Found` | URL mal construida | Verificar PROJECT_ID |
| `403 Forbidden` | Usando ANON_KEY | Usar SERVICE_KEY |
| `400 Bad Request` | Bucket no existe | Crear bucket "uploads" |

---

## 📊 Arquitectura General

```
Usuario selecciona imagen
    ↓
FileSystem.readAsStringAsync() → Base64
    ↓
base64ToArrayBuffer() → ArrayBuffer (3MB)
    ↓
supabase.storage.from('uploads').upload()
    ↓
[HTTP PUT a Supabase]
    ↓
Supabase guarda archivo
    ↓
Retorna nombre del archivo
    ↓
Construir URL pública
    ↓
Guardar URL en BD
    ↓
URL accesible desde cualquier navegador
```

---

## 🔐 Configuración Necesaria

```javascript
// supabaseClient.js
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
    'https://nuuoooqfbuwodagvmmsf.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'  // SERVICE_KEY
);

// supabaseStorage.js
import { supabase } from '../supabaseClient';
```

**Bucket:** `uploads` (público, sin RLS)
**Ruta:** `/uploads/comprobante-{id}-{timestamp}-{random}.{ext}`

---

## ✅ Checklist Rápido

- [ ] Bucket "uploads" existe y es público
- [ ] `supabaseClient.js` exporta `supabase` con SERVICE_KEY
- [ ] `supabaseStorage.js` existe con 4 funciones
- [ ] `SellScreen.js` importa y usa `uploadReceiptToSupabase()`
- [ ] `SalesHistoryScreen.js` importa y usa `uploadReceiptToSupabase()`
- [ ] URLs generadas se ven así: `https://...uploads/comprobante-...jpg`
- [ ] URLs son accesibles en navegador sin autenticación
- [ ] URLs se guardan en BD en columna `transfer_receipt_uri`

---

## 📄 Documentos Relacionados

1. **CODIGO_CARGA_SUPABASE.md** - Explicación detallada paso a paso
2. **SUPABASE_STORAGE_CODIGO_EXACTO.js** - Código completo con comentarios
3. **RESUMEN_VISUAL_CARGA_ARCHIVOS.md** - Diagramas y tablas
4. **IMPLEMENTAR_EN_OTRAS_PLATAFORMAS.md** - Ejemplos para web, .NET, Go, etc.
5. **CHECKLIST_TROUBLESHOOTING.md** - Solución de problemas
6. **RESUMEN_EJECUTIVO.md** - Este documento

---

## 🎯 Lo Más Importante

```
┌─────────────────────────────────────────────────┐
│  Base64 (string)                                │
│  ↓                                              │
│  ArrayBuffer (bytes)                            │
│  ↓                                              │
│  supabase.storage.upload(fileName, arrayBuffer)│
│  ↓                                              │
│  URL pública: https://...uploads/...jpg        │
│  ↓                                              │
│  Guardar en BD                                  │
└─────────────────────────────────────────────────┘

NO:
- FormData
- fetch() manual
- Multipart/form-data
- ANON_KEY

SÍ:
- ArrayBuffer
- SDK .upload()
- SERVICE_KEY
- URL pública
```

---

## 💡 Consejo Final

Si necesitas usar esto en **otra aplicación/plataforma:**
1. Lee el archivo `IMPLEMENTAR_EN_OTRAS_PLATAFORMAS.md`
2. Adapta el paso 1 (lectura de archivo) al lenguaje
3. Mantén los pasos 2-5 iguales
4. Listo.

El SDK de Supabase existe para casi todos los lenguajes, y el concepto es idéntico.

---

**Creado:** 20 de Noviembre de 2025  
**Última actualización:** 20 de Noviembre de 2025  
**Versión:** 1.0 Final
