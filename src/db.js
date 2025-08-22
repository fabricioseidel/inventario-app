// src/db.js
import * as SQLite from 'expo-sqlite';

let db;

export async function initDB() {
  db = SQLite.openDatabase('olivomarket.db');

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // ----- Tabla de productos -----
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          barcode TEXT UNIQUE,
          name TEXT,
          category TEXT,
          purchase_price REAL,
          sale_price REAL,
          expiry_date TEXT,
          stock INTEGER,
          updated_at INTEGER DEFAULT 0
        );`,
        [],
        () => {},
        (_, err) => {
          console.error('initDB:create products:', err);
          reject(err);
          return false;
        }
      );

      // Migraciones defensivas
      // 1) Asegurar columna 'name'
      tx.executeSql(
        `PRAGMA table_info(products);`,
        [],
        (_, res) => {
          let hasName = false;
          let hasUpdatedAt = false;
          for (let i = 0; i < res.rows.length; i++) {
            const col = res.rows.item(i);
            const n = (col.name || '').toLowerCase();
            if (n === 'name') hasName = true;
            if (n === 'updated_at') hasUpdatedAt = true;
          }
          if (!hasName) {
            tx.executeSql(
              `ALTER TABLE products ADD COLUMN name TEXT;`,
              [],
              () => {},
              (_, err2) => { console.warn('migrate add name failed:', err2); return false; }
            );
          }
          if (!hasUpdatedAt) {
            tx.executeSql(
              `ALTER TABLE products ADD COLUMN updated_at INTEGER DEFAULT 0;`,
              [],
              () => {},
              (_, err2) => { console.warn('migrate add updated_at failed:', err2); return false; }
            );
          }
        },
        () => false
      );

      // ----- Tablas de ventas -----
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS sales (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          ts INTEGER,
          subtotal REAL,
          discount REAL,
          tax REAL,
          total REAL,
          payment_method TEXT,
          amount_paid REAL,
          change REAL,
          note TEXT
        );`
      );

      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS sale_items (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          sale_id INTEGER,
          barcode TEXT,
          name TEXT,
          unit_price REAL,
          qty INTEGER,
          line_total REAL,
          FOREIGN KEY(sale_id) REFERENCES sales(id) ON DELETE CASCADE
        );`
      );
    },
    (err) => { console.error('initDB:tx error:', err); reject(err); },
    () => resolve());
  });
}

export async function insertOrUpdateProduct(p) {
  const now = Date.now();
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
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
          String(p.barcode),
          p.name ?? null,
          p.category ?? null,
          parseFloat(p.purchasePrice) || 0,
          parseFloat(p.salePrice) || 0,
          p.expiryDate ?? null,
          parseInt(p.stock, 10) || 0,
          now
        ],
        (_, result) => resolve(result),
        (_, err) => {
          console.error('insertOrUpdateProduct:', err);
          reject(err);
          return false;
        }
      );
    });
  });
}

export async function listProducts() {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM products ORDER BY id DESC;',
        [],
        (_, { rows }) => resolve(rows._array),
        (_, err) => {
          console.error('listProducts:', err);
          reject(err);
          return false;
        }
      );
    });
  });
}

export async function deleteProductByBarcode(barcode) {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'DELETE FROM products WHERE barcode = ?;',
        [String(barcode)],
        (_, result) => resolve(result),
        (_, err) => {
          console.error('deleteProductByBarcode:', err);
          reject(err);
          return false;
        }
      );
    });
  });
}

export async function getProductByBarcode(barcode) {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM products WHERE barcode = ? LIMIT 1;',
        [String(barcode)],
        (_, { rows }) => resolve(rows.length ? rows._array[0] : null),
        (_, err) => { console.error('getProductByBarcode:', err); reject(err); return false; }
      );
    });
  });
}

/**
 * Registra una venta y descuenta stock.
 * cart = [{ barcode, name, unit_price, qty }]
 * opts = { paymentMethod, amountPaid, discount(=0), tax(=0), note }
 */
export async function recordSale(cart, opts = {}) {
  const ts = Date.now();
  const discount = Number(opts.discount || 0);
  const tax = Number(opts.tax || 0);

  // Calcular totales
  const subtotal = cart.reduce((acc, it) => acc + (Number(it.unit_price) || 0) * (Number(it.qty) || 0), 0);
  const total = Math.max(0, subtotal - discount + tax);
  const paymentMethod = opts.paymentMethod || 'cash';
  const amountPaid = Number(opts.amountPaid || total);
  const change = Math.max(0, amountPaid - total);
  const note = opts.note || null;

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // 1) Insert sale header
      tx.executeSql(
        `INSERT INTO sales (ts, subtotal, discount, tax, total, payment_method, amount_paid, change, note)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
        [ts, subtotal, discount, tax, total, paymentMethod, amountPaid, change, note],
        (_, res) => {
          const saleId = res.insertId;

          // 2) Insert items + update stock
          for (const it of cart) {
            const qty = Number(it.qty) || 0;
            const price = Number(it.unit_price) || 0;
            const lineTotal = qty * price;

            tx.executeSql(
              `INSERT INTO sale_items (sale_id, barcode, name, unit_price, qty, line_total)
               VALUES (?, ?, ?, ?, ?, ?);`,
              [saleId, String(it.barcode), it.name || '', price, qty, lineTotal]
            );

            // Descontar stock y actualizar updated_at
            tx.executeSql(
              `UPDATE products
               SET stock = MAX(0, IFNULL(stock,0) - ?),
                   updated_at = ?
               WHERE barcode = ?;`,
              [qty, ts, String(it.barcode)]
            );
          }
        },
        (_, err) => { console.error('recordSale:insert sale', err); reject(err); return false; }
      );
    },
    (err) => { console.error('recordSale:tx error', err); reject(err); },
    () => resolve({ ok: true, ts, subtotal, discount, tax, total, paymentMethod, amountPaid, change }));
  });
}

/**
 * Export para archivos (alias que export.js espera)
 */
export async function exportAllProductsOrdered() {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
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
        (_, { rows }) => resolve(rows._array),
        (_, err) => {
          console.error('exportAllProductsOrdered:', err);
          reject(err);
          return false;
        }
      );
    });
  });
}