-- ====================================================================
-- FUNCIÓN RPC: apply_sale_v2 (HÍBRIDA, IDEMPOTENTE, COMPATIBLE WEB)
-- ====================================================================
-- Objetivos:
--  * Mantener modelo relacional (sales + sale_items)
--  * Idempotencia por client_sale_id
--  * Inserción/actualización comprobante (transfer_receipt_uri/name)
--  * Inserta sale_items si no existen en reintentos
--  * Actualiza stock de products (stock >= 0)
--  * Valida array items y sus campos mínimos
--  * Permite enviar timestamp original
--  * No rompe uso actual del front web (que lee sale_items)
-- ====================================================================
-- NOTAS DE MIGRACIÓN:
-- 1. No elimina la función original apply_sale (puede seguir usándose)
-- 2. El app móvil se actualizará para llamar a apply_sale_v2
-- 3. Se puede luego de validar, deprecate apply_sale
-- ====================================================================

CREATE OR REPLACE FUNCTION public.apply_sale_v2(
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
  p_transfer_receipt_name TEXT DEFAULT NULL,
  p_update_if_exists BOOLEAN DEFAULT TRUE
) RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_id BIGINT;
  v_item JSONB;
  v_existing_id BIGINT;
  v_barcode TEXT;
  v_items_count INT;
  v_seller_id UUID;
BEGIN
  -- ============================
  -- VALIDACIONES BÁSICAS
  -- ============================
  IF p_total IS NULL OR p_total <= 0 THEN
    RAISE EXCEPTION 'Total inválido (%)', p_total;
  END IF;

  IF p_payment_method IS NULL THEN
    RAISE EXCEPTION 'payment_method requerido';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RAISE EXCEPTION 'p_items debe ser un array JSON';
  END IF;

  IF jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Items no puede estar vacío';
  END IF;

  -- Resolver seller_id por nombre (si viene)
  IF p_seller_name IS NOT NULL THEN
    SELECT id INTO v_seller_id FROM public.sellers WHERE name = p_seller_name LIMIT 1;
  END IF;

  -- Validar cada item
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    IF NOT (v_item ? 'barcode' AND v_item ? 'qty' AND v_item ? 'unit_price') THEN
      RAISE EXCEPTION 'Cada item requiere keys: barcode, qty, unit_price';
    END IF;
    IF (v_item->>'qty')::NUMERIC <= 0 THEN
      RAISE EXCEPTION 'Cantidad debe ser > 0 (barcode=%)', v_item->>'barcode';
    END IF;
    IF (v_item->>'unit_price')::NUMERIC < 0 THEN
      RAISE EXCEPTION 'Precio unitario negativo (barcode=%)', v_item->>'barcode';
    END IF;
  END LOOP;

  -- ============================
  -- IDEMPOTENCIA POR client_sale_id
  -- ============================
  IF p_client_sale_id IS NOT NULL THEN
    SELECT id INTO v_existing_id FROM public.sales WHERE client_sale_id = p_client_sale_id LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    IF p_update_if_exists THEN
      IF p_transfer_receipt_uri IS NOT NULL THEN
        UPDATE public.sales
        SET transfer_receipt_uri = p_transfer_receipt_uri,
            transfer_receipt_name = p_transfer_receipt_name
        WHERE id = v_existing_id;
      END IF;

      SELECT COUNT(*) INTO v_items_count FROM public.sale_items WHERE sale_id = v_existing_id;
      IF v_items_count = 0 THEN
        FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
          v_barcode := v_item->>'barcode';
          INSERT INTO public.sale_items (sale_id, product_barcode, product_name, quantity, unit_price, subtotal, discount)
          VALUES (
            v_existing_id,
            v_barcode,
            v_item->>'name',
            (v_item->>'qty')::NUMERIC,
            (v_item->>'unit_price')::NUMERIC,
            COALESCE((v_item->>'subtotal')::NUMERIC, (v_item->>'qty')::NUMERIC * (v_item->>'unit_price')::NUMERIC),
            COALESCE((v_item->>'discount')::NUMERIC, 0)
          );
          UPDATE public.products
          SET stock = GREATEST(0, stock - (v_item->>'qty')::NUMERIC), updated_at = NOW()
          WHERE barcode = v_barcode;
        END LOOP;
      END IF;
    END IF;
    RETURN v_existing_id;
  END IF;

  -- ============================
  -- INSERTAR NUEVA VENTA (ajustada al esquema actual)
  -- ============================
  INSERT INTO public.sales (
    ts, total, payment_method, cash_received, change_given, discount, tax, notes,
    device_id, client_sale_id, seller_id, transfer_receipt_uri, transfer_receipt_name
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
    v_seller_id,
    p_transfer_receipt_uri,
    p_transfer_receipt_name
  ) RETURNING id INTO v_sale_id;

  -- ============================
  -- INSERTAR ITEMS + ACTUALIZAR STOCK
  -- ============================
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_barcode := v_item->>'barcode';
    INSERT INTO public.sale_items (
      sale_id, product_barcode, product_name, quantity, unit_price, subtotal, discount
    ) VALUES (
      v_sale_id,
      v_barcode,
      v_item->>'name',
      (v_item->>'qty')::NUMERIC,
      (v_item->>'unit_price')::NUMERIC,
      COALESCE((v_item->>'subtotal')::NUMERIC, (v_item->>'qty')::NUMERIC * (v_item->>'unit_price')::NUMERIC),
      COALESCE((v_item->>'discount')::NUMERIC, 0)
    );
    UPDATE public.products
    SET stock = GREATEST(0, stock - (v_item->>'qty')::NUMERIC), updated_at = NOW()
    WHERE barcode = v_barcode;
  END LOOP;

  RETURN v_sale_id;

