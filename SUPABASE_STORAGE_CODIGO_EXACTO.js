/**
 * CÓDIGO EXACTO PARA CARGAR ARCHIVOS A SUPABASE STORAGE
 * Archivo: src/utils/supabaseStorage.js
 * 
 * Este es el código completo y funcional que implementa la carga de archivos
 * a Supabase Storage sin usar FormData.
 */

import * as FileSystem from 'expo-file-system';
import { supabase } from '../supabaseClient';

/**
 * FUNCIÓN PRINCIPAL: Carga un archivo local a Supabase Storage
 * 
 * @param {string} localUri - URI local del archivo (ej: file:///storage/emulated/0/...jpg)
 * @param {number|string} saleId - ID único de la venta o entidad
 * @returns {Promise<string>} - URL pública del archivo en Supabase
 * 
 * PROCESO INTERNO:
 * 1. Lee archivo como Base64
 * 2. Convierte Base64 a ArrayBuffer
 * 3. Genera nombre único
 * 4. Sube ArrayBuffer a Supabase Storage
 * 5. Retorna URL pública
 */
export async function uploadReceiptToSupabase(localUri, saleId) {
    try {
        console.log('📤 Subiendo comprobante a Supabase...');
        console.log('📤 URI local:', localUri);
        console.log('📤 Sale ID:', saleId);

        // ============================================
        // PASO 1: LEER ARCHIVO LOCAL COMO BASE64
        // ============================================
        const base64 = await FileSystem.readAsStringAsync(localUri, {
            encoding: FileSystem.EncodingType.Base64,
        });
        console.log('✅ Archivo leído como Base64, tamaño:', base64.length);

        // ============================================
        // PASO 2: OBTENER EXTENSIÓN Y DETERMINAR MIME
        // ============================================
        const extension = getFileExtension(localUri);
        const fileName = generateReceiptFileName(saleId, extension);

        let contentType = 'image/jpeg';
        if (extension === 'png') contentType = 'image/png';
        else if (extension === 'webp') contentType = 'image/webp';
        else if (extension === 'heic' || extension === 'heif') contentType = 'image/heic';

        console.log('📤 Nombre del archivo:', fileName);
        console.log('📤 Content-Type:', contentType);

        // ============================================
        // PASO 3: CONVERTIR BASE64 A ARRAYBUFFER
        // ============================================
        // NOTA IMPORTANTE: No usamos atob() porque no funciona en React Native.
        // Usamos una función manual que decodifica Base64 a bytes.
        
        const base64ToArrayBuffer = (base64String) => {
            const chars = [];
            let i = 0;
            
            // Tabla de caracteres Base64
            const base64Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
            
            // Procesar cada grupo de 4 caracteres Base64 = 3 bytes
            while (i < base64String.length) {
                const a = base64Chars.indexOf(base64String.charAt(i++));
                const b = base64Chars.indexOf(base64String.charAt(i++));
                const c = base64Chars.indexOf(base64String.charAt(i++));
                const d = base64Chars.indexOf(base64String.charAt(i++));
                
                // Combinar 4 valores de 6 bits en 3 valores de 8 bits
                const bitmap = (a << 18) | (b << 12) | (c << 6) | d;
                
                // Extraer los 3 bytes
                chars.push((bitmap >> 16) & 255);
                if (c != 64) chars.push((bitmap >> 8) & 255);    // Si no es padding
                if (d != 64) chars.push(bitmap & 255);           // Si no es padding
            }
            
            // Convertir array de bytes a Uint8Array y luego a ArrayBuffer
            return new Uint8Array(chars).buffer;
        };

        console.log('📤 Convirtiendo Base64 a ArrayBuffer...');
        const buffer = base64ToArrayBuffer(base64);
        console.log('✅ ArrayBuffer creado, tamaño:', buffer.byteLength, 'bytes');

        // ============================================
        // PASO 4: SUBIR A SUPABASE STORAGE
        // ============================================
        console.log('📤 Iniciando carga a Supabase Storage...');
        
        const { data, error } = await supabase.storage
            .from('uploads')  // ← Nombre del bucket en Supabase
            .upload(fileName, buffer, {
                contentType,      // Tipo MIME: 'image/jpeg', 'image/png', etc.
                cacheControl: '3600',  // Cache por 1 hora
                upsert: false,    // No sobrescribir si ya existe
            });

        if (error) {
            console.error('❌ Error de Supabase:', error);
            throw new Error(`Error al subir archivo: ${error.message}`);
        }

        console.log('✅ Archivo subido exitosamente');
        console.log('✅ Respuesta de Supabase:', data);

        // ============================================
        // PASO 5: CONSTRUIR Y RETORNAR URL PÚBLICA
        // ============================================
        // La URL pública sigue este patrón:
        // https://{PROJECT_ID}.supabase.co/storage/v1/object/public/{bucket}/{filePath}
        
        const publicUrl = `https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/${fileName}`;

        console.log('✅ URL pública del archivo:');
        console.log('✅', publicUrl);

        return publicUrl;

    } catch (error) {
        console.error('❌ Error en uploadReceiptToSupabase:', error);
        throw error;
    }
}

