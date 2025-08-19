import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, Button, FlatList, Alert,
  StyleSheet, SafeAreaView, Dimensions, Platform, Modal
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Picker } from '@react-native-picker/picker';

// =========================================================
//   CONSTANTES Y PRESETS
// =========================================================
const DEFAULT_CATEGORIES = [
  { id: 'bebidas',   name: 'Bebidas' },
  { id: 'abarrotes', name: 'Abarrotes' },
  { id: 'panes',     name: 'Panes' },
  { id: 'postres',   name: 'Postres' },
  { id: 'quesos',    name: 'Quesos' },
  { id: 'cecinas',   name: 'Cecinas' },
  { id: 'helados',   name: 'Helados' },
  { id: 'hielo',     name: 'Hielo' },
  { id: 'mascotas',  name: 'Mascotas' },
  { id: 'aseo',      name: 'Aseo' },
];

const PRODUCTS_KEY = 'olivo_products_v1';
const CATEGORIES_KEY = 'olivo_categories';

// =========================================================
//   APP PRINCIPAL
// =========================================================
export default function App() {
  // -------- Productos (internamente usamos rowId para editar) --------
  const [products, setProducts] = useState([]);
  const [barcode, setBarcode] = useState('');
  const [category, setCategory] = useState('');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [salePrice, setSalePrice] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [stock, setStock] = useState('');
  const [editingRowId, setEditingRowId] = useState(null); // id interno

  // -------- Categorías --------
  const [categories, setCategories] = useState([...DEFAULT_CATEGORIES]);
  const [catModalVisible, setCatModalVisible] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // -------- Cámara --------
  const [showScanner, setShowScanner] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();

  // =========================================================
  //   PERSISTENCIA INICIAL (LOAD)
  // =========================================================
  useEffect(() => {
    (async () => {
      // Cargar categorías
      try {
        const rawCats = await AsyncStorage.getItem(CATEGORIES_KEY);
        if (rawCats) {
          const parsedCats = JSON.parse(rawCats);
          if (Array.isArray(parsedCats) && parsedCats.length) setCategories(parsedCats);
        }
      } catch (e) {
        console.warn('No se pudo cargar categorías:', e);
      }

      // Cargar productos
      try {
        const raw = await AsyncStorage.getItem(PRODUCTS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            // Normalizar: asegurar rowId si faltara (compatibilidad futura)
            const normalized = parsed.map((p, i) => (
              p?.rowId ? p : { ...p, rowId: `${Date.now()}-${i}` }
            ));
            setProducts(normalized);
          }
        }
      } catch (e) {
        console.warn('No se pudo cargar productos:', e);
      }
    })();
  }, []);

  // Guardar productos al cambiar
  useEffect(() => {
    (async () => {
      try {
        await AsyncStorage.setItem(PRODUCTS_KEY, JSON.stringify(products));
      } catch (e) {
        console.warn('No se pudo guardar productos:', e);
      }
    })();
  }, [products]);

  // =========================================================
  //   PERSISTENCIA DE CATEGORÍAS
  // =========================================================
  const persistCategories = async (next) => {
    setCategories(next);
    try {
      await AsyncStorage.setItem(CATEGORIES_KEY, JSON.stringify(next));
    } catch (e) {
      console.warn('No se pudo guardar categorías:', e);
    }
  };

  const addCategory = () => {
    const name = (newCategoryName || '').trim();
    if (!name) {
      Alert.alert('Atención', 'Escribe un nombre de categoría');
      return;
    }
    const exists = categories.some(c => c.name.toLowerCase() === name.toLowerCase());
    if (exists) {
      Alert.alert('Ya existe', 'Esa categoría ya está creada');
      return;
    }
    const id = name
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, '-');
    const next = [...categories, { id, name }];
    persistCategories(next);
    setCategory(name);
    setNewCategoryName('');
    setCatModalVisible(false);
  };

  // =========================================================
  //   PRODUCTOS
  // =========================================================
  const resetForm = () => {
    setBarcode('');
    setCategory('');
    setPurchasePrice('');
    setSalePrice('');
    setExpiryDate('');
    setStock('');
    setEditingRowId(null);
  };

  const saveProduct = () => {
    if (!barcode) {
      Alert.alert('Error', 'El código de barras es obligatorio');
      return;
    }
    if (!category) {
      Alert.alert('Error', 'La categoría es obligatoria');
      return;
    }
    const base = {
      // Campos de dominio
      barcode: barcode.trim(),
      category: (category || '').trim(),
      purchasePrice: (purchasePrice || '').trim(),
      salePrice: (salePrice || '').trim(),
      expiryDate: (expiryDate || '').trim(),
      stock: (stock || '').trim(),
      // Interno para control de edición
      rowId: editingRowId || Date.now().toString(),
    };

    if (editingRowId) {
      setProducts(prev => prev.map(p => (p.rowId === editingRowId ? { ...p, ...base } : p)));
    } else {
      // Evitar duplicados por barcode si quieres forzarlo
      const dup = products.find(p => p.barcode === base.barcode);
      if (dup) {
        Alert.alert('Duplicado', 'Ese código de barras ya existe. Se cargó para edición.');
        loadForEdit(dup);
        return;
      }
      setProducts(prev => [...prev, base]);
    }
    resetForm();
  };

  const loadForEdit = (product) => {
    setBarcode(product.barcode || '');
    setCategory(product.category || '');
    setPurchasePrice(product.purchasePrice || '');
    setSalePrice(product.salePrice || '');
    setExpiryDate(product.expiryDate || '');
    setStock(product.stock || '');
    setEditingRowId(product.rowId);
  };

  const deleteProduct = (rowId) => {
    setProducts(prev => prev.filter(p => p.rowId !== rowId));
    if (editingRowId === rowId) resetForm();
  };

  const searchByBarcode = () => {
    if (!barcode) return;
    const existing = products.find(p => p.barcode === barcode);
    if (existing) {
      loadForEdit(existing);
      Alert.alert('Encontrado', 'Producto cargado para editar');
    } else {
      Alert.alert('No encontrado', 'Crear nuevo producto');
    }
  };

  // =========================================================
  //   ESCÁNER
  // =========================================================
  const ensurePermissionAndOpen = async () => {
    if (!permission || !permission.granted) {
      const res = await requestPermission();
      if (!res.granted) {
        Alert.alert('Sin permiso', 'Necesitamos acceso a la cámara para escanear códigos');
        return;
      }
    }
    setScanned(false);
    setShowScanner(true);
  };

  const handleBarCodeScanned = (result) => {
    if (scanned) return;
    setScanned(true);
    const code = String(result?.data ?? '');
    setBarcode(code);
    setShowScanner(false);

    const existing = products.find(p => p.barcode === code);
    if (existing) {
      loadForEdit(existing);
      Alert.alert('Producto encontrado!', `Código: ${code}\nListo para editar`);
    } else {
      Alert.alert('Nuevo código detectado!', `Código: ${code}\nCrear nuevo producto`);
    }
  };

  // =========================================================
  //   EXPORTACIONES (JSON/CSV en orden específico)
  //   Orden requerido: barcode, id, category, purchasePrice, salePrice, expiryDate, stock
  //   Nota: En la exportación, id = barcode
  // =========================================================
  const makeOrderedArray = (rows) =>
    rows.map(p => ({
      barcode: p.barcode ?? '',
      id: p.barcode ?? '',                // id = barcode para la app consumidora
      category: p.category ?? '',
      purchasePrice: p.purchasePrice ?? '',
      salePrice: p.salePrice ?? '',
      expiryDate: p.expiryDate ?? '',
      stock: p.stock ?? '',
    }));

  const buildCSV = (rows) => {
    let csv = 'Código de barra,Id,Categoría,Precio de compra,Precio de venta,Fecha de caducidad,Stock\n';
    rows.forEach(p => {
      const safe = (v) => String(v ?? '').replace(/"/g, '""');
      const line = `"${safe(p.barcode)}","${safe(p.barcode)}","${safe(p.category)}","${safe(p.purchasePrice)}","${safe(p.salePrice)}","${safe(p.expiryDate)}","${safe(p.stock)}"\n`;
      csv += line;
    });
    return csv;
  };

  const saveAndShare = async (content, filename, mimeType) => {
    try {
      const uri = FileSystem.cacheDirectory + filename;
      await FileSystem.writeAsStringAsync(uri, content, { encoding: FileSystem.EncodingType.UTF8 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, { mimeType });
      } else {
        Alert.alert('Archivo listo', `Guardado en: ${uri}`);
      }
    } catch (e) {
      console.error(e);
      Alert.alert('Error', 'No se pudo exportar el archivo.');
    }
  };

  const exportJSONToFile = async () => {
    if (products.length === 0) {
      Alert.alert('Sin datos', 'No hay productos para exportar');
      return;
    }
    const ordered = makeOrderedArray(products);
    const jsonText = JSON.stringify(ordered, null, 2);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await saveAndShare(jsonText, `olivomarket_productos_${stamp}.json`, 'application/json');
  };

  const exportCSVToFile = async () => {
    if (products.length === 0) {
      Alert.alert('Sin datos', 'No hay productos para exportar');
      return;
    }
    const ordered = makeOrderedArray(products);
    const csv = buildCSV(ordered);
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    await saveAndShare(csv, `olivomarket_productos_${stamp}.csv`, 'text/csv');
  };

  // =========================================================
  //   UTILIDAD: LIMPIAR DATOS LOCALES
  // =========================================================
  const clearAllData = async () => {
    Alert.alert('Confirmar', '¿Borrar productos y categorías locales?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Borrar',
        style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.multiRemove([PRODUCTS_KEY, CATEGORIES_KEY]);
            setProducts([]);
            setCategories([...DEFAULT_CATEGORIES]);
            Alert.alert('Listo', 'Datos locales borrados');
          } catch (e) {
            Alert.alert('Error', 'No se pudo borrar');
          }
        }
      }
    ]);
  };

  // =========================================================
  //   VISTA DEL ESCÁNER
  // =========================================================
  if (showScanner) {
    if (Platform.OS === 'web') {
      return (
        <View style={styles.centerContainer}>
          <Text>La cámara no está disponible en el preview Web de Snack.</Text>
          <Button title="Volver" onPress={() => setShowScanner(false)} />
        </View>
      );
    }
    if (!permission) {
      return (
        <View style={styles.centerContainer}>
          <Text>Comprobando permisos de cámara...</Text>
        </View>
      );
    }
    if (!permission.granted) {
      return (
        <View style={styles.centerContainer}>
          <Text>Se requiere permiso de cámara</Text>
          <Button title="Conceder permiso" onPress={requestPermission} />
          <Button title="Volver" onPress={() => setShowScanner(false)} />
        </View>
      );
    }
    return (
      <View style={styles.scannerContainer}>
        <CameraView
          style={StyleSheet.absoluteFillObject}
          facing="back"
          onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
          barcodeScannerSettings={{
            barcodeTypes: ['qr','ean13','ean8','code128','code39','upc_a','upc_e'],
          }}
        />
        <View style={styles.scannerOverlay}>
          <View style={styles.scannerFrame} />
          <Text style={styles.scannerText}>
            {scanned ? 'Código escaneado!' : 'Apunta al código de barras'}
          </Text>
          <View style={styles.scannerButtons}>
            {scanned && <Button title="Escanear otro" onPress={() => setScanned(false)} />}
            <Button title="Cancelar" onPress={() => setShowScanner(false)} />
          </View>
        </View>
      </View>
    );
  }

  // =========================================================
  //   VISTA PRINCIPAL
  // =========================================================
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>📱 Barcode Inventory</Text>

      <View style={styles.form}>
        <View style={styles.barcodeRow}>
          <TextInput
            style={[styles.input, { flex: 1, marginRight: 10 }]}
            placeholder="Código de barras"
            value={barcode}
            onChangeText={setBarcode}
          />
          <Button title="📷" onPress={ensurePermissionAndOpen} />
        </View>

        <Button title="🔍 Buscar por código" onPress={searchByBarcode} />

        <Text style={{ marginBottom: 6, fontWeight: '600' }}>Categoría</Text>
        <View style={{ borderWidth: 1, borderColor: '#ddd', borderRadius: 6, marginBottom: 10 }}>
          <Picker
            selectedValue={category || ''}
            onValueChange={(val) => {
              if (val === '__new__') {
                setCatModalVisible(true);
              } else {
                setCategory(val);
              }
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

        <Button title={editingRowId ? '✅ Actualizar' : '➕ Guardar'} onPress={saveProduct} />

        {editingRowId && (
          <Button title="❌ Cancelar" onPress={resetForm} />
        )}
      </View>

      <View style={styles.actions}>
        <Button title="📊 Exportar CSV (archivo)" onPress={exportCSVToFile} />
        <View style={{ height: 8 }} />
        <Button title="🧰 Exportar JSON (backup)" onPress={exportJSONToFile} />
        <View style={{ height: 8 }} />
        <Button title="🧹 Borrar datos locales" onPress={clearAllData} />
      </View>

      <Text style={styles.subtitle}>Productos ({products.length})</Text>
      <FlatList
        data={products}
        keyExtractor={item => item.rowId}
        renderItem={({ item }) => (
          <View style={styles.productCard}>
            <Text style={styles.productName}>{item.category || '(Sin categoría)'}</Text>
            <Text>Código: {item.barcode}</Text>
            <Text>Compra: ${item.purchasePrice} | Venta: ${item.salePrice}</Text>
            <Text>Vence: {item.expiryDate || '—'} | Stock: {item.stock || '0'}</Text>
            <View style={styles.productActions}>
              <Button title="✏️ Editar" onPress={() => loadForEdit(item)} />
              <Button title="🗑️ Eliminar" onPress={() => deleteProduct(item.rowId)} />
            </View>
          </View>
        )}
      />

      {/* Modal Nueva Categoría */}
      <Modal
        visible={catModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setCatModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 10 }}>Nueva categoría</Text>
            <TextInput
              style={styles.input}
              placeholder="Ej: Snacks"
              value={newCategoryName}
              onChangeText={setNewCategoryName}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10 }}>
              <Button title="Cancelar" onPress={() => { setNewCategoryName(''); setCatModalVisible(false); }} />
              <Button title="Crear" onPress={addCategory} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// =========================================================
