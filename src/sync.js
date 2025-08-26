// src/sync.js
import { supabase } from './supabaseClient';
import { Platform } from 'react-native';
import {
  getUnsyncedSales, markSaleSynced,
  upsertProductsBulk, upsertCategoriesBulk, listLocalProductsUpdatedAfter
} from './db';

const DEVICE_ID = `${Platform.OS}-v1`;

export async function pushSales() {
  const pending = await getUnsyncedSales();
  for (const s of pending) {
    const payload = {
      p_total: s.total,
      p_payment_method: s.payment_method,
      p_cash_received: s.cash_received,
      p_change_given: s.change_given,
      p_discount: s.discount,
      p_tax: s.tax,
      p_notes: s.notes,
      p_device_id: DEVICE_ID,
      p_client_sale_id: s.client_sale_id,
      p_items: s.items_json, // array [{barcode,name,qty,unit_price,subtotal}]
    };
    const { data, error } = await supabase.rpc('apply_sale', payload);
    if (error) {
      console.warn('push sale error', error);
      continue; // deja en cola, reintentará luego
    }
    await markSaleSynced(s.local_sale_id, data);
  }
}

export async function pullProducts({ sinceTs } = {}) {
  const sinceIso = sinceTs ? new Date(sinceTs).toISOString() : '1970-01-01T00:00:00Z';

  const { data: products, error: ep } = await supabase
    .from('products')
    .select('*')
    .gt('updated_at', sinceIso)
    .order('updated_at', { ascending: true })
    .limit(1000);
  if (!ep && products?.length) await upsertProductsBulk(products);

  const { data: cats, error: ec } = await supabase
    .from('categories')
    .select('*')
    .limit(1000);
  if (!ec && cats?.length) await upsertCategoriesBulk(cats);
}

export async function syncNow() {
  await pushSales();
  const lastLocal = await listLocalProductsUpdatedAfter();
  await pullProducts({ sinceTs: lastLocal });
}
