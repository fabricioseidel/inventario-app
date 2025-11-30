// src/screens/ProductForm.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Modal, Switch
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { insertOrUpdateProduct, listCategories, addCategory, getProductByBarcode, listSuppliers } from '../db';
import { theme } from '../ui/Theme';

function Field({ label, children }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
  );
}

export default function ProductForm({ initial, onSaved, onCancel }) {
  const [barcode, setBarcode] = useState(initial?.barcode || '');
  const [name, setName] = useState(initial?.name || '');
  const [category, setCategory] = useState(initial?.category || '');
  const [purchasePrice, setPurchasePrice] = useState(initial?.purchasePrice || '');
  const [salePrice, setSalePrice] = useState(initial?.salePrice || '');
  const [expiryDate, setExpiryDate] = useState(initial?.expiryDate || '');
  const [stock, setStock] = useState(initial?.stock || '');
  const [soldByWeight, setSoldByWeight] = useState(initial?.sold_by_weight ? true : false);
  
  // Nuevos campos
  const [description, setDescription] = useState(initial?.description || '');
  const [measurementUnit, setMeasurementUnit] = useState(initial?.measurement_unit || 'un');
  const [measurementValue, setMeasurementValue] = useState(String(initial?.measurement_value ?? '1'));
  const [supplierId, setSupplierId] = useState(initial?.supplier_id || null);
  const [taxRate, setTaxRate] = useState(String(initial?.tax_rate ?? '19'));
  const [priceWithTax, setPriceWithTax] = useState(''); // Calculado
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [cats, setCats] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [catOpen, setCatOpen] = useState(false);
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const [pickExp, setPickExp] = useState(false);

  useEffect(() => {
    (async () => { 
      try { 
        setCats(await listCategories()); 
        setSuppliers(await listSuppliers());
      } catch {} 
    })();
  }, []);

  // Calcular precio con IVA al cargar o cambiar precio neto
  useEffect(() => {
    if (salePrice && taxRate) {
      const net = Number(salePrice);
      const rate = Number(taxRate) / 100;
      const withTax = net * (1 + rate);
      setPriceWithTax(withTax.toFixed(0));
    }
  }, [salePrice, taxRate]);

  const handlePriceWithTaxChange = (val) => {
    setPriceWithTax(val);
    if (val && taxRate) {
      const gross = Number(val);
      const rate = Number(taxRate) / 100;
      const net = gross / (1 + rate);
      setSalePrice(net.toFixed(0));
    }
  };

  const filteredCats = useMemo(() => {
    const q = (catSearch || '').trim().toLowerCase();
    if (!q) return cats;
    return cats.filter(c => String(c.name || '').toLowerCase().includes(q));
  }, [catSearch, cats]);

  const performSave = async (payload) => {
    try {
      await insertOrUpdateProduct(payload);
      Alert.alert('Guardado', 'Producto guardado correctamente.');
      onSaved && onSaved(payload.barcode);
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el producto.');
    }
  };

  const save = async () => {
    const payload = {
      barcode: String(barcode || '').trim(),
      name: name.trim(),
      category: category.trim(),
      purchasePrice: Number(purchasePrice || 0),
      salePrice: Number(salePrice || 0),
      expiryDate: expiryDate || null,
      stock: Number(stock || 0),
      soldByWeight: soldByWeight ? 1 : 0,
      description: description.trim(),
      measurementUnit,
      measurementValue: Number(measurementValue || 0),
      supplierId,
      taxRate: Number(taxRate || 19),
      isActive: 1
    };
    if (!payload.barcode) return Alert.alert('Falta código', 'El código de barras es obligatorio.');
    if (!payload.salePrice && !payload.purchasePrice) {
      return Alert.alert('Precio vacío', 'Agrega al menos precio de venta o de compra.');
    }

    // Check if creating and barcode exists
    const isCreating = !initial || !initial.barcode;
    if (isCreating) {
      try {
        const existing = await getProductByBarcode(payload.barcode);
        if (existing) {
          return Alert.alert(
            'Producto existente',
            `El código ${payload.barcode} ya existe (${existing.name}). ¿Deseas actualizarlo?`,
            [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Actualizar', onPress: () => performSave(payload) }
            ]
          );
        }
      } catch (e) {
        console.warn('Error checking barcode:', e);
      }
    }

    await performSave(payload);
  };

  const checkExistingBarcode = async () => {
    if (!barcode || (initial && initial.barcode)) return;
    try {
      const existing = await getProductByBarcode(barcode.trim());
      if (existing) {
        Alert.alert(
          'Producto encontrado',
          `El código ${barcode} corresponde a "${existing.name}". ¿Cargar datos para editar?`,
          [
            { text: 'No', style: 'cancel' },
            { text: 'Sí, cargar', onPress: () => {
                setName(existing.name || '');
                setCategory(existing.category || '');
                setPurchasePrice(String(existing.purchase_price ?? ''));
                setSalePrice(String(existing.sale_price ?? ''));
                setExpiryDate(existing.expiry_date || '');
                setStock(String(existing.stock ?? ''));
                setSoldByWeight(existing.sold_by_weight ? true : false);
                setDescription(existing.description || '');
                setMeasurementUnit(existing.measurement_unit || 'un');
                setMeasurementValue(String(existing.measurement_value ?? '1'));
                setSupplierId(existing.supplier_id || null);
                setTaxRate(String(existing.tax_rate ?? '19'));
            }}
          ]
        );
      }
    } catch (e) {}
  };

  const addCat = async () => {
    const nm = (catSearch || '').trim();
    if (!nm) return;
    try {
      const c = await addCategory(nm);
      setCategory(c.name);
      setCatOpen(false);
    } catch {
      Alert.alert('Error', 'No se pudo crear la categoría.');
    }
  };

  const selectedSupplierName = useMemo(() => {
    if (!supplierId) return '';
    const s = suppliers.find(x => x.id === supplierId);
    return s ? s.name : supplierId;
  }, [supplierId, suppliers]);

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }} contentContainerStyle={{ paddingBottom: 90 }}>
        <Field label="Código de barras">
          <TextInput 
            style={styles.input} 
            value={barcode} 
            onChangeText={setBarcode} 
            placeholder="Ej: 7800000000001" 
            keyboardType="numeric" 
            onBlur={checkExistingBarcode}
          />
        </Field>

        <Field label="Nombre">
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ej: Coca-Cola 1.5L" />
        </Field>

        <Field label="Categoría">
          <TouchableOpacity style={styles.select} onPress={() => setCatOpen(true)}>
            <Text style={{ color: category ? theme.colors.text : '#999' }}>{category || 'Elegir o crear…'}</Text>
          </TouchableOpacity>
        </Field>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="Precio Neto (Sin IVA)">
              <TextInput style={styles.input} value={String(salePrice)} onChangeText={setSalePrice} placeholder="0" keyboardType="numeric" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label={`Precio Venta (IVA ${taxRate}%)`}>
              <TextInput style={[styles.input, { backgroundColor: '#f9f9f9' }]} value={String(priceWithTax)} onChangeText={handlePriceWithTaxChange} placeholder="0" keyboardType="numeric" />
            </Field>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label={soldByWeight ? 'Stock (kg)' : 'Stock'}>
              <TextInput style={styles.input} value={String(stock)} onChangeText={setStock} placeholder="0" keyboardType="numeric" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Precio compra (Neto)">
              <TextInput style={styles.input} value={String(purchasePrice)} onChangeText={setPurchasePrice} placeholder="0" keyboardType="numeric" />
            </Field>
          </View>
        </View>

        <TouchableOpacity style={styles.advancedToggle} onPress={() => setShowAdvanced(!showAdvanced)}>
          <Text style={styles.advancedToggleText}>{showAdvanced ? 'Ocultar detalles avanzados ▲' : 'Mostrar detalles avanzados ▼'}</Text>
        </TouchableOpacity>

        {showAdvanced && (
          <View style={styles.advancedBox}>
            <Field label="Descripción">
              <TextInput style={[styles.input, { height: 60 }]} value={description} onChangeText={setDescription} placeholder="Descripción detallada..." multiline />
            </Field>

            <Field label="Proveedor">
              <TouchableOpacity style={styles.select} onPress={() => setSupplierOpen(true)}>
                <Text style={{ color: supplierId ? theme.colors.text : '#999' }}>{selectedSupplierName || 'Seleccionar proveedor'}</Text>
              </TouchableOpacity>
            </Field>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Unidad Medida">
                  <TextInput style={styles.input} value={measurementUnit} onChangeText={setMeasurementUnit} placeholder="un, kg, lt..." />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Valor Medida">
                  <TextInput style={styles.input} value={measurementValue} onChangeText={setMeasurementValue} placeholder="1" keyboardType="numeric" />
                </Field>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Field label="Se vende por peso">
                  <Switch value={soldByWeight} onValueChange={setSoldByWeight} />
                </Field>
              </View>
              <View style={{ flex: 1 }}>
                <Field label="Fecha caducidad">
                  <TouchableOpacity style={styles.select} onPress={() => setPickExp(true)}>
                    <Text style={{ color: expiryDate ? theme.colors.text : '#999' }}>{expiryDate || 'Elegir...'}</Text>
                  </TouchableOpacity>
                </Field>
              </View>
            </View>
          </View>
        )}

        <Text style={{ color: '#888', marginTop: 6 }}>Completa lo necesario. Puedes dejar en blanco los campos que no apliquen.</Text>
      </ScrollView>

      {/* Footer fijo */}
      <View style={styles.footer}>
        <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={onCancel}><Text style={[styles.btnText, { color: '#333' }]}>Cancelar</Text></TouchableOpacity>
        <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={save}><Text style={[styles.btnText, { color: '#fff' }]}>Guardar</Text></TouchableOpacity>
      </View>

      {/* DatePicker */}
      {pickExp && (
        <DateTimePicker
          value={expiryDate ? new Date(expiryDate) : new Date()}
          mode="date"
          display="default"
          onChange={(_, d) => { setPickExp(false); if (d) setExpiryDate(d.toISOString().slice(0, 10)); }}
        />
      )}

      {/* Selector de categoría */}
      <Modal visible={catOpen} animationType="slide" onRequestClose={() => setCatOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderColor: theme.colors.divider }}>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>Categorías</Text>
            <Text style={{ color: '#666', marginTop: 2 }}>Elige una o crea nueva</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TextInput style={[styles.input, { flex: 1 }]} placeholder="Buscar o nueva categoría…" value={catSearch} onChangeText={setCatSearch} />
              <TouchableOpacity style={[styles.btn, styles.btnPrimary]} onPress={addCat}><Text style={[styles.btnText, { color: '#fff' }]}>Agregar</Text></TouchableOpacity>
            </View>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {(filteredCats || []).map(c => (
              <TouchableOpacity key={c.id} style={styles.catItem} onPress={() => { setCategory(c.name); setCatOpen(false); }}>
                <Text style={{ fontWeight: '600' }}>{c.name}</Text>
              </TouchableOpacity>
            ))}
            {(!filteredCats || filteredCats.length === 0) && (
              <Text style={{ color: '#888' }}>No hay categorías que coincidan.</Text>
            )}
          </ScrollView>
          <View style={{ padding: 16 }}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setCatOpen(false)}>
              <Text style={[styles.btnText, { color: '#333' }]}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Selector de Proveedor */}
      <Modal visible={supplierOpen} animationType="slide" onRequestClose={() => setSupplierOpen(false)}>
        <View style={{ flex: 1, backgroundColor: '#fff' }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderColor: theme.colors.divider }}>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>Proveedores</Text>
            <Text style={{ color: '#666', marginTop: 2 }}>Selecciona el proveedor principal</Text>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            <TouchableOpacity style={styles.catItem} onPress={() => { setSupplierId(null); setSupplierOpen(false); }}>
              <Text style={{ fontWeight: '600', color: '#666' }}>Ninguno / Desconocido</Text>
            </TouchableOpacity>
            {(suppliers || []).map(s => (
              <TouchableOpacity key={s.id} style={styles.catItem} onPress={() => { setSupplierId(s.id); setSupplierOpen(false); }}>
                <Text style={{ fontWeight: '600' }}>{s.name}</Text>
                {s.contact_name && <Text style={{ fontSize: 12, color: '#666' }}>{s.contact_name}</Text>}
              </TouchableOpacity>
            ))}
            {(!suppliers || suppliers.length === 0) && (
              <Text style={{ color: '#888', textAlign: 'center', marginTop: 20 }}>
                No hay proveedores sincronizados. Sincroniza la app para descargarlos.
              </Text>
            )}
          </ScrollView>
          <View style={{ padding: 16 }}>
            <TouchableOpacity style={[styles.btn, styles.btnGhost]} onPress={() => setSupplierOpen(false)}>
              <Text style={[styles.btnText, { color: '#333' }]}>Cerrar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  label: { fontSize: 12, color: '#666', marginBottom: 6, marginLeft: 2 },
  input: { borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 12, padding: Platform.OS === 'ios' ? 12 : 10, backgroundColor: '#fff' },
  select: { borderWidth: 1, borderColor: '#e6e6e6', borderRadius: 12, padding: 12, backgroundColor: '#fff', justifyContent: 'center' },
  footer: { flexDirection: 'row', gap: 10, padding: 12, borderTopWidth: 1, borderColor: theme.colors.divider, backgroundColor: '#fff' },
  btn: { flex: 1, padding: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  btnPrimary: { backgroundColor: '#111', borderColor: '#111' },
  btnGhost: { backgroundColor: '#fff', borderColor: '#e6e6e6' },
  btnText: { fontWeight: '700' },
  catItem: { padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#eee', marginBottom: 8, backgroundColor: '#fff' },
  advancedToggle: { padding: 10, alignItems: 'center', marginVertical: 5 },
  advancedToggleText: { color: '#007BFF', fontWeight: '600' },
  advancedBox: { backgroundColor: '#f8f9fa', padding: 12, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#eee' },
});
