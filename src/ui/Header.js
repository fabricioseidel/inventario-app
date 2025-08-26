// src/ui/Header.js
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { theme } from './Theme';

export default function Header({ title, subtitle, compact }) {
  return (
    <View style={[styles.wrap, compact && { paddingVertical: 10 }]}>
      <Text style={styles.title}>{title}</Text>
      {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderColor: theme.colors.divider,
  },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  subtitle: { marginTop: 2, color: theme.colors.textMuted },
});
