// src/db.js
import * as SQLite from 'expo-sqlite';

let db;

export async function initDB() {
  db = SQLite.openDatabase('olivomarket.db');

  return new Promise((resolve, reject) => {
    db.transaction(tx => {
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
        () => resolve(),
        (_, err) => {
          console.error('initDB:', err);
          reject(err);
        }
      );
    });
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
          p.barcode,
          p.name,
          p.category,
          parseFloat(p.purchasePrice) || 0,
          parseFloat(p.salePrice) || 0,
          p.expiryDate,
          parseInt(p.stock) || 0,
        ],
        (_, result) => resolve(result),
        (_, err) => {
          console.error('insertOrUpdateProduct:', err);
          reject(err);
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
        [barcode],
        (_, result) => resolve(result),
        (_, err) => {
          console.error('deleteProductByBarcode:', err);
          reject(err);
        }
      );
    });
  });
}

/**
 * Exportar todos los productos ordenados por nombre
 */
export async function exportAllProductsOrdered() {
  return new Promise((resolve, reject) => {
    db.transaction(tx => {
      tx.executeSql(
        'SELECT * FROM products ORDER BY name ASC;',
        [],
        (_, { rows }) => resolve(rows._array),
        (_, err) => {
          console.error('exportAllProductsOrdered:', err);
          reject(err);
        }
      );
    });
  });
}