# 🌐 Cómo Implementar Carga a Supabase en Diferentes Plataformas

Este documento muestra cómo replicar el método de carga de comprobantes en la app móvil (**Expo/React Native**) a otras plataformas como página web, aplicaciones de escritorio, o backends.

---

## 🎯 Contexto Actual (App Móvil - Expo)

```javascript
// ✅ IMPLEMENTACIÓN ACTUAL EN LA APP MÓVIL

import * as FileSystem from 'expo-file-system';
import { supabase } from '../supabaseClient';

export async function uploadReceiptToSupabase(localUri, saleId) {
    // 1. Leer archivo como Base64
    const base64 = await FileSystem.readAsStringAsync(localUri, {
        encoding: FileSystem.EncodingType.Base64,
    });
    
    // 2. Convertir Base64 a ArrayBuffer
    const buffer = base64ToArrayBuffer(base64);
    
    // 3. Generar nombre único
    const fileName = generateReceiptFileName(saleId, extension);
    
    // 4. Subir a Supabase Storage
    const { data, error } = await supabase.storage
        .from('uploads')
        .upload(fileName, buffer, {
            contentType: 'image/jpeg',
            cacheControl: '3600',
            upsert: false,
        });
    
    // 5. Retornar URL pública
    return `https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/${fileName}`;
}

// Detalles:
// - Usa ArrayBuffer (NO FormData)
// - Usa SDK de Supabase (.upload())
// - NO usa fetch() manual
// - Funciona en React Native/Expo
```

---

## 🌍 Opción 1: Página Web (React, Vue, Angular, Vanilla JS)

### ✅ Método 1A: Usando el SDK de Supabase (RECOMENDADO)

```javascript
/**
 * Página Web: Carga de archivos a Supabase usando SDK
 * Funciona en React, Vue, Angular, o JavaScript vanilla
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    'https://nuuoooqfbuwodagvmmsf.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
);

async function uploadReceiptWeb(file, saleId) {
    try {
        // 1. Convertir File a ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();
        
        // 2. Generar nombre único
        const fileName = generateReceiptFileName(saleId, file.name);
        
        // 3. Subir a Supabase
        const { data, error } = await supabase.storage
            .from('uploads')
            .upload(fileName, arrayBuffer, {
                contentType: file.type || 'image/jpeg',
                cacheControl: '3600',
                upsert: false,
            });
        
        if (error) throw error;
        
        // 4. Retornar URL pública
        const publicUrl = `https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/${fileName}`;
        return publicUrl;
        
    } catch (error) {
        console.error('Error subiendo archivo:', error);
        throw error;
    }
}

// USO EN HTML:
// <input type="file" id="fileInput" accept="image/*" />
// <button onclick="handleFileUpload()">Subir</button>

async function handleFileUpload() {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (file) {
        const url = await uploadReceiptWeb(file, 'sale-123');
        console.log('URL subida:', url);
        // Guardar URL en BD
    }
}
```

**Ventajas:**
- ✅ Mismo código que app móvil
- ✅ Función nativa `file.arrayBuffer()`
- ✅ SDK maneja todo automáticamente
- ✅ Funciona en todos los navegadores modernos

**Navegadores soportados:**
- Chrome 76+
- Firefox 67+
- Safari 14+
- Edge 79+

---

### ✅ Método 1B: Con FormData (Alternativa compatible)

```javascript
/**
 * Página Web: Carga con FormData (compatibilidad)
 * Funciona en navegadores antiguos, pero menos eficiente
 */

async function uploadReceiptWebFormData(file, saleId) {
    try {
        const fileName = generateReceiptFileName(saleId, file.name);
        
        // Usar FormData
        const formData = new FormData();
        formData.append('file', file);
        
        // Subir manualmente (sin SDK)
        const response = await fetch(
            `https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/uploads/${fileName}`,
            {
                method: 'PUT',
                headers: {
                    'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
                    'x-upsert': 'false'
                },
                body: file  // Supabase también acepta File directamente
            }
        );
        
        if (!response.ok) throw new Error('Upload failed');
        
        return `https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/${fileName}`;
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
}
```

**NOTA:** FormData es innecesario con Supabase SDK. Usa **Método 1A**.

---

## 🖥️ Opción 2: Aplicación de Escritorio (Electron, Tauri, .NET)

### Electron (JavaScript + Node.js)

