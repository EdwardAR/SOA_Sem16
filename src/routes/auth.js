const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { JWT_SECRET } = require('../middleware/auth');
const { auditLog } = require('../middleware/audit');

const router = express.Router();

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email y contraseña requeridos' });

  const user = db.prepare(`
    SELECT u.*, r.nombre AS rol
    FROM usuarios u
    JOIN roles r ON r.id = u.rol_id
    WHERE u.email = ? AND u.activo = 1
  `).get(email);

  if (!user || !bcrypt.compareSync(password, user.password_hash))
    return res.status(401).json({ error: 'Credenciales inválidas' });

  const token = jwt.sign(
    { id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, rol: user.rol },
    JWT_SECRET, { expiresIn: '8h' }
  );

  auditLog(user.id, 'LOGIN', 'usuarios', user.id, null, req.ip);
  res.json({
    token,
    user: { id: user.id, nombre: user.nombre, apellido: user.apellido, email: user.email, rol: user.rol }
  });
});

// POST /api/auth/logout  (solo auditoría, el token expira por tiempo)
router.post('/logout', (req, res) => {
  const header = req.headers.authorization;
  if (header) {
    try {
      const decoded = jwt.verify(header.slice(7), JWT_SECRET);
      auditLog(decoded.id, 'LOGOUT', 'usuarios', decoded.id, null, req.ip);
    } catch {}
  }
  res.json({ ok: true });
});

module.exports = router;
