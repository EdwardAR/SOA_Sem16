-- ============================================================
-- SCHEMA — Sistema de Matrículas "Colegio San Andrés"
-- ============================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

-- ------------------------------------------------------------
-- 1. USUARIOS Y ROLES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS roles (
    id   INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre TEXT NOT NULL UNIQUE,          -- ADMIN, SECRETARIA, DOCENTE, APODERADO, FINANZAS
    descripcion TEXT
);

CREATE TABLE IF NOT EXISTS usuarios (
    id          TEXT PRIMARY KEY,         -- UUID
    nombre      TEXT NOT NULL,
    apellido    TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    rut         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    rol_id      INTEGER NOT NULL REFERENCES roles(id),
    activo      INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS auditoria (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    usuario_id  TEXT REFERENCES usuarios(id),
    accion      TEXT NOT NULL,
    entidad     TEXT NOT NULL,
    entidad_id  TEXT,
    detalle     TEXT,
    ip          TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- 2. ESTUDIANTES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS estudiantes (
    id              TEXT PRIMARY KEY,     -- UUID
    rut             TEXT NOT NULL UNIQUE,
    nombre          TEXT NOT NULL,
    apellido        TEXT NOT NULL,
    fecha_nacimiento TEXT NOT NULL,
    genero          TEXT,                 -- M / F / Otro
    direccion       TEXT,
    telefono        TEXT,
    email           TEXT,
    -- Médico
    grupo_sanguineo TEXT,
    alergias        TEXT,
    medicamentos    TEXT,
    seguro_medico   TEXT,
    -- Historial
    colegio_anterior TEXT,
    anio_cursado_anterior TEXT,
    estado          TEXT NOT NULL DEFAULT 'PREINSCRITO', -- PREINSCRITO, MATRICULADO, RETIRADO
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS apoderados (
    id          TEXT PRIMARY KEY,
    rut         TEXT NOT NULL,
    nombre      TEXT NOT NULL,
    apellido    TEXT NOT NULL,
    email       TEXT NOT NULL,
    telefono    TEXT NOT NULL,
    relacion    TEXT NOT NULL,            -- Padre, Madre, Tutor, etc.
    es_titular  INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS estudiante_apoderado (
    estudiante_id TEXT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
    apoderado_id  TEXT NOT NULL REFERENCES apoderados(id) ON DELETE CASCADE,
    PRIMARY KEY (estudiante_id, apoderado_id)
);

CREATE TABLE IF NOT EXISTS documentos (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    estudiante_id   TEXT NOT NULL REFERENCES estudiantes(id) ON DELETE CASCADE,
    tipo            TEXT NOT NULL,       -- FOTO, NACIMIENTO, BOLETIN, OTRO
    nombre_archivo  TEXT NOT NULL,
    ruta            TEXT NOT NULL,
    subido_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ------------------------------------------------------------
-- 4. CURSOS Y SECCIONES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS niveles (
    id      INTEGER PRIMARY KEY AUTOINCREMENT,
    nombre  TEXT NOT NULL UNIQUE,        -- PRE_BASICA, BASICA, MEDIA
    orden   INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS grados (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    nivel_id    INTEGER NOT NULL REFERENCES niveles(id),
    nombre      TEXT NOT NULL,           -- 1°, 2°, ... 12°
    orden       INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cursos (
    id              TEXT PRIMARY KEY,    -- UUID
    grado_id        INTEGER NOT NULL REFERENCES grados(id),
    seccion         TEXT NOT NULL,       -- A, B, C
    cupos_max       INTEGER NOT NULL DEFAULT 35,
    cupos_ocupados  INTEGER NOT NULL DEFAULT 0,
    activo          INTEGER NOT NULL DEFAULT 1,
    docente_id      TEXT REFERENCES usuarios(id),
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS horarios (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    curso_id    TEXT NOT NULL REFERENCES cursos(id) ON DELETE CASCADE,
    dia_semana  TEXT NOT NULL,           -- LUNES..VIERNES
    hora_inicio TEXT NOT NULL,           -- HH:MM
    hora_fin    TEXT NOT NULL,
    asignatura  TEXT NOT NULL
);

-- ------------------------------------------------------------
-- 6. CONFIGURACIÓN DEL AÑO ESCOLAR
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS anios_escolares (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    anio                INTEGER NOT NULL UNIQUE,
    fecha_inicio_matricula TEXT NOT NULL,
    fecha_fin_matricula    TEXT NOT NULL,
    fecha_inicio_clases    TEXT NOT NULL,
    fecha_fin_anio         TEXT NOT NULL,
    nota_min_aprobacion    REAL NOT NULL DEFAULT 4.0,
    max_asig_reprobadas    INTEGER NOT NULL DEFAULT 2,
    activo              INTEGER NOT NULL DEFAULT 0,
    publicado           INTEGER NOT NULL DEFAULT 0,
    created_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS costos_nivel (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    anio_escolar_id INTEGER NOT NULL REFERENCES anios_escolares(id),
    nivel_id        INTEGER NOT NULL REFERENCES niveles(id),
    costo_matricula REAL NOT NULL DEFAULT 0,
    mensualidad     REAL NOT NULL DEFAULT 0,
    descuento_pct   REAL NOT NULL DEFAULT 0,
    UNIQUE(anio_escolar_id, nivel_id)
);

-- ------------------------------------------------------------
-- 3. MATRÍCULAS Y PAGOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS matriculas (
    id              TEXT PRIMARY KEY,    -- UUID
    estudiante_id   TEXT NOT NULL REFERENCES estudiantes(id),
    curso_id        TEXT NOT NULL REFERENCES cursos(id),
    anio_escolar_id INTEGER NOT NULL REFERENCES anios_escolares(id),
    estado          TEXT NOT NULL DEFAULT 'PENDIENTE_PAGO', -- PENDIENTE_PAGO, PAGADA, ANULADA
    fecha_matricula TEXT,
    contrato_pdf    TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS pagos (
    id              TEXT PRIMARY KEY,    -- UUID
    matricula_id    TEXT NOT NULL REFERENCES matriculas(id),
    monto           REAL NOT NULL,
    medio_pago      TEXT NOT NULL,       -- EFECTIVO, TRANSFERENCIA, TARJETA
    estado          TEXT NOT NULL DEFAULT 'PENDIENTE', -- PENDIENTE, CONFIRMADO, RECHAZADO
    referencia      TEXT,
    comprobante_pdf TEXT,
    fecha_pago      TEXT,
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lista_espera (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    estudiante_id   TEXT NOT NULL REFERENCES estudiantes(id),
    grado_id        INTEGER NOT NULL REFERENCES grados(id),
    anio_escolar_id INTEGER NOT NULL REFERENCES anios_escolares(id),
    posicion        INTEGER NOT NULL,
    estado          TEXT NOT NULL DEFAULT 'ESPERA', -- ESPERA, ASIGNADO, CANCELADO
    created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
