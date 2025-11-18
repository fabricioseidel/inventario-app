// src/screens/CashManagementScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
} from 'react-native';

import { 
  getCurrentCashSession, 
  openCashSession, 
  closeCashSession,
  calculateExpectedCashAmount,
  getSafeBalance,
  depositToSafe,
  withdrawFromSafe,
  getCashSessionsHistory 
} from '../db';
import { theme } from '../ui/Theme';

export default function CashManagementScreen({ currentUser, onClose }) {
  const [currentSession, setCurrentSession] = useState(null);
  const [cashData, setCashData] = useState(null);
  const [safeBalance, setSafeBalance] = useState(0);
  const [loading, setLoading] = useState(true);
  
  // Estados para modales simples
  const [showOpenModal, setShowOpenModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showSafeModal, setShowSafeModal] = useState(false);
  
  // Estados para valores
  const [openingAmount, setOpeningAmount] = useState('10000');
  const [actualAmount, setActualAmount] = useState('');
  const [nextDayAmount, setNextDayAmount] = useState('10000');
  const [safeAmount, setSafeAmount] = useState('');
  const [safeAction, setSafeAction] = useState('deposit');
  const [description, setDescription] = useState('');
  
  const [sessions, setSessions] = useState([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [session, balance, history] = await Promise.all([
        getCurrentCashSession(),
        getSafeBalance(),
        getCashSessionsHistory(5) // Solo las últimas 5 sesiones
      ]);
      
      setCurrentSession(session);
      setSafeBalance(balance?.balance || 0);
      setSessions(history);
      
      if (session) {
        const data = await calculateExpectedCashAmount(session.id);
        setCashData(data);
      }
    } catch (error) {
      console.error('Error cargando datos:', error);
      Alert.alert('Error', 'No se pudo cargar la información');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCash = async () => {
    try {
      const amount = parseFloat(openingAmount);
      if (isNaN(amount) || amount < 0) {
        Alert.alert('Error', 'Ingresa un monto válido');
        return;
      }
      
      await openCashSession(amount, currentUser.id, currentUser.name);
      setShowOpenModal(false);
      Alert.alert('✅ Caja Abierta', `Iniciaste con $${amount.toLocaleString()}`);
      loadData();
    } catch (error) {
      console.error('Error abriendo caja:', error);
      Alert.alert('Error', 'No se pudo abrir la caja');
    }
  };

  const handleCloseCash = async () => {
    try {
      if (!currentSession) return;
      
      const counted = parseFloat(actualAmount);
      const nextDay = parseFloat(nextDayAmount) || 0;
      
      if (isNaN(counted) || counted < 0) {
        Alert.alert('Error', 'Ingresa el monto contado');
        return;
      }
      
      if (nextDay > counted) {
        Alert.alert('Error', 'El monto para mañana no puede ser mayor al contado');
        return;
      }
      
      const result = await closeCashSession(
        currentSession.id, 
        counted, 
        [], // Sin detalles de denominaciones por simplicidad
        currentUser.id, 
        currentUser.name,
        nextDay // Nuevo parámetro: dinero para día siguiente
      );
      
      setShowCloseModal(false);
      setActualAmount('');
      setNextDayAmount('10000'); // Reset al valor por defecto
      
      const diffText = result.difference >= 0 ? 
        `Sobrante: $${result.difference.toLocaleString()}` : 
        `Faltante: $${Math.abs(result.difference).toLocaleString()}`;
      
      const nextDayText = result.nextDayAmount > 0 ? 
        `\n🌅 Para mañana: $${result.nextDayAmount.toLocaleString()}` : '';
      
      const safeText = result.amountToSafe > 0 ? 
        `\n💰 A caja fuerte: $${result.amountToSafe.toLocaleString()}` : '';
      
      Alert.alert(
        '✅ Caja Cerrada',
        `Esperado: $${result.expectedAmount.toLocaleString()}\n` +
        `Contado: $${result.actualAmount.toLocaleString()}\n` +
        `${diffText}${nextDayText}${safeText}`,
        [{ text: 'OK' }]
      );
      
      loadData();
    } catch (error) {
      console.error('Error cerrando caja:', error);
      Alert.alert('Error', 'No se pudo cerrar la caja');
    }
  };

  const handleSafeTransaction = async () => {
    try {
      const amount = parseFloat(safeAmount);
      if (isNaN(amount) || amount <= 0) {
        Alert.alert('Error', 'Ingresa un monto válido');
        return;
      }
      
      if (!description.trim()) {
        Alert.alert('Error', 'Ingresa una descripción');
        return;
      }
      
      // 🆕 Validación: No se puede retirar más de lo disponible en caja fuerte
      if (safeAction === 'withdraw' && amount > safeBalance) {
        Alert.alert(
          'Saldo insuficiente',
          `No puedes retirar $${amount.toLocaleString()}\n\nSaldo disponible en caja fuerte: $${safeBalance.toLocaleString()}\n\n💡 Reduce el monto o realiza un depósito primero.`,
          [{ text: 'Entendido' }]
        );
        return;
      }
      
      if (safeAction === 'deposit') {
        await depositToSafe(amount, description, null, currentUser.id, currentUser.name);
      } else {
        await withdrawFromSafe(amount, description, currentUser.id, currentUser.name);
      }
      
      setShowSafeModal(false);
      setSafeAmount('');
      setDescription('');
      Alert.alert('✅ Listo', `${safeAction === 'deposit' ? 'Depósito' : 'Retiro'} registrado`);
      loadData();
    } catch (error) {
      console.error('Error en transacción:', error);
      Alert.alert('Error', 'No se pudo completar la operación');
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <Text>Cargando...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>💰 Gestión de Caja</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Estado de Caja Actual */}
        {currentSession ? (
          <View style={styles.card}>
            <View style={styles.statusIndicator}>
              <View style={styles.statusDot} />
              <Text style={styles.cardTitle}>📦 Caja Abierta</Text>
              <Text style={styles.date}>
                {new Date(currentSession.start_date).toLocaleDateString('es-CL')}
              </Text>
              <Text style={styles.amount}>
                Apertura: ${currentSession.opening_amount.toLocaleString()}
              </Text>
              
              {cashData && (
                <>
                  <View style={styles.summary}>
                    <Text style={styles.summaryItem}>
                      💳 Efectivo recibido: ${(cashData.cashReceived || 0).toLocaleString()}
                    </Text>
                    <Text style={styles.summaryItem}>
                      💸 Vueltos dados: ${(cashData.totalChange || 0).toLocaleString()}
                    </Text>
                    <Text style={styles.expectedAmount}>
                      💰 Esperado ahora: ${(cashData.expectedAmount || 0).toLocaleString()}
                    </Text>
                  </View>
                </>
              )}
              
              <TouchableOpacity 
                style={styles.closeButton} 
                onPress={() => setShowCloseModal(true)}
              >
                <Text style={styles.buttonTextWhite}>🔒 Cerrar Caja</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📭 Caja Cerrada</Text>
            <Text style={styles.cardDescription}>
              No hay una sesión de caja activa
            </Text>
            
            <TouchableOpacity 
              style={styles.openButton} 
              onPress={() => setShowOpenModal(true)}
            >
              <Text style={styles.buttonTextWhite}>🔓 Abrir Caja</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Caja Fuerte */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏦 Caja Fuerte</Text>
          <Text style={styles.amount}>Balance: ${safeBalance.toLocaleString()}</Text>
          
          <View style={styles.safeButtons}>
            <TouchableOpacity 
              style={styles.depositButton} 
              onPress={() => {
                setSafeAction('deposit');
                setDescription('Depósito manual');
                setShowSafeModal(true);
              }}
            >
              <Text style={styles.buttonTextWhite}>💰 Depositar</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.withdrawButton} 
              onPress={() => {
                setSafeAction('withdrawal');
                setDescription('Retiro manual');
                setShowSafeModal(true);
              }}
            >
              <Text style={styles.buttonTextWhite}>💸 Retirar</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Historial Reciente */}
        {sessions.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📋 Últimas Sesiones</Text>
            {sessions.map((session, index) => (
              <View key={session.id} style={styles.historyItem}>
                <Text>Apertura: ${session.opening_amount?.toLocaleString()}</Text>
                <Text style={styles.date}>
                  {new Date(session.start_date).toLocaleDateString('es-CL')}
                </Text>
                {session.difference !== null && (
                  <Text style={styles.difference}>
                    {session.difference >= 0 ? '📈' : '📉'} ${Math.abs(session.difference).toLocaleString()}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Modal Abrir Caja */}
      <Modal visible={showOpenModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🔓 Abrir Caja</Text>
              <TouchableOpacity 
                onPress={() => setShowOpenModal(false)}
                style={styles.closeModalButton}
              >
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>Monto inicial</Text>
            <TextInput
              style={styles.input}
              value={openingAmount}
              onChangeText={setOpeningAmount}
              placeholder="10000"
              keyboardType="numeric"
              selectTextOnFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setShowOpenModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.openButton} 
                onPress={handleOpenCash}
              >
                <Text style={styles.buttonTextWhite}>Abrir</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Cerrar Caja */}
      <Modal visible={showCloseModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🔒 Cerrar Caja</Text>
              <TouchableOpacity 
                onPress={() => setShowCloseModal(false)}
                style={styles.closeModalButton}
              >
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {cashData && cashData.expectedAmount !== undefined && (
              <View style={styles.expectedSection}>
                <Text style={styles.expectedLabel}>
                  💰 Esperado: ${cashData.expectedAmount.toLocaleString()}
                </Text>
              </View>
            )}
            
            <Text style={styles.label}>¿Cuánto hay en caja ahora?</Text>
            <TextInput
              style={styles.input}
              value={actualAmount}
              onChangeText={setActualAmount}
              placeholder="0"
              keyboardType="numeric"
              selectTextOnFocus
            />
            
            <Text style={styles.label}>¿Cuánto dejar para mañana?</Text>
            <TextInput
              style={styles.input}
              value={nextDayAmount}
              onChangeText={setNextDayAmount}
              placeholder="10000"
              keyboardType="numeric"
              selectTextOnFocus
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setShowCloseModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={styles.closeButtonModal} 
                onPress={handleCloseCash}
              >
                <Text style={styles.buttonTextWhite}>Cerrar Caja</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Modal Caja Fuerte */}
      <Modal visible={showSafeModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {safeAction === 'deposit' ? '💰 Depositar' : '💸 Retirar'}
              </Text>
              <TouchableOpacity 
                onPress={() => setShowSafeModal(false)}
                style={styles.closeModalButton}
              >
                <Text style={styles.closeModalText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            <Text style={styles.label}>Monto</Text>
            <TextInput
              style={styles.input}
              value={safeAmount}
              onChangeText={setSafeAmount}
              placeholder="0"
              keyboardType="numeric"
              selectTextOnFocus
            />
            
            <Text style={styles.label}>Descripción</Text>
            <TextInput
              style={styles.input}
              value={description}
              onChangeText={setDescription}
              placeholder="Motivo del movimiento"
              multiline
              numberOfLines={3}
            />
            
            <View style={styles.modalButtons}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setShowSafeModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.modalActionButton, 
                  safeAction === 'deposit' 
                    ? styles.depositActionButton
                    : styles.withdrawActionButton
                ]} 
                onPress={handleSafeTransaction}
              >
                <Text style={styles.buttonTextWhite}>
                  {safeAction === 'deposit' ? 'Depositar' : 'Retirar'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: theme.colors.primary,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  closeButton: {
    backgroundColor: theme.colors.danger,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  closeButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  card: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: theme.colors.textSecondary,
    marginBottom: 16,
  },
  date: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginBottom: 8,
  },
  amount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.success,
    marginBottom: 12,
  },
  statusIndicator: {
    alignItems: 'flex-start',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.colors.success,
    position: 'absolute',
    top: 2,
    left: -4,
  },
  summary: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  summaryItem: {
    fontSize: 14,
    marginBottom: 4,
    color: theme.colors.text,
  },
  expectedAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
    marginTop: 8,
  },
  safeButtons: {
    flexDirection: 'row',
    marginTop: 12,
  },
  openButton: {
    backgroundColor: theme.colors.success,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginLeft: 6,
  },
  closeButtonModal: {
    backgroundColor: theme.colors.danger,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginLeft: 6,
  },
  depositButton: {
    backgroundColor: theme.colors.success,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginRight: 6,
  },
  withdrawButton: {
    backgroundColor: '#F57C00', // Naranja oscuro
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
    marginLeft: 6,
  },
  buttonTextWhite: {
    color: 'white',
    fontWeight: 'bold',
  },
  historyItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
  },
  difference: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modal: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    width: '90%',
    maxWidth: 400,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
    flex: 1,
  },
  closeModalButton: {
    padding: 4,
    marginLeft: 8,
  },
  closeModalText: {
    fontSize: 24,
    color: theme.colors.textSecondary,
    fontWeight: 'bold',
  },
  expectedSection: {
    backgroundColor: theme.colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    alignItems: 'center',
  },
  expectedLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
    color: theme.colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 16,
    marginBottom: 16,
    backgroundColor: 'white',
  },
  modalButtons: {
    flexDirection: 'row',
    marginTop: 8,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: '#E0E0E0',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginRight: 6,
  },
  cancelButtonText: {
    color: '#333',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalActionButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginLeft: 6,
  },
  depositActionButton: {
    backgroundColor: theme.colors.success, // Verde oscuro
  },
  withdrawActionButton: {
    backgroundColor: '#F57C00', // Naranja oscuro (buen contraste con blanco)
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});
