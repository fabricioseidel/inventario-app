import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, FlatList, Button, StyleSheet, Alert, Modal } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { initDB, listProducts, deleteProductByBarcode } from './src/db';
import { Camera } from 'expo-camera';
import ProductForm from './src/screens/ProductForm';
import { exportCSVFile, exportJSONFile } from './src/export';

export default function App() {
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [openForm, setOpenForm] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        // Pre-solicitamos permiso de cámara si las funciones existen en esta versión
        try {
          if (Camera?.getCameraPermissionsAsync && Camera?.requestCameraPermissionsAsync) {
            const perm = await Camera.getCameraPermissionsAsync();
            if (!perm.granted) {
              await Camera.requestCameraPermissionsAsync();
            }
          } else {
            console.log('API de permisos de cámara no disponible, se delega al componente Scanner.');
          }
        } catch (permErr) {
          console.log('No se pudo pre-solicitar permiso de cámara:', permErr?.message || permErr);
        }

        await initDB();
        await refresh();
        setReady(true);
      } catch (e) {
        console.log('Error inicializando DB:', e);
        Alert.alert('Error', 'Error inicializando la base de datos: ' + e.message);
      }
    })();
  }, []);

  const refresh = async () => {
    try {
      const rows = await listProducts();
      setProducts(rows);
    } catch (e) {
      console.log('Error cargando productos:', e);
    }
  };

  const onCreate = () => {
    setEditing(null);
    setOpenForm(true);
  };

  const onEdit = (item) => {
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
      { 
        text: 'Eliminar', 
        style: 'destructive', 
        onPress: async () => {
          try {
            await deleteProductByBarcode(item.barcode);
            await refresh();
          } catch (e) {
            Alert.alert('Error', 'No se pudo eliminar: ' + e.message);
          }
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
        <StatusBar style="auto" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>📦 Inventario</Text>

      <View style={styles.buttonContainer}>
        <Button title="➕ Nuevo Producto" onPress={onCreate} />
        <Button title="📊 Exportar CSV" onPress={exportCSVFile} />
        <Button title="📋 Exportar JSON" onPress={exportJSONFile} />
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
            <View style={styles.buttonRow}>
              <Button title="✏️ Editar" onPress={() => onEdit(item)} />
              <Button title="🗑️ Eliminar" onPress={() => onDelete(item)} color="#dc3545" />
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Text>No hay productos. ¡Agrega uno!</Text>
          </View>
        }
      />

      <Modal visible={openForm} animationType="slide" onRequestClose={() => setOpenForm(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <ProductForm
            initial={editing}
            onSaved={onSaved}
            onCancel={() => setOpenForm(false)}
          />
        </SafeAreaView>
      </Modal>

      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 16,
  },
  buttonContainer: {
    gap: 8,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 12,
  },
  card: {
    backgroundColor: '#f8f9fa',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e9ecef',
  },
  cardTitle: {
    fontWeight: 'bold',
    fontSize: 16,
    marginBottom: 4,
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 8,
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
});
