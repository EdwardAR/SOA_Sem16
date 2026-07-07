const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
router.use(authMiddleware);

// POST /api/matriculas — iniciar proceso de matrícula
router.post('/', requireRole('ADMIN','SECRETARIA','APODERADO'), (req, res) => {
  const { estudiante_id, curso_id, anio_escolar_id, medio_pago } = req.body;
  if (!estudiante_id || !curso_id || !anio_escolar_id || !medio_pago)
    return res.status(400).json({ error: 'estudiante_id, curso_id, anio_escolar_id, medio_pago son requeridos' });

  // Verificar que el estudiante existe
  const est = db.prepare('SELECT id, estado FROM estudiantes WHERE id=?').get(estudiante_id);
  if (!est) return res.status(404).json({ error: 'Estudiante no encontrado' });

  // Verificar matrícula duplicada en el mismo año
  const dupMat = db.prepare(`
    SELECT id FROM matriculas
    WHERE estudiante_id=? AND anio_escolar_id=? AND estado != 'ANULADA'
  `).get(estudiante_id, anio_escolar_id);
  if (dupMat) return res.status(409).json({ error: 'El estudiante ya tiene una matrícula para este año' });

  // Verificar vacantes
  const curso = db.prepare('SELECT id, cupos_max, cupos_ocupados, grado_id FROM cursos WHERE id=? AND activo=1')
    .get(curso_id);
  if (!curso) return res.status(404).json({ error: 'Curso no encontrado o inactivo' });
  if (curso.cupos_ocupados >= curso.cupos_max)
    return res.status(409).json({ error: 'No hay vacantes disponibles en este curso' });

  // Calcular monto según nivel
  const grado = db.prepare('SELECT nivel_id FROM grados WHERE id=?').get(curso.grado_id);
  const costo = db.prepare(`
    SELECT costo_matricula FROM costos_nivel
    WHERE anio_escolar_id=? AND nivel_id=?
  `).get(anio_escolar_id, grado.nivel_id);
  const monto = costo?.costo_matricula ?? 0;

  const matId  = uuidv4();
  const pagoId = uuidv4();

  const crear = db.transaction(() => {
    db.prepare(`
      INSERT INTO matriculas (id, estudiante_id, curso_id, anio_escolar_id, estado)
      VALUES (?,?,?,?,'PENDIENTE_PAGO')
    `).run(matId, estudiante_id, curso_id, anio_escolar_id);

    db.prepare(`
      INSERT INTO pagos (id, matricula_id, monto, medio_pago, estado)
      VALUES (?,?,?,?,'PENDIENTE')
    `).run(pagoId, matId, monto, medio_pago);
  });
  crear();

  auditLog(req.user.id, 'CREAR_MATRICULA', 'matriculas', matId,
           { estudiante_id, curso_id }, req.ip);
  res.status(201).json({ matricula_id: matId, pago_id: pagoId, monto });
});

