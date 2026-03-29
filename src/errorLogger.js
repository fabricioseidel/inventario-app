// Enhanced in-memory error logger with global capture & unhandled promise rejection tracking.
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

const _logs = [];
const _subs = new Set();
const MAX_LOGS = 150;
let _installed = false;

function broadcast() {
  const snapshot = [..._logs].reverse();
  _subs.forEach(fn => fn(snapshot));
}

export function logError(context, error, extra) {
  const entry = {
    id: Date.now().toString() + Math.random().toString(36).slice(2),
    ts: new Date().toISOString(),
    context,
    message: (error && error.message) ? error.message : String(error),
    stack: error?.stack || null,
    extra: extra || null,
  };
  _logs.push(entry);
  if (_logs.length > MAX_LOGS) _logs.splice(0, _logs.length - MAX_LOGS);
  if (__DEV__) console.error(`[ERR][${context}]`, entry.message, entry.stack || '');
  broadcast();
  return entry;
}

export function useErrorLogs() {
  const [logs, setLogs] = useState([..._logs].reverse());
  useEffect(() => {
    const listener = (l) => setLogs(l);
    _subs.add(listener);
    return () => _subs.delete(listener);
  }, []);
  return logs;
}

export function clearErrors() {
  _logs.splice(0, _logs.length);
  broadcast();
}

export function installGlobalErrorCapture() {
  if (_installed) return;
  _installed = true;
  // RN global handler
  if (global.ErrorUtils && typeof global.ErrorUtils.getGlobalHandler === 'function') {
    const prev = global.ErrorUtils.getGlobalHandler();
    global.ErrorUtils.setGlobalHandler((err, isFatal) => {
      logError('global', err, { isFatal });
      if (prev) prev(err, isFatal);
    });
  }
  // Promise rejections (may not exist in older RN)
  const origUnhandled = global.onunhandledrejection;
  global.onunhandledrejection = (e) => {
    logError('unhandled_promise', e?.reason || e);
    if (origUnhandled) origUnhandled(e);
  };
  // Console error intercept (optional minimal)
  const origConsoleError = console.error;
  console.error = (...args) => {
    try {
      if (args && args.length) {
        const joined = args.map(a => (typeof a === 'string' ? a : (a?.message || JSON.stringify(a, null, 2)))).join(' ');
        if (!joined.startsWith('[ERR][')) { // avoid looping our own
          logError('console', joined.slice(0, 500));
        }
      }
    } catch {}
    origConsoleError(...args);
  };
}
