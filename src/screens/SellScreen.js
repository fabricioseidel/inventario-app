// src/screens/SellScreen.js
import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Button, FlatList, Alert, StyleSheet, Modal, SafeAreaView, TouchableOpacity } from 'react-native';
import ScannerScreen from './ScannerScreen';
import { getProductByBarcode, recordSale } from '../db';

const PMETHODS = ['efectivo', 'debito', 'credito', 'transferencia'];

export default function SellScreen({ onClose, onSold }) {
  const [scanOpen, setScanOpen] = useState(false);
  const [code, setCode] = useState('');
  const [cart, setCart] = useState([]);
  const [paymentMethod, setPaymentMethod] = useState('efectivo');
  const [cashReceived, setCashReceived] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const total = useMemo(
    () => cart.reduce((acc, i) => acc + (Number(i.unitPrice) * Number(i.qty)), 0),
    [cart]
  );
  const change = useMemo(() => Math.max(0, Number(cashReceived || 0) - total), [cashReceived, total]);

  const addOrInc = (p) => {
    setCart(prev => {
      const idx = prev.findIndex(x => x.barcode === p.barcode);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = { ...copy[idx], qty: Number(copy[idx].qty) + 1 };
        return copy;
      }
      return [...prev, {
        barcode: p.barcode,
        name: p.name || p.category || '(Sin nombre)',
        unitPrice: Number(p.sale_price || p.salePrice || 0),
        qty: 1,
        stock: Number(p.stock ?? 0)
      }];
    });
  };

  const dec = (barcode) => {
    setCart(prev => {
      const idx = prev.findIndex(x => x.barcode === barcode);
      if (idx < 0) return prev;
      const item = prev[idx];
      if (item.qty <= 1) return prev.filter(x => x.barcode !== barcode);
      const copy = [...prev];
      copy[idx] = { ...item, qty: item.qty - 1 };
      return copy;
    });
  };

  const removeItem = (barcode) => setCart(prev => prev.filter(x => x.barcode !== barcode));

  const addByBarcode = async (barcode) => {
    const clean = String(barcode || code).trim();
    if (!clean) return;
    try {
      const found = await getProductByBarcode(clean);
      if (!found) {
        Alert.alert('No encontrado', `El código ${clean} no existe en productos.`);
        return;
      }
      addOrInc(found);
      setCode('');
    } catch {
      Alert.alert('Error', 'No se pudo buscar el producto.');
    }
  };

  const finalizeSale = async () => {
    if (cart.length === 0) return Alert.alert('Atención', 'El carrito está vacío.');

    const over = cart.filter(i => typeof i.stock === 'number' && i.stock < i.qty);
    if (over.length) {
      const list = over.map(i => `${i.name} (stock ${i.stock}, qty ${i.qty})`).join('\n');
      const cont = await new Promise((resolve) => {
        Alert.alert(
          'Stock insuficiente',
          `Los siguientes ítems superan el stock:\n\n${list}\n\n¿Deseas continuar igual? (se evita stock negativo)`,
          [
            { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
            { text: 'Continuar', style: 'destructive', onPress: () => resolve(true) },
          ]
        );
      });
      if (!cont) return;
    }

    if (paymentMethod === 'efectivo' && Number(cashReceived || 0) < total) {
      return Alert.alert('Atención', 'El monto recibido es menor al total.');
    }

    const payload = {
      items: cart.map(i => ({ barcode: i.barcode, name: i.name, qty: Number(i.qty), unitPrice: Number(i.unitPrice) })),
      paymentMethod,
      cashReceived: Number(cashReceived || 0),
      notes
    };

    try {
      setSaving(true);
      await recordSale(payload);
      Alert.alert('Venta registrada', 'La venta se guardó correctamente.');
      setCart([]);
      setPaymentMethod('efectivo');
      setCashReceived('');
      setNotes('');
      onSold && onSold();
      onClose && onClose(true);
    } catch (e) {
      console.warn('recordSale error', e);
      Alert.alert('Error', 'No se pudo registrar la venta.');
    } finally {
      setSaving(false);
    }
  };

  const renderItem = ({ item }) => (
    <View style={styles.line}>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight:'700' }}>{item.name}</Text>
        <Text style={{ color:'#555' }}>{item.barcode} · ${item.unitPrice} × {item.qty} = ${item.unitPrice * item.qty}</Text>
      </View>
      <View style={{ flexDirection:'row', gap:6 }}>
        <TouchableOpacity style={styles.btnMini} onPress={() => dec(item.barcode)}><Text>-</Text></TouchableOpacity>
        <TouchableOpacity style={styles.btnMini} onPress={() => addOrInc(item)}><Text>+</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btnMini, { backgroundColor:'#fce'}]} onPress={() => removeItem(item.barcode)}><Text>✕</Text></TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:'#fff' }}>
      <View style={{ padding:16 }}>
        <Text style={styles.title}>Caja / Ventas</Text>

        <View style={{ flexDirection:'row', gap:8, marginBottom:12 }}>
          <Button title="📷 Escanear" onPress={() => setScanOpen(true)} />
        </View>

        <View style={{ flexDirection:'row', gap:8, marginBottom:12, alignItems:'center' }}>
          <TextInput
            placeholder="Código de barras"
            style={[styles.input, { flex:1 }]}
            keyboardType="default"
            autoCapitalize="none"
            value={code}
            onChangeText={setCode}
            onSubmitEditing={() => addByBarcode()}
          />
          <Button title="Añadir" onPress={() => addByBarcode()} />
        </View>

        <FlatList
          data={cart}
          keyExtractor={(it) => it.barcode}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={{ color:'#888' }}>Carrito vacío</Text>}
          style={{ flex:1, marginBottom:12 }}
        />

        <View style={styles.box}>
          <Text style={styles.total}>Total: ${total.toFixed(0)}</Text>

          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:8, marginVertical:8 }}>
            {PMETHODS.map(m => (
              <TouchableOpacity
                key={m}
                onPress={() => setPaymentMethod(m)}
                style={[styles.pill, paymentMethod === m && styles.pillActive]}
              >
                <Text style={{ color: paymentMethod === m ? '#fff' : '#333' }}>{m}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {paymentMethod === 'efectivo' && (
            <View style={{ flexDirection:'row', alignItems:'center', gap:8 }}>
              <Text>Monto recibido:</Text>
              <TextInput
                style={[styles.input, { flex:0, width:120 }]}
                keyboardType="numeric"
                value={cashReceived}
                onChangeText={setCashReceived}
                placeholder="0"
              />
              <Text>Vuelto: ${change.toFixed(0)}</Text>
            </View>
          )}

          <TextInput
            style={[styles.input, { marginTop:8 }]}
            placeholder="Notas (opcional)"
            value={notes}
            onChangeText={setNotes}
          />

          <View style={{ height:8 }} />
          <Button title={saving ? 'Guardando…' : 'Pagar y registrar'} onPress={finalizeSale} disabled={saving} />
          <View style={{ height:8 }} />
          <Button title="Cerrar" color="#666" onPress={() => onClose && onClose(false)} />
        </View>

        <Modal visible={scanOpen} animationType="fade" onRequestClose={() => setScanOpen(false)}>
          <ScannerScreen onClose={() => setScanOpen(false)} onScanned={(code) => { setScanOpen(false); addByBarcode(code); }} />
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  input: { borderWidth: 1, borderColor: '#ddd', borderRadius: 6, padding: 8, backgroundColor: '#fff', marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center' },
  line: { flexDirection:'row', alignItems:'center', paddingVertical: 8, borderBottomWidth:1, borderColor:'#eee' },
  btnMini: { borderWidth:1, borderColor:'#ddd', borderRadius:6, paddingHorizontal:10, paddingVertical:6, backgroundColor:'#f8f8f8' },
  box: { borderWidth:1, borderColor:'#eee', borderRadius:12, padding:12, backgroundColor:'#fafafa' },
  pill: { borderWidth:1, borderColor:'#ccc', borderRadius:999, paddingHorizontal:12, paddingVertical:6, backgroundColor:'#fff' },
  pillActive: { backgroundColor:'#111', borderColor:'#111' },
  total: { fontWeight:'800', fontSize:16 }
});