// GET /api/matriculas
router.get('/', requireRole('ADMIN','SECRETARIA','FINANZAS'), (req, res) => {
  const { anio, estado, curso_id } = req.query;
  let sql = `
    SELECT m.id, m.estado, m.fecha_matricula, m.created_at,
           e.nombre || ' ' || e.apellido AS estudiante,
           e.rut AS estudiante_rut,
           g.nombre || ' ' || c.seccion AS curso,
           p.monto, p.estado AS pago_estado, p.medio_pago
    FROM matriculas m
    JOIN estudiantes e ON e.id = m.estudiante_id
    JOIN cursos c ON c.id = m.curso_id
    JOIN grados g ON g.id = c.grado_id
    JOIN pagos p ON p.matricula_id = m.id
    WHERE 1=1
  `;
  const params = [];
  if (anio) { sql += ' AND m.anio_escolar_id = (SELECT id FROM anios_escolares WHERE anio=?)'; params.push(anio); }
  if (estado) { sql += ' AND m.estado=?'; params.push(estado); }
  if (curso_id) { sql += ' AND m.curso_id=?'; params.push(curso_id); }
  sql += ' ORDER BY m.created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/matriculas/:id
router.get('/:id', requireRole('ADMIN','SECRETARIA','FINANZAS','APODERADO'), (req, res) => {
  const m = db.prepare(`
    SELECT m.*, e.nombre || ' ' || e.apellido AS estudiante,
           g.nombre || ' ' || c.seccion AS curso
    FROM matriculas m
    JOIN estudiantes e ON e.id = m.estudiante_id
    JOIN cursos c ON c.id = m.curso_id
    JOIN grados g ON g.id = c.grado_id
    WHERE m.id = ?
  `).get(req.params.id);
  if (!m) return res.status(404).json({ error: 'Matrícula no encontrada' });

  const pagos = db.prepare('SELECT * FROM pagos WHERE matricula_id=?').all(req.params.id);
  res.json({ ...m, pagos });
});

// POST /api/matriculas/:id/confirmar-pago — confirma el pago y activa la matrícula
router.post('/:id/confirmar-pago', requireRole('ADMIN','SECRETARIA','FINANZAS'), (req, res) => {
  const { pago_id, referencia } = req.body;

  const mat = db.prepare('SELECT * FROM matriculas WHERE id=?').get(req.params.id);
  if (!mat) return res.status(404).json({ error: 'Matrícula no encontrada' });
  if (mat.estado === 'PAGADA') return res.status(400).json({ error: 'Matrícula ya está confirmada' });

  const confirmar = db.transaction(() => {
    db.prepare(`
      UPDATE pagos SET estado='CONFIRMADO', referencia=COALESCE(?,referencia),
             fecha_pago=datetime('now') WHERE id=?
    `).run(referencia ?? null, pago_id);

    db.prepare(`
      UPDATE matriculas SET estado='PAGADA', fecha_matricula=datetime('now'),
             updated_at=datetime('now') WHERE id=?
    `).run(req.params.id);

    db.prepare(`
      UPDATE cursos SET cupos_ocupados = cupos_ocupados + 1 WHERE id=?
    `).run(mat.curso_id);

    db.prepare(`
      UPDATE estudiantes SET estado='MATRICULADO', updated_at=datetime('now') WHERE id=?
    `).run(mat.estudiante_id);
  });
  confirmar();

  auditLog(req.user.id, 'CONFIRMAR_PAGO', 'matriculas', req.params.id, { pago_id }, req.ip);
  res.json({ ok: true, mensaje: 'Matrícula confirmada y pago registrado' });
});

// POST /api/matriculas/:id/anular
router.post('/:id/anular', requireRole('ADMIN'), (req, res) => {
  const mat = db.prepare('SELECT * FROM matriculas WHERE id=?').get(req.params.id);
  if (!mat) return res.status(404).json({ error: 'Matrícula no encontrada' });

  const anular = db.transaction(() => {
    if (mat.estado === 'PAGADA') {
      db.prepare('UPDATE cursos SET cupos_ocupados = cupos_ocupados - 1 WHERE id=?')
        .run(mat.curso_id);
      db.prepare("UPDATE estudiantes SET estado='PREINSCRITO', updated_at=datetime('now') WHERE id=?")
        .run(mat.estudiante_id);
    }
    db.prepare("UPDATE matriculas SET estado='ANULADA', updated_at=datetime('now') WHERE id=?")
      .run(req.params.id);
  });
  anular();

  auditLog(req.user.id, 'ANULAR_MATRICULA', 'matriculas', req.params.id, null, req.ip);
  res.json({ ok: true });
});

// GET /api/matriculas/lista-espera/list
router.get('/lista-espera/list', requireRole('ADMIN','SECRETARIA'), (req, res) => {
  res.json(db.prepare(`
    SELECT le.*, e.nombre || ' ' || e.apellido AS estudiante,
           g.nombre AS grado
    FROM lista_espera le
    JOIN estudiantes e ON e.id = le.estudiante_id
    JOIN grados g ON g.id = le.grado_id
    WHERE le.estado = 'ESPERA'
    ORDER BY le.posicion
  `).all());
});

// POST /api/matriculas/lista-espera
router.post('/lista-espera', requireRole('ADMIN','SECRETARIA','APODERADO'), (req, res) => {
  const { estudiante_id, grado_id, anio_escolar_id } = req.body;
  const max = db.prepare(`
    SELECT COALESCE(MAX(posicion), 0) AS pos FROM lista_espera
    WHERE grado_id=? AND anio_escolar_id=? AND estado='ESPERA'
  `).get(grado_id, anio_escolar_id);
  db.prepare(`
    INSERT INTO lista_espera (estudiante_id, grado_id, anio_escolar_id, posicion)
    VALUES (?,?,?,?)
  `).run(estudiante_id, grado_id, anio_escolar_id, (max?.pos ?? 0) + 1);
  res.status(201).json({ ok: true, posicion: (max?.pos ?? 0) + 1 });
});

module.exports = router;
