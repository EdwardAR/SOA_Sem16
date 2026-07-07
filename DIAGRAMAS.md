# Diagramas BPMN — Sistema de Matrículas Escolar "Colegio San Andrés"

> Todos los flujos están modelados con notación BPMN usando Mermaid.

---

## 1. Gestión de Usuarios y Roles

```mermaid
flowchart TD
    Start([Inicio]) --> Solicitud[Recibir solicitud de creación/edición de usuario]
    Solicitud --> VerificarAdmin{¿Es Administrador?}
    VerificarAdmin -- No --> Rechazar[Rechazar acceso\nNotificar al solicitante]
    Rechazar --> End1([Fin])
    VerificarAdmin -- Sí --> TipoAccion{Tipo de acción}

    TipoAccion -- Crear --> FormUsuario[Completar formulario de usuario\nNombre · Email · RUT · Rol]
    TipoAccion -- Editar --> BuscarUsuario[Buscar usuario existente]
    TipoAccion -- Eliminar --> BuscarUsuario

    FormUsuario --> ValidarDatos{¿Datos válidos?}
    ValidarDatos -- No --> ErrorForm[Mostrar errores de validación]
    ErrorForm --> FormUsuario
    ValidarDatos -- Sí --> AsignarRol[Asignar rol:\nAdministrador · Secretaría · Docente\nApoderado · Finanzas]

    BuscarUsuario --> UsuarioEncontrado{¿Encontrado?}
    UsuarioEncontrado -- No --> NotificarNoExiste[Notificar: usuario no existe]
    NotificarNoExiste --> End2([Fin])
    UsuarioEncontrado -- Sí --> TipoAccion2{Acción}
    TipoAccion2 -- Editar --> EditarDatos[Modificar datos / cambiar rol]
    TipoAccion2 -- Eliminar --> ConfirmarElim{¿Confirmar eliminación?}
    ConfirmarElim -- No --> End3([Fin])
    ConfirmarElim -- Sí --> EliminarUsuario[Eliminar usuario del sistema]
    EliminarUsuario --> NotificarElim[Enviar notificación por email]
    NotificarElim --> End4([Fin])

    AsignarRol --> AsignarPermisos[Asignar permisos según rol]
    EditarDatos --> AsignarPermisos
    AsignarPermisos --> GuardarDB[(Guardar en base de datos)]
    GuardarDB --> EnviarCredenciales[Enviar credenciales por email]
    EnviarCredenciales --> RegistrarAuditoria[Registrar en auditoría]
    RegistrarAuditoria --> End5([Fin])
```

---

## 2. Gestión de Estudiantes

```mermaid
flowchart TD
    Start([Inicio]) --> Actor{Actor del proceso}
    Actor -- Apoderado/Secretaría --> IngresarDatos[Ingresar datos del estudiante]

    IngresarDatos --> DatosPersonales[Datos personales:\nNombre · Fecha nacimiento · RUT/DNI\nDirección · Teléfono]
    DatosPersonales --> DatosFamiliares[Datos familiares:\nApoderado titular · Apoderado suplente\nRelación · Contacto de emergencia]
    DatosFamiliares --> InfoMedica[Información médica:\nGrupo sanguíneo · Alergias\nMedicamentos · Seguro médico]
    InfoMedica --> HistorialAcad[Historial académico:\nColegio anterior · Año cursado\nPromoción · Notas]
    HistorialAcad --> CargarDocumentos[Cargar documentos:\nFoto · Certificado de nacimiento\nBoletín · Partida de bautismo opcional]

    CargarDocumentos --> ValidarObligatorios{¿Campos obligatorios\ncompletos?}
    ValidarObligatorios -- No --> MostrarCampos[Resaltar campos faltantes]
    MostrarCampos --> IngresarDatos

    ValidarObligatorios -- Sí --> VerificarDuplicado{¿RUT/DNI ya existe\nen el sistema?}
    VerificarDuplicado -- Sí --> AlertaDuplicado[Alertar duplicado\nMostrar registro existente]
    AlertaDuplicado --> DecisionDuplicado{¿Es el mismo estudiante?}
    DecisionDuplicado -- Sí --> ActualizarRegistro[Actualizar registro existente]
    DecisionDuplicado -- No --> CorregirRUT[Corregir RUT/DNI ingresado]
    CorregirRUT --> VerificarDuplicado

    VerificarDuplicado -- No --> CrearRegistro[Crear registro de estudiante\nAsignar ID único]
    ActualizarRegistro --> GuardarDB[(Guardar en BD)]
    CrearRegistro --> GuardarDB
    GuardarDB --> GenerarFicha[Generar ficha del estudiante]
    GenerarFicha --> NotificarApoderado[Notificar al apoderado por email]
    NotificarApoderado --> End([Fin])
```

