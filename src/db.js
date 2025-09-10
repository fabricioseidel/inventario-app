// src/db.js
import * as SQLite from 'expo-sqlite';

let _db = null;
function db(){ if(!_db) _db = SQLite.openDatabase('olivomarket.db'); return _db; }
function rowsToArray(res){ const a=[]; for(let i=0;i<res.rows.length;i++) a.push(res.rows.item(i)); return a; }

// ---------- MIGRACIONES ----------
function ensureColumnsInTable(tx, table, columnDefs, done){
  tx.executeSql(`PRAGMA table_info(${table});`, [], (_,_res)=>{
    const existing = new Set(); for(let i=0;i<_res.rows.length;i++) existing.add(_res.rows.item(i).name);
    const toAdd = columnDefs.filter(c=>!existing.has(c.name));
    const run=(i)=>{ if(i>=toAdd.length) return done&&done(); const c=toAdd[i];
      tx.executeSql(`ALTER TABLE ${table} ADD COLUMN ${c.name} ${c.def};`, [], ()=>run(i+1), ()=>run(i+1));
    }; run(0);
  }, ()=>{ done&&done(); return true; });
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

function migrateProductWeight(tx, done){
  ensureColumnsInTable(tx, 'products', [
    { name:'by_weight', def:'INTEGER DEFAULT 0' }
  ], done);
}

function migrateSaleItemsQty(tx, done){
  tx.executeSql(`PRAGMA table_info(sale_items);`, [], (_,res)=>{
    const cols = rowsToArray(res);
    const qtyCol = cols.find(c=>c.name==='qty');
    if(qtyCol && String(qtyCol.type).toUpperCase()==='REAL') return done&&done();
    tx.executeSql(`ALTER TABLE sale_items RENAME TO sale_items_old;`, [], ()=>{
      tx.executeSql(`CREATE TABLE sale_items(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        barcode TEXT NOT NULL,
        name TEXT,
        qty REAL NOT NULL,
        unit_price REAL NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
      );`, [], ()=>{
        tx.executeSql(`INSERT INTO sale_items(id,sale_id,barcode,name,qty,unit_price,subtotal)
                       SELECT id,sale_id,barcode,name,qty,unit_price,subtotal FROM sale_items_old;`, [], ()=>{
          tx.executeSql(`DROP TABLE sale_items_old;`, [], ()=>done&&done(), ()=>done&&done());
        });
      });
    }, ()=>done&&done());
  }, ()=>done&&done());
}

// ---------- INIT ----------
export function initDB(){
  return new Promise((resolve,reject)=>{
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
        stock INTEGER DEFAULT 0,
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
        voided INTEGER DEFAULT 0
      );`);
      tx.executeSql(`CREATE TABLE IF NOT EXISTS sale_items(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        barcode TEXT NOT NULL,
        name TEXT,
        qty INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        subtotal REAL NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
      );`);

      // compat por esquemas antiguos
      tx.executeSql(`CREATE TABLE IF NOT EXISTS sale(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        total REAL NOT NULL
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

      migrateSalesSchema(tx, ()=>{});
      migrateCloudOutbox(tx, ()=>{});
      migrateProductWeight(tx, ()=>{});
      migrateSaleItemsQty(tx, ()=>{});
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
    by_weight: p.byWeight ?? p.by_weight ? 1 : 0
  };
  if(!payload.barcode) return Promise.reject(new Error('barcode requerido'));
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(
        `INSERT INTO products (barcode,name,category,purchase_price,sale_price,expiry_date,stock,by_weight,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?)
         ON CONFLICT(barcode) DO UPDATE SET
           name=excluded.name, category=excluded.category,
           purchase_price=excluded.purchase_price, sale_price=excluded.sale_price,
           expiry_date=excluded.expiry_date, stock=excluded.stock, by_weight=excluded.by_weight, updated_at=excluded.updated_at;`,
        [payload.barcode,payload.name,payload.category,payload.purchase_price,payload.sale_price,payload.expiry_date,payload.stock,payload.by_weight,now]
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
          `INSERT INTO products (barcode,name,category,purchase_price,sale_price,expiry_date,stock,by_weight,updated_at)
           VALUES (?,?,?,?,?,?,?,?,?)
           ON CONFLICT(barcode) DO UPDATE SET
            name=excluded.name, category=excluded.category,
            purchase_price=excluded.purchase_price, sale_price=excluded.sale_price,
            expiry_date=excluded.expiry_date, stock=excluded.stock, by_weight=excluded.by_weight, updated_at=?;`,
          [p.barcode, p.name, p.category, p.purchase_price||0, p.sale_price||0, p.expiry_date||null, p.stock||0, p.by_weight?1:0, now, now]
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

export function listLastSaleTs(){
  return new Promise((resolve)=>{
    db().transaction((tx)=>{
      tx.executeSql(`SELECT MAX(ts) as m FROM sales;`, [], (_,_r)=>{
        resolve(_r.rows.item(0)?.m || 0);
      });
    });
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
export function listProducts(){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(`SELECT * FROM products ORDER BY updated_at DESC, name ASC, id DESC;`, [], (_,_r)=>resolve(rowsToArray(_r)));
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
                IFNULL(expiry_date,'') AS expiryDate, IFNULL(stock,0) AS stock, IFNULL(by_weight,0) AS byWeight
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

  const clientSaleId = `local-${ts}-${Math.random().toString(36).slice(2,8)}`;

  return new Promise((resolve,reject)=>{
    let firstError=null;
    db().transaction((tx)=>{
      tx.executeSql(
        `INSERT INTO sales (ts,total,payment_method,cash_received,change_given,discount,tax,notes,voided)
         VALUES (?,?,?,?,?,?,?, ?, 0);`,
        [ts,total,payment,cashReceived,change,discount,tax,notes],
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
            total, payment_method:payment, cash_received:cashReceived, change_given:change,
            discount, tax, notes, client_sale_id: clientSaleId, items: itemsJson
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

  return new Promise((resolve,reject)=>{
    let firstError=null;
    db().transaction((tx)=>{
      tx.executeSql(
        `INSERT INTO sales (ts,total,payment_method,cash_received,change_given,discount,tax,notes,voided)
         VALUES (?,?,?,?,?,?,?, ?, 0);`,
        [ts,total,payment,cashReceived,change,discount,tax,notes],
        (_insert,res)=>{
          const saleId = res.insertId;
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
    }, (txErr)=> reject(firstError||txErr), ()=> resolve(true) );
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
export function listSalesBetween(fromTs,toTs){
  return new Promise((resolve,reject)=>{
    const params=[]; let where='WHERE COALESCE(voided,0)=0';
    if(typeof fromTs==='number'){ where+=' AND ts >= ?'; params.push(fromTs); }
    if(typeof toTs==='number'){ where+=' AND ts <= ?'; params.push(toTs); }
    db().transaction((tx)=>{
      tx.executeSql(`SELECT id,ts,total,payment_method,cash_received,change_given,discount,tax,voided FROM sales ${where} ORDER BY ts DESC;`,
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
                s.total, s.payment_method, s.cash_received, s.change_given, s.discount, s.tax, s.notes
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
            notes: r.notes
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
