// src/screens/LogViewerScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Share,
  SafeAreaView,
} from 'react-native';
import { logManager } from '../utils/LogViewer';
import { COLORS } from '../ui/Theme';

export default function LogViewerScreen() {
  const [logs, setLogs] = useState([]);
  const [filterLevel, setFilterLevel] = useState('ALL');
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    // Cargar logs iniciales
    logManager.loadLogs().then(() => {
      setLogs(logManager.getLogs());
    });

    // Suscribirse a cambios
    const unsubscribe = logManager.subscribe((newLogs) => {
      setLogs(newLogs);
    });

    return unsubscribe;
  }, []);

  const filteredLogs = logs.filter(
    log => filterLevel === 'ALL' || log.level === filterLevel
  );

  const getLevelColor = (level) => {
    switch (level) {
      case 'ERROR':
        return '#ff4444';
      case 'WARN':
        return '#ff9800';
      case 'INFO':
        return '#2196F3';
      case 'DEBUG':
        return '#9C27B0';
      default:
        return '#666';
    }
  };

  const handleExport = async () => {
    try {
      const text = logManager.exportAsText();
      await Share.share({
        message: text,
        title: 'Logs de la App',
      });
    } catch (error) {
      Alert.alert('Error', 'No se pudo exportar los logs');
    }
  };

  const handleClearLogs = () => {
    Alert.alert(
      'Borrar Logs',
      '¿Estás seguro de que quieres borrar todos los logs?',
      [
        { text: 'Cancelar', onPress: () => {} },
        {
          text: 'Borrar',
          onPress: async () => {
            await logManager.clearLogs();
            setLogs([]);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📋 Logs de la App</Text>
        <Text style={styles.subtitle}>{filteredLogs.length} logs</Text>
      </View>

      {/* Filtros */}
      <View style={styles.filterContainer}>
        {['ALL', 'ERROR', 'WARN', 'INFO', 'DEBUG'].map(level => (
          <TouchableOpacity
            key={level}
            style={[
              styles.filterButton,
              filterLevel === level && styles.filterButtonActive,
            ]}
            onPress={() => setFilterLevel(level)}
          >
            <Text
              style={[
                styles.filterText,
                filterLevel === level && styles.filterTextActive,
              ]}
            >
              {level}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Logs */}
      <ScrollView style={styles.logsContainer}>
        {filteredLogs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No hay logs para mostrar</Text>
          </View>
        ) : (
          filteredLogs.map(log => (
            <View key={log.id} style={styles.logEntry}>
              <View style={styles.logHeader}>
                <Text
                  style={[
                    styles.logLevel,
                    { color: getLevelColor(log.level) },
                  ]}
                >
                  [{log.level}]
                </Text>
                <Text style={styles.logTime}>
                  {new Date(log.timestamp).toLocaleTimeString()}
                </Text>
              </View>
              <Text style={styles.logMessage}>{log.message}</Text>
              {log.data && (
                <View style={styles.logData}>
                  <Text style={styles.logDataText}>
                    {JSON.stringify(log.data, null, 2)}
                  </Text>
                </View>
              )}
            </View>
          ))
        )}
      </ScrollView>

      {/* Acciones */}
      <View style={styles.actionContainer}>
        <TouchableOpacity
          style={[styles.button, styles.buttonExport]}
          onPress={handleExport}
        >
          <Text style={styles.buttonText}>📤 Exportar</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.button, styles.buttonClear]}
          onPress={handleClearLogs}
        >
          <Text style={styles.buttonText}>🗑️ Limpiar</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#2c3e50',
    paddingVertical: 15,
    paddingHorizontal: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: 'white',
  },
  subtitle: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 5,
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginHorizontal: 4,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  filterButtonActive: {
    backgroundColor: '#2196F3',
    borderColor: '#2196F3',
  },
  filterText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
  },
  filterTextActive: {
    color: 'white',
  },
  logsContainer: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    color: '#999',
    fontSize: 14,
  },
  logEntry: {
    backgroundColor: 'white',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  logLevel: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  logTime: {
    fontSize: 11,
    color: '#999',
  },
  logMessage: {
    fontSize: 13,
    color: '#333',
    lineHeight: 18,
    marginBottom: 4,
  },
  logData: {
    backgroundColor: '#f9f9f9',
    borderRadius: 4,
    padding: 8,
    marginTop: 4,
    borderLeftWidth: 2,
    borderLeftColor: '#ccc',
  },
  logDataText: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
  },
  actionContainer: {
    flexDirection: 'row',
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginHorizontal: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  buttonExport: {
    backgroundColor: '#2196F3',
  },
  buttonClear: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: 'white',
    fontWeight: '600',
    fontSize: 14,
  },
});
