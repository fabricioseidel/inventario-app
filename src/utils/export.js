// src/export.js
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportAllProductsOrdered } from './db';

const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

const buildCSV = (rows) => {
  let csv = 'Código de barra,Id,Categoría,Precio de compra,Precio de venta,Fecha de caducidad,Stock\n';
  for (const p of rows) {
    const safe = (v) => String(v ?? '').replace(/"/g, '""');
    csv += `"${safe(p.barcode)}","${safe(p.id)}","${safe(p.category)}","${safe(p.purchasePrice)}","${safe(p.salePrice)}","${safe(p.expiryDate)}","${safe(p.stock)}"\n`;
  }
  return csv;
};

const saveAndShare = async (content, filename, mimeType) => {
  const uri = FileSystem.cacheDirectory + filename;
  await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(uri, { mimeType });
  } else {
    alert(`Archivo listo: ${uri}`);
  }
};

export async function exportJSONFile() {
  const rows = await exportAllProductsOrdered();
  const json = JSON.stringify(rows, null, 2);
  await saveAndShare(json, `olivomarket_productos_${stamp()}.json`, 'application/json');
}

export async function exportCSVFile() {
  const rows = await exportAllProductsOrdered();
  const csv = buildCSV(rows);
  await saveAndShare(csv, `olivomarket_productos_${stamp()}.csv`, 'text/csv');
}