/**
 * FUNCIÓN AUXILIAR: Genera un nombre único para el archivo
 * 
 * Formato: comprobante-{saleId}-{timestamp}-{random}.{extension}
 * Ejemplo: comprobante-123-1731234567890-a1b2c3d4.jpg
 * 
 * El timestamp + random garantiza que no hay colisiones de nombres
 */
function generateReceiptFileName(saleId, extension = 'jpg') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 10);  // 8 caracteres aleatorios
    const ext = extension.toLowerCase().replace('.', '');
    return `comprobante-${saleId}-${timestamp}-${random}.${ext}`;
}

/**
 * FUNCIÓN AUXILIAR: Extrae la extensión de un URI
 * 
 * Ejemplo:
 * - 'file:///storage/emulated/0/image.jpg' → 'jpg'
 * - 'https://example.com/image.png?token=123' → 'png'
 * - Sin extensión → 'jpg' (por defecto)
 */
function getFileExtension(uri) {
    if (!uri) return 'jpg';
    
    // Remover parámetros query (después de ?)
    const cleanUri = uri.split('?')[0];
    
    // Buscar patrón: punto + caracteres alfanuméricos
    const match = cleanUri.match(/\.([a-zA-Z0-9]+)$/);
    
    if (match && match[1]) {
        return match[1].toLowerCase();
    }
    
    // Por defecto, asumir JPEG
    return 'jpg';
}

// ============================================
// FUNCIONES COMPLEMENTARIAS (BONUS)
// ============================================

/**
 * FUNCIÓN: Descarga un archivo desde Supabase Storage al almacenamiento local
 * Útil para descargar comprobantes cuando quieres verlos offline
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
 * FUNCIÓN: Verifica si una URL es de Supabase Storage
 */
export function isSupabaseUrl(url) {
    if (!url) return false;
    return url.includes('supabase.co/storage/v1/object/public/');
}

/**
 * FUNCIÓN: Verifica si una URL es local (file://)
 */
export function isLocalUrl(url) {
    if (!url) return false;
    return url.startsWith('file://');
}

// ============================================
// COMPARACIÓN: FormData vs ArrayBuffer
// ============================================

/*
POR QUÉ NO USAMOS FormData:

❌ FormData (No recomendado para Supabase):
const formData = new FormData();
formData.append('file', blob);
const response = await fetch('...', { method: 'POST', body: formData });

PROBLEMAS:
1. FormData es para multipart/form-data (más lento y pesado)
2. Supabase SDK ya maneja esto automáticamente
3. En React Native, FormData tiene soporte limitado
4. Necesitarías hacer una llamada HTTP manual

✅ ArrayBuffer (Recomendado para Supabase):
const buffer = base64ToArrayBuffer(base64);
const { data, error } = await supabase.storage.from('uploads').upload(fileName, buffer);

VENTAJAS:
1. Usa el método SDK nativo de Supabase (.upload())
2. Más eficiente (sin encoding extra)
3. Funciona perfecto en React Native
4. Manejo automático de headers (Content-Type, etc.)
5. Soporte para .upsert, .cacheControl, y más opciones
*/

// ============================================
// FLUJO DE INTEGRACIÓN EN TUS PANTALLAS
// ============================================

/*
// En SellScreen.js:
import { uploadReceiptToSupabase } from '../utils/supabaseStorage';

async function pay() {
    const proof = transferProof; // Imagen seleccionada
    
    if (proof && proof.kind === 'image') {
        try {
            const receiptUrl = await uploadReceiptToSupabase(
                proof.uri,  // ← URI local del archivo
                saleId      // ← ID único de la venta
            );
            
            // Guardar receiptUrl en la BD
            await recordSale(cart, {
                paymentMethod: 'transferencia',
                transferReceiptUri: receiptUrl,  // ← URL pública en Supabase
            });
        } catch (error) {
            Alert.alert('Error', `No se pudo subir el comprobante: ${error.message}`);
        }
    }
}

// En SalesHistoryScreen.js:
import { uploadReceiptToSupabase } from '../utils/supabaseStorage';

async function persistProof(localUri, displayName) {
    if (localUri.startsWith('file://')) {
        const uploadedUrl = await uploadReceiptToSupabase(
            localUri,
            detail.sale.id
        );
        
        // Actualizar BD local
        await updateSaleTransferReceipt(detail.sale.id, uploadedUrl, displayName);
    }
}
*/
