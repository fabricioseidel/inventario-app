// src/auth/AuthManager.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const CURRENT_USER_KEY = 'current_user';
const USERS_LIST_KEY = 'users_list';

// Usuarios por defecto (todos admins)
const DEFAULT_USERS = [
  { id: 1, name: 'Admin Principal', pin: '1234', role: 'admin', isActive: true },
  { id: 2, name: 'Usuario 2', pin: '5678', role: 'admin', isActive: true },
  { id: 3, name: 'Usuario 3', pin: '9999', role: 'admin', isActive: true },
];

export class AuthManagerClass {
  static async initializeUsers() {
    try {
      const existingUsers = await AsyncStorage.getItem(USERS_LIST_KEY);
      if (!existingUsers) {
        await AsyncStorage.setItem(USERS_LIST_KEY, JSON.stringify(DEFAULT_USERS));
        console.log('🔧 Usuarios por defecto creados');
        return DEFAULT_USERS;
      }
      return JSON.parse(existingUsers);
    } catch (error) {
      console.error('Error inicializando usuarios:', error);
      return DEFAULT_USERS;
    }
  }

  static async getAllUsers() {
    try {
      const users = await AsyncStorage.getItem(USERS_LIST_KEY);
      return users ? JSON.parse(users) : DEFAULT_USERS;
    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      return DEFAULT_USERS;
    }
  }

  static async addUser(userData) {
    try {
      const users = await this.getAllUsers();
      const newUser = {
        id: Date.now(),
        name: userData.name,
        pin: userData.pin,
        role: 'admin',
        isActive: true,
        createdAt: new Date().toISOString(),
      };
      users.push(newUser);
      await AsyncStorage.setItem(USERS_LIST_KEY, JSON.stringify(users));
      return newUser;
    } catch (error) {
      console.error('Error agregando usuario:', error);
      throw error;
    }
  }

  static async validateCredentials(name, pin) {
    try {
      const users = await this.getAllUsers();
      const user = users.find(u => 
        u.name.toLowerCase() === name.toLowerCase() && 
        u.pin === pin && 
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
      console.log(`✅ Login exitoso: ${user.name}`);
      return loginData;
    } catch (error) {
      console.error('Error en login:', error);
      throw error;
    }
  }

  static async logout() {
    try {
      await AsyncStorage.removeItem(CURRENT_USER_KEY);
      console.log('🚪 Usuario cerró sesión');
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

// Crear instancia singleton
const AuthManager = AuthManagerClass;

export default AuthManager;
export { AuthManager };