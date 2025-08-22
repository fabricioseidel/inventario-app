// src/screens/SalesHistoryScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View, Text, Button, FlatList, Modal, SafeAreaView,
  TouchableOpacity, StyleSheet, ActivityIndicator, Alert
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { getSaleWithItems, listSalesBetween, exportSalesCSV, voidSale } from '../db';

const PMETHODS = ['efectivo','debito','credito','transferencia'];

function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d){ const x=new Date(d); x.setHours(23,59,59,999); return x; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function addMonths(d,n){ const x=new Date(d); x.setMonth(x.getMonth()+n); return x; }
function fmt(ts){ const d=new Date(ts); const dd=String(d.getDate()).padStart(2,'0'); const mm=String(d.getMonth()+1).padStart(2,'0'); const hh=String(d.getHours()).padStart(2,'0'); const mi=String(d.getMinutes()).padStart(2,'0'); return `${dd}/${mm} ${hh}:${mi}`; }

export default function SalesHistoryScreen({ onClose }) {
  const [rangeType, setRangeType] = useState('today'); // today|week|month|custom
  const [dStart, setDStart] = useState(startOfDay(new Date()));
  const [dEnd, setDEnd] = useState(endOfDay(new Date()));
  const [pickStart, setPickStart] = useState(false);
  const [pickEnd, setPickEnd] = useState(false);

  const [loading, setLoading] = useState(false);
  const [sales, setSales] = useState([]);      // todas en rango (no anuladas)
  const [detail, setDetail] = useState(null);  // { sale, items }
  const [detailOpen, setDetailOpen] = useState(false);

  // filtros por método (selección múltiple)
  const [methods, setMethods] = useState(new Set()); // vacío = todos

  useEffect(()=> {
    const today=new Date();
    if (rangeType==='today'){ setDStart(startOfDay(today)); setDEnd(endOfDay(today)); }
    else if (rangeType==='week'){
      const day=today.getDay(); const diff=(day+6)%7;
      const mon = startOfDay(addDays(today,-diff));
      setDStart(mon); setDEnd(endOfDay(addDays(mon,6)));
    } else if (rangeType==='month'){
      const first=new Date(today.getFullYear(), today.getMonth(), 1);
      setDStart(startOfDay(first)); setDEnd(endOfDay(addDays(addMonths(first,1),-1)));
    }
  }, [rangeType]);

  useEffect(()=> {
    (async ()=>{
      try {
        setLoading(true);
        const rows = await listSalesBetween(dStart.getTime(), dEnd.getTime());
        setSales(rows);
      } catch { Alert.alert('Error','No se pudo cargar el historial.'); }
      finally { setLoading(false); }
    })();
  }, [dStart, dEnd]);

  const filtered = useMemo(()=>{
    if (!methods.size) return sales;
    return sales.filter(s => methods.has(s.payment_method||''));
  }, [sales, methods]);

  const summary = useMemo(()=> {
    const total = filtered.reduce((a,s)=>a+Number(s.total||0),0);
    const count = filtered.length;
    const avg = count? total/count : 0;
    const byMethod = {};
    for (const s of filtered){
      const k = s.payment_method || 'desconocido';
      byMethod[k] = (byMethod[k]||0) + Number(s.total||0);
    }
    return { total, count, avg, byMethod };
  }, [filtered]);

  const toggleMethod = (m)=> {
    setMethods(prev=>{
      const n = new Set(prev);
      if (n.has(m)) n.delete(m); else n.add(m);
      return n;
    });
  };

  const openDetail = async (saleId) => {
    try {
      setLoading(true);
      const data = await getSaleWithItems(saleId);
      setDetail(data);
      setDetailOpen(true);
    } catch { Alert.alert('Error', 'No se pudo cargar el detalle.'); }
    finally { setLoading(false); }
  };

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
    } catch { Alert.alert('Error','No se pudo exportar CSV.'); }
  };

  const doVoid = async () => {
    if (!detail?.sale?.id) return;
    Alert.alert('Anular venta','Esto repondrá el stock. ¿Confirmas?',[
      { text:'Cancelar', style:'cancel' },
      { text:'Anular', style:'destructive', onPress: async ()=>{
        try {
          setLoading(true);
          await voidSale(detail.sale.id);
          setDetailOpen(false);
          // recargar
          const rows = await listSalesBetween(dStart.getTime(), dEnd.getTime());
          setSales(rows);
          Alert.alert('Listo','Venta anulada y stock repuesto.');
        } catch { Alert.alert('Error','No se pudo anular.'); }
        finally { setLoading(false); }
      } }
    ]);
  };

  const renderSale = ({ item }) => (
    <TouchableOpacity style={styles.saleRow} onPress={() => openDetail(item.id)}>
      <View style={{ flex: 1 }}>
        <Text style={styles.saleTitle}>${Number(item.total).toFixed(0)} · {item.payment_method || '—'}</Text>
        <Text style={styles.saleSub}>{fmt(item.ts)}</Text>
      </View>
      <Text style={styles.saleGo}>›</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:'#fff' }}>
      <View style={{ padding:16, flex:1 }}>
        <Text style={styles.title}>Historial y Reportes</Text>

        {/* Filtros rápidos */}
        <View style={styles.rowWrap}>
          {['today','week','month','custom'].map(k=>(
            <TouchableOpacity key={k} style={[styles.pill, rangeType===k && styles.pillActive]} onPress={()=>setRangeType(k)}>
              <Text style={{ color: rangeType===k ? '#fff' : '#333' }}>
                {k==='today'?'Hoy':k==='week'?'Semana':k==='month'?'Mes':'Rango'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Rango personalizado */}
        {rangeType==='custom' && (
          <View style={{ flexDirection:'row', alignItems:'center', gap:8, marginBottom:8 }}>
            <TouchableOpacity onPress={()=>setPickStart(true)} style={styles.dateBtn}><Text>Desde: {startOfDay(dStart).toLocaleDateString()}</Text></TouchableOpacity>
            <TouchableOpacity onPress={()=>setPickEnd(true)} style={styles.dateBtn}><Text>Hasta: {endOfDay(dEnd).toLocaleDateString()}</Text></TouchableOpacity>
          </View>
        )}
        {pickStart && <DateTimePicker value={dStart} mode="date" display="default" onChange={(_,sel)=>{ setPickStart(false); if(sel) setDStart(startOfDay(sel)); }} />}
        {pickEnd && <DateTimePicker value={dEnd} mode="date" display="default" onChange={(_,sel)=>{ setPickEnd(false); if(sel) setDEnd(endOfDay(sel)); }} />}

        {/* Filtro por método */}
        <View style={styles.rowWrap}>
          {PMETHODS.map(m=>(
            <TouchableOpacity key={m} style={[styles.chip, methods.has(m) && styles.chipOn]} onPress={()=>toggleMethod(m)}>
              <Text style={{ color: methods.has(m)?'#fff':'#333' }}>{m}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity style={styles.clearBtn} onPress={()=>setMethods(new Set())}><Text>Limpiar</Text></TouchableOpacity>
        </View>

        {/* Resumen */}
        <View style={styles.card}>
          <Text style={styles.kpi}>Total: ${summary.total.toFixed(0)}</Text>
          <Text>Ventas: {summary.count} · Ticket prom.: ${summary.avg.toFixed(0)}</Text>
          <View style={{ height:6 }} />
          <Text style={{ fontWeight:'600' }}>Por método:</Text>
          <View style={{ flexDirection:'row', flexWrap:'wrap', gap:6, marginTop:4 }}>
            {Object.entries(summary.byMethod).map(([k,v]) => (
              <View key={k} style={styles.chipMini}><Text>{k}: ${v.toFixed(0)}</Text></View>
            ))}
            {!Object.keys(summary.byMethod).length && <Text style={{ color:'#888' }}>—</Text>}
          </View>
        </View>

        {/* Lista */}
        {loading ? <ActivityIndicator /> : (
          <FlatList
            data={filtered}
            keyExtractor={(it) => String(it.id)}
            renderItem={renderSale}
            ListEmptyComponent={<Text style={{ color:'#888' }}>No hay ventas en este rango.</Text>}
            style={{ flex:1 }}
          />
        )}

        {/* Acciones */}
        <View style={{ flexDirection:'row', gap:8, marginTop:8 }}>
          <Button title="Exportar CSV" onPress={doExportCSV} />
          <Button title="Cerrar" color="#666" onPress={onClose} />
        </View>
      </View>

      {/* Detalle */}
      <Modal visible={detailOpen} animationType="slide" onRequestClose={()=>setDetailOpen(false)}>
        <SafeAreaView style={{ flex:1, backgroundColor:'#fff', padding:16 }}>
          <Text style={styles.title}>Detalle de venta</Text>
          {detail ? (
            <>
              <Text style={{ marginBottom:6 }}>
                {fmt(detail.sale.ts)} · {detail.sale.payment_method || '—'} · Total: ${Number(detail.sale.total).toFixed(0)}
              </Text>
              <FlatList
                data={detail.items}
                keyExtractor={(it) => String(it.id)}
                renderItem={({ item }) => (
                  <View style={styles.itemRow}>
                    <View style={{ flex:1 }}>
                      <Text style={{ fontWeight:'600' }}>{item.name || item.barcode}</Text>
                      <Text style={{ color:'#555' }}>{item.barcode}</Text>
                    </View>
                    <Text>${Number(item.unit_price).toFixed(0)} × {item.qty} = ${Number(item.subtotal).toFixed(0)}</Text>
                  </View>
                )}
                ListEmptyComponent={<Text style={{ color:'#888' }}>Sin ítems</Text>}
              />
              <View style={{ height:8 }} />
              <Button title="Anular venta (reponer stock)" color="#b00020" onPress={doVoid} />
              <View style={{ height:8 }} />
              <Button title="Cerrar" onPress={()=>setDetailOpen(false)} />
            </>
          ) : <ActivityIndicator/>}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title:{ fontSize:18, fontWeight:'700', marginBottom:10 },
  rowWrap:{ flexDirection:'row', flexWrap:'wrap', gap:8, marginBottom:8 },
  pill:{ borderWidth:1, borderColor:'#ccc', borderRadius:999, paddingHorizontal:12, paddingVertical:6, backgroundColor:'#fff' },
  pillActive:{ backgroundColor:'#111', borderColor:'#111' },
  dateBtn:{ borderWidth:1, borderColor:'#ddd', padding:8, borderRadius:8, backgroundColor:'#fff' },
  card:{ borderWidth:1, borderColor:'#eee', borderRadius:12, padding:12, backgroundColor:'#fafafa', marginBottom:8 },
  kpi:{ fontWeight:'800', fontSize:16 },
  chip:{ borderWidth:1, borderColor:'#ccc', borderRadius:999, paddingHorizontal:10, paddingVertical:6, backgroundColor:'#fff' },
  chipOn:{ backgroundColor:'#111', borderColor:'#111' },
  chipMini:{ borderWidth:1, borderColor:'#eee', borderRadius:999, paddingHorizontal:10, paddingVertical:4, backgroundColor:'#fff' },
  saleRow:{ flexDirection:'row', alignItems:'center', paddingVertical:10, borderBottomWidth:1, borderColor:'#eee' },
  saleTitle:{ fontWeight:'700' },
  saleSub:{ color:'#666' },
  saleGo:{ fontSize:22, color:'#999', marginLeft:8 },
  itemRow:{ flexDirection:'row', alignItems:'center', justifyContent:'space-between', paddingVertical:8, borderBottomWidth:1, borderColor:'#eee' },
});