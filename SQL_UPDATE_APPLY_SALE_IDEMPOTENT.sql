-- ====================================================================
-- FUNCIÓN RPC: apply_sale (VERSIÓN IDEMPOTENTE Y ROBUSTA)
-- ====================================================================
-- Esta función procesa ventas desde dispositivos móviles de forma segura:
-- 1. Usa client_sale_id para evitar duplicados (idempotencia)
-- 2. Valida que items no esté vacío
-- 3. Maneja comprobantes de transferencia correctamente
-- 4. Retorna el ID de la venta (nuevo o existente)
--
-- Ejecutar en: Editor SQL de Supabase
-- ====================================================================

CREATE OR REPLACE FUNCTION apply_sale(
  p_total NUMERIC,
  p_payment_method TEXT,
  p_cash_received NUMERIC DEFAULT 0,
  p_change_given NUMERIC DEFAULT 0,
  p_discount NUMERIC DEFAULT 0,
  p_tax NUMERIC DEFAULT 0,
  p_notes TEXT DEFAULT NULL,
  p_device_id TEXT DEFAULT NULL,
  p_client_sale_id TEXT DEFAULT NULL,
  p_items JSONB DEFAULT '[]'::jsonb,
  p_timestamp TIMESTAMPTZ DEFAULT NOW(),
  p_seller_name TEXT DEFAULT NULL,
  p_transfer_receipt_uri TEXT DEFAULT NULL,
  p_transfer_receipt_name TEXT DEFAULT NULL
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id BIGINT;
  v_item JSONB;
  v_existing_id BIGINT;
BEGIN
  -- ============================================
  -- PASO 1: Validación de datos de entrada
  -- ============================================
  
  -- Validar que items no esté vacío
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Items no puede estar vacío. Se requiere al menos un producto.';
  END IF;
  
  -- Validar formato básico de items
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    IF NOT (v_item ? 'barcode' AND v_item ? 'qty' AND v_item ? 'unit_price') THEN
      RAISE EXCEPTION 'Cada item debe contener barcode, qty y unit_price';
    END IF;
  END LOOP;

  -- ============================================
  -- PASO 2: Verificar si ya existe (idempotencia)
  -- ============================================
  
  IF p_client_sale_id IS NOT NULL THEN
    -- Buscar por client_sale_id primero
    SELECT id INTO v_existing_id
    FROM sales
    WHERE client_sale_id = p_client_sale_id
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
      -- Ya existe, actualizar comprobante si viene nuevo
      IF p_transfer_receipt_uri IS NOT NULL THEN
        UPDATE sales
        SET 
          transfer_receipt_uri = p_transfer_receipt_uri,
          transfer_receipt_name = p_transfer_receipt_name,
          updated_at = NOW()
        WHERE id = v_existing_id;
      END IF;
      
      RETURN v_existing_id;
    END IF;
  END IF;

  -- ============================================
  -- PASO 3: Insertar nueva venta
  -- ============================================
  
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
    items,
    seller_name,
    transfer_receipt_uri,
    transfer_receipt_name,
    created_at,
    updated_at
  ) VALUES (
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
    p_items,
    p_seller_name,
    p_transfer_receipt_uri,
    p_transfer_receipt_name,
    NOW(),
    NOW()
  )
  RETURNING id INTO v_sale_id;

  -- ============================================
  -- PASO 4: Actualizar inventario (opcional)
  -- ============================================
  
  -- Si tienes lógica de inventario en Supabase, activar aquí
  -- FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  -- LOOP
  --   UPDATE products
  --   SET stock = stock - (v_item->>'qty')::NUMERIC
  --   WHERE barcode = v_item->>'barcode';
  -- END LOOP;

  RETURN v_sale_id;
  
EXCEPTION
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error en apply_sale: % (SQLSTATE: %)', SQLERRM, SQLSTATE;
END;
$$;

-- ====================================================================
-- PERMISOS: Permitir a usuarios autenticados ejecutar la función
-- ====================================================================

GRANT EXECUTE ON FUNCTION apply_sale TO authenticated;
GRANT EXECUTE ON FUNCTION apply_sale TO anon;

-- ====================================================================
-- ÍNDICES RECOMENDADOS (si no existen)
-- ====================================================================

CREATE INDEX IF NOT EXISTS idx_sales_client_sale_id ON sales(client_sale_id);
CREATE INDEX IF NOT EXISTS idx_sales_device_id ON sales(device_id);
CREATE INDEX IF NOT EXISTS idx_sales_ts ON sales(ts);

-- ====================================================================
-- COMENTARIOS
-- ====================================================================

COMMENT ON FUNCTION apply_sale IS 'Procesa ventas desde dispositivos móviles con idempotencia usando client_sale_id';
