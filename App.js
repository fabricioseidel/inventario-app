// App.js
import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, FlatList, Button, StyleSheet, Alert, Modal } from 'react-native';
import { initDB, listProducts, deleteProductByBarcode } from './src/db';
import ProductForm from './src/screens/ProductForm';
import { exportCSVFile, exportJSONFile } from './src/export';

export default function App() {
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null); // producto para editar o null
  const [openForm, setOpenForm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await initDB();
        await refresh();
        setReady(true);
      } catch (e) {
        Alert.alert('DB', 'Error inicializando la base de datos');
      }
    })();
  }, []);

  const refresh = async () => {
    const rows = await listProducts();
    setProducts(rows);
  };

  const onCreate = () => { setEditing(null); setOpenForm(true); };
  const onEdit = (item) => {
    // Mapear columnas de SQLite a props del formulario
    const mapped = {
      barcode: item.barcode,
      category: item.category || '',
      purchasePrice: String(item.purchase_price ?? ''),
      salePrice: String(item.sale_price ?? ''),
      expiryDate: item.expiry_date || '',
      stock: String(item.stock ?? ''),
    };
    setEditing(mapped);
    setOpenForm(true);
  };

  const onDelete = async (item) => {
    Alert.alert('Confirmar', `¿Eliminar producto ${item.barcode}?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Eliminar', style: 'destructive', onPress: async () => {
          await deleteProductByBarcode(item.barcode);
          await refresh();
        }
      }
    ]);
  };

  const onSaved = async () => {
    setOpenForm(false);
    await refresh();
  };

  if (!ready) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>Inicializando base de datos...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>📦 Inventario OlivoMarket (SQLite)</Text>

      <View style={{ marginBottom: 10 }}>
        <Button title="➕ Nuevo producto" onPress={onCreate} />
        <View style={{ height: 8 }} />
        <Button title="📊 Exportar CSV" onPress={exportCSVFile} />
        <View style={{ height: 8 }} />
        <Button title="🧰 Exportar JSON" onPress={exportJSONFile} />
      </View>

      <Text style={styles.subtitle}>Productos ({products.length})</Text>
      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.category || '(Sin categoría)'}</Text>
            <Text>Código: {item.barcode}</Text>
            <Text>Compra: ${item.purchase_price ?? 0} | Venta: ${item.sale_price ?? 0}</Text>
            <Text>Vence: {item.expiry_date || '—'} | Stock: {item.stock ?? 0}</Text>
            <View style={styles.row}>
              <Button title="✏️ Editar" onPress={() => onEdit(item)} />
              <Button title="🗑️ Eliminar" onPress={() => onDelete(item)} color="#b00020" />
            </View>
          </View>
        )}
      />

      <Modal visible={openForm} animationType="slide" onRequestClose={() => setOpenForm(false)}>
        <SafeAreaView style={{ flex: 1 }}>
          <ProductForm
            initial={editing}
            onSaved={onSaved}
            onCancel={() => setOpenForm(false)}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: '#fff' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  subtitle: { fontSize: 16, fontWeight: '700', marginVertical: 8 },
  card: { backgroundColor: '#eef6ff', borderRadius: 10, padding: 12, marginBottom: 10 },
  cardTitle: { fontWeight: '700', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
});
