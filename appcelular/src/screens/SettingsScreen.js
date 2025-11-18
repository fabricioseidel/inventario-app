
import React from 'react';
import { View, Button, StyleSheet, Alert } from 'react-native';
import { useCustomTheme } from '../ui/Theme';
import { backupDatabase, restoreDatabase } from '../export';

const SettingsScreen = () => {
  const { theme } = useCustomTheme();

  const handleBackup = async () => {
    try {
      await backupDatabase();
    } catch (error) {
      Alert.alert('Error', 'No se pudo completar la copia de seguridad.');
    }
  };

  const handleRestore = async () => {
    try {
      await restoreDatabase();
    } catch (error) {
      Alert.alert('Error', 'No se pudo completar la restauración.');
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.buttonContainer}>
        <Button
          title="Hacer copia de seguridad"
          onPress={handleBackup}
          color={theme.colors.primary}
        />
      </View>
      <View style={styles.buttonContainer}>
        <Button
          title="Restaurar copia de seguridad"
          onPress={handleRestore}
          color={theme.colors.primary}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  buttonContainer: {
    marginVertical: 10,
    width: '80%',
    borderRadius: 8,
    overflow: 'hidden',
  },
});

export default SettingsScreen;
