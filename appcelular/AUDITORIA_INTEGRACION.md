# 🔍 AUDITORÍA DE INTEGRACIÓN - App Móvil y Tienda Web

**Fecha:** 28 de Octubre, 2025  
**Proyectos:**
- **App Móvil:** `appcelular` (React Native + SQLite + Supabase)
- **Tienda Web:** `tienda-web-clean` (Next.js 15 + Supabase)
- **Backend Compartido:** Supabase PostgreSQL

---

## ✅ RESUMEN EJECUTIVO

### Estado General: ⚠️ INTEGRACIÓN PARCIAL CON PROBLEMAS CRÍTICOS

**Problemas Críticos Encontrados:** 7  
**Problemas Moderados:** 4  
**Mejoras Recomendadas:** 5

---

## 🚨 PROBLEMAS CRÍTICOS (Requieren atención inmediata)

### 1. **SISTEMAS DE AUTENTICACIÓN COMPLETAMENTE SEPARADOS** 🔴
**Severidad:** CRÍTICA  
**Impacto:** Los usuarios de la app móvil NO pueden acceder a la tienda web y viceversa

**Problema:**
- **App Móvil:** Usa sistema local con `AsyncStorage`, sin tabla `users` en Supabase
  - Usuarios: MARIANA, INGRID, ALFREDO, FABRICIO, MARIA, PRUEBAS
  - Almacenados solo en el dispositivo móvil
  - Sin contraseñas, solo validación por nombre
  - No se sincronizan con Supabase

- **Tienda Web:** Usa NextAuth con tabla `users` en Supabase
  - Requiere email + contraseña con hash bcrypt
  - Soporta login con Google OAuth
  - Usuarios almacenados en Supabase `users` table
  - Sistema de roles (USER, ADMIN)

**Consecuencias:**
- ❌ Los vendedores de la app móvil no pueden acceder al panel admin web
- ❌ Los administradores web no pueden ver qué vendedor hizo cada venta
- ❌ No hay trazabilidad de usuarios entre sistemas
- ❌ Imposible implementar permisos o auditoría consistente

**Solución Recomendada:**
1. Crear tabla `sellers` o `staff` en Supabase para usuarios móviles
2. Migrar usuarios actuales de AsyncStorage a Supabase
3. Implementar autenticación Supabase Auth en la app móvil
4. Mantrar sistema simple (sin contraseña) pero con persistencia en Supabase

---

### 2. **FALTA COLUMNA image_url EN TABLA products** 🔴
**Severidad:** CRÍTICA  
**Impacto:** La tienda web NO puede mostrar imágenes de productos

**Problema:**
```typescript
// Tienda web espera:
export type SupaProduct = {
  barcode: string;
  image_url?: string | null;  // ❌ Esta columna NO existe en Supabase
  gallery?: any | null;         // ❌ Esta columna NO existe en Supabase
  // ... otros campos
};
```

**Estado actual:**
- La tabla `products` en Supabase NO tiene columna `image_url`
- La tabla `products` NO tiene columna `gallery`
- La tienda web carga imágenes pero siempre usa fallback genérico
- La app móvil tiene `ProductPhotoEditor` pero las fotos NO se suben a Supabase

**Consecuencias:**
- ❌ Todos los productos en la tienda web muestran imagen genérica
- ❌ Las fotos tomadas en la app móvil NO se comparten con la web
- ❌ Mala experiencia de usuario en el e-commerce

**Solución Recomendada:**
```sql
-- Agregar columnas de imagen a products
ALTER TABLE products 
ADD COLUMN image_url TEXT,
ADD COLUMN gallery JSONB;

-- Crear bucket de storage en Supabase
-- Configurar políticas RLS para el bucket
```

---

### 3. **INCONSISTENCIA EN ESTRUCTURA DE CATEGORÍAS** 🔴
**Severidad:** CRÍTICA  
**Impacto:** Las categorías no se sincronizan correctamente

