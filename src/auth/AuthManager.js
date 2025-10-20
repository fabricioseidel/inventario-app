// src/auth/AuthManager.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const CURRENT_USER_KEY = 'current_user';
const USERS_LIST_KEY = 'users_list';

const DEFAULT_USER_NAMES = ['MARIANA', 'INGRID', 'ALFREDO', 'FABRICIO', 'MARIA', 'PRUEBAS'];
const DEFAULT_USERS = DEFAULT_USER_NAMES.map((name, index) => ({
  id: index + 1,
  name,
  role: 'admin',
  isActive: true,
  createdAt: new Date().toISOString(),
}));

function sanitizeUsers(users = []) {
  return users
    .map((user, index) => {
      const name = String(user?.name || '').trim().toUpperCase();
      if (!name) return null;
      return {
        id: user?.id ?? Date.now() + index,
        name,
        role: user?.role || 'admin',
        isActive: user?.isActive !== false,
        createdAt: user?.createdAt || new Date().toISOString(),
      };
    })
    .filter(Boolean);
}

export class AuthManagerClass {
  static async initializeUsers() {
    try {
      const existingUsers = await AsyncStorage.getItem(USERS_LIST_KEY);
      if (!existingUsers) {
        await AsyncStorage.setItem(USERS_LIST_KEY, JSON.stringify(DEFAULT_USERS));
        console.log('Usuarios por defecto creados');
        return DEFAULT_USERS;
      }
      const parsed = JSON.parse(existingUsers);
      const clean = sanitizeUsers(parsed);
      if (!clean.length) {
        await AsyncStorage.setItem(USERS_LIST_KEY, JSON.stringify(DEFAULT_USERS));
        return DEFAULT_USERS;
      }
      // Migracion desde versiones con PIN u otros campos
      await AsyncStorage.setItem(USERS_LIST_KEY, JSON.stringify(clean));
      return clean;
    } catch (error) {
      console.error('Error inicializando usuarios:', error);
      return DEFAULT_USERS;
    }
  }

  static async getAllUsers() {
    try {
      const users = await AsyncStorage.getItem(USERS_LIST_KEY);
      if (!users) return DEFAULT_USERS;
      const clean = sanitizeUsers(JSON.parse(users));
      if (!clean.length) return DEFAULT_USERS;
      return clean;
    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      return DEFAULT_USERS;
    }
  }

  static async addUser(userData) {
    try {
      const users = await this.getAllUsers();
      const cleanUsers = sanitizeUsers(users);
      const cleanName = String(userData?.name || '').trim().toUpperCase();
      if (!cleanName) throw new Error('Nombre invalido');
      if (cleanUsers.some(u => u.name === cleanName)) {
        throw new Error('El usuario ya existe');
      }
      const newUser = {
        id: Date.now(),
        name: cleanName,
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      cleanUsers.push(newUser);
      await AsyncStorage.setItem(USERS_LIST_KEY, JSON.stringify(cleanUsers));
      return newUser;
    } catch (error) {
      console.error('Error agregando usuario:', error);
      throw error;
    }
  }

  static async updateUserName(userId, newName) {
    try {
      const cleanName = newName.trim().toUpperCase();
      if (!cleanName) throw new Error('Nombre invalido');

      const users = await this.getAllUsers();
      const idx = users.findIndex(u => u.id === userId);
      if (idx === -1) throw new Error('Usuario no encontrado');

      if (users.some((u, i) => i !== idx && u.name === cleanName)) {
        throw new Error('El usuario ya existe');
      }

      users[idx] = {
        ...users[idx],
        name: cleanName,
        updatedAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem(USERS_LIST_KEY, JSON.stringify(users));

      const currentUser = await this.getCurrentUser();
      if (currentUser?.id === userId) {
        const updatedCurrent = { ...currentUser, name: cleanName };
        await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(updatedCurrent));
      }

      return users[idx];
    } catch (error) {
      console.error('Error actualizando nombre:', error);
      throw error;
    }
  }

  static async validateCredentials(name) {
    try {
      const users = await this.getAllUsers();
      const user = users.find(u =>
        u.name.toLowerCase() === name.trim().toLowerCase() &&
        u.isActive
      );
      return user || null;
    } catch (error) {
      console.error('Error validando credenciales:', error);
      return null;
    }
  }

  static async login(user) {
    try {
      const loginData = {
        ...user,
        loginTime: new Date().toISOString(),
        sessionId: Date.now().toString(),
      };
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(loginData));
      console.log(`Login exitoso: ${user.name}`);
      return loginData;
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  }

  static async logout() {
    try {
      await AsyncStorage.removeItem(CURRENT_USER_KEY);
      console.log('Usuario cerro sesion');
    } catch (error) {
      console.error('Error en logout:', error);
    }
  }

  static async getCurrentUser() {
    try {
      const userData = await AsyncStorage.getItem(CURRENT_USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error obteniendo usuario actual:', error);
      return null;
    }
  }

  static async isLoggedIn() {
    const user = await this.getCurrentUser();
    return user !== null;
  }

  static async updateLastActivity() {
    try {
      const currentUser = await this.getCurrentUser();
      if (currentUser) {
        currentUser.lastActivity = new Date().toISOString();
        await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(currentUser));
      }
    } catch (error) {
      console.error('Error actualizando actividad:', error);
    }
  }
}

const AuthManager = AuthManagerClass;

export default AuthManager;
export { AuthManager };
