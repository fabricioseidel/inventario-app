// src/utils/supabaseStorage.js
import * as FileSystem from 'expo-file-system';
import { supabase } from '../supabaseClient';

/**
 * Decodifica base64 a bytes sin usar atob
 * Funciona en React Native y navegadores
 */
function base64ToBytes(base64String) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const bytes = [];
    
    for (let i = 0; i < base64String.length; i += 4) {
        const a = chars.indexOf(base64String[i]);
        const b = chars.indexOf(base64String[i + 1]);
        const c = chars.indexOf(base64String[i + 2]);
        const d = chars.indexOf(base64String[i + 3]);

        bytes.push((a << 2) | (b >> 4));
        if (c !== 64) bytes.push(((b & 15) << 4) | (c >> 2));
        if (d !== 64) bytes.push(((c & 3) << 6) | d);
    }
    
    return new Uint8Array(bytes);
}

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
    const uploadStartTime = Date.now();
    try {
        console.log('═══════════════════════════════════════════════════════');
        console.log('📤 [UPLOAD INICIO] Subiendo comprobante a Supabase Storage');
        console.log('═══════════════════════════════════════════════════════');
        console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
        console.log(`📝 Sale ID: ${saleId}`);
        console.log(`📁 URI Local: ${localUri}`);

        // Validar que la URI existe
        if (!localUri) {
            throw new Error('URI local es vacía o undefined');
        }

        console.log('⏳ [PASO 1] Leyendo archivo como base64...');
        const base64Data = await FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType.Base64,
        });
        console.log(`✅ Base64 leído: ${base64Data.length} caracteres`);

        // Determinar extensión y tipo MIME
        const extension = getFileExtension(localUri);
        const fileName = generateReceiptFileName(saleId, extension);

        let contentType = 'image/jpeg';
        if (extension === 'png') contentType = 'image/png';
        else if (extension === 'webp') contentType = 'image/webp';
        else if (extension === 'heic' || extension === 'heif') contentType = 'image/heic';

        console.log(`✅ Extensión detectada: .${extension}`);
        console.log(`✅ Content-Type: ${contentType}`);
        console.log(`✅ Nombre de archivo generado: ${fileName}`);

        // Convertir base64 a Uint8Array sin usar Buffer
        console.log('⏳ [PASO 2] Convirtiendo base64 a ArrayBuffer...');
        const bytes = base64ToBytes(base64Data);
        console.log(`✅ ArrayBuffer creado: ${bytes.length} bytes`);

        // Subir a Supabase Storage como ArrayBuffer
        console.log('⏳ [PASO 3] Subiendo archivo a Supabase Storage...');
        console.log(`   Bucket: 'uploads'`);
        console.log(`   Archivo: ${fileName}`);
        console.log(`   Tamaño: ${(bytes.length / 1024).toFixed(2)} KB`);

        const uploadStartTimeRequest = Date.now();
        const { data, error } = await supabase.storage
            .from('uploads')
            .upload(fileName, bytes.buffer, {
                contentType,
                cacheControl: '3600',
                upsert: false,
            });
        const uploadEndTimeRequest = Date.now();

        console.log(`⏱️ Tiempo de request: ${uploadEndTimeRequest - uploadStartTimeRequest}ms`);

        if (error) {
            console.error('❌ [ERROR SUPABASE] Error en la respuesta de Supabase:');
            console.error(`   Código: ${error.statusCode || 'N/A'}`);
            console.error(`   Mensaje: ${error.message}`);
            console.error(`   Error completo:`, error);
            throw new Error(`Error al subir archivo: ${error.message}`);
        }

        if (!data) {
            console.warn('⚠️ Supabase retornó data vacía pero sin error');
        } else {
            console.log(`✅ Response de Supabase:`, data);
        }

        // Construir URL pública
        const publicUrl = `https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/${fileName}`;

        console.log('✅ [PASO 4] Construyendo URL pública...');
        console.log(`   URL: ${publicUrl}`);

        const uploadEndTime = Date.now();
        const totalTime = uploadEndTime - uploadStartTime;

        console.log('═══════════════════════════════════════════════════════');
        console.log(`✅ [UPLOAD EXITOSO] Comprobante subido en ${totalTime}ms`);
        console.log('═══════════════════════════════════════════════════════');
        console.log(`📤 URL Final: ${publicUrl}`);

        return publicUrl;
    } catch (error) {
        const uploadEndTime = Date.now();
        const totalTime = uploadEndTime - uploadStartTime;
        
        console.error('═══════════════════════════════════════════════════════');
        console.error(`❌ [ERROR UPLOAD] Falló después de ${totalTime}ms`);
        console.error('═══════════════════════════════════════════════════════');
        console.error(`Error Type: ${error.name}`);
        console.error(`Error Message: ${error.message}`);
        console.error(`Error Stack: ${error.stack}`);
        console.error(`Sale ID: ${saleId}`);
        console.error(`Local URI: ${localUri}`);
        
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