**Problema:**
- **App Móvil:** `products.category` es TEXT simple (ej: "Bebidas")
- **Tienda Web:** `products.categories` es ARRAY de strings (ej: ["Bebidas", "Refrescos"])

```javascript
// App móvil - sync.js
localProducts.map(p => ({
  category: p.category,  // ❌ TEXT simple
}))

// Tienda web - products.ts
const cats = category
  ? category.split(/[,/|]/).map(c => c.trim())  // ⚠️ Intenta parsear
  : [];
```

**Consecuencias:**
- ⚠️ Productos con múltiples categorías en la web se sincronizan mal a móvil
- ⚠️ Filtros de categoría pueden no funcionar correctamente
- ⚠️ Búsquedas por categoría inconsistentes

**Solución Recomendada:**
1. **Opción A (Recomendada):** Cambiar app móvil para soportar múltiples categorías
2. **Opción B:** Definir separador estándar (ej: ",") y usarlo consistentemente
3. Migrar datos existentes al formato elegido

---

### 4. **FALTA FUNCIÓN apply_sale EN SUPABASE** 🔴
**Severidad:** CRÍTICA  
**Impacto:** Las ventas de la app móvil NO se pueden sincronizar

**Problema:**
```javascript
// App móvil llama a función que debe existir en Supabase
const { data, error } = await supabase.rpc('apply_sale', payload);
```

**Verificación necesaria:**
- ✅ La función `apply_sale` existe (ya la arreglamos en scripts anteriores)
- ⚠️ Pero necesita verificar que acepte los parámetros correctos

**Parámetros que envía la app:**
```javascript
{
  p_total: number,
  p_payment_method: string,
  p_cash_received: number,
  p_change_given: number,
  p_discount: number,
  p_tax: number,
  p_notes: string,
  p_device_id: string,
  p_client_sale_id: string,
  p_items: JSON,        // ❌ PROBLEMA: items_json no existe
  p_timestamp: ISO string
}
```

**Solución Recomendada:**
- Verificar firma de `apply_sale`
- Crear tabla `sale_items` para almacenar items de cada venta
- Actualizar función para procesar array de items

---

### 5. **NO HAY TABLA users EN SUPABASE** 🔴
**Severidad:** CRÍTICA  
**Impacto:** La tienda web no puede funcionar

**Problema:**
```typescript
// auth-users.ts intenta leer de tabla users
const { data } = await supabaseAdmin
  .from("users")  // ❌ Esta tabla NO existe
  .select("*")
```

**Verificación:**
- La tienda web REQUIERE tabla `users` con estructura:
  ```sql
  CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT,
    role TEXT DEFAULT 'USER',
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
  );
  ```

**Estado actual:**
- ❌ Tabla `users` NO existe en Supabase
- ❌ Login en tienda web FALLA
- ❌ Registro de nuevos usuarios FALLA
- ❌ Google OAuth FALLA al intentar guardar usuario

**Solución Recomendada:**
Ejecutar script de creación de tabla `users` con RLS

---

## ⚠️ PROBLEMAS MODERADOS

### 6. **Falta integración de imágenes de productos**
**Severidad:** MODERADA  
**Descripción:**
- App móvil tiene `ProductPhotoEditor` pero las fotos se quedan locales
- No hay bucket de Supabase Storage configurado
- Falta endpoint para subir imágenes desde la app

**Solución:**
- Configurar Supabase Storage bucket "products"
- Crear función en app móvil para subir a Storage
- Actualizar `image_url` al subir foto

---

### 7. **Inconsistencia en nombres de campos de ventas**
**Severidad:** MODERADA  
**Descripción:**
```javascript
// App móvil espera estos campos
sale: {
  ts: number,           // ✅ Existe en Supabase
  total: number,        // ✅ Existe
  payment_method: string, // ✅ Existe
  items_json: string,   // ❌ NO existe en Supabase
  client_sale_id: string // ✅ Existe
}
```

**Solución:**
- Crear tabla `sale_items` relacionada
- O agregar columna `items` tipo JSONB a tabla `sales`

---

### 8. **No hay tabla de sincronización de dispositivos**
**Severidad:** MODERADA  
**Descripción:**
- Cada dispositivo móvil genera su propio `device_id`
- No hay tabla en Supabase para registrar dispositivos
- Imposible saber qué dispositivos están activos

**Solución:**
```sql
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  name TEXT,
  last_sync TIMESTAMPTZ,
  user_id UUID REFERENCES users(id),
  active BOOLEAN DEFAULT true
);
```

---

### 9. **Falta columna featured en tabla products**
**Severidad:** MODERADA  
**Descripción:**
- Tienda web usa `product.featured` para destacar productos
- Esta columna NO existe en tabla Supabase
- Productos destacados no funcionan

**Solución:**
```sql
ALTER TABLE products 
ADD COLUMN featured BOOLEAN DEFAULT false,
ADD COLUMN reorder_threshold INTEGER;
```

---

## 💡 MEJORAS RECOMENDADAS

### 10. Implementar sistema de roles consistente
- Definir roles: ADMIN, SELLER, USER
- App móvil: solo SELLER
- Tienda web: ADMIN y USER
- Relacionar ventas con usuario que la realizó

### 11. Agregar timestamps consistentes
```sql
ALTER TABLE products 
ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE sales
ADD COLUMN created_at TIMESTAMPTZ DEFAULT now();
```

### 12. Crear vista unificada de inventario
```sql
CREATE VIEW inventory_status AS
SELECT 
  p.*,
  COALESCE(SUM(si.quantity), 0) as total_sold,
  p.stock - COALESCE(SUM(si.quantity), 0) as current_stock
FROM products p
LEFT JOIN sale_items si ON si.product_id = p.barcode
GROUP BY p.id;
```

### 13. Implementar caché de sincronización
- Guardar último timestamp de sync exitoso
- Reducir queries innecesarias
- Mejorar performance

### 14. Agregar manejo de conflictos
- Qué pasa si dos dispositivos modifican el mismo producto
- Estrategia: último en escribir gana
- Agregar columna `version` para detectar conflictos

---

## 📊 COMPARACIÓN DE ESQUEMAS

### Tabla `products`

| Campo | App Móvil (SQLite) | Supabase (Actual) | Tienda Web (Espera) |
|-------|-------------------|-------------------|---------------------|
| id | INTEGER PK | - | ✅ |
| barcode | TEXT UNIQUE | TEXT PK | ✅ |
| name | TEXT | TEXT | ✅ |
| category | TEXT | TEXT | ❌ Espera `categories[]` |
| purchase_price | REAL | REAL | ✅ |
| sale_price | REAL | REAL | ✅ |
| expiry_date | TEXT | TEXT | ✅ |
| stock | REAL | INTEGER | ✅ |
| updated_at | INTEGER | TIMESTAMPTZ | ✅ |
| sold_by_weight | INTEGER | - | ❌ No sincroniza |
| image_url | - | ❌ NO EXISTE | ✅ REQUERIDO |
| gallery | - | ❌ NO EXISTE | ✅ REQUERIDO |
| featured | - | ❌ NO EXISTE | ✅ REQUERIDO |
| reorder_threshold | - | ❌ NO EXISTE | ✅ |

### Tabla `sales`

| Campo | App Móvil | Supabase | Sincroniza |
|-------|-----------|----------|------------|
| id | INTEGER PK | BIGINT PK | ✅ |
| ts | INTEGER | TIMESTAMPTZ | ✅ |
| total | REAL | NUMERIC | ✅ |
| payment_method | TEXT | TEXT | ✅ |
| cash_received | REAL | NUMERIC | ✅ |
| change_given | REAL | NUMERIC | ✅ |
| discount | REAL | NUMERIC | ✅ |
| tax | REAL | NUMERIC | ✅ |
| notes | TEXT | TEXT | ✅ |
| voided | INTEGER | - | ❌ |
| items_json | TEXT | ❌ NO EXISTE | ❌ |
| device_id | - | TEXT | ✅ |
| client_sale_id | - | TEXT | ✅ |
| seller_id | - | ❌ FALTA | ❌ |

### Tabla `users` 

| Tabla | App Móvil | Tienda Web |
|-------|-----------|------------|
| Existe | ❌ NO | ✅ SÍ (Supabase) |
| Autenticación | AsyncStorage local | NextAuth + Supabase |
| Tipo | Nombres simples | Email + Password |
| Compartida | ❌ NO | - |

---

## 🎯 PLAN DE ACCIÓN PRIORITARIO

### Fase 1: Correcciones Críticas (1-2 días)

1. **Crear tabla `users` en Supabase**
   ```sql
   CREATE TABLE users (...);
   ```

2. **Agregar columnas de imagen a `products`**
   ```sql
   ALTER TABLE products 
   ADD COLUMN image_url TEXT,
   ADD COLUMN gallery JSONB,
   ADD COLUMN featured BOOLEAN DEFAULT false;
   ```

3. **Crear tabla `sale_items`**
   ```sql
   CREATE TABLE sale_items (
     id BIGSERIAL PRIMARY KEY,
     sale_id BIGINT REFERENCES sales(id),
     product_barcode TEXT REFERENCES products(barcode),
     quantity NUMERIC NOT NULL,
     unit_price NUMERIC NOT NULL,
     subtotal NUMERIC NOT NULL
   );
   ```

4. **Actualizar función `apply_sale`**
   - Que inserte items en `sale_items`
   - Que actualice stock automáticamente

### Fase 2: Integración de Autenticación (2-3 días)

5. **Crear tabla `sellers` para usuarios móviles**
   ```sql
   CREATE TABLE sellers (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     name TEXT UNIQUE NOT NULL,
     user_id UUID REFERENCES users(id),
     active BOOLEAN DEFAULT true,
     device_id TEXT
   );
   ```

6. **Migrar usuarios de AsyncStorage a Supabase**
   - Script de migración
   - Mantener UX simple en app móvil
   
7. **Relacionar ventas con vendedor**
   ```sql
   ALTER TABLE sales ADD COLUMN seller_id UUID REFERENCES sellers(id);
   ```

### Fase 3: Sincronización de Imágenes (1-2 días)

8. **Configurar Supabase Storage**
   - Bucket "products"
   - Políticas RLS

9. **Implementar subida de imágenes en app móvil**
   - Función `uploadProductImage()`
   - Actualizar `image_url` en Supabase

10. **Optimizar carga de imágenes en tienda web**

### Fase 4: Mejoras y Optimización (1-2 días)

11. **Implementar caché de sincronización**
12. **Agregar manejo de errores robusto**
13. **Testing de integración completo**
14. **Documentación de API**

---

## 🔧 SCRIPTS SQL NECESARIOS

Voy a crear los scripts SQL necesarios para implementar las correcciones...

---

## 📝 RECOMENDACIONES FINALES

1. **Priorizar autenticación unificada** - Es la base para todo lo demás
2. **Implementar `sale_items` antes que `items_json`** - Más escalable
3. **Usar Supabase Storage para imágenes** - Evitar base64 en DB
4. **Establecer convención para categorías** - Decidir: ¿array o text?
5. **Crear tests de integración** - Validar que sync funcione bien
6. **Monitorear logs de sync** - Detectar problemas temprano

---

## ✅ PRÓXIMOS PASOS

1. ¿Quieres que cree los scripts SQL para corregir los problemas críticos?
2. ¿Prefieres empezar por autenticación o por imágenes?
3. ¿Necesitas ayuda con la migración de datos existentes?

