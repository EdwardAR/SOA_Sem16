const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
router.use(authMiddleware);

// GET /api/estudiantes
router.get('/', requireRole('ADMIN','SECRETARIA','DOCENTE','FINANZAS'), (req, res) => {
  const { q, estado } = req.query;
  let sql = `
    SELECT e.id, e.rut, e.nombre, e.apellido, e.fecha_nacimiento, e.genero,
           e.estado, e.created_at,
           a.nombre || ' ' || a.apellido AS apoderado_nombre,
           a.telefono AS apoderado_tel
    FROM estudiantes e
    LEFT JOIN estudiante_apoderado ea ON ea.estudiante_id = e.id
    LEFT JOIN apoderados a ON a.id = ea.apoderado_id AND a.es_titular = 1
    WHERE 1=1
  `;
  const params = [];
  if (q) {
    sql += ` AND (e.nombre LIKE ? OR e.apellido LIKE ? OR e.rut LIKE ?)`;
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (estado) { sql += ` AND e.estado = ?`; params.push(estado); }
  sql += ` ORDER BY e.apellido, e.nombre`;
  res.json(db.prepare(sql).all(...params));
});

// GET /api/estudiantes/:id
router.get('/:id', requireRole('ADMIN','SECRETARIA','DOCENTE','FINANZAS','APODERADO'), (req, res) => {
  const est = db.prepare(`
    SELECT * FROM estudiantes WHERE id = ?
  `).get(req.params.id);
  if (!est) return res.status(404).json({ error: 'Estudiante no encontrado' });

  const apoderados = db.prepare(`
    SELECT a.* FROM apoderados a
    JOIN estudiante_apoderado ea ON ea.apoderado_id = a.id
    WHERE ea.estudiante_id = ?
  `).all(req.params.id);

  const docs = db.prepare('SELECT * FROM documentos WHERE estudiante_id=?').all(req.params.id);
  res.json({ ...est, apoderados, documentos: docs });
});

// POST /api/estudiantes
router.post('/', requireRole('ADMIN','SECRETARIA','APODERADO'), (req, res) => {
  const { rut, nombre, apellido, fecha_nacimiento, genero, direccion, telefono, email,
          grupo_sanguineo, alergias, medicamentos, seguro_medico,
          colegio_anterior, anio_cursado_anterior, apoderado } = req.body;

  if (!rut || !nombre || !apellido || !fecha_nacimiento)
    return res.status(400).json({ error: 'Campos obligatorios: rut, nombre, apellido, fecha_nacimiento' });

  const dup = db.prepare('SELECT id FROM estudiantes WHERE rut=?').get(rut);
  if (dup) return res.status(409).json({ error: 'RUT ya registrado', id: dup.id });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO estudiantes
      (id,rut,nombre,apellido,fecha_nacimiento,genero,direccion,telefono,email,
       grupo_sanguineo,alergias,medicamentos,seguro_medico,colegio_anterior,anio_cursado_anterior)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
  `).run(id,rut,nombre,apellido,fecha_nacimiento,genero??null,direccion??null,telefono??null,
         email??null,grupo_sanguineo??null,alergias??null,medicamentos??null,
         seguro_medico??null,colegio_anterior??null,anio_cursado_anterior??null);

  if (apoderado) {
    const apodId = uuidv4();
    db.prepare(`
      INSERT INTO apoderados (id,rut,nombre,apellido,email,telefono,relacion,es_titular)
      VALUES (?,?,?,?,?,?,?,?)
    `).run(apodId, apoderado.rut, apoderado.nombre, apoderado.apellido,
           apoderado.email, apoderado.telefono, apoderado.relacion, 1);
    db.prepare('INSERT INTO estudiante_apoderado VALUES (?,?)').run(id, apodId);
  }

  auditLog(req.user.id, 'CREAR_ESTUDIANTE', 'estudiantes', id, { rut, nombre, apellido }, req.ip);
  res.status(201).json({ id });
});

// PUT /api/estudiantes/:id
router.put('/:id', requireRole('ADMIN','SECRETARIA','APODERADO'), (req, res) => {
  const est = db.prepare('SELECT id FROM estudiantes WHERE id=?').get(req.params.id);
  if (!est) return res.status(404).json({ error: 'Estudiante no encontrado' });

  const fields = ['nombre','apellido','fecha_nacimiento','genero','direccion','telefono',
                  'email','grupo_sanguineo','alergias','medicamentos','seguro_medico',
                  'colegio_anterior','anio_cursado_anterior','estado'];
  const sets = fields.map(f => `${f} = COALESCE(?,${f})`).join(', ');
  const vals = fields.map(f => req.body[f] ?? null);
  vals.push(req.params.id);

  db.prepare(`UPDATE estudiantes SET ${sets}, updated_at=datetime('now') WHERE id=?`).run(...vals);
  auditLog(req.user.id, 'EDITAR_ESTUDIANTE', 'estudiantes', req.params.id, req.body, req.ip);
  res.json({ ok: true });
});

module.exports = router;
