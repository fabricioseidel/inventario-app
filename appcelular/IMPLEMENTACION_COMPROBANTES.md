# 📋 SOLUCIÓN IMPLEMENTADA: Carga de Comprobantes desde App Móvil

## 🎯 Problema Identificado
Las ventas realizadas desde la app del teléfono **NO estaban subiendo imágenes/comprobantes** a Supabase Storage. Aunque la app tenía la interfaz para adjuntar fotos, estas **nunca se sincronizaban**.

## ✅ Solución Implementada

### 1️⃣ **Creación de función `uploadReceiptToSupabase()`**
- **Archivo**: `src/utils/supabaseStorage.js` (ya existía)
- **Función**: Sube archivos locales a Supabase Storage bucket `uploads`
- **Retorna**: URL pública del archivo subido

### 2️⃣ **Modificación de SellScreen.js**
**Cambios:**
- ✅ Importar `uploadReceiptToSupabase` 
- ✅ Modificar función `pay()` para:
  - Detectar si hay comprobante de imagen
  - Subir la imagen a Supabase ANTES de registrar la venta
  - Guardar la URL pública (no la ruta local)
  - Manejar errores gracefully

**Flujo anterior:**
```
Foto tomada → Guardada localmente → Ruta local enviada a Supabase
❌ Supabase recibe ruta local que no existe en su servidor
```

**Flujo nuevo:**
```
Foto tomada → Guardada localmente → Subida a Supabase Storage → 
URL pública obtenida → Enviada a tabla sales
✅ Ahora funciona correctamente
```

### 3️⃣ **Modificación de sync.js**
**Cambios en `pushSales()`:**
- ✅ Agregar `p_transfer_receipt_uri` al payload
- ✅ Agregar `p_transfer_receipt_name` al payload

Esto asegura que cuando se sincronizan las ventas, se envían las URLs públicas de Supabase.

### 4️⃣ **Actualización de RPC `apply_sale` en Supabase**
**Pendiente ejecutar en Supabase SQL Editor:**

```sql
-- Ver archivo: SQL_UPDATE_APPLY_SALE_WITH_RECEIPTS.sql
```

**Lo que hace:**
- Acepta nuevos parámetros: `p_transfer_receipt_uri` y `p_transfer_receipt_name`
- Guarda la URL en la columna `transfer_receipt_uri`
- Guarda el nombre en la columna `transfer_receipt_name`

## 📝 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `src/screens/SellScreen.js` | Agregó importación y lógica de upload |
| `src/sync.js` | Agregó parámetros de comprobante |
| `SQL_UPDATE_APPLY_SALE_WITH_RECEIPTS.sql` | Script para ejecutar en Supabase |

## 🚀 PASOS PARA COMPLETAR LA IMPLEMENTACIÓN

### Paso 1: Ejecutar Script SQL en Supabase
1. Abre la consola SQL de Supabase (https://app.supabase.com)
2. Abre el archivo `SQL_UPDATE_APPLY_SALE_WITH_RECEIPTS.sql`
3. Copia TODO el contenido
4. Pégalo en el SQL Editor de Supabase
5. Presiona "Run" o Ctrl+Enter

### Paso 2: Compilar y Ejecutar la App
```bash
npm start
# o
expo start --dev-client
```

### Paso 3: Testear el Flujo Completo

1. **Crear una venta con comprobante:**
   - Abre la app móvil
   - Escanea/agrega productos
   - Selecciona método de pago: **"transferencia"**
   - Captura o selecciona una foto del comprobante
   - Presiona "Pagar y registrar"

2. **Verificar que todo funciona:**
   - ✅ La foto se sube a Supabase Storage
   - ✅ La venta se registra localmente
   - ✅ La venta se sincroniza a Supabase
   - ✅ Verifica en la BD que `transfer_receipt_uri` tiene URL pública
   - ✅ Abre la URL en el navegador para confirmar que la imagen existe

3. **Verificar en la página web:**
   - Las imágenes ahora deberían aparecer automáticamente
   - No necesitas agregar manualmente los comprobantes

## 📊 Validación en Supabase SQL

Después de hacer una venta con comprobante, ejecuta esta consulta:

```sql
SELECT 
  id,
  ts,
  total,
  payment_method,
  device_id,
  transfer_receipt_uri,
  transfer_receipt_name
FROM sales
WHERE transfer_receipt_uri IS NOT NULL
ORDER BY ts DESC
LIMIT 5;
```

Deberías ver:
- `transfer_receipt_uri`: URL como `https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/comprobante-...`
- `transfer_receipt_name`: Nombre del archivo

## 🔧 Resolución de Problemas

### Las imágenes siguen siendo NULL
- Verifica que ejecutaste el script SQL completo
- Verifica que la función `apply_sale` acepta los nuevos parámetros
- Revisa los logs de la app (console.log muestra el estado del upload)

### Error al subir imágenes desde la app
- Verifica que el bucket `uploads` existe en Supabase Storage
- Verifica que las políticas RLS permiten uploads
- Revisa los logs en la consola del navegador

### Las imágenes no se muestran en la web
- Verifica que las URLs son públicas
- Verifica que el archivo existe en Supabase Storage
- Intenta abrir la URL directamente en el navegador

## 📈 Métricas de Éxito

Cuando todo esté funcionando:
- ✅ Las ventas desde el teléfono tienen comprobantes
- ✅ Las imágenes se sincronizan automáticamente
- ✅ La web muestra los comprobantes sin acciones manuales
- ✅ Las URLs son públicas y persistentes

---

**Fecha de implementación**: 20-11-2025  
**Estado**: ✅ Código implementado, pendiente ejecutar SQL en Supabase
