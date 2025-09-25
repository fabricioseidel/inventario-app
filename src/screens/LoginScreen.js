// src/screens/LoginScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import AuthManager from '../auth/AuthManager';
import { theme } from '../ui/Theme';

export default function LoginScreen({ onLoginSuccess }) {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState([]);
  const [showAddUser, setShowAddUser] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserPin, setNewUserPin] = useState('');

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      await AuthManager.initializeUsers();
      const usersList = await AuthManager.getAllUsers();
      setUsers(usersList);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
    }
  };

  const handleLogin = async () => {
    if (!name.trim() || !pin.trim()) {
      Alert.alert('Error', 'Por favor ingresa nombre y PIN');
      return;
    }

    setIsLoading(true);
    try {
      const user = await AuthManager.validateCredentials(name.trim(), pin.trim());
      if (user) {
        await AuthManager.login(user);
        Alert.alert('Bienvenido', `¡Hola ${user.name}!`);
        onLoginSuccess && onLoginSuccess(user);
      } else {
        Alert.alert('Error', 'Nombre o PIN incorrecto');
      }
    } catch (error) {
      Alert.alert('Error', 'No se pudo iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async (user) => {
    setIsLoading(true);
    try {
      await AuthManager.login(user);
      Alert.alert('Bienvenido', `¡Hola ${user.name}!`);
      onLoginSuccess && onLoginSuccess(user);
    } catch (error) {
      Alert.alert('Error', 'No se pudo iniciar sesión');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddUser = async () => {
    if (!newUserName.trim() || !newUserPin.trim()) {
      Alert.alert('Error', 'Por favor completa todos los campos');
      return;
    }

    if (newUserPin.length < 4) {
      Alert.alert('Error', 'El PIN debe tener al menos 4 dígitos');
      return;
    }

    try {
      await AuthManager.addUser({
        name: newUserName.trim(),
        pin: newUserPin.trim(),
      });
      Alert.alert('Éxito', 'Usuario agregado correctamente');
      setNewUserName('');
      setNewUserPin('');
      setShowAddUser(false);
      loadUsers();
    } catch (error) {
      Alert.alert('Error', 'No se pudo agregar el usuario');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>OlivoMarket</Text>
          <Text style={styles.subtitle}>Iniciar Sesión</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={styles.label}>Nombre de Usuario</Text>
            <TextInput
              style={styles.input}
              value={name}
              onChangeText={setName}
              placeholder="Ingresa tu nombre"
              autoCapitalize="words"
              autoCorrect={false}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>PIN</Text>
            <TextInput
              style={styles.input}
              value={pin}
              onChangeText={setPin}
              placeholder="Ingresa tu PIN"
              keyboardType="numeric"
              secureTextEntry
              maxLength={6}
            />
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            <Text style={styles.loginBtnText}>
              {isLoading ? 'Iniciando...' : 'Iniciar Sesión'}
            </Text>
          </TouchableOpacity>
        </View>

        {users.length > 0 && (
          <View style={styles.quickLogin}>
            <Text style={styles.quickLoginTitle}>Acceso Rápido:</Text>
            <View style={styles.usersList}>
              {users.map((user) => (
                <TouchableOpacity
                  key={user.id}
                  style={styles.userButton}
                  onPress={() => handleQuickLogin(user)}
                  disabled={isLoading}
                >
                  <Text style={styles.userButtonText}>{user.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <View style={styles.addUserSection}>
          {!showAddUser ? (
            <TouchableOpacity
              style={styles.addUserBtn}
              onPress={() => setShowAddUser(true)}
            >
              <Text style={styles.addUserBtnText}>+ Agregar Usuario</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.addUserForm}>
              <Text style={styles.addUserTitle}>Nuevo Usuario</Text>
              
              <TextInput
                style={styles.input}
                value={newUserName}
                onChangeText={setNewUserName}
                placeholder="Nombre del usuario"
                autoCapitalize="words"
              />
              
              <TextInput
                style={styles.input}
                value={newUserPin}
                onChangeText={setNewUserPin}
                placeholder="PIN (4-6 dígitos)"
                keyboardType="numeric"
                secureTextEntry
                maxLength={6}
              />
              
              <View style={styles.addUserButtons}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => {
                    setShowAddUser(false);
                    setNewUserName('');
                    setNewUserPin('');
                  }}
                >
                  <Text style={styles.cancelBtnText}>Cancelar</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={handleAddUser}
                >
                  <Text style={styles.saveBtnText}>Guardar</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  form: {
    marginBottom: 32,
  },
  field: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#e6e6e6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  loginBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  quickLogin: {
    marginBottom: 32,
  },
  quickLoginTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  usersList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  userButton: {
    backgroundColor: '#eef6ff',
    borderWidth: 1,
    borderColor: '#d8e7ff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
  },
  userButtonText: {
    color: theme.colors.primary,
    fontWeight: '600',
  },
  addUserSection: {
    borderTopWidth: 1,
    borderTopColor: '#eee',
    paddingTop: 24,
  },
  addUserBtn: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addUserBtnText: {
    color: theme.colors.textMuted,
    fontWeight: '600',
  },
  addUserForm: {
    backgroundColor: '#f8f9fa',
    borderRadius: 12,
    padding: 16,
  },
  addUserTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  addUserButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  cancelBtn: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#ddd',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  cancelBtnText: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  saveBtn: {
    flex: 1,
    backgroundColor: theme.colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '600',
  },
});