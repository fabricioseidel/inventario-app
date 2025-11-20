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
import { logManager } from './utils/LogViewer';

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
  
  logManager.info('═══════════════════════════════════════════════════════');
  logManager.info(`📤 [SYNC UPLOAD] Sincronizando ventas con Supabase`);
  logManager.info('═══════════════════════════════════════════════════════');
  logManager.info(`⏰ Timestamp: ${new Date().toISOString()}`);
  logManager.info(`📱 Device ID: ${deviceId}`);
  logManager.info(`👤 Vendedor: ${sellerName || 'desconocido'}`);
  logManager.info(`📊 Ventas pendientes: ${pending.length}`);
  
  if (pending.length === 0) {
    logManager.info('✅ No hay ventas pendientes');
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  
  for (const s of pending) {
    try {
      // 🔧 FIX: Usar el timestamp original de la venta, no el momento del sync
      let originalTimestamp;
      if (s.ts) {
        // Convertir timestamp local a ISO string para enviar a Supabase
        originalTimestamp = new Date(s.ts).toISOString();
      }
      
      logManager.info('───────────────────────────────────────────────────────');
      logManager.info(`📋 Venta: ${s.client_sale_id}`);
      logManager.info(`   Total: $${s.total}`);
      logManager.info(`   Método: ${s.payment_method}`);
      logManager.info(`   Comprobante URI: ${s.transfer_receipt_uri ? '✅ ' + s.transfer_receipt_uri.substring(0, 60) + '...' : '❌ No'}`);
      logManager.info(`   Comprobante Nombre: ${s.transfer_receipt_name || '❌ No'}`);
      logManager.info(`   Items: ${s.items_json ? Object.keys(JSON.parse(s.items_json || '{}')).length : 0}`);
      
      // Parsear items_json para convertirlo a objeto (no string)
      let itemsArray = [];
      try {
        if (s.items_json) {
          itemsArray = typeof s.items_json === 'string' 
            ? JSON.parse(s.items_json)
            : s.items_json;
        }
      } catch (parseError) {
        logManager.warn(`⚠️ Error parseando items_json: ${parseError.message}`);
        itemsArray = [];
      }
      
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
        p_items: itemsArray,  // 🔧 Enviar como objeto/array, no como string
        p_timestamp: originalTimestamp,  // 🔧 Enviar timestamp original
        p_seller_name: sellerName,  // 🆕 Agregar nombre del vendedor
        p_transfer_receipt_uri: s.transfer_receipt_uri || null,  // 🆕 URL pública de comprobante
        p_transfer_receipt_name: s.transfer_receipt_name || null  // 🆕 Nombre del comprobante
      };
      
      logManager.info(`⏳ Enviando RPC 'apply_sale'...`);
      logManager.info(`   📎 Parámetros de comprobante:`);
      logManager.info(`      - URI: ${payload.p_transfer_receipt_uri ? payload.p_transfer_receipt_uri.substring(0, 50) + '...' : 'null'}`);
      logManager.info(`      - Nombre: ${payload.p_transfer_receipt_name || 'null'}`);
      
      const rpcStartTime = Date.now();
      
      const { data, error } = await supabase.rpc('apply_sale', payload);
      
      const rpcDuration = Date.now() - rpcStartTime;
      
      if (error) {
        errorCount++;
        const errorMsg = error.message || error.details || error.hint || JSON.stringify(error) || 'Error desconocido';
        logManager.error(`❌ [ERROR RPC] Fallo después de ${rpcDuration}ms`);
        logManager.error(`   Código: ${error.statusCode || error.code || 'N/A'}`);
        logManager.error(`   Mensaje: ${errorMsg}`);
        logManager.error(`   Venta: ${s.client_sale_id}`);
        logManager.error(`   📎 Comprobante URI enviado: ${payload.p_transfer_receipt_uri}`);
        logManager.error(`   📎 Comprobante Nombre enviado: ${payload.p_transfer_receipt_name}`);
      } else {
        successCount++;
        logManager.info(`✅ [RPC OK] Completado en ${rpcDuration}ms`);
        logManager.info(`   ID en Supabase: ${data}`);
        logManager.info(`   📎 Comprobante guardado en Supabase: ${payload.p_transfer_receipt_uri ? 'Sí ✅' : 'No'}`);
        await markSaleSynced(s.local_sale_id, data);
      }
    } catch (itemError) {
      errorCount++;
      logManager.error(`❌ [ERROR ITERACIÓN] Error procesando venta ${s.client_sale_id}`);
      logManager.error(`   Mensaje: ${itemError?.message || JSON.stringify(itemError)}`);
      logManager.error(`   Stack: ${itemError?.stack}`);
    }
  }
  
  const pushEndTime = Date.now();
  const totalTime = pushEndTime - pushStartTime;
  
  logManager.info('═══════════════════════════════════════════════════════');
  logManager.info(`✅ [SYNC UPLOAD COMPLETADO] ${totalTime}ms`);
  logManager.info('═══════════════════════════════════════════════════════');
  logManager.info(`✅ Exitosas: ${successCount}`);
  logManager.info(`❌ Errores: ${errorCount}`);
  logManager.info(`📊 Total: ${pending.length}`);
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

  if (error) logManager.warn('push products error', error);
}

