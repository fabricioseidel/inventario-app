// src/db.js
import * as SQLite from 'expo-sqlite';

let _db = null;
function db() { if (!_db) _db = SQLite.openDatabase('olivomarket.db'); return _db; }
function rowsToArray(res) { const out=[]; for (let i=0;i<res.rows.length;i++) out.push(res.rows.item(i)); return out; }

// ---------- MIGRACIONES ----------
function ensureColumnsInTable(tx, table, columnDefs, done){
  tx.executeSql(`PRAGMA table_info(${table});`, [], (_,_res)=>{
    const existing = new Set();
    for (let i=0;i<_res.rows.length;i++) existing.add(_res.rows.item(i).name);
    const toAdd = columnDefs.filter(c=>!existing.has(c.name));
    const run = (i)=> {
      if (i>=toAdd.length) return done && done();
      const c = toAdd[i];
      tx.executeSql(`ALTER TABLE ${table} ADD COLUMN ${c.name} ${c.def};`, [], ()=>run(i+1), ()=>run(i+1));
    };
    run(0);
  }, ()=>{ done && done(); return true; });
}

function migrateSalesSchema(tx, done){
  const colsBase = [
    { name:'payment_method', def:'TEXT' },
    { name:'cash_received',  def:'REAL' },
    { name:'change_given',   def:'REAL' },
    { name:'discount',       def:'REAL DEFAULT 0' },
    { name:'tax',            def:'REAL DEFAULT 0' },
    { name:'notes',          def:'TEXT' },
    { name:'voided',         def:'INTEGER DEFAULT 0' }, // NUEVO para anulación
  ];
  ensureColumnsInTable(tx, 'sales', colsBase, ()=> ensureColumnsInTable(tx, 'sale', colsBase, ()=> done && done()));
}

