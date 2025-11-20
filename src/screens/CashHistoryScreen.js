import React, { useState, useEffect } from 'react';
import { View, Text, FlatList, ActivityIndicator, Alert, TouchableOpacity } from 'react-native';
import { getCashTransactionsHistory } from '../db';
import { theme } from '../ui/Theme';

const CashHistoryScreen = ({ onBack }) => {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadTransactions = async () => {
    try {
      const data = await getCashTransactionsHistory(100);
      setTransactions(data);
    } catch (error) {
      console.error('Error cargando historial:', error);
      Alert.alert('Error', 'No se pudo cargar el historial de transacciones');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadTransactions();
  }, []);

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatAmount = (amount) => {
    const num = parseFloat(amount) || 0;
    return new Intl.NumberFormat('es-ES').format(Math.abs(num));
  };

  const getTransactionIcon = (type) => {
    switch (type) {
      case 'session_start': return '🟢';
      case 'session_end': return '🔴';
      case 'safe_movement': return '🏛️';
      case 'sale': return '💰';
      default: return '📝';
    }
  };

  const getAmountColor = (type, amount) => {
    if (type === 'sale') return theme.colors.success;
    if (type === 'safe_movement' && amount < 0) return theme.colors.warning;
    if (type === 'session_start') return theme.colors.success;
    if (type === 'session_end') return theme.colors.primary;
    return theme.colors.text;
  };

  const renderTransaction = ({ item }) => (
    <View style={styles.transactionItem}>
      <View style={styles.transactionHeader}>
        <View style={styles.transactionIcon}>
          <Text style={styles.iconText}>{getTransactionIcon(item.type)}</Text>
        </View>
        <View style={styles.transactionInfo}>
          <Text style={styles.transactionDescription}>{item.description}</Text>
          <Text style={styles.transactionDate}>{formatDate(item.timestamp)}</Text>
          {item.user && <Text style={styles.transactionUser}>Por: {item.user}</Text>}
        </View>
        <View style={styles.transactionAmount}>
          <Text style={[
            styles.amountText,
            { color: getAmountColor(item.type, item.amount) }
          ]}>
            {item.amount < 0 ? '-' : ''}${formatAmount(item.amount)}
          </Text>
        </View>
      </View>
    </View>
  );

  const onRefresh = () => {
    setRefreshing(true);
    loadTransactions();
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
          <Text style={styles.loadingText}>Cargando historial...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Volver</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Historial de Caja</Text>
        <Text style={styles.subtitle}>{transactions.length} transacciones</Text>
      </View>

      <FlatList
        data={transactions}
        renderItem={renderTransaction}
        keyExtractor={(item, index) => `${item.type}-${item.reference_id}-${index}`}
        refreshing={refreshing}
        onRefresh={onRefresh}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>📝</Text>
            <Text style={styles.emptyTitle}>Sin transacciones</Text>
            <Text style={styles.emptyDesc}>Aún no hay movimientos registrados</Text>
          </View>
        }
      />
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    padding: 20,
    backgroundColor: theme.colors.backgroundSecondary || '#f8f9fa',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  backButton: {
    marginBottom: 10,
  },
  backButtonText: {
    color: theme.colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: theme.colors.textSecondary || theme.colors.textMuted,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: theme.colors.textSecondary,
  },
  listContainer: {
    paddingBottom: 20,
  },
  transactionItem: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  transactionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.colors.backgroundSecondary || '#f8f9fa',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  iconText: {
    fontSize: 16,
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 4,
  },
  transactionDate: {
    fontSize: 12,
    color: theme.colors.textSecondary || theme.colors.textMuted,
    marginBottom: 2,
  },
  transactionUser: {
    fontSize: 11,
    color: theme.colors.textSecondary || theme.colors.textMuted,
    fontStyle: 'italic',
  },
  transactionAmount: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.text,
    marginBottom: 8,
  },
  emptyDesc: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    textAlign: 'center',
  },
};

export default CashHistoryScreen;
