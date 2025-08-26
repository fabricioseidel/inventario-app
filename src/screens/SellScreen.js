// src/screens/SellScreen.js
import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, Platform, KeyboardAvoidingView } from 'react-native';
import ScannerScreen from './ScannerScreen';
import { getProductByBarcode, recordSale } from '../db';
import { theme } from '../ui/Theme';

const PMETHODS = ['efectivo', 'debito', 'credito', 'transferencia'];

export default function SellScreen({ onClose, onSold }) {
  const [scannerOpen, setScannerOpen] = useState(false);
  const [barcodeManual, setBarcodeManual] = useState('');
  const [cart, setCart] = useState([]); // {barcode,name,unit_price,qty}
  const [method, setMethod] = useState('efectivo');
  const [amountPaid, setAmountPaid] = useState('');

  const total = useMemo(() => cart.reduce((a, it) => a + (Number(it.qty || 0) * Number(it.unit_price || 0)), 0), [cart]);
  const change = Math.max(0, Number(amountPaid || 0) - total);
  const canPay = total > 0 && (method !== 'efectivo' || Number(amountPaid || 0) >= total);

  const addOrInc = (p) => {
    setCart(prev => {
      const i = prev.findIndex(x => x.barcode === p.barcode);
      if (i >= 0) {
        const next = [...prev];
        next[i] = { ...next[i], qty: Number(next[i].qty || 0) + 1, unit_price: p.sale_price ?? next[i].unit_price };
        return next;
      }
      return [...prev, { barcode: p.barcode, name: p.name || '', unit_price: Number(p.sale_price || 0), qty: 1 }];
    });
  };

  const scanDone = async (code) => {
    setScannerOpen(false);
    const p = await getProductByBarcode(String(code).trim());
    if (!p) return Alert.alert('No encontrado', 'Ese código no existe en inventario.');
    addOrInc(p);
  };

  const addManual = async () => {
    const code = (barcodeManual || '').trim();
    if (!code) return;
    setBarcodeManual('');
    const p = await getProductByBarcode(code);
    if (!p) return Alert.alert('No encontrado', 'Ese código no existe en inventario.');
    addOrInc(p);
  };

  const inc = (b) => setCart(prev => prev.map(it => it.barcode === b ? { ...it, qty: it.qty + 1 } : it));
  const dec = (b) => setCart(prev => prev.map(it => it.barcode === b ? { ...it, qty: Math.max(1, it.qty - 1) } : it));
  const removeItem = (b) => setCart(prev => prev.filter(it => it.barcode !== b));
  const clear = () => setCart([]);

  const pay = async () => {
    if (!canPay) {
      return Alert.alert('Monto insuficiente', 'El monto ingresado es menor al total.');
    }
    try {
      const payload = { paymentMethod: method, amountPaid: Number(amountPaid || 0) };
      await recordSale(cart, payload);
      Alert.alert('Venta registrada', `Total: $${total.toFixed(0)}${method === 'efectivo' ? `\nVuelto: $${change.toFixed(0)}` : ''}`);
      clear();
      setAmountPaid('');
      onSold && onSold();
    } catch (e) {
      Alert.alert('Error', 'No se pudo registrar la venta.');
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={{ paddingHorizontal: 16, paddingTop: 12, flex: 1 }}>
        {/* Entrada rápida */}
        <View style={styles.row}>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => setScannerOpen(true)}>
            <Text style={styles.primaryBtnText}>📷 Escanear</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Código manual…"
            value={barcodeManual}
            onChangeText={setBarcodeManual}
            onSubmitEditing={addManual}
            keyboardType="numeric"
            returnKeyType="done"
          />
          <TouchableOpacity style={styles.ghostBtn} onPress={addManual}><Text style={styles.ghostBtnText}>Agregar</Text></TouchableOpacity>
        </View>

        {/* Lista de ítems */}
        <FlatList
          data={cart}
          keyExtractor={(it) => String(it.barcode)}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={({ item }) => (
            <View style={styles.item}>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle}>{item.name || item.barcode}</Text>
                <Text style={styles.itemSub}>{item.barcode}</Text>
              </View>
              <Text style={styles.itemPrice}>${Number(item.unit_price).toFixed(0)}</Text>
              <View style={styles.qtyBox}>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => dec(item.barcode)}><Text style={styles.qtyTxt}>−</Text></TouchableOpacity>
                <Text style={styles.qtyVal}>{item.qty}</Text>
                <TouchableOpacity style={styles.qtyBtn} onPress={() => inc(item.barcode)}><Text style={styles.qtyTxt}>＋</Text></TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => removeItem(item.barcode)}><Text style={{ color: theme.colors.danger, marginLeft: 8 }}>Eliminar</Text></TouchableOpacity>
            </View>
          )}
          ListEmptyComponent={<Text style={{ color: '#888', marginTop: 10 }}>Escanea o agrega productos…</Text>}
        />

        {/* Totales y pago */}
        <View style={styles.box}>
          <Text style={styles.total}>Total: ${total.toFixed(0)}</Text>

          <Text style={styles.label}>Método de pago</Text>
          <View style={styles.pills}>
            {PMETHODS.map(m => {
              const active = method === m;
              return (
                <TouchableOpacity key={m} style={[styles.pill, active && styles.pillOn]} onPress={() => setMethod(m)}>
                  <Text style={[styles.pillTxt, active && { color: '#fff' }]}>{m}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {method === 'efectivo' && (
            <>
              <Text style={styles.label}>Monto recibido</Text>
              <TextInput style={styles.input} placeholder="0" keyboardType="numeric" value={String(amountPaid)} onChangeText={setAmountPaid} />
              <View style={[styles.alertBox, Number(amountPaid || 0) < total ? { backgroundColor: theme.colors.dangerBg, borderColor: '#f4b4bf' } : { backgroundColor: theme.colors.successBg, borderColor: '#bfe8d3' }]}>
                <Text style={{ fontWeight: '600' }}>
                  {Number(amountPaid || 0) < total ? 'Monto insuficiente' : `Vuelto: $${change.toFixed(0)}`}
                </Text>
              </View>
            </>
          )}

          <TouchableOpacity disabled={!canPay} style={[styles.payBtn, !canPay && { opacity: 0.6 }]} onPress={pay}>
            <Text style={styles.payBtnTxt}>Pagar y registrar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scanner */}
      {scannerOpen && (
        <ScannerScreen
          onClose={() => setScannerOpen(false)}
          onScanned={scanDone}
        />
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 12, padding: Platform.OS === 'ios' ? 12 : 10, backgroundColor: '#fff' },
  primaryBtn: { backgroundColor: '#111', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  ghostBtn: { borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 12, paddingVertical: 12, paddingHorizontal: 14, backgroundColor: '#fff' },
  ghostBtnText: { color: '#333', fontWeight: '700' },

  item: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#eee' },
  itemTitle: { fontWeight: '700' },
  itemSub: { color: '#666' },
  itemPrice: { width: 70, textAlign: 'right', fontWeight: '700' },
  qtyBox: { flexDirection: 'row', alignItems: 'center', marginLeft: 8 },
  qtyBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 8, paddingVertical: 4, backgroundColor: '#fff' },
  qtyTxt: { fontWeight: '800', fontSize: 16 },
  qtyVal: { width: 28, textAlign: 'center', fontWeight: '700' },

  box: { marginTop: 12, borderWidth: 1, borderColor: '#eee', borderRadius: 12, backgroundColor: '#fff', padding: 12 },
  total: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  label: { fontSize: 12, color: '#666', marginTop: 8, marginBottom: 6 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  pill: { borderWidth: 1, borderColor: '#ddd', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  pillOn: { backgroundColor: '#111', borderColor: '#111' },
  pillTxt: { color: '#333', fontWeight: '700' },

  alertBox: { marginTop: 8, borderWidth: 1, borderRadius: 10, padding: 10 },

  payBtn: { marginTop: 12, backgroundColor: '#111', borderRadius: 12, padding: 14, alignItems: 'center' },
  payBtnTxt: { color: '#fff', fontWeight: '800' },
});