// src/db.js
import * as SQLite from 'expo-sqlite';

let _db = null;
function db(){ if(!_db) _db = SQLite.openDatabase('olivomarket.db'); return _db; }
function rowsToArray(res){ const a=[]; for(let i=0;i<res.rows.length;i++) a.push(res.rows.item(i)); return a; }

// ---------- MIGRACIONES ----------
function ensureColumnsInTable(tx, table, columnDefs, done){
  tx.executeSql(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?;`,
    [table],
    (_,_tableRes)=>{
      if(!_tableRes.rows.length){
        done && done();
        return;
      }

      tx.executeSql(`PRAGMA table_info(${table});`, [], (_,_res)=>{
        const existing = new Set();
        for(let i=0;i<_res.rows.length;i++) existing.add(_res.rows.item(i).name);

        const toAdd = columnDefs.filter(c=>!existing.has(c.name));
        const run=(i)=>{
          if(i>=toAdd.length){
            done && done();
            return;
          }
          const c=toAdd[i];
          tx.executeSql(
            `ALTER TABLE ${table} ADD COLUMN ${c.name} ${c.def};`,
            [],
            ()=>run(i+1),
            (_,_err)=>{ console.warn(`⚠️ No se pudo agregar columna ${c.name} en ${table}:`, _err?.message); run(i+1); return true; }
          );
        };
        run(0);
      }, ()=>{ done&&done(); return true; });
    },
    ()=>{ done&&done(); return true; }
  );
}

function migrateSalesSchema(tx, done){
  const cols = [
    { name:'payment_method', def:'TEXT' },
    { name:'cash_received',  def:'REAL' },
    { name:'change_given',   def:'REAL' },
    { name:'discount',       def:'REAL DEFAULT 0' },
    { name:'tax',            def:'REAL DEFAULT 0' },
    { name:'notes',          def:'TEXT' },
    { name:'voided',         def:'INTEGER DEFAULT 0' },
  ];
  ensureColumnsInTable(tx, 'sales', cols, ()=> ensureColumnsInTable(tx, 'sale', cols, ()=> done&&done()));
}

function migrateCashManagement(tx, done){
  // Crear tablas de manejo de caja
  tx.executeSql(`
    CREATE TABLE IF NOT EXISTS cash_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      start_date TEXT NOT NULL,
      end_date TEXT,
      opening_amount REAL NOT NULL,
      expected_amount REAL,
      actual_amount REAL,
      difference REAL,
      opened_by TEXT NOT NULL,
      closed_by TEXT,
      notes TEXT,
      status TEXT DEFAULT 'open'
    );
  `, [], 
  () => tx.executeSql(`
    CREATE TABLE IF NOT EXISTS safe_movements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      description TEXT NOT NULL,
      session_id INTEGER,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES cash_sessions(id)
    );
  `, [],
  () => tx.executeSql(`
    CREATE TABLE IF NOT EXISTS cash_count_details (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id INTEGER NOT NULL,
      denomination INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      total REAL NOT NULL,
      type TEXT NOT NULL,
      FOREIGN KEY (session_id) REFERENCES cash_sessions(id)
    );
  `, [], () => done && done())));
}

function migrateCloudOutbox(tx, done){
  tx.executeSql(`CREATE TABLE IF NOT EXISTS outbox_sales(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    local_sale_id INTEGER NOT NULL,
    client_sale_id TEXT,
    payload_json TEXT NOT NULL,
    synced INTEGER NOT NULL DEFAULT 0,
    cloud_sale_id TEXT,
    created_at INTEGER NOT NULL,
    synced_at INTEGER
  );`);
  tx.executeSql(`CREATE UNIQUE INDEX IF NOT EXISTS idx_outbox_unique ON outbox_sales(client_sale_id);`);
  done && done();
}

function migrateProductsWeight(tx, done){
  tx.executeSql(`PRAGMA table_info(products);`, [], (_,_r)=>{
    let hasSold= false; let stockType='REAL'; let hasUpdatedAt=false;
    for(let i=0;i<_r.rows.length;i++){
      const col=_r.rows.item(i);
      if(col.name==='sold_by_weight') hasSold=true;
      if(col.name==='stock') stockType=col.type||'REAL';
      if(col.name==='updated_at') hasUpdatedAt=true;
    }
    const recreate = String(stockType).toUpperCase() !== 'REAL';
    if(recreate){
      tx.executeSql(`ALTER TABLE products RENAME TO _products_tmp;`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS products(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE NOT NULL,
        name TEXT, category TEXT,
        purchase_price REAL DEFAULT 0,
        sale_price REAL DEFAULT 0,
        expiry_date TEXT,
        stock REAL DEFAULT 0,
        sold_by_weight INTEGER DEFAULT 0,
        updated_at INTEGER
      );`);
      const insertSql = hasUpdatedAt
        ? `INSERT INTO products(id,barcode,name,category,purchase_price,sale_price,expiry_date,stock,updated_at,sold_by_weight)
                     SELECT id,barcode,name,category,purchase_price,sale_price,expiry_date,stock,updated_at,0 FROM _products_tmp;`
        : `INSERT INTO products(id,barcode,name,category,purchase_price,sale_price,expiry_date,stock,updated_at,sold_by_weight)
                     SELECT id,barcode,name,category,purchase_price,sale_price,expiry_date,stock,?,0 FROM _products_tmp;`;
      const insertParams = hasUpdatedAt ? [] : [Date.now()];
      tx.executeSql(insertSql, insertParams);
      tx.executeSql(`DROP TABLE _products_tmp;`);
      done&&done();
    } else if(!hasSold){
      tx.executeSql(`ALTER TABLE products ADD COLUMN sold_by_weight INTEGER DEFAULT 0;`, [], ()=>done&&done(), ()=>{ done&&done(); return true; });
    } else {
      done&&done();
    }
  }, ()=>{ done&&done(); return true; });
}

