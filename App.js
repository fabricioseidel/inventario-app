// App.js
import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, FlatList, Button, StyleSheet, Alert, Modal } from 'react-native';
import { initDB, listProducts, deleteProductByBarcode } from './src/db';
import { useErrorLogs, clearErrors, logError, installGlobalErrorCapture } from './src/errorLogger';
import ProductForm from './src/screens/ProductForm';
import { exportCSVFile, exportJSONFile } from './src/export';

export default function App() {
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null); // producto para editar o null
  const [openForm, setOpenForm] = useState(false);
  const [errorPanel, setErrorPanel] = useState(false);
  const errors = useErrorLogs();

  useEffect(() => {
    installGlobalErrorCapture();
    (async () => {
      try {
        try {
          await initDB();
        } catch (e) {
          logError('db_init', e);
          Alert.alert('DB', 'Error inicializando la base de datos');
        }
        try {
          await refresh();
        } catch (e) {
          logError('products_load', e);
        }
        setReady(true);
      } catch (e) { logError('app_boot', e); Alert.alert('Error', 'Fallo general al iniciar'); }
    })();
  }, []);

  const refresh = async () => {
    try {
      const rows = await listProducts();
      setProducts(rows);
    } catch (e) {
      logError('products_refresh', e);
      Alert.alert('Error', 'No se pudo cargar el listado');
    }
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
          try {
            await deleteProductByBarcode(item.barcode);
            await refresh();
          } catch (e) { logError('product_delete', e); Alert.alert('Error', 'No se pudo eliminar'); }
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
        <View style={{ height: 8 }} />
        <Button title={`⚠️ Errores (${errors.length})`} color={errors.length ? '#c0392b' : '#666'} onPress={() => setErrorPanel(true)} />
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
      <Modal visible={errorPanel} animationType="fade" onRequestClose={() => setErrorPanel(false)}>
        <SafeAreaView style={{ flex:1, backgroundColor:'#111' }}>
          <View style={{ flexDirection:'row', justifyContent:'space-between', padding:12 }}>
            <Text style={{ color:'#fff', fontWeight:'700', fontSize:16 }}>Errores ({errors.length})</Text>
            <Button title="Cerrar" onPress={() => setErrorPanel(false)} />
          </View>
          <FlatList
            data={errors}
            keyExtractor={i=>i.id}
            style={{ flex:1, paddingHorizontal:12 }}
            renderItem={({ item }) => (
              <View style={{ backgroundColor:'#222', padding:10, borderRadius:8, marginBottom:10 }}>
                <Text style={{ color:'#0af', fontWeight:'600' }}>{item.ts} · {item.context}</Text>
                <Text style={{ color:'#fff' }}>{item.message}</Text>
                {!!item.stack && <Text style={{ color:'#888', fontSize:10, marginTop:4 }}>{item.stack.split('\n')[0]}</Text>}
              </View>
            )}
          />
          <View style={{ padding:12 }}>
            {errors.length > 0 && <Button title="Limpiar errores" color="#e67e22" onPress={() => clearErrors()} />}
          </View>
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