---

## 3. Proceso de Matrícula

```mermaid
flowchart TD
    Start([Inicio]) --> Preinscripcion[Apoderado completa\nformulario de preinscripción\nonline o presencial]
    Preinscripcion --> VerificarEstudiante{¿Estudiante registrado\nen el sistema?}
    VerificarEstudiante -- No --> IrGestion[Ir a: Gestión de Estudiantes\npara registrar al alumno]
    IrGestion --> VerificarEstudiante
    VerificarEstudiante -- Sí --> ValidarRequisitos[Validar requisitos:\nEdad · Documentación · Nivel solicitado]

    ValidarRequisitos --> RequisitosOK{¿Requisitos\ncumplidos?}
    RequisitosOK -- No --> NotificarPendientes[Notificar documentos\no requisitos pendientes]
    NotificarPendientes --> EsperarDocumentos[Apoderado entrega\ndocumentos faltantes]
    EsperarDocumentos --> ValidarRequisitos

    RequisitosOK -- Sí --> VerificarVacantes{¿Hay vacantes\ndisponibles en el nivel?}
    VerificarVacantes -- No --> ListaEspera[Agregar a lista de espera\nNotificar al apoderado]
    ListaEspera --> MonitorearVacante[Monitorear liberación\nde vacantes]
    MonitorearVacante --> VerificarVacantes

    VerificarVacantes -- Sí --> AsignarCurso[Asignar curso y sección\nsegún vacantes y nivel]
    AsignarCurso --> GenerarContrato[Generar contrato de matrícula\nen PDF]
    GenerarContrato --> FirmarContrato[Apoderado firma contrato\ndigital o presencial]
    FirmarContrato --> CalcularPago[Calcular monto de matrícula\nsegún configuración del año]
    CalcularPago --> ProcesarPago{Medio de pago}
    ProcesarPago -- Transferencia --> RegistrarTransf[Registrar transferencia\ny adjuntar comprobante]
    ProcesarPago -- Efectivo --> RegistrarEfectivo[Registrar pago en caja]
    ProcesarPago -- Tarjeta --> PasarelaWeb[Procesar en pasarela de pago]

    RegistrarTransf --> ConfirmarPago[Confirmar pago recibido]
    RegistrarEfectivo --> ConfirmarPago
    PasarelaWeb --> ResultadoPago{¿Pago exitoso?}
    ResultadoPago -- No --> ReintentroPago[Notificar error\nReintentar pago]
    ReintentroPago --> ProcesarPago
    ResultadoPago -- Sí --> ConfirmarPago

    ConfirmarPago --> ReducirVacante[Reducir vacante disponible\nen el curso asignado]
    ReducirVacante --> EmitirComprobante[Emitir comprobante de matrícula\nPDF + email]
    EmitirComprobante --> ActualizarEstado[Actualizar estado del estudiante\na MATRICULADO]
    ActualizarEstado --> NotificarDocente[Notificar al docente\ndel curso asignado]
    NotificarDocente --> End([Fin])
```

---

## 4. Gestión de Cursos y Secciones