function migrateProductImages(tx, done){
  const cols = [
    { name: 'image_uri', def: 'TEXT' },
  ];
  ensureColumnsInTable(tx, 'products', cols, ()=> done && done());
}

function migrateSaleItemsQty(tx, done){
  tx.executeSql(`PRAGMA table_info(sale_items);`, [], (_,_r)=>{
    let qtyType='REAL';
    for(let i=0;i<_r.rows.length;i++){
      const col=_r.rows.item(i);
      if(col.name==='qty') qtyType=col.type||'REAL';
    }
    if(String(qtyType).toUpperCase() !== 'REAL'){
      tx.executeSql(`ALTER TABLE sale_items RENAME TO _sale_items_tmp;`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS sale_items(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        barcode TEXT NOT NULL,
        name TEXT,
        qty REAL NOT NULL,
        unit_price REAL NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
      );`);
      tx.executeSql(`INSERT INTO sale_items(id,sale_id,barcode,name,qty,unit_price,subtotal)
                     SELECT id,sale_id,barcode,name,qty,unit_price,subtotal FROM _sale_items_tmp;`);
      tx.executeSql(`DROP TABLE _sale_items_tmp;`);
      done&&done();
    } else {
      done&&done();
    }
  }, ()=>{ done&&done(); return true; });
}

function migrateSaleTransferProof(tx, done){
  const cols = [
    { name: 'transfer_receipt_uri', def: 'TEXT' },
    { name: 'transfer_receipt_name', def: 'TEXT' },
  ];
  ensureColumnsInTable(tx, 'sales', cols, ()=>
    ensureColumnsInTable(tx, 'sale', cols, ()=> done && done())
  );
}

// ---------- INIT ----------
export function initDB(){
  console.log('🔧 Inicializando base de datos...');
  return new Promise((resolve,reject)=>{
    // Primero optimizar la base de datos para mejor rendimiento
    try {
      db().exec([{ sql: "PRAGMA journal_mode = WAL;", args: [] }], false, () => {});
      db().exec([{ sql: "PRAGMA synchronous = NORMAL;", args: [] }], false, () => {});
      db().exec([{ sql: "PRAGMA foreign_keys = ON;", args: [] }], false, () => {});
    } catch (e) {
      console.warn('PRAGMA setup falló (no crítico):', e);
    }

    db().transaction((tx)=>{
      tx.executeSql(`PRAGMA foreign_keys = ON;`);

      // products & categories
      tx.executeSql(`CREATE TABLE IF NOT EXISTS products(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        barcode TEXT UNIQUE NOT NULL,
        name TEXT, category TEXT,
        purchase_price REAL DEFAULT 0,
        sale_price REAL DEFAULT 0,
        expiry_date TEXT,
        stock REAL DEFAULT 0,
        sold_by_weight INTEGER DEFAULT 0,
        image_uri TEXT,
        updated_at INTEGER
      );`);
      tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS categories(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );`);
      ['Bebidas','Abarrotes','Panes','Postres','Quesos','Cecinas','Helados','Hielo','Mascotas','Aseo'].forEach(cat=>{
        tx.executeSql(`INSERT OR IGNORE INTO categories(name) VALUES (?);`, [cat]);
      });

      // ventas locales
      tx.executeSql(`CREATE TABLE IF NOT EXISTS sales(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        total REAL NOT NULL,
        payment_method TEXT,
        cash_received REAL,
        change_given REAL,
        discount REAL DEFAULT 0,
        tax REAL DEFAULT 0,
        notes TEXT,
        transfer_receipt_uri TEXT,
        transfer_receipt_name TEXT,
        voided INTEGER DEFAULT 0,
        is_synced INTEGER DEFAULT 0,
        cloud_id TEXT
      );`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS sale_items(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        barcode TEXT NOT NULL,
        name TEXT,
        qty REAL NOT NULL,
        unit_price REAL NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
      );`);

      // compat por esquemas antiguos
      tx.executeSql(`CREATE TABLE IF NOT EXISTS sale(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        total REAL NOT NULL,
        transfer_receipt_uri TEXT,
        transfer_receipt_name TEXT
      );`);

      // templates (legacy, si existe tu editor)
      tx.executeSql(`CREATE TABLE IF NOT EXISTS templates(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS template_fields(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER NOT NULL,
        label TEXT NOT NULL,
        FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
      );`);

      // Ejecutar migraciones críticas en secuencia para evitar bloqueos
      const runMigrations = (index, doneCb) => {
        const migrations = [
          cb => migrateSalesSchema(tx, cb),
          cb => migrateCloudOutbox(tx, cb),
          cb => migrateProductsWeight(tx, cb),
          cb => migrateSaleItemsQty(tx, cb),
          cb => migrateProductImages(tx, cb),
          cb => migrateSaleTransferProof(tx, cb),
          cb => migrateCashManagement(tx, cb)
        ];
        
        if (index >= migrations.length) {
          console.log('✅ Todas las migraciones completadas exitosamente');
          doneCb();
          return;
        }
        
        try {
          console.log(`🔄 Ejecutando migración ${index + 1}/${migrations.length}...`);
          migrations[index](function() {
            // Ejecutar la siguiente migración inmediatamente para mantenernos dentro de la misma transacción.
            runMigrations(index + 1, doneCb);
          });
        } catch (err) {
          console.warn(`⚠️ Error en migración ${index}:`, err);
          runMigrations(index + 1, doneCb);
        }
      };

      // Iniciar migraciones en secuencia
      runMigrations(0, () => {
        console.log('📋 Migraciones completadas');
      });
    }, reject, ()=>resolve(true));
  });
}

// ---------- PRODUCTS ----------
export function insertOrUpdateProduct(p){
  const now=Date.now();
  const payload = {
    barcode:String(p.barcode||'').trim(),
    name:p.name??null, category:p.category??null,
    purchase_price:Number(p.purchasePrice ?? p.purchase_price ?? 0)||0,
    sale_price:Number(p.salePrice ?? p.sale_price ?? 0)||0,
    expiry_date:p.expiryDate ?? p.expiry_date ?? null,
    stock:Number(p.stock ?? 0)||0,
    sold_by_weight:Number(p.sold_by_weight ?? p.soldByWeight ?? 0)||0,
    image_uri:p.imageUri ?? p.image_uri ?? null,
  };
  if(!payload.barcode) return Promise.reject(new Error('barcode requerido'));
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(
        `INSERT INTO products (barcode,name,category,purchase_price,sale_price,expiry_date,stock,sold_by_weight,image_uri,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?)
         ON CONFLICT(barcode) DO UPDATE SET
           name=excluded.name, category=excluded.category,
           purchase_price=excluded.purchase_price, sale_price=excluded.sale_price,
           expiry_date=excluded.expiry_date, stock=excluded.stock, sold_by_weight=excluded.sold_by_weight, image_uri=excluded.image_uri, updated_at=excluded.updated_at;`,
        [payload.barcode,payload.name,payload.category,payload.purchase_price,payload.sale_price,payload.expiry_date,payload.stock,payload.sold_by_weight,payload.image_uri,now]
      );
    }, reject, ()=>resolve(true));
  });
}

export function upsertProductsBulk(list){
  const now = Date.now();
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      (list||[]).forEach(p=>{
        tx.executeSql(
          `INSERT INTO products (barcode,name,category,purchase_price,sale_price,expiry_date,stock,sold_by_weight,image_uri,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(barcode) DO UPDATE SET
            name=excluded.name, category=excluded.category,
            purchase_price=excluded.purchase_price, sale_price=excluded.sale_price,
            expiry_date=excluded.expiry_date, stock=excluded.stock, sold_by_weight=excluded.sold_by_weight, image_uri=excluded.image_uri, updated_at=?;`,
          [p.barcode, p.name, p.category, p.purchase_price||0, p.sale_price||0, p.expiry_date||null, p.stock||0, p.sold_by_weight||0, p.image_uri ?? p.imageUri ?? null, now, now]
        );
      });
    }, reject, ()=>resolve(true));
  });
}

export function listLocalProductsUpdatedAfter(){
  return new Promise((resolve)=> {
    db().transaction((tx)=>{
      tx.executeSql(`SELECT MAX(updated_at) as m FROM products;`, [], (_,_r)=>{
        resolve(_r.rows.item(0)?.m || 0);
      });
    });
  });
}

export function upsertCategoriesBulk(list){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      (list||[]).forEach(c=>{
        tx.executeSql(`INSERT OR IGNORE INTO categories(name) VALUES (?);`, [c.name]);
      });
    }, reject, ()=>resolve(true));
  });
}

export function getProductByBarcode(barcode){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(`SELECT * FROM products WHERE barcode = ? LIMIT 1;`, [String(barcode)], (_,_r)=>{
        resolve(_r.rows.length? _r.rows.item(0): null);
      });
    }, reject);
  });
}
export function listProducts(offset=0, limit=20, search=''){
  return new Promise((resolve,reject)=>{
    let sql = `SELECT * FROM products`;
    let params = [];
    if(search && search.trim()){
      sql += ` WHERE (name LIKE ? OR barcode LIKE ?)`;
      const like = `%${search.trim()}%`;
      params.push(like, like);
    }
    sql += ` ORDER BY updated_at DESC, name ASC, id DESC`;
    if(limit > 0){
      sql += ` LIMIT ?`;
      params.push(limit);
    }
    if(offset > 0){
      sql += ` OFFSET ?`;
      params.push(offset);
    }
    db().transaction((tx)=>{
      tx.executeSql(sql, params, (_,_r)=>resolve(rowsToArray(_r)));
    }, reject);
  });
}
export function getProductsCount(search = ''){
  return new Promise((resolve, reject)=>{
    let sql = `SELECT COUNT(*) as count FROM products`;
    const params = [];
    if(search && search.trim()){
      const like = `%${search.trim()}%`;
      sql += ` WHERE (name LIKE ? OR barcode LIKE ?)`;
      params.push(like, like);
    }
    db().transaction((tx)=>{
      tx.executeSql(
        sql,
        params,
        (_,_r)=>{
          const raw = _r.rows.length ? _r.rows.item(0).count : 0;
          resolve(Number(raw) || 0);
        }
      );
    }, reject);
  });
}
export function deleteProductByBarcode(barcode){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{ tx.executeSql(`DELETE FROM products WHERE barcode=?;`, [String(barcode)]); }, reject, ()=>resolve(true));
  });
}
export function exportAllProductsOrdered(){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(
        `SELECT barcode, barcode AS id, IFNULL(name,'') AS name, IFNULL(category,'') AS category,
                IFNULL(purchase_price,0) AS purchasePrice, IFNULL(sale_price,0) AS salePrice,
                IFNULL(expiry_date,'') AS expiryDate, IFNULL(stock,0) AS stock,
                IFNULL(sold_by_weight,0) AS soldByWeight,
                IFNULL(image_uri,'') AS imageUri
         FROM products ORDER BY name ASC, id DESC;`,
        [], (_,_r)=>resolve(rowsToArray(_r))
      );
    }, reject);
  });
}

// ---------- CATEGORIES ----------
export function listCategories(){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{ tx.executeSql(`SELECT * FROM categories ORDER BY name ASC;`, [], (_,_r)=>resolve(rowsToArray(_r))); }, reject);
  });
}
export function addCategory(name){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(`INSERT OR IGNORE INTO categories(name) VALUES (?);`, [name]);
      tx.executeSql(`SELECT * FROM categories WHERE name=?;`, [name], (_,_r)=> resolve(_r.rows.length? _r.rows.item(0) : {id:0,name}));
    }, reject);
  });
}

// ---------- SALES ----------
/** Registra venta local + encola para sync (outbox). */
export function recordSale(cart, opts = {}){
  const items = Array.isArray(cart) ? cart : [];
  const totalRaw = items.reduce((a,it)=> a + (Number(it.qty||0) * Number(it.unit_price||0)), 0);
  const discount = Number(opts.discount||0)||0;
  const tax = Number(opts.tax||0)||0;
  const total = Math.max(0, totalRaw - discount + tax);
  const ts = Date.now();
  const payment = opts.paymentMethod || 'efectivo';
  const cashReceived = Number(opts.amountPaid||0)||0;
  const change = Math.max(0, cashReceived - total);
  const notes = opts.note || null;
  const transferUri = opts.transferReceiptUri || null;
  const transferName = opts.transferReceiptName || null;

  const clientSaleId = `local-${ts}-${Math.random().toString(36).slice(2,8)}`;

  return new Promise((resolve,reject)=>{
    let firstError=null;
    db().transaction((tx)=>{
      tx.executeSql(
        `INSERT INTO sales (ts,total,payment_method,cash_received,change_given,discount,tax,notes,transfer_receipt_uri,transfer_receipt_name,voided)
         VALUES (?,?,?,?,?,?,?,?,?,?,0);`,
        [ts,total,payment,cashReceived,change,discount,tax,notes,transferUri,transferName],
        (_insert,res)=>{
          const saleId = res.insertId;

          const itemsJson = [];
          items.forEach(it=>{
            const qty = Number(it.qty||0)||0;
            const unit = Number(it.unit_price||0)||0;
            const subtotal = qty*unit;
            itemsJson.push({ barcode:String(it.barcode), name:it.name||null, qty, unit_price:unit, subtotal });

            tx.executeSql(
              `INSERT INTO sale_items (sale_id,barcode,name,qty,unit_price,subtotal) VALUES (?,?,?,?,?,?);`,
              [saleId, String(it.barcode), it.name||null, qty, unit, subtotal],
              undefined,
              (_,_e)=>{ firstError = firstError || _e; return true; }
            );
            tx.executeSql(
              `UPDATE products SET stock = CASE WHEN IFNULL(stock,0) - ? < 0 THEN 0 ELSE IFNULL(stock,0) - ? END, updated_at = ?
               WHERE barcode = ?;`,
              [qty,qty,ts,String(it.barcode)],
              undefined,
              (_,_e)=>{ firstError = firstError || _e; return true; }
            );
          });

          // Encolar para sync
          const payload = {
            total,
            payment_method:payment,
            cash_received:cashReceived,
            change_given:change,
            discount,
            tax,
            notes,
            transfer_receipt_uri: transferUri,
            transfer_receipt_name: transferName,
            client_sale_id: clientSaleId,
            items: itemsJson
          };
          tx.executeSql(
            `INSERT OR IGNORE INTO outbox_sales (local_sale_id, client_sale_id, payload_json, synced, created_at)
             VALUES (?, ?, ?, 0, ?);`,
            [saleId, clientSaleId, JSON.stringify(payload), ts],
            undefined,
            (_,_e)=>{ firstError = firstError || _e; return true; }
          );
        },
        (_,_e)=>{ firstError = firstError || _e; return true; }
      );
    }, (txErr)=> reject(firstError||txErr), ()=> resolve({ ok:true, ts, clientSaleId }) );
  });
}

export function insertSaleFromCloud(payload){
  const items = Array.isArray(payload?.items) ? payload.items : [];
  const ts = Number(payload?.ts || Date.now());
  const total = Number(payload?.total || 0);
  const payment = payload?.payment_method || payload?.paymentMethod || null;
  const cashReceived = payload?.cash_received ?? payload?.cashReceived ?? null;
  const change = payload?.change_given ?? payload?.changeGiven ?? null;
  const discount = Number(payload?.discount || 0) || 0;
  const tax = Number(payload?.tax || 0) || 0;
  const notes = payload?.notes || null;
  const transferUri = payload?.transfer_receipt_uri ?? payload?.transferReceiptUri ?? null;
  const transferName = payload?.transfer_receipt_name ?? payload?.transferReceiptName ?? null;
  const cloudId = payload?.cloud_id ?? null;

  return new Promise((resolve,reject)=>{
    let firstError=null;
    db().transaction((tx)=>{
      // Verificar si ya existe una venta con el mismo timestamp y total
      tx.executeSql(
        `SELECT id FROM sales WHERE ts = ? AND total = ? LIMIT 1;`,
        [ts, total],
        (_checkTx, checkRes) => {
          if (checkRes.rows.length > 0) {
            console.log(`⏭️ Venta duplicada encontrada: ts=${ts}, total=${total}, saltando inserción`);
            resolve(checkRes.rows.item(0).id);
            return;
          }
          
          // No existe, proceder con la inserción
          tx.executeSql(
            `INSERT INTO sales (ts,total,payment_method,cash_received,change_given,discount,tax,notes,transfer_receipt_uri,transfer_receipt_name,voided,is_synced,cloud_id)
             VALUES (?,?,?,?,?,?,?,?,?,?,0,1,?);`,
            [ts,total,payment,cashReceived,change,discount,tax,notes,transferUri,transferName,cloudId],
            (_insert,res)=>{
              const saleId = res.insertId;
              console.log(`✅ Venta desde cloud insertada: saleId=${saleId}, ts=${ts}, total=${total}`);
              
              (items||[]).forEach(it=>{
                const qty = Number(it.qty||0)||0;
                const unit = Number(it.unit_price||0)||0;
                const subtotal = qty*unit;
                tx.executeSql(
                  `INSERT INTO sale_items (sale_id,barcode,name,qty,unit_price,subtotal) VALUES (?,?,?,?,?,?);`,
                  [saleId, String(it.barcode), it.name||null, qty, unit, subtotal],
                  undefined,
                  (_,_e)=>{ firstError = firstError || _e; return true; }
                );
                tx.executeSql(
                  `UPDATE products SET stock = CASE WHEN IFNULL(stock,0) - ? < 0 THEN 0 ELSE IFNULL(stock,0) - ? END, updated_at = ? WHERE barcode = ?;`,
                  [qty,qty,ts,String(it.barcode)],
                  undefined,
                  (_,_e)=>{ firstError = firstError || _e; return true; }
                );
              });
            },
            (_,_e)=>{ firstError = firstError || _e; return true; }
          );
        },
        (_,_e)=>{ firstError = firstError || _e; return true; }
      );
    }, (txErr)=> reject(firstError||txErr), ()=> resolve(true) );
  });
}

export function updateSaleTransferReceipt(saleId, proofUri, proofName) {
  return new Promise((resolve, reject) => {
    const uri = proofUri || null;
    const name = proofName || null;
    const now = Date.now();

    db().transaction((tx) => {
      tx.executeSql(
        `UPDATE sales SET transfer_receipt_uri = ?, transfer_receipt_name = ?, is_synced = 0 WHERE id = ?;`,
        [uri, name, saleId],
      );

      tx.executeSql(
        `SELECT total, payment_method, cash_received, change_given, discount, tax, notes FROM sales WHERE id = ? LIMIT 1;`,
        [saleId],
        (_tx, saleRes) => {
          if (!saleRes.rows.length) return;
          const sale = saleRes.rows.item(0);

          tx.executeSql(
            `SELECT barcode, name, qty, unit_price, subtotal FROM sale_items WHERE sale_id = ?;`,
            [saleId],
            (_txItems, itemsRes) => {
              const items = rowsToArray(itemsRes).map((it) => ({
                barcode: String(it.barcode),
                name: it.name,
                qty: Number(it.qty || 0),
                unit_price: Number(it.unit_price || 0),
                subtotal: Number(it.subtotal || 0),
              }));

              tx.executeSql(
                `SELECT id, client_sale_id FROM outbox_sales WHERE local_sale_id = ? LIMIT 1;`,
                [saleId],
                (_txOutbox, outboxRes) => {
                  let clientId = `local-${now}-${Math.random().toString(36).slice(2, 8)}`;
                  let outboxId = null;

                  if (outboxRes.rows.length) {
                    const row = outboxRes.rows.item(0);
                    outboxId = row.id;
                    if (row.client_sale_id) clientId = row.client_sale_id;
                  }

                  const payload = {
                    total: sale.total,
                    payment_method: sale.payment_method,
                    cash_received: sale.cash_received,
                    change_given: sale.change_given,
                    discount: sale.discount,
                    tax: sale.tax,
                    notes: sale.notes,
                    transfer_receipt_uri: uri,
                    transfer_receipt_name: name,
                    client_sale_id: clientId,
                    items,
                  };

                  const payloadJson = JSON.stringify(payload);

                  if (outboxId) {
                    tx.executeSql(
                      `UPDATE outbox_sales SET payload_json = ?, synced = 0, synced_at = NULL WHERE id = ?;`,
                      [payloadJson, outboxId],
                    );
                  } else {
                    tx.executeSql(
                      `INSERT INTO outbox_sales (local_sale_id, client_sale_id, payload_json, synced, created_at)
                       VALUES (?, ?, ?, 0, ?);`,
                      [saleId, clientId, payloadJson, now],
                    );
                  }
                }
              );
            }
          );
        }
      );
    }, reject, () => resolve(true));
  });
}

export function listRecentSales(limit=50){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(
        `SELECT id,ts,total,payment_method,cash_received,change_given,discount,tax,voided
           FROM sales WHERE COALESCE(voided,0)=0
           ORDER BY ts DESC LIMIT ?;`,
        [limit], (_,_r)=>resolve(rowsToArray(_r))
      );
    }, reject);
  });
}

export function getLastSaleTs(){
  return new Promise(resolve=>{
    db().transaction(tx=>{
      tx.executeSql(`SELECT MAX(ts) as m FROM sales;`, [], (_,_r)=>{
        resolve(_r.rows.item(0)?.m || 0);
      });
    });
  });
}
export function listSalesBetween(fromTs,toTs){
  return new Promise((resolve,reject)=>{
    const params=[]; let where='WHERE COALESCE(voided,0)=0';
    if(typeof fromTs==='number'){ where+=' AND ts >= ?'; params.push(fromTs); }
    if(typeof toTs==='number'){ where+=' AND ts <= ?'; params.push(toTs); }
    db().transaction((tx)=>{
      tx.executeSql(`SELECT id,ts,total,payment_method,cash_received,change_given,discount,tax,voided,transfer_receipt_uri,transfer_receipt_name FROM sales ${where} ORDER BY ts DESC;`,
        params, (_,_r)=>resolve(rowsToArray(_r)));
    }, reject);
  });
}
export function getSaleWithItems(saleId){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(`SELECT * FROM sales WHERE id=?;`, [saleId], (_,_sr)=>{
        if(!_sr.rows.length) return resolve(null);
        const sale=_sr.rows.item(0);
        tx.executeSql(`SELECT * FROM sale_items WHERE sale_id=? ORDER BY id ASC;`, [saleId], (_,_ir)=>{
          resolve({ sale, items: rowsToArray(_ir) });
        });
      });
    }, reject);
  });
}
export function exportSalesCSV(fromTs,toTs){
  return new Promise((resolve,reject)=>{
    const params=[]; let where='WHERE COALESCE(s.voided,0)=0';
    if(typeof fromTs==='number'){ where+=' AND s.ts >= ?'; params.push(fromTs); }
    if(typeof toTs==='number'){ where+=' AND s.ts <= ?'; params.push(toTs); }
    db().transaction((tx)=>{
      tx.executeSql(
        `SELECT s.id,s.ts,s.total,s.payment_method,s.cash_received,s.change_given,s.discount,s.tax,
                i.barcode,i.name,i.qty,i.unit_price,i.subtotal
           FROM sales s JOIN sale_items i ON i.sale_id=s.id
           ${where}
           ORDER BY s.ts DESC, i.id ASC;`,
        params, (_,_r)=>{
          let csv='sale_id,ts,total,payment_method,cash_received,change_given,discount,tax,barcode,name,qty,unit_price,subtotal\n';
          for(let i=0;i<_r.rows.length;i++){
            const r=_r.rows.item(i);
            const line=[r.id,r.ts,r.total,r.payment_method||'',r.cash_received??'',r.change_given??'',r.discount??0,r.tax??0,
              `"${String(r.barcode).replace(/"/g,'""')}"`,`"${String(r.name||'').replace(/"/g,'""')}"`,r.qty,r.unit_price,r.subtotal].join(',');
            csv+=line+'\n';
          } resolve(csv);
        });
    }, reject);
  });
}
export function voidSale(saleId){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(`SELECT barcode, qty FROM sale_items WHERE sale_id=?;`, [saleId], (_,_ir)=>{
        const items=rowsToArray(_ir); const ts=Date.now();
        items.forEach(it=>{
          tx.executeSql(`UPDATE products SET stock = IFNULL(stock,0) + ?, updated_at=? WHERE barcode=?;`, [Number(it.qty||0)||0, ts, String(it.barcode)]);
        });
        tx.executeSql(`UPDATE sales SET voided=1 WHERE id=?;`, [saleId]);
      });
    }, reject, ()=>resolve(true));
  });
}
export function getSalesSeries(fromTs,toTs,granularity='day'){
  const fmt = granularity==='month' ? '%Y-%m' : '%Y-%m-%d';
  return new Promise((resolve,reject)=>{
    const params=[]; let where='WHERE COALESCE(voided,0)=0';
    if(typeof fromTs==='number'){ where+=' AND ts >= ?'; params.push(fromTs); }
    if(typeof toTs==='number'){ where+=' AND ts <= ?'; params.push(toTs); }
    db().transaction((tx)=>{
      tx.executeSql(
        `SELECT strftime('${fmt}', ts/1000, 'unixepoch', 'localtime') AS bucket,
                SUM(total) AS total, COUNT(*) AS n
           FROM sales ${where} GROUP BY bucket ORDER BY bucket ASC;`,
        params, (_,_r)=>resolve(rowsToArray(_r)));
    }, reject);
  });
}

// ---------- OUTBOX / SYNC ----------
export function getUnsyncedSales(){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(
        `SELECT o.id as outbox_id, o.local_sale_id, o.client_sale_id, o.payload_json,
                s.total, s.payment_method, s.cash_received, s.change_given, s.discount, s.tax, s.notes,
                s.transfer_receipt_uri, s.transfer_receipt_name
           FROM outbox_sales o
           JOIN sales s ON s.id=o.local_sale_id
          WHERE o.synced=0
          ORDER BY o.created_at ASC
          LIMIT 50;`,
        [], (_,_r)=> {
          const list = rowsToArray(_r).map(r => ({
            outbox_id: r.outbox_id,
            local_sale_id: r.local_sale_id,
            client_sale_id: r.client_sale_id,
            items_json: JSON.parse(r.payload_json).items,
            total: r.total,
            payment_method: r.payment_method,
            cash_received: r.cash_received,
            change_given: r.change_given,
            discount: r.discount,
            tax: r.tax,
            notes: r.notes,
            transfer_receipt_uri: r.transfer_receipt_uri,
            transfer_receipt_name: r.transfer_receipt_name
          }));
          resolve(list);
        }
      );
    }, reject);
  });
}
export function markSaleSynced(localSaleId, cloudSaleId){
  return new Promise((resolve,reject)=>{
    const now=Date.now();
    db().transaction((tx)=>{
      tx.executeSql(`UPDATE outbox_sales SET synced=1, cloud_sale_id=?, synced_at=? WHERE local_sale_id=?;`, [String(cloudSaleId||''), now, localSaleId]);
    }, reject, ()=>resolve(true));
  });
}

// === FUNCIONES DE MANEJO DE CAJA ===

// Abrir nueva sesión de caja chica
export function openCashSession(openingAmount, userId, userName) {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      const startDate = new Date().toISOString();
      tx.executeSql(
        `INSERT INTO cash_sessions (start_date, opening_amount, opened_by, status) VALUES (?, ?, ?, 'open')`,
        [startDate, openingAmount, `${userId}|${userName}`],
        (_, result) => resolve(result.insertId),
        (_, error) => reject(error)
      );
    });
  });
}

// Obtener sesión de caja actual (abierta)
export function getCurrentCashSession() {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      tx.executeSql(
        `SELECT * FROM cash_sessions WHERE status = 'open' ORDER BY id DESC LIMIT 1`,
        [],
        (_, result) => resolve(result.rows.length > 0 ? result.rows.item(0) : null)
      );
    }, reject);
  });
}

// Calcular monto esperado en caja
export function calculateExpectedCashAmount(sessionId) {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      // Primero obtener datos de la sesión
      tx.executeSql(
        `SELECT opening_amount, start_date FROM cash_sessions WHERE id = ?`,
        [sessionId],
        (_, sessionResult) => {
          if (sessionResult.rows.length === 0) {
            reject(new Error('Sesión no encontrada'));
            return;
          }
          
          const session = sessionResult.rows.item(0);
          const openingAmount = session.opening_amount;
          const startTimestamp = new Date(session.start_date).getTime();
          
          // Obtener ventas desde que se abrió la caja
          tx.executeSql(
            `SELECT 
              COALESCE(SUM(CASE WHEN (payment_method IS NULL OR payment_method = '' OR payment_method = 'efectivo' OR payment_method = 'cash') THEN COALESCE(cash_received, total) ELSE 0 END), 0) as cash_received,
              COALESCE(SUM(CASE WHEN (payment_method IS NULL OR payment_method = '' OR payment_method = 'efectivo' OR payment_method = 'cash') THEN COALESCE(change_given, 0) ELSE 0 END), 0) as total_change
             FROM sales 
             WHERE ts >= ? AND voided = 0`,
            [startTimestamp],
            (_, salesResult) => {
              const data = salesResult.rows.item(0);
              // Fórmula corregida: monto inicial + dinero recibido - vuelto dado
              const expectedAmount = openingAmount + data.cash_received - data.total_change;
              
              resolve({
                openingAmount,
                cashReceived: data.cash_received,
                totalChange: data.total_change,
                expectedAmount
              });
            },
            (_, error) => reject(error)
          );
        },
        (_, error) => reject(error)
      );
    });
  });
}

// Cerrar sesión de caja con arqueo
export function closeCashSession(sessionId, actualAmount, countDetails, userId, userName, nextDayAmount = 0, notes = '') {
  return new Promise((resolve, reject) => {
    calculateExpectedCashAmount(sessionId).then(cashData => {
      const difference = actualAmount - cashData.expectedAmount;
      const endDate = new Date().toISOString();
      const amountToSafe = actualAmount - nextDayAmount; // Lo que va a caja fuerte
      
      db().transaction((tx) => {
        // Cerrar la sesión de caja
        tx.executeSql(
          `UPDATE cash_sessions SET 
            end_date = ?, 
            expected_amount = ?, 
            actual_amount = ?, 
            difference = ?, 
            closed_by = ?, 
            notes = ?, 
            status = 'closed' 
           WHERE id = ?`,
          [endDate, cashData.expectedAmount, actualAmount, difference, `${userId}|${userName}`, notes, sessionId],
          (_, result) => {
            // Guardar detalles del conteo si existen
            if (countDetails && countDetails.length > 0) {
              countDetails.forEach(detail => {
                tx.executeSql(
                  `INSERT INTO cash_count_details (session_id, denomination, quantity, total, type) VALUES (?, ?, ?, ?, ?)`,
                  [sessionId, detail.denomination, detail.quantity, detail.total, detail.type]
                );
              });
            }
            
            // Depositar el dinero a caja fuerte (descontando lo del día siguiente)
            if (amountToSafe > 0) {
              const description = nextDayAmount > 0 
                ? `Depósito al cerrar caja - Sesión ${sessionId} (Dejando $${nextDayAmount.toLocaleString()} para mañana)`
                : `Depósito automático al cerrar caja - Sesión ${sessionId}`;
                
              tx.executeSql(
                `INSERT INTO safe_movements (type, amount, description, session_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
                ['deposit', amountToSafe, description, sessionId, `${userId}|${userName}`, endDate],
                () => {
                  resolve({
                    expectedAmount: cashData.expectedAmount,
                    actualAmount,
                    difference,
                    nextDayAmount,
                    amountToSafe,
                    success: true
                  });
                },
                (_, error) => reject(error)
              );
            } else {
              resolve({
                expectedAmount: cashData.expectedAmount,
                actualAmount,
                difference,
                nextDayAmount,
                amountToSafe: 0,
                success: true
              });
            }
          },
          (_, error) => reject(error)
        );
      });
    }).catch(reject);
  });
}

