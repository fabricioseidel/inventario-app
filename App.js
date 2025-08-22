// App.js
import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, FlatList, Button, StyleSheet, Alert, Modal } from 'react-native';
import { initDB, listProducts, deleteProductByBarcode } from './src/db';
import ProductForm from './src/screens/ProductForm';
import SellScreen from './src/screens/SellScreen';
import SalesHistoryScreen from './src/screens/SalesHistoryScreen';
import SalesDashboardScreen from './src/screens/SalesDashboardScreen';
import { exportCSVFile, exportJSONFile } from './src/export';

export default function App() {
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [openForm, setOpenForm] = useState(false);
  const [openSales, setOpenSales] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [openDashboard, setOpenDashboard] = useState(false);

  useEffect(() => {
    (async () => {
      try { await initDB(); await refresh(); setReady(true); }
      catch { Alert.alert('Error', 'Fallo al inicializar la base de datos'); }
    })();
  }, []);

  const refresh = async () => {
    try { const rows = await listProducts(); setProducts(rows); }
    catch { Alert.alert('Error', 'No se pudo cargar el listado'); }
  };

  const onCreate = () => { setEditing(null); setOpenForm(true); };
  const onEdit = (item) => {
    const mapped = {
      barcode: item.barcode,
      name: item.name || '',
      category: item.category || '',
      purchasePrice: String(item.purchase_price ?? ''),
      salePrice: String(item.sale_price ?? ''),
      expiryDate: item.expiry_date || '',
      stock: String(item.stock ?? ''),
    };
    setEditing(mapped); setOpenForm(true);
  };
  const onDelete = (item) => {
    Alert.alert('Confirmar', `¿Eliminar producto ${item.barcode}?`, [
      { text:'Cancelar', style:'cancel' },
      { text:'Eliminar', style:'destructive', onPress: async ()=>{ try{ await deleteProductByBarcode(item.barcode); await refresh(); } catch{ Alert.alert('Error','No se pudo eliminar'); } } }
    ]);
  };

  if (!ready) {
    return <SafeAreaView style={styles.center}><Text>Inicializando base de datos...</Text></SafeAreaView>;
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Inventario OlivoMarket (SQLite)</Text>

      <View style={{ marginBottom: 10 }}>
        <Button title="➕ Nuevo producto" onPress={onCreate} />
        <View style={{ height: 8 }} />
        <Button title="🧾 Ir a Ventas" onPress={() => setOpenSales(true)} />
        <View style={{ height: 8 }} />
        <Button title="📈 Historial de ventas" onPress={() => setOpenHistory(true)} />
        <View style={{ height: 8 }} />
        <Button title="📊 Dashboard" onPress={() => setOpenDashboard(true)} />
        <View style={{ height: 8 }} />
        <Button title=" Exportar CSV productos" onPress={exportCSVFile} />
        <View style={{ height: 8 }} />
        <Button title=" Exportar JSON productos" onPress={exportJSONFile} />
      </View>

      <Text style={styles.subtitle}>Productos ({products.length})</Text>
      <FlatList
        data={products}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>{item.name || '(Sin nombre)'} · {item.category || '(Sin categoría)'}</Text>
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

      {/* Formularios y pantallas */}
      <Modal visible={openForm} animationType="slide" onRequestClose={() => setOpenForm(false)}>
        <SafeAreaView style={{ flex: 1 }}>
          <ProductForm initial={editing} onSaved={async ()=>{ setOpenForm(false); await refresh(); }} onCancel={()=>setOpenForm(false)} />
        </SafeAreaView>
      </Modal>

      <Modal visible={openSales} animationType="slide" onRequestClose={() => setOpenSales(false)}>
        <SafeAreaView style={{ flex: 1 }}>
          <SellScreen onClose={() => setOpenSales(false)} onSold={refresh} />
        </SafeAreaView>
      </Modal>

      <Modal visible={openHistory} animationType="slide" onRequestClose={() => setOpenHistory(false)}>
        <SafeAreaView style={{ flex: 1 }}>
          <SalesHistoryScreen onClose={() => setOpenHistory(false)} />
        </SafeAreaView>
      </Modal>

      <Modal visible={openDashboard} animationType="slide" onRequestClose={() => setOpenDashboard(false)}>
        <SafeAreaView style={{ flex: 1 }}>
          <SalesDashboardScreen onClose={() => setOpenDashboard(false)} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container:{ flex: 1, padding: 16, backgroundColor: '#fff' },
  center:{ flex:1, alignItems:'center', justifyContent:'center' },
  title:{ fontSize: 22, fontWeight: 'bold', textAlign: 'center', marginBottom: 12 },
  subtitle:{ fontSize: 16, fontWeight: '700', marginVertical: 8 },
  card:{ backgroundColor: '#eef6ff', borderRadius: 10, padding: 12, marginBottom: 10 },
  cardTitle:{ fontWeight: '700', marginBottom: 4 },
  row:{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
});