```mermaid
flowchart TD
    Start([Inicio]) --> Actor{Actor}
    Actor -- Administrador --> TipoGestion{Tipo de gestión}

    TipoGestion -- Crear curso/sección --> FormCurso[Completar formulario:\nNivel · Grado · Sección · Cupos máximos]
    FormCurso --> AsignarDocente[Asignar docente titular]
    AsignarDocente --> DefinirHorario[Definir horario semanal]
    DefinirHorario --> ValidarConflicto{¿Conflicto de horario\no docente?}
    ValidarConflicto -- Sí --> AjustarHorario[Ajustar horario\no reasignar docente]
    AjustarHorario --> ValidarConflicto
    ValidarConflicto -- No --> GuardarCurso[(Guardar curso en BD)]
    GuardarCurso --> ActivarCurso[Activar curso para matrícula]
    ActivarCurso --> End1([Fin])

    TipoGestion -- Gestionar vacantes --> VerCursos[Ver lista de cursos activos]
    VerCursos --> SeleccionarCurso[Seleccionar curso]
    SeleccionarCurso --> VerVacantes[Ver:\nCupos totales · Ocupados · Disponibles]
    VerVacantes --> AccionVacante{Acción}
    AccionVacante -- Ampliar cupos --> ModificarCupos[Modificar límite máximo\nde estudiantes]
    AccionVacante -- Bloquear curso --> BloquearCurso[Deshabilitar inscripciones\nen el curso]
    ModificarCupos --> ActualizarCurso[(Actualizar en BD)]
    BloquearCurso --> ActualizarCurso
    ActualizarCurso --> NotificarSecretaria[Notificar a Secretaría]
    NotificarSecretaria --> End2([Fin])

    TipoGestion -- Asignar docente --> BuscarDocente[Buscar docente disponible]
    BuscarDocente --> VerDisponibilidad{¿Docente disponible\nen ese horario?}
    VerDisponibilidad -- No --> BuscarOtroDocente[Buscar otro docente]
    BuscarOtroDocente --> VerDisponibilidad
    VerDisponibilidad -- Sí --> ConfirmarAsignacion[Confirmar asignación]
    ConfirmarAsignacion --> NotificarDocente[Notificar al docente\npor email]
    NotificarDocente --> End3([Fin])

    TipoGestion -- Ver cupos en tiempo real --> Dashboard[Mostrar dashboard:\nBarra de ocupación por sección]
    Dashboard --> AlertaCupo{¿Sección al 90%\nde capacidad?}
    AlertaCupo -- Sí --> EnviarAlerta[Enviar alerta a Administrador\ny Secretaría]
    EnviarAlerta --> End4([Fin])
    AlertaCupo -- No --> End4
```

---

## 5. Reportes

```mermaid
flowchart TD
    Start([Inicio]) --> Actor{Actor solicitante}
    Actor -- Administrador / Secretaría / Finanzas --> SeleccionarReporte[Seleccionar tipo de reporte]

    SeleccionarReporte --> TipoReporte{Tipo de reporte}

    TipoReporte -- Estudiantes matriculados --> FiltroEstudiantes[Aplicar filtros:\nAño · Nivel · Curso · Sección · Estado]
    FiltroEstudiantes --> GenerarEstudiantes[Generar listado de estudiantes\ncon columnas: Nombre · RUT · Curso · Fecha matrícula]
    GenerarEstudiantes --> ExportarEstudiantes[Exportar a PDF / Excel]
    ExportarEstudiantes --> End1([Fin])

    TipoReporte -- Vacantes disponibles --> FiltroVacantes[Filtrar por:\nNivel · Curso · Año lectivo]
    FiltroVacantes --> GenerarVacantes[Generar tabla:\nCurso · Sección · Cupos totales · Ocupados · Disponibles]
    GenerarVacantes --> VisualizarGrafico[Visualizar gráfico de barras]
    VisualizarGrafico --> ExportarVacantes[Exportar a PDF / Excel]
    ExportarVacantes --> End2([Fin])

    TipoReporte -- Pagos realizados y pendientes --> FiltroPagos[Filtrar por:\nFecha · Estado: pagado/pendiente · Nivel]
    FiltroPagos --> GenerarPagos[Generar reporte:\nEstudiante · Monto · Fecha pago · Estado · Medio de pago]
    GenerarPagos --> ResumenFinanciero[Calcular totales:\nRecaudado · Pendiente · Mora]
    ResumenFinanciero --> ExportarPagos[Exportar a PDF / Excel]
    ExportarPagos --> End3([Fin])

    TipoReporte -- Estadísticas comparativas --> SeleccionarAnios[Seleccionar años a comparar\nEj: 2023 vs 2024 vs 2025]
    SeleccionarAnios --> GenerarComparativa[Generar gráfico comparativo:\nMatriculados por nivel y año]
    GenerarComparativa --> AnalisisTendencia[Mostrar tendencia de crecimiento\no decrecimiento]
    AnalisisTendencia --> ExportarComparativa[Exportar a PDF / PowerPoint]
    ExportarComparativa --> End4([Fin])
```

