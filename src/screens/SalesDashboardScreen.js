// src/screens/SalesDashboardScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, SafeAreaView, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, Button, Alert } from 'react-native';
import { getSalesSeries } from '../db';

function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function addMonths(d,n){ const x=new Date(d); x.setMonth(x.getMonth()+n); return x; }

export default function SalesDashboardScreen({ onClose }){
  const [mode, setMode] = useState('7d'); // '7d' | '30d' | '12m'
  const [loading, setLoading] = useState(false);
  const [series, setSeries] = useState([]); // [{bucket,total,n}]

  const range = useMemo(()=>{
    const now = new Date();
    if (mode==='7d'){ const to=addDays(startOfDay(now),1)-1; const from=addDays(startOfDay(now),-6).getTime(); return { from, to, gran:'day' }; }
    if (mode==='30d'){ const to=addDays(startOfDay(now),1)-1; const from=addDays(startOfDay(now),-29).getTime(); return { from, to, gran:'day' }; }
    // 12 meses
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const from = addMonths(first, -11).getTime();
    const to = addDays(addMonths(first,1), -1).getTime();
    return { from, to, gran:'month' };
  }, [mode]);

  useEffect(()=>{
    (async ()=>{
      try{
        setLoading(true);
        const rows = await getSalesSeries(range.from, range.to, range.gran);
        setSeries(rows);
      }catch(e){ Alert.alert('Error','No se pudo cargar el dashboard.'); }
      finally{ setLoading(false); }
    })();
  }, [range.from, range.to, range.gran]);

  const max = Math.max(1, ...series.map(r => Number(r.total||0)));
  return (
    <SafeAreaView style={{ flex:1, backgroundColor:'#fff' }}>
      <View style={{ padding:16, flex:1 }}>
        <Text style={styles.title}>Dashboard de Ventas</Text>

        <View style={styles.row}>
          {['7d','30d','12m'].map(k=>(
            <TouchableOpacity key={k} style={[styles.pill, mode===k && styles.pillOn]} onPress={()=>setMode(k)}>
              <Text style={{ color: mode===k?'#fff':'#333' }}>{k==='7d'?'7 días':k==='30d'?'30 días':'12 meses'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? <ActivityIndicator/> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chartWrap}>
            <View style={styles.chart}>
              {series.map((r, idx)=> {
                const h = Math.max(4, Math.round((Number(r.total||0)/max)*180));
                return (
                  <View key={idx} style={styles.barWrap}>
                    <View style={[styles.bar, { height: h }]} />
                    <Text style={styles.barLabel}>{r.bucket}</Text>
                    <Text style={styles.barVal}>${Number(r.total||0).toFixed(0)}</Text>
                  </View>
                );
              })}
              {!series.length && <Text style={{ color:'#888' }}>Sin datos</Text>}
            </View>
          </ScrollView>
        )}

        <View style={{ marginTop:8 }}>
          <Button title="Cerrar" color="#666" onPress={onClose} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  title:{ fontSize:18, fontWeight:'700', marginBottom:10 },
  row:{ flexDirection:'row', gap:8, marginBottom:8 },
  pill:{ borderWidth:1, borderColor:'#ccc', borderRadius:999, paddingHorizontal:12, paddingVertical:6, backgroundColor:'#fff' },
  pillOn:{ backgroundColor:'#111', borderColor:'#111' },
  chartWrap:{ flex:1 },
  chart:{ flexDirection:'row', alignItems:'flex-end', gap:12, paddingVertical:10, minHeight:220 },
  barWrap:{ alignItems:'center' },
  bar:{ width:18, backgroundColor:'#2a6', borderRadius:6 },
  barLabel:{ fontSize:10, color:'#555', marginTop:4 },
  barVal:{ fontSize:10, color:'#333' },
});