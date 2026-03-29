// src/ui/FAB.js
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';

export default function FAB({ items = [] }) {
  const [open, setOpen] = useState(false);

  return (
    <View pointerEvents="box-none" style={styles.wrap}>
      {open && (
        <View style={styles.menu}>
          {items.map((it, idx) => (
            <TouchableOpacity
              key={idx}
              style={styles.menuItem}
              onPress={() => { setOpen(false); it.onPress && it.onPress(); }}
            >
              <Text style={styles.menuIcon}>{it.icon}</Text>
              <Text style={styles.menuText}>{it.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.btn} onPress={() => setOpen(!open)}>
        <Text style={styles.btnIcon}>{open ? '✕' : '＋'}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', right: 16, bottom: 16 + (Platform.OS === 'ios' ? 10 : 0), alignItems: 'flex-end' },
  btn: { backgroundColor: '#111', width: 58, height: 58, borderRadius: 999, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  btnIcon: { color: '#fff', fontSize: 28, marginTop: -2 },
  menu: { backgroundColor: '#fff', borderRadius: 14, paddingVertical: 8, paddingHorizontal: 8, marginBottom: 8, borderWidth: 1, borderColor: '#eee', shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 3 },
  menuItem: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8, paddingHorizontal: 8, borderRadius: 10 },
  menuIcon: { fontSize: 18 },
  menuText: { fontWeight: '700', color: '#333' },
});
