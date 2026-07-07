const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'san_andres_secret_2025';

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token requerido' });
  }
  try {
    req.user = jwt.verify(header.slice(7), JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({
        error: `Acción no autorizada. Se requiere uno de estos roles: ${roles.join(', ')}. Tu rol actual es: ${req.user.rol}`
      });
    }
    next();
  };
}

module.exports = { authMiddleware, requireRole, JWT_SECRET };
