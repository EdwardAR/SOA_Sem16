const db = require('../db/database');

function auditLog(usuarioId, accion, entidad, entidadId, detalle, ip) {
  db.prepare(`
    INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle, ip)
    VALUES (?,?,?,?,?,?)
  `).run(usuarioId ?? null, accion, entidad, entidadId ?? null,
         detalle ? JSON.stringify(detalle) : null, ip ?? null);
}

module.exports = { auditLog };
