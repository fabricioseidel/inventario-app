import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { exportAllProductsOrdered } from './db';
import * as DocumentPicker from 'expo-document-picker';

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

export async function backupDatabase() {
  const dbName = 'olivomarket.db';
  const dbUri = FileSystem.documentDirectory + 'SQLite/' + dbName;
  const backupUri = FileSystem.cacheDirectory + `backup-olivomarket-${stamp()}.db`;

  try {
    await FileSystem.copyAsync({
      from: dbUri,
      to: backupUri,
    });
    
    const canShare = await Sharing.isAvailableAsync();
    if (canShare) {
      await Sharing.shareAsync(backupUri, {
        mimeType: 'application/octet-stream',
        dialogTitle: 'Guardar copia de seguridad de la base de datos',
      });
    } else {
      alert('No es posible compartir archivos en este dispositivo.');
    }
  } catch (error) {
    console.error('Error al hacer la copia de seguridad:', error);
    alert('Error al hacer la copia de seguridad: ' + error.message);
  }
}

export async function restoreDatabase() {
  try {
    const pickerResult = await DocumentPicker.getDocumentAsync({
      type: 'application/octet-stream',
      copyToCacheDirectory: true,
    });

    if (pickerResult.type === 'success') {
      const backupUri = pickerResult.uri;
      const dbName = 'olivomarket.db';
      const dbUri = FileSystem.documentDirectory + 'SQLite/' + dbName;

      // Optional: Create a backup of the current DB before overwriting
      const preRestoreBackupUri = FileSystem.cacheDirectory + `prerestore-backup-${stamp()}.db`;
      await FileSystem.copyAsync({ from: dbUri, to: preRestoreBackupUri });

      await FileSystem.copyAsync({
        from: backupUri,
        to: dbUri,
      });

      Alert.alert(
        'Restauración completada',
        'La base de datos ha sido restaurada. Es necesario reiniciar la aplicación para que los cambios tomen efecto.'
      );
    }
  } catch (error) {
    console.error('Error al restaurar la base de datos:', error);
    Alert.alert('Error', 'No se pudo completar la restauración: ' + error.message);
  }
}