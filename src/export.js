import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportAllProductsOrdered } from './db';

/** Timestamp seguro para el nombre de archivo */
const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

/** Convierte filas a CSV (compatible con Excel) */
const buildCSV = (rows) => {
  const headers = [
    'Código de barra',
    'Id',
    'Nombre',              // ← añadido
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
      safe(p.name),         // ← añadido
      safe(p.category),
      safe(p.purchasePrice),
      safe(p.salePrice),
      safe(p.expiryDate),
      safe(p.stock)
    ].map(v => `"${v}"`).join(',');
    csv += line + '\n';
  }
  return csv;
};

/**
 * Guarda el contenido en el directorio de documentos de la app
 * y si es posible abre el diálogo de compartir. Devuelve la URI del archivo.
 */
const saveAndShare = async (content, filename, mimeType) => {
  const dir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  const uri = dir + filename;

  // Agregamos BOM para que Excel respete acentos/ñ en CSV
  const withBOM = mimeType === 'text/csv' ? '\uFEFF' + content : content;

  await FileSystem.writeAsStringAsync(uri, withBOM, {
    encoding: FileSystem.EncodingType.UTF8
  });

  try {
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(uri, { mimeType, dialogTitle: filename });
    }
  } catch (e) {
    console.warn('Sharing failed:', e?.message || e);
  }

  return uri;
};

export async function exportJSONFile() {
  const rows = await exportAllProductsOrdered(); // incluye "name" desde db.js
  const json = JSON.stringify(rows, null, 2);
  return await saveAndShare(json, `olivomarket_productos_${stamp()}.json`, 'application/json');
}

export async function exportCSVFile() {
  const rows = await exportAllProductsOrdered(); // incluye "name" desde db.js
  const csv = buildCSV(rows);
  return await saveAndShare(csv, `olivomarket_productos_${stamp()}.csv`, 'text/csv');
}