// src/screens/ScannerScreen.js
import React, { useState } from 'react';
import { View, Text, Button, StyleSheet, Platform } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';

export default function ScannerScreen({ onClose, onScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  if (Platform.OS === 'web') {
    return (
      <View style={styles.center}>
        <Text>La cámara no está disponible en Web Preview.</Text>
        <Button title="Cerrar" onPress={onClose} />
      </View>
    );
  }

  if (!permission) {
    return (
      <View style={styles.center}>
        <Text>Comprobando permisos...</Text>
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <Text>Se requiere permiso de cámara</Text>
        <Button title="Conceder permiso" onPress={requestPermission} />
        <Button title="Cerrar" onPress={onClose} />
      </View>
    );
  }

  const handleScan = (result) => {
    if (scanned) return;
    setScanned(true);
    const code = String(result?.data ?? '');
    onScanned && onScanned(code);
  };

  return (
    <View style={{ flex: 1 }}>
      <CameraView
        style={{ flex: 1 }}
        facing="back"
        onBarcodeScanned={scanned ? undefined : handleScan}
        barcodeScannerSettings={{
          barcodeTypes: ['qr','ean13','ean8','code128','code39','upc_a','upc_e'],
        }}
      />
      <View style={styles.overlay}>
        <Text style={styles.text}>{scanned ? 'Código escaneado' : 'Apunta al código de barras'}</Text>
        {scanned ? <Button title="Escanear otro" onPress={() => setScanned(false)} /> : null}
        <Button title="Cerrar" onPress={onClose} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  overlay: {
    position: 'absolute', bottom: 20, left: 20, right: 20,
    backgroundColor: 'rgba(0,0,0,0.5)', padding: 12, borderRadius: 10, gap: 8
  },
  text: { color: '#fff', textAlign: 'center', fontWeight: '600' },
});
