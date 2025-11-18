// src/utils/media.js
import * as FileSystem from 'expo-file-system';

async function ensureDirAsync(dir) {
  try {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  } catch (e) {
    console.warn('ensureDirAsync error', e);
  }
}

function extractExtension(uri) {
  if (!uri) return null;
  const cleanUri = uri.split('?')[0];
  const parts = cleanUri.split('.');
  if (parts.length > 1) {
    return parts.pop()?.trim().toLowerCase() || null;
  }
  return null;
}

export function getFileDisplayName(uri) {
  if (!uri) return '';
  try {
    const cleanUri = uri.split('?')[0];
    const parts = cleanUri.split('/');
    return decodeURIComponent(parts.pop() || '');
  } catch {
    return uri;
  }
}

export async function copyFileToDocuments(uri, { folder = 'media', prefix = 'asset', extension } = {}) {
  if (!uri) return null;
  const baseDir = FileSystem.documentDirectory || FileSystem.cacheDirectory;
  if (!baseDir) throw new Error('No storage directory available');

  const dir = `${baseDir}${folder}/`;
  await ensureDirAsync(dir);

  const ext = (extension || extractExtension(uri) || 'dat').replace(/[^a-z0-9]/gi, '').toLowerCase();
  const name = `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext || 'dat'}`;
  const dest = `${dir}${name}`;

  try {
    await FileSystem.copyAsync({ from: uri, to: dest });
    return dest;
  } catch (err) {
    console.warn('copyAsync failed, trying downloadAsync', err);
    try {
      const res = await FileSystem.downloadAsync(uri, dest);
      return res.uri;
    } catch (err2) {
      console.error('downloadAsync failed', err2);
      throw err2;
    }
  }
}
