# 🔧 Solución para Error de Row-Level Security (RLS)

## Error Detectado:
```
WARN push categories error {"code": "42501", "details": null, "hint": null, "message": "new row violates row-level security policy (USING expression) for table \"categories\""}
```

## Problema:
La tabla `categories` en Supabase tiene políticas de seguridad (RLS) que impiden insertar nuevas categorías.

## ✅ Solución 1: Deshabilitar RLS para categories (RÁPIDO)

### Ejecutar en Supabase SQL Editor:

```sql
-- Deshabilitar RLS para la tabla categories
ALTER TABLE categories DISABLE ROW LEVEL SECURITY;
```

## ✅ Solución 2: Crear política permisiva (RECOMENDADO)

### Ejecutar en Supabase SQL Editor:

```sql
-- Crear política para permitir inserción de categorías
CREATE POLICY "Allow categories insert" ON categories
FOR INSERT WITH CHECK (true);

-- Crear política para permitir lectura de categorías  
CREATE POLICY "Allow categories select" ON categories
FOR SELECT USING (true);

-- Crear política para permitir actualización de categorías
CREATE POLICY "Allow categories update" ON categories  
FOR UPDATE USING (true);
```

## ✅ Solución 3: Política basada en autenticación

### Si quieres más seguridad:

```sql
-- Solo usuarios autenticados pueden modificar categorías
CREATE POLICY "Authenticated users can manage categories" ON categories
FOR ALL USING (auth.role() = 'authenticated');
```

## 🎯 Recomendación:

**Usar Solución 2** - Es la más segura y funcional.

## 📝 Pasos:

1. **Ir a tu proyecto Supabase:** https://supabase.com/dashboard
2. **Navegar a:** SQL Editor
3. **Ejecutar el código de la Solución 2**
4. **Probar la sincronización nuevamente**

## ⚠️ Nota:

Este error **NO afecta la funcionalidad principal** de la app. Las categorías predeterminadas ya funcionan, solo no se pueden sincronizar nuevas categorías al servidor.

## 🎉 Estado actual:

- ✅ App funcionando correctamente
- ✅ Base de datos local funcionando
- ✅ Sincronización de productos: OK
- ✅ Sincronización de ventas: OK  
- ⚠️ Sincronización de categorías: Error RLS (solucionable)
- ✅ Todas las funcionalidades principales: FUNCIONANDO