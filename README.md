Proyecto inicial "Barcode Inventory" (Expo React Native)

Descripción
- App móvil que escanea códigos de barras, permite crear/editar productos ligados al código, editar plantillas de producto y exportar los productos a un archivo CSV (abordable por Excel).

Requisitos previos
- Node.js y npm instalados
- Expo CLI instalado globalmente: npm install -g expo-cli

Cómo ejecutar
1) Abrir terminal en la carpeta del proyecto
2) Ejecutar: `npx expo install expo-barcode-scanner@~12.3.2 react-native@0.71.14`
3) npm install
4) npm start (o expo start)
5) Ejecutar en un emulador o en tu teléfono con la app Expo Go

Notas rápidas
- Uso Expo para acelerar desarrollo (cámara y SQLite integrados).
- Export crea XLSX y CSV en el almacenamiento de la app; la app intenta abrir el diálogo nativo de compartir (si está disponible). Ambos formatos pueden abrirse en Excel.
- Mejoras siguientes: export XLSX nativo y compartir automático, validaciones y tests.
