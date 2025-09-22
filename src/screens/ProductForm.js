// src/screens/ProductForm.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, TextInput, ScrollView, TouchableOpacity, KeyboardAvoidingView, Platform, Alert, Modal, Switch, Image
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { insertOrUpdateProduct, listCategories, addCategory } from '../db';
import { theme } from '../ui/Theme';
import * as ImagePicker from 'expo-image-picker';
import { copyFileToDocuments } from '../utils/media';
import ProductPhotoEditor from '../ui/ProductPhotoEditor';

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
  const [imageUri, setImageUri] = useState(initial?.imageUri || initial?.image_uri || null);
  const [photoSource, setPhotoSource] = useState(null);
  const [editorVisible, setEditorVisible] = useState(false);

  const [cats, setCats] = useState([]);
  const [catOpen, setCatOpen] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const [pickExp, setPickExp] = useState(false);

  useEffect(() => {
    (async () => { try { setCats(await listCategories()); } catch {} })();
  }, []);

  useEffect(() => {
    setImageUri(initial?.imageUri || initial?.image_uri || null);
  }, [initial?.imageUri, initial?.image_uri]);

  const filteredCats = useMemo(() => {
    const q = (catSearch || '').trim().toLowerCase();
    if (!q) return cats;
    return cats.filter(c => String(c.name || '').toLowerCase().includes(q));
  }, [catSearch, cats]);

  const openEditorWithSource = useCallback((uri) => {
    if (!uri) return;
    setPhotoSource(uri);
    setEditorVisible(true);
  }, []);

  const onEditorCancel = useCallback(() => {
    setEditorVisible(false);
    setPhotoSource(null);
  }, []);

  const onEditorSave = useCallback(async (processedUri) => {
    if (!processedUri) return;
    try {
      const saved = await copyFileToDocuments(processedUri, {
        folder: 'products',
        prefix: barcode ? `product-${barcode}` : 'product',
        extension: 'png',
      });
      setImageUri(saved);
    } catch (e) {
      console.warn('onEditorSave error', e);
      Alert.alert('Error', 'No se pudo guardar la foto del producto.');
    } finally {
      onEditorCancel();
    }
  }, [barcode, onEditorCancel]);

  const pickFromCamera = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso requerido', 'Activa la cámara para tomar la foto del producto.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8 });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (asset?.uri) {
        openEditorWithSource(asset.uri);
      }
    } catch (e) {
      console.warn('pickFromCamera error', e);
      Alert.alert('Error', 'No se pudo abrir la cámara.');
    }
  }, [openEditorWithSource]);

  const pickFromLibrary = useCallback(async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 0.8, mediaTypes: ImagePicker.MediaTypeOptions.Images });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (asset?.uri) {
        openEditorWithSource(asset.uri);
      }
    } catch (e) {
      console.warn('pickFromLibrary error', e);
      Alert.alert('Error', 'No se pudo acceder a la galería.');
    }
  }, [openEditorWithSource]);

  const removePhoto = useCallback(() => {
    setImageUri(null);
  }, []);

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
      imageUri: imageUri || null,
    };
    if (!payload.barcode) return Alert.alert('Falta código', 'El código de barras es obligatorio.');
    if (!payload.salePrice && !payload.purchasePrice) {
      return Alert.alert('Precio vacío', 'Agrega al menos precio de venta o de compra.');
    }
    try {
      await insertOrUpdateProduct(payload);
      Alert.alert('Guardado', 'Producto guardado correctamente.');
      onSaved && onSaved(payload.barcode);
    } catch (e) {
      Alert.alert('Error', 'No se pudo guardar el producto.');
    }
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

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 8 }} contentContainerStyle={{ paddingBottom: 90 }}>
        <Field label="Código de barras">
          <TextInput style={styles.input} value={barcode} onChangeText={setBarcode} placeholder="Ej: 7800000000001" keyboardType="numeric" />
        </Field>

        <Field label="Nombre">
          <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Ej: Coca-Cola 1.5L" />
        </Field>

        <Field label="Foto del producto">
          <View style={styles.photoBox}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.photoPreview} />
            ) : (
              <View style={styles.photoPlaceholder}>
                <Text style={{ color: '#999' }}>Sin foto</Text>
              </View>
            )}
          </View>
          <View style={styles.photoActions}>
            <TouchableOpacity style={styles.photoBtn} onPress={pickFromCamera}>
              <Text style={styles.photoBtnText}>Cámara</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.photoBtn} onPress={pickFromLibrary}>
              <Text style={styles.photoBtnText}>Galería</Text>
            </TouchableOpacity>
            {imageUri ? (
              <>
                <TouchableOpacity style={styles.photoBtn} onPress={() => openEditorWithSource(imageUri)}>
                  <Text style={styles.photoBtnText}>Editar fondo blanco</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.photoBtn, styles.photoBtnDanger]} onPress={removePhoto}>
                  <Text style={[styles.photoBtnText, { color: theme.colors.danger }]}>Quitar</Text>
                </TouchableOpacity>
              </>
            ) : null}
          </View>
          <Text style={styles.photoHint}>
            {imageUri
              ? 'Puedes volver a ajustar la imagen para mantener un fondo blanco uniforme.'
              : 'Captura o elige una imagen y luego edítala para lograr un fondo blanco.'}
          </Text>
        </Field>

        <Field label="Categoría">
          <TouchableOpacity style={styles.select} onPress={() => setCatOpen(true)}>
            <Text style={{ color: category ? theme.colors.text : '#999' }}>{category || 'Elegir o crear…'}</Text>
          </TouchableOpacity>
        </Field>

        <Field label="Se vende por peso">
          <Switch value={soldByWeight} onValueChange={setSoldByWeight} />
        </Field>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="Precio compra">
              <TextInput style={styles.input} value={String(purchasePrice)} onChangeText={setPurchasePrice} placeholder="0" keyboardType="numeric" />
            </Field>
          </View>
          <View style={{ flex: 1 }}>
            <Field label={soldByWeight ? 'Precio por kg' : 'Precio venta'}>
              <TextInput style={styles.input} value={String(salePrice)} onChangeText={setSalePrice} placeholder="0" keyboardType="numeric" />
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
            <Field label="Fecha de caducidad">
              <TouchableOpacity style={styles.select} onPress={() => setPickExp(true)}>
                <Text style={{ color: expiryDate ? theme.colors.text : '#999' }}>{expiryDate || 'Elegir fecha…'}</Text>
              </TouchableOpacity>
            </Field>
          </View>
        </View>

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

      <ProductPhotoEditor
        visible={editorVisible}
        sourceUri={photoSource || imageUri}
        onCancel={onEditorCancel}
        onSave={onEditorSave}
      />
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
  photoBox: { alignItems: 'center', marginBottom: 10 },
  photoPlaceholder: { width: 160, height: 160, borderRadius: 16, borderWidth: 1, borderColor: '#eee', backgroundColor: '#f6f6f6', alignItems: 'center', justifyContent: 'center' },
  photoPreview: { width: 160, height: 160, borderRadius: 16, borderWidth: 1, borderColor: '#e6e6e6' },
  photoActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  photoBtn: { borderWidth: 1, borderColor: '#d8e7ff', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#eef6ff' },
  photoBtnDanger: { backgroundColor: '#fde7ea', borderColor: '#f4b4bf' },
  photoBtnText: { color: theme.colors.primary, fontWeight: '600' },
  photoHint: { color: '#666', marginTop: 6 },
});