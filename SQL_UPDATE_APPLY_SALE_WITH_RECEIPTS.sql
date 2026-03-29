-- ============================================================
-- ACTUALIZACIÓN DE FUNCIÓN apply_sale PARA SOPORTAR COMPROBANTES
-- ============================================================
-- 
-- DESCRIPCIÓN:
-- Actualiza la función RPC apply_sale para aceptar y guardar 
-- URLs de comprobantes de transferencia desde la app móvil
--
-- FECHA: 2025-11-20
-- VERSIÓN: 2.0
--
-- ============================================================

-- 1️⃣ PRIMERO: Verificar que la tabla sales tiene las columnas necesarias

ALTER TABLE sales 
ADD COLUMN IF NOT EXISTS transfer_receipt_uri TEXT,
ADD COLUMN IF NOT EXISTS transfer_receipt_name TEXT;

-- ============================================================
-- 2️⃣ SEGUNDA: Recrear la función apply_sale con nuevos parámetros
-- ============================================================

DROP FUNCTION IF EXISTS apply_sale(
  p_total numeric,
  p_payment_method text,
  p_cash_received numeric,
  p_change_given numeric,
  p_discount numeric,
  p_tax numeric,
  p_notes text,
  p_device_id text,
  p_client_sale_id text,
  p_items jsonb,
  p_timestamp timestamp with time zone,
  p_seller_name text
) CASCADE;

-- Crear nueva versión con parámetros de comprobante
CREATE OR REPLACE FUNCTION apply_sale(
  p_total numeric DEFAULT 0,
  p_payment_method text DEFAULT 'efectivo',
  p_cash_received numeric DEFAULT 0,
  p_change_given numeric DEFAULT 0,
  p_discount numeric DEFAULT 0,
  p_tax numeric DEFAULT 0,
  p_notes text DEFAULT NULL,
  p_device_id text DEFAULT NULL,
  p_client_sale_id text DEFAULT NULL,
  p_items jsonb DEFAULT '[]'::jsonb,
  p_timestamp timestamp with time zone DEFAULT NOW(),
  p_seller_name text DEFAULT NULL,
  p_transfer_receipt_uri text DEFAULT NULL,
  p_transfer_receipt_name text DEFAULT NULL
)
RETURNS bigint AS $$
DECLARE
  v_sale_id bigint;
  v_item jsonb;
  v_product_barcode text;
  v_seller_id uuid;
BEGIN
  -- Obtener seller_id si se proporciona seller_name
  IF p_seller_name IS NOT NULL THEN
    SELECT id INTO v_seller_id 
    FROM sellers 
    WHERE name = p_seller_name 
    LIMIT 1;
  END IF;

  -- Verificar si la venta ya existe (evitar duplicados)
  SELECT id INTO v_sale_id 
  FROM sales 
  WHERE client_sale_id = p_client_sale_id 
  LIMIT 1;

  IF v_sale_id IS NOT NULL THEN
    RAISE NOTICE 'Venta duplicada detectada: %', p_client_sale_id;
    RETURN v_sale_id;
  END IF;

  -- Insertar la venta
  INSERT INTO sales (
    ts,
    total,
    payment_method,
    cash_received,
    change_given,
    discount,
    tax,
    notes,
    device_id,
    client_sale_id,
    seller_id,
    transfer_receipt_uri,
    transfer_receipt_name
  )
  VALUES (
    COALESCE(p_timestamp, NOW()),
    p_total,
    p_payment_method,
    p_cash_received,
    p_change_given,
    p_discount,
    p_tax,
    p_notes,
    p_device_id,
    p_client_sale_id,
    v_seller_id,
    p_transfer_receipt_uri,
    p_transfer_receipt_name
  )
  RETURNING sales.id INTO v_sale_id;

  -- Procesar items si existen
  IF p_items IS NOT NULL AND jsonb_array_length(p_items) > 0 THEN
    FOR v_item IN SELECT jsonb_array_elements(p_items)
    LOOP
      v_product_barcode := v_item->>'barcode';
      
      -- Insertar item en sale_items
      INSERT INTO sale_items (
        sale_id,
        product_barcode,
        product_name,
        quantity,
        unit_price,
        subtotal
      )
      VALUES (
        v_sale_id,
        v_product_barcode,
        v_item->>'name',
        (v_item->>'qty')::numeric,
        (v_item->>'unit_price')::numeric,
        (v_item->>'subtotal')::numeric
      );

      -- Actualizar stock del producto
      UPDATE products 
      SET 
        stock = GREATEST(0, stock - (v_item->>'qty')::numeric),
        updated_at = NOW()
      WHERE barcode = v_product_barcode;
    END LOOP;
  END IF;

  RETURN v_sale_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 3️⃣ TERCERA: Crear índice para búsquedas más rápidas
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_sales_transfer_uri 
ON sales(transfer_receipt_uri) 
WHERE transfer_receipt_uri IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sales_client_id 
ON sales(client_sale_id);

-- ============================================================
-- 4️⃣ CUARTA: Verificar que todo funciona
-- ============================================================

-- Prueba: Verificar que la función apply_sale fue creada
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_name = 'apply_sale'
AND routine_schema = 'public';

-- Prueba: Ver últimas ventas con comprobantes
SELECT 
  id,
  ts,
  total,
  payment_method,
  transfer_receipt_uri,
  transfer_receipt_name
FROM sales
WHERE transfer_receipt_uri IS NOT NULL
ORDER BY ts DESC
LIMIT 10;

-- ============================================================
-- ✅ ACTUALIZACIÓN COMPLETADA
-- ============================================================
-- 
-- Cambios realizados:
-- ✅ Columnas transfer_receipt_uri y transfer_receipt_name agregadas a tabla sales
-- ✅ Función apply_sale actualizada para aceptar comprobantes
-- ✅ Índices creados para mejor rendimiento
-- ✅ La app móvil ahora puede sincronizar comprobantes
--
-- Próximos pasos:
-- 1. Compilar y ejecutar la app móvil
-- 2. Crear una venta con método "transferencia" y comprobante
-- 3. Verificar que la imagen se suba a Supabase Storage
-- 4. Verificar que la URL aparezca en la tabla sales
-- 5. Verificar que la imagen sea visible en la página web