// ---------- INIT ----------
export function initDB(){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(`PRAGMA foreign_keys = ON;`);

      // products
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

      // categories
      tx.executeSql(`CREATE TABLE IF NOT EXISTS categories(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL
      );`);
      ['Bebidas','Abarrotes','Panes','Postres','Quesos','Cecinas','Helados','Hielo','Mascotas','Aseo'].forEach(cat=>{
        tx.executeSql(`INSERT OR IGNORE INTO categories(name) VALUES (?);`, [cat]);
      });

      // sales + sale_items
      tx.executeSql(`CREATE TABLE IF NOT EXISTS sales(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ts INTEGER NOT NULL,
        total REAL NOT NULL
        -- columnas extra por migración
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

      // templates (compat)
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

      // migraciones
      migrateSalesSchema(tx, ()=>{});
    }, reject, ()=>resolve(true));
  });
}

// ---------- PRODUCTS ----------
export function insertOrUpdateProduct(p){
  const now = Date.now();
  const payload = {
    barcode: String(p.barcode||'').trim(),
    name: p.name ?? null,
    category: p.category ?? null,
    purchase_price: Number(p.purchasePrice ?? p.purchase_price ?? 0) || 0,
    sale_price: Number(p.salePrice ?? p.sale_price ?? 0) || 0,
    expiry_date: p.expiryDate ?? p.expiry_date ?? null,
    stock: Number(p.stock ?? 0) || 0
  };
  if (!payload.barcode) return Promise.reject(new Error('barcode requerido'));
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(
        `INSERT INTO products (barcode,name,category,purchase_price,sale_price,expiry_date,stock,updated_at)
         VALUES (?,?,?,?,?,?,?,?)
         ON CONFLICT(barcode) DO UPDATE SET
          name=excluded.name, category=excluded.category,
          purchase_price=excluded.purchase_price, sale_price=excluded.sale_price,
          expiry_date=excluded.expiry_date, stock=excluded.stock, updated_at=excluded.updated_at;`,
        [payload.barcode,payload.name,payload.category,payload.purchase_price,payload.sale_price,payload.expiry_date,payload.stock,now]
      );
    }, reject, ()=>resolve(true));
  });
}

export function getProductByBarcode(barcode){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(`SELECT * FROM products WHERE barcode = ? LIMIT 1;`, [String(barcode)], (_,_r)=>{
        resolve(_r.rows.length ? _r.rows.item(0) : null);
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
    db().transaction((tx)=>{
      tx.executeSql(`DELETE FROM products WHERE barcode = ?;`, [String(barcode)]);
    }, reject, ()=>resolve(true));
  });
}

export function clearAllProducts(){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{ tx.executeSql(`DELETE FROM products;`); }, reject, ()=>resolve(true));
  });
}

export function exportAllProductsOrdered(){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(
        `SELECT barcode, barcode AS id,
                IFNULL(name,'') AS name, IFNULL(category,'') AS category,
                IFNULL(purchase_price,0) AS purchasePrice, IFNULL(sale_price,0) AS salePrice,
                IFNULL(expiry_date,'') AS expiryDate, IFNULL(stock,0) AS stock
         FROM products ORDER BY name ASC, id DESC;`, [], (_,_r)=>resolve(rowsToArray(_r)));
    }, reject);
  });
}

// ---------- CATEGORIES ----------
export function listCategories(){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(`SELECT * FROM categories ORDER BY name ASC;`, [], (_,_r)=>resolve(rowsToArray(_r)));
    }, reject);
  });
}
export function addCategory(name){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(`INSERT OR IGNORE INTO categories(name) VALUES (?);`, [name]);
      tx.executeSql(`SELECT * FROM categories WHERE name = ?;`, [name], (_,_r)=> resolve(_r.rows.length ? _r.rows.item(0) : {id:0,name}));
    }, reject);
  });
}

// ---------- SALES ----------
/** Registra venta y descuenta stock. cart: [{barcode,name,unit_price,qty}] */
export function recordSale(cart, opts = {}){
  const items = Array.isArray(cart) ? cart : [];
  const totalRaw = items.reduce((a,it)=> a + (Number(it.qty||0)*Number(it.unit_price||0)), 0);
  const discount = Number(opts.discount||0)||0;
  const tax = Number(opts.tax||0)||0;
  const total = Math.max(0, totalRaw - discount + tax);
  const ts = Date.now();
  const payment = opts.paymentMethod || 'efectivo';
  const cashReceived = Number(opts.amountPaid||0)||0;
  const change = Math.max(0, cashReceived - total);
  const notes = opts.note || null;

  return new Promise((resolve,reject)=>{
    let firstError = null;
    db().transaction((tx)=>{
      tx.executeSql(
        `INSERT INTO sales (ts,total,payment_method,cash_received,change_given,discount,tax,notes,voided)
         VALUES (?,?,?,?,?,?,?, ?, 0);`,
        [ts,total,payment,cashReceived,change,discount,tax,notes],
        (_ins,res)=>{
          const saleId = res.insertId;
          items.forEach(it=>{
            const qty = Number(it.qty||0)||0;
            const unit = Number(it.unit_price||0)||0;
            const subtotal = qty*unit;
            tx.executeSql(
              `INSERT INTO sale_items (sale_id,barcode,name,qty,unit_price,subtotal) VALUES (?,?,?,?,?,?);`,
              [saleId,String(it.barcode), it.name||null, qty, unit, subtotal],
              undefined,
              (_,_e)=>{ firstError = firstError || _e; return true; }
            );
            tx.executeSql(
              `UPDATE products
                 SET stock = CASE WHEN IFNULL(stock,0) - ? < 0 THEN 0 ELSE IFNULL(stock,0) - ? END,
                     updated_at = ?
               WHERE barcode = ?;`,
              [qty,qty,ts,String(it.barcode)],
              undefined,
              (_,_e)=>{ firstError = firstError || _e; return true; }
            );
          });
        },
        (_,_e)=>{ firstError = firstError || _e; return true; }
      );
    }, (txErr)=>reject(firstError||txErr), ()=>resolve({ok:true,ts}));
  });
}

/** Lista recientes (no anuladas) */
export function listRecentSales(limit=50){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(
        `SELECT id,ts,total,payment_method,cash_received,change_given,discount,tax,voided
           FROM sales
          WHERE COALESCE(voided,0)=0
          ORDER BY ts DESC
          LIMIT ?;`,
        [limit],
        (_,_r)=>resolve(rowsToArray(_r))
      );
    }, reject);
  });
}

/** Lista por rango (no anuladas) */
export function listSalesBetween(fromTs, toTs){
  return new Promise((resolve,reject)=>{
    const params=[]; let where = 'WHERE COALESCE(voided,0)=0';
    if (typeof fromTs === 'number'){ where += ' AND ts >= ?'; params.push(fromTs); }
    if (typeof toTs === 'number'){ where += ' AND ts <= ?'; params.push(toTs); }
    db().transaction((tx)=>{
      tx.executeSql(
        `SELECT id,ts,total,payment_method,cash_received,change_given,discount,tax,voided
           FROM sales
           ${where}
          ORDER BY ts DESC;`,
        params,
        (_,_r)=>resolve(rowsToArray(_r))
      );
    }, reject);
  });
}

/** Detalle de venta */
export function getSaleWithItems(saleId){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      tx.executeSql(`SELECT * FROM sales WHERE id = ?;`, [saleId], (_,_sres)=>{
        if (!_sres.rows.length) return resolve(null);
        const sale = _sres.rows.item(0);
        tx.executeSql(`SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id ASC;`, [saleId], (_,_ires)=>{
          resolve({ sale, items: rowsToArray(_ires) });
        });
      });
    }, reject);
  });
}

/** Export CSV por rango (no anuladas) */
export function exportSalesCSV(fromTs,toTs){
  return new Promise((resolve,reject)=>{
    const params=[]; let where='WHERE COALESCE(s.voided,0)=0';
    if (typeof fromTs==='number'){ where += ' AND s.ts >= ?'; params.push(fromTs); }
    if (typeof toTs==='number'){ where += ' AND s.ts <= ?'; params.push(toTs); }
    db().transaction((tx)=>{
      tx.executeSql(
        `SELECT s.id,s.ts,s.total,s.payment_method,s.cash_received,s.change_given,s.discount,s.tax,
                i.barcode,i.name,i.qty,i.unit_price,i.subtotal
           FROM sales s
           JOIN sale_items i ON i.sale_id=s.id
           ${where}
          ORDER BY s.ts DESC, i.id ASC;`,
        params,
        (_,_r)=>{
          let csv = 'sale_id,ts,total,payment_method,cash_received,change_given,discount,tax,barcode,name,qty,unit_price,subtotal\n';
          for (let i=0;i<_r.rows.length;i++){
            const r = _r.rows.item(i);
            const line = [
              r.id, r.ts, r.total, r.payment_method||'', r.cash_received??'', r.change_given??'',
              r.discount??0, r.tax??0,
              `"${String(r.barcode).replace(/"/g,'""')}"`,
              `"${String(r.name||'').replace(/"/g,'""')}"`,
              r.qty, r.unit_price, r.subtotal
            ].join(',');
            csv += line+'\n';
          }
          resolve(csv);
        }
      );
    }, reject);
  });
}

