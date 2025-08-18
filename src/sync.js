import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from './supabaseClient';
import { upsertProduct } from './db';

const QUEUE_KEY = 'olivo_sync_queue_v1';

const toRemoteRow = (p) => ({
  barcode: p.barcode,
  category: p.category || null,
  purchase_price: Number(p.purchasePrice || 0),
  sale_price: Number(p.salePrice || 0),
  expiry_date: p.expiryDate || null,
  stock: Number(p.stock || 0),
  updated_at: new Date().toISOString(),
});

const fromRemoteRow = (r) => ({
  barcode: r.barcode,
  category: r.category || '',
  purchasePrice: String(r.purchase_price ?? ''),
  salePrice: String(r.sale_price ?? ''),
  expiryDate: r.expiry_date || '',
  stock: String(r.stock ?? ''),
});

export const pushProductRemote = async (p) => {
  const row = toRemoteRow(p);
  const { error } = await supabase.from('products').upsert(row, { onConflict: 'barcode' });
  if (error) throw error;
};

export const enqueueForLater = async (item) => {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  const q = raw ? JSON.parse(raw) : [];
  q.push(item);
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(q));
};

export const pushProductRemoteSafe = async (p) => {
  try {
    await pushProductRemote(p);
  } catch {
    await enqueueForLater({ type: 'upsert', row: toRemoteRow(p) });
  }
};

export const flushQueue = async () => {
  const raw = await AsyncStorage.getItem(QUEUE_KEY);
  if (!raw) return;
  const q = JSON.parse(raw);
  const remaining = [];
  for (const item of q) {
    try {
      if (item.type === 'upsert') {
        const { error } = await supabase.from('products').upsert(item.row, { onConflict: 'barcode' });
        if (error) throw error;
      }
    } catch {
      remaining.push(item);
    }
  }
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
};

export const pullAllToLocal = async () => {
  const { data, error } = await supabase.from('products').select('*');
  if (error) throw error;
  for (const r of data || []) {
    await upsertProduct(fromRemoteRow(r));
  }
};

export const initRemoteSync = () => {
  const channel = supabase
    .channel('products-changes')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      async (payload) => {
        const r = payload.new;
        if (!r) return;
        try {
          await upsertProduct(fromRemoteRow(r));
        } catch {}
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
