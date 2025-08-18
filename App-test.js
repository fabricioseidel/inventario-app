import React from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const testDB = () => {
    Alert.alert('Test', '¡La app funciona correctamente!');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>📦 Inventario App</Text>
      <Text style={styles.subtitle}>¡App funcionando correctamente!</Text>
      <Button title="Test App" onPress={testDB} />
      <StatusBar style="auto" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
});
