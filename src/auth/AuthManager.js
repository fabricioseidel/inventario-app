// src/auth/AuthManager.js
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../supabaseClient';

const CURRENT_USER_KEY = 'current_user';

export class AuthManagerClass {
  /**
   * Login con email y contraseña usando Supabase RPC
   */
  static async login(email, password) {
    try {
      const cleanEmail = email.trim().toLowerCase();
      
      if (!cleanEmail || !password) {
        throw new Error('Email y contraseña son requeridos');
      }

      // Llamar función RPC de Supabase para validar credenciales
      const { data, error } = await supabase.rpc('login_user', {
        p_email: cleanEmail,
        p_password: password,
      });

      if (error) {
        console.error('Error en RPC login_user:', error);
        throw new Error('Error de autenticación');
      }

      // data es un array, tomar el primer elemento
      const result = Array.isArray(data) ? data[0] : data;

      if (!result || !result.success) {
        throw new Error(result?.message || 'Credenciales inválidas');
      }

      // Guardar sesión local
      const loginData = {
        id: result.user_id,
        email: result.email,
        name: result.name,
        role: result.role,
        sellerName: result.seller_name,
        loginTime: new Date().toISOString(),
      };

      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(loginData));
      console.log(`✅ Login exitoso: ${loginData.name} (${loginData.role})`);

      return loginData;
    } catch (error) {
      console.error('❌ Error en login:', error);
      throw error;
    }
  }

  /**
   * Obtener lista de usuarios disponibles (solo emails para mostrar sugerencias)
   */
  static async getAllUsers() {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('email, name, role')
        .eq('role', 'SELLER')
        .order('name');

      if (error) {
        console.error('Error obteniendo usuarios:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error obteniendo usuarios:', error);
      return [];
    }
  }

  /**
   * Cerrar sesión
   */
  static async logout() {
    try {
      await AsyncStorage.removeItem(CURRENT_USER_KEY);
      console.log('✅ Usuario cerró sesión');
    } catch (error) {
      console.error('Error en logout:', error);
    }
  }

  /**
   * Obtener usuario actual de la sesión local
   */
  static async getCurrentUser() {
    try {
      const userData = await AsyncStorage.getItem(CURRENT_USER_KEY);
      return userData ? JSON.parse(userData) : null;
    } catch (error) {
      console.error('Error obteniendo usuario actual:', error);
      return null;
    }
  }

  /**
   * Verificar si hay sesión activa
   */
  static async isLoggedIn() {
    const user = await this.getCurrentUser();
    return user !== null;
  }

  /**
   * Actualizar última actividad
   */
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

  /**
   * Cambiar contraseña (para vendedores que quieran cambiar la temporal)
   */
  static async changePassword(newPassword) {
    try {
      const currentUser = await this.getCurrentUser();
      if (!currentUser) {
        throw new Error('No hay sesión activa');
      }

      // Hashear en el servidor usando función SQL
      const { data, error } = await supabase.rpc('change_user_password', {
        p_user_id: currentUser.id,
        p_new_password: newPassword,
      });

      if (error) {
        throw new Error('No se pudo actualizar la contraseña');
      }

      console.log('✅ Contraseña actualizada');
      return true;
    } catch (error) {
      console.error('Error cambiando contraseña:', error);
      throw error;
    }
  }
}

const AuthManager = AuthManagerClass;

export default AuthManager;
export { AuthManager };
