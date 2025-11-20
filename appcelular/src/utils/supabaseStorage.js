// src/utils/supabaseStorage.js
import * as FileSystem from 'expo-file-system';
import { supabase } from '../supabaseClient';

/**
 * Genera un nombre único para el archivo de comprobante
 * Formato: comprobante-{saleId}-{timestamp}-{random}.{ext}
 */
function generateReceiptFileName(saleId, extension = 'jpg') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);
    const ext = extension.toLowerCase().replace('.', '');
    return `comprobante-${saleId}-${timestamp}-${random}.${ext}`;
}

/**
 * Extrae la extensión de un archivo desde su URI
 */
function getFileExtension(uri) {
    if (!uri) return 'jpg';
    const match = uri.match(/\.([a-zA-Z0-9]+)(\?|$)/);
    if (match && match[1]) {
        return match[1].toLowerCase();
    }
    return 'jpg';
}

/**
 * Sube un archivo local a Supabase Storage
 * @param {string} localUri - URI local del archivo (file://)
 * @param {number} saleId - ID de la venta
 * @returns {Promise<string>} - URL pública del archivo subido
 */
export async function uploadReceiptToSupabase(localUri, saleId) {
    try {
        console.log('📤 Subiendo comprobante a Supabase...');
        console.log('📤 URI local:', localUri);
        console.log('📤 Sale ID:', saleId);

        // Leer el archivo como base64
        const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType.Base64,
        });

        // Determinar extensión y tipo MIME
        const extension = getFileExtension(localUri);
        const fileName = generateReceiptFileName(saleId, extension);

        let contentType = 'image/jpeg';
        if (extension === 'png') contentType = 'image/png';
        else if (extension === 'webp') contentType = 'image/webp';
        else if (extension === 'heic' || extension === 'heif') contentType = 'image/heic';

        console.log('📤 Nombre del archivo:', fileName);
        console.log('📤 Content-Type:', contentType);

        // Convertir base64 a ArrayBuffer
        const binaryString = atob(base64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        // Subir a Supabase Storage
        const { data, error } = await supabase.storage
            .from('uploads')
            .upload(fileName, bytes.buffer, {
                contentType,
                cacheControl: '3600',
                upsert: false,
            });

        if (error) {
            console.error('❌ Error subiendo a Supabase:', error);
            throw new Error(`Error al subir archivo: ${error.message}`);
        }

        // Construir URL pública
        const publicUrl = `https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/${fileName}`;

        console.log('✅ Archivo subido exitosamente');
        console.log('✅ URL pública:', publicUrl);

        return publicUrl;
    } catch (error) {
        console.error('❌ Error en uploadReceiptToSupabase:', error);
        throw error;
    }
}

/**
 * Descarga una imagen desde Supabase Storage al almacenamiento local
 * @param {string} publicUrl - URL pública del archivo en Supabase
 * @param {string} localPath - Ruta local donde guardar el archivo
 * @returns {Promise<string>} - URI local del archivo descargado
 */
export async function downloadReceiptFromSupabase(publicUrl, localPath) {
    try {
        console.log('📥 Descargando comprobante desde Supabase...');
        console.log('📥 URL:', publicUrl);

        const downloadResult = await FileSystem.downloadAsync(publicUrl, localPath);

        console.log('✅ Archivo descargado a:', downloadResult.uri);
        return downloadResult.uri;
    } catch (error) {
        console.error('❌ Error descargando desde Supabase:', error);
        throw error;
    }
}

/**
 * Verifica si una URL es de Supabase Storage
 */
export function isSupabaseUrl(url) {
    if (!url) return false;
    return url.includes('supabase.co/storage/v1/object/public/');
}

/**
 * Verifica si una URL es local (file://)
 */
export function isLocalUrl(url) {
    if (!url) return false;
    return url.startsWith('file://');
}
