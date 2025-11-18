// src/screens/SalesDashboardScreen.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  SafeAreaView,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Button,
  Alert,
  useWindowDimensions,
} from 'react-native';
import { LineChart } from 'react-native-chart-kit';
import { getSalesSeries } from '../db';

function startOfDay(d){ const x=new Date(d); x.setHours(0,0,0,0); return x; }
function addDays(d,n){ const x=new Date(d); x.setDate(x.getDate()+n); return x; }
function addMonths(d,n){ const x=new Date(d); x.setMonth(x.getMonth()+n); return x; }

export default function SalesDashboardScreen({ onClose, refreshKey }){
  const [mode, setMode] = useState('7d'); // '7d' | '30d' | '12m'
  const [loading, setLoading] = useState(false);
  const [series, setSeries] = useState([]);
  const [activePoint, setActivePoint] = useState(null);

  const { width } = useWindowDimensions();

  const range = useMemo(()=>{
    const now = new Date();
    if (mode==='7d'){ const to=addDays(startOfDay(now),1)-1; const from=addDays(startOfDay(now),-6).getTime(); return { from, to, gran:'day' }; }
    if (mode==='30d'){ const to=addDays(startOfDay(now),1)-1; const from=addDays(startOfDay(now),-29).getTime(); return { from,to, gran:'day' }; }
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
        setActivePoint(null);
      }catch(e){ Alert.alert('Error','No se pudo cargar el dashboard.'); }
      finally{ setLoading(false); }
    })();
  }, [range.from, range.to, range.gran, refreshKey]);

  const chartData = useMemo(() => {
    const labels = series.map((r) => {
      if (range.gran === 'month') return r.bucket;
      return String(r.bucket).slice(5);
    });
    const data = series.map((r) => Number(r.total || 0));
    return {
      labels,
      datasets: [
        {
          data,
          color: () => '#2a6cc5',
          strokeWidth: 3,
        },
      ],
    };
  }, [series, range.gran]);

  const stats = useMemo(() => {
    if (!series.length) return { total: 0, avg: 0, best: 0 };
    const total = series.reduce((sum, item) => sum + Number(item.total || 0), 0);
    const best = Math.max(...series.map((item) => Number(item.total || 0)));
    const avg = total / series.length;
    return { total, avg, best };
  }, [series]);

  const chartWidth = Math.max(width - 32, Math.max(series.length * 70, width * 0.9));
  const chartConfig = useMemo(() => ({
    backgroundColor: '#fff',
    backgroundGradientFrom: '#f4f7ff',
    backgroundGradientTo: '#ecf2ff',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(33, 111, 237, ${opacity})`,
    labelColor: (opacity = 1) => `rgba(80, 80, 80, ${opacity})`,
    propsForDots: { r: '5', strokeWidth: '2', stroke: '#ffffff' },
    propsForBackgroundLines: { strokeDasharray: '', stroke: '#dfe6ff' },
  }), []);

  return (
    <SafeAreaView style={{ flex:1, backgroundColor:'#fff' }}>
      <View style={{ padding:16, flex:1 }}>
        <View style={styles.row}>
          {['7d','30d','12m'].map(k=>(
            <TouchableOpacity key={k} style={[styles.pill, mode===k && styles.pillOn]} onPress={()=>setMode(k)}>
              <Text style={{ color: mode===k?'#fff':'#333' }}>{k==='7d'?'7 días':k==='30d'?'30 días':'12 meses'}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator />
        ) : (
          <View style={styles.chartCard}>
            {series.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <LineChart
                  data={chartData}
                  width={chartWidth}
                  height={220}
                  chartConfig={chartConfig}
                  bezier
                  fromZero
                  style={styles.chart}
                  segments={4}
                  onDataPointClick={({ value, index }) => {
                    const bucket = series[index];
                    setActivePoint({ value, bucket });
                  }}
                />
              </ScrollView>
            ) : (
              <Text style={{ color:'#888', textAlign:'center', paddingVertical:20 }}>Sin datos en el rango seleccionado.</Text>
            )}
          </View>
        )}

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>Resumen</Text>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryValue}>${stats.total.toFixed(0)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Promedio</Text>
              <Text style={styles.summaryValue}>${stats.avg.toFixed(0)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Mejor jornada</Text>
              <Text style={styles.summaryValue}>${stats.best.toFixed(0)}</Text>
            </View>
          </View>
          {activePoint && (
            <View style={styles.highlight}>
              <Text style={{ fontWeight:'700' }}>{activePoint.bucket?.bucket}</Text>
              <Text style={{ color:'#555' }}>Total: ${Number(activePoint.value).toFixed(0)}</Text>
            </View>
          )}
        </View>

        <View style={{ marginTop:8 }}>
          <Button title="Cerrar" color="#666" onPress={onClose} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  row:{ flexDirection:'row', gap:8, marginBottom:8 },
  pill:{ borderWidth:1, borderColor:'#ccc', borderRadius:999, paddingHorizontal:12, paddingVertical:6, backgroundColor:'#fff' },
  pillOn:{ backgroundColor:'#111', borderColor:'#111' },
  chartCard:{ borderWidth:1, borderColor:'#e2e6f5', borderRadius:16, padding:12, backgroundColor:'#fff', minHeight:240, marginBottom:12 },
  chart:{ borderRadius:12 },
  summaryCard:{ borderWidth:1, borderColor:'#e6e6e6', borderRadius:16, padding:16, backgroundColor:'#fafafa', gap:12 },
  summaryTitle:{ fontSize:16, fontWeight:'700' },
  summaryRow:{ flexDirection:'row', gap:12 },
  summaryItem:{ flex:1, borderRadius:12, backgroundColor:'#fff', padding:12, borderWidth:1, borderColor:'#eee' },
  summaryLabel:{ color:'#666', fontSize:12 },
  summaryValue:{ fontWeight:'700', fontSize:16 },
  highlight:{ borderRadius:12, borderWidth:1, borderColor:'#d6e4ff', backgroundColor:'#eef3ff', padding:12 },
});
