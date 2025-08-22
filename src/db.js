// src/db.js
import * as SQLite from 'expo-sqlite';

let _db = null;
function db() {
  if (!_db) _db = SQLite.openDatabase('olivomarket.db');
  return _db;
}

/** Inicialización de BD y tablas */
export function initDB() {
  return new Promise((resolve, reject) => {
    db().transaction(
      (tx) => {
        // -------- Productos --------
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            barcode TEXT UNIQUE NOT NULL,
            name TEXT,
            category TEXT,
            purchase_price REAL DEFAULT 0,
            sale_price REAL DEFAULT 0,
            expiry_date TEXT,
            stock INTEGER DEFAULT 0,
            updated_at INTEGER
          );
        `);
        tx.executeSql(`CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);`);

        // -------- Categorías (semillas) --------
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
          );
        `);
        const defaults = ['Bebidas','Abarrotes','Panes','Postres','Quesos','Cecinas','Helados','Hielo','Mascotas','Aseo'];
        defaults.forEach((cat) => {
          tx.executeSql(`INSERT OR IGNORE INTO categories(name) VALUES (?);`, [cat]);
        });

        // -------- Ventas --------
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts INTEGER NOT NULL,
            total REAL NOT NULL,
            payment_method TEXT,
            cash_received REAL,
            change_given REAL,
            discount REAL,
            tax REAL,
            notes TEXT
          );
        `);
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS sale_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sale_id INTEGER NOT NULL,
            barcode TEXT NOT NULL,
            name TEXT,
            qty INTEGER NOT NULL,
            unit_price REAL NOT NULL,
            subtotal REAL NOT NULL,
            FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE
          );
        `);

        // -------- Soporte plantillas (por compatibilidad) --------
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS templates (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT UNIQUE NOT NULL
          );
        `);
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS template_fields (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            template_id INTEGER NOT NULL,
            label TEXT NOT NULL,
            FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE
          );
        `);
      },
      (err) => reject(err),
      () => resolve(true)
    );
  });
}

/* Utilidad: convertir rows a array */
function rowsToArray(res) {
  const out = [];
  for (let i = 0; i < res.rows.length; i++) out.push(res.rows.item(i));
  return out;
}

/* ====================== PRODUCTS ====================== */

export function insertOrUpdateProduct(p) {
  const now = Date.now();
  const payload = {
    barcode: String(p.barcode || '').trim(),
    name: p.name ?? null,
    category: p.category ?? null,
    purchase_price: Number(p.purchasePrice ?? p.purchase_price ?? 0),
    sale_price: Number(p.salePrice ?? p.sale_price ?? 0),
    expiry_date: p.expiryDate ?? p.expiry_date ?? null,
    stock: Number(p.stock ?? 0)
  };
  if (!payload.barcode) return Promise.reject(new Error('barcode requerido'));

  return new Promise((resolve, reject) => {
    db().transaction(
      (tx) => {
        tx.executeSql(
          `INSERT INTO products (barcode, name, category, purchase_price, sale_price, expiry_date, stock, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(barcode) DO UPDATE SET
             name=excluded.name,
             category=excluded.category,
             purchase_price=excluded.purchase_price,
             sale_price=excluded.sale_price,
             expiry_date=excluded.expiry_date,
             stock=excluded.stock,
             updated_at=excluded.updated_at;`,
          [
            payload.barcode,
            payload.name,
            payload.category,
            payload.purchase_price,
            payload.sale_price,
            payload.expiry_date,
            payload.stock,
            now
          ]
        );
      },
      (err) => reject(err),
      () => resolve(true)
    );
  });
}

export function getProductByBarcode(barcode) {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      tx.executeSql(
        `SELECT * FROM products WHERE barcode = ? LIMIT 1;`,
        [String(barcode)],
        (_, res) => resolve(res.rows.length ? res.rows.item(0) : null)
      );
    }, reject);
  });
}