/** ANULAR venta: repone stock y marca voided=1 */
export function voidSale(saleId){
  return new Promise((resolve,reject)=>{
    db().transaction((tx)=>{
      // traer ítems
      tx.executeSql(`SELECT barcode, qty FROM sale_items WHERE sale_id = ?;`, [saleId], (_,_ires)=>{
        const items = rowsToArray(_ires);
        const ts = Date.now();
        // reponer stock
        items.forEach(it=>{
          const qty = Number(it.qty||0)||0;
          tx.executeSql(
            `UPDATE products SET stock = IFNULL(stock,0) + ?, updated_at=? WHERE barcode = ?;`,
            [qty, ts, String(it.barcode)]
          );
        });
        // marcar anulada
        tx.executeSql(`UPDATE sales SET voided=1 WHERE id=?;`, [saleId]);
      });
    }, reject, ()=>resolve(true));
  });
}

/** Serie de ventas por día o mes (no anuladas) */
export function getSalesSeries(fromTs, toTs, granularity='day'){
  // granularity: 'day' | 'month'
  const fmt = granularity === 'month' ? '%Y-%m' : '%Y-%m-%d';
  return new Promise((resolve,reject)=>{
    const params=[]; let where='WHERE COALESCE(voided,0)=0';
    if (typeof fromTs==='number'){ where += ' AND ts >= ?'; params.push(fromTs); }
    if (typeof toTs==='number'){ where += ' AND ts <= ?'; params.push(toTs); }
    db().transaction((tx)=>{
      tx.executeSql(
        `SELECT strftime('${fmt}', ts/1000, 'unixepoch', 'localtime') AS bucket,
                SUM(total) AS total, COUNT(*) AS n
           FROM sales
           ${where}
          GROUP BY bucket
          ORDER BY bucket ASC;`,
        params,
        (_,_r)=> resolve(rowsToArray(_r))
      );
    }, reject);
  });
}