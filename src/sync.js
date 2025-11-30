// src/sync.js
import { supabase } from './supabaseClient';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getUnsyncedSales, markSaleSynced,
  upsertProductsBulk, upsertCategoriesBulk, upsertSuppliersBulk,
  listLocalProductsUpdatedAfter, listProducts, listCategories,
  insertSaleFromCloud, insertOrUpdateProduct, getLastSaleTs,
  getSaleWithItems, getOutboxByCloudSaleId
} from './db';
import { AuthManager } from './auth/AuthManager';
import { logManager } from './utils/LogViewer';
import { uploadReceiptToSupabase, isLocalUrl } from './utils/supabaseStorage';

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
      
      // 🆕 VALIDACIÓN CRÍTICA: Si items está vacío, reconstruir desde la BD
      if (!Array.isArray(itemsArray) || itemsArray.length === 0) {
        logManager.warn(`⚠️ Items vacío para venta ${s.client_sale_id}, reconstruyendo desde BD...`);
        try {
          const saleData = await getSaleWithItems(s.local_sale_id);
          if (saleData && saleData.items && saleData.items.length > 0) {
            itemsArray = saleData.items.map(it => ({
              barcode: String(it.barcode),
              name: it.name || null,
              qty: Number(it.qty || 0),
              unit_price: Number(it.unit_price || 0),
              subtotal: Number(it.subtotal || 0)
            }));
            logManager.info(`✅ Items reconstruidos: ${itemsArray.length} productos`);
          } else {
            logManager.error(`❌ No se pudieron reconstruir items para venta ${s.client_sale_id}`);
            errorCount++;
            continue; // Saltar esta venta
          }
        } catch (rebuildError) {
          logManager.error(`❌ Error reconstruyendo items: ${rebuildError.message}`);
          errorCount++;
          continue; // Saltar esta venta
        }
      }
      
      logManager.info(`   Items validados: ${itemsArray.length}`);
      
      // 🆕 Subir comprobante si es local
      let finalTransferUri = s.transfer_receipt_uri;
      if (finalTransferUri && isLocalUrl(finalTransferUri)) {
        try {
          logManager.info(`📤 Detectado comprobante local, subiendo a Supabase...`);
          // Usar client_sale_id para el nombre del archivo para garantizar unicidad
          finalTransferUri = await uploadReceiptToSupabase(finalTransferUri, s.client_sale_id);
          logManager.info(`✅ Comprobante subido exitosamente: ${finalTransferUri}`);
        } catch (uploadErr) {
          logManager.error(`❌ Error subiendo comprobante: ${uploadErr.message}`);
          logManager.error(`   Stack: ${uploadErr.stack}`);
          // Si falla la subida del comprobante, continuamos con null para no bloquear la venta
          finalTransferUri = null;
        }
      }
      // Asegurar campo discount presente (0 por defecto)
      itemsArray = itemsArray.map(it => ({
        barcode: it.barcode,
        name: it.name,
        qty: it.qty,
        unit_price: it.unit_price,
        subtotal: it.subtotal,
        discount: typeof it.discount === 'number' ? it.discount : 0
      }));
      
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
        p_transfer_receipt_uri: finalTransferUri || null,  // 🆕 URL pública de comprobante (o local si falló subida)
        p_transfer_receipt_name: s.transfer_receipt_name || null  // 🆕 Nombre del comprobante
      };
      
      logManager.info(`⏳ Enviando RPC 'apply_sale'...`);
      logManager.info(`   📎 Parámetros de comprobante:`);
      logManager.info(`      - URI: ${payload.p_transfer_receipt_uri ? payload.p_transfer_receipt_uri.substring(0, 50) + '...' : 'null'}`);
      logManager.info(`      - Nombre: ${payload.p_transfer_receipt_name || 'null'}`);
      
      const rpcStartTime = Date.now();
      
      const { data, error } = await supabase.rpc('apply_sale_v2', payload);
      
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

