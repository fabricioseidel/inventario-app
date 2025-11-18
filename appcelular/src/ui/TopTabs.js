// src/ui/TopTabs.js
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from './Theme';

export default function TopTabs({ tabs, current, onChange }) {
  return (
    <View style={styles.wrap}>
      {tabs.map(t => {
        const active = current === t.key;
        return (
          <TouchableOpacity key={t.key} style={[styles.tab, active && styles.tabActive]} onPress={() => onChange(t.key)}>
            <Text style={[styles.tabText, active && styles.tabTextActive]}>{t.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 8, borderBottomWidth: 1, borderColor: theme.colors.divider },
  tab: { flex: 1, borderWidth: 1, borderColor: theme.colors.divider, backgroundColor: '#fff', borderRadius: 999, paddingVertical: 8, alignItems: 'center' },
  tabActive: { backgroundColor: theme.colors.tabActive, borderColor: theme.colors.tabActive },
  tabText: { color: theme.colors.tabInactive, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
});
