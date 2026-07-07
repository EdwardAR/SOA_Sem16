# 🏫 Sistema de Matrículas — Colegio San Andrés

Sistema web de gestión de matrículas escolares con autenticación por roles, diseñado para administrar estudiantes, cursos, matrículas, pagos y reportes.

## Requisitos

- **Node.js** 18+ 
- **npm**

## Instalación

```bash
npm install
```

## Configurar base de datos

```bash
npm run setup
```

Esto crea las tablas y carga datos de ejemplo.

## Ejecutar

```bash
npm start
```

El servidor corre en `http://localhost:3000`.

## Credenciales de prueba

| Rol         | Email                       | Contraseña   |
|-------------|-----------------------------|--------------|
| Admin       | admin@sanandres.cl          | Admin2024!   |
| Secretaría  | secretaria@sanandres.cl     | Secre2024!   |
| Docente     | rfuentes@sanandres.cl       | Docente2024! |
| Finanzas    | vsoto@sanandres.cl          | Finanzas2024!|
| Apoderado   | jherrera.apod@gmail.com     | Apod2024!    |

## Estructura

```
src/
├── server.js         # Servidor Express
├── db/               # Base de datos SQLite
│   ├── schema.sql    # Esquema de tablas
│   ├── database.js   # Conexión
│   ├── migrate.js    # Migración
│   └── seed.js       # Datos de ejemplo
├── routes/           # API REST
│   ├── auth.js       # Login/logout
│   ├── usuarios.js   # CRUD usuarios
│   ├── estudiantes.js
│   ├── cursos.js     # Cursos + horarios
│   ├── matriculas.js # Matrículas + pagos
│   ├── anios.js      # Años escolares + costos
│   └── reportes.js   # Dashboard y reportes
├── middleware/
│   ├── auth.js       # JWT + roles
│   └── audit.js      # Log de auditoría
public/               # Frontend SPA
├── index.html
├── style.css
└── app.js
```

## API

Todas las rutas bajo `/api/` requieren token JWT (`Authorization: Bearer <token>`).

- `POST /api/auth/login` — Iniciar sesión
- `GET /api/reportes/dashboard` — Métricas principales
- `GET /api/reportes/vacantes` — Vacantes por curso
- `GET /api/reportes/pagos` — Reporte de pagos
- `GET /api/reportes/comparativa` — Comparativa por años
- `GET /api/reportes/matriculados` — Listado de matriculados