export function listProducts() {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      tx.executeSql(
        `SELECT * FROM products ORDER BY updated_at DESC, name ASC, id DESC;`,
        [],
        (_, res) => resolve(rowsToArray(res))
      );
    }, reject);
  });
}

export function deleteProductByBarcode(barcode) {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      tx.executeSql(`DELETE FROM products WHERE barcode = ?;`, [String(barcode)]);
    }, reject, () => resolve(true));
  });
}

export function clearAllProducts() {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      tx.executeSql(`DELETE FROM products;`);
    }, reject, () => resolve(true));
  });
}

/* Export ordenado para CSV/JSON */
export function exportAllProductsOrdered() {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      tx.executeSql(
        `SELECT
           barcode,
           barcode AS id,
           IFNULL(name, '') AS name,
           IFNULL(category, '') AS category,
           IFNULL(purchase_price, 0) AS purchasePrice,
           IFNULL(sale_price, 0) AS salePrice,
           IFNULL(expiry_date, '') AS expiryDate,
           IFNULL(stock, 0) AS stock
         FROM products
         ORDER BY name ASC, id DESC;`,
        [],
        (_, res) => resolve(rowsToArray(res)),
        (_, err) => { console.error('exportAllProductsOrdered:', err); reject(err); return false; }
      );
    });
  });
}

/* ====================== CATEGORIES (mínimas) ====================== */

export function listCategories() {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      tx.executeSql(`SELECT * FROM categories ORDER BY name ASC;`, [], (_, res) => resolve(rowsToArray(res)));
    }, reject);
  });
}

export function addCategory(name) {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      tx.executeSql(`INSERT OR IGNORE INTO categories(name) VALUES (?);`, [name]);
      tx.executeSql(`SELECT * FROM categories WHERE name = ?;`, [name], (_, res) => {
        resolve(res.rows.length ? res.rows.item(0) : { id: 0, name });
      });
    }, reject);
  });
}

/* ====================== SALES ====================== */
/**
 * Registra una venta.
 * @param {Array} cart - elementos con { barcode, name, unit_price, qty }
 * @param {Object} opts - { paymentMethod, amountPaid, note, discount, tax }
 */
export function recordSale(cart, opts = {}) {
  const items = Array.isArray(cart) ? cart : [];
  const totalRaw = items.reduce((acc, it) => acc + Number(it.qty || 0) * Number(it.unit_price || 0), 0);
  const discount = Number(opts.discount || 0);
  const tax = Number(opts.tax || 0);
  const total = Math.max(0, totalRaw - discount + tax);

  const ts = Date.now();
  const payment = opts.paymentMethod || 'efectivo';
  const cashReceived = Number(opts.amountPaid || 0);
  const change = Math.max(0, cashReceived - total);
  const notes = opts.note || null;

  return new Promise((resolve, reject) => {
    db().transaction(
      (tx) => {
        // Insert venta
        tx.executeSql(
          `INSERT INTO sales (ts, total, payment_method, cash_received, change_given, discount, tax, notes)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?);`,
          [ts, total, payment, cashReceived, change, discount, tax, notes],
          (_, res) => {
            const saleId = res.insertId;

            // Insert items + descontar stock
            items.forEach((it) => {
              const qty = Number(it.qty || 0);
              const unit = Number(it.unit_price || 0);
              const subtotal = qty * unit;

              tx.executeSql(
                `INSERT INTO sale_items (sale_id, barcode, name, qty, unit_price, subtotal)
                 VALUES (?, ?, ?, ?, ?, ?);`,
                [saleId, String(it.barcode), it.name || null, qty, unit, subtotal]
              );

              // Descontar stock (sin negativos)
              tx.executeSql(
                `UPDATE products
                   SET stock = CASE WHEN IFNULL(stock,0) - ? < 0 THEN 0 ELSE IFNULL(stock,0) - ? END,
                       updated_at = ?
                 WHERE barcode = ?;`,
                [qty, qty, ts, String(it.barcode)]
              );
            });
          }
        );
      },
      (err) => reject(err),
      () => resolve({ ok: true, ts })
    );
  });
}

