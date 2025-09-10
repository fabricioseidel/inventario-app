// App.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView, View, Text, FlatList, StyleSheet, Alert, Modal,
  TextInput, TouchableOpacity, Keyboard, Platform
} from 'react-native';

import { initDB, listProducts, deleteProductByBarcode } from './src/db';
import ProductForm from './src/screens/ProductForm';
import SellScreen from './src/screens/SellScreen';
import SalesHistoryScreen from './src/screens/SalesHistoryScreen';
import SalesDashboardScreen from './src/screens/SalesDashboardScreen';
import QuickScanScreen from './src/screens/QuickScanScreen';
import { exportCSVFile, exportJSONFile } from './src/export';

import Header from './src/ui/Header';
import TopTabs from './src/ui/TopTabs';
import FAB from './src/ui/FAB';
import { theme } from './src/ui/Theme';

// Sync cloud
import { syncNow, initRealtimeSync } from './src/sync';

export default function App() {
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('inventory');

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState(null);
  const [openForm, setOpenForm] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [openDashboard, setOpenDashboard] = useState(false);
  const [openQuickScan, setOpenQuickScan] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await initDB();
        await refresh();
        setReady(true);

        // Auto-sync al iniciar (si hay internet)
        try { await syncNow(); await refresh(); } catch {}
        initRealtimeSync();
      } catch {
        Alert.alert('Error', 'Fallo al inicializar la base de datos');
      }
    })();

    // Auto-sync cada 5 minutos (opcional)
    const id = setInterval(async () => {
      try { await syncNow(); await refresh(); } catch {}
    }, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const refresh = async () => {
    try {
      const rows = await listProducts();
      setProducts(rows);
    } catch {
      Alert.alert('Error', 'No se pudo cargar el listado');
    }
  };

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
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try { await deleteProductByBarcode(item.barcode); await refresh(); }
          catch { Alert.alert('Error', 'No se pudo eliminar'); }
        }
      }
    ]);
  };

  const manualSync = async () => {
    try {
      await syncNow();
      await refresh();
      Alert.alert('Sync', 'Sincronización completa.');
    } catch {
      Alert.alert('Sync', 'Error sincronizando. Revisa internet/clave y vuelve a intentar.');
    }
  };

  if (!ready) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>Inicializando base de datos...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <Header
        title="OlivoMarket"
        subtitle={tab === 'inventory' ? 'Inventario y productos' : tab === 'sales' ? 'Caja y ventas' : 'Reportes y tendencias'}
      />
      <TopTabs
        tabs={[{ key: 'inventory', label: 'Inventario' }, { key: 'sales', label: 'Ventas' }, { key: 'reports', label: 'Reportes' }]}
        current={tab}
        onChange={setTab}
      />

      {tab === 'inventory' && (
        <View style={styles.content}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.input}
              placeholder="Buscar por nombre, categoría o código…"
              value={search}
              onChangeText={setSearch}
              returnKeyType="search"
              onSubmitEditing={() => Keyboard.dismiss()}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} style={styles.clearBtn}>
                <Text style={{ color: theme.colors.textMuted }}>✕</Text>
              </TouchableOpacity>
            )}
          </View>

          <View style={styles.actionRow}>
            <TouchableOpacity style={styles.secondaryBtn} onPress={exportCSVFile}>
              <Text style={styles.secondaryBtnText}>Exportar CSV</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.secondaryBtn} onPress={exportJSONFile}>
              <Text style={styles.secondaryBtnText}>Exportar JSON</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.secondaryBtn, { borderColor: '#111' }]} onPress={manualSync}>
              <Text style={[styles.secondaryBtnText, { fontWeight: '800' }]}>🔄 Sync</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.caption}>
            {search ? `Resultados: ${filtered.length}/${products.length}` : `Productos: ${products.length}`}
          </Text>

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 120 }}
            renderItem={({ item }) => (
              <View style={styles.card}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.name || '(Sin nombre)'}</Text>
                  <Text style={styles.cardLine}>{item.category || 'Sin categoría'}</Text>
                  <Text style={styles.cardLine}>Código: {item.barcode}</Text>
                  <Text style={styles.cardLine}>Compra: ${item.purchase_price ?? 0} · Venta: ${item.sale_price ?? 0}</Text>
                  <Text style={styles.cardLine}>Vence: {item.expiry_date || '—'} · Stock: {item.stock ?? 0}</Text>
                </View>
                <View style={styles.cardActions}>
                  <TouchableOpacity style={styles.smallBtn} onPress={() => onEdit(item)}><Text style={styles.smallBtnTxt}>Editar</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#fde7ea', borderColor: '#f4b4bf' }]} onPress={() => onDelete(item)}><Text style={[styles.smallBtnTxt, { color: '#b00020' }]}>Eliminar</Text></TouchableOpacity>
                </View>
              </View>
            )}
            ListEmptyComponent={<Text style={styles.emptyText}>{search ? 'Sin resultados para tu búsqueda' : 'No hay productos'}</Text>}
          />

          <FAB
            items={[
              { icon: '📷', label: 'Escanear', onPress: () => setOpenQuickScan(true) },
              { icon: '➕', label: 'Nuevo', onPress: () => setOpenForm(true) },
            ]}
          />
        </View>
      )}

      {tab === 'sales' && (
        <View style={styles.content}>
          <SellScreen onClose={() => {}} onSold={async ()=>{ await refresh(); try{ await syncNow(); } catch{} }} />
        </View>
      )}

      {tab === 'reports' && (
        <View style={styles.content}>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: '#111' }]}
              onPress={manualSync}
            >
              <Text style={[styles.secondaryBtnText, { fontWeight: '800' }]}>🔄 Sync</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.reportGrid}>
            <TouchableOpacity style={styles.reportCard} onPress={() => setOpenHistory(true)}>
              <Text style={styles.reportEmoji}>📈</Text>
              <Text style={styles.reportTitle}>Historial de ventas</Text>
              <Text style={styles.reportDesc}>Filtra por día, semana, mes o rango. Detalles y anulación.</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.reportCard} onPress={() => setOpenDashboard(true)}>
              <Text style={styles.reportEmoji}>📊</Text>
              <Text style={styles.reportTitle}>Dashboard</Text>
              <Text style={styles.reportDesc}>Tendencia de 7 días, 30 días o 12 meses.</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modales */}
      <Modal visible={openForm} animationType="slide" onRequestClose={() => setOpenForm(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <Header title="Producto" subtitle={editing ? 'Editar' : 'Crear nuevo'} compact />
          <ProductForm
            initial={editing}
            onSaved={async () => { setOpenForm(false); await refresh(); }}
            onCancel={() => setOpenForm(false)}
          />
        </SafeAreaView>
      </Modal>

      <Modal visible={openQuickScan} animationType="slide" onRequestClose={() => setOpenQuickScan(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <Header title="Escanear" subtitle="Crear o editar producto" compact />
          <QuickScanScreen
            onClose={async (changed) => {
              setOpenQuickScan(false);
              if (changed) await refresh();
            }}
          />
        </SafeAreaView>
      </Modal>

      <Modal visible={openHistory} animationType="slide" onRequestClose={() => setOpenHistory(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <Header title="Reportes" subtitle="Historial de ventas" compact />
          <SalesHistoryScreen onClose={() => setOpenHistory(false)} />
        </SafeAreaView>
      </Modal>

      <Modal visible={openDashboard} animationType="slide" onRequestClose={() => setOpenDashboard(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <Header title="Reportes" subtitle="Dashboard" compact />
          <SalesDashboardScreen onClose={() => setOpenDashboard(false)} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flex: 1, paddingHorizontal: 16, paddingBottom: 12 },

  input: { flex: 1, borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 12, padding: Platform.OS === 'ios' ? 12 : 10, backgroundColor: '#fff' },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  clearBtn: { borderWidth: 1, borderColor: '#e6e6e6', paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, backgroundColor: '#f6f6f6' },

  actionRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  secondaryBtn: { flex: 1, borderWidth: 1, borderColor: '#e6e6e6', padding: 12, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center' },
  secondaryBtnText: { fontWeight: '600', color: '#333' },
  caption: { marginTop: 10, color: '#666' },

  card: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: '#fff', borderRadius: 14, padding: 12, marginTop: 10,
    borderWidth: 1, borderColor: '#ececec',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1,
  },
  cardTitle: { fontWeight: '700', fontSize: 16, marginBottom: 2 },
  cardLine: { color: '#555' },
  cardActions: { gap: 6 },
  smallBtn: { borderWidth: 1, borderColor: '#d8e7ff', backgroundColor: '#eef6ff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  smallBtnTxt: { color: '#0b5', fontWeight: '700' },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 24 },

  reportGrid: { flexDirection: 'row', gap: 12, marginTop: 12 },
  reportCard: {
    flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#eee',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1
  },
  reportEmoji: { fontSize: 28, marginBottom: 6 },
  reportTitle: { fontSize: 16, fontWeight: '700' },
  reportDesc: { color: '#666', marginTop: 4 },
});