EXCEPTION
  WHEN unique_violation THEN
    SELECT id INTO v_existing_id FROM public.sales WHERE client_sale_id = p_client_sale_id LIMIT 1;
    IF v_existing_id IS NOT NULL THEN
      RETURN v_existing_id;
    END IF;
    RAISE EXCEPTION 'Fallo por unique_violation pero no se recuperó id';
  WHEN OTHERS THEN
    RAISE EXCEPTION 'Error en apply_sale_v2: % (SQLSTATE=%)', SQLERRM, SQLSTATE;
END;
$$;

-- PERMISOS
GRANT EXECUTE ON FUNCTION public.apply_sale_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION public.apply_sale_v2 TO anon;

-- ÍNDICES (seguridad de existencia)
-- Índice opcional único para idempotencia (si la columna no es única aún)
CREATE UNIQUE INDEX IF NOT EXISTS sales_client_sale_id_unique ON public.sales(client_sale_id);
CREATE INDEX IF NOT EXISTS sales_ts_idx ON public.sales(ts);
CREATE INDEX IF NOT EXISTS sale_items_sale_id_idx ON public.sale_items(sale_id);

-- COMENTARIO
COMMENT ON FUNCTION public.apply_sale_v2 IS 'Función híbrida para registrar ventas con sale_items, idempotente y actualización de stock.';

-- ============================
-- CONSULTAS DE VERIFICACIÓN RÁPIDA (ejecutar manualmente luego)
-- ============================
-- 1) Insertar prueba:
-- SELECT apply_sale_v2(1000,'efectivo',1000,0,0,0,'test','device-x','client-123',
--  '[{"barcode":"ABC123","name":"Producto test","qty":2,"unit_price":500}]'::jsonb, NOW(),'Vendedor','https://ejemplo/comp.jpg','comp.jpg', TRUE);
-- 2) Reintento idempotente (debe devolver mismo id):
-- SELECT apply_sale_v2(1000,'efectivo',1000,0,0,0,'test','device-x','client-123',
--  '[{"barcode":"ABC123","name":"Producto test","qty":2,"unit_price":500}]'::jsonb, NOW(),'Vendedor',NULL,NULL, TRUE);
-- 3) Ventas sin items (debería ser 0 si todo ok):
-- SELECT s.id FROM sales s LEFT JOIN sale_items si ON si.sale_id=s.id WHERE si.sale_id IS NULL ORDER BY s.id DESC LIMIT 20;
-- 4) Stock para el barcode usado:
-- SELECT barcode, stock FROM products WHERE barcode='ABC123';
