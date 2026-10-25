# Personal Treasury — Tu tesorería personal

Aplicación web de gestión de finanzas personales con distribución automática de presupuestos.

## Tecnologías

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS v4
- **Componentes**: Radix UI + Lucide Icons
- **Formularios**: React Hook Form + Zod
- **Gráficos**: Recharts
- **Auth & DB**: Supabase (PostgreSQL + Auth + RLS)
- **Deploy**: Cloudflare Pages

## Requisitos locales

- Node.js 18+ y npm
- Una cuenta gratuita en [Supabase](https://supabase.com)
- Git

## Instalación

### 1. Clonar el repositorio

```bash
git clone https://github.com/TU_USUARIO/personal-treasury.git
cd personal-treasury
npm install
```

### 2. Crear un proyecto en Supabase

1. Ve a [supabase.com](https://supabase.com) y crea una cuenta gratuita.
2. Crea un nuevo proyecto (elige la región más cercana).
3. Espera a que el proyecto se inicie.

### 3. Ejecutar la migración de base de datos

1. En Supabase, ve a **SQL Editor**.
2. Copia todo el contenido de `supabase/migrations/001_initial_schema.sql`.
3. Pégalo y ejecuta la consulta.
4. Verifica que todas las tablas se hayan creado en **Table Editor**.

### 4. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus valores de Supabase (los encuentras en **Project Settings > API**):

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key-aqui
```

> ⚠️ **Nunca** uses la clave `service_role` en el frontend. Solo usa la clave `anon`.

### 5. Configurar Google OAuth (opcional)

1. Ve a [Google Cloud Console](https://console.cloud.google.com).
2. Crea un proyecto y configura la pantalla de consentimiento OAuth.
3. Crea credenciales OAuth 2.0 (tipo: Aplicación web).
4. Añade la URL de callback: `https://tu-proyecto.supabase.co/auth/v1/callback`
5. En Supabase, ve a **Authentication > Providers > Google**.
6. Activa Google e introduce el Client ID y Client Secret.

### 6. Ejecución local

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`.

### 7. Despliegue en Cloudflare Pages

1. Sube el repositorio a GitHub.
2. Ve a [Cloudflare Pages](https://pages.cloudflare.com).
3. Conecta tu repositorio de GitHub.
4. Configura:
   - **Framework preset**: None
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
5. Añade las variables de entorno (`VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`).
6. Despliega.

### 8. URLs de autenticación

Después del despliegue, actualiza las URLs en Supabase:

1. **Authentication > URL Configuration**:
   - Site URL: `https://tu-dominio.pages.dev`
   - Redirect URLs: `https://tu-dominio.pages.dev/auth/callback`

2. Si usas Google OAuth, actualiza los Authorized redirect URIs en Google Cloud Console.

## Estructura del proyecto

```
src/
├── components/       # Componentes reutilizables
│   ├── ui/          # Sistema de diseño (Button, Card, Modal, etc.)
│   ├── layout/      # Layout principal con navegación
│   ├── auth/        # Protección de rutas
│   └── modals/      # Modales (AddMovement, AddIncome)
├── contexts/        # Proveedores de contexto (Auth, Theme, Toast)
├── lib/             # Utilidades (supabase, money, dates)
├── pages/           # Páginas organizadas por feature
│   ├── auth/        # Login, registro, callback
│   ├── onboarding/  # Configuración inicial
│   ├── dashboard/   # Vista principal
│   ├── treasury/    # Hoja de tesorería y detalle
│   ├── annual/      # Vista anual
│   ├── history/     # Historial de movimientos
│   ├── categories/  # Gestión de categorías
│   ├── recurring/   # Gastos periódicos
│   ├── savings/     # Objetivos de ahorro
│   ├── statistics/  # Estadísticas y gráficos
│   ├── settings/    # Configuración
│   └── profile/     # Perfil y privacidad
├── types/           # Tipos TypeScript
├── App.tsx          # Router principal
└── main.tsx         # Punto de entrada
```

## Seguridad

- **RLS (Row Level Security)**: Todas las tablas tienen políticas que verifican `auth.uid()`.
- **Validación**: Cliente (Zod) y servidor (constraints PostgreSQL).
- **Sin secretos en frontend**: Solo se usa la clave `anon` de Supabase.
- **Aislamiento**: Cada usuario solo puede ver y modificar sus propios datos.

## Limitaciones del plan gratuito de Supabase

- 500 MB de base de datos
- 1 GB de ancho de banda / mes
- 50.000 usuarios activos mensuales
- 2 proyectos gratuitos

## Licencia

MIT
