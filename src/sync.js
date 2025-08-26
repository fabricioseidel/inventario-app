// src/sync.js
import { supabase } from './supabaseClient';
import { Platform } from 'react-native';
import {
  getUnsyncedSales, markSaleSynced,
  upsertProductsBulk, upsertCategoriesBulk,
  listLocalProductsUpdatedAfter, listProducts, listCategories
} from './db';

const DEVICE_ID = `${Platform.OS}-v1`;

// ---------- VENTAS ----------
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
      p_items: s.items_json,
    };
    const { data, error } = await supabase.rpc('apply_sale', payload);
    if (error) {
      console.warn('push sale error', error);
      continue;
    }
    await markSaleSynced(s.local_sale_id, data);
  }
}

// ---------- PRODUCTOS ----------
export async function pushProducts() {
  const localProducts = await listProducts();
  if (!localProducts.length) return;

  const { error } = await supabase.from('products').upsert(
    localProducts.map(p => ({
      barcode: String(p.barcode),
      name: p.name,
      category: p.category,
      purchase_price: p.purchase_price || 0,
      sale_price: p.sale_price || 0,
      expiry_date: p.expiry_date || null,
      stock: p.stock || 0,
      updated_at: new Date().toISOString(),
    })),
    { onConflict: 'barcode' }
  );

  if (error) console.warn('push products error', error);
}

export async function pushCategories() {
  const localCats = await listCategories();
  if (!localCats.length) return;

  const { error } = await supabase.from('categories').upsert(
    localCats.map(c => ({ name: c.name })),
    { onConflict: 'name' }
  );

  if (error) console.warn('push categories error', error);
}

// ---------- DESCARGA ----------
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

// ---------- SYNC PRINCIPAL ----------
export async function syncNow() {
  // 1) Subir primero todo lo local
  await pushProducts();
  await pushCategories();
  await pushSales();

  // 2) Luego bajar lo más reciente
  const lastLocal = await listLocalProductsUpdatedAfter();
  await pullProducts({ sinceTs: lastLocal });
}
