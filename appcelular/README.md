# 📱 Inventario App - Sistema de Ventas## Inventario Móvil (Barcode / SQLite)



## 📋 DescripciónVersión limpia y mínima enfocada en:

Aplicación móvil para gestión de inventario y ventas con escaneo de códigos de barras, gestión de caja, historial de ventas y reportes.1. Escanear código de barras (solo lectura).

2. CRUD de productos (SQLite local).

## ✨ Funcionalidades3. Categorías simples administradas localmente.

4. Exportación CSV y JSON.

### 🔐 Autenticación5. Registro de errores visible dentro de la app (panel ⚠️).

- Login con PIN (1234, 5678, 9999)6. Sin dependencias de sincronización remota todavía (código Supabase eliminado para mantener simpleza).

- Control de acceso seguro

### Estructura de carpetas

### 📦 Gestión de Productos```

- ✅ Escaneo de códigos de barrasApp.js                # Root de la aplicación

- ✅ Búsqueda y filtrado de productos  index.js              # Registro Expo

- ✅ Edición de stock en tiempo realapp.json              # Configuración Expo (OTA desactivadas)

- ✅ Alertas de stock bajosrc/db.js             # Esquema y funciones SQLite

- ✅ Validación de stock antes de vendersrc/errorLogger.js    # Logger en memoria + captura global

- ✅ Carga de fotos de productossrc/export.js         # Exportación CSV / JSON

src/screens/ProductForm.js   # Formulario producto + categorías + escáner

### 💰 Gestión de Cajasrc/screens/ScannerScreen.js # Escáner de códigos

- ✅ Apertura/cierre de cajaassets/               # (Reservado para íconos / splash si se agregan)

- ✅ Retiros validados (no exceder balance)```

- ✅ Historial de movimientos

- ✅ Reportes de sesiones### Dependencias clave

- expo (SDK 48)

### 🛒 Ventas- expo-barcode-scanner

- ✅ Venta rápida con escáner- expo-sqlite

- ✅ Múltiples métodos de pago (efectivo, transferencia)- @react-native-picker/picker

- ✅ Agregar comprobante de transferencia post-venta- expo-file-system / expo-sharing

- ✅ Historial completo de ventas- expo-haptics (feedback al escanear)

- ✅ Anulación de ventas

### Flujo principal

### 📊 Reportes1. Inicio: se crea/abre la base `olivomarket.db` con tablas `products` y `categories` (se cargan categorías por defecto).

- Ventas por período2. Lista de productos: ordenados por última actualización.

- Productos más vendidos3. Nuevo / Editar: abre modal con formulario.

- Gráficos visuales4. Escanear: abre modal de escáner; al detectar rellena el campo código y cierra.

- Exportación de datos5. Guardar: inserta o actualiza (upsert por `barcode`). Si existe, avisa y carga para edición.

6. Exportar: genera archivo temporal y lo comparte (si el dispositivo soporta Sharing API).

## 🚀 Desarrollo7. Errores: botón ⚠️ abre panel con logs capturados (errores globales, promesas no manejadas, console.error interceptado).



### Requisitos### Base de datos (SQLite)

- Node.js 18+Tabla products:

- Expo CLI```

- Expo Go en dispositivo móvilid INTEGER PK

barcode TEXT UNIQUE NOT NULL

### Configuracióncategory TEXT NULL

```bashpurchase_price REAL

# Instalar dependenciassale_price REAL

npm installexpiry_date TEXT (ISO / libre)

stock INTEGER

# Iniciar desarrolloupdated_at INTEGER (timestamp ms)

npm start```

```Tabla categories:

```

### Probar en Dispositivoid INTEGER PK

1. Abre **Expo Go** en tu celularname TEXT UNIQUE NOT NULL

2. Escanea el **QR** de la terminal```

3. La app se cargará automáticamente

### Scripts útiles

## 📱 Compilar APKIniciar en desarrollo:

```

```bashnpm install

# Instalar EAS CLInpm start

npm install -g eas-cli```

Build APK (perfil preview interno):

# Login```

eas loginnpx eas build --profile preview --platform android

```

# Compilar

eas build -p android --profile preview### Panel de errores

```Cada entrada contiene: timestamp, contexto (ej: product_save, categories_load, global) y mensaje. Máximo 150 registros en memoria.



## 🗂️ Estructura### Cómo agregar sincronización luego

Se removió código Supabase para claridad. Para reintroducirlo, crear un módulo `remote/` con cliente y colas offline, sin mezclar en `db.js`.

```

src/### Posibles mejoras futuras

├── db.js                  # SQLite- Migrar a Expo SDK > 50.

├── auth/                  # Autenticación- Validaciones de formato de fecha.

├── screens/               # Pantallas- Búsqueda / filtro de productos.

└── ui/                    # Componentes- Sincronización remota opcional.

```- Tests automatizados (Jest) para helpers de export y DB.



## 🔧 Stack### Licencia

- React Native 0.71.14Uso interno. Añadir licencia si se distribuye externamente.

- Expo SDK 48

- SQLite (offline-first)---

Repositorio limpiado: se eliminaron archivos legacy (App-* variantes, Snack, Supabase, plantillas). Este README refleja el estado actual.

## 📝 PINs
- `1234`, `5678`, `9999`

---
**Versión:** 1.0.0
