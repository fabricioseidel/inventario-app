# Resumen de Cambios - Alineación de Esquema de Productos

Se ha actualizado la aplicación para soportar la gestión completa de productos, alineada con la versión web.

## 1. Base de Datos (`src/db.js`)
- **Nueva Tabla:** `suppliers` (Proveedores).
- **Nuevos Campos en `products`:**
  - `description` (Descripción detallada)
  - `measurement_unit` (Unidad de medida: un, kg, lt, etc.)
  - `measurement_value` (Valor de medida: 1, 1.5, etc.)
  - `supplier_id` (Relación con proveedor)
  - `tax_rate` (Impuesto/IVA en %)
  - `suggested_price` (Precio sugerido)
  - `offer_price` (Precio oferta)
  - `is_active` (Estado)
- **Migraciones:** Se ejecutan automáticamente al iniciar la app.

## 2. Sincronización (`src/sync.js`)
- **Proveedores:** Se descargan (`pullSuppliers`) desde Supabase.
- **Productos:**
  - `pushProducts`: Envía todos los nuevos campos a la web.
  - `pullProducts`: Descarga todos los nuevos campos desde la web.

## 3. Interfaz de Usuario
### Formulario de Producto (`src/screens/ProductForm.js`)
- Se agregaron los campos nuevos.
- **Modo Simple/Avanzado:** Por defecto muestra lo básico. Un botón "Mostrar detalles avanzados" revela descripción, proveedor, impuestos, unidad de medida, etc.
- **Cálculo de Impuestos:**
  - Se ingresa el "Precio Neto" (sin IVA).
  - Se calcula automáticamente el "Precio Venta" (con IVA) basado en la tasa (19% por defecto).
  - Se puede editar cualquiera de los dos y el otro se recalcula.
- **Selector de Proveedores:** Permite elegir un proveedor de la lista sincronizada.

### Pantalla de Venta (`src/screens/SellScreen.js`)
- **Cálculo de Precios:** Ahora calcula el precio final sumando el impuesto al precio neto almacenado.
  - Fórmula: `Precio Final = Precio Neto * (1 + %Impuesto)`
- Esto asegura que los totales de venta sean correctos y coincidan con la configuración de impuestos del producto.

## Instrucciones
1. **Sincronizar:** Ejecuta una sincronización manual ("Sync") para descargar la lista de proveedores y actualizar la estructura de productos desde la web.
2. **Editar Productos:** Al crear o editar, usa "Mostrar detalles avanzados" para ver los nuevos campos.
