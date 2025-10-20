// src/ui/Header.js
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { theme } from './Theme';

export default function Header({ title, subtitle, compact, currentUser, onLogout }) {
  return (
    <View style={[styles.wrap, compact && { paddingVertical: 10 }]}>
      <View style={styles.leftSection}>
        <Text style={styles.title}>{title}</Text>
        {!!subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
      </View>

      {currentUser && onLogout && (
        <View style={styles.rightSection}>
          <Text style={styles.userText}>{currentUser.name}</Text>
          <TouchableOpacity onPress={onLogout} style={styles.logoutButton}>
            <Text style={styles.logoutText}>Salir</Text>
          </TouchableOpacity>
        </View>
      )}
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  leftSection: {
    flex: 1,
  },
  title: { fontSize: 22, fontWeight: '800', color: theme.colors.text },
  subtitle: { marginTop: 2, color: theme.colors.textMuted },
  rightSection: {
    alignItems: 'flex-end',
  },
  userText: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  logoutButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  logoutText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
});
