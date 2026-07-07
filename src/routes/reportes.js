const express = require('express');
const db = require('../db/database');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole('ADMIN','SECRETARIA','FINANZAS'));

// GET /api/reportes/matriculados?anio=2025&nivel=BASICA&curso_id=...
router.get('/matriculados', (req, res) => {
  const { anio, nivel, curso_id } = req.query;
  let sql = `
    SELECT e.rut, e.nombre || ' ' || e.apellido AS estudiante,
           g.nombre || ' ' || c.seccion AS curso,
           n.nombre AS nivel,
           m.fecha_matricula, m.estado AS mat_estado,
           p.monto, p.medio_pago, p.estado AS pago_estado
    FROM matriculas m
    JOIN estudiantes e ON e.id = m.estudiante_id
    JOIN cursos c ON c.id = m.curso_id
    JOIN grados g ON g.id = c.grado_id
    JOIN niveles n ON n.id = g.nivel_id
    JOIN pagos p ON p.matricula_id = m.id
    JOIN anios_escolares ae ON ae.id = m.anio_escolar_id
    WHERE m.estado = 'PAGADA'
  `;
  const params = [];
  if (anio)     { sql += ' AND ae.anio = ?';      params.push(Number(anio)); }
  if (nivel)    { sql += ' AND n.nombre = ?';     params.push(nivel); }
  if (curso_id) { sql += ' AND m.curso_id = ?';   params.push(curso_id); }
  sql += ' ORDER BY n.orden, g.orden, c.seccion, e.apellido';
  res.json(db.prepare(sql).all(...params));
});

// GET /api/reportes/vacantes?anio=2025
router.get('/vacantes', (req, res) => {
  const { anio } = req.query;
  const anioId = anio
    ? db.prepare('SELECT id FROM anios_escolares WHERE anio=?').get(Number(anio))?.id
    : db.prepare('SELECT id FROM anios_escolares WHERE activo=1').get()?.id;

  const vacantes = db.prepare(`
    SELECT n.nombre AS nivel, g.nombre AS grado, c.seccion,
           c.cupos_max, c.cupos_ocupados,
           (c.cupos_max - c.cupos_ocupados) AS vacantes_disponibles,
           ROUND(100.0 * c.cupos_ocupados / c.cupos_max, 1) AS ocupacion_pct,
           u.nombre || ' ' || u.apellido AS docente
    FROM cursos c
    JOIN grados g ON g.id = c.grado_id
    JOIN niveles n ON n.id = g.nivel_id
    LEFT JOIN usuarios u ON u.id = c.docente_id
    WHERE c.activo = 1
    ORDER BY n.orden, g.orden, c.seccion
  `).all();
  res.json(vacantes);
});

// GET /api/reportes/pagos?anio=2025&estado=PENDIENTE
router.get('/pagos', (req, res) => {
  const { anio, estado } = req.query;
  let sql = `
    SELECT e.rut, e.nombre || ' ' || e.apellido AS estudiante,
           g.nombre || ' ' || c.seccion AS curso,
           p.monto, p.medio_pago, p.estado, p.referencia, p.fecha_pago,
           m.estado AS mat_estado
    FROM pagos p
    JOIN matriculas m ON m.id = p.matricula_id
    JOIN estudiantes e ON e.id = m.estudiante_id
    JOIN cursos c ON c.id = m.curso_id
    JOIN grados g ON g.id = c.grado_id
    JOIN anios_escolares ae ON ae.id = m.anio_escolar_id
    WHERE 1=1
  `;
  const params = [];
  if (anio)   { sql += ' AND ae.anio=?';  params.push(Number(anio)); }
  if (estado) { sql += ' AND p.estado=?'; params.push(estado); }
  sql += ' ORDER BY p.created_at DESC';
  const rows = db.prepare(sql).all(...params);

  const totalRecaudado  = rows.filter(r => r.estado==='CONFIRMADO').reduce((s,r) => s+r.monto, 0);
  const totalPendiente  = rows.filter(r => r.estado==='PENDIENTE' ).reduce((s,r) => s+r.monto, 0);
  res.json({ filas: rows, totalRecaudado, totalPendiente });
});

// GET /api/reportes/comparativa?anios=2023,2024,2025
router.get('/comparativa', (req, res) => {
  const aniosList = (req.query.anios || '2025').split(',').map(Number);
  const result = {};
  aniosList.forEach(anio => {
    const ae = db.prepare('SELECT id FROM anios_escolares WHERE anio=?').get(anio);
    if (!ae) { result[anio] = []; return; }
    result[anio] = db.prepare(`
      SELECT n.nombre AS nivel, COUNT(*) AS total
      FROM matriculas m
      JOIN cursos c ON c.id = m.curso_id
      JOIN grados g ON g.id = c.grado_id
      JOIN niveles n ON n.id = g.nivel_id
      WHERE m.anio_escolar_id = ? AND m.estado = 'PAGADA'
      GROUP BY n.nombre
    `).all(ae.id);
  });
  res.json(result);
});

// GET /api/reportes/dashboard — métricas principales
router.get('/dashboard', (req, res) => {
  const ae = db.prepare('SELECT id, anio FROM anios_escolares WHERE activo=1').get();
  if (!ae) return res.json({});

  const totalMatriculados = db.prepare(`
    SELECT COUNT(*) AS total FROM matriculas WHERE anio_escolar_id=? AND estado='PAGADA'
  `).get(ae.id).total;

  const totalPendientes = db.prepare(`
    SELECT COUNT(*) AS total FROM matriculas WHERE anio_escolar_id=? AND estado='PENDIENTE_PAGO'
  `).get(ae.id).total;

  const recaudado = db.prepare(`
    SELECT COALESCE(SUM(p.monto),0) AS total
    FROM pagos p JOIN matriculas m ON m.id=p.matricula_id
    WHERE m.anio_escolar_id=? AND p.estado='CONFIRMADO'
  `).get(ae.id).total;

  const porNivel = db.prepare(`
    SELECT n.nombre AS nivel, COUNT(*) AS total
    FROM matriculas m
    JOIN cursos c ON c.id=m.curso_id
    JOIN grados g ON g.id=c.grado_id
    JOIN niveles n ON n.id=g.nivel_id
    WHERE m.anio_escolar_id=? AND m.estado='PAGADA'
    GROUP BY n.nombre
  `).all(ae.id);

  const totalVacantes = db.prepare(`
    SELECT SUM(cupos_max - cupos_ocupados) AS total FROM cursos WHERE activo=1
  `).get().total;

  res.json({
    anio: ae.anio,
    totalMatriculados,
    totalPendientes,
    recaudado,
    porNivel,
    totalVacantes
  });
});

module.exports = router;