export async function pushCategories() {
  const localCats = await listCategories();
  if (!localCats.length) return;

  const { error } = await supabase.from('categories').upsert(
    localCats.map(c => ({ name: c.name })),
    { onConflict: 'name' }
  );

  if (error) logManager.warn('push categories error', error);
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
  
  logManager.info('═══════════════════════════════════════════════════════');
  logManager.info(`📥 [SYNC DOWNLOAD] Descargando ventas desde Supabase`);
  logManager.info('═══════════════════════════════════════════════════════');
  logManager.info(`⏰ Timestamp: ${new Date().toISOString()}`);
  logManager.info(`📱 Device ID: ${deviceId}`);
  logManager.info(`🕐 Desde: ${sinceIso}`);

  logManager.info(`⏳ [PASO 1] Consultando tabla 'sales'...`);
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
    logManager.error('═══════════════════════════════════════════════════════');
    logManager.error(`❌ [ERROR QUERY] Fallo después de ${queryDuration}ms`);
    logManager.error('═══════════════════════════════════════════════════════');
    logManager.error(`Error: ${error.message}`);
    logManager.error(`Código: ${error.statusCode || 'N/A'}`);
    throw error;
  }
  
  logManager.info(`✅ Query completada en ${queryDuration}ms`);
  logManager.info(`📊 Ventas encontradas: ${sales?.length || 0}`);
  
  if (!sales?.length) {
    logManager.info('✅ No hay ventas nuevas para sincronizar');
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  
  if (sales?.length) {
    for (const s of sales) {
      logManager.info('───────────────────────────────────────────────────────');
      logManager.info(`📋 Venta remota: ${s.id}`);
      logManager.info(`   Total: $${s.total}`);
      logManager.info(`   Método: ${s.payment_method}`);
      logManager.info(`   Dispositivo origen: ${s.device_id}`);
      logManager.info(`   Timestamp: ${new Date(s.ts).toISOString()}`);
      logManager.info(`   Comprobante: ${s.transfer_receipt_uri ? '✅ Sí' : '❌ No'}`);
      
      let items = s.items || s.items_json || [];
      if (typeof items === 'string') {
        try { 
          items = JSON.parse(items);
          logManager.info(`   Items (JSON): ${Object.keys(items).length}`);
        } catch (e) {
          logManager.warn(`⚠️ Error parseando items:`, e.message);
          errorCount++;
          continue;
        }
      }
      
      try {
        // 🔧 Usar directamente el timestamp de la venta
        const tsMillis = s.ts ? new Date(s.ts).getTime() : Date.now();
        
        logManager.info(`⏳ Insertando en BD local...`);
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
        logManager.info(`✅ Insertada en BD local (${insertDuration}ms)`);
        
      } catch (e) {
        errorCount++;
        logManager.error(`❌ Error insertando venta:`, e.message);
        logManager.error(`   Stack: ${e.stack}`);
        logManager.error(`   Sale ID: ${s.id}`);
      }
    }
  }
  
  const pullEndTime = Date.now();
  const totalTime = pullEndTime - pullStartTime;
  
  logManager.info('═══════════════════════════════════════════════════════');
  logManager.info(`✅ [SYNC DOWNLOAD COMPLETADO] ${totalTime}ms`);
  logManager.info('═══════════════════════════════════════════════════════');
  logManager.info(`✅ Insertadas: ${successCount}`);
  logManager.info(`❌ Errores: ${errorCount}`);
  logManager.info(`📊 Total procesadas: ${sales.length}`);
}

