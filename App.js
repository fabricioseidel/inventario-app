// App.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView, View, Text, FlatList, StyleSheet, Alert, Modal,
  TextInput, TouchableOpacity, Keyboard, Platform, Image, useWindowDimensions
} from 'react-native';
import { InteractionManager } from 'react-native';

import { initDB, listProducts, deleteProductByBarcode } from './src/db';
import ProductForm from './src/screens/ProductForm';
import SellScreen from './src/screens/SellScreen';
import SalesHistoryScreen from './src/screens/SalesHistoryScreen';
import SalesDashboardScreen from './src/screens/SalesDashboardScreen';
import CashHistoryScreen from './src/screens/CashHistoryScreen';
import QuickScanScreen from './src/screens/QuickScanScreen';
import LoginScreen from './src/screens/LoginScreen';
import CashManagementScreen from './src/screens/CashManagementScreen';
import { exportCSVFile, exportJSONFile } from './src/export';

import Header from './src/ui/Header';
import TopTabs from './src/ui/TopTabs';
import FAB from './src/ui/FAB';
import { theme } from './src/ui/Theme';

// Sync cloud
import { syncNow, initRealtimeSync } from './src/sync';

// Auth
import AuthManager from './src/auth/AuthManager';

// Separamos la función App para garantizar el orden correcto de los hooks
export default function App() {
  // Estados de autenticación
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Estados de la aplicación - TODOS los hooks deben definirse aquí al principio
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState('sales');

  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState('');
  const [hasMoreProducts, setHasMoreProducts] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [editing, setEditing] = useState(null);
  const [openForm, setOpenForm] = useState(false);
  const [openHistory, setOpenHistory] = useState(false);
  const [openDashboard, setOpenDashboard] = useState(false);
  const [openCashHistory, setOpenCashHistory] = useState(false);
  const [openQuickScan, setOpenQuickScan] = useState(false);
  const [openCash, setOpenCash] = useState(false);
  const [isSyncLoading, setIsSyncLoading] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(Date.now());
  const [saleRequestedBarcode, setSaleRequestedBarcode] = useState(null);
  const [recentlyCreatedBarcode, setRecentlyCreatedBarcode] = useState(null);
  const [initError, setInitError] = useState(null);

  const { width } = useWindowDimensions();
  const isCompact = width < 380;

  // Verificar autenticación al iniciar
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await AuthManager.getCurrentUser();
        if (user) {
          setCurrentUser(user);
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.error('Error verificando autenticación:', error);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, []);

  const handleLoginSuccess = useCallback((user) => {
    setCurrentUser(user);
    setIsLoggedIn(true);
  }, []);

  const handleLogout = useCallback(async () => {
    Alert.alert(
      'Cerrar Sesión',
      `¿Deseas cerrar la sesión de ${currentUser?.name}?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            try {
              await AuthManager.logout();
              setCurrentUser(null);
              setIsLoggedIn(false);
              setReady(false); // Reset app state
            } catch (error) {
              console.error('Error cerrando sesión:', error);
            }
          }
        }
      ]
    );
  }, [currentUser]);

  const refresh = useCallback(async (limit = 50, offset = 0, searchQuery = '') => {
    try {
      const rows = await listProducts(limit, offset, searchQuery);
      if (offset === 0) {
        setProducts(rows);
        setHasMoreProducts(rows.length === limit);
      } else {
        setProducts(prev => [...prev, ...rows]);
        setHasMoreProducts(rows.length === limit);
      }
    } catch {
      Alert.alert('Error', 'No se pudo cargar el listado');
    }
  }, []);

  const loadMoreProducts = useCallback(async () => {
    if (!hasMoreProducts || loadingMore) return;
    
    setLoadingMore(true);
    try {
      await refresh(50, products.length, search);
    } finally {
      setLoadingMore(false);
    }
  }, [refresh, products.length, search, hasMoreProducts, loadingMore]);

  useEffect(() => {
    // Solo inicializar si está logueado
    if (!isLoggedIn) return;

    // Función para inicializar la aplicación - La separamos para mejor manejo de errores
    const initializeApp = async () => {
      let initTimeout = null;
      try {
        console.log('🚀 Iniciando la aplicación...');
        
        // Establecer un timeout para mostrar error si initDB tarda demasiado
        initTimeout = setTimeout(() => {
          Alert.alert(
            'Inicialización lenta',
            'La base de datos está tardando en inicializarse. ¿Desea continuar esperando?',
            [
              { text: 'Esperar', style: 'default' },
              { text: 'Cancelar', style: 'cancel', onPress: () => {
                setInitError('Inicialización cancelada por el usuario');
              }}
            ]
          );
        }, 10000); // 10 segundos
        
        // Inicializar la base de datos
        await initDB();
        
        // NO cargar productos inmediatamente - se cargarán cuando sea necesario
        // await refresh();
        
        // Todo se completó correctamente, actualizar estado
        setReady(true);
        
        // Sincronización en segundo plano
        setTimeout(() => {
          InteractionManager.runAfterInteractions(async () => {
            try { 
              await syncNow(); 
              await refresh(); 
              initRealtimeSync();
            } catch (e) {
              console.warn('Error en sincronización inicial:', e);
            }
          });
        }, 1000);
      } catch (e) {
        console.error('Error al inicializar DB:', e);
        setInitError('Fallo al inicializar: ' + (e.message || String(e)));
      } finally {
        // Aseguramos que el timeout se limpia
        if (initTimeout) {
          clearTimeout(initTimeout);
        }
      }
    };
    
    // Iniciar el proceso de inicialización
    initializeApp();

    // Auto-sync cada 5 minutos (opcional)
    const syncInterval = setInterval(async () => {
      if (!ready) return; // No sincronizar si aún no está listo
      try { 
        await syncNow(); 
        await refresh(); 
      } catch (e) {
        console.warn('Error en sincronización automática:', e);
      }
    }, 5 * 60 * 1000);
    
    return () => clearInterval(syncInterval);
  }, [refresh, isLoggedIn]);

  // Cargar productos solo cuando se accede a la pestaña de inventario
  useEffect(() => {
    if (ready && tab === 'inventory' && products.length === 0 && !search.trim()) {
      refresh();
    }
  }, [tab, ready, refresh, products.length, search]);

  // Búsqueda con debounce para evitar consultas excesivas
  useEffect(() => {
    if (tab !== 'inventory' || !ready) return;
    
    const timeoutId = setTimeout(() => {
      refresh(50, 0, search);
    }, 300); // Esperar 300ms después de que el usuario termine de escribir

    return () => clearTimeout(timeoutId);
  }, [search, tab, ready, refresh]);

  // Ya no necesitamos filtrado en memoria - se hace en la base de datos
  const filtered = products;

  const onCreate = useCallback(() => {
    setSaleRequestedBarcode(null);
    setEditing(null);
    setOpenForm(true);
  }, []);
  const onEdit = useCallback((item) => {
    const mapped = {
      barcode: item.barcode,
      name: item.name || '',
      category: item.category || '',
      purchasePrice: String(item.purchase_price ?? ''),
      salePrice: String(item.sale_price ?? ''),
      expiryDate: item.expiry_date || '',
      stock: String(item.stock ?? ''),
      imageUri: item.image_uri || null,
    };
    setSaleRequestedBarcode(null);
    setEditing(mapped);
    setOpenForm(true);
  }, []);
  const onDelete = useCallback((item) => {
    Alert.alert('Confirmar', `¿Eliminar producto ${item.barcode}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try { await deleteProductByBarcode(item.barcode); await refresh(); }
          catch { Alert.alert('Error', 'No se pudo eliminar'); }
        }
      }
    ]);
  }, [refresh]);

  const manualSync = useCallback(async () => {
    setIsSyncLoading(true);
    try {
      console.log('🔄 Iniciando sincronización manual...');
      await syncNow();
      await refresh();

      console.log('🔄 Sincronización completada, refrescando reportes...');

      // Forzar refresco de reportes incrementando timestamp
      setLastSyncTime(Date.now());

      Alert.alert('Sync', 'Sincronización completa.');
    } catch (e) {
      console.error('❌ Error en sincronización manual:', e);
      Alert.alert('Sync', `Error sincronizando: ${e.message || 'Revisa internet/clave y vuelve a intentar.'}`);
    } finally {
      setIsSyncLoading(false);
    }
  }, [refresh]);

  const handleOpenNewProductFromSale = useCallback((barcode) => {
    setSaleRequestedBarcode(String(barcode));
    setEditing({ barcode: String(barcode) });
    setOpenForm(true);
  }, []);

  const consumeRecentProduct = useCallback(() => {
    setRecentlyCreatedBarcode(null);
    setSaleRequestedBarcode(null);
  }, []);

  // Importante: Definimos todos los hooks primero
  const renderProduct = useCallback(({ item }) => {
    return (
      <View style={[styles.card, isCompact && styles.cardCompact]}>
        {item.image_uri ? (
          <Image
            source={{ uri: item.image_uri }}
            style={[styles.cardImage, isCompact && styles.cardImageCompact]}
            resizeMode="cover"
          />
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>{item.name || '(Sin nombre)'}</Text>
          <Text style={styles.cardLine}>{item.category || 'Sin categoría'}</Text>
          <Text style={styles.cardLine}>Código: {item.barcode}</Text>
          <Text style={styles.cardLine}>Compra: ${item.purchase_price ?? 0} · Venta: ${item.sale_price ?? 0}</Text>
          <Text style={styles.cardLine}>Vence: {item.expiry_date || '—'} · Stock: {item.stock ?? 0}</Text>
        </View>
        <View style={[styles.cardActions, isCompact && styles.cardActionsCompact]}>
          <TouchableOpacity style={styles.smallBtn} onPress={() => onEdit(item)}><Text style={styles.smallBtnTxt}>Editar</Text></TouchableOpacity>
          <TouchableOpacity style={[styles.smallBtn, { backgroundColor: '#fde7ea', borderColor: '#f4b4bf' }]} onPress={() => onDelete(item)}><Text style={[styles.smallBtnTxt, { color: '#b00020' }]}>Eliminar</Text></TouchableOpacity>
        </View>
      </View>
    );
  }, [isCompact, onDelete, onEdit]);

  // Después de definir todos los hooks, podemos usar renderizados condicionales
  
  // Si está verificando autenticación, mostrar loading
  if (isCheckingAuth) {
    return (
      <SafeAreaView style={styles.center}>
        <Text>Verificando sesión...</Text>
      </SafeAreaView>
    );
  }

  // Si no está logueado, mostrar pantalla de login
  if (!isLoggedIn) {
    return <LoginScreen onLoginSuccess={handleLoginSuccess} />;
  }

  if (!ready) {
    return (
      <SafeAreaView style={styles.center}>
        {initError ? (
          <View style={{ alignItems: 'center', padding: 20 }}>
            <Text style={{ color: '#b00020', marginBottom: 16, textAlign: 'center' }}>
              Error: {initError}
            </Text>
            <TouchableOpacity 
              style={{
                backgroundColor: '#007BFF', 
                paddingVertical: 12, 
                paddingHorizontal: 24, 
                borderRadius: 8
              }}
              onPress={() => {
                setInitError(null);
                // Reintentar inicialización
                (async () => {
                  try {
                    await initDB();
                    await refresh();
                    setReady(true);
                  } catch (e) {
                    setInitError('Error al reintentar: ' + (e.message || String(e)));
                  }
                })();
              }}
            >
              <Text style={{ color: '#fff', fontWeight: 'bold' }}>Reintentar</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <Text>Inicializando base de datos...</Text>
        )}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.bg }]}>
      <Header
        title="OlivoMarket"
        subtitle={tab === 'sales' ? 'Caja y ventas' : tab === 'inventory' ? 'Inventario y productos' : 'Reportes y tendencias'}
        currentUser={currentUser}
        onLogout={handleLogout}
      />
      <TopTabs
        tabs={[{ key: 'sales', label: 'Ventas' }, { key: 'inventory', label: 'Inventario' }, { key: 'reports', label: 'Reportes' }]}
        current={tab}
        onChange={setTab}
      />

      {tab === 'inventory' && (
        <View style={[styles.content, isCompact && { paddingHorizontal: 12 }] }>
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
            <TouchableOpacity 
              style={[styles.secondaryBtn, { borderColor: '#111' }]} 
              onPress={manualSync}
              disabled={isSyncLoading}
            >
              <Text style={[styles.secondaryBtnText, { fontWeight: '800' }]}>
                {isSyncLoading ? '⏳ Sincronizando...' : '🔄 Sync'}
              </Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.caption}>
            {search ? `Búsqueda: "${search}" - ${filtered.length} resultado(s)` : `Productos cargados: ${products.length}`}
          </Text>

          <FlatList
            data={filtered}
            keyExtractor={(item) => String(item.id)}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ paddingBottom: 120 }}
            renderItem={renderProduct}
            ListEmptyComponent={<Text style={styles.emptyText}>{search ? 'Sin resultados para tu búsqueda' : 'No hay productos'}</Text>}
            ListFooterComponent={() => (
              hasMoreProducts && !search ? (
                <TouchableOpacity 
                  style={styles.loadMoreBtn} 
                  onPress={loadMoreProducts}
                  disabled={loadingMore}
                >
                  <Text style={styles.loadMoreText}>
                    {loadingMore ? '⏳ Cargando...' : '📄 Cargar más productos'}
                  </Text>
                </TouchableOpacity>
              ) : null
            )}
            initialNumToRender={10}
            maxToRenderPerBatch={10}
            windowSize={6}
            removeClippedSubviews
          />

          <FAB
            items={[
              { icon: '📷', label: 'Escanear', onPress: () => setOpenQuickScan(true) },
              { icon: '➕', label: 'Nuevo', onPress: onCreate },
            ]}
          />
        </View>
      )}

      {tab === 'sales' && (
        <View style={[styles.content, isCompact && { paddingHorizontal: 12 }] }>
          <SellScreen
            onClose={() => {}}
            onSold={async ()=>{ await refresh(); try{ await syncNow(); } catch{} }}
            onRequestCreateProduct={handleOpenNewProductFromSale}
            pendingBarcode={saleRequestedBarcode}
            recentlyCreatedBarcode={recentlyCreatedBarcode}
            onConsumeRecentBarcode={consumeRecentProduct}
            currentUser={currentUser}
          />
          
          <FAB
            items={[
              { icon: '💰', label: 'Caja', onPress: () => setOpenCash(true) },
            ]}
          />
        </View>
      )}

      {tab === 'reports' && (
        <View style={styles.content}>
          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.secondaryBtn, { borderColor: '#111' }]}
              onPress={manualSync}
              disabled={isSyncLoading}
            >
              <Text style={[styles.secondaryBtnText, { fontWeight: '800' }]}>
                {isSyncLoading ? '⏳ Sincronizando...' : '🔄 Sync'}
              </Text>
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
            <TouchableOpacity style={styles.reportCard} onPress={() => setOpenCashHistory(true)}>
              <Text style={styles.reportEmoji}>💰</Text>
              <Text style={styles.reportTitle}>Historial de Caja</Text>
              <Text style={styles.reportDesc}>Transacciones, apertura, cierre y movimientos de efectivo.</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Modales */}
      <Modal visible={openForm} animationType="slide" onRequestClose={() => { setOpenForm(false); setSaleRequestedBarcode(null); }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <Header title="Producto" subtitle={editing ? 'Editar' : 'Crear nuevo'} compact />
          <ProductForm
            initial={editing}
            onSaved={async (barcode) => {
              setOpenForm(false);
              await refresh();
              setRecentlyCreatedBarcode(barcode || null);
            }}
            onCancel={() => { setOpenForm(false); setSaleRequestedBarcode(null); }}
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
          <SalesHistoryScreen 
            onClose={() => setOpenHistory(false)} 
            refreshKey={lastSyncTime}
          />
        </SafeAreaView>
      </Modal>

      <Modal visible={openDashboard} animationType="slide" onRequestClose={() => setOpenDashboard(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <Header title="Reportes" subtitle="Dashboard" compact />
          <SalesDashboardScreen 
            onClose={() => setOpenDashboard(false)} 
            refreshKey={lastSyncTime}
          />
        </SafeAreaView>
      </Modal>

      {/* Cash History Modal */}
      <Modal visible={openCashHistory} animationType="slide" onRequestClose={() => setOpenCashHistory(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
          <CashHistoryScreen 
            onBack={() => setOpenCashHistory(false)}
          />
        </SafeAreaView>
      </Modal>

      {/* Cash Management Modal */}
      <Modal visible={openCash} animationType="slide" presentationStyle="pageSheet">
        <CashManagementScreen 
          currentUser={currentUser}
          onClose={() => setOpenCash(false)}
        />
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
  cardCompact: { flexDirection: 'column', alignItems: 'stretch' },
  cardImage: { width: 72, height: 72, borderRadius: 12, backgroundColor: '#f5f5f5' },
  cardImageCompact: { width: '100%', height: 160, borderRadius: 14, marginBottom: 8 },
  cardTitle: { fontWeight: '700', fontSize: 16, marginBottom: 2 },
  cardLine: { color: '#555' },
  cardActions: { gap: 6, flexDirection: 'column', alignItems: 'flex-end' },
  cardActionsCompact: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 },
  smallBtn: { borderWidth: 1, borderColor: '#d8e7ff', backgroundColor: '#eef6ff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center' },
  smallBtnTxt: { color: '#0b5', fontWeight: '700' },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 24 },

  loadMoreBtn: {
    backgroundColor: '#f8f9fa',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 12,
    padding: 16,
    marginTop: 16,
    alignItems: 'center',
  },
  loadMoreText: {
    color: '#6c757d',
    fontWeight: '600',
  },

  reportGrid: { flexDirection: 'column', gap: 12, marginTop: 12 },
  reportCard: {
    backgroundColor: '#fff', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#eee',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 1
  },
  reportEmoji: { fontSize: 28, marginBottom: 6 },
  reportTitle: { fontSize: 16, fontWeight: '700' },
  reportDesc: { color: '#666', marginTop: 4 },
});
