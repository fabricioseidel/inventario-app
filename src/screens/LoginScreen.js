// src/screens/LoginScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import AuthManager from '../auth/AuthManager';
import { theme } from '../ui/Theme';

export default function LoginScreen({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState([]);

  useEffect(() => {
    loadSuggestedUsers();
  }, []);

  const loadSuggestedUsers = async () => {
    try {
      const users = await AuthManager.getAllUsers();
      setSuggestedUsers(users);
    } catch (error) {
      console.error('Error cargando sugerencias:', error);
    }
  };

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Ingresa tu email y contraseña');
      return;
    }

    setIsLoading(true);
    try {
      const user = await AuthManager.login(email, password);
      Alert.alert('Bienvenido', `Hola ${user.name}`);
      onLoginSuccess && onLoginSuccess(user);
    } catch (error) {
      Alert.alert(
        'Error de autenticación',
        error.message || 'Credenciales inválidas'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectUser = (userEmail) => {
    setEmail(userEmail);
  };

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>OlivoMarket</Text>
          <Text style={styles.subtitle}>Inicia sesión para continuar</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="vendedor@tienda.local"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!isLoading}
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Contraseña</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              editable={!isLoading}
            />
          </View>

          <TouchableOpacity
            style={[styles.loginBtn, isLoading && styles.loginBtnDisabled]}
            onPress={handleLogin}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.loginBtnText}>Iniciar Sesión</Text>
            )}
          </TouchableOpacity>
        </View>

        {suggestedUsers.length > 0 && (
          <View style={styles.suggestions}>
            <Text style={styles.suggestionsTitle}>Usuarios disponibles:</Text>
            <View style={styles.suggestionsList}>
              {suggestedUsers.map((user) => (
                <TouchableOpacity
                  key={user.email}
                  style={styles.suggestionChip}
                  onPress={() => handleSelectUser(user.email)}
                  disabled={isLoading}
                >
                  <Text style={styles.suggestionName}>{user.name}</Text>
                  <Text style={styles.suggestionEmail}>{user.email}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.hint}>
          Contraseña temporal: <Text style={styles.hintBold}>Venta2025</Text>
          {'\n'}Cámbiala después del primer acceso.
        </Text>
      </ScrollView>
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
    marginBottom: 40,
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
  form: {
    gap: 20,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.text,
    marginLeft: 4,
  },
  input: {
    borderWidth: 1,
    borderColor: '#dcdcdc',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    backgroundColor: '#fff',
    color: theme.colors.text,
  },
  loginBtn: {
    backgroundColor: theme.colors.primary,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 12,
    shadowColor: theme.colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  loginBtnDisabled: {
    opacity: 0.6,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  suggestions: {
    marginTop: 32,
  },
  suggestionsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.textMuted,
    marginBottom: 12,
    textAlign: 'center',
  },
  suggestionsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  suggestionChip: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e6e6e6',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    alignItems: 'center',
    minWidth: 100,
  },
  suggestionName: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.colors.primary,
  },
  suggestionEmail: {
    fontSize: 11,
    color: theme.colors.textMuted,
    marginTop: 2,
  },
  hint: {
    marginTop: 24,
    color: theme.colors.textMuted,
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
  },
  hintBold: {
    fontWeight: '700',
    color: theme.colors.primary,
  },
});

