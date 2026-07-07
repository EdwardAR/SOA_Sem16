const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/database');
const { authMiddleware, requireRole } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();
router.use(authMiddleware);

// GET /api/usuarios  — Admin ve todos
router.get('/', requireRole('ADMIN', 'SECRETARIA'), (req, res) => {
  const usuarios = db.prepare(`
    SELECT u.id, u.nombre, u.apellido, u.email, u.rut, u.activo, u.created_at,
           r.nombre AS rol
    FROM usuarios u JOIN roles r ON r.id = u.rol_id
    ORDER BY u.apellido, u.nombre
  `).all();
  res.json(usuarios);
});

// GET /api/usuarios/:id
router.get('/:id', requireRole('ADMIN', 'SECRETARIA'), (req, res) => {
  const u = db.prepare(`
    SELECT u.id, u.nombre, u.apellido, u.email, u.rut, u.activo, u.created_at,
           r.nombre AS rol, r.id AS rol_id
    FROM usuarios u JOIN roles r ON r.id = u.rol_id
    WHERE u.id = ?
  `).get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });
  res.json(u);
});

// POST /api/usuarios  — solo Admin puede crear
router.post('/', requireRole('ADMIN'), (req, res) => {
  const { nombre, apellido, email, rut, password, rol } = req.body;
  if (!nombre || !apellido || !email || !rut || !password || !rol)
    return res.status(400).json({ error: 'Todos los campos son requeridos' });

  const rolRow = db.prepare('SELECT id FROM roles WHERE nombre=?').get(rol);
  if (!rolRow) return res.status(400).json({ error: 'Rol inválido' });

  const dup = db.prepare('SELECT id FROM usuarios WHERE email=? OR rut=?').get(email, rut);
  if (dup) return res.status(409).json({ error: 'Email o RUT ya registrado' });

  const id = uuidv4();
  db.prepare(`
    INSERT INTO usuarios (id, nombre, apellido, email, rut, password_hash, rol_id)
    VALUES (?,?,?,?,?,?,?)
  `).run(id, nombre, apellido, email, rut, bcrypt.hashSync(password, 10), rolRow.id);

  auditLog(req.user.id, 'CREAR_USUARIO', 'usuarios', id, { email, rol }, req.ip);
  res.status(201).json({ id, nombre, apellido, email, rol });
});

// PUT /api/usuarios/:id
router.put('/:id', requireRole('ADMIN'), (req, res) => {
  const { nombre, apellido, email, rut, rol, activo } = req.body;
  const u = db.prepare('SELECT id FROM usuarios WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });

  let rolId = null;
  if (rol) {
    const r = db.prepare('SELECT id FROM roles WHERE nombre=?').get(rol);
    if (!r) return res.status(400).json({ error: 'Rol inválido' });
    rolId = r.id;
  }

  db.prepare(`
    UPDATE usuarios SET
      nombre   = COALESCE(?, nombre),
      apellido = COALESCE(?, apellido),
      email    = COALESCE(?, email),
      rut      = COALESCE(?, rut),
      rol_id   = COALESCE(?, rol_id),
      activo   = COALESCE(?, activo),
      updated_at = datetime('now')
    WHERE id = ?
  `).run(nombre ?? null, apellido ?? null, email ?? null, rut ?? null,
         rolId, activo ?? null, req.params.id);

  auditLog(req.user.id, 'EDITAR_USUARIO', 'usuarios', req.params.id, req.body, req.ip);
  res.json({ ok: true });
});

// DELETE /api/usuarios/:id
router.delete('/:id', requireRole('ADMIN'), (req, res) => {
  if (req.params.id === req.user.id)
    return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });

  const u = db.prepare('SELECT id FROM usuarios WHERE id=?').get(req.params.id);
  if (!u) return res.status(404).json({ error: 'Usuario no encontrado' });

  db.prepare("UPDATE usuarios SET activo=0, updated_at=datetime('now') WHERE id=?")
    .run(req.params.id);
  auditLog(req.user.id, 'ELIMINAR_USUARIO', 'usuarios', req.params.id, null, req.ip);
  res.json({ ok: true });
});

// GET /api/usuarios/roles/list
router.get('/roles/list', (req, res) => {
  res.json(db.prepare('SELECT * FROM roles ORDER BY id').all());
});

module.exports = router;
