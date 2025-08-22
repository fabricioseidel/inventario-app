// src/screens/ProductForm.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Button, Alert, Modal, StyleSheet,
  TouchableOpacity, ActivityIndicator, Platform, SafeAreaView
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import ScannerScreen from './ScannerScreen';
import { initDB, insertOrUpdateProduct } from '../db';

export default function ProductForm({ initial, onSaved, onCancel }) {
  // -------- formulario --------
  const [barcode, setBarcode] = useState(initial?.barcode || '');
  const [name, setName] = useState(initial?.name || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [purchasePrice, setPurchasePrice] = useState(String(initial?.purchasePrice ?? initial?.purchase_price ?? ''));
  const [salePrice, setSalePrice] = useState(String(initial?.salePrice ?? initial?.sale_price ?? ''));
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate || initial?.expiry_date || '');
  const [stock, setStock] = useState(String(initial?.stock ?? ''));

  // -------- scanner --------
  const [scanOpen, setScanOpen] = useState(false);

  // -------- ui state --------
  const [saving, setSaving] = useState(false);

  // -------- datepicker --------
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [expiryDateObj, setExpiryDateObj] = useState(
    initial?.expiryDate ? new Date(initial.expiryDate)
    : initial?.expiry_date ? new Date(initial.expiry_date)
    : null
  );
  const fmtDate = (d) => {
    if (!d || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`; // ISO corto
  };

  useEffect(() => {
    (async () => {
      try {
        await initDB();
      } catch (e) {
        console.error('DB init error:', e);
        Alert.alert('DB', 'Error inicializando la base de datos');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------------- guardar producto -------------------
  const save = async () => {
    if (!barcode) return Alert.alert('Error', 'El código de barras es obligatorio');
    if (!name) return Alert.alert('Error', 'El nombre es obligatorio');
    if (!category) return Alert.alert('Error', 'La categoría es obligatoria');

    const payload = {
      barcode: String(barcode).trim(),
      name: String(name).trim(),
      category: String(category).trim(),
      purchasePrice: purchasePrice !== '' ? String(purchasePrice).trim() : '0',
      salePrice: salePrice !== '' ? String(salePrice).trim() : '0',
      expiryDate: expiryDate || '',
      stock: stock !== '' ? String(stock).trim() : '0',
    };

    try {
      setSaving(true);

      // Guardar LOCAL siempre (no espera nada de la nube)
      await insertOrUpdateProduct(payload);

      // Cerrar y refrescar lista en el parent
      onSaved && onSaved();
      setSaving(false);
    } catch (e) {
      console.error('Error al guardar producto:', e);
      Alert.alert('Error', 'No se pudo guardar el producto');
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ flex: 1, padding: 16 }}>
        <Text style={styles.title}>{initial ? 'Editar Producto' : 'Nuevo Producto'}</Text>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Código de barras"
            value={barcode}
            onChangeText={setBarcode}
            autoCapitalize="none"
          />
          <View style={{ width: 8 }} />
          <Button title="📷 Escanear" onPress={() => setScanOpen(true)} />
        </View>

        {/* Nombre */}
        <TextInput
          style={styles.input}
          placeholder="Nombre del producto"
          value={name}
          onChangeText={setName}
        />

        {/* Categoría (texto) */}
        <TextInput
          style={styles.input}
          placeholder="Categoría"
          value={category}
          onChangeText={setCategory}
        />

        {/* Precios */}
        <TextInput
          style={styles.input}
          placeholder="Precio de compra"
          value={purchasePrice}
          onChangeText={setPurchasePrice}
          keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
        />
        <TextInput
          style={styles.input}
          placeholder="Precio de venta"
          value={salePrice}
          onChangeText={setSalePrice}
          keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
        />

        {/* Fecha de caducidad con DatePicker */}
        <View style={{ marginBottom: 10 }}>
          <Text style={{ fontWeight: '600', marginBottom: 6 }}>Fecha de caducidad</Text>
          <TouchableOpacity
            style={[styles.input, { justifyContent: 'center' }]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <Text style={{ color: expiryDate ? '#111' : '#888' }}>
              {expiryDate || 'Selecciona una fecha'}
            </Text>
          </TouchableOpacity>
          {showDatePicker && (
            <DateTimePicker
              mode="date"
              value={expiryDateObj || new Date()}
              display={Platform.OS === 'ios' ? 'inline' : 'default'}
              onChange={(event, date) => {
                if (Platform.OS !== 'ios') setShowDatePicker(false);
                if (date) {
                  setExpiryDateObj(date);
                  setExpiryDate(fmtDate(date));
                }
              }}
              minimumDate={new Date()}
            />
          )}
        </View>

        {/* Stock */}
        <TextInput
          style={styles.input}
          placeholder="Stock"
          value={stock}
          onChangeText={setStock}
          keyboardType="numeric"
        />

        {saving ? (
          <ActivityIndicator />
        ) : (
          <Button title={initial ? '✅ Actualizar' : '➕ Guardar'} onPress={save} />
        )}
        <View style={{ height: 8 }} />
        <Button title="❌ Cancelar" onPress={onCancel} color="#b00020" />
      </View>

      {/* Scanner modal */}
      <Modal visible={scanOpen} animationType="slide" onRequestClose={() => setScanOpen(false)}>
        <ScannerScreen
          onClose={() => setScanOpen(false)}
          onScanned={(code) => { setBarcode(code); setScanOpen(false); }}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 6,
    padding: 10, marginBottom: 8, backgroundColor: '#fff'
  },
  row: { flexDirection: 'row', alignItems: 'center' },
});