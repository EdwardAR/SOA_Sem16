const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
router.use(authMiddleware);

// GET /api/cursos
router.get('/', (req, res) => {
  const { nivel, activo } = req.query;
  let sql = `
    SELECT c.id, c.seccion, c.cupos_max, c.cupos_ocupados, c.activo,
           g.nombre AS grado, n.nombre AS nivel,
           u.nombre || ' ' || u.apellido AS docente
    FROM cursos c
    JOIN grados g ON g.id = c.grado_id
    JOIN niveles n ON n.id = g.nivel_id
    LEFT JOIN usuarios u ON u.id = c.docente_id
    WHERE 1=1
  `;
  const params = [];
  if (nivel) { sql += ' AND n.nombre = ?'; params.push(nivel); }
  if (activo !== undefined) { sql += ' AND c.activo = ?'; params.push(activo); }
  sql += ' ORDER BY n.orden, g.orden, c.seccion';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/cursos/:id
router.get('/:id', (req, res) => {
  const curso = db.prepare(`
    SELECT c.*, g.nombre AS grado, n.nombre AS nivel,
           u.nombre || ' ' || u.apellido AS docente_nombre
    FROM cursos c
    JOIN grados g ON g.id = c.grado_id
    JOIN niveles n ON n.id = g.nivel_id
    LEFT JOIN usuarios u ON u.id = c.docente_id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!curso) return res.status(404).json({ error: 'Curso no encontrado' });

  const horarios = db.prepare('SELECT * FROM horarios WHERE curso_id=? ORDER BY dia_semana, hora_inicio')
    .all(req.params.id);
  const estudiantes = db.prepare(`
    SELECT e.id, e.rut, e.nombre, e.apellido, e.estado
    FROM matriculas m
    JOIN estudiantes e ON e.id = m.estudiante_id
    WHERE m.curso_id = ? AND m.estado = 'PAGADA'
  `).all(req.params.id);

  res.json({ ...curso, horarios, estudiantes });
});

// POST /api/cursos
router.post('/', requireRole('ADMIN'), (req, res) => {
  const { grado_id, seccion, cupos_max, docente_id } = req.body;
  if (!grado_id || !seccion) return res.status(400).json({ error: 'grado_id y seccion requeridos' });

  const id = uuidv4();
  db.prepare('INSERT INTO cursos (id,grado_id,seccion,cupos_max,docente_id) VALUES (?,?,?,?,?)')
    .run(id, grado_id, seccion, cupos_max ?? 35, docente_id ?? null);

  auditLog(req.user.id, 'CREAR_CURSO', 'cursos', id, { grado_id, seccion }, req.ip);
  res.status(201).json({ id });
});

// PUT /api/cursos/:id
router.put('/:id', requireRole('ADMIN','SECRETARIA'), (req, res) => {
  const c = db.prepare('SELECT id FROM cursos WHERE id=?').get(req.params.id);
  if (!c) return res.status(404).json({ error: 'Curso no encontrado' });

  db.prepare(`
    UPDATE cursos SET
      seccion    = COALESCE(?, seccion),
      cupos_max  = COALESCE(?, cupos_max),
      activo     = COALESCE(?, activo),
      docente_id = COALESCE(?, docente_id)
    WHERE id = ?
  `).run(req.body.seccion ?? null, req.body.cupos_max ?? null,
         req.body.activo ?? null, req.body.docente_id ?? null, req.params.id);

  auditLog(req.user.id, 'EDITAR_CURSO', 'cursos', req.params.id, req.body, req.ip);
  res.json({ ok: true });
});

// GET /api/cursos/niveles/list
router.get('/niveles/list', (req, res) => {
  res.json(db.prepare('SELECT * FROM niveles ORDER BY orden').all());
});

// GET /api/cursos/grados/list
router.get('/grados/list', (req, res) => {
  res.json(db.prepare(`
    SELECT g.*, n.nombre AS nivel FROM grados g
    JOIN niveles n ON n.id = g.nivel_id
    ORDER BY n.orden, g.orden
  `).all());
});

// POST /api/cursos/:id/horarios
router.post('/:id/horarios', requireRole('ADMIN','SECRETARIA'), (req, res) => {
  const { dia_semana, hora_inicio, hora_fin, asignatura } = req.body;
  if (!dia_semana || !hora_inicio || !hora_fin || !asignatura)
    return res.status(400).json({ error: 'Todos los campos de horario son requeridos' });

  // Verificar conflicto docente
  const curso = db.prepare('SELECT docente_id FROM cursos WHERE id=?').get(req.params.id);
  if (curso?.docente_id) {
    const conflicto = db.prepare(`
      SELECT h.id FROM horarios h
      JOIN cursos c ON c.id = h.curso_id
      WHERE c.docente_id = ? AND h.dia_semana = ?
        AND h.hora_inicio < ? AND h.hora_fin > ?
        AND c.id != ?
    `).get(curso.docente_id, dia_semana, hora_fin, hora_inicio, req.params.id);
    if (conflicto) return res.status(409).json({ error: 'Conflicto de horario para el docente asignado' });
  }

  const r = db.prepare(`
    INSERT INTO horarios (curso_id, dia_semana, hora_inicio, hora_fin, asignatura)
    VALUES (?,?,?,?,?)
  `).run(req.params.id, dia_semana, hora_inicio, hora_fin, asignatura);
  res.status(201).json({ id: r.lastInsertRowid });
});

module.exports = router;
