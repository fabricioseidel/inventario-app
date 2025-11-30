# Resumen de Correcciones y Mejoras

He realizado las siguientes correcciones basándome en tu feedback:

## 1. Sincronización de Comprobantes
- **Problema:** La app no descargaba los comprobantes si la venta había sido creada originalmente en el mismo dispositivo (para evitar duplicados), impidiendo ver los comprobantes adjuntados posteriormente desde la web.
- **Solución:** Se modificó `src/sync.js` para permitir la descarga de ventas propias **si tienen un comprobante adjunto**, asegurando que la app siempre tenga la última versión con la foto/archivo.

## 2. Lógica de Precios (Formulario de Producto)
- **Problema:** La lógica de precios no coincidía con tu flujo de trabajo.
- **Solución:** Se reescribió la sección de precios en `src/screens/ProductForm.js`:
  - **Precio Compra:** Ahora puedes ingresar el **Neto** o el **Bruto (con IVA)**. Ambos se actualizan mutuamente (x1.19).
  - **Precio Sugerido:** Se calcula automáticamente como `Precio Compra (con IVA) / 0.65` (Margen ~35%). Se muestra solo como referencia.
  - **Precio Venta:** El campo principal ahora es el **Precio Venta Final (con IVA)**, que es el que tú defines. La app calcula internamente el neto para guardarlo en la base de datos.

## 3. Escáner y Búsqueda
- **Problema:** El foco del campo de código fallaba y la búsqueda en inventario se "desordenaba" al escanear rápido.
- **Solución:**
  - **Foco:** Se agregó `autoFocus` al campo de código de barras en el formulario y se configuró para que al dar "Enter" (acción del escáner) verifique el código automáticamente y pase al siguiente campo.
  - **Búsqueda:** Se implementó un "debounce" (retraso de 300ms) en la búsqueda del inventario (`App.js`). Esto evita que la app intente buscar con cada letra que envía el escáner, esperando a que termine de escribir el código completo para hacer una única búsqueda fluida.

## Instrucciones
1. **Sincronizar:** Ve a Reportes -> Sync para bajar los comprobantes faltantes.
2. **Probar Precios:** Crea un producto y verifica que el cálculo de precios funcione como esperas.
3. **Probar Escáner:** Intenta escanear en el inventario y en el formulario de nuevo producto.
