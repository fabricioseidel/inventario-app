# ✅ Checklist y Troubleshooting: Carga de Archivos a Supabase

---

## 📋 Checklist de Implementación

### Fase 1: Preparación

- [ ] **Bucket creado en Supabase Storage**
  - [ ] Nombre: `uploads`
  - [ ] Acceso público: Sí
  - [ ] Sin políticas RLS restrictivas

- [ ] **Credenciales de Supabase configuradas**
  - [ ] `SUPABASE_URL` en código/env
  - [ ] `SUPABASE_SERVICE_KEY` (o ANON_KEY si es web)
  - [ ] SDK de Supabase instalado (`npm install @supabase/supabase-js`)

- [ ] **Dependencias instaladas**
  - [ ] `@supabase/supabase-js` (todas las plataformas)
  - [ ] `expo-file-system` (solo Expo/React Native)
  - [ ] Ninguna otra librería innecesaria

### Fase 2: Código Básico

- [ ] **Función `base64ToArrayBuffer()` creada**
  - [ ] Decodifica caracteres Base64
  - [ ] Retorna ArrayBuffer válido
  - [ ] Probada con ejemplos pequeños

- [ ] **Función `generateReceiptFileName()` creada**
  - [ ] Genera nombre con formato: `comprobante-{id}-{timestamp}-{random}.{ext}`
  - [ ] Garantiza unicidad con timestamp + random
  - [ ] Extensión detectada correctamente

- [ ] **Función `getFileExtension()` creada**
  - [ ] Extrae extensión de URI (jpg, png, webp, etc.)
  - [ ] Maneja URIs con parámetros query
  - [ ] Retorna 'jpg' como fallback

- [ ] **Función `uploadReceiptToSupabase()` creada**
  - [ ] Lee archivo como Base64 correctamente
  - [ ] Convierte Base64 a ArrayBuffer
  - [ ] Llama a `supabase.storage.from('uploads').upload()`
  - [ ] Construye URL pública correctamente
  - [ ] Maneja errores apropiadamente

### Fase 3: Integración en Pantallas

- [ ] **SellScreen.js**
  - [ ] Importa `uploadReceiptToSupabase`
  - [ ] Llama en función `pay()`
  - [ ] Pasa `proof.uri` y `tempSaleId` correctamente
  - [ ] Maneja error si falla la carga
  - [ ] Guarda URL en `recordSale()`

- [ ] **SalesHistoryScreen.js**
  - [ ] Importa `uploadReceiptToSupabase`
  - [ ] Llama en función `persistProof()`
  - [ ] Verifica que sea archivo local antes de subir
  - [ ] Actualiza BD con URL pública
  - [ ] Maneja caso de URL ya existente

### Fase 4: Pruebas

- [ ] **Prueba con archivo pequeño (<1MB)**
  - [ ] Seleccionar imagen pequeña
  - [ ] Verificar que se sube correctamente
  - [ ] Verificar que URL es válida
  - [ ] Verificar que URL es accesible en navegador

- [ ] **Prueba con archivo grande (5-10MB)**
  - [ ] Seleccionar imagen grande
  - [ ] Verificar que se sube (puede ser lenta)
  - [ ] Verificar que no hay timeout
  - [ ] Verificar que URL funciona

- [ ] **Prueba de URL pública**
  - [ ] Copiar URL generada
  - [ ] Abrir en navegador (debe mostrar imagen)
  - [ ] Probar sin autenticación
  - [ ] Probar con VPN desactivada

- [ ] **Prueba de persistencia en BD**
  - [ ] Verificar que URL se guardó en `transfer_receipt_uri`
  - [ ] Cerrar y abrir app
  - [ ] Verificar que URL permanece igual
  - [ ] Verificar que imagen aún es accesible

- [ ] **Prueba de error handling**
  - [ ] Desactivar red WiFi
  - [ ] Intentar subir → debe fallar con mensaje claro
  - [ ] Reactivar red
  - [ ] Intentar de nuevo → debe funcionar

### Fase 5: Optimización

- [ ] **Logging**
  - [ ] Agregar `console.log()` en puntos clave
  - [ ] Mostrar tamaño de archivo
  - [ ] Mostrar tiempo de carga
  - [ ] Mostrar URL final

- [ ] **Performance**
  - [ ] Verificar que no se congela UI durante carga
  - [ ] Considerar indicador de progreso
  - [ ] Considerar compresión de imagen antes de subir

- [ ] **Seguridad**
  - [ ] Verificar permisos de archivo
  - [ ] Validar tipo MIME
  - [ ] Validar tamaño máximo
  - [ ] Verificar que URL es pública pero segura

---

## 🐛 Troubleshooting

### ❌ Problema 1: "uploadReceiptToSupabase is not a function"

**Síntomas:**
```
Error: uploadReceiptToSupabase is not a function at SellScreen.js:...
```

**Causas posibles:**
1. No importada la función
2. Nombre de función mal escrito
3. Archivo `supabaseStorage.js` no existe