/* Consultas útiles de ventas (por si luego agregas historial/export) */
export function listRecentSales(limit = 50) {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      tx.executeSql(
        `SELECT id, ts, total, payment_method, cash_received, change_given, discount, tax
         FROM sales ORDER BY ts DESC LIMIT ?;`,
        [limit],
        (_, res) => resolve(rowsToArray(res))
      );
    }, reject);
  });
}

export function getSaleWithItems(saleId) {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      tx.executeSql(`SELECT * FROM sales WHERE id = ?;`, [saleId], (_, sres) => {
        if (!sres.rows.length) return resolve(null);
        const sale = sres.rows.item(0);
        tx.executeSql(
          `SELECT * FROM sale_items WHERE sale_id = ? ORDER BY id ASC;`,
          [saleId],
          (_, ires) => resolve({ sale, items: rowsToArray(ires) })
        );
      });
    }, reject);
  });
}

export function exportSalesCSV(fromTs, toTs) {
  return new Promise((resolve, reject) => {
    const params = [];
    let where = `WHERE 1=1`;
    if (typeof fromTs === 'number') { where += ` AND s.ts >= ?`; params.push(fromTs); }
    if (typeof toTs === 'number')   { where += ` AND s.ts <= ?`; params.push(toTs); }

    db().transaction((tx) => {
      tx.executeSql(
        `SELECT s.id, s.ts, s.total, s.payment_method, s.cash_received, s.change_given, s.discount, s.tax,
                i.barcode, i.name, i.qty, i.unit_price, i.subtotal
           FROM sales s
           JOIN sale_items i ON i.sale_id = s.id
           ${where}
           ORDER BY s.ts DESC, i.id ASC;`,
        params,
        (_, res) => {
          let csv = 'sale_id,ts,total,payment_method,cash_received,change_given,discount,tax,barcode,name,qty,unit_price,subtotal\n';
          for (let i = 0; i < res.rows.length; i++) {
            const r = res.rows.item(i);
            const line = [
              r.id,
              r.ts,
              r.total,
              r.payment_method || '',
              r.cash_received ?? '',
              r.change_given ?? '',
              r.discount ?? 0,
              r.tax ?? 0,
              `"${String(r.barcode).replace(/"/g,'""')}"`,
              `"${String(r.name || '').replace(/"/g,'""')}"`,
              r.qty,
              r.unit_price,
              r.subtotal
            ].join(',');
            csv += line + '\n';
          }
          resolve(csv);
        }
      );
    }, reject);
  });
}

/* ====================== Templates (compat) ====================== */
export function getTemplates() {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      tx.executeSql(`SELECT * FROM templates ORDER BY name ASC;`, [], (_, res) => resolve(rowsToArray(res)));
    }, reject);
  });
}

export function getTemplateFields(templateId) {
  return new Promise((resolve, reject) => {
    db().transaction((tx) => {
      tx.executeSql(
        `SELECT * FROM template_fields WHERE template_id = ? ORDER BY id ASC;`,
        [templateId],
        (_, res) => resolve(rowsToArray(res))
      );
    }, reject);
  });
}

export function saveTemplate(name, fields) {
  return new Promise((resolve, reject) => {
    db().transaction(
      (tx) => {
        tx.executeSql(`INSERT OR IGNORE INTO templates(name) VALUES (?);`, [name]);
        tx.executeSql(`SELECT id FROM templates WHERE name = ?;`, [name], (_, res) => {
          const id = res.rows.item(0)?.id;
          if (!id) return;
          tx.executeSql(`DELETE FROM template_fields WHERE template_id = ?;`, [id]);
          (fields || []).forEach((f) => {
            tx.executeSql(
              `INSERT INTO template_fields (template_id, label) VALUES (?, ?);`,
              [id, String(f.label || '').trim()]
            );
          });
        });
      },
      (err) => reject(err),
      () => resolve(true)
    );
  });
}