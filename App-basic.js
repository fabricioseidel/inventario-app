import React, { useState } from 'react';
import { 
  SafeAreaView, 
  View, 
  Text, 
  TouchableOpacity, 
  TextInput, 
  StyleSheet, 
  Alert, 
  ScrollView,
  AsyncStorage 
} from 'react-native';

export default function App() {
  const [screen, setScreen] = useState('home');
  const [barcode, setBarcode] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [products, setProducts] = useState([]);
  const [editingId, setEditingId] = useState(null);

  // Simular base de datos con AsyncStorage
  const saveProduct = async () => {
    if (!barcode || !name) {
      Alert.alert('Error', 'Código y nombre son requeridos');
      return;
    }

    try {
      const existingProducts = await getStoredProducts();
      const newProduct = {
        id: editingId || Date.now().toString(),
        barcode,
        name,
        description,
        price,
        created: new Date().toLocaleDateString()
      };

      let updatedProducts;
      if (editingId) {
        updatedProducts = existingProducts.map(p => 
          p.id === editingId ? newProduct : p
        );
      } else {
        updatedProducts = [...existingProducts, newProduct];
      }

      await AsyncStorage.setItem('products', JSON.stringify(updatedProducts));
      Alert.alert('Éxito', `Producto ${editingId ? 'actualizado' : 'creado'}`);
      resetForm();
      setScreen('home');
    } catch (error) {
      Alert.alert('Error', 'No se pudo guardar el producto');
    }
  };

  const getStoredProducts = async () => {
    try {
      const stored = await AsyncStorage.getItem('products');
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  };

  const loadProducts = async () => {
    const stored = await getStoredProducts();
    setProducts(stored);
    setScreen('list');
  };

  const editProduct = (product) => {
    setEditingId(product.id);
    setBarcode(product.barcode);
    setName(product.name);
    setDescription(product.description);
    setPrice(product.price);
    setScreen('form');
  };

  const deleteProduct = async (id) => {
    Alert.alert(
      'Confirmar',
      '¿Eliminar este producto?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Eliminar',
          onPress: async () => {
            const existing = await getStoredProducts();
            const filtered = existing.filter(p => p.id !== id);
            await AsyncStorage.setItem('products', JSON.stringify(filtered));
            loadProducts();
          }
        }
      ]
    );
  };

  const exportCSV = async () => {
    const stored = await getStoredProducts();
    if (stored.length === 0) {
      Alert.alert('Sin datos', 'No hay productos para exportar');
      return;
    }

    let csv = 'Código,Nombre,Descripción,Precio,Fecha\n';
    stored.forEach(item => {
      csv += `"${item.barcode}","${item.name}","${item.description || ''}","${item.price || ''}","${item.created}"\n`;
    });

    Alert.alert(
      'CSV Generado',
      csv,
      [
        { text: 'Cerrar', style: 'cancel' },
        {
          text: 'Copiar',
          onPress: () => {
            // En un dispositivo real, aquí podrías usar Clipboard
            Alert.alert('Info', 'Copia manualmente el texto CSV mostrado');
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setBarcode('');
    setName('');
    setDescription('');
    setPrice('');
    setEditingId(null);
  };

  const searchProduct = async () => {
    if (!barcode) {
      Alert.alert('Error', 'Ingresa un código de barras');
      return;
    }

    const existing = await getStoredProducts();
    const found = existing.find(p => p.barcode === barcode);
    
    if (found) {
      Alert.alert(
        'Producto encontrado',
        `${found.name}\n¿Deseas editarlo?`,
        [
          { text: 'No', style: 'cancel' },
          { text: 'Editar', onPress: () => editProduct(found) }
        ]
      );
    } else {
      Alert.alert('Nuevo producto', 'Este código no existe. Puedes crear uno nuevo.');
      setScreen('form');
    }
  };

  // Pantalla de formulario
  if (screen === 'form') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>
          {editingId ? 'Editar Producto' : 'Nuevo Producto'}
        </Text>

        <TextInput
          style={styles.input}
          placeholder="Código de barras"
          value={barcode}
          onChangeText={setBarcode}
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="Nombre del producto"
          value={name}
          onChangeText={setName}
        />

        <TextInput
          style={styles.input}
          placeholder="Descripción (opcional)"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />

        <TextInput
          style={styles.input}
          placeholder="Precio (opcional)"
          value={price}
          onChangeText={setPrice}
          keyboardType="numeric"
        />

        <View style={styles.buttonRow}>
          <TouchableOpacity style={styles.button} onPress={saveProduct}>
            <Text style={styles.buttonText}>Guardar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.cancelButton]} 
            onPress={() => { resetForm(); setScreen('home'); }}
          >
            <Text style={styles.buttonText}>Cancelar</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // Pantalla de lista
  if (screen === 'list') {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.title}>Productos ({products.length})</Text>
        
        <ScrollView style={{ flex: 1 }}>
          {products.map(product => (
            <View key={product.id} style={styles.productCard}>
              <Text style={styles.productName}>{product.name}</Text>
              <Text style={styles.productDetail}>Código: {product.barcode}</Text>
              <Text style={styles.productDetail}>{product.description}</Text>
              <Text style={styles.productDetail}>Precio: {product.price}</Text>
              <Text style={styles.productDetail}>Creado: {product.created}</Text>
              
              <View style={styles.buttonRow}>
                <TouchableOpacity 
                  style={[styles.smallButton, styles.editButton]} 
                  onPress={() => editProduct(product)}
                >
                  <Text style={styles.buttonText}>Editar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity 
                  style={[styles.smallButton, styles.deleteButton]} 
                  onPress={() => deleteProduct(product.id)}
                >
                  <Text style={styles.buttonText}>Eliminar</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))}
        </ScrollView>

        <TouchableOpacity 
          style={styles.button} 
          onPress={() => setScreen('home')}
        >
          <Text style={styles.buttonText}>Volver</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  // Pantalla principal
  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>📱 Inventory Simple</Text>
      <Text style={styles.subtitle}>Gestión básica de productos</Text>

      <View style={styles.searchSection}>
        <TextInput
          style={styles.input}
          placeholder="Ingresa código de barras"
          value={barcode}
          onChangeText={setBarcode}
          autoCapitalize="none"
        />
        
        <TouchableOpacity style={styles.button} onPress={searchProduct}>
          <Text style={styles.buttonText}>Buscar / Crear</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.buttonSection}>
        <TouchableOpacity 
          style={styles.button} 
          onPress={() => { resetForm(); setScreen('form'); }}
        >
          <Text style={styles.buttonText}>➕ Nuevo Producto</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={loadProducts}>
          <Text style={styles.buttonText}>📋 Ver Productos</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={exportCSV}>
          <Text style={styles.buttonText}>📊 Exportar CSV</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.helpText}>
        💡 Consejos:{'\n'}
        • Escribe el código de barras manualmente{'\n'}
        • Usa "Buscar" para encontrar productos existentes{'\n'}
        • El CSV se puede copiar a Excel{'\n'}
        • Los datos se guardan en tu dispositivo
      </Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 30,
    color: '#666',
  },
  searchSection: {
    marginBottom: 30,
  },
  buttonSection: {
    gap: 15,
    marginBottom: 20,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    backgroundColor: '#FF3B30',
  },
  editButton: {
    backgroundColor: '#FF9500',
  },
  deleteButton: {
    backgroundColor: '#FF3B30',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  smallButton: {
    flex: 1,
    padding: 10,
    borderRadius: 6,
    alignItems: 'center',
  },
  productCard: {
    backgroundColor: 'white',
    padding: 15,
    marginBottom: 10,
    borderRadius: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  productName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  productDetail: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  helpText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
});
