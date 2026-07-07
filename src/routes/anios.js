const express = require('express');
const db = require('../db/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
router.use(authMiddleware);

// GET /api/anios — listar años escolares
router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM anios_escolares ORDER BY anio DESC').all());
});

// GET /api/anios/activo — año escolar activo actual
router.get('/activo', (req, res) => {
  const anio = db.prepare('SELECT * FROM anios_escolares WHERE activo=1 LIMIT 1').get();
  if (!anio) return res.status(404).json({ error: 'No hay año escolar activo' });
  const costos = db.prepare(`
    SELECT cn.*, n.nombre AS nivel FROM costos_nivel cn
    JOIN niveles n ON n.id = cn.nivel_id
    WHERE cn.anio_escolar_id = ?
  `).all(anio.id);
  res.json({ ...anio, costos });
});

// POST /api/anios — crear nuevo año escolar
router.post('/', requireRole('ADMIN'), (req, res) => {
  const {
    anio, fecha_inicio_matricula, fecha_fin_matricula,
    fecha_inicio_clases, fecha_fin_anio,
    nota_min_aprobacion, max_asig_reprobadas
  } = req.body;

  if (!anio || !fecha_inicio_matricula || !fecha_fin_matricula ||
      !fecha_inicio_clases || !fecha_fin_anio)
    return res.status(400).json({ error: 'Todos los campos de fechas son requeridos' });

  if (new Date(fecha_inicio_matricula) > new Date(fecha_fin_matricula))
    return res.status(400).json({ error: 'Fecha inicio matrícula no puede ser mayor que fecha fin' });

  const dup = db.prepare('SELECT id FROM anios_escolares WHERE anio=?').get(anio);
  if (dup) return res.status(409).json({ error: 'Ya existe configuración para ese año' });

  const r = db.prepare(`
    INSERT INTO anios_escolares
      (anio, fecha_inicio_matricula, fecha_fin_matricula, fecha_inicio_clases,
       fecha_fin_anio, nota_min_aprobacion, max_asig_reprobadas)
    VALUES (?,?,?,?,?,?,?)
  `).run(anio, fecha_inicio_matricula, fecha_fin_matricula,
         fecha_inicio_clases, fecha_fin_anio,
         nota_min_aprobacion ?? 4.0, max_asig_reprobadas ?? 2);

  auditLog(req.user.id, 'CREAR_ANIO', 'anios_escolares', String(r.lastInsertRowid), { anio }, req.ip);
  res.status(201).json({ id: r.lastInsertRowid });
});

// PUT /api/anios/:id — editar año escolar
router.put('/:id', requireRole('ADMIN'), (req, res) => {
  const ae = db.prepare('SELECT id FROM anios_escolares WHERE id=?').get(req.params.id);
  if (!ae) return res.status(404).json({ error: 'Año escolar no encontrado' });

  db.prepare(`
    UPDATE anios_escolares SET
      fecha_inicio_matricula = COALESCE(?,fecha_inicio_matricula),
      fecha_fin_matricula    = COALESCE(?,fecha_fin_matricula),
      fecha_inicio_clases    = COALESCE(?,fecha_inicio_clases),
      fecha_fin_anio         = COALESCE(?,fecha_fin_anio),
      nota_min_aprobacion    = COALESCE(?,nota_min_aprobacion),
      max_asig_reprobadas    = COALESCE(?,max_asig_reprobadas)
    WHERE id = ?
  `).run(
    req.body.fecha_inicio_matricula ?? null,
    req.body.fecha_fin_matricula    ?? null,
    req.body.fecha_inicio_clases    ?? null,
    req.body.fecha_fin_anio         ?? null,
    req.body.nota_min_aprobacion    ?? null,
    req.body.max_asig_reprobadas    ?? null,
    req.params.id
  );

  auditLog(req.user.id, 'EDITAR_ANIO', 'anios_escolares', req.params.id, req.body, req.ip);
  res.json({ ok: true });
});

// POST /api/anios/:id/publicar — publica y activa el año escolar
router.post('/:id/publicar', requireRole('ADMIN'), (req, res) => {
  const ae = db.prepare('SELECT * FROM anios_escolares WHERE id=?').get(req.params.id);
  if (!ae) return res.status(404).json({ error: 'Año escolar no encontrado' });

  const pub = db.transaction(() => {
    db.prepare('UPDATE anios_escolares SET activo=0').run();
    db.prepare('UPDATE anios_escolares SET activo=1, publicado=1 WHERE id=?').run(req.params.id);
  });
  pub();

  auditLog(req.user.id, 'PUBLICAR_ANIO', 'anios_escolares', req.params.id, null, req.ip);
  res.json({ ok: true, mensaje: `Año ${ae.anio} activado y publicado` });
});

// POST /api/anios/:id/costos — guardar costos por nivel
router.post('/:id/costos', requireRole('ADMIN'), (req, res) => {
  const { costos } = req.body; // [{ nivel_id, costo_matricula, mensualidad, descuento_pct }]
  if (!Array.isArray(costos)) return res.status(400).json({ error: 'costos debe ser un array' });

  const ins = db.prepare(`
    INSERT OR REPLACE INTO costos_nivel
      (anio_escolar_id, nivel_id, costo_matricula, mensualidad, descuento_pct)
    VALUES (?,?,?,?,?)
  `);
  const save = db.transaction(() => costos.forEach(c =>
    ins.run(req.params.id, c.nivel_id, c.costo_matricula, c.mensualidad, c.descuento_pct ?? 0)
  ));
  save();
  res.json({ ok: true });
});

module.exports = router;
