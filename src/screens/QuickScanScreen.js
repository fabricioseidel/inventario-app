// src/screens/QuickScanScreen.js
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Alert } from 'react-native';
import ScannerScreen from './ScannerScreen';
import ProductForm from './ProductForm';
import { getProductByBarcode } from '../db';

export default function QuickScanScreen({ onClose }) {
  const [scanOpen, setScanOpen] = useState(true);
  const [initial, setInitial] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);

  const closeAll = (changed = hasChanges) => {
    onClose && onClose(changed);
  };

  const openFormForBarcode = async (barcode) => {
    try {
      const found = await getProductByBarcode(String(barcode).trim());
      if (found) {
        setInitial({
          barcode: found.barcode, name: found.name || '', category: found.category || '',
          purchasePrice: String(found.purchase_price ?? ''), salePrice: String(found.sale_price ?? ''),
          expiryDate: found.expiry_date || '', stock: String(found.stock ?? ''),
        });
      } else {
        setInitial({ barcode: String(barcode).trim(), name: '', category: '', purchasePrice: '', salePrice: '', expiryDate: '', stock: '' });
      }
      setScanOpen(false);
    } catch { Alert.alert('Error', 'No se pudo buscar el producto por código.'); }
  };

  const onSaved = () => { setHasChanges(true); setInitial(null); setScanOpen(true); };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {!scanOpen && (
        <View style={{ padding: 16 }}>
          <Text style={styles.title}>Escanear (crear / editar)</Text>
          <Text style={{ color: '#666', marginBottom: 8 }}>Apunta al código. Si existe lo editas; si no, lo creas.</Text>
          <Button title="Cerrar" color="#666" onPress={() => closeAll()} />
        </View>
      )}

      {scanOpen && (
        <ScannerScreen
          onClose={() => closeAll()}
          onScanned={(scannedCode) => { setScanOpen(false); openFormForBarcode(scannedCode); }}
        />
      )}

      {!scanOpen && initial && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <Button title="🔁 Re-escanear" onPress={() => { setInitial(null); setScanOpen(true); }} />
          </View>
          <ProductForm initial={initial} onSaved={onSaved} onCancel={() => { setInitial(null); setScanOpen(true); }} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
});