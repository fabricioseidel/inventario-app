// src/screens/ScannerScreen.js
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Button, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { BarCodeScanner } from 'expo-barcode-scanner';
import { logError } from '../errorLogger';
import * as Haptics from 'expo-haptics';

export default function ScannerScreen({ onClose, onScanned }) {
  const [hasPermission, setHasPermission] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanned, setScanned] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await BarCodeScanner.requestPermissionsAsync();
        setHasPermission(status === 'granted');
      } catch (e) {
        logError('scanner_permission', e);
        setHasPermission(false);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const handleBarCodeScanned = useCallback(async ({ data, type }) => {
    if (scanned) return;
    setScanned(true);
    try {
      // Feedback háptico suave
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
    onScanned && onScanned(String(data || ''));
  }, [scanned, onScanned]);

  if (Platform.OS === 'web') {
    return <View style={styles.center}><Text>No disponible en web</Text><Button title="Cerrar" onPress={onClose} /></View>;
  }
  if (loading) return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  if (hasPermission === false) return <View style={styles.center}><Text>Sin permiso de cámara</Text><Button title="Cerrar" onPress={onClose} /></View>;

  return (
    <View style={{ flex:1, backgroundColor:'black' }}>
      <BarCodeScanner
        style={StyleSheet.absoluteFillObject}
        onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
        // Puedes limitar tipos si deseas mayor precisión:
        // barCodeTypes={[BarCodeScanner.Constants.BarCodeType.ean13, BarCodeScanner.Constants.BarCodeType.ean8, BarCodeScanner.Constants.BarCodeType.code128]}
      />
      <View style={styles.targetBox} pointerEvents="none" />
      <View style={styles.overlay}>
        <Text style={styles.text}>{scanned ? 'Código escaneado' : 'Alinea el código dentro del marco'}</Text>
        {scanned && <Button title="Escanear otro" onPress={() => setScanned(false)} />}
        <Button title="Cerrar" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  overlay: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.55)', padding: 14, borderRadius: 12, gap: 10
  },
  text: { color: '#fff', textAlign: 'center', fontWeight: '600' },
  targetBox: {
    position: 'absolute',
    top: '20%',
    left: '10%',
    right: '10%',
    bottom: '30%',
    borderWidth: 2,
    borderColor: '#fff',
    borderRadius: 12,
  },
});
