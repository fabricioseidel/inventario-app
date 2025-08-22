// src/db.js
import * as SQLite from 'expo-sqlite';

let db;

// Abre una única instancia
function open() {
  if (!db) db = SQLite.openDatabase('olivomarket.db');
  return db;
}

// Inicializa todas las tablas requeridas
export function initDB() {
  return new Promise((resolve, reject) => {
    open().transaction(
      (tx) => {
        // ----- Productos -----
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

        // ----- Categorías (semillas mínimas) -----
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

        // ----- Ventas -----
        tx.executeSql(`
          CREATE TABLE IF NOT EXISTS sales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts INTEGER NOT NULL,
            total REAL NOT NULL,
            payment_method TEXT,
            cash_received REAL,
            change_given REAL,
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

        // Opcional: soporte para TemplateEditor
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
      reject,
      () => resolve(true)
    );
  });
}

// Utilidad
function rows(res) {
  const out = [];
  for (let i = 0; i < res.rows.length; i++) out.push(res.rows.item(i));
  return out;
}

// -------- Productos --------
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
    open().transaction(
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
      reject,
      () => resolve(true)
    );
  });
}

export function getProductByBarcode(barcode) {
  return new Promise((resolve, reject) => {
    open().transaction((tx) => {
      tx.executeSql(
        `SELECT * FROM products WHERE barcode = ? LIMIT 1;`,
        [String(barcode)],
        (_,_res) => resolve(_res.rows.length ? _res.rows.item(0) : null)
      );
    }, reject);
  });
}

export function listProducts() {
  return new Promise((resolve, reject) => {
    open().transaction((tx) => {
      tx.executeSql(
        `SELECT * FROM products ORDER BY updated_at DESC, name ASC, id DESC;`,
        [],
        (_,_res) => resolve(rows(_res))
      );
    }, reject);
  });
}

export function deleteProductByBarcode(barcode) {
  return new Promise((resolve, reject) => {
    open().transaction((tx) => {
      tx.executeSql(`DELETE FROM products WHERE barcode = ?;`, [String(barcode)]);
    }, reject, () => resolve(true));
  });
}

export function clearAllProducts() {
  return new Promise((resolve, reject) => {
    open().transaction((tx) => {
      tx.executeSql(`DELETE FROM products;`);
    }, reject, () => resolve(true));
  });
}

// Export ordenado (para CSV/JSON)
export function exportAllProductsOrdered() {
  return new Promise((resolve, reject) => {
    open().transaction((tx) => {
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
        (_,_res) => resolve(rows(_res)),
        (_,_err) => { console.error('exportAllProductsOrdered:', _err); reject(_err); return false; }
      );
    });
  });
}

// -------- Categorías --------
export function listCategories() {
  return new Promise((resolve, reject) => {
    open().transaction((tx) => {
      tx.executeSql(`SELECT * FROM categories ORDER BY name ASC;`, [], (_,_res) => resolve(rows(_res)));
    }, reject);
  });
}

export function addCategory(name) {
  return new Promise((resolve, reject) => {
    open().transaction((tx) => {
      tx.executeSql(`INSERT OR IGNORE INTO categories(name) VALUES (?);`, [name]);
      tx.executeSql(`SELECT * FROM categories WHERE name = ?;`, [name], (_,_res) => {
        resolve(_res.rows.length ? _res.rows.item(0) : { id: 0, name });
      });
    }, reject);
  });
}

// -------- Ventas --------
export function recordSale(sale) {
  const items = Array.isArray(sale.items) ? sale.items : [];
  const total = items.reduce((acc, it) => acc + Number(it.qty || 0) * Number(it.unitPrice || 0), 0);
  const ts = Date.now();
  const payment = sale.paymentMethod || 'efectivo';
  const cashReceived = Number(sale.cashReceived || 0);
  const change = Math.max(0, cashReceived - total);

  return new Promise((resolve, reject) => {
    open().transaction(
      (tx) => {
        tx.executeSql(
          `INSERT INTO sales (ts, total, payment_method, cash_received, change_given, notes)
           VALUES (?, ?, ?, ?, ?, ?);`,
          [ts, total, payment, cashReceived, change, sale.notes || null],
          (_insert, res) => {
            const saleId = res.insertId;

            // Items + descuento stock
            items.forEach((it) => {
              const qty = Number(it.qty || 0);
              const unit = Number(it.unitPrice || 0);
              const subtotal = qty * unit;

              tx.executeSql(
                `INSERT INTO sale_items (sale_id, barcode, name, qty, unit_price, subtotal)
                 VALUES (?, ?, ?, ?, ?, ?);`,
                [saleId, String(it.barcode), it.name || null, qty, unit, subtotal]
              );

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
      reject,
      () => resolve({ ok: true, ts })
    );
  });
}