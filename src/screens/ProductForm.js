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
// Si tienes un logger de errores en tu proyecto, descomenta:
// import { logError } from '../errorLogger';

export default function ProductForm({ initial, onSaved, onCancel }) {
  // -------- formulario --------
  const [barcode, setBarcode] = useState(initial?.barcode || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [purchasePrice, setPurchasePrice] = useState(String(initial?.purchasePrice ?? ''));
  const [salePrice, setSalePrice] = useState(String(initial?.salePrice ?? ''));
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate || '');
  const [stock, setStock] = useState(String(initial?.stock ?? ''));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [expiryDateObj, setExpiryDateObj] = useState(initial?.expiryDate ? new Date(initial.expiryDate) : null);
  const fmtDate = (d) => {
    if (!d || isNaN(d.getTime())) return '';
    const y = d.getFullYear();
    const m = String(d.getMonth()+1).padStart(2,'0');
    const day = String(d.getDate()).padStart(2,'0');
    return `${y}-${m}-${day}`; // ISO corto
  };

  // -------- categorías --------
  const [categories, setCategories] = useState([]);
  const [catSelectOpen, setCatSelectOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [creatingCategory, setCreatingCategory] = useState(false);

  // -------- scanner --------
  const [scanOpen, setScanOpen] = useState(false);

  // -------- ui state --------
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Asegurarse de que la BD esté inicializada antes de intentar cargar categorías
        try {
          await initDB(); // Intentar inicializar la BD aquí también, como respaldo
        } catch (e) {
          console.warn("Advertencia: No se pudo reinicializar la BD en el formulario", e);
        }
        
        const rows = await listCategories();
        setCategories(rows);
      } catch (e) {
        console.error('Error al cargar categorías:', e);
        // logError?.('categories_load', e);
        Alert.alert('Error', 'No se pudieron cargar categorías. Intenta cerrar y abrir la app nuevamente.');
      }
    })();
  }, []);

  // ------------------- guardar producto -------------------
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

    // Evitar duplicados si estamos creando
    if (!initial) {
      try {
        const exists = await getProductByBarcode(payload.barcode);
        if (exists) {
          Alert.alert('Duplicado', 'Ese código ya existe, se cargará para edición');
          setCategory(exists.category || '');
          setPurchasePrice(String(exists.purchase_price ?? ''));
          setSalePrice(String(exists.sale_price ?? ''));
          setExpiryDate(exists.expiry_date || '');
          setStock(String(exists.stock ?? ''));
          return;
        }
      } catch (e) {/* noop */}
    }

    try {
      setSaving(true);
      await upsertProduct(payload);
      try {
        const timeout = new Promise((_, rej) => setTimeout(() => rej(new Error('timeout remote push')), 8000));
        await Promise.race([pushProductRemoteSafe(payload), timeout]);
      } catch (e) { console.warn('push remoto falló/timeout:', e?.message || e); }
      onSaved && onSaved();
    } catch (e) {
      console.error('Error al guardar producto:', e);
      // logError?.('product_save', e);
      Alert.alert('Error', 'No se pudo guardar el producto');
    } finally {
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
      
      // Asegurarse de que la BD esté inicializada antes de intentar crear una categoría
      try {
        await initDB(); // Intenta inicializar la BD antes de crear la categoría
      } catch (e) {
        console.warn("Advertencia: Falló al inicializar BD antes de crear categoría", e);
      }
      
      // Agrega un timeout como medida de seguridad
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout al crear categoría')), 10000)
      );
      
      // Usa Promise.race para evitar bloqueos indefinidos
      await Promise.race([
        addCategory(name),
        timeoutPromise
      ]);
      
      const rows = await listCategories();
      setCategories(rows);
      setCategory(name);
      setNewCategoryName('');
      // Cierra el modal automáticamente si todo sale bien
      setCatSelectOpen(false);
    } catch (e) {
      console.error('Error al crear categoría:', e);
      // logError?.('category_add', e);
      Alert.alert('Error', 'No se pudo crear la categoría: ' + (e.message || 'Error desconocido'));
    } finally {
      setCreatingCategory(false);
    }
  };

  // ------------------- UI: render categoría actual -------------------
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

  // ------------------- UI: modal de selección de categoría -------------------
  const CategorySelectModal = () => (
    <Modal
      visible={catSelectOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setCatSelectOpen(false)}
      statusBarTranslucent
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalCard}>
          <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Seleccionar categoría</Text>

          <FlatList
            data={categories}
            keyExtractor={(item) => String(item.id)}
            style={{ maxHeight: 260, marginBottom: 10 }}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.catItem}
                onPress={() => { setCategory(item.name); setCatSelectOpen(false); }}
              >
                <Text>{item.name}</Text>
              </TouchableOpacity>
            )}
            ListEmptyComponent={<Text style={{ color: '#666' }}>Sin categorías</Text>}
          />

          <View style={{ height: 8 }} />

          <Text style={{ fontWeight: '600', marginBottom: 6 }}>➕ Nueva categoría</Text>
          <View style={{ marginBottom: 10 }}>
        <Text style={{ fontWeight: '600', marginBottom: 6 }}>Fecha de caducidad</Text>
        <TouchableOpacity
          style={[styles.input, { justifyContent:'center' }]}
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