//   ESTILOS
// =========================================================
const { width } = Dimensions.get('window');
const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: '#fff' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  subtitle: { fontSize: 18, fontWeight: 'bold', marginVertical: 10 },
  form: { backgroundColor: '#f5f5f5', padding: 15, borderRadius: 10, marginBottom: 20 },
  barcodeRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#ddd', padding: 10, marginBottom: 10, borderRadius: 5, backgroundColor: '#fff' },
  actions: { marginBottom: 20 },
  productCard: { backgroundColor: '#e8f4f8', padding: 15, marginBottom: 10, borderRadius: 8 },
  productName: { fontSize: 16, fontWeight: 'bold', marginBottom: 5 },
  productActions: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 10 },

  // Scanner
  scannerContainer: { flex: 1 },
  scannerOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scannerFrame: {
    width: width * 0.8, height: width * 0.6,
    borderWidth: 2, borderColor: '#00ff00', backgroundColor: 'transparent', marginBottom: 50,
  },
  scannerText: {
    color: 'white', fontSize: 18, fontWeight: 'bold', textAlign: 'center',
    marginBottom: 30, backgroundColor: 'rgba(0,0,0,0.7)', padding: 10, borderRadius: 10,
  },
  scannerButtons: { flexDirection: 'row', gap: 20 },

  // Modal
  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center', padding: 20
  },
  modalCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16, width: '100%'
  },
});
