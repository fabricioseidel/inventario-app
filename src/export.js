import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportAllProductsOrdered } from './db';

/**
 * Build a safe timestamp for filenames
 */
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

/**
 * Convert rows to CSV (Excel-friendly)
 */
const buildCSV = (rows) => {
  const headers = [
    'Código de barra',
    'Id',
    'Categoría',
    'Precio de compra',
    'Precio de venta',
    'Fecha de caducidad',
    'Stock'
  ];
  let csv = headers.join(',') + '\n';
  for (const p of rows) {
    const safe = (v) => String(v ?? '').replace(/"/g, '""');
    const line = [
      safe(p.barcode),
      safe(p.id),
      safe(p.category),
      safe(p.purchasePrice),
      safe(p.salePrice),
      safe(p.expiryDate),
      safe(p.stock),
    ].map(v => `"${v}"`).join(',');
    csv += line + '\n';
  }
  return csv;
};

/**
 * Save content to app's documents directory and try to share if available.
 * Always resolves with the file URI.
 */
const saveAndShare = async (content, filename, mimeType) => {
  const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  const uri = dir + filename;

  await FileSystem.writeAsStringAsync(uri, content, {
    encoding: FileSystem.EncodingType.UTF8,
  });

  try {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType, dialogTitle: filename });
    }
  } catch (e) {
    // Sharing is optional; ignore errors
    console.warn('Sharing failed:', e?.message || e);
  }

  return uri;
};

export async function exportJSONFile() {
  const rows = await exportAllProductsOrdered();
  const json = JSON.stringify(rows, null, 2);
  return await saveAndShare(json, `olivomarket_productos_${stamp()}.json`, 'application/json');
}

export async function exportCSVFile() {
  const rows = await exportAllProductsOrdered();
  const csv = buildCSV(rows);
  return await saveAndShare(csv, `olivomarket_productos_${stamp()}.csv`, 'text/csv');
}