**Solución:**
```javascript
// ✅ Verificar import en SellScreen.js
import { uploadReceiptToSupabase } from '../utils/supabaseStorage';

// ✅ Verificar que en supabaseStorage.js existe:
export async function uploadReceiptToSupabase(localUri, saleId) {
    // ...
}

// ❌ No:
// function uploadReceiptToSupabase() { ... }  // Sin export
```

---

### ❌ Problema 2: "ArrayBuffer conversion error"

**Síntomas:**
```
Error: Cannot read property 'indexOf' of undefined in base64ToArrayBuffer
```

**Causas posibles:**
1. Base64 string vacío o inválido
2. Función `base64ToArrayBuffer()` mal implementada
3. Encoding no es Base64

**Solución:**
```javascript
// ✅ Verificar que base64 es válido
const base64 = await FileSystem.readAsStringAsync(localUri, {
    encoding: FileSystem.EncodingType.Base64,  // ← Debe ser así
});

// ✅ Log para debugging
console.log('Base64 length:', base64.length);
console.log('Base64 sample:', base64.substring(0, 50));

// ✅ Función correcta:
const base64ToArrayBuffer = (base64String) => {
    if (!base64String || base64String.length === 0) {
        throw new Error('Base64 string is empty');
    }
    const chars = [];
    // ... resto del código
    return new Uint8Array(chars).buffer;
};
```

---

### ❌ Problema 3: "Error: Error al subir archivo: 400 Bad Request"

**Síntomas:**
```
Error: Error al subir archivo: 400 Bad Request
```

**Causas posibles:**
1. Bucket no existe
2. Bucket se llama diferente (no es "uploads")
3. No tiene permiso de lectura pública
4. Tipo MIME incorrecto

**Solución:**
```javascript
// ✅ Verificar nombre del bucket
const { data, error } = await supabase.storage
    .from('uploads')  // ← Debe existir en Supabase Dashboard
    .upload(fileName, buffer, {
        contentType: 'image/jpeg',
    });

// ✅ En Supabase Dashboard:
// Storage → Buckets → Nombre debe ser "uploads"
// Bucket debe tener acceso público

// ✅ Si el bucket no existe, crear:
// Storage → New Bucket → Nombre: "uploads" → Public
```

---

### ❌ Problema 4: "Error: Error al subir archivo: 413 Payload Too Large"

**Síntomas:**
```
Error: Error al subir archivo: 413 Payload Too Large
```

**Causas posibles:**
1. Archivo muy grande (>100MB)
2. Límite configurado en Supabase

**Solución:**
```javascript
// ✅ Comprimir imagen antes de subir
import * as ImageManipulator from 'expo-image-manipulator';

const compressImage = async (uri) => {
    const compressed = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 1080, height: 1440 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
    );
    return compressed.uri;
};

// ✅ Usar en uploadReceiptToSupabase:
const compressedUri = await compressImage(localUri);
const base64 = await FileSystem.readAsStringAsync(compressedUri, {
    encoding: FileSystem.EncodingType.Base64,
});

// ✅ O validar antes:
const fileInfo = await FileSystem.getInfoAsync(localUri);
if (fileInfo.size > 50 * 1024 * 1024) {  // 50MB
    throw new Error('Archivo demasiado grande (máximo 50MB)');
}
```

---

### ❌ Problema 5: "URL retornada no funciona"

**Síntomas:**
```
- URL generada: https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/...jpg
- Al abrir en navegador: 404 Not Found
```

**Causas posibles:**
1. URL mal construida (typo en PROJECT_ID)
2. Nombre de archivo no coincide con subido
3. Bucket no es público

**Solución:**
```javascript
// ✅ Verificar URL
// Debe ser exactamente:
// https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/{fileName}

// ✅ Verificar PROJECT_ID es correcto:
// Dashboard → Project Settings → Project ID: "nuuoooqfbuwodagvmmsf"

// ✅ Log para debugging:
console.log('Archivo subido:', data?.name);
console.log('URL pública:', publicUrl);

// ✅ Test manual en Supabase Dashboard:
// Storage → uploads → [Ver si el archivo está]
// Click en archivo → Copy public URL

// ✅ Si bucket no es público:
// Storage → uploads → Click gear → Make public
```

---

### ❌ Problema 6: "Permission denied" o "Unauthorized"

**Síntomas:**
```
Error: Error al subir archivo: 403 Forbidden
```

**Causas posibles:**
1. Usando ANON_KEY en lugar de SERVICE_KEY
2. RLS policies bloqueando upload
3. Clave de API expirada

**Solución:**
```javascript
// ✅ Usar SERVICE_KEY (no ANON_KEY) en app móvil
import { supabase } from '../supabaseClient';

// supabaseClient.js debe tener:
export const supabase = createClient(
    SUPABASE_URL,
    SUPABASE_SERVICE_KEY,  // ← Service key, no anon
    { auth: { persistSession: false } }
);

// ✅ En Supabase Dashboard:
// Settings → API Settings → Copy Service Key (no Anon Key)

// ✅ Para página web pública, usar ANON_KEY con RLS:
// Storage → uploads → Policies → Public read, authenticated write
```

