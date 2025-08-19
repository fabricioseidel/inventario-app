## Inventario Móvil (Barcode / SQLite)

Versión limpia y mínima enfocada en:
1. Escanear código de barras (solo lectura).
2. CRUD de productos (SQLite local).
3. Categorías simples administradas localmente.
4. Exportación CSV y JSON.
5. Registro de errores visible dentro de la app (panel ⚠️).
6. Sin dependencias de sincronización remota todavía (código Supabase eliminado para mantener simpleza).

### Estructura de carpetas
```
App.js                # Root de la aplicación
index.js              # Registro Expo
app.json              # Configuración Expo (OTA desactivadas)
src/db.js             # Esquema y funciones SQLite
src/errorLogger.js    # Logger en memoria + captura global
src/export.js         # Exportación CSV / JSON
src/screens/ProductForm.js   # Formulario producto + categorías + escáner
src/screens/ScannerScreen.js # Escáner de códigos
assets/               # (Reservado para íconos / splash si se agregan)
```

### Dependencias clave
- expo (SDK 48)
- expo-barcode-scanner
- expo-sqlite
- @react-native-picker/picker
- expo-file-system / expo-sharing
- expo-haptics (feedback al escanear)

### Flujo principal
1. Inicio: se crea/abre la base `olivomarket.db` con tablas `products` y `categories` (se cargan categorías por defecto).
2. Lista de productos: ordenados por última actualización.
3. Nuevo / Editar: abre modal con formulario.
4. Escanear: abre modal de escáner; al detectar rellena el campo código y cierra.
5. Guardar: inserta o actualiza (upsert por `barcode`). Si existe, avisa y carga para edición.
6. Exportar: genera archivo temporal y lo comparte (si el dispositivo soporta Sharing API).
7. Errores: botón ⚠️ abre panel con logs capturados (errores globales, promesas no manejadas, console.error interceptado).

### Base de datos (SQLite)
Tabla products:
```
id INTEGER PK
barcode TEXT UNIQUE NOT NULL
category TEXT NULL
purchase_price REAL
sale_price REAL
expiry_date TEXT (ISO / libre)
stock INTEGER
updated_at INTEGER (timestamp ms)
```
Tabla categories:
```
id INTEGER PK
name TEXT UNIQUE NOT NULL
```

### Scripts útiles
Iniciar en desarrollo:
```
npm install
npm start
```
Build APK (perfil preview interno):
```
npx eas build --profile preview --platform android
```

### Panel de errores
Cada entrada contiene: timestamp, contexto (ej: product_save, categories_load, global) y mensaje. Máximo 150 registros en memoria.

### Cómo agregar sincronización luego
Se removió código Supabase para claridad. Para reintroducirlo, crear un módulo `remote/` con cliente y colas offline, sin mezclar en `db.js`.

### Posibles mejoras futuras
- Migrar a Expo SDK > 50.
- Validaciones de formato de fecha.
- Búsqueda / filtro de productos.
- Sincronización remota opcional.
- Tests automatizados (Jest) para helpers de export y DB.

### Licencia
Uso interno. Añadir licencia si se distribuye externamente.

---
Repositorio limpiado: se eliminaron archivos legacy (App-* variantes, Snack, Supabase, plantillas). Este README refleja el estado actual.
