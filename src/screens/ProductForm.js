// src/screens/ProductForm.js
import React, { useMemo, useState } from 'react';
import {
  View, Text, TextInput, Button, Alert, Modal, StyleSheet, SafeAreaView, TouchableOpacity
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import ScannerScreen from './ScannerScreen';
import { insertOrUpdateProduct, getProductByBarcode } from '../db';

// Rápidas por defecto (puedes editarlas)
const DEFAULT_CATEGORIES = ['Bebidas','Abarrotes','Panes','Postres','Quesos','Cecinas','Helados','Hielo','Mascotas','Aseo'];

export default function ProductForm({ initial, onSaved, onCancel }) {
  const [barcode, setBarcode] = useState(initial?.barcode || '');
  const [name, setName] = useState(initial?.name || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [purchasePrice, setPurchasePrice] = useState(String(initial?.purchasePrice ?? initial?.purchase_price ?? ''));
  const [salePrice, setSalePrice] = useState(String(initial?.salePrice ?? initial?.sale_price ?? ''));
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate || initial?.expiry_date || '');
  const [stock, setStock] = useState(String(initial?.stock ?? ''));
  const [saving, setSaving] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);

  // DatePicker
  const [showDate, setShowDate] = useState(false);
  const dateObj = useMemo(() => {
    if (!expiryDate) return new Date();
    const d = new Date(expiryDate);
    return isNaN(d.getTime()) ? new Date() : d;
  }, [expiryDate]);

  // Category selector
  const [catOpen, setCatOpen] = useState(false);
  const categories = DEFAULT_CATEGORIES;

  const onDateChange = (_e, selectedDate) => {
    setShowDate(false);
    if (selectedDate) {
      const yyyy = selectedDate.getFullYear();
      const mm = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const dd = String(selectedDate.getDate()).padStart(2, '0');
      setExpiryDate(`${yyyy}-${mm}-${dd}`);
    }
  };

  const save = async () => {
    if (!barcode) return Alert.alert('Error', 'El código de barras es obligatorio');
    try {
      setSaving(true);
      if (!initial) {
        const exists = await getProductByBarcode(String(barcode).trim());
        if (exists) {
          Alert.alert('Duplicado', 'Ese código ya existe, se cargará para edición');
          setName(exists.name || '');
          setCategory(exists.category || '');
          setPurchasePrice(String(exists.purchase_price ?? ''));
          setSalePrice(String(exists.sale_price ?? ''));
          setExpiryDate(exists.expiry_date || '');
          setStock(String(exists.stock ?? ''));
          setSaving(false);
          return;
        }
      }

      await insertOrUpdateProduct({
        barcode: String(barcode).trim(),
        name: name || null,
        category: category || null,
        purchasePrice: purchasePrice !== '' ? Number(purchasePrice) : 0,
        salePrice: salePrice !== '' ? Number(salePrice) : 0,
        expiryDate: expiryDate || null,
        stock: stock !== '' ? Number(stock) : 0
      });
      onSaved && onSaved();
    } catch (e) {
      console.error('product_save', e);
      Alert.alert('Error', 'No se pudo guardar el producto');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ padding: 16 }}>
        <Text style={styles.title}>{initial ? 'Editar producto' : 'Nuevo producto'}</Text>

        <TextInput style={styles.input} placeholder="Código de barras" value={barcode} onChangeText={setBarcode} autoCapitalize="none" />
        <TextInput style={styles.input} placeholder="Nombre" value={name} onChangeText={setName} />

        {/* Selector de categoría */}
        <View style={{ flexDirection:'row', gap:8 }}>
          <TextInput style={[styles.input, { flex:1 }]} placeholder="Categoría" value={category} onChangeText={setCategory} />
          <Button title="Elegir" onPress={() => setCatOpen(true)} />
        </View>

        {/* Precios / stock */}
        <TextInput style={styles.input} placeholder="Precio de compra" value={purchasePrice} onChangeText={setPurchasePrice} keyboardType="numeric" />
        <TextInput style={styles.input} placeholder="Precio de venta" value={salePrice} onChangeText={setSalePrice} keyboardType="numeric" />

        {/* Fecha de caducidad con DatePicker */}
        <View style={{ flexDirection:'row', gap:8, alignItems:'center' }}>
          <TextInput
            style={[styles.input, { flex:1 }]}
            placeholder="Fecha de caducidad (YYYY-MM-DD)"
            value={expiryDate}
            onChangeText={setExpiryDate}
          />
          <Button title="Calendario" onPress={() => setShowDate(true)} />
        </View>
        {showDate && (
          <DateTimePicker
            value={dateObj}
            mode="date"
            display="default"
            onChange={onDateChange}
          />
        )}

        <TextInput style={styles.input} placeholder="Stock" value={stock} onChangeText={setStock} keyboardType="numeric" />

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Button title={saving ? 'Guardando…' : (initial ? 'Guardar cambios' : 'Guardar')} onPress={save} disabled={saving} />
          <Button title="Cancelar" color="#666" onPress={onCancel} />
          <Button title="Escanear" onPress={() => setScanOpen(true)} />
        </View>
      </View>

      {/* Modal escáner */}
      <Modal visible={scanOpen} animationType="fade" onRequestClose={() => setScanOpen(false)}>
        <ScannerScreen onClose={() => setScanOpen(false)} onScanned={(code) => { setBarcode(code); setScanOpen(false); }} />
      </Modal>

      {/* Modal categorías */}
      <Modal visible={catOpen} animationType="slide" onRequestClose={() => setCatOpen(false)}>
        <SafeAreaView style={{ flex:1, backgroundColor:'#fff', padding:16 }}>
          <Text style={styles.title}>Selecciona una categoría</Text>
          {categories.map(c => (
            <TouchableOpacity key={c} style={styles.catItem} onPress={() => { setCategory(c); setCatOpen(false); }}>
              <Text>{c}</Text>
            </TouchableOpacity>
          ))}
          <View style={{ height:8 }} />
          <Button title="Cerrar" onPress={() => setCatOpen(false)} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10, marginBottom: 8, backgroundColor: '#fff' },
  catItem: { padding:12, borderWidth:1, borderColor:'#eee', borderRadius:8, marginBottom:8, backgroundColor:'#fafafa' }
});