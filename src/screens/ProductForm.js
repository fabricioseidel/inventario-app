// src/screens/ProductForm.js
import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Button, Alert, Modal, StyleSheet } from 'react-native';
import { Picker } from '@react-native-picker/picker';
import ScannerScreen from './ScannerScreen';
import { upsertProduct, listCategories, addCategory, getProductByBarcode } from '../db';

export default function ProductForm({ initial, onSaved, onCancel }) {
  const [barcode, setBarcode] = useState(initial?.barcode || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [purchasePrice, setPurchasePrice] = useState(String(initial?.purchasePrice ?? ''));
  const [salePrice, setSalePrice] = useState(String(initial?.salePrice ?? ''));
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate || '');
  const [stock, setStock] = useState(String(initial?.stock ?? ''));

  const [categories, setCategories] = useState([]);
  const [catModal, setCatModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [scanOpen, setScanOpen] = useState(false);
  const [preparingScan, setPreparingScan] = useState(false);

  useEffect(() => {
    (async () => {
      const rows = await listCategories();
      setCategories(rows);
    })();
  }, []);

  const handleAddCategory = async () => {
    const name = (newCategoryName || '').trim();
    if (!name) return Alert.alert('Atención', 'Escribe un nombre de categoría');
    const exists = categories.some(c => c.name.toLowerCase() === name.toLowerCase());
    if (exists) return Alert.alert('Ya existe', 'Esa categoría ya está creada');
    await addCategory(name);
    const rows = await listCategories();
    setCategories(rows);
    setCategory(name);
    setNewCategoryName('');
    setCatModal(false);
  };

  const save = async () => {
    if (!barcode) return Alert.alert('Error', 'El código de barras es obligatorio');
    if (!category) return Alert.alert('Error', 'La categoría es obligatoria');

    const payload = {
      barcode: String(barcode).trim(),
      category: String(category).trim(),
      purchasePrice: purchasePrice !== '' ? String(purchasePrice).trim() : '0',
      salePrice: salePrice !== '' ? String(salePrice).trim() : '0',
      expiryDate: expiryDate || '',
      stock: stock !== '' ? String(stock).trim() : '0',
    };

    // Evitar duplicados mostrando edición existente
    if (!initial) {
      const exists = await getProductByBarcode(payload.barcode);
      if (exists) {
        Alert.alert('Duplicado', 'Ese código ya existe, se cargará para edición');
        // Rellenamos
        setCategory(exists.category || '');
        setPurchasePrice(String(exists.purchase_price ?? ''));
        setSalePrice(String(exists.sale_price ?? ''));
        setExpiryDate(exists.expiry_date || '');
        setStock(String(exists.stock ?? ''));
        return;
      }
    }

    const saved = await upsertProduct(payload);
    onSaved && onSaved(saved);
  };

  return (
    <View style={{ padding: 12, gap: 8 }}>
      <Text style={styles.title}>{initial ? 'Editar producto' : 'Nuevo producto'}</Text>

      <TextInput
        style={styles.input}
        placeholder="Código de barras"
        value={barcode}
        onChangeText={setBarcode}
      />
      <Button title="📷 Escanear código" onPress={() => {
        // Delegamos la solicitud de permisos al propio ScannerScreen con su hook
        setScanOpen(true);
      }} />
      {preparingScan && <Text style={{ textAlign: 'center', color: '#555' }}>Preparando cámara...</Text>}

      <Text style={{ fontWeight: '600' }}>Categoría</Text>
      <View style={styles.pickerBox}>
        <Picker
          selectedValue={category || ''}
          onValueChange={(val) => {
            if (val === '__new__') setCatModal(true);
            else setCategory(val);
          }}
        >
          <Picker.Item label="Selecciona una categoría" value="" />
          {categories.map(c => (
            <Picker.Item key={c.id} label={c.name} value={c.name} />
          ))}
          <Picker.Item label="➕ Nueva categoría…" value="__new__" />
        </Picker>
      </View>

      <TextInput
        style={styles.input}
        placeholder="Precio de compra"
        value={purchasePrice}
        onChangeText={setPurchasePrice}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="Precio de venta"
        value={salePrice}
        onChangeText={setSalePrice}
        keyboardType="numeric"
      />
      <TextInput
        style={styles.input}
        placeholder="Fecha de caducidad (YYYY-MM-DD)"
        value={expiryDate}
        onChangeText={setExpiryDate}
      />
      <TextInput
        style={styles.input}
        placeholder="Stock"
        value={stock}
        onChangeText={setStock}
        keyboardType="numeric"
      />

      <Button title={initial ? '✅ Actualizar' : '➕ Guardar'} onPress={save} />
      <Button title="❌ Cancelar" onPress={onCancel} color="#b00020" />

      {/* Scanner modal */}
  <Modal visible={scanOpen} animationType="slide" onRequestClose={() => setScanOpen(false)}>
        <ScannerScreen
          onClose={() => setScanOpen(false)}
          onScanned={(code) => { setBarcode(code); setScanOpen(false); }}
        />
      </Modal>

      {/* Nueva categoría */}
      <Modal visible={catModal} transparent animationType="fade" onRequestClose={() => setCatModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 10 }}>Nueva categoría</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Snacks"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8 }}>
              <Button title="Cancelar" onPress={() => setCatModal(false)} />
              <Button title="Crear" onPress={handleAddCategory} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 10, marginBottom: 8, backgroundColor: '#fff' },
  pickerBox: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, marginBottom: 10, overflow: 'hidden' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'center', alignItems: 'center', padding: 20 },
  modalCard: { backgroundColor: '#fff', borderRadius: 12, padding: 16, width: '100%' },
});