```javascript
/**
 * Electron: Cargar archivo desde sistema de archivos
 * Funciona en Windows, macOS, Linux
 */

const { ipcMain } = require('electron');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
    'https://nuuoooqfbuwodagvmmsf.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
);

ipcMain.handle('upload-receipt', async (event, filePath, saleId) => {
    try {
        // 1. Leer archivo del sistema
        const fileBuffer = fs.readFileSync(filePath);
        
        // 2. Generar nombre
        const ext = path.extname(filePath).slice(1);
        const fileName = generateReceiptFileName(saleId, ext);
        
        // 3. Subir a Supabase
        const { data, error } = await supabase.storage
            .from('uploads')
            .upload(fileName, fileBuffer, {
                contentType: 'image/jpeg',  // Detectar según extensión
                cacheControl: '3600',
                upsert: false,
            });
        
        if (error) throw error;
        
        return `https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/${fileName}`;
        
    } catch (error) {
        console.error('Error:', error);
        throw error;
    }
});

// En el renderer process:
const url = await window.electron.uploadReceipt(filePath, 'sale-123');
```

### .NET / C# (Windows, macOS, Linux)

```csharp
// C#/.NET: Subir archivo usando HttpClient

using Supabase;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;

public class SupabaseReceiptUploader
{
    private readonly Client _supabase;
    private const string BucketName = "uploads";
    private const string SupabaseUrl = "https://nuuoooqfbuwodagvmmsf.supabase.co";
    private const string SupabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

    public SupabaseReceiptUploader()
    {
        var options = new SupabaseOptions { AutoConnectRealtime = true };
        _supabase = new Client(SupabaseUrl, SupabaseKey, options);
    }

    public async Task<string> UploadReceiptAsync(string filePath, int saleId)
    {
        try
        {
            // 1. Leer archivo
            var fileBytes = await File.ReadAllBytesAsync(filePath);
            var fileName = GenerateReceiptFileName(saleId, Path.GetExtension(filePath));
            
            // 2. Subir a Supabase
            var result = await _supabase.Storage
                .From(BucketName)
                .Upload(fileBytes, fileName, new FileOptions
                {
                    ContentType = "image/jpeg",
                    CacheControl = "3600",
                    Upsert = false
                });
            
            // 3. Retornar URL pública
            var publicUrl = $"{SupabaseUrl}/storage/v1/object/public/{BucketName}/{fileName}";
            return publicUrl;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error: {ex.Message}");
            throw;
        }
    }

    private string GenerateReceiptFileName(int saleId, string extension)
    {
        var timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();
        var random = new Random().Next(10000000, 99999999);
        var ext = extension.TrimStart('.').ToLower();
        return $"comprobante-{saleId}-{timestamp}-{random:x8}.{ext}";
    }
}

// Uso:
var uploader = new SupabaseReceiptUploader();
var url = await uploader.UploadReceiptAsync("C:\\temp\\image.jpg", 123);
```

---

## 🔌 Opción 3: Backend API (Node.js, Python, Go)

### Node.js/Express

```javascript
/**
 * Backend API: Endpoint para subir comprobantes
 * POST /api/receipts/upload
 */

const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const supabase = createClient(
    'https://nuuoooqfbuwodagvmmsf.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
);

// Endpoint: POST /api/receipts/upload
app.post('/api/receipts/upload', upload.single('file'), async (req, res) => {
    try {
        const { saleId } = req.body;
        const file = req.file;
        
        if (!file) {
            return res.status(400).json({ error: 'No file provided' });
        }
        
        // Generar nombre único
        const ext = file.originalname.split('.').pop();
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 10);
        const fileName = `comprobante-${saleId}-${timestamp}-${random}.${ext}`;
        
        // Subir a Supabase Storage
        const { data, error } = await supabase.storage
            .from('uploads')
            .upload(fileName, file.buffer, {
                contentType: file.mimetype,
                cacheControl: '3600',
                upsert: false,
            });
        
        if (error) throw error;
        
        // Retornar URL pública
        const publicUrl = `https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/${fileName}`;
        
        res.json({
            success: true,
            url: publicUrl,
            fileName: fileName
        });
        
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Usar desde frontend:
// const formData = new FormData();
// formData.append('file', file);
// formData.append('saleId', '123');
// const response = await fetch('/api/receipts/upload', { method: 'POST', body: formData });
// const { url } = await response.json();
```

### Python/FastAPI

```python
"""
Backend API: Python/FastAPI para subir comprobantes
POST /api/receipts/upload
"""

from fastapi import FastAPI, UploadFile, File, Form
from supabase import create_client
import os
from datetime import datetime
import random
import string

app = FastAPI()

supabase = create_client(
    'https://nuuoooqfbuwodagvmmsf.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
)

@app.post("/api/receipts/upload")
async def upload_receipt(file: UploadFile = File(...), saleId: str = Form(...)):
    try:
        # Leer archivo
        contents = await file.read()
        
        # Generar nombre único
        ext = file.filename.split('.')[-1].lower()
        timestamp = int(datetime.now().timestamp() * 1000)
        random_str = ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))
        file_name = f"comprobante-{saleId}-{timestamp}-{random_str}.{ext}"
        
        # Subir a Supabase Storage
        response = supabase.storage.from_("uploads").upload(
            path=file_name,
            file=contents,
            file_options={
                "content-type": file.content_type,
                "cache-control": "3600",
                "x-upsert": "false"
            }
        )
        
        # Construir URL pública
        public_url = f"https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/{file_name}"
        
        return {
            "success": True,
            "url": public_url,
            "fileName": file_name
        }
        
    except Exception as e:
        return {"error": str(e)}, 500
```

