// src/screens/ProductForm.js
import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Button, Alert, Modal, StyleSheet,
  TouchableOpacity, FlatList, ActivityIndicator, Platform
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import ScannerScreen from './ScannerScreen';
import { upsertProduct, listCategories, addCategory, getProductByBarcode, initDB } from '../db';
import { pushProductRemoteSafe } from '../sync';

export default function ProductForm({ initial, onSaved, onCancel }) {
  // -------- formulario --------
  const [barcode, setBarcode] = useState(initial?.barcode || '');
  const [name, setName] = useState(initial?.name || '');             // 🔹 NUEVO
  const [category, setCategory] = useState(initial?.category || '');
  const [purchasePrice, setPurchasePrice] = useState(String(initial?.purchasePrice ?? ''));
  const [salePrice, setSalePrice] = useState(String(initial?.salePrice ?? ''));
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate || '');
  const [stock, setStock] = useState(String(initial?.stock ?? ''));

  // -------- categorías --------
  const [categories, setCategories] = useState([]);
  const [catSelectOpen, setCatSelectOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  // -------- scanner --------
  const [scanOpen, setScanOpen] = useState(false);

  // -------- ui state --------
  const [saving, setSaving] = useState(false);

  // -------- datepicker --------
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [expiryDateObj, setExpiryDateObj] = useState(
    initial?.expiryDate ? new Date(initial.expiryDate) : null
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
        try { await initDB(); } catch (e) {
          Alert.alert('DB', 'Error inicializando la base de datos');
        }
        try {
          const rows = await listCategories();
          setCategories(rows);
        } catch (e) {
          Alert.alert('Error', 'No se pudieron cargar categorías.');
        }
      } catch (e) {}
    })();
  }, []);

  // ------------------- guardar producto -------------------
  const save = async () => {
    if (!barcode) return Alert.alert('Error', 'El código de barras es obligatorio');
    if (!name) return Alert.alert('Error', 'El nombre es obligatorio');           // 🔹 NUEVO
    if (!category) return Alert.alert('Error', 'La categoría es obligatoria');

    const payload = {
      barcode: String(barcode).trim(),
      name: String(name).trim(),                                                 // 🔹 NUEVO
      category: String(category).trim(),
      purchasePrice: purchasePrice !== '' ? String(purchasePrice).trim() : '0',
      salePrice: salePrice !== '' ? String(salePrice).trim() : '0',
      expiryDate: expiryDate || '',
      stock: stock !== '' ? String(stock).trim() : '0',
    };

    // Evitar duplicados si estamos creando
    if (!initial) {
      try {
        const exists = await getProductByBarcode(payload.barcode);
        if (exists) {
          Alert.alert('Duplicado', 'Ese código ya existe, se cargará para edición');
          setName(exists.name || '');                                            // 🔹 NUEVO
          setCategory(exists.category || '');
          setPurchasePrice(String(exists.purchase_price ?? ''));
          setSalePrice(String(exists.sale_price ?? ''));
          setExpiryDate(exists.expiry_date || '');
          setStock(String(exists.stock ?? ''));
          return;
        }
      } catch (e) { /* noop */ }
    }

    try {
      setSaving(true);

      // 1) Guardar LOCAL siempre
      await upsertProduct(payload);

      // 2) Cerrar inmediatamente la UI
      onSaved && onSaved();
      setSaving(false);

      // 3) Push remoto completamente en segundo plano (no bloquea)
      pushProductRemoteSafe(payload).catch(e => {
        console.warn('push remoto falló:', e?.message || e);
      });

    } catch (e) {
      console.error('Error al guardar producto:', e);
      Alert.alert('Error', 'No se pudo guardar el producto');
      setSaving(false);
    }
  };

  // ------------------- crear categoría -------------------
  const createCategory = async () => {
    const raw = newCategoryName || '';
    const name = raw.trim();
    if (!name) {
      Alert.alert('Atención', 'Escribe un nombre de categoría');
      return;
    }
    try {
      setCreatingCategory(true);
      const exists = categories.some(c => (c.name || '').toLowerCase() === name.toLowerCase());
      if (exists) {
        Alert.alert('Ya existe', 'Esa categoría ya está creada');
        setCreatingCategory(false);
        return;
      }
      try { await initDB(); } catch (e) {}
      await addCategory(name);
      const rows = await listCategories();
      setCategories(rows);
      setCategory(name);
      setNewCategoryName('');
      setCatSelectOpen(false);
    } catch (e) {
      console.error('Error al crear categoría:', e);
      Alert.alert('Error', 'No se pudo crear la categoría: ' + (e.message || 'Error desconocido'));
    } finally {
      setCreatingCategory(false);
    }
  };

  const CategoryField = () => (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ fontWeight: '600', marginBottom: 6 }}>Categoría</Text>
      <TouchableOpacity
        onPress={() => setCatSelectOpen(true)}
        activeOpacity={0.8}
        style={styles.selectButton}
      >
        <Text style={{ color: category ? '#111' : '#888' }}>
          {category || 'Selecciona una categoría'}
        </Text>
      </TouchableOpacity>
    </View>
  );

  const CategorySelectModal = () => (
    <Modal
      visible={catSelectOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setCatSelectOpen(false)}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={styles.title}>Selecciona categoría</Text>
          <FlatList
            data={categories}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={{ padding: 12, borderBottomWidth: 1, borderColor: '#eee' }}
                onPress={() => { setCategory(item.name); setCatSelectOpen(false); }}
              >
                <Text>{item.name}</Text>
              </TouchableOpacity>
            )}
          />
          <View style={{ height: 12 }} />
          <Text style={styles.subtitle}>Nueva categoría</Text>
          <TextInput
            style={styles.input}
            placeholder="Nombre de la categoría"
            value={newCategoryName}
            onChangeText={setNewCategoryName}
          />
          {creatingCategory ? (
            <ActivityIndicator />
          ) : (
            <Button title="Crear" onPress={createCategory} />
          )}
          <View style={{ height: 8 }} />
          <Button title="Cerrar" onPress={() => setCatSelectOpen(false)} color="#b00020" />
        </View>
      </View>
    </Modal>
  );

  return (
    <View style={{ flex: 1, padding: 16, backgroundColor: '#fff' }}>
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

      {/* 🔹 Campo Nombre de producto */}
      <TextInput
        style={styles.input}
        placeholder="Nombre del producto"
        value={name}
        onChangeText={setName}
      />

      <CategoryField />

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
                const s = fmtDate(date);
                setExpiryDate(s);
              }
            }}
            minimumDate={new Date()}
          />
        )}
      </View>

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
      <Button title="❌ Cancelar" onPress={onCancel} color="#b00020" />

      {/* Modal selección de categoría */}
      <CategorySelectModal />

      {/* Scanner modal */}
      <Modal visible={scanOpen} animationType="slide" onRequestClose={() => setScanOpen(false)}>
        <ScannerScreen
          onClose={() => setScanOpen(false)}
          onScanned={(code) => { setBarcode(code); setScanOpen(false); }}
        />
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 6 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 6,
    padding: 10, marginBottom: 8, backgroundColor: '#fff'
  },
  subtitle: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectButton: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 6,
    padding: 12, backgroundColor: '#fff'
  },
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', padding: 20
  },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, width: '100%'
  },
  catItem: {
    padding: 12, borderRadius: 8, backgroundColor: '#f5f5f5'
  },
});