---

## 6. Configuración del Año Escolar

```mermaid
flowchart TD
    Start([Inicio]) --> SoloAdmin{¿Es Administrador?}
    SoloAdmin -- No --> AccesoDenegado[Acceso denegado]
    AccesoDenegado --> End0([Fin])
    SoloAdmin -- Sí --> SeleccionarAnio[Seleccionar o crear\nnuevo año lectivo\nEj: 2026]

    SeleccionarAnio --> AnioExiste{¿Ya existe\nconfiguración?}
    AnioExiste -- Sí --> EditarConfig[Editar configuración existente]
    AnioExiste -- No --> NuevaConfig[Crear nueva configuración]

    NuevaConfig --> DefinirFechas[Definir fechas:\nInicio matrícula · Fin matrícula\nInicio clases · Fin año escolar]
    EditarConfig --> DefinirFechas

    DefinirFechas --> ConfigCostos[Configurar costos:\nMatrícula por nivel\nMensualidades · Descuentos]
    ConfigCostos --> ConfigPromociones[Configurar parámetros de promoción:\nNota mínima de aprobación\nMáx. de asignaturas reprobadas]

    ConfigPromociones --> ActivarNiveles[Activar o desactivar\nniveles y cursos para el año]
    ActivarNiveles --> VerificarIntegridad{¿Configuración\ncompleta y coherente?}
    VerificarIntegridad -- No --> MostrarErrores[Mostrar errores:\nFechas inválidas · Costos en cero\nNiveles sin cursos]
    MostrarErrores --> DefinirFechas

    VerificarIntegridad -- Sí --> VistaPrevia[Mostrar vista previa\nde la configuración]
    VistaPrevia --> ConfirmarPublicar{¿Confirmar y publicar\nconfiguración?}
    ConfirmarPublicar -- No --> EditarConfig
    ConfirmarPublicar -- Sí --> PublicarConfig[Publicar configuración\ndel año lectivo]
    PublicarConfig --> HabilitarMatricula[Habilitar módulo de matrícula\npara el período definido]
    HabilitarMatricula --> NotificarEquipo[Notificar a Secretaría y Finanzas\nvía email]
    NotificarEquipo --> RegistrarAuditoria[Registrar cambio en auditoría]
    RegistrarAuditoria --> End([Fin])
```

---

## Diagrama General — Interacción entre Módulos

```mermaid
flowchart TD
    Config[⚙️ 6. Configuración\ndel Año Escolar] --> Cursos[📚 4. Gestión de\nCursos y Secciones]
    Config --> Matricula[📋 3. Proceso de\nMatrícula]

    Usuarios[👥 1. Gestión de\nUsuarios y Roles] --> Estudiantes[🎓 2. Gestión de\nEstudiantes]
    Usuarios --> Matricula
    Usuarios --> Cursos

    Estudiantes --> Matricula
    Cursos --> Matricula

    Matricula --> Reportes[📊 5. Reportes]
    Cursos --> Reportes
    Estudiantes --> Reportes
```
