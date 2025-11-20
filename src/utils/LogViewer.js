// src/utils/LogViewer.js
import AsyncStorage from '@react-native-async-storage/async-storage';

const LOG_STORAGE_KEY = 'APP_LOGS';
const MAX_LOGS = 500; // Máximo número de logs para no saturar storage

class LogManager {
  constructor() {
    this.logs = [];
    this.listeners = [];
  }

  /**
   * Agrega un log a la memoria y storage
   */
  async addLog(level, message, data = null) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level,
      message,
      data,
      id: Date.now() + Math.random(),
    };

    this.logs.unshift(logEntry);
    this.listeners.forEach(listener => listener([...this.logs]));

    // Guardar en AsyncStorage (limitado)
    if (this.logs.length > MAX_LOGS) {
      this.logs = this.logs.slice(0, MAX_LOGS);
    }

    try {
      await AsyncStorage.setItem(LOG_STORAGE_KEY, JSON.stringify(this.logs));
    } catch (e) {
      console.warn('Error guardando logs', e);
    }
  }

  log(message, data) {
    console.log(message, data);
    this.addLog('LOG', message, data);
  }

  info(message, data) {
    console.info(message, data);
    this.addLog('INFO', message, data);
  }

  warn(message, data) {
    console.warn(message, data);
    this.addLog('WARN', message, data);
  }

  error(message, data) {
    console.error(message, data);
    this.addLog('ERROR', message, data);
  }

  debug(message, data) {
    console.debug(message, data);
    this.addLog('DEBUG', message, data);
  }

  /**
   * Obtiene todos los logs
   */
  getLogs() {
    return [...this.logs];
  }

  /**
   * Limpia todos los logs
   */
  async clearLogs() {
    this.logs = [];
    this.listeners.forEach(listener => listener([]));
    await AsyncStorage.removeItem(LOG_STORAGE_KEY);
  }

  /**
   * Carga logs del storage
   */
  async loadLogs() {
    try {
      const stored = await AsyncStorage.getItem(LOG_STORAGE_KEY);
      if (stored) {
        this.logs = JSON.parse(stored);
        this.listeners.forEach(listener => listener([...this.logs]));
      }
    } catch (e) {
      console.warn('Error cargando logs', e);
    }
  }

  /**
   * Se suscribe a cambios de logs
   */
  subscribe(listener) {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Exporta logs como texto
   */
  exportAsText() {
    return this.logs
      .map(
        log =>
          `[${log.timestamp}] [${log.level}] ${log.message}${log.data ? '\n' + JSON.stringify(log.data, null, 2) : ''}`
      )
      .join('\n\n');
  }
}

export const logManager = new LogManager();

// Interceptar console.log automáticamente
const originalLog = console.log;
const originalWarn = console.warn;
const originalError = console.error;

console.log = function (...args) {
  originalLog.apply(console, args);
  const message = args.join(' ');
  if (message && !message.includes('RCTLog')) {
    logManager.log(message);
  }
};

console.warn = function (...args) {
  originalWarn.apply(console, args);
  const message = args.join(' ');
  if (message) {
    logManager.warn(message);
  }
};

console.error = function (...args) {
  originalError.apply(console, args);
  const message = args.join(' ');
  if (message) {
    logManager.error(message);
  }
};
