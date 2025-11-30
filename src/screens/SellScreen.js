// src/screens/SellScreen.js
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  FlatList,
  Alert,
  Platform,
  KeyboardAvoidingView,
  Modal,
  Image,
  useWindowDimensions,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';

import ScannerScreen from './ScannerScreen';
import { getProductByBarcode, recordSale } from '../db';
import { syncNow } from '../sync';
import { theme } from '../ui/Theme';
import { copyFileToDocuments, getFileDisplayName } from '../utils/media';
import { uploadReceiptToSupabase } from '../utils/supabaseStorage';

const PMETHODS = ['efectivo', 'debito', 'credito', 'transferencia'];

export default function SellScreen({
  onClose,
  onSold,
  onRequestCreateProduct,
  pendingBarcode,
  recentlyCreatedBarcode,
  onConsumeRecentBarcode,
}) {
  const { width } = useWindowDimensions();
  const isCompact = width < 380;

  const [scannerOpen, setScannerOpen] = useState(false);
  const [barcodeManual, setBarcodeManual] = useState('');
  const [cart, setCart] = useState([]); // {barcode,name,unit_price,qty,sold_by_weight}
  const [method, setMethod] = useState('efectivo');
  const [amountPaid, setAmountPaid] = useState('');
  const [weightProd, setWeightProd] = useState(null);
  const [weightQty, setWeightQty] = useState('');
  const [transferProof, setTransferProof] = useState(null); // { uri, name, kind }
  const [previewUri, setPreviewUri] = useState(null);

  const total = useMemo(
    () => cart.reduce((a, it) => a + (Number(it.qty || 0) * Number(it.unit_price || 0)), 0),
    [cart]
  );
  const change = Math.max(0, Number(amountPaid || 0) - total);
  const canPay = total > 0 && (method !== 'efectivo' || Number(amountPaid || 0) >= total);

  const addOrInc = useCallback((p) => {
    setCart((prev) => {
      const i = prev.findIndex((x) => x.barcode === p.barcode);
      if (i >= 0) {
        const next = [...prev];
        next[i] = {
          ...next[i],
          qty: Number(next[i].qty || 0) + 1,
          unit_price: (p.sale_price != null) ? Number(p.sale_price) : next[i].unit_price,
        };
        return next;
      }
      return [
        ...prev,
        {
          barcode: p.barcode,
          name: p.name || '',
          unit_price: Number(p.sale_price || 0),
          qty: 1,
          sold_by_weight: p.sold_by_weight ? 1 : 0,
        },
      ];
    });
  }, []);

  const addProduct = useCallback(
    (p) => {
      if (p.sold_by_weight) {
        setWeightProd(p);
        setWeightQty('');
      } else {
        addOrInc(p);
      }
    },
    [addOrInc]
  );

  const handleMissingProduct = useCallback(
    (code) => {
      Alert.alert('Producto no encontrado', 'Ese código no existe en inventario.', [
        { text: 'Continuar sin agregar', style: 'cancel' },
        {
          text: 'Agregar producto',
          onPress: () => onRequestCreateProduct && onRequestCreateProduct(String(code)),
        },
      ]);
    },
    [onRequestCreateProduct]
  );

  const scanDone = useCallback(
    async (code) => {
      setScannerOpen(false);
      const trimmed = String(code).trim();
      const p = await getProductByBarcode(trimmed);
      if (!p) {
        handleMissingProduct(trimmed);
        return;
      }
      addProduct(p);
    },
    [addProduct, handleMissingProduct]
  );

  const addManual = useCallback(async () => {
    const code = (barcodeManual || '').trim();
    if (!code) return;
    setBarcodeManual('');
    const p = await getProductByBarcode(code);
    if (!p) {
      handleMissingProduct(code);
      return;
    }
    addProduct(p);
  }, [addProduct, barcodeManual, handleMissingProduct]);

  const inc = useCallback((b) => {
    setCart((prev) =>
      prev.map((it) => {
        if (it.barcode !== b) return it;
        const step = it.sold_by_weight ? 0.1 : 1;
        return { ...it, qty: Number(it.qty) + step };
      })
    );
  }, []);

  const dec = useCallback((b) => {
    setCart((prev) =>
      prev.map((it) => {
        if (it.barcode !== b) return it;
        const step = it.sold_by_weight ? 0.1 : 1;
        return { ...it, qty: Math.max(step, Number(it.qty) - step) };
      })
    );
  }, []);

  const removeItem = useCallback((b) => {
    setCart((prev) => prev.filter((it) => it.barcode !== b));
  }, []);

  const clear = useCallback(() => {
    setCart([]);
    setAmountPaid('');
    setTransferProof(null);
  }, []);

  const attachProofFromCamera = useCallback(async () => {
    try {
      console.log('📷 Iniciando captura desde cámara...');
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      console.log('📷 Permisos de cámara:', perm.granted ? 'CONCEDIDOS' : 'DENEGADOS');
      if (!perm.granted) {
        Alert.alert('Permiso requerido', 'Activa el acceso a la cámara para tomar una foto del comprobante.');
        return;
      }
      console.log('📷 Abriendo cámara...');
      const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true });
      console.log('📷 Resultado:', result.canceled ? 'CANCELADO' : 'CAPTURADO');
      if (result.canceled) return;
      const asset = result.assets?.[0];
      console.log('📷 Asset URI:', asset?.uri);
      if (!asset?.uri) {
        Alert.alert('Error', 'No se pudo obtener la imagen de la cámara.');
        return;
      }
      console.log('📷 Copiando archivo a documentos...');
      const saved = await copyFileToDocuments(asset.uri, {
        folder: 'receipts',
        prefix: 'transfer',
        extension: 'jpg',
      });
      console.log('📷 Archivo guardado en:', saved);
      setTransferProof({ uri: saved, name: asset.fileName || getFileDisplayName(saved), kind: 'image' });
      Alert.alert('Éxito', 'Comprobante adjuntado correctamente.');
    } catch (e) {
      console.error('❌ attachProofFromCamera ERROR:', e);
      console.error('❌ Error message:', e.message);
      console.error('❌ Error stack:', e.stack);
      Alert.alert('Error', `No se pudo capturar la imagen.\n\nDetalle: ${e.message || 'Error desconocido'}`);
    }
  }, []);

  const attachProofFromLibrary = useCallback(async () => {
    try {
      console.log('🖼️ Iniciando selección desde galería...');
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      console.log('🖼️ Permisos de galería:', perm.granted ? 'CONCEDIDOS' : 'DENEGADOS');
      if (!perm.granted) {
        Alert.alert('Permiso requerido', 'Activa el acceso a la galería para seleccionar una imagen.');
        return;
      }
      console.log('🖼️ Abriendo galería...');
      const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.8, allowsEditing: true, mediaTypes: ImagePicker.MediaTypeOptions.Images });
      console.log('🖼️ Resultado:', result.canceled ? 'CANCELADO' : 'SELECCIONADO');
      if (result.canceled) return;
      const asset = result.assets?.[0];
      console.log('🖼️ Asset URI:', asset?.uri);
      if (!asset?.uri) {
        Alert.alert('Error', 'No se pudo obtener la imagen seleccionada.');
        return;
      }
      console.log('🖼️ Copiando archivo a documentos...');
      const saved = await copyFileToDocuments(asset.uri, {
        folder: 'receipts',
        prefix: 'transfer',
        extension: 'jpg',
      });
      console.log('🖼️ Archivo guardado en:', saved);
      setTransferProof({ uri: saved, name: asset.fileName || getFileDisplayName(saved), kind: 'image' });
      Alert.alert('Éxito', 'Comprobante adjuntado correctamente.');
    } catch (e) {
      console.error('❌ attachProofFromLibrary ERROR:', e);
      console.error('❌ Error message:', e.message);
      console.error('❌ Error stack:', e.stack);
      Alert.alert('Error', `No se pudo adjuntar desde la galería.\n\nDetalle: ${e.message || 'Error desconocido'}`);
    }
  }, []);

  const attachProofFromFile = useCallback(async () => {
    try {
      console.log('📁 Iniciando selección de archivo...');
      const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
      console.log('📁 Resultado:', result.type === 'cancel' ? 'CANCELADO' : 'SELECCIONADO');
      console.log('📁 Document result:', result);
      if (result.type === 'cancel') return;
      console.log('📁 URI del archivo:', result.uri);
      console.log('📁 Copiando archivo a documentos...');
      const saved = await copyFileToDocuments(result.uri, {
        folder: 'receipts',
        prefix: 'transfer',
      });
      console.log('📁 Archivo guardado en:', saved);
      const isImage = String(result.mimeType || '').startsWith('image/');
      console.log('📁 Es imagen?:', isImage);
      setTransferProof({ uri: saved, name: result.name || getFileDisplayName(saved), kind: isImage ? 'image' : 'file' });
      Alert.alert('Éxito', 'Comprobante adjuntado correctamente.');
    } catch (e) {
      console.error('❌ attachProofFromFile ERROR:', e);
      console.error('❌ Error message:', e.message);
      console.error('❌ Error stack:', e.stack);
      Alert.alert('Error', `No se pudo adjuntar el archivo.\n\nDetalle: ${e.message || 'Error desconocido'}`);
    }
  }, []);

  useEffect(() => {
    if (!recentlyCreatedBarcode || !pendingBarcode) return;
    if (recentlyCreatedBarcode !== pendingBarcode) return;

    (async () => {
      const product = await getProductByBarcode(recentlyCreatedBarcode);
      if (product) {
        addProduct(product);
      } else {
        Alert.alert('Producto', 'El nuevo producto aún no está disponible. Intenta nuevamente.');
      }
      onConsumeRecentBarcode && onConsumeRecentBarcode();
    })();
  }, [addProduct, onConsumeRecentBarcode, pendingBarcode, recentlyCreatedBarcode]);

  const pay = useCallback(async () => {
    if (!canPay) {
      Alert.alert('Monto insuficiente', 'El monto ingresado es menor al total.');
      return;
    }
    const proof = method === 'transferencia' ? transferProof : null;
    try {
      let receiptUrl = null;
      let receiptName = null;

      // Si hay comprobante de imagen, subirlo a Supabase Storage
      if (proof && proof.kind === 'image') {
        try {
          console.log('═══════════════════════════════════════════════════════');
          console.log('📤 [VENTA] Iniciando proceso de pago con comprobante');
          console.log('═══════════════════════════════════════════════════════');
          console.log(`Método de pago: TRANSFERENCIA`);
          console.log(`Total venta: $${total.toFixed(0)}`);
          console.log(`Comprobante detectado: Sí`);
          console.log(`Tipo: ${proof.kind}`);
          console.log(`Nombre: ${proof.name}`);

          // Generar un ID temporal para el nombre del archivo
          const tempSaleId = `temp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          console.log(`⏳ [PASO 1] Subiendo comprobante a Supabase...`);
          console.log(`   ID temporal: ${tempSaleId}`);

          receiptUrl = await uploadReceiptToSupabase(proof.uri, tempSaleId);

          console.log(`⏳ [DEBUG] Valor retornado de uploadReceiptToSupabase:`);
          console.log(`   Type: ${typeof receiptUrl}`);
          console.log(`   Value: ${receiptUrl}`);
          console.log(`   Length: ${receiptUrl ? receiptUrl.length : 'null'}`);

          receiptName = proof.name;

          if (!receiptUrl) {
            console.warn(`⚠️ [ADVERTENCIA] uploadReceiptToSupabase retornó un valor vacío`);
            throw new Error('uploadReceiptToSupabase retornó null o undefined');
          }

          console.log(`✅ [PASO 2] Comprobante subido exitosamente`);
          console.log(`   URL: ${receiptUrl}`);
          console.log(`═══════════════════════════════════════════════════════`);
        } catch (uploadError) {
          console.error('═══════════════════════════════════════════════════════');
          console.error(`❌ [ERROR] Fallo al subir comprobante`);
          console.error('═══════════════════════════════════════════════════════');
          console.error(`Error: ${uploadError.message}`);
          console.error(`Stack: ${uploadError.stack}`);
          console.error(`Sale ID temporal: temp-${Date.now()}`);

          // 🆕 OFFLINE SUPPORT: Si falla la subida (ej. sin internet), guardamos la URI local
          // El proceso de sync (pushSales) se encargará de subirla cuando haya conexión
          console.log('⚠️ [OFFLINE SUPPORT] Falló subida, guardando URI local para sincronización posterior');
          receiptUrl = proof.uri;
          receiptName = proof.name;

          // Alert.alert('Aviso', 'No hay conexión para subir el comprobante. Se guardará localmente y se subirá cuando recuperes la conexión.');
        }
      }

      console.log('⏳ [PASO 3] Registrando venta en base de datos local...');
      const payload = {
        paymentMethod: method,
        amountPaid: Number(amountPaid || 0),
        transferReceiptUri: receiptUrl,
        transferReceiptName: receiptName,
      };
      console.log(`Payload:`, {
        method,
        amountPaid: payload.amountPaid,
        hasReceipt: !!receiptUrl,
        receiptUrl: receiptUrl ? '✅ Presente' : '❌ Ausente',
      });

      await recordSale(cart, payload);
      console.log(`✅ Venta registrada en local correctamente`);

      // Sincronizar automáticamente si hay comprobante o se especifique
      if (receiptUrl) {
        console.log('⏳ [PASO 4] Sincronizando venta con comprobante a Supabase...');
        try {
          await syncNow();
          console.log('✅ Sincronización completada');
        } catch (syncError) {
          console.warn('⚠️ Error en sincronización automática:', syncError.message);
          // No lanzamos error, la sincronización fallida no debería detener el flujo
        }
      }

      Alert.alert(
        'Venta registrada',
        `Total: $${total.toFixed(0)}${method === 'efectivo' ? `\nVuelto: $${change.toFixed(0)}` : ''}`
      );
      clear();
      onSold && onSold();
    } catch (e) {
      console.error('═══════════════════════════════════════════════════════');
      console.error('❌ [ERROR CRÍTICO] Error al procesar el pago');
      console.error('═══════════════════════════════════════════════════════');
      console.error(`Error Type: ${e.name}`);
      console.error(`Error Message: ${e.message}`);
      console.error(`Stack: ${e.stack}`);
      console.error(`Monto: $${total.toFixed(0)}`);
      console.error(`Método: ${method}`);
      Alert.alert('Error', `No se pudo registrar la venta: ${e.message}`);
    }
  }, [amountPaid, canPay, cart, change, clear, method, onSold, total, transferProof]);

  const renderItem = useCallback(
    ({ item }) => (
      <View style={[styles.item, isCompact && styles.itemCompact]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>{item.name || item.barcode}</Text>
          <Text style={styles.itemSub}>{item.barcode}</Text>
        </View>
        <Text style={styles.itemPrice}>${Number(item.unit_price).toFixed(0)}</Text>
        <View style={styles.qtyBox}>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => dec(item.barcode)}>
            <Text style={styles.qtyTxt}>−</Text>
          </TouchableOpacity>
          <Text style={styles.qtyVal}>{item.sold_by_weight ? `${Number(item.qty).toFixed(2)}kg` : item.qty}</Text>
          <TouchableOpacity style={styles.qtyBtn} onPress={() => inc(item.barcode)}>
            <Text style={styles.qtyTxt}>＋</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => removeItem(item.barcode)}>
          <Text style={{ color: theme.colors.danger, marginLeft: 8 }}>Eliminar</Text>
        </TouchableOpacity>
      </View>
    ),
    [dec, inc, isCompact, removeItem]
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.select({ ios: 'padding', android: undefined })}>
      <View style={{ paddingHorizontal: isCompact ? 12 : 16, paddingTop: 12, flex: 1 }}>
        {/* Entrada rápida */}
        <View style={[styles.row, isCompact && styles.rowWrap]}>
          <TouchableOpacity style={[styles.primaryBtn, isCompact && styles.primaryBtnCompact]} onPress={() => setScannerOpen(true)}>
            <Text style={styles.primaryBtnText}>📷 Escanear</Text>
          </TouchableOpacity>
          <TextInput
            style={[styles.input, { flex: 1 }]}
            placeholder="Código manual (o escanear)…"
            value={barcodeManual}
            onChangeText={setBarcodeManual}
            onSubmitEditing={addManual}
            keyboardType="numeric"
            returnKeyType="done"
            blurOnSubmit={false} // Mantiene el foco para escaneo continuo
            autoFocus={true} // Foco inicial para escanear directo
          />
          <TouchableOpacity style={[styles.ghostBtn, styles.ghostBtnCompact]} onPress={addManual}>
            <Text style={styles.ghostBtnText}>Agregar</Text>
          </TouchableOpacity>
        </View>

        {/* Lista de ítems */}
        <FlatList
          data={cart}
          keyExtractor={(it) => String(it.barcode)}
          contentContainerStyle={{ paddingVertical: 8 }}
          renderItem={renderItem}
          ListEmptyComponent={<Text style={{ color: '#888', marginTop: 10 }}>Escanea o agrega productos…</Text>}
        />

        {/* Totales y pago */}
        <View style={styles.box}>
          <Text style={styles.total}>Total: ${total.toFixed(0)}</Text>

          <Text style={styles.label}>Método de pago</Text>
          <View style={[styles.pills, isCompact && { flexWrap: 'wrap' }]}>
            {PMETHODS.map((m) => {
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
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={String(amountPaid)}
                onChangeText={setAmountPaid}
              />
              <View
                style={[
                  styles.alertBox,
                  Number(amountPaid || 0) < total
                    ? { backgroundColor: theme.colors.dangerBg, borderColor: '#f4b4bf' }
                    : { backgroundColor: theme.colors.successBg, borderColor: '#bfe8d3' },
                ]}
              >
                <Text style={{ fontWeight: '600' }}>
                  {Number(amountPaid || 0) < total ? 'Monto insuficiente' : `Vuelto: $${change.toFixed(0)}`}
                </Text>
              </View>
            </>
          )}

          {method === 'transferencia' && (
            <View style={styles.proofContainer}>
              <Text style={[styles.label, { marginBottom: 6 }]}>Comprobante de transferencia</Text>
              {transferProof ? (
                <View style={styles.proofPreview}>
                  {transferProof.kind === 'image' ? (
                    <TouchableOpacity onPress={() => setPreviewUri(transferProof.uri)}>
                      <Image source={{ uri: transferProof.uri }} style={styles.proofThumb} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.proofThumbPlaceholder}>
                      <Text style={{ fontSize: 18 }}>📄</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text style={styles.proofName} numberOfLines={2}>
                      {transferProof.name}
                    </Text>
                    <TouchableOpacity onPress={() => setTransferProof(null)}>
                      <Text style={styles.proofRemove}>Eliminar</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ) : (
                <Text style={styles.proofHint}>Adjunta una foto o archivo del comprobante para dejar respaldo.</Text>
              )}
              <View style={[styles.row, styles.rowWrap, { marginTop: 8 }]}>
                <TouchableOpacity style={[styles.ghostBtn, styles.ghostBtnCompact]} onPress={attachProofFromCamera}>
                  <Text style={styles.ghostBtnText}>Usar cámara</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.ghostBtn, styles.ghostBtnCompact]} onPress={attachProofFromLibrary}>
                  <Text style={styles.ghostBtnText}>Galería</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.ghostBtn, styles.ghostBtnCompact]} onPress={attachProofFromFile}>
                  <Text style={styles.ghostBtnText}>Archivo</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <TouchableOpacity disabled={!canPay} style={[styles.payBtn, !canPay && { opacity: 0.6 }]} onPress={pay}>
            <Text style={styles.payBtnTxt}>Pagar y registrar</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Scanner */}
      {scannerOpen && (
        <ScannerScreen onClose={() => setScannerOpen(false)} onScanned={scanDone} />
      )}

      {weightProd && (
        <Modal transparent animationType="fade" visible>
          <View style={styles.modalBg}>
            <View style={styles.modalBox}>
              <Text style={{ fontWeight: '700', marginBottom: 8 }}>{weightProd.name || weightProd.barcode}</Text>
              <Text style={styles.label}>Cantidad en kg</Text>
              <TextInput
                style={styles.input}
                placeholder="0"
                keyboardType="numeric"
                value={weightQty}
                onChangeText={setWeightQty}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
                <TouchableOpacity
                  style={[styles.ghostBtn, { flex: 1 }]}
                  onPress={() => {
                    setWeightProd(null);
                    setWeightQty('');
                  }}
                >
                  <Text style={styles.ghostBtnText}>Cancelar</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.primaryBtn, { flex: 1 }]}
                  onPress={() => {
                    const q = Number(weightQty || 0);
                    if (!q) return;
                    setCart((prev) => {
                      const i = prev.findIndex((x) => x.barcode === weightProd.barcode);
                      if (i >= 0) {
                        const next = [...prev];
                        next[i] = {
                          ...next[i],
                          qty: Number(next[i].qty || 0) + q,
                          unit_price: weightProd.sale_price ?? next[i].unit_price,
                        };
                        return next;
                      }
                      return [
                        ...prev,
                        {
                          barcode: weightProd.barcode,
                          name: weightProd.name || '',
                          unit_price: Number(weightProd.sale_price || 0),
                          qty: q,
                          sold_by_weight: 1,
                        },
                      ];
                    });
                    setWeightProd(null);
                    setWeightQty('');
                  }}
                >
                  <Text style={styles.primaryBtnText}>Agregar</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      )}

      <Modal visible={!!previewUri} transparent animationType="fade" onRequestClose={() => setPreviewUri(null)}>
        <View style={styles.previewBg}>
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setPreviewUri(null)}>
            {previewUri && <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode="contain" />}
          </TouchableOpacity>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowWrap: { flexWrap: 'wrap' },
  primaryBtn: {
    borderRadius: 12,
    backgroundColor: theme.colors.primary,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  primaryBtnCompact: { flexGrow: 1 },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  ghostBtn: {
    borderWidth: 1,
    borderColor: '#d8e7ff',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: '#eef6ff',
  },
  ghostBtnCompact: { alignSelf: 'stretch' },
  ghostBtnText: { color: theme.colors.primary, fontWeight: '600' },
  input: {
    borderWidth: 1,
    borderColor: '#e6e6e6',
    borderRadius: 12,
    padding: Platform.OS === 'ios' ? 12 : 10,
    backgroundColor: '#fff',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderColor: '#eee',
    gap: 8,
  },
  itemCompact: { flexWrap: 'wrap' },
  itemTitle: { fontWeight: '700' },
  itemSub: { color: '#666' },
  itemPrice: { fontWeight: '600', marginHorizontal: 4 },
  qtyBox: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qtyBtn: {
    borderWidth: 1,
    borderColor: '#d8e7ff',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#eef6ff',
  },
  qtyTxt: { fontSize: 16, fontWeight: '700', color: theme.colors.primary },
  qtyVal: { minWidth: 40, textAlign: 'center', fontWeight: '600' },
  box: {
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 16,
    padding: 16,
    backgroundColor: '#fff',
    marginTop: 6,
    gap: 10,
  },
  total: { fontSize: 20, fontWeight: '800' },
  label: { fontSize: 12, color: '#666' },
  pills: { flexDirection: 'row', gap: 8 },
  pill: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#fff',
  },
  pillOn: { backgroundColor: '#111', borderColor: '#111' },
  pillTxt: { fontWeight: '600', textTransform: 'capitalize' },
  alertBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  payBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: theme.colors.primary,
  },
  payBtnTxt: { color: '#fff', fontWeight: '800', fontSize: 16 },
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 18,
    width: '100%',
  },
  proofContainer: {
    borderWidth: 1,
    borderColor: '#f0f0f0',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fafafa',
  },
  proofPreview: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  proofThumb: { width: 54, height: 54, borderRadius: 12 },
  proofThumbPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 12,
    backgroundColor: '#eef1ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofName: { fontWeight: '600', color: '#333' },
  proofHint: { color: '#666' },
  proofRemove: { color: theme.colors.danger, marginTop: 4 },
  previewBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  previewImage: { width: '100%', height: '100%' },
});