// Depositar dinero en caja fuerte
export function depositToSafe(amount, description, sessionId = null, userId, userName) {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      tx.executeSql(
        `INSERT INTO safe_movements (type, amount, description, session_id, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
        ['deposit', amount, description, sessionId, `${userId}|${userName}`, new Date().toISOString()],
        (_, result) => resolve(result.insertId),
        (_, error) => reject(error)
      );
    });
  });
}

// Retirar dinero de caja fuerte
export function withdrawFromSafe(amount, description, userId, userName) {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      tx.executeSql(
        `INSERT INTO safe_movements (type, amount, description, created_by, created_at) VALUES (?, ?, ?, ?, ?)`,
        ['withdrawal', amount, description, `${userId}|${userName}`, new Date().toISOString()],
        (_, result) => resolve(result.insertId),
        (_, error) => reject(error)
      );
    });
  });
}

// Obtener balance actual de caja fuerte
export function getSafeBalance() {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      tx.executeSql(
        `SELECT 
          COALESCE(SUM(CASE WHEN type = 'deposit' THEN amount ELSE -amount END), 0) as balance,
          COUNT(*) as total_movements
         FROM safe_movements`,
        [],
        (_, result) => resolve(result.rows.item(0))
      );
    }, reject);
  });
}

// Obtener historial de sesiones de caja
export function getCashSessionsHistory(limit = 30) {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      tx.executeSql(
        `SELECT * FROM cash_sessions ORDER BY id DESC LIMIT ?`,
        [limit],
        (_, result) => resolve(rowsToArray(result))
      );
    }, reject);
  });
}

// Obtener movimientos de caja fuerte
export function getSafeMovements(limit = 50) {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      tx.executeSql(
        `SELECT * FROM safe_movements ORDER BY id DESC LIMIT ?`,
        [limit],
        (_, result) => resolve(rowsToArray(result))
      );
    }, reject);
  });
}

// Obtener historial completo de transacciones de caja
export function getCashTransactionsHistory(limit = 50) {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      // Obtener sesiones de caja (apertura y cierre)
      tx.executeSql(`
        SELECT 
          'session_start' as type,
          cs.start_date as timestamp,
          cs.opening_amount as amount,
          'Apertura de caja' as description,
          cs.opened_by as user,
          cs.id as reference_id
        FROM cash_sessions cs
        WHERE cs.start_date IS NOT NULL
        
        UNION ALL
        
        SELECT 
          'session_end' as type,
          cs.end_date as timestamp,
          cs.actual_amount as amount,
          'Cierre de caja' as description,
          cs.closed_by as user,
          cs.id as reference_id
        FROM cash_sessions cs
        WHERE cs.end_date IS NOT NULL
        
        ORDER BY timestamp DESC
        LIMIT ?
      `, [Math.min(limit, 20)], 
      (_, result) => {
        const sessions = rowsToArray(result);
        
        // Obtener movimientos de caja fuerte
        tx.executeSql(`
          SELECT 
            'safe_movement' as type,
            sm.created_at as timestamp,
            CASE 
              WHEN sm.type = 'deposit' THEN sm.amount
              WHEN sm.type = 'withdrawal' THEN -sm.amount
              ELSE sm.amount
            END as amount,
            CASE 
              WHEN sm.type = 'deposit' THEN 'Depósito en caja fuerte'
              WHEN sm.type = 'withdrawal' THEN 'Retiro de caja fuerte'
              ELSE sm.type
            END as description,
            sm.created_by as user,
            sm.id as reference_id
          FROM safe_movements sm
          ORDER BY sm.created_at DESC
          LIMIT ?
        `, [Math.min(limit, 20)],
        (_, movementsResult) => {
          const movements = rowsToArray(movementsResult);
          
          // Obtener ventas con efectivo
          tx.executeSql(`
            SELECT 
              'sale' as type,
              datetime(s.ts/1000, 'unixepoch') as timestamp,
              s.cash_received as amount,
              'Venta - Efectivo: $' || COALESCE(s.cash_received, 0) || ' | Cambio: $' || COALESCE(s.change_given, 0) as description,
              'Sistema' as user,
              s.id as reference_id
            FROM sales s
            WHERE s.cash_received > 0 AND s.voided = 0
            ORDER BY s.ts DESC
            LIMIT ?
          `, [Math.min(limit, 20)],
          (_, salesResult) => {
            const sales = rowsToArray(salesResult);
            
            // Combinar y ordenar todos los resultados
            const allTransactions = [...sessions, ...movements, ...sales];
            allTransactions.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
            
            resolve(allTransactions.slice(0, limit));
          },
          (_, error) => {
            console.warn('Error obteniendo ventas:', error);
            resolve([...sessions, ...movements].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)));
          });
        },
        (_, error) => {
          console.warn('Error obteniendo movimientos:', error);
          resolve(sessions);
        });
      },
      (_, error) => {
        console.warn('Error obteniendo sesiones:', error);
        resolve([]);
      });
    }, 
    (error) => {
      console.error('Error en transacción de historial:', error);
      resolve([]);
    });
  });
}
