// src/screens/SalesHistoryScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, Button, FlatList, Modal, SafeAreaView, TouchableOpacity, StyleSheet, ActivityIndicator, Alert, Image } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { getSaleWithItems, listSalesBetween, exportSalesCSV, voidSale, updateSaleTransferReceipt } from '../db';
import { syncNow } from '../sync';
import { theme } from '../ui/Theme';
import { copyFileToDocuments, getFileDisplayName } from '../utils/media';
import { uploadReceiptToSupabase } from '../utils/supabaseStorage';

const PMETHODS = ['efectivo', 'debito', 'credito', 'transferencia'];
function startOfDay(d) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function addMonths(d, n) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
function fmt(ts) { const d = new Date(ts); const dd = String(d.getDate()).padStart(2, '0'); const mm = String(d.getMonth() + 1).padStart(2, '0'); const hh = String(d.getHours()).padStart(2, '0'); const mi = String(d.getMinutes()).padStart(2, '0'); return `${dd}/${mm} ${hh}:${mi}`; }

export default function SalesHistoryScreen({ onClose, refreshKey }) {
  const [rangeType, setRangeType] = useState('today');
  const [dStart, setDStart] = useState(startOfDay(new Date()));
  const [dEnd, setDEnd] = useState(endOfDay(new Date()));
  const [pickStart, setPickStart] = useState(false);
  const [pickEnd, setPickEnd] = useState(false);

  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);
  const [detail, setDetail] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [methods, setMethods] = useState(new Set());
  const [proofPreview, setProofPreview] = useState(null);
  const [attachLoading, setAttachLoading] = useState(false);

  useEffect(() => {
    const today = new Date();
    if (rangeType === 'today') { setDStart(startOfDay(today)); setDEnd(endOfDay(today)); }
    else if (rangeType === 'week') {
      const day = today.getDay(); const diff = (day + 6) % 7;
      const mon = startOfDay(addDays(today, -diff));
      setDStart(mon); setDEnd(endOfDay(addDays(mon, 6)));
    } else if (rangeType === 'month') {
      const first = new Date(today.getFullYear(), today.getMonth(), 1);
      setDStart(startOfDay(first)); setDEnd(endOfDay(addDays(addMonths(first, 1), -1)));
    }
  }, [rangeType]);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const rows = await listSalesBetween(dStart.getTime(), dEnd.getTime());
        setSales(rows);
      } catch { Alert.alert('Error', 'No se pudo cargar el historial.'); }
      finally { setLoading(false); }
    })();
  }, [dStart, dEnd, refreshKey]);

  const filtered = useMemo(() => {
    if (!methods.size) return sales;
    return sales.filter(s => methods.has(s.payment_method || ''));
  }, [sales, methods]);

  const summary = useMemo(() => {
    const total = filtered.reduce((a, s) => a + Number(s.total || 0), 0);
    const count = filtered.length;
    const avg = count ? total / count : 0;
    const byMethod = {};
    for (const s of filtered) {
      const k = s.payment_method || 'desconocido';
      byMethod[k] = (byMethod[k] || 0) + Number(s.total || 0);
    }
    return { total, count, avg, byMethod };
  }, [filtered]);

  const toggleMethod = (m) => {
    setMethods(prev => {
      const n = new Set(prev);
      if (n.has(m)) n.delete(m); else n.add(m);
      return n;
    });
  };

  const openDetail = async (saleId) => {
    try {
      setLoading(true);
      const data = await getSaleWithItems(saleId);
      setProofPreview(null);
      setDetail(data);
      setDetailOpen(true);
    } catch { Alert.alert('Error', 'No se pudo cargar el detalle.'); }
    finally { setLoading(false); }
  };

  const shareProof = async (uri) => {
    if (!uri) return;
    try {
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri);
      } else {
        Alert.alert('Compartir', 'La opción de compartir no está disponible en este dispositivo.');
      }
    } catch (e) {
      Alert.alert('Error', 'No se pudo compartir el comprobante.');
    }
  };

  const persistProof = async (localUri, displayName) => {
    const startTime = Date.now();
    if (!detail?.sale?.id || !localUri) {
      console.warn('⚠️ persistProof: Falta sale.id o localUri');
      return;
    }
    
    setAttachLoading(true);
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('📎 [ADJUNTAR COMPROBANTE] Procesando archivo');
      console.log('═══════════════════════════════════════════════════════');
      console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
      console.log(`🆔 Sale ID: ${detail.sale.id}`);
      console.log(`📁 URI: ${localUri.substring(0, 80)}...`);
      console.log(`📝 Nombre: ${displayName}`);
      
      // Subir a Supabase Storage en lugar de guardar localmente
      let uploadedUrl = null;
      let uploadedName = null;
      let isLocalFile = false;

      // Si es una imagen, subirla a Supabase
      if (localUri.startsWith('file://') || localUri.includes('Documents')) {
        isLocalFile = true;
        console.log('⏳ [PASO 1] Detectado archivo local - procediendo con upload');
        
        try {
          uploadedUrl = await uploadReceiptToSupabase(localUri, detail.sale.id);
          
          console.log(`⏳ [DEBUG] Valor retornado de uploadReceiptToSupabase:`);
          console.log(`   Type: ${typeof uploadedUrl}`);
          console.log(`   Value: ${uploadedUrl}`);
          console.log(`   Length: ${uploadedUrl ? uploadedUrl.length : 'null'}`);
          
          if (!uploadedUrl) {
            throw new Error('uploadReceiptToSupabase retornó null o undefined');
          }
          
          uploadedName = displayName || getFileDisplayName(localUri) || null;
          console.log(`✅ [PASO 2] Archivo subido a Supabase`);
          console.log(`   URL: ${uploadedUrl}`);
        } catch (uploadError) {
          console.error('❌ [ERROR EN UPLOAD]');
          console.error(`   Message: ${uploadError.message}`);
          console.error(`   Stack: ${uploadError.stack}`);
          console.error(`   Sale ID: ${detail.sale.id}`);
          console.error(`   Local URI: ${localUri.substring(0, 80)}`);
          throw uploadError;
        }
      } else {
        // Si ya es una URL (de otro dispositivo), usarla directamente
        isLocalFile = false;
        console.log('✅ [PASO 1] Detectada URL remota - usando directamente');
        uploadedUrl = localUri;
        uploadedName = displayName || null;
        console.log(`   URL: ${uploadedUrl.substring(0, 60)}...`);
      }

      // Actualizar la venta en BD local
      console.log('⏳ [PASO 3] Actualizando venta en base de datos local...');
      await updateSaleTransferReceipt(detail.sale.id, uploadedUrl, uploadedName);
      console.log(`✅ BD local actualizada`);

      console.log('⏳ [PASO 4] Recargando detalle de venta...');
      const updated = await getSaleWithItems(detail.sale.id);
      setDetail(updated);
      setSales(prev =>
        prev.map(s =>
          s.id === detail.sale.id ? { ...s, transfer_receipt_uri: uploadedUrl, transfer_receipt_name: uploadedName } : s
        )
      );
      console.log(`✅ Venta actualizada en lista`);

      const totalTime = Date.now() - startTime;
      console.log('═══════════════════════════════════════════════════════');
      console.log(`✅ [ÉXITO] Comprobante procesado en ${totalTime}ms`);
      console.log('═══════════════════════════════════════════════════════');
      console.log(`Tipo: ${isLocalFile ? 'Archivo nuevo' : 'URL remota'}`);
      console.log(`URL Final: ${uploadedUrl.substring(0, 60)}...`);
      
      // Sincronizar automáticamente después de agregar comprobante
      console.log('⏳ [PASO 5] Sincronizando venta con Supabase...');
      try {
        await syncNow();
        console.log('✅ Sincronización completada');
      } catch (syncError) {
        console.warn('⚠️ Error en sincronización automática:', syncError.message);
        // No lanzamos error, la sincronización fallida no debería detener el flujo
      }
      
      Alert.alert('Comprobante', 'Archivo guardado y sincronizado correctamente.');
    } catch (error) {
      const totalTime = Date.now() - startTime;
      console.error('═══════════════════════════════════════════════════════');
      console.error(`❌ [ERROR] Falló al procesar comprobante (${totalTime}ms)`);
      console.error('═══════════════════════════════════════════════════════');
      console.error(`Error Type: ${error.name}`);
      console.error(`Error Message: ${error.message}`);
      console.error(`Stack: ${error.stack}`);
      console.error(`Sale ID: ${detail?.sale?.id}`);
      console.error(`URI: ${localUri?.substring(0, 60)}...`);
      
      Alert.alert('Error', `No se pudo guardar el comprobante: ${error.message}`);
    } finally {
      setAttachLoading(false);
    }
  };

  const attachFromCamera = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso requerido', 'Activa la camara para tomar una foto.');
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ allowsEditing: false, quality: 0.8 });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (asset?.uri) {
        const name = asset.fileName || getFileDisplayName(asset.uri);
        await persistProof(asset.uri, name);
      }
    } catch (error) {
      console.warn('attachFromCamera error', error);
      Alert.alert('Error', 'No se pudo usar la camara.');
    }
  };

  const attachFromLibrary = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert('Permiso requerido', 'Activa el acceso a la galería.');
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({ allowsEditing: false, quality: 0.8 });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (asset?.uri) {
        const name = asset.fileName || getFileDisplayName(asset.uri);
        await persistProof(asset.uri, name);
      }
    } catch (error) {
      console.warn('attachFromLibrary error', error);
      Alert.alert('Error', 'No se pudo abrir la galeria.');
    }
  };

  const attachFromFile = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        copyToCacheDirectory: true,
        multiple: false,
      });

      if (result.type === 'cancel' || result.canceled) return;

      const asset = Array.isArray(result.assets) && result.assets.length ? result.assets[0] : result;
      const localUri = asset?.fileCopyUri || asset?.uri;
      if (!localUri) {
        Alert.alert('Error', 'No se pudo acceder al archivo seleccionado.');
        return;
      }
      const name = asset?.name || getFileDisplayName(localUri);
      await persistProof(localUri, name);
    } catch (error) {
      console.warn('attachFromFile error', error);
      Alert.alert('Error', 'No se pudo adjuntar el archivo.');
    }
  };

  const hasImageProof = (uri) => /\.(png|jpg|jpeg|heic|heif|webp)$/i.test(String(uri || ''));

  const doExportCSV = async () => {
    try {
      const csv = await exportSalesCSV(dStart.getTime(), dEnd.getTime());
      const fname = `ventas_${dStart.getTime()}_${dEnd.getTime()}.csv`;
      const path = FileSystem.cacheDirectory + fname;
      await FileSystem.writeAsStringAsync(path, csv, { encoding: FileSystem.EncodingType.UTF8 });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv', dialogTitle: 'Exportar ventas CSV' });
      } else {
        Alert.alert('Exportado', `Archivo guardado en cache:\n${path}`);
      }
    } catch { Alert.alert('Error', 'No se pudo exportar CSV.'); }
  };

  const doVoid = async () => {
    if (!detail?.sale?.id) return;
    Alert.alert('Anular venta', 'Esto repondrá el stock. ¿Confirmas?', [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Anular', style: 'destructive', onPress: async () => {
          try {
            setLoading(true);
            await voidSale(detail.sale.id);
            setDetailOpen(false);
            setProofPreview(null);
            const rows = await listSalesBetween(dStart.getTime(), dEnd.getTime());
            setSales(rows);
            Alert.alert('Listo', 'Venta anulada y stock repuesto.');
          } catch { Alert.alert('Error', 'No se pudo anular.'); }
          finally { setLoading(false); }
        }
      }
    ]);
  };

  const renderSale = ({ item }) => {
    const missingProof =
      String(item.payment_method || '').toLowerCase() === 'transferencia' &&
      !item.transfer_receipt_uri;
    return (
      <TouchableOpacity
        style={[styles.saleRow, missingProof && styles.saleRowMissing]}
        onPress={() => openDetail(item.id)}
      >
        <View style={{ flex: 1 }}>
          <Text style={styles.saleTitle}>
            ${Number(item.total).toFixed(0)} - {item.payment_method || '-'} {item.transfer_receipt_uri ? '[comprobante]' : ''}
          </Text>
          <Text style={styles.saleSub}>{fmt(item.ts)}</Text>
          {missingProof && (
            <Text style={styles.saleWarning}>Falta comprobante de transferencia</Text>
          )}
        </View>
        <Text style={styles.saleGo}>{'>'}</Text>
      </TouchableOpacity>
    );
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, flex: 1 }}>
        {/* Filtros rápidos */}
        <View style={styles.rowWrap}>
          {['today', 'week', 'month', 'custom'].map(k => (
            <TouchableOpacity key={k} style={[styles.pill, rangeType === k && styles.pillActive]} onPress={() => setRangeType(k)}>
              <Text style={{ color: rangeType === k ? '#fff' : '#333' }}>
                {k === 'today' ? 'Hoy' : k === 'week' ? 'Semana' : k === 'month' ? 'Mes' : 'Rango'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Rango personalizado */}
        {rangeType === 'custom' && (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <TouchableOpacity onPress={() => setPickStart(true)} style={styles.dateBtn}><Text>Desde: {startOfDay(dStart).toLocaleDateString()}</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => setPickEnd(true)} style={styles.dateBtn}><Text>Hasta: {endOfDay(dEnd).toLocaleDateString()}</Text></TouchableOpacity>
          </View>
        )}
        {pickStart && <DateTimePicker value={dStart} mode="date" display="default" onChange={(_, sel) => { setPickStart(false); if (sel) setDStart(startOfDay(sel)); }} />}
        {pickEnd && <DateTimePicker value={dEnd} mode="date" display="default" onChange={(_, sel) => { setPickEnd(false); if (sel) setDEnd(endOfDay(sel)); }} />}

        {/* Filtro por método */}
        <View style={styles.rowWrap}>
          {PMETHODS.map(m => (
            <TouchableOpacity key={m} style={[styles.chip, methods.has(m) && styles.chipOn]} onPress={() => toggleMethod(m)}>
              <Text style={{ color: methods.has(m) ? '#fff' : '#333' }}>{m}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.clearBtn} onPress={() => setMethods(new Set())}><Text>Limpiar</Text></TouchableOpacity>
        </View>

        {/* Resumen */}
        <View style={styles.card}>
          <Text style={styles.kpi}>Total: ${summary.total.toFixed(0)}</Text>
          <Text>Ventas: {summary.count} · Ticket prom.: ${summary.avg.toFixed(0)}</Text>
          <View style={{ height: 6 }} />
          <Text style={{ fontWeight: '600' }}>Por método:</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
            {Object.entries(summary.byMethod).map(([k, v]) => (
              <View key={k} style={styles.chipMini}><Text>{k}: ${v.toFixed(0)}</Text></View>
            ))}
            {!Object.keys(summary.byMethod).length && <Text style={{ color: '#888' }}>—</Text>}
          </View>
        </View>

        {/* Lista */}
        {loading ? <ActivityIndicator /> : (
          <FlatList
            data={filtered}
            keyExtractor={(it) => String(it.id)}
            renderItem={renderSale}
            ListEmptyComponent={<Text style={{ color: '#888' }}>No hay ventas en este rango.</Text>}
            style={{ flex: 1 }}
            contentContainerStyle={{ paddingBottom: 10 }}
          />
        )}

        {/* Acciones */}
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, marginBottom: 12 }}>
          <View style={{ flex: 1 }}><Button title="Exportar CSV" onPress={doExportCSV} /></View>
          <View style={{ width: 8 }} />
          <View style={{ flex: 1 }}><Button title="Cerrar" color="#666" onPress={onClose} /></View>
        </View>
      </View>

      {/* Detalle */}
      <Modal visible={detailOpen} animationType="slide" onRequestClose={() => { setDetailOpen(false); setProofPreview(null); }}>
        <SafeAreaView style={{ flex: 1, backgroundColor: '#fff', padding: 16 }}>
          <Text style={styles.title}>Detalle de venta</Text>
          {detail ? (
            <>
              <Text style={{ marginBottom: 6 }}>
                {fmt(detail.sale.ts)} · {detail.sale.payment_method || '—'} · Total: ${Number(detail.sale.total).toFixed(0)}
              </Text>
              <FlatList
                data={detail.items}
                keyExtractor={(it) => String(it.id)}
                renderItem={({ item }) => (
                  <View style={styles.itemRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontWeight: '600' }}>{item.name || item.barcode}</Text>
                      <Text style={{ color: '#555' }}>{item.barcode}</Text>
                    </View>
                    <Text>${Number(item.unit_price).toFixed(0)} × {item.qty} = ${Number(item.subtotal).toFixed(0)}</Text>
                  </View>
                )}
                ListEmptyComponent={<Text style={{ color: '#888' }}>Sin ítems</Text>}
              />
              {detail.sale.payment_method === 'transferencia' && (
                <View style={styles.attachCard}>
                  <Text style={styles.attachTitle}>
                    {detail.sale.transfer_receipt_uri ? 'Actualizar comprobante' : 'Adjuntar comprobante'}
                  </Text>
                  <View style={styles.attachActions}>
                    <TouchableOpacity
                      style={styles.attachBtn}
                      onPress={attachFromCamera}
                      disabled={attachLoading}
                    >
                      <Text style={styles.attachBtnText}>Camara</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.attachBtn}
                      onPress={attachFromLibrary}
                      disabled={attachLoading}
                    >
                      <Text style={styles.attachBtnText}>Galeria</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.attachBtn}
                      onPress={attachFromFile}
                      disabled={attachLoading}
                    >
                      <Text style={styles.attachBtnText}>Archivo</Text>
                    </TouchableOpacity>
                  </View>
                  {!detail.sale.transfer_receipt_uri && !attachLoading && (
                    <Text style={styles.attachWarning}>Todavia no se ha cargado un comprobante.</Text>
                  )}
                  {attachLoading && <ActivityIndicator style={{ marginTop: 8 }} />}
                </View>
              )}
              {detail.sale.transfer_receipt_uri && (
                <View style={styles.proofCard}>
                  <Text style={{ fontWeight: '700', marginBottom: 6 }}>Comprobante adjunto</Text>
                  {detail.sale.transfer_receipt_name ? (
                    <Text style={styles.proofName}>{detail.sale.transfer_receipt_name}</Text>
                  ) : null}
                  {hasImageProof(detail.sale.transfer_receipt_uri) ? (
                    <TouchableOpacity onPress={() => setProofPreview(detail.sale.transfer_receipt_uri)}>
                      <Image source={{ uri: detail.sale.transfer_receipt_uri }} style={styles.proofImage} />
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.proofPlaceholder}><Text style={{ fontSize: 18 }}>📄</Text></View>
                  )}
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity style={styles.proofBtn} onPress={() => shareProof(detail.sale.transfer_receipt_uri)}>
                      <Text style={styles.proofBtnTxt}>Compartir</Text>
                    </TouchableOpacity>
                    {hasImageProof(detail.sale.transfer_receipt_uri) && (
                      <TouchableOpacity style={styles.proofBtn} onPress={() => setProofPreview(detail.sale.transfer_receipt_uri)}>
                        <Text style={styles.proofBtnTxt}>Ver grande</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </View>
              )}
              <View style={{ height: 8 }} />
              <Button title="Anular venta (reponer stock)" color={theme.colors.danger} onPress={doVoid} />
              <View style={{ height: 8 }} />
              <Button title="Cerrar" onPress={() => { setDetailOpen(false); setProofPreview(null); }} />
            </>
          ) : <ActivityIndicator />}
        </SafeAreaView>
      </Modal>

      <Modal visible={!!proofPreview} transparent animationType="fade" onRequestClose={() => setProofPreview(null)}>
        <View style={styles.previewBg}>
          <TouchableOpacity
            style={styles.previewClose}
            onPress={() => setProofPreview(null)}
          >
            <Text style={styles.previewCloseText}>✕ Cerrar</Text>
          </TouchableOpacity>
          {proofPreview && (
            <Image
              source={{ uri: proofPreview }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 18, fontWeight: '700', marginBottom: 10 },
  rowWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  pill: { borderWidth: 1, borderColor: '#ccc', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  pillActive: { backgroundColor: '#111', borderColor: '#111' },
  dateBtn: { borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 8, backgroundColor: '#fff' },
  card: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 12, backgroundColor: '#fafafa', marginBottom: 8 },
  kpi: { fontWeight: '800', fontSize: 16 },
  chip: { borderWidth: 1, borderColor: '#ccc', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: '#fff' },
  chipOn: { backgroundColor: '#111', borderColor: '#111' },
  chipMini: { borderWidth: 1, borderColor: '#eee', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, backgroundColor: '#fff' },
  saleRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#eee', backgroundColor: '#fff' },
  saleRowMissing: { backgroundColor: '#fff4f4', borderColor: '#f4b4bf' },
  saleTitle: { fontWeight: '700' },
  saleSub: { color: '#666' },
  saleWarning: { color: '#b00020', fontWeight: '600', marginTop: 4 },
  saleGo: { fontSize: 22, color: '#999', marginLeft: 8 },
  itemRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' },
  clearBtn: { borderWidth: 1, borderColor: '#e6e6e6', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: '#fff' },
  attachCard: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 12, backgroundColor: '#fff', marginTop: 12, gap: 8 },
  attachTitle: { fontWeight: '700', color: '#333' },
  attachActions: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  attachBtn: { borderWidth: 1, borderColor: '#d8e7ff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#eef6ff' },
  attachBtnText: { color: theme.colors.primary, fontWeight: '600' },
  attachWarning: { color: '#b00020', fontWeight: '600', marginTop: 4 },
  proofCard: { borderWidth: 1, borderColor: '#eee', borderRadius: 12, padding: 12, backgroundColor: '#fafafa', marginTop: 12, alignItems: 'flex-start', gap: 8 },
  proofName: { fontWeight: '600', color: '#333' },
  proofImage: { width: 120, height: 120, borderRadius: 12 },
  proofPlaceholder: { width: 120, height: 120, borderRadius: 12, backgroundColor: '#eef1ff', alignItems: 'center', justifyContent: 'center' },
  proofBtn: { borderWidth: 1, borderColor: '#ddd', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6, backgroundColor: '#fff' },
  proofBtnTxt: { fontWeight: '600', color: theme.colors.primary },
  previewBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  previewClose: { position: 'absolute', top: 40, right: 20, backgroundColor: 'rgba(255,255,255,0.9)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, zIndex: 10 },
  previewCloseText: { color: '#000', fontWeight: '700', fontSize: 16 },
  previewImage: { width: '100%', height: '80%' },
});



