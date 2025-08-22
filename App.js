// App.js
import React, { useEffect, useState } from 'react';
import {
  SafeAreaView, View, Text, FlatList, Button,
  StyleSheet, Alert, Modal
} from 'react-native';
import { initDB, listProducts, deleteProductByBarcode } from './src/db';
import ProductForm from './src/screens/ProductForm';
import SellScreen from './src/screens/SellScreen';
import { exportCSVFile, exportJSONFile } from './src/export';

export default function App() {
  const [ready, setReady] = useState(false);
  const [products, setProducts] = useState([]);
  const [editing, setEditing] = useState(null);
  const [openForm, setOpenForm] = useState(false);
  const [openSell, setOpenSell] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        await initDB();
        await refresh();
        setReady(true);
      } catch (e) {
        console.error('app_boot:', e);
        Alert.alert('Error', 'Fallo al iniciar la base de datos');
      }
    })();
  }, []);

  const refresh = async () => {
    try {
      const rows = await listProducts();
      setProducts(rows);
    } catch (e) {
      console.error('products_refresh:', e);
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

  const onDelete = async (item) => {
    Alert.alert('Confirmar', `¿Eliminar producto ${item.name || item.barcode}?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar', style: 'destructive', onPress: async () => {
          try {
            await deleteProductByBarcode(item.barcode);
            await refresh();
          } catch (e) {
            console.error('product_delete:', e);
            Alert.alert('Error', 'No se pudo eliminar');
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
        <Text>Inicializando base de datos…</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeArea