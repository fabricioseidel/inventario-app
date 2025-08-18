import React, { useEffect, useState } from 'react';
import { SafeAreaView, View, Text, Button, TextInput, StyleSheet, Alert, ScrollView } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import * as SQLite from 'expo-sqlite';

const db = SQLite.openDatabase('products.db');

// Initialize database
function initDB() {
  db.transaction(tx => {
    tx.executeSql(
      `CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY NOT NULL,
        barcode TEXT UNIQUE,
        name TEXT,
        description TEXT,
        price TEXT
      );`
    );
  });
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [hasPermission, setHasPermission] = useState(null);
  const [scannedBarcode, setScannedBarcode] = useState('');
  const [product, setProduct] = useState(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [products, setProducts] = useState([]);

  useEffect(() => {
    initDB();
    (async () => {
      const { status } = await BarCodeScanner.requestPermissionsAsync();
      setHasPermission(status === 'granted');
    })();
  }, []);

  const getProduct = (barcode) => {
    return new Promise((resolve) => {
      db.transaction(tx => {
        tx.executeSql(
          'SELECT * FROM products WHERE barcode = ? LIMIT 1',
          [barcode],
          (_, { rows }) => {
            resolve(rows.length > 0 ? rows.item(0) : null);
          }
        );
      });
    });
  };

  const saveProduct = () => {
    if (!scannedBarcode || !name) {
      Alert.alert('Error', 'Código de barras y nombre son requeridos');
      return;
    }

    const isEdit = !!product;
    const query = isEdit 
      ? 'UPDATE products SET name = ?, description = ?, price = ? WHERE id = ?'
      : 'INSERT INTO products (barcode, name, description, price) VALUES (?, ?, ?, ?)';
    
    const params = isEdit 
      ? [name, description, price, product.id]
      : [scannedBarcode, name, description, price];

    db.transaction(tx => {
      tx.executeSql(query, params, () => {
        Alert.alert('Éxito', `Producto ${isEdit ? 'actualizado' : 'creado'} correctamente`);
        setScreen('home');
        resetForm();
      });
    });
  };

  const resetForm = () => {
    setScannedBarcode('');
    setProduct(null);
    setName('');
    setDescription('');
    setPrice('');
  };

  const handleBarCodeScanned = async ({ data }) => {
    setScannedBarcode(data);
    const existingProduct = await getProduct(data);
    
    if (existingProduct) {
      setProduct(existingProduct);
      setName(existingProduct.name || '');
      setDescription(existingProduct.description || '');
      setPrice(existingProduct.price || '');
      Alert.alert('Producto encontrado', 'Editando producto existente');
    } else {
      setProduct(null);
      setName('');
      setDescription('');
      setPrice('');
      Alert.alert('Nuevo producto', 'Crear nuevo producto');
    }
    
    setScreen('form');
  };

  const loadProducts = () => {
    db.transaction(tx => {
      tx.executeSql('SELECT * FROM products ORDER BY name', [], (_, { rows }) => {
        const items = [];
        for (let i = 0; i < rows.length; i++) items.push(rows.item(i));
        setProducts(items);
        setScreen('list');
      });
    });
  };

  const exportCSV = () => {
    db.transaction(tx => {
      tx.executeSql('SELECT * FROM products ORDER BY name', [], (_, { rows }) => {
        const items = [];
        for (let i = 0; i < rows.length; i++) items.push(rows.item(i));
        
        let csv = 'Código,Nombre,Descripción,Precio\n';
        items.forEach(item => {
          csv += `"${item.barcode}","${item.name}","${item.description || ''}","${item.price || ''}"\n`;
        });
        
        Alert.alert('Export CSV', csv);
      });
    });
  };

  if (screen === 'scanner') {
    if (hasPermission === null) {
      return <View style={styles.center}><Text>Solicitando permiso de cámara...</Text></View>;
    }
    if (hasPermission === false) {
      return <View style={styles.center}><Text>Sin permiso para usar la cámara</Text></View>;
    }

    return (
      <View style={{ flex: 1 }}>
        <BarCodeScanner onBarCodeScanned={handleBarCodeScanned} style={StyleSheet.absoluteFillObject} />
        <View style={styles.scannerOverlay}>
          <Text style={styles.scannerText}>Apunta al código de barras</Text>
          <Button title="Cancelar" onPress={() => setScreen('home')} />
        </View>
      </View>
    );
  }

  if (screen === 'form') {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>{product ? 'Editar Producto' : 'Nuevo Producto'}</Text>
        <Text>Código: {scannedBarcode}</Text>
        
        <TextInput
          style={styles.input}
          placeholder="Nombre del producto"
          value={name}
          onChangeText={setName}
        />
        
        <TextInput
          style={styles.input}
          placeholder="Descripción"
          value={description}
          onChangeText={setDescription}
          multiline
        />
        
        <TextInput
          style={styles.input}
          placeholder="Precio"
          value={price}
          onChangeText={setPrice}
        />
        
        <Button title="Guardar" onPress={saveProduct} />
        <Button title="Cancelar" onPress={() => { setScreen('home'); resetForm(); }} />
      </ScrollView>
    );
  }

  if (screen === 'list') {
    return (
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Productos ({products.length})</Text>
        {products.map(item => (
          <View key={item.id} style={styles.productCard}>
            <Text style={styles.productName}>{item.name}</Text>
            <Text>Código: {item.barcode}</Text>
            <Text>{item.description}</Text>
            <Text>Precio: {item.price}</Text>
          </View>
        ))}
        <Button title="Volver" onPress={() => setScreen('home')} />
      </ScrollView>
    );
  }

  // Home screen
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Barcode Inventory</Text>
      
      <View style={styles.buttonContainer}>
        <Button title="Escanear Código" onPress={() => setScreen('scanner')} />
        <Button title="Ver Productos" onPress={loadProducts} />
        <Button title="Exportar CSV" onPress={exportCSV} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
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
    marginVertical: 20,
  },
  buttonContainer: {
    gap: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    padding: 10,
    marginVertical: 5,
    borderRadius: 5,
  },
  scannerOverlay: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.7)',
    padding: 20,
  },
  scannerText: {
    color: 'white',
    fontSize: 16,
    marginBottom: 10,
  },
  productCard: {
    backgroundColor: '#f5f5f5',
    padding: 15,
    marginVertical: 5,
    borderRadius: 8,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
  },
});
