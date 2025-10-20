// src/screens/LoginScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  Modal,
  TextInput,
} from 'react-native';
import AuthManager from '../auth/AuthManager';
import { theme } from '../ui/Theme';

export default function LoginScreen({ onLoginSuccess }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [addLoading, setAddLoading] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      await AuthManager.initializeUsers();
      const list = await AuthManager.getAllUsers();
      setUsers(list);
    } catch (error) {
      console.error('Error cargando usuarios:', error);
      Alert.alert('Error', 'No se pudo cargar la lista de usuarios.');
    }
  };

  const handleLogin = async (user) => {
    setIsLoading(true);
    try {
      await AuthManager.login(user);
      Alert.alert('Bienvenido', `Hola ${user.name}`);
      onLoginSuccess && onLoginSuccess(user);
    } catch (error) {
      Alert.alert('Error', 'No se pudo iniciar sesion.');
    } finally {
      setIsLoading(false);
    }
  };

  const openRename = (user) => {
    setRenameTarget(user);
    setRenameValue(user.name);
  };

  const closeRename = () => {
    setRenameTarget(null);
    setRenameValue('');
  };

  const handleRename = async () => {
    const newName = renameValue.trim();
    if (!newName) {
      Alert.alert('Nombre requerido', 'Ingresa un nombre valido.');
      return;
    }

    try {
      await AuthManager.updateUserName(renameTarget.id, newName);
      closeRename();
      loadUsers();
    } catch (error) {
      Alert.alert('Error', error?.message || 'No se pudo actualizar el nombre.');
    }
  };

  const openAdd = () => {
    setNewUserName('');
    setShowAdd(true);
  };

  const handleAddUser = async () => {
    const candidate = newUserName.trim();
    if (!candidate) {
      Alert.alert('Nombre requerido', 'Ingresa un nombre valido.');
      return;
    }
    setAddLoading(true);
    try {
      await AuthManager.addUser({ name: candidate });
      setShowAdd(false);
      setNewUserName('');
      await loadUsers();
    } catch (error) {
      Alert.alert('Error', error?.message || 'No se pudo crear el usuario.');
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>OlivoMarket</Text>
          <Text style={styles.subtitle}>Selecciona tu usuario para comenzar</Text>
        </View>

        <View style={styles.list}>
          {users.map((user) => (
            <View key={user.id} style={styles.userCard}>
              <TouchableOpacity
                style={[styles.loginBtn, (isLoading || addLoading) && styles.loginBtnDisabled]}
                onPress={() => handleLogin(user)}
                disabled={isLoading || addLoading}
              >
                <Text style={styles.loginBtnText}>{user.name}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.renameBtn}
                onPress={() => openRename(user)}
                disabled={isLoading || addLoading}
              >
                <Text style={styles.renameBtnText}>Renombrar</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.addUserBtn}
          onPress={openAdd}
          disabled={isLoading || addLoading}
        >
          <Text style={styles.addUserBtnText}>+ Crear nuevo usuario</Text>
        </TouchableOpacity>

        <Text style={styles.hint}>
          Usuarios internos sin PIN. Puedes renombrarlos o crear nuevos usuarios en cualquier momento.
        </Text>
      </ScrollView>

      <Modal visible={!!renameTarget} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Renombrar usuario</Text>
            <Text style={styles.modalSubtitle}>
              {renameTarget ? `Usuario actual: ${renameTarget.name}` : ''}
            </Text>
            <TextInput
              style={styles.input}
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Nuevo nombre"
              autoCapitalize="characters"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.modalBtn} onPress={closeRename} disabled={isLoading}>
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={handleRename}
                disabled={isLoading}
              >
                <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>Guardar</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showAdd} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nuevo usuario</Text>
            <Text style={styles.modalSubtitle}>Ingresa un nombre unico</Text>
            <TextInput
              style={styles.input}
              value={newUserName}
              onChangeText={setNewUserName}
              placeholder="Nombre"
              autoCapitalize="characters"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={styles.modalBtn}
                onPress={() => setShowAdd(false)}
                disabled={addLoading}
              >
                <Text style={styles.modalBtnText}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalBtn, styles.modalBtnPrimary]}
                onPress={handleAddUser}
                disabled={addLoading}
              >
                <Text style={[styles.modalBtnText, styles.modalBtnTextPrimary]}>
                  {addLoading ? 'Guardando...' : 'Guardar'}
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
    backgroundColor: theme.colors.bg,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    color: theme.colors.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  list: {
    gap: 16,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e6e6e6',
  },
  loginBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  renameBtn: {
    marginTop: 10,
    alignSelf: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  renameBtnText: {
    color: theme.colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  addUserBtn: {
    marginTop: 24,
    alignSelf: 'center',
    borderWidth: 1,
    borderColor: '#d8e7ff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#eef6ff',
  },
  addUserBtnText: {
    color: theme.colors.primary,
    fontWeight: '700',
  },
  hint: {
    marginTop: 24,
    color: theme.colors.textMuted,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 360,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
    color: theme.colors.text,
  },
  modalSubtitle: {
    fontSize: 14,
    color: theme.colors.textMuted,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dcdcdc',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#dcdcdc',
    backgroundColor: '#fff',
  },
  modalBtnPrimary: {
    backgroundColor: theme.colors.primary,
    borderColor: theme.colors.primary,
  },
  modalBtnText: {
    color: theme.colors.text,
    fontWeight: '600',
  },
  modalBtnTextPrimary: {
    color: '#fff',
  },
});
