# 🫒 TECNO-OLIVO / OlivoMarket

Sistema integral para minimarket: App móvil de inventario + Panel web administrativo y e-commerce.

---

## 📦 Repositorios

| Proyecto | Repo | Rama |
|---|---|---|
| **App Móvil (React Native / Expo)** | [inventario-app](https://github.com/fabricioseidel/inventario-app) | `master` |
| **Panel Web + E-commerce (Next.js)** | [OlivoWeb](https://github.com/fabricioseidel/OlivoWeb) | `main` |

### Clonar

```bash
git clone --recurse-submodules https://github.com/fabricioseidel/inventario-app.git TECNO-OLIVO
```

---

## 🏗️ Arquitectura

```
TECNO-OLIVO/
├── App.js                         ← App móvil (entry point)
├── src/
│   ├── db.js                      ← SQLite offline-first
│   ├── supabaseClient.js          ← Sync con Supabase
│   ├── sync.js                    ← Lógica de sincronización
│   ├── screens/                   ← Pantallas móvil
│   └── ui/                        ← Componentes UI
├── OlivoWeb-fix/                  ← Panel Web (Next.js 15)
│   └── src/app/
│       ├── admin/                 ← Panel admin (productos, caja, ventas, POS)
│       ├── api/                   ← API routes
│       ├── carrito/ | checkout/   ← E-commerce
│       └── ofertas/ | productos/  ← Catálogo
└── vendor/                        ← Submodules
```

---

## 🚀 Inicio Rápido

### Panel Web (Next.js)

```bash
cd OlivoWeb-fix
npm install
# Crear .env.local (ver CREDENCIALES_Y_SETUP.md)
npm run dev         # → http://localhost:3000
```

### App Móvil (Expo)

```bash
npm install
npm start           # Expo dev client
```

### Compilar APK

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

---

## 🔧 Stack Tecnológico

### Panel Web
- Next.js 15 (App Router + TurboPack)
- Supabase (PostgreSQL + Auth + Storage)
- NextAuth + Google OAuth
- TailwindCSS 4
- Resend (email transaccional)
- Cloudinary (imágenes)
- Vercel (deploy)

### App Móvil
- React Native 0.71.14
- Expo SDK 48
- SQLite (offline-first)
- Supabase JS

---

## ⚙️ Configuración de Entorno

Las credenciales y variables de entorno están documentadas en el archivo **`CREDENCIALES_Y_SETUP.md`** (local, no se sube al repo).

Este archivo incluye:
- Todas las variables de `.env.local`
- Credenciales de Supabase, Google OAuth, Cloudinary, Resend
- PINs de acceso de la app móvil
- URLs de dashboards (Vercel, Supabase, etc.)
- Checklist completo de migración de equipo

> **Al migrar de equipo:** Copiar `CREDENCIALES_Y_SETUP.md` al nuevo equipo y seguir el checklist incluido.

---

## 📋 Funcionalidades

### App Móvil
- ✅ Escaneo de códigos de barras
- ✅ CRUD de productos con SQLite
- ✅ Gestión de caja (apertura/cierre/retiros)
- ✅ Ventas con múltiples métodos de pago
- ✅ Historial y anulación de ventas
- ✅ Exportación CSV / JSON
- ✅ Sincronización con Supabase

### Panel Web
- ✅ Dashboard administrativo
- ✅ POS (Punto de Venta) con subida de comprobantes
- ✅ Gestión de inventario y proveedores
- ✅ Importación masiva desde Excel
- ✅ E-commerce con carrito y checkout
- ✅ Emails automáticos (confirmación, bienvenida, carrito abandonado)
- ✅ Sistema de puntos de fidelidad
- ✅ Reportes y gráficos de ventas

---

> **Última actualización:** 2026-04-11
