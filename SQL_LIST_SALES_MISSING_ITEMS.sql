-- Lista ventas sin items (para reparación histórica)
-- Crear esta función en Supabase antes de ejecutar reparación desde la app.

CREATE OR REPLACE FUNCTION public.list_sales_missing_items(
  p_device_id TEXT
) RETURNS TABLE(id BIGINT, client_sale_id TEXT)
LANGUAGE sql
SECURITY DEFINER
AS $$
  SELECT s.id, s.client_sale_id
  FROM public.sales s
  LEFT JOIN public.sale_items si ON si.sale_id = s.id
  WHERE s.device_id = p_device_id
    AND si.sale_id IS NULL
  ORDER BY s.id DESC
  LIMIT 500;
$$;

GRANT EXECUTE ON FUNCTION public.list_sales_missing_items TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_sales_missing_items TO anon;