### Go/Gin

```go
/*
Backend API: Go/Gin para subir comprobantes
POST /api/receipts/upload
*/

package main

import (
    "fmt"
    "io/ioutil"
    "math/rand"
    "strings"
    "time"
    
    "github.com/gin-gonic/gin"
    "github.com/supabase-community/supabase-go"
)

var supabaseClient *supabase.Client

func init() {
    supabaseClient = supabase.CreateClient(
        "https://nuuoooqfbuwodagvmmsf.supabase.co",
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    )
}

func uploadReceipt(c *gin.Context) {
    // Obtener archivo
    file, err := c.FormFile("file")
    if err != nil {
        c.JSON(400, gin.H{"error": "No file provided"})
        return
    }
    
    saleId := c.PostForm("saleId")
    
    // Leer contenido del archivo
    src, _ := file.Open()
    defer src.Close()
    contents, _ := ioutil.ReadAll(src)
    
    // Generar nombre único
    ext := strings.Split(file.Filename, ".")[len(strings.Split(file.Filename, "."))-1]
    timestamp := time.Now().UnixMilli()
    randomStr := fmt.Sprintf("%08x", rand.Uint64())
    fileName := fmt.Sprintf("comprobante-%s-%d-%s.%s", saleId, timestamp, randomStr, ext)
    
    // Subir a Supabase (nota: implementación puede variar según cliente Go)
    // response, err := supabaseClient.Storage.Upload(fileName, contents)
    
    publicUrl := fmt.Sprintf(
        "https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/%s",
        fileName,
    )
    
    c.JSON(200, gin.H{
        "success": true,
        "url": publicUrl,
        "fileName": fileName,
    })
}

func main() {
    router := gin.Default()
    router.POST("/api/receipts/upload", uploadReceipt)
    router.Run(":8000")
}
```

---

## 📋 Tabla Comparativa de Métodos

| Plataforma | Lectura de Archivo | Formato | Método SDK | Soporte |
|-----------|-------------------|--------|-----------|---------|
| **Expo/React Native** | `FileSystem.readAsStringAsync()` → Base64 | Base64 → ArrayBuffer | `.upload(fileName, buffer)` | ✅ Nativo |
| **Página Web (React/Vue)** | `file.arrayBuffer()` | ArrayBuffer | `.upload(fileName, arrayBuffer)` | ✅ Nativo |
| **Electron** | `fs.readFileSync()` | Buffer | `.upload(fileName, buffer)` | ✅ Nativo |
| **C#/.NET** | `File.ReadAllBytesAsync()` | byte[] | `.Upload()` | ✅ Librería |
| **Node.js/Express** | `multer` middleware | Buffer | `.upload(fileName, buffer)` | ✅ Nativo |
| **Python/FastAPI** | `await file.read()` | bytes | `.upload()` | ✅ Librería |
| **Go/Gin** | `ioutil.ReadAll()` | []byte | Manual HTTP | ⚠️ Comunidad |

---

## 🎯 Lo Más Importante

Todos los métodos tienen en común:

1. **Leer el archivo** → bytes/buffer
2. **Generar nombre único** → comprobante-{id}-{timestamp}-{random}.jpg
3. **Usar SDK `.upload()`** → Supabase maneja headers automáticamente
4. **Construir URL** → `https://...uploads/{fileName}`
5. **Guardar en BD** → URL pública

**NO importa la plataforma, el concepto es idéntico:**
- ❌ No FormData
- ❌ No fetch() manual
- ✅ ArrayBuffer/Buffer + SDK
- ✅ URL pública para guardar en BD

---

## 🚀 Recomendación

**Para cualquier nueva plataforma:**
1. Busca cómo leer archivo → bytes/buffer
2. Usa `supabase.storage.from('uploads').upload(fileName, buffer, options)`
3. Construye URL: `https://nuuoooqfbuwodagvmmsf.supabase.co/storage/v1/object/public/uploads/{fileName}`
4. Guarda URL en BD

**Listo.** El resto es detalles específicos del lenguaje.

---

**Última actualización:** 20 de Noviembre de 2025
