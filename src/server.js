const express = require('express');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Servir frontend estático
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/usuarios',   require('./routes/usuarios'));
app.use('/api/estudiantes',require('./routes/estudiantes'));
app.use('/api/cursos',     require('./routes/cursos'));
app.use('/api/matriculas', require('./routes/matriculas'));
app.use('/api/anios',      require('./routes/anios'));
app.use('/api/reportes',   require('./routes/reportes'));

// Health check
app.get('/api/health', (_, res) => res.json({ status: 'ok', app: 'San Andrés Matrículas' }));

// SPA fallback
app.get('*', (_, res) => res.sendFile(path.join(__dirname, '../public/index.html')));

app.listen(PORT, () => {
  console.log(`🏫 Sistema de Matrículas - Colegio San Andrés`);
  console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
});
