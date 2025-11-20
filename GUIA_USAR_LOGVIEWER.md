# 🐛 Guía: Usar LogViewer en la App

## ¿Por qué LogViewer?

Cuando compilas APKs con GitHub Actions, **no puedes ver la consola del navegador** ni los logs de React Native. El **LogViewer** te permite ver todos los logs **directamente en la app**, incluso sin acceso a una consola.

## ✅ Cómo Acceder a LogViewer

### 1️⃣ **En la App Compilada (APK)**
- Abre la app en tu teléfono
- En la esquina **superior derecha**, verás un pequeño **🐛** (bug emoji)
- **Presiona y mantén presionado** el 🐛 por 1-2 segundos
- Se abrirá la pantalla de logs

### 2️⃣ **En desarrollo (Expo/React Native)**
- Los logs se mostrarán normalmente en la consola
- Pero también aparecerán en el LogViewer si accedes a él

## 🎯 Qué Verás en LogViewer

### Panel Principal
```
┌─────────────────────────────────┐
│ 📋 Logs de la App               │
│ 450 logs                        │
├─────────────────────────────────┤
│ Filtros: [ALL] [ERROR] [WARN]   │
│          [INFO] [DEBUG]         │
├─────────────────────────────────┤
│ [2025-11-20 15:30:45]           │
│ [ERROR] No se pudo subir archivo│
│   Connection timeout            │
│                                 │
│ [2025-11-20 15:30:30]           │
│ [INFO] Comprobante subido ✅   │
│   URL: https://...              │
└─────────────────────────────────┘
```

## 🔍 Análisis de Logs para Comprobantes

### Cuando creas una venta CON comprobante, deberías ver:

```
[INFO] 📤 [VENTA] Iniciando proceso de pago con comprobante
[INFO] ⏳ [PASO 1] Subiendo comprobante a Supabase...
[INFO] ID temporal: temp-1732073445123-abc12345

[INFO] 📤 [UPLOAD INICIO] Subiendo comprobante a Supabase Storage
[INFO] ⏰ Timestamp: 2025-11-20T15:30:45Z
[INFO] 📝 Sale ID: temp-1732073445123-abc12345
[INFO] 📁 URI Local: file://...

[INFO] ⏳ [PASO 2] Convirtiendo base64 a ArrayBuffer...
[INFO] ✅ Base64 leído: 12345 caracteres
[INFO] ✅ ArrayBuffer creado: 12345 bytes

[INFO] ⏳ [PASO 3] Subiendo archivo a Supabase Storage...
[INFO] Tamaño: 12.34 KB

[INFO] ✅ [UPLOAD EXITOSO] Comprobante subido en 2543ms
[INFO] 📤 URL Final: https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/comprobante-temp-1732073445123-abc12345-1732073447654-abcdef.jpg
```

### Si falla, verás:

```
[ERROR] ❌ [UPLOAD INICIO] Fallo después de 50ms
[ERROR] Error Type: TypeError
[ERROR] Error Message: Cannot read property 'buffer' of undefined
[ERROR] Sale ID: temp-1732073445123-abc12345
[ERROR] Local URI: file://...
```

### Cuando sincronizas (pushSales), deberías ver:

```
[INFO] 📤 [SYNC UPLOAD] Sincronizando ventas con Supabase
[INFO] ⏰ Timestamp: 2025-11-20T15:30:50Z
[INFO] 📱 Device ID: android-1732073445123-abc12345
[INFO] 📊 Ventas pendientes: 3

[INFO] 📋 Venta: local-1732073445123-xyz
[INFO]    Total: $16500
[INFO]    Método: transferencia
[INFO]    Comprobante URI: ✅ https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/comprobante-...
[INFO]    Comprobante Nombre: foto.jpg

[INFO] ⏳ Enviando RPC 'apply_sale'...
[INFO] 📎 Parámetros de comprobante:
[INFO]    - URI: https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/comprobante-...
[INFO]    - Nombre: foto.jpg

[INFO] ✅ [RPC OK] Completado en 1234ms
[INFO]    ID en Supabase: 128
[INFO]    📎 Comprobante guardado en Supabase: Sí ✅

[INFO] ✅ [SYNC UPLOAD COMPLETADO] 3456ms
[INFO] ✅ Exitosas: 3
[INFO] ❌ Errores: 0
```

## 📋 Filtros Disponibles

| Filtro | Descripción |
|--------|-------------|
| **ALL** | Mostrar todos los logs |
| **ERROR** | Solo errores (❌) |
| **WARN** | Solo advertencias (⚠️) |
| **INFO** | Solo información (ℹ️) |
| **DEBUG** | Solo debugging (🐛) |

## 📤 Exportar Logs

Si necesitas compartir los logs:

1. Abre LogViewer (presiona 🐛 largo)
2. Presiona **📤 Exportar** en la parte inferior
3. Se abrirá el menú compartir
4. Puedes enviar por email, WhatsApp, etc.

**Los logs se exportan como texto plano** con todos los detalles de timestamps.

## 🗑️ Limpiar Logs

Si tienes demasiados logs:

1. Abre LogViewer
2. Presiona **🗑️ Limpiar**
3. Confirma que quieres borrar todos los logs

**Consejo**: Limpia los logs antes de hacer una prueba importante para que sea más fácil ver solo los nuevos logs.

## 🚨 Logs Importantes a Buscar

### ✅ Todo Está Funcionando:
- `✅ [UPLOAD EXITOSO]` 
- `✅ [RPC OK]`
- `📎 Comprobante guardado en Supabase: Sí`

### ❌ Hay un Problema:
- `❌ [ERROR SUPABASE]`
- `❌ [ERROR UPLOAD]`
- `property buffer doesn't exist` (esto ya está arreglado)
- `timeout` o `Connection refused`

## 💡 Consejos

1. **Antes de hacer una prueba**, limpia los logs
2. **Después de la prueba**, exporta los logs si algo falla
3. **Busca la palabra ERROR** en rojo para encontrar problemas rápidamente
4. **Verifica las URLs** - deben empezar con `https://nuuoooqfbuwodagvmmsf.supabase.co/`

## 🔧 Estructura de un Log

Cada log tiene 4 partes:

```
[TIMESTAMP]    [LEVEL]  MESSAGE          DATA (opcional)
[15:30:45]     [ERROR]  Upload failed    {"code": 500, "msg": "..."}
```

- **TIMESTAMP**: Hora exacta (24 horas)
- **LEVEL**: ERROR, WARN, INFO, DEBUG
- **MESSAGE**: Qué pasó
- **DATA**: Información adicional (URLs, errores, etc.)

## 📞 Si Algo No Funciona

1. **Limpia logs** → 🗑️
2. **Intenta de nuevo** la operación
3. **Abre LogViewer** → 🐛 presión larga
4. **Busca ERROR en rojo**
5. **Exporta los logs** → 📤
6. **Comparte conmigo** para que diagnostique

---

**¡Ahora puedes debuggear la app sin necesidad de consola! 🎉**
