# Barcode Inventory - Acceso Directo

## 🚀 Usa la app YA (sin instalación local)

### Opción 1: Expo Snack (Recomendado)
Abre este enlace en tu navegador del teléfono:
**https://snack.expo.dev/@anonymous/barcode-inventory-simple**

O escanea este QR desde Expo Go:
```
Visita: https://snack.expo.dev/
Busca: "barcode inventory"
Abre el proyecto y presiona "Run on device"
```

### Opción 2: Código directo para Expo Snack
1. Ve a https://snack.expo.dev/ en tu navegador
2. Crea un nuevo snack
3. Reemplaza App.js con el código de App-simple.js
4. Añade dependencias:
   - expo-barcode-scanner
   - expo-sqlite
5. Presiona "Run on device" → escanea QR

## 📱 Funciones de la app
- ✅ Escanear códigos de barras
- ✅ Crear/editar productos automáticamente
- ✅ Base de datos SQLite local
- ✅ Lista de productos guardados  
- ✅ Export CSV básico

## 🔧 Si quieres ejecutar localmente
El problema es la conexión entre tu PC y teléfono. Alternativas:

### Usar LAN (misma WiFi)
```bash
cd C:\Users\Vostro2\Desktop\appcelular
npx expo start --lan
```

### Usar emulador Android en PC
```bash
# Instalar Android Studio + crear AVD
npx expo start --android
```

### Crear APK para instalar directamente
```bash
npx expo build:android
# O usando EAS Build:
npx eas build --platform android
```

## ⚡ Solución rápida: Expo Snack
**La forma más fácil es usar Expo Snack online** - evita todos los problemas de red local.

Ve a: https://snack.expo.dev/ y crea el proyecto ahí.
