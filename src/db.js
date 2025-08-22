// src/db.js
import * as SQLite from 'expo-sqlite';

let db;

export async function initDB() {
  db = SQLite.openDatabase('olivomarket.db');

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      // Tabla principal
      tx.executeSql(
        `CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          barcode TEXT UNIQUE,
          name TEXT,
          category TEXT,
          purchase_price REAL,
          sale_price REAL,
          expiry_date TEXT,
          stock INTEGER
        );`,
        [],
        () => {},
        (_, err) => {
          console.error('initDB:create products:', err);
          reject(err);
          return false;
        }
      );

      // Migración defensiva: si venías de una tabla sin 'name'
      tx.executeSql(
        `PRAGMA table_info(products);`,
        [],
        (_, res) => {
          let hasName = false;
          for (let i = 0; i < res.rows.length; i++) {
            const col = res.rows.item(i);
            if ((col.name || '').toLowerCase() === 'name') { hasName = true; break; }
          }
          if (!hasName) {
            tx.executeSql(
              `ALTER TABLE products ADD COLUMN name TEXT;`,
              [],
              () => {},
              (_, err2) => {
                // Si falla aquí por lo que sea, no bloqueamos la app.
                console.warn('initDB:migrate add name failed:', err2);
                return false;
              }
            );
          }
        },
        // OnError del PRAGMA (no bloquea)
        () => false
      );
    },
    (err) => { console.error('initDB:tx error:', err); reject(err); },
    () => resolve());
  });
}

export async function insertOrUpdateProduct(p) {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        `INSERT INTO products (barcode, name, category, purchase_price, sale_price, expiry_date, stock)
         VALUES (?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(barcode) DO UPDATE SET
           name=excluded.name,
           category=excluded.category,
           purchase_price=excluded.purchase_price,
           sale_price=excluded.sale_price,
           expiry_date=excluded.expiry_date,
           stock=excluded.stock;`,
        [
          String(p.barcode),
          p.name ?? null,
          p.category ?? null,
          parseFloat(p.purchasePrice) || 0,
          parseFloat(p.salePrice) || 0,
          p.expiryDate ?? null,
          parseInt(p.stock, 10) || 0,
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

/**
 * Exportar todos los productos con alias que export.js espera.
 * - id        => barcode
 * - purchasePrice => purchase_price
 * - salePrice     => sale_price
 * - expiryDate    => expiry_date
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