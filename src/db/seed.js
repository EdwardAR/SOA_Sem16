/**
 * seed.js — pobla la base de datos con datos de ejemplo coherentes.
 * node src/db/seed.js
 */
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('./database');

const run = db.transaction(() => {

  // -----------------------------------------------------------
  // ROLES
  // -----------------------------------------------------------
  const roles = [
    { nombre: 'ADMIN',      descripcion: 'Administrador del sistema' },
    { nombre: 'SECRETARIA', descripcion: 'Gestión de matrículas y pagos' },
    { nombre: 'DOCENTE',    descripcion: 'Visualiza estudiantes y horarios' },
    { nombre: 'APODERADO',  descripcion: 'Inscribe y actualiza información de su pupilo' },
    { nombre: 'FINANZAS',   descripcion: 'Control de pagos y deudas' },
  ];
  const insRol = db.prepare('INSERT OR IGNORE INTO roles (nombre, descripcion) VALUES (?,?)');
  roles.forEach(r => insRol.run(r.nombre, r.descripcion));

  const rolId = nombre => db.prepare('SELECT id FROM roles WHERE nombre=?').get(nombre).id;

  // -----------------------------------------------------------
  // USUARIOS
  // -----------------------------------------------------------
  const hash = p => bcrypt.hashSync(p, 10);
  const insUser = db.prepare(`
    INSERT OR IGNORE INTO usuarios (id, nombre, apellido, email, rut, password_hash, rol_id)
    VALUES (?,?,?,?,?,?,?)
  `);

  const usuarios = [
    { nombre:'Carlos',   apellido:'Mendoza',  email:'admin@sanandres.cl',       rut:'12.345.678-9', pw:'Admin2024!',     rol:'ADMIN'      },
    { nombre:'Patricia', apellido:'Rojas',    email:'secretaria@sanandres.cl',  rut:'9.876.543-2',  pw:'Secre2024!',     rol:'SECRETARIA' },
    { nombre:'Rodrigo',  apellido:'Fuentes',  email:'rfuentes@sanandres.cl',    rut:'14.222.333-4', pw:'Docente2024!',   rol:'DOCENTE'    },
    { nombre:'Ana',      apellido:'Castillo', email:'acastillo@sanandres.cl',   rut:'15.111.222-3', pw:'Docente2024!',   rol:'DOCENTE'    },
    { nombre:'Luis',     apellido:'Torres',   email:'ltorres@sanandres.cl',     rut:'16.444.555-6', pw:'Docente2024!',   rol:'DOCENTE'    },
    { nombre:'Verónica', apellido:'Soto',     email:'vsoto@sanandres.cl',       rut:'11.777.888-0', pw:'Finanzas2024!',  rol:'FINANZAS'   },
    { nombre:'Jorge',    apellido:'Herrera',  email:'jherrera.apod@gmail.com',  rut:'10.123.456-7', pw:'Apod2024!',      rol:'APODERADO'  },
    { nombre:'Marcela',  apellido:'Vega',     email:'mvega.apod@gmail.com',     rut:'10.987.654-1', pw:'Apod2024!',      rol:'APODERADO'  },
  ];
  const userIds = {};
  usuarios.forEach(u => {
    const id = uuidv4();
    userIds[u.email] = id;
    insUser.run(id, u.nombre, u.apellido, u.email, u.rut, hash(u.pw), rolId(u.rol));
  });

  // -----------------------------------------------------------
  // NIVELES Y GRADOS
  // -----------------------------------------------------------
  const insNivel = db.prepare('INSERT OR IGNORE INTO niveles (nombre, orden) VALUES (?,?)');
  insNivel.run('PRE_BASICA', 1);
  insNivel.run('BASICA',     2);
  insNivel.run('MEDIA',      3);
  const nId = n => db.prepare('SELECT id FROM niveles WHERE nombre=?').get(n).id;

  const insGrado = db.prepare('INSERT OR IGNORE INTO grados (nivel_id, nombre, orden) VALUES (?,?,?)');
  // Pre-básica
  insGrado.run(nId('PRE_BASICA'), 'Pre-Kinder', 1);
  insGrado.run(nId('PRE_BASICA'), 'Kinder',     2);
  // Básica
  for (let i = 1; i <= 8; i++) insGrado.run(nId('BASICA'), `${i}° Básico`, i);
  // Media
  for (let i = 1; i <= 4; i++) insGrado.run(nId('MEDIA'), `${i}° Medio`, i);

  const gId = n => db.prepare('SELECT id FROM grados WHERE nombre=?').get(n).id;

  // -----------------------------------------------------------
  // AÑO ESCOLAR 2025
  // -----------------------------------------------------------
  const insAnio = db.prepare(`
    INSERT OR IGNORE INTO anios_escolares
      (anio, fecha_inicio_matricula, fecha_fin_matricula, fecha_inicio_clases, fecha_fin_anio,
       nota_min_aprobacion, max_asig_reprobadas, activo, publicado)
    VALUES (?,?,?,?,?,?,?,1,1)
  `);
  insAnio.run(2025,'2024-11-01','2025-01-31','2025-03-03','2025-12-12', 4.0, 2);
  const anio2025 = db.prepare('SELECT id FROM anios_escolares WHERE anio=2025').get().id;

  // Costos por nivel 2025
  const insCosto = db.prepare(`
    INSERT OR IGNORE INTO costos_nivel (anio_escolar_id, nivel_id, costo_matricula, mensualidad, descuento_pct)
    VALUES (?,?,?,?,?)
  `);
  insCosto.run(anio2025, nId('PRE_BASICA'), 85000, 110000, 0);
  insCosto.run(anio2025, nId('BASICA'),     75000, 95000,  0);
  insCosto.run(anio2025, nId('MEDIA'),      80000, 105000, 0);

  // -----------------------------------------------------------
  // CURSOS
  // -----------------------------------------------------------
  const insCurso = db.prepare(`
    INSERT OR IGNORE INTO cursos (id, grado_id, seccion, cupos_max, cupos_ocupados, docente_id)
    VALUES (?,?,?,?,?,?)
  `);
  const cursoIds = {};
  const docenteRod = userIds['rfuentes@sanandres.cl'];
  const docenteAna = userIds['acastillo@sanandres.cl'];
  const docenteLuis = userIds['ltorres@sanandres.cl'];

  const cursosData = [
    { grado:'1° Básico', sec:'A', cuposMax:35, cuposOc:2, docente: docenteRod },
    { grado:'1° Básico', sec:'B', cuposMax:35, cuposOc:0, docente: docenteAna },
    { grado:'2° Básico', sec:'A', cuposMax:35, cuposOc:1, docente: docenteLuis },
    { grado:'3° Básico', sec:'A', cuposMax:35, cuposOc:0, docente: docenteRod },
    { grado:'1° Medio',  sec:'A', cuposMax:40, cuposOc:0, docente: docenteAna },
    { grado:'Kinder',    sec:'A', cuposMax:25, cuposOc:1, docente: docenteLuis },
  ];
  cursosData.forEach(c => {
    const id = uuidv4();
    cursoIds[`${c.grado}-${c.sec}`] = id;
    insCurso.run(id, gId(c.grado), c.sec, c.cuposMax, c.cuposOc, c.docente);
  });

  // Horarios para 1° Básico A
  const insHorario = db.prepare(`
    INSERT OR IGNORE INTO horarios (curso_id, dia_semana, hora_inicio, hora_fin, asignatura)
    VALUES (?,?,?,?,?)
  `);
  const c1A = cursoIds['1° Básico-A'];
  insHorario.run(c1A, 'LUNES',    '08:00','09:30','Matemáticas');
  insHorario.run(c1A, 'LUNES',    '09:45','11:15','Lenguaje');
  insHorario.run(c1A, 'MARTES',   '08:00','09:30','Ciencias Naturales');
  insHorario.run(c1A, 'MARTES',   '09:45','11:15','Historia');
  insHorario.run(c1A, 'MIERCOLES','08:00','09:30','Ed. Física');
  insHorario.run(c1A, 'JUEVES',   '08:00','09:30','Matemáticas');
  insHorario.run(c1A, 'VIERNES',  '08:00','09:30','Inglés');

  // -----------------------------------------------------------
  // ESTUDIANTES Y APODERADOS
  // -----------------------------------------------------------
  const insEst = db.prepare(`
    INSERT OR IGNORE INTO estudiantes
      (id, rut, nombre, apellido, fecha_nacimiento, genero, direccion, telefono,
       grupo_sanguineo, alergias, colegio_anterior, anio_cursado_anterior, estado)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
  `);
  const insApod = db.prepare(`
    INSERT OR IGNORE INTO apoderados (id, rut, nombre, apellido, email, telefono, relacion, es_titular)
    VALUES (?,?,?,?,?,?,?,?)
  `);
  const insEstApod = db.prepare('INSERT OR IGNORE INTO estudiante_apoderado VALUES (?,?)');

  const estudiantes = [
    {
      rut:'22.111.001-1', nombre:'Sofía',   apellido:'Herrera', dob:'2018-03-15', genero:'F',
      dir:'Av. Las Condes 1234, Las Condes', tel:'+56912345678', gs:'A+', alergias:'Polen',
      colegio:'Jardín Infantil Rayito', anio:'Kinder', estado:'MATRICULADO',
      apoderado:{ rut:'10.123.456-7', nombre:'Jorge', apellido:'Herrera',
                  email:'jherrera.apod@gmail.com', tel:'+56987654321', rel:'Padre', titular:1 }
    },
    {
      rut:'22.111.002-2', nombre:'Martín',  apellido:'Vega',    dob:'2017-07-22', genero:'M',
      dir:'Calle Providencia 567, Providencia', tel:'+56923456789', gs:'O+', alergias:'Ninguna',
      colegio:'Escuela Básica El Sol', anio:'1° Básico', estado:'MATRICULADO',
      apoderado:{ rut:'10.987.654-1', nombre:'Marcela', apellido:'Vega',
                  email:'mvega.apod@gmail.com', tel:'+56976543210', rel:'Madre', titular:1 }
    },
    {
      rut:'22.111.003-3', nombre:'Valentina', apellido:'Morales', dob:'2018-11-05', genero:'F',
      dir:'Los Leones 890, Vitacura', tel:'+56934567890', gs:'B+', alergias:'Lactosa',
      colegio:'Jardín Educativo ABC', anio:'Kinder', estado:'PREINSCRITO',
      apoderado:{ rut:'13.222.333-K', nombre:'Roberto', apellido:'Morales',
                  email:'rmorales@gmail.com', tel:'+56965432100', rel:'Padre', titular:1 }
    },
  ];

  const estIds = {};
  estudiantes.forEach(e => {
    const estId = uuidv4();
    const apodId = uuidv4();
    estIds[e.rut] = estId;
    insEst.run(estId, e.rut, e.nombre, e.apellido, e.dob, e.genero, e.dir, e.tel,
               e.gs, e.alergias, e.colegio, e.anio, e.estado);
    insApod.run(apodId, e.apoderado.rut, e.apoderado.nombre, e.apoderado.apellido,
                e.apoderado.email, e.apoderado.tel, e.apoderado.rel, e.apoderado.titular);
    insEstApod.run(estId, apodId);
  });

  // -----------------------------------------------------------
  // MATRÍCULAS Y PAGOS
  // -----------------------------------------------------------
  const insMat = db.prepare(`
    INSERT OR IGNORE INTO matriculas
      (id, estudiante_id, curso_id, anio_escolar_id, estado, fecha_matricula)
    VALUES (?,?,?,?,?,?)
  `);
  const insPago = db.prepare(`
    INSERT OR IGNORE INTO pagos
      (id, matricula_id, monto, medio_pago, estado, referencia, fecha_pago)
    VALUES (?,?,?,?,?,?,?)
  `);

  // Matrícula confirmada — Sofía en Kinder A
  const matSofia = uuidv4();
  insMat.run(matSofia, estIds['22.111.001-1'], cursoIds['Kinder-A'], anio2025,
             'PAGADA', '2024-11-15');
  insPago.run(uuidv4(), matSofia, 85000, 'TRANSFERENCIA', 'CONFIRMADO', 'TRF-2024-001', '2024-11-15');

  // Matrícula confirmada — Martín en 1° Básico A
  const matMartin = uuidv4();
  insMat.run(matMartin, estIds['22.111.002-2'], cursoIds['1° Básico-A'], anio2025,
             'PAGADA', '2024-11-20');
  insPago.run(uuidv4(), matMartin, 75000, 'EFECTIVO', 'CONFIRMADO', null, '2024-11-20');

  // Matrícula pendiente de pago — Valentina
  const matValentina = uuidv4();
  insMat.run(matValentina, estIds['22.111.003-3'], cursoIds['1° Básico-B'], anio2025,
             'PENDIENTE_PAGO', null);
  insPago.run(uuidv4(), matValentina, 85000, 'TARJETA', 'PENDIENTE', null, null);

  console.log('✅ Datos de ejemplo cargados correctamente.');
  console.log('');
  console.log('Credenciales de acceso:');
  console.log('  Admin       → admin@sanandres.cl       / Admin2024!');
  console.log('  Secretaría  → secretaria@sanandres.cl  / Secre2024!');
  console.log('  Docente     → rfuentes@sanandres.cl    / Docente2024!');
  console.log('  Finanzas    → vsoto@sanandres.cl       / Finanzas2024!');
  console.log('  Apoderado   → jherrera.apod@gmail.com  / Apod2024!');
});

run();
