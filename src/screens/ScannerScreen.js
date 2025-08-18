// src/screens/ScannerScreen.js
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Button, StyleSheet, Platform, ActivityIndicator, Alert } from 'react-native';
import { Camera, useCameraPermissions } from 'expo-camera';
import { BarCodeScanner } from 'expo-barcode-scanner';

export default function ScannerScreen({ onClose, onScanned }) {
  let permissionHook = [];
  try {
    permissionHook = useCameraPermissions ? useCameraPermissions() : [];
  } catch (e) {
    // Si falla el hook, seguimos con fallback dinámico más abajo
    console.log('Fallo useCameraPermissions hook', e);
  }
  const [permission, requestPermission] = permissionHook;
  const [manualPermChecked, setManualPermChecked] = useState(false);
  const [scanned, setScanned] = useState(false);
  const [mountCamera, setMountCamera] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [mountError, setMountError] = useState(null);
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

  // Fallback manual si hook no disponible o sin permiso cargado
  useEffect(() => {
    (async () => {
      if (!permission && Camera?.getCameraPermissionsAsync && !manualPermChecked) {
        try {
          const perm = await Camera.getCameraPermissionsAsync();
          if (!perm.granted && Camera?.requestCameraPermissionsAsync) {
            await Camera.requestCameraPermissionsAsync();
          }
        } catch (e) {
          console.log('Fallback permisos cámara error', e);
        } finally {
          setManualPermChecked(true);
        }
      }
    })();
  }, [permission, manualPermChecked]);

  if (!permission && !manualPermChecked) {
    return (
      <View style={styles.center}>
        <Text>Comprobando permisos...</Text>
      </View>
    );
  }

  if (permission && !permission.granted) {
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

  if (mountError) {
    return (
      <View style={styles.center}>
        <Text style={{ textAlign: 'center', marginBottom: 10 }}>Error iniciando cámara:</Text>
        <Text style={{ color: 'red', textAlign: 'center', marginBottom: 20 }}>{String(mountError.message || mountError)}</Text>
        <Button title="Reintentar" onPress={() => { setMountError(null); setMountCamera(false); setTimeout(()=>setMountCamera(true),150); }} />
        <Text style={{ marginVertical: 12, fontWeight: '600' }}>Modo alternativo</Text>
        <View style={{ width: '100%', flex: 1 }}>
          <BarCodeScanner
            onBarCodeScanned={scanned ? undefined : (res) => handleBarCodeScanned({ type: res.type, data: res.data })}
            style={{ flex: 1 }}
          />
        </View>
        <Button title="Cerrar" onPress={onClose} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: 'black' }}>
      {mountCamera ? (
        <Camera
          ref={cameraRef}
          style={{ flex: 1 }}
          type={Camera.Constants.Type.back}
          onBarCodeScanned={scanned ? undefined : handleBarCodeScanned}
          onCameraReady={() => setInitializing(false)}
          onMountError={(err) => {
            console.log('Camera mount error', err);
            setMountError(err?.nativeErrorMessage || err?.message || 'Fallo desconocido');
            Alert.alert('Cámara', 'No se pudo inicializar la cámara.');
          }}
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
