// src/sync.js
import { supabase } from './supabaseClient';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getUnsyncedSales, markSaleSynced,
  upsertProductsBulk, upsertCategoriesBulk,
  listLocalProductsUpdatedAfter, listProducts, listCategories,
  insertSaleFromCloud, insertOrUpdateProduct, getLastSaleTs
} from './db';
import { AuthManager } from './auth/AuthManager';

const DEVICE_KEY = 'device_id';
let DEVICE_ID = null;

async function getDeviceId() {
  if (DEVICE_ID) return DEVICE_ID;
  try {
    const stored = await AsyncStorage.getItem(DEVICE_KEY);
    if (stored) {
      DEVICE_ID = stored;
      return DEVICE_ID;
    }
  } catch {}
  const newId = `${Platform.OS}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
  DEVICE_ID = newId;
  try { await AsyncStorage.setItem(DEVICE_KEY, newId); } catch {}
  return DEVICE_ID;
}

// ---------- VENTAS ----------
export async function pushSales() {
  const pushStartTime = Date.now();
  const pending = await getUnsyncedSales();
  const deviceId = await getDeviceId();
  
  // 🆕 Obtener el usuario actual para enviar como vendedor
  const currentUser = await AuthManager.getCurrentUser();
  const sellerName = currentUser?.name || null;
  
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📤 [SYNC UPLOAD] Sincronizando ventas con Supabase`);
  console.log('═══════════════════════════════════════════════════════');
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`📱 Device ID: ${deviceId}`);
  console.log(`👤 Vendedor: ${sellerName || 'desconocido'}`);
  console.log(`📊 Ventas pendientes: ${pending.length}`);
  
  if (pending.length === 0) {
    console.log('✅ No hay ventas pendientes');
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const s of pending) {
    // 🔧 FIX: Usar el timestamp original de la venta, no el momento del sync
    let originalTimestamp;
    if (s.ts) {
      // Convertir timestamp local a ISO string para enviar a Supabase
      originalTimestamp = new Date(s.ts).toISOString();
    }
    
    console.log('───────────────────────────────────────────────────────');
    console.log(`📋 Venta: ${s.client_sale_id}`);
    console.log(`   Total: $${s.total}`);
    console.log(`   Método: ${s.payment_method}`);
    console.log(`   Comprobante: ${s.transfer_receipt_uri ? '✅ Sí' : '❌ No'}`);
    console.log(`   Items: ${s.items_json ? Object.keys(JSON.parse(s.items_json || '{}')).length : 0}`);
    
    const payload = {
      p_total: s.total,
      p_payment_method: s.payment_method,
      p_cash_received: s.cash_received || 0,
      p_change_given: s.change_given || 0,
      p_discount: s.discount || 0,
      p_tax: s.tax || 0,
      p_notes: s.notes || '',
      p_device_id: deviceId,
      p_client_sale_id: s.client_sale_id,
      p_items: s.items_json,
      p_timestamp: originalTimestamp,  // 🔧 Enviar timestamp original
      p_seller_name: sellerName,  // 🆕 Agregar nombre del vendedor
      p_transfer_receipt_uri: s.transfer_receipt_uri || null,  // 🆕 URL pública de comprobante
      p_transfer_receipt_name: s.transfer_receipt_name || null  // 🆕 Nombre del comprobante
    };
    
    console.log(`⏳ Enviando RPC 'apply_sale'...`);
    const rpcStartTime = Date.now();
    
    const { data, error } = await supabase.rpc('apply_sale', payload);
    
    const rpcDuration = Date.now() - rpcStartTime;
    
    if (error) {
      errorCount++;
      console.error(`❌ [ERROR RPC] Fallo después de ${rpcDuration}ms`);
      console.error(`   Código: ${error.statusCode || 'N/A'}`);
      console.error(`   Mensaje: ${error.message}`);
      console.error(`   Venta: ${s.client_sale_id}`);
      console.error(`   Payload: ${JSON.stringify(payload)}`);
    } else {
      successCount++;
      console.log(`✅ [RPC OK] Completado en ${rpcDuration}ms`);
      console.log(`   ID en Supabase: ${data}`);
      await markSaleSynced(s.local_sale_id, data);
    }
  }
  
  const pushEndTime = Date.now();
  const totalTime = pushEndTime - pushStartTime;
  
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ [SYNC UPLOAD COMPLETADO] ${totalTime}ms`);
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ Exitosas: ${successCount}`);
  console.log(`❌ Errores: ${errorCount}`);
  console.log(`📊 Total: ${pending.length}`);
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