---

### ❌ Problema 7: "La app se congela durante carga"

**Síntomas:**
- UI bloqueada mientras se sube
- No hay respuesta a toques
- Sin indicador de progreso

**Solución:**
```javascript
// ✅ La carga ya es asincrónica, pero agregar feedback

export async function uploadReceiptToSupabase(localUri, saleId, onProgress) {
    try {
        // Mostrar loading
        setLoading(true);
        
        // ... leer, convertir, etc ...
        
        // Subir
        const { data, error } = await supabase.storage
            .from('uploads')
            .upload(fileName, buffer, { /* ... */ });
        
        setLoading(false);
        return publicUrl;
    } catch (error) {
        setLoading(false);
        throw error;
    }
}

// ✅ En SellScreen.js:
const [loading, setLoading] = useState(false);

<TouchableOpacity 
    onPress={async () => {
        setLoading(true);
        try {
            receiptUrl = await uploadReceiptToSupabase(proof.uri, tempSaleId);
        } finally {
            setLoading(false);
        }
    }}
    disabled={loading}
>
    <Text>{loading ? 'Subiendo...' : 'Confirmar Pago'}</Text>
</TouchableOpacity>
```

---

### ❌ Problema 8: "Function no está async"

**Síntomas:**
```
SyntaxError: await is only valid in async function
```

**Solución:**
```javascript
// ❌ Incorrecto:
function pay() {
    const url = await uploadReceiptToSupabase(proof.uri, saleId);  // Error!
}

// ✅ Correcto:
async function pay() {
    const url = await uploadReceiptToSupabase(proof.uri, saleId);  // OK
}

// ✅ O en arrow function:
const pay = async () => {
    const url = await uploadReceiptToSupabase(proof.uri, saleId);
};

// ✅ O con .then():
pay() {
    uploadReceiptToSupabase(proof.uri, saleId)
        .then(url => {
            // usar url
        })
        .catch(error => console.error(error));
}
```

---

### ❌ Problema 9: "No puedo acceder a la URL desde otro dispositivo"

**Síntomas:**
```
URL funciona en desarrollo
URL no funciona desde otro WiFi/dispositivo
```

**Causas posibles:**
1. URL es localhost (no es pública)
2. Bucket no está realmente público
3. Firewall bloqueando

**Solución:**
```javascript
// ✅ Verificar que URL es pública:
// https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/...

// ✅ NO debería ser:
// http://localhost:...
// file:///storage/...
// http://192.168.1.x:...

// ✅ Probar desde:
// - Otro dispositivo en mismo WiFi
// - Red móvil (LTE/5G)
// - Aplicación como Postman
// - curl: curl "https://...uploads/comprobante-123.jpg"

// ✅ Si sigue sin funcionar:
// 1. Verificar bucket es público en Dashboard
// 2. Verificar PROJECT_ID es correcto
// 3. Verificar nombre de archivo es exacto
```

---

### ❌ Problema 10: "La BD se actualiza pero no veo cambios"

**Síntomas:**
```
- URL se guarda en BD (verificado en DB)
- Pero en pantalla no aparece
- O aparece pero no se actualiza
```

**Solución:**
```javascript
// ✅ Después de guardar URL, actualizar state:
async function persistProof(localUri, displayName) {
    const uploadedUrl = await uploadReceiptToSupabase(localUri, detail.sale.id);
    
    // 1. Actualizar BD local
    await updateSaleTransferReceipt(detail.sale.id, uploadedUrl, displayName);
    
    // 2. Actualizar state local (IMPORTANTE)
    const updated = await getSaleWithItems(detail.sale.id);
    setDetail(updated);  // ← Re-fetch de BD
    
    // 3. Actualizar lista
    setSales(prev =>
        prev.map(s =>
            s.id === detail.sale.id 
                ? { ...s, transfer_receipt_uri: uploadedUrl } 
                : s
        )
    );
}

// ✅ O usar onSuccess callback en Supabase:
supabase
    .from('sales')
    .on('UPDATE', payload => {
        if (payload.new.id === detail.sale.id) {
            setDetail(payload.new);
        }
    })
    .subscribe();
```

---

## 📞 Support

Si ninguna solución funciona:

1. **Revisar logs completos**
   ```javascript
   console.log('Local URI:', localUri);
   console.log('Base64 size:', base64.length);
   console.log('Buffer size:', buffer.byteLength);
   console.log('File name:', fileName);
   console.log('Upload response:', data, error);
   ```

2. **Verificar en Supabase Dashboard**
   - Storage → uploads → Ver archivos subidos
   - Storage → uploads → Click en archivo → Ver detalles

3. **Probar manualmente con API**
   ```bash
   curl -X PUT "https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/uploads/test.jpg" \
     -H "Authorization: Bearer SERVICE_KEY" \
     -H "Content-Type: image/jpeg" \
     --data-binary "@/path/to/image.jpg"
   ```

4. **Contactar Supabase support**
   - https://supabase.com/docs/support
   - Dashboard → Support → Nueva pregunta

---

**Última actualización:** 20 de Noviembre de 2025
