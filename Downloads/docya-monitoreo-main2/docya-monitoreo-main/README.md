# DocYa — Panel de Monitoreo

Panel interno de monitoreo y operaciones para DocYa, construido con **Next.js 15**, **Tailwind CSS v4** y diseño glassmorphism dark.

## Stack

- Next.js 15 (App Router)
- Tailwind CSS v4
- Lucide React (íconos)
- React Leaflet (mapa)
- date-fns (fechas)

## Instalación

```bash
npm install
```

## Variables de entorno

Copiá `.env.example` a `.env.local` y completá:

```
NEXT_PUBLIC_API_BASE=https://tu-api.docya.com.ar
```

## Desarrollo

```bash
npm run dev
```

## Build

```bash
npm run build
npm start
```

## Páginas

| Ruta | Descripción |
|------|-------------|
| `/login` | Autenticación |
| `/dashboard` | KPIs + mapa |
| `/monitoreo` | Mapa full-screen |
| `/consultas` | Historial de consultas |
| `/medicos` | Gestión de profesionales |
| `/liquidaciones` | Pagos semanales |
| `/usuarios` | Pacientes registrados |