export async function pullSales({ sinceTs } = {}) {
  const pullStartTime = Date.now();
  const sinceIso = sinceTs ? new Date(sinceTs).toISOString() : '1970-01-01T00:00:00Z';
  const deviceId = await getDeviceId();
  
  console.log('═══════════════════════════════════════════════════════');
  console.log(`📥 [SYNC DOWNLOAD] Descargando ventas desde Supabase`);
  console.log('═══════════════════════════════════════════════════════');
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`📱 Device ID: ${deviceId}`);
  console.log(`🕐 Desde: ${sinceIso}`);

  console.log(`⏳ [PASO 1] Consultando tabla 'sales'...`);
  const queryStartTime = Date.now();
  
  const { data: sales, error } = await supabase
    .from('sales')
    .select('*')
    .gt('ts', sinceIso)  // 🔧 Usar ts en lugar de created_at
    .neq('device_id', deviceId)
    .order('ts', { ascending: true })  // 🔧 Ordenar por ts
    .limit(1000);
    
  const queryDuration = Date.now() - queryStartTime;
  
  if (error) {
    console.error('═══════════════════════════════════════════════════════');
    console.error(`❌ [ERROR QUERY] Fallo después de ${queryDuration}ms`);
    console.error('═══════════════════════════════════════════════════════');
    console.error(`Error: ${error.message}`);
    console.error(`Código: ${error.statusCode || 'N/A'}`);
    throw error;
  }
  
  console.log(`✅ Query completada en ${queryDuration}ms`);
  console.log(`📊 Ventas encontradas: ${sales?.length || 0}`);
  
  if (!sales?.length) {
    console.log('✅ No hay ventas nuevas para sincronizar');
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  
  if (sales?.length) {
    for (const s of sales) {
      console.log('───────────────────────────────────────────────────────');
      console.log(`📋 Venta remota: ${s.id}`);
      console.log(`   Total: $${s.total}`);
      console.log(`   Método: ${s.payment_method}`);
      console.log(`   Dispositivo origen: ${s.device_id}`);
      console.log(`   Timestamp: ${new Date(s.ts).toISOString()}`);
      console.log(`   Comprobante: ${s.transfer_receipt_uri ? '✅ Sí' : '❌ No'}`);
      
      let items = s.items || s.items_json || [];
      if (typeof items === 'string') {
        try { 
          items = JSON.parse(items);
          console.log(`   Items (JSON): ${Object.keys(items).length}`);
        } catch (e) {
          console.warn(`⚠️ Error parseando items:`, e.message);
          errorCount++;
          continue;
        }
      }
      
      try {
        // 🔧 Usar directamente el timestamp de la venta
        const tsMillis = s.ts ? new Date(s.ts).getTime() : Date.now();
        
        console.log(`⏳ Insertando en BD local...`);
        const insertStartTime = Date.now();
        
        await insertSaleFromCloud({
          ts: tsMillis,
          total: s.total,
          payment_method: s.payment_method,
          cash_received: s.cash_received || 0,
          change_given: s.change_given || 0,
          discount: s.discount || 0,
          tax: s.tax || 0,
          notes: s.notes || '',
          transfer_receipt_uri: s.transfer_receipt_uri || null,  // 🆕 Sincronizar comprobantes desde otros dispositivos
          transfer_receipt_name: s.transfer_receipt_name || null, // 🆕 Sincronizar nombre del comprobante
          items,
        });
        
        const insertDuration = Date.now() - insertStartTime;
        successCount++;
        console.log(`✅ Insertada en BD local (${insertDuration}ms)`);
        
      } catch (e) {
        errorCount++;
        console.error(`❌ Error insertando venta:`, e.message);
        console.error(`   Stack: ${e.stack}`);
        console.error(`   Sale ID: ${s.id}`);
      }
    }
  }
  
  const pullEndTime = Date.now();
  const totalTime = pullEndTime - pullStartTime;
  
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ [SYNC DOWNLOAD COMPLETADO] ${totalTime}ms`);
  console.log('═══════════════════════════════════════════════════════');
  console.log(`✅ Insertadas: ${successCount}`);
  console.log(`❌ Errores: ${errorCount}`);
  console.log(`📊 Total procesadas: ${sales.length}`);
}

// ---------- SYNC PRINCIPAL ----------
export async function syncNow() {
  console.log('🔄 Iniciando sincronización...');
  
  try {
    // 1) Subir primero todo lo local
    
    // 🔧 COMENTADO TEMPORALMENTE: No subir productos masivamente al inicio
    // Solo sincronizar cuando sea necesario (agregar/editar producto individual)
    // console.log('📤 Subiendo productos...');
    // try {
    //   await pushProducts();
    // } catch (e) {
    //   console.warn('⚠️ Error subiendo productos:', e);
    // }
    
    // console.log('📤 Subiendo categorías...');
    // try {
    //   await pushCategories();
    // } catch (e) {
    //   console.warn('⚠️ Error subiendo categorías:', e);
    // }
    
    console.log('📤 Subiendo ventas...');
    try {
      await pushSales();
    } catch (e) {
      console.warn('⚠️ Error subiendo ventas:', e);
      // Continuamos con el proceso
    }

    // 2) Luego bajar lo más reciente
    console.log('📥 Descargando productos...');
    try {
      const lastProductTs = await listLocalProductsUpdatedAfter();
      await pullProducts({ sinceTs: lastProductTs });
    } catch (e) {
      console.warn('⚠️ Error descargando productos:', e);
    }
    
    console.log('📥 Descargando ventas...');
    try {
      const lastSaleTs = await getLastSaleTs();
      await pullSales({ sinceTs: lastSaleTs });
    } catch (e) {
      console.warn('⚠️ Error descargando ventas:', e);
    }
    
    console.log('✅ Sincronización completada exitosamente');
    return true;
  } catch (error) {
    console.error('❌ Error en sincronización:', error);
    throw error;
  }
}

// ---------- REALTIME ----------
let realtimeStarted = false;
export async function initRealtimeSync() {
  if (realtimeStarted) return;
  realtimeStarted = true;
  const deviceId = await getDeviceId();

  supabase
    .channel('realtime-inventory')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'products' },
      async (payload) => {
        const p = payload.new;
        try {
          await insertOrUpdateProduct({
            barcode: p.barcode,
            name: p.name,
            category: p.category,
            purchasePrice: p.purchase_price,
            salePrice: p.sale_price,
            expiryDate: p.expiry_date,
            stock: p.stock,
          });
        } catch (e) {
          console.warn('realtime product error', e);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sales' },
      async (payload) => {
        const s = payload.new || {};
        const deviceId = await getDeviceId();
        
        console.log(`📡 Venta recibida en tiempo real: id=${s.id}, dispositivo=${s.device_id}, dispositivo_actual=${deviceId}`);
        
        if (s.device_id === deviceId) {
          console.log(`⏭️ Venta es del dispositivo actual, saltando`);
          return;
        }
        
        let items = s.items || s.items_json || [];
        if (typeof items === 'string') {
          try { 
            items = JSON.parse(items); 
            console.log(`📡 Items parseados:`, items);
          } catch (e) {
            console.warn(`❌ Error parseando items:`, e);
            items = [];
          }
        }
        
        try {
          // 🔧 Usar directamente el timestamp de la venta
          const tsMillis = s.ts ? new Date(s.ts).getTime() : Date.now();
          
          console.log(`📡 Insertando venta en tiempo real, timestamp: ${new Date(tsMillis).toLocaleString()}`);
          const result = await insertSaleFromCloud({
            ts: tsMillis,
            total: s.total,
            payment_method: s.payment_method,
            cash_received: s.cash_received || 0,
            change_given: s.change_given || 0,
            discount: s.discount || 0,
            tax: s.tax || 0,
            notes: s.notes || '',
            items,
          });
          console.log(`✅ Venta en tiempo real procesada: ${result}`);
        } catch (e) {
          console.error('❌ Error procesando venta en tiempo real:', e);
        }
      }
    )
    .subscribe();
}
