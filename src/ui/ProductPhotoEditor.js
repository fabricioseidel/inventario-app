// src/ui/ProductPhotoEditor.js
import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Image, Alert, useWindowDimensions } from 'react-native';
import ViewShot from 'react-native-view-shot';
import Slider from '@react-native-community/slider';
import { theme } from './Theme';

export default function ProductPhotoEditor({ visible, sourceUri, onCancel, onSave }) {
  const captureRef = useRef(null);
  const { width } = useWindowDimensions();
  const canvasSize = Math.min(width - 48, 320);

  const [scale, setScale] = useState(1.05);
  const [offsetX, setOffsetX] = useState(0);
  const [offsetY, setOffsetY] = useState(0);

  useEffect(() => {
    if (visible) {
      setScale(1.05);
      setOffsetX(0);
      setOffsetY(0);
    }
  }, [visible, sourceUri]);

  const handleSave = async () => {
    if (!captureRef.current) return;
    try {
      const uri = await captureRef.current.capture?.();
      if (uri && onSave) {
        onSave(uri);
      }
    } catch (e) {
      console.warn('ProductPhotoEditor capture error', e);
      Alert.alert('Error', 'No se pudo procesar la imagen.');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onCancel}>
      <View style={styles.modalBg}>
        <View style={[styles.modalBox, { width: canvasSize + 40 }]}>
          <Text style={styles.title}>Editar foto</Text>
          <Text style={styles.subtitle}>Ajusta el zoom y posición para dejar un fondo blanco limpio.</Text>

          {sourceUri ? (
            <ViewShot
              ref={captureRef}
              options={{ format: 'png', quality: 1, result: 'tmpfile' }}
              style={[styles.canvas, { width: canvasSize, height: canvasSize }]}
            >
              <View style={[styles.canvasInner, { width: canvasSize, height: canvasSize }]}>
                <Image
                  source={{ uri: sourceUri }}
                  style={{ width: canvasSize, height: canvasSize, transform: [{ scale }, { translateX: offsetX }, { translateY: offsetY }] }}
                  resizeMode="contain"
                />
              </View>
            </ViewShot>
          ) : (
            <View style={[styles.canvas, { width: canvasSize, height: canvasSize, alignItems: 'center', justifyContent: 'center' }]}>
              <Text style={{ color: '#999' }}>Sin imagen seleccionada</Text>
            </View>
          )}

          <View style={styles.sliderBlock}>
            <Text style={styles.sliderLabel}>Zoom</Text>
            <Slider
              value={scale}
              onValueChange={setScale}
              minimumValue={0.6}
              maximumValue={2.4}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor="#ddd"
            />
          </View>
          <View style={styles.sliderBlock}>
            <Text style={styles.sliderLabel}>Posición horizontal</Text>
            <Slider
              value={offsetX}
              onValueChange={setOffsetX}
              minimumValue={-canvasSize / 4}
              maximumValue={canvasSize / 4}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor="#ddd"
            />
          </View>
          <View style={styles.sliderBlock}>
            <Text style={styles.sliderLabel}>Posición vertical</Text>
            <Slider
              value={offsetY}
              onValueChange={setOffsetY}
              minimumValue={-canvasSize / 4}
              maximumValue={canvasSize / 4}
              minimumTrackTintColor={theme.colors.primary}
              maximumTrackTintColor="#ddd"
            />
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={[styles.actionBtn, styles.actionGhost]} onPress={onCancel}>
              <Text style={[styles.actionTxt, { color: '#333' }]}>Cancelar</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.actionBtn, styles.actionPrimary]} onPress={handleSave}>
              <Text style={[styles.actionTxt, { color: '#fff' }]}>Guardar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalBg: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalBox: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 18,
    gap: 14,
  },
  title: { fontSize: 18, fontWeight: '700' },
  subtitle: { color: '#666' },
  canvas: {
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#eee',
    overflow: 'hidden',
    alignSelf: 'center',
  },
  canvasInner: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sliderBlock: { marginTop: 4 },
  sliderLabel: { fontSize: 12, color: '#555', marginBottom: -6 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  actionBtn: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center' },
  actionGhost: { borderWidth: 1, borderColor: '#ddd', backgroundColor: '#fff' },
  actionPrimary: { backgroundColor: theme.colors.primary },
  actionTxt: { fontWeight: '700' },
});
