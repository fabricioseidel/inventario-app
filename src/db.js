// src/db.js
import * as SQLite from 'expo-sqlite';

const DB_NAME = 'olivomarket.db';
const db = SQLite.openDatabase(DB_NAME);

// Helpers
const run = (tx, sql, args = []) =>
  new Promise((resolve, reject) => {
    tx.executeSql(
      sql,
      args,
      (_, res) => resolve(res),
      (_, err) => {
        console.warn('SQL error:', err, 'in', sql);
        reject(err);
        return false;
      }
    );
  });

export function initDB() {
  return new Promise((resolve, reject) => {
    db.transaction(async (tx) => {
      // Tabla principal de productos
      await run(tx, `
        CREATE TABLE IF NOT EXISTS products (
          id INTEGER PRIMARY KEY NOT NULL,
          barcode TEXT UNIQUE NOT NULL,
          category TEXT,
          purchase_price REAL DEFAULT 0,
          sale_price REAL DEFAULT 0,
          expiry_date TEXT,
          stock INTEGER DEFAULT 0,
          updated_at INTEGER
        );
      `);

      // Índice por código de barras
      await run(tx, `CREATE INDEX IF NOT EXISTS idx_products_barcode ON products(barcode);`);

      // Tabla de categorías (opcional, para futura administración)
      await run(tx, `
        CREATE TABLE IF NOT EXISTS categories (
          id INTEGER PRIMARY KEY NOT NULL,
          name TEXT UNIQUE NOT NULL
        );
      `);

      // Semillas mínimas de categorías
      const defaults = ['Bebidas','Abarrotes','Panes','Postres','Quesos','Cecinas','Helados','Hielo','Mascotas','Aseo'];
      for (const name of defaults) {
        await run(tx, `INSERT OR IGNORE INTO categories(name) VALUES (?);`, [name]);
      }
    }, reject, resolve);
  });
}

// -------------------- Productos --------------------
export function upsertProduct(p) {
  const now = Date.now();
  const values = [
    p.barcode,
    p.category || null,
    Number(p.purchasePrice || 0),
    Number(p.salePrice || 0),
    p.expiryDate || null,
    Number(p.stock || 0),
    now
  ];

  return new Promise((resolve, reject) => {
    db.transaction(async (tx) => {
      await run(
        tx,
        `
        INSERT INTO products (barcode, category, purchase_price, sale_price, expiry_date, stock, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(barcode) DO UPDATE SET
          category=excluded.category,
          purchase_price=excluded.purchase_price,
          sale_price=excluded.sale_price,
          expiry_date=excluded.expiry_date,
          stock=excluded.stock,
          updated_at=excluded.updated_at;
        `,
        values
      );
      const res = await run(tx, `SELECT * FROM products WHERE barcode = ?;`, [p.barcode]);
      resolve(res.rows.item(0));
    }, reject);
  });
}

export function getProductByBarcode(barcode) {
  return new Promise((resolve, reject) => {
    db.transaction(async (tx) => {
      const res = await run(tx, `SELECT * FROM products WHERE barcode = ?;`, [barcode]);
      resolve(res.rows.length ? res.rows.item(0) : null);
    }, reject);
  });
}

export function listProducts() {
  return new Promise((resolve, reject) => {
    db.transaction(async (tx) => {
      const res = await run(tx, `
        SELECT * FROM products
        ORDER BY updated_at DESC, id DESC;
      `);
      const out = [];
      for (let i = 0; i < res.rows.length; i++) out.push(res.rows.item(i));
      resolve(out);
    }, reject);
  });
}

export function deleteProductByBarcode(barcode) {
  return new Promise((resolve, reject) => {
    db.transaction(async (tx) => {
      await run(tx, `DELETE FROM products WHERE barcode = ?;`, [barcode]);
      resolve(true);
    }, reject);
  });
}

export function clearAllProducts() {
  return new Promise((resolve, reject) => {
    db.transaction(async (tx) => {
      await run(tx, `DELETE FROM products;`);
      resolve(true);
    }, reject);
  });
}

// Export ordenado para consumo externo
export function exportAllProductsOrdered() {
  return new Promise((resolve, reject) => {
    db.transaction(async (tx) => {
      const res = await run(tx, `
        SELECT
          barcode,
          barcode AS id,
          IFNULL(category, '') AS category,
          IFNULL(purchase_price, 0) AS purchasePrice,
          IFNULL(sale_price, 0) AS salePrice,
          IFNULL(expiry_date, '') AS expiryDate,
          IFNULL(stock, 0) AS stock
        FROM products
        ORDER BY updated_at DESC, id DESC;
      `);
      const rows = [];
      for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
      resolve(rows);
    }, reject);
  });
}

// -------------------- Categorías --------------------
export function listCategories() {
  return new Promise((resolve, reject) => {
    db.transaction(async (tx) => {
      const res = await run(tx, `SELECT * FROM categories ORDER BY name ASC;`);
      const rows = [];
      for (let i = 0; i < res.rows.length; i++) rows.push(res.rows.item(i));
      resolve(rows);
    }, reject);
  });
}

export function addCategory(name) {
  return new Promise((resolve, reject) => {
    db.transaction(async (tx) => {
      await run(tx, `INSERT OR IGNORE INTO categories(name) VALUES (?);`, [name]);
      const res = await run(tx, `SELECT * FROM categories WHERE name = ?;`, [name]);
      resolve(res.rows.item(0));
    }, reject);
  });
}