// ---------- SYNC PRINCIPAL ----------
export async function syncNow() {
  logManager.info('🔄 Iniciando sincronización...');
  
  try {
    // 1) Subir primero todo lo local
    
    // 🔧 COMENTADO TEMPORALMENTE: No subir productos masivamente al inicio
    // Solo sincronizar cuando sea necesario (agregar/editar producto individual)
    // logManager.info('📤 Subiendo productos...');
    // try {
    //   await pushProducts();
    // } catch (e) {
    //   logManager.warn('⚠️ Error subiendo productos:', e);
    // }
    
    // logManager.info('📤 Subiendo categorías...');
    // try {
    //   await pushCategories();
    // } catch (e) {
    //   logManager.warn('⚠️ Error subiendo categorías:', e);
    // }
    
    logManager.info('📤 Subiendo ventas...');
    try {
      await pushSales();
    } catch (e) {
      const errMsg = e?.message || e?.toString?.() || JSON.stringify(e) || 'Error desconocido';
      logManager.error('⚠️ Error subiendo ventas:', errMsg);
      // Continuamos con el proceso
    }

    // 2) Luego bajar lo más reciente
    logManager.info('📥 Descargando productos...');
    try {
      const lastProductTs = await listLocalProductsUpdatedAfter();
      await pullProducts({ sinceTs: lastProductTs });
    } catch (e) {
      const errMsg = e?.message || e?.toString?.() || JSON.stringify(e) || 'Error desconocido';
      logManager.error('⚠️ Error descargando productos:', errMsg);
    }
    
    logManager.info('📥 Descargando ventas...');
    try {
      const lastSaleTs = await getLastSaleTs();
      await pullSales({ sinceTs: lastSaleTs });
    } catch (e) {
      const errMsg = e?.message || e?.toString?.() || JSON.stringify(e) || 'Error desconocido';
      logManager.error('⚠️ Error descargando ventas:', errMsg);
    }
    
    logManager.info('✅ Sincronización completada exitosamente');
    return true;
  } catch (error) {
    logManager.error('❌ Error en sincronización:', error);
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
          logManager.warn('realtime product error', e);
        }
      }
    )
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'sales' },
      async (payload) => {
        const s = payload.new || {};
        const deviceId = await getDeviceId();
        
        logManager.info(`📡 Venta recibida en tiempo real: id=${s.id}, dispositivo=${s.device_id}, dispositivo_actual=${deviceId}`);
        
        if (s.device_id === deviceId) {
          logManager.info(`⏭️ Venta es del dispositivo actual, saltando`);
          return;
        }
        
        let items = s.items || s.items_json || [];
        if (typeof items === 'string') {
          try { 
            items = JSON.parse(items); 
            logManager.info(`📡 Items parseados:`, items);
          } catch (e) {
            logManager.warn(`❌ Error parseando items:`, e);
            items = [];
          }
        }
        
        try {
          // 🔧 Usar directamente el timestamp de la venta
          const tsMillis = s.ts ? new Date(s.ts).getTime() : Date.now();
          
          logManager.info(`📡 Insertando venta en tiempo real, timestamp: ${new Date(tsMillis).toLocaleString()}`);
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
          logManager.info(`✅ Venta en tiempo real procesada: ${result}`);
        } catch (e) {
          logManager.error('❌ Error procesando venta en tiempo real:', e);
        }
      }
    )
    .subscribe();
}

