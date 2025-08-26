// src/screens/QuickScanScreen.js
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Modal, Alert } from 'react-native';
import ScannerScreen from './ScannerScreen';
import ProductForm from './ProductForm';
import { getProductByBarcode } from '../db';

export default function QuickScanScreen({ onClose }) {
  const [scanOpen, setScanOpen] = useState(true);
  const [initial, setInitial] = useState(null); // datos para ProductForm
  const [hasChanges, setHasChanges] = useState(false);

  const openFormForBarcode = async (barcode) => {
    try {
      const found = await getProductByBarcode(String(barcode).trim());
      if (found) {
        // Mapear a formato del ProductForm
        setInitial({
          barcode: found.barcode,
          name: found.name || '',
          category: found.category || '',
          purchasePrice: String(found.purchase_price ?? ''),
          salePrice: String(found.sale_price ?? ''),
          expiryDate: found.expiry_date || '',
          stock: String(found.stock ?? ''),
        });
      } else {
        // Crear nuevo con el barcode pre-cargado
        setInitial({
          barcode: String(barcode).trim(),
          name: '',
          category: '',
          purchasePrice: '',
          salePrice: '',
          expiryDate: '',
          stock: '',
        });
      }
      setScanOpen(false);
    } catch (e) {
      Alert.alert('Error', 'No se pudo buscar el producto por código.');
    }
  };

  const onSaved = () => {
    setHasChanges(true);
    // Volver al modo scan para seguir cargando/ajustando rápido
    setInitial(null);
    setScanOpen(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ padding: 16 }}>
        <Text style={styles.title}>Escanear (crear / editar)</Text>
        <Text style={{ color: '#666', marginBottom: 8 }}>
          Apunta al código. Si existe lo podrás editar; si no, lo creas al instante.
        </Text>
        <Button title="Cerrar" color="#666" onPress={() => onClose && onClose(hasChanges)} />
      </View>

      {/* Paso 1: Escáner */}
      {scanOpen && (
        <View style={{ flex: 1 }}>
          {/* Usamos ScannerScreen en un Modal local para reusar su UI ya probada */}
          <Modal visible={scanOpen} animationType="fade" onRequestClose={() => setScanOpen(false)} transparent={false}>
            <ScannerScreen
              onClose={() => setScanOpen(false)}
              onScanned={(scannedCode) => {
                setScanOpen(false);
                openFormForBarcode(scannedCode);
              }}
            />
          </Modal>
        </View>
      )}

      {/* Paso 2: Formulario */}
      {!scanOpen && initial && (
        <View style={{ flex: 1 }}>
          <View style={{ paddingHorizontal: 16, marginBottom: 8 }}>
            <Button title="🔁 Re-escanear" onPress={() => { setInitial(null); setScanOpen(true); }} />
          </View>
          <ProductForm
            initial={initial}
            onSaved={onSaved}
            onCancel={() => {
              // Volver al escáner (para el flujo rápido)
              setInitial(null);
              setScanOpen(true);
            }}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
});