// ---------- REPARACIÓN DE VENTAS REMOTAS SIN ITEMS ----------
async function repairMissingRemoteSaleItems() {
  const deviceId = await getDeviceId();
  logManager.info('🔍 Buscando ventas remotas sin items para reparación...');
  // RPC auxiliar: list_sales_missing_items debe existir en Supabase
  const { data, error } = await supabase.rpc('list_sales_missing_items', { p_device_id: deviceId });
  if (error) {
    logManager.warn(`⚠️ No se pudo listar ventas sin items: ${error.message}`);
    return;
  }
  if (!data || !data.length) {
    logManager.info('✅ No hay ventas remotas sin items');
    return;
  }
  logManager.info(`🔧 Ventas a reparar: ${data.length}`);
  for (const row of data) {
    try {
      const remoteId = row.id;
      const outbox = await getOutboxByCloudSaleId(remoteId);
      if (!outbox) {
        logManager.warn(`⚠️ No se encontró payload local para venta remota id=${remoteId}`);
        continue;
      }
      const p = outbox.payload || {};
      const itemsArray = Array.isArray(p.items) ? p.items.map(it => ({
        barcode: it.barcode,
        name: it.name,
        qty: it.qty,
        unit_price: it.unit_price,
        subtotal: it.subtotal,
        discount: typeof it.discount === 'number' ? it.discount : 0
      })) : [];
      if (!itemsArray.length) {
        logManager.warn(`⚠️ Payload sin items para cloud_sale_id=${remoteId}`);
        continue;
      }
      logManager.info(`♻️ Reenviando items para venta remota id=${remoteId}`);
      const { error: rpcErr } = await supabase.rpc('apply_sale_v2', {
        p_total: p.total,
        p_payment_method: p.payment_method,
        p_cash_received: p.cash_received,
        p_change_given: p.change_given,
        p_discount: p.discount,
        p_tax: p.tax,
        p_notes: p.notes,
        p_device_id: deviceId,
        p_client_sale_id: p.client_sale_id,
        p_items: itemsArray,
        p_timestamp: new Date(outbox.local_sale_id ? (await getSaleWithItems(outbox.local_sale_id))?.sale?.ts : Date.now()).toISOString(),
        p_seller_name: null,
        p_transfer_receipt_uri: p.transfer_receipt_uri || null,
        p_transfer_receipt_name: p.transfer_receipt_name || null,
        p_update_if_exists: true
      });
      if (rpcErr) {
        logManager.error(`❌ Error reparando venta id=${remoteId}: ${rpcErr.message}`);
      } else {
        logManager.info(`✅ Reparación exitosa venta id=${remoteId}`);
      }
    } catch (e) {
      logManager.error(`❌ Excepción reparando venta remota: ${e.message}`);
    }
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
      description: p.description || null,
      measurement_unit: p.measurement_unit || null,
      measurement_value: p.measurement_value || 0,
      suggested_price: p.suggested_price || 0,
      offer_price: p.offer_price || 0,
      is_active: p.is_active === 0 ? false : true,
      // Nota: supplier_id se maneja en tabla intermedia en backend, pero si la tabla products tiene el campo, lo enviamos
      // Si no, habría que hacer una llamada separada a product_suppliers
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

export async function pullSuppliers() {
  const { data, error } = await supabase.from('suppliers').select('*').limit(1000);
  if (!error && data?.length) {
    await upsertSuppliersBulk(data);
  }
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
  
  await pullSuppliers();
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
  
  // 1. Obtener ventas nuevas (por timestamp)
  const { data: newSales, error: errorNew } = await supabase
    .from('sales')
    .select('*')
    .gt('ts', sinceIso)
    .neq('device_id', deviceId)
    .order('ts', { ascending: true })
    .limit(500);

  if (errorNew) {
    logManager.error(`❌ Error consultando ventas nuevas: ${errorNew.message}`);
    throw errorNew;
  }

  // 2. Obtener ventas recientes con comprobante (para capturar actualizaciones desde web)
  // Buscamos ventas de los últimos 30 días que tengan comprobante, para asegurar que se descarguen
  // aunque ya existan localmente (insertSaleFromCloud manejará la actualización)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const { data: receiptSales, error: errorReceipts } = await supabase
    .from('sales')
    .select('*')
    .gt('ts', thirtyDaysAgo)
    .not('transfer_receipt_uri', 'is', null) // Solo las que tienen comprobante
    // .neq('device_id', deviceId) // 🔧 COMENTADO: Permitir descargar mis propias ventas si tienen comprobante (para actualizar)
    .limit(200);
    
  if (errorReceipts) {
    logManager.warn(`⚠️ Error consultando ventas con comprobantes: ${errorReceipts.message}`);
  }

  // Combinar resultados eliminando duplicados por ID
  const salesMap = new Map();
  (newSales || []).forEach(s => salesMap.set(s.id, s));
  (receiptSales || []).forEach(s => salesMap.set(s.id, s));
  
  const sales = Array.from(salesMap.values());
    
  const queryDuration = Date.now() - queryStartTime;
  
  logManager.info(`✅ Query completada en ${queryDuration}ms`);
  logManager.info(`📊 Ventas encontradas: ${sales.length} (Nuevas: ${newSales?.length || 0}, Con comprobante: ${receiptSales?.length || 0})`);
  
  if (!sales.length) {
    logManager.info('✅ No hay ventas nuevas para sincronizar');
    return;
  }
  
  let successCount = 0;
  let errorCount = 0;
  
  if (sales.length) {
    // Ordenar por timestamp para insertar en orden
    sales.sort((a, b) => new Date(a.ts) - new Date(b.ts));

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
          cloud_id: s.id, // 🆕 Guardar ID de nube
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

    // Reparar ventas remotas que se crearon sin items (migración histórica)
    try {
      await repairMissingRemoteSaleItems();
    } catch (e) {
      logManager.warn(`⚠️ Error reparación ventas: ${e.message}`);
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
            cloud_id: s.id, // 🆕 Guardar ID de nube
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

