// App.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView, View, Text, FlatList, Button, StyleSheet,
  Alert, Modal, TextInput, TouchableOpacity, Keyboard
} from 'react-native';

import { initDB, listProducts, deleteProductByBarcode } from './src/db';
import ProductForm from './src/screens/ProductForm';
import SellScreen from './src/screens/SellScreen';
import SalesHistoryScreen from './src/screens/SalesHistoryScreen';
import SalesDashboardScreen from './src/screens/SalesDashboardScreen';
// Si aún no usas sincronización, puedes ignorar estas importaciones
import { exportCSVFile, exportJSONFile } from './src/export';

import QuickScanScreen from './src/screens/QuickScanScreen';

export default function App() {
  const [ready, setReady] = useState(false);

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState(null);
  const [openForm, setOpenForm] = useState(false);
  const [openSales, setOpenSales] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [openDashboard, setOpenDashboard] = useState(false);
  const [openQuickScan, setOpenQuickScan] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await initDB();
        await refresh();
        setReady(true);
      } catch {
        Alert.alert('Error', 'Fallo al inicializar la base de datos');
      }
    })();
  }, []);

  const refresh = async () => {
    try {
      const rows = await listProducts();
      setProducts(rows);
    } catch {
      Alert.alert('Error', 'No se pudo cargar el listado');
    }
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
    setEditing(mapped);
    setOpenForm(true);
  };

  const onDelete = (item) => {
    Alert.alert('Confirmar', `¿Eliminar producto ${item.barcode}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: async () => {
          try { await deleteProductByBarcode(item.barcode); await refresh(); }
          catch { Alert.alert('Error', 'No se pudo eliminar'); }
        }
      }
    ]);
  };

  // --- FILTRO por nombre/código (ignora tildes y mayúsculas) ---
  const norm = (s) =>
    String(s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '');

  const filtered = useMemo(() => {
    if (!search.trim()) return products;
    const q = norm(search);
    return products.filter(p =>
      norm(p.name).includes(q) ||
      norm(p.category).includes(q) ||
      String(p.barcode || '').toLowerCase().includes(q)
    );
  }, [products, search]);

  if (!ready) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>Inicializando base de datos...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Inventario OlivoMarket (SQLite)</Text>

      {/* Acciones principales */}
      <View style={{ marginBottom: 10 }}>
        <Button title="➕ Nuevo producto" onPress={onCreate} />
        <View style={{ height: 8 }} />
        <Button title="📷 Escanear (crear / editar)" onPress={() => setOpenQuickScan(true)} />
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

      {/* Buscador */}
      <View style={styles.searchRow}>
        <TextInput
          style={[styles.input, { flex: 1 }]}
          placeholder="Buscar por nombre o código…"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          onSubmitEditing={() => Keyboard.dismiss()}
        />
        {search.length > 0 && (
          <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
            <Text style={{ color: '#555' }}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      <Text style={styles.subtitle}>
        Productos {search ? `(filtrados: ${filtered.length}/${products.length})` : `(${products.length})`}
      </Text>

      {/* Listado */}
      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        keyboardShouldPersistTaps="handled"
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
        ListEmptyComponent={
          <Text style={{ color: '#888', textAlign: 'center', marginTop: 12 }}>
            {search ? 'Sin resultados para tu búsqueda' : 'No hay productos'}
          </Text>
        }
      />

      {/* Formulario crear/editar */}
      <Modal visible={openForm} animationType="slide" onRequestClose={() => setOpenForm(false)}>
        <SafeAreaView style={{ flex: 1 }}>
          <ProductForm
            initial={editing}
            onSaved={async () => { setOpenForm(false); await refresh(); }}
            onCancel={() => setOpenForm(false)}
          />
        </SafeAreaView>
      </Modal>

      {/* Ventas */}
      <Modal visible={openSales} animationType="slide" onRequestClose={() => setOpenSales(false)}>
        <SafeAreaView style={{ flex: 1 }}>
          <SellScreen onClose={() => setOpenSales(false)} onSold={refresh} />
        </SafeAreaView>
      </Modal>

      {/* Historial de ventas */}
      <Modal visible={openHistory} animationType="slide" onRequestClose={() => setOpenHistory(false)}>
        <SafeAreaView style={{ flex: 1 }}>
          <SalesHistoryScreen onClose={() => setOpenHistory(false)} />
        </SafeAreaView>
      </Modal>

      {/* Dashboard */}
      <Modal visible={openDashboard} animationType="slide" onRequestClose={() => setOpenDashboard(false)}>
        <SafeAreaView style={{ flex: 1 }}>
          <SalesDashboardScreen onClose={() => setOpenDashboard(false)} />
        </SafeAreaView>
      </Modal>

      {/* Escaneo rápido: crear/editar */}
      <Modal visible={openQuickScan} animationType="slide" onRequestClose={() => setOpenQuickScan(false)}>
        <SafeAreaView style={{ flex: 1 }}>
          <QuickScanScreen
            onClose={async (changed) => {
              setOpenQuickScan(false);
              if (changed) await refresh();
            }}
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
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 8, padding: 10, backgroundColor: '#fff' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  clearBtn: {
    borderWidth: 1, borderColor: '#ddd', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#f5f5f5'
  },
  card: { backgroundColor: '#eef6ff', borderRadius: 10, padding: 12, marginBottom: 10 },
  cardTitle: { fontWeight: '700', marginBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
});