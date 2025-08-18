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
  const [forceAlt, setForceAlt] = useState(false);
  const [timeoutFired, setTimeoutFired] = useState(false);
  const cameraRef = useRef(null);

  // Delay mount to avoid crashes on some older devices
  useEffect(() => {
    const t = setTimeout(() => setMountCamera(true), 150);
    // Si en 2500ms no está lista la cámara, damos opción de fallback
    const failT = setTimeout(() => {
      if (initializing) {
        setTimeoutFired(true);
      }
    }, 2500);
    return () => clearTimeout(t);
    return () => clearTimeout(failT);
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

  if (mountError || forceAlt) {
    return (
      <View style={styles.center}>
        {mountError && <>
          <Text style={{ textAlign: 'center', marginBottom: 10 }}>Error iniciando cámara:</Text>
          <Text style={{ color: 'red', textAlign: 'center', marginBottom: 20 }}>{String(mountError.message || mountError)}</Text>
        </>}
        {!mountError && <Text style={{ textAlign: 'center', marginBottom: 12 }}>Modo alternativo de escaneo</Text>}
        {mountError && <Button title="Reintentar cámara" onPress={() => { setMountError(null); setForceAlt(false); setMountCamera(false); setTimeout(()=>setMountCamera(true),150); }} />}
        <View style={{ width: '100%', flex: 1 }}>
          <BarCodeScanner
            onBarCodeScanned={scanned ? undefined : (res) => handleBarCodeScanned({ type: res.type, data: res.data })}
            style={{ flex: 1 }}
          />
        </View>
        <Button title="Cerrar" onPress={onClose} />
        {!mountError && <Button title={scanned ? 'Escanear otro' : 'Reiniciar'} onPress={() => setScanned(false)} />}
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
        {timeoutFired && !scanned && initializing && (
          <Button title="Usar modo alternativo" onPress={() => setForceAlt(true)} />
        )}
        {scanned && <Button title="Escanear otro" onPress={() => { setScanned(false); }} />}
        <Button title="Cerrar" onPress={onClose} />
        {!forceAlt && !mountError && (
          <Button title="Forzar modo alternativo" onPress={() => setForceAlt(true)} />
        )}
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
