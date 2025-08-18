// src/screens/ScannerScreen.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Button, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { Camera, useCameraPermissions } from 'expo-camera';

export default function ScannerScreen({ onClose, onScanned }) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [mountCamera, setMountCamera] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const cameraRef = useRef(null);

  // Delay mount to avoid crashes on some older devices
  useEffect(() => {
    const t = setTimeout(() => setMountCamera(true), 150);
    return () => clearTimeout(t);
  }, []);

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

  const handleBarCodeScanned = useCallback(({ type, data }) => {
    if (scanned) return;
    setScanned(true);
    onScanned && onScanned(String(data || ''));
  }, [scanned, onScanned]);

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      {mountCamera ? (
        <Camera
          ref={cameraRef}
          style={{ flex: 1 }}
          type={Camera.Constants.Type.back}
          ratio="16:9"
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          onCameraReady={() => setInitializing(false)}
          barCodeScannerSettings={{
            barCodeTypes: [
              Camera.Constants.BarCodeType.qr,
              Camera.Constants.BarCodeType.ean13,
              Camera.Constants.BarCodeType.ean8,
              Camera.Constants.BarCodeType.code128,
              Camera.Constants.BarCodeType.code39,
              Camera.Constants.BarCodeType.upc_a,
              Camera.Constants.BarCodeType.upc_e,
            ].filter(Boolean),
          }}
        />
      ) : (
        <View style={styles.center}><ActivityIndicator size="large" color="#fff" /></View>
      )}
      <View style={styles.overlay}>
        <Text style={styles.text}>
          {initializing ? 'Inicializando cámara...' : (scanned ? 'Código escaneado' : 'Apunta al código de barras')}
        </Text>
        {scanned && <Button title="Escanear otro" onPress={() => { setScanned(false); }} />}
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
});
