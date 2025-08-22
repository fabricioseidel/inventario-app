// src/screens/SellScreen.js
import React, { useState } from 'react';
import { View, Text, TextInput, Button, FlatList, Alert, StyleSheet, Modal, Platform, SafeAreaView } from 'react-native';
import ScannerScreen from './ScannerScreen';
import { getProductByBarcode, recordSale } from '../db';

export default function SellScreen({ onClose, onSold }) {
  const [scanOpen, setScanOpen] = useState(false);
  const [code, setCode] = useState('');
  const [cart, setCart] = useState([]);
  const [paying, setPaying] = useState(false);
  const [amountPaid, setAmountPaid] = useState('');

  const addByBarcode = async (barcode) => {
    const clean = String(barcode || code).trim();
    if (!clean) return;
    const prod = await getProductByBarcode(clean);
    if (!prod) {
      Alert.alert('No encontrado', `No existe producto con código ${clean}`);
      return;
    }
    setCart(prev => {
      const idx = prev.findIndex(l => l.barcode === clean);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], qty: next[idx].qty + 1 };
        return next;
      }
      return [
        ...prev,
        {
          barcode: prod.barcode,
          name: prod.name || '',
          unit_price: Number(prod.sale_price || 0),
          qty: 1
        }
      ];
    });
    setCode('');
  };

  const updateQty = (barcode, qty) => {
    const n = Math.max(0, parseInt(qty || 0, 10));
    setCart(prev => prev.map(l => l.barcode === barcode ? { ...l, qty: n } : l).filter(l => l.qty > 0));
  };

  const removeLine = (barcode) => setCart(prev => prev.filter(l => l.barcode !== barcode));

  const subtotal = cart.reduce((a, l) => a + l.qty * l.unit_price, 0);
  const discount = 0;
  const tax = 0;
  const total = Math.max(0, subtotal - discount + tax);

  const charge = async () => {
    if (!cart.length) return Alert.alert('Carrito vacío', 'Agrega al menos un producto');
    try {
      setPaying(true);
      await recordSale(cart, {
        paymentMethod: 'cash',
        amountPaid: amountPaid || total
      });
      setPaying(false);
      onSold && onSold(); // refresca stock en el parent
    } catch (e) {
      console.error('charge:', e);
      setPaying(false);
      Alert.alert('Error', 'No se pudo registrar la venta');
    }
  };

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:'#fff' }}>
      <View style={{ flex:1, padding: 16 }}>
        <Text style={styles.title}>🧾 Nueva venta</Text>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Código de barras"
            value={code}
            onChangeText={setCode}
            autoCapitalize="none"
            onSubmitEditing={() => addByBarcode()}
          />
          <View style={{ width: 8 }} />
          <Button title="➕ Agregar" onPress={() => addByBarcode()} />
          <View style={{ width: 8 }} />
          <Button title="📷" onPress={() => setScanOpen(true)} />
        </View>

        <FlatList
          data={cart}
          keyExtractor={(i) => i.barcode}
          ListEmptyComponent={<Text style={{ color:'#999' }}>Sin productos</Text>}
          renderItem={({ item }) => (
            <View style={styles.line}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight:'700' }}>{item.name || '(Sin nombre)'}</Text>
                <Text style={{ color:'#555' }}>{item.barcode}</Text>
              </View>
              <Text style={{ width: 80, textAlign:'right' }}>${item.unit_price}</Text>
              <TextInput
                style={[styles.input, { width: 60, marginLeft: 8 }]}
                value={String(item.qty)}
                keyboardType={Platform.OS === 'android' ? 'numeric' : 'number-pad'}
                onChangeText={(t)=>updateQty(item.barcode, t)}
              />
              <Button title="✖" color="#b00020" onPress={()=>removeLine(item.barcode)} />
            </View>
          )}
        />

        <View style={{ marginTop: 12 }}>
          <Text>Subtotal: ${subtotal.toFixed(0)}</Text>
          <Text>Descuento: ${discount.toFixed(0)}</Text>
          <Text>Impuesto: ${tax.toFixed(0)}</Text>
          <Text style={{ fontWeight:'700', fontSize:16 }}>TOTAL: ${total.toFixed(0)}</Text>
        </View>

        <View style={styles.row}>
          <TextInput
            style={[styles.input, { flex:1 }]}
            placeholder={`Pagó (ej. ${total.toFixed(0)})`}
            value={amountPaid}
            onChangeText={setAmountPaid}
            keyboardType={Platform.OS === 'android' ? 'numeric' : 'decimal-pad'}
          />
          <View style={{ width: 8 }} />
          <Button title={paying ? 'Procesando…' : 'Cobrar'} onPress={charge} />
        </View>

        <Button title="Cerrar" color="#555" onPress={onClose} />
      </View>

      <Modal visible={scanOpen} animationType="slide" onRequestClose={()=>setScanOpen(false)}>
        <ScannerScreen
          onClose={() => setScanOpen(false)}
          onScanned={(scanned) => { addByBarcode(scanned); setScanOpen(false); }}
        />
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 6,
    padding: 8, backgroundColor: '#fff', marginBottom: 8
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  line: {
    flexDirection:'row', alignItems:'center',
    paddingVertical: 8, borderBottomWidth:1, borderColor:'#eee'
  }
});