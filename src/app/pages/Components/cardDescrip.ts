export interface HomeCard {
    badge: string;
    title: string;
    description: string;
    footer: string;
    image: string;
    action: string;
}

export const HOME_CARDS: HomeCard[] = [
    { badge: '🎯 CARRERA', 
        title: 'Ingrese una Nueva Carrera', 
        description: 'En esta sección usted podrá ingresar nuevas carreras a la base de datos.', 
        footer: 'Ingreso de Nuevas Carreras', image: 'https://i.postimg.cc/CdyRKgBg/Carrera-1.jpg', 
        action: 'irACarrera' },

    { badge: '📚 TIPO', 
        title: 'Duración de Carrera', 
        description: 'En esta sección usted puede modificar la duración de los tipos de carreras existentes.', 
        footer: 'Tipo de Duración', image: 'https://i.postimg.cc/fyQ3zsSY/Duraci-n-1.jpg', 
        action: 'irATipo' },

    { badge: '💼 CÁLCULO', 
        title: 'Calculo de Duración de una Carrera', 
        description: 'Calcule el tiempo estimado de duración de carreras seleccionadas.', 
        footer: 'Estimación de Tiempo', 
        image: 'https://i.postimg.cc/NfJgbYfc/fin-de-carerra-1.webp', 
        action: 'irACalCareer' },

    { badge: '🚀 Carreras de Tipo Superior', 
        title: 'Carreras de Tipo Superior', 
        description: 'En esta sección usted podrá visualizar los contenidos de las carreras y descargar sus respectivos PDF.', 
        footer: 'Historial De Carreras Superiores', 
        image: 'https://i.postimg.cc/s2D6DdCG/Superior-2.png', 
        action: 'irAHistory' },

    { badge: '🚀 Carreras-TSU', 
        title: 'Carreras de Tipo TSU',
        description: 'En esta sección usted podrá visualizar los contenidos de las carreras y descargar sus respectivos PDF.', 
        footer: 'Historial de Carrera TSU', 
        image: 'https://i.postimg.cc/Y9RszrN8/TSU-1.webp', 
        action: 'irAHistorytsu' },

    { badge: '🎯 Patrocinio Institucional', 
        title: 'Generar Plan Individual', 
        description: 'Aquí se puede generar los planes individuales con un excel.', 
        footer: 'Generación de Patrocinios', 
        image: 'https://i.postimg.cc/CdyRKgBg/Carrera-1.jpg', 
        action: 'irAGenerar' },

    { badge: '🚀 Reporte Anual', 
        title: 'Reportes Anuales', 
        description: 'Sección para la generación de reportes anuales.', 
        footer: 'Reporte Anual', 
        image: 'https://i.postimg.cc/j2XxzR4P/Documentos.jpg', 
        action: 'irAReporteA' },

    { badge: '🚀 Documentación', 
        title: 'Patrocinios', 
        description: 'Sección donde podrá generar cualquier patrocinio.', 
        footer: 'Documentación', 
        image: 'https://i.postimg.cc/B6HwLQn5/patrocinio1.avif', 
        action: 'irAReporteR' },

    { badge: '🚀 Eventos', 
        title: 'Agenda', 
        description: 'Sección para ingresar pendientes.', 
        footer: 'Agenda', 
        image: 'https://i.postimg.cc/fbs29Q15/calendario.avif', 
        action: 'irAAgenda' },

    { badge: 'Control Documentos', 
        title: 'Documentos Entregados', 
        description: 'Sección para llevar un control de los documentos entregados.', 
        footer: 'Control', 
        image: 'https://i.postimg.cc/8cZtBYsB/control.webp', 
        action: 'iraControl' },

    { badge: 'DashBoard', 
        title: 'DashBoard Interactivo', 
        description: 'Sección para subir documentos xls o excel para obtener una mejora visual en los datos.', 
        footer: 'Dashboard', 
        image: 'https://i.postimg.cc/zBnQWpnH/dashboard.jpg', 
        action: 'iraDas' },
        
    { badge: 'Control de Asistencia', 
        title: 'Panel de Administrador', 
        description: 'Control de inducciones al proceso de titulación.', 
        footer: 'Inducciones', 
        image: 'https://i.postimg.cc/XqjCL7yt/Asistencia.jpg', 
        action: 'iraControlInd' },
        
        { badge: 'Documentos Docentes', 
        title: 'Panel de Administrador', 
        description: 'Control de los Documentos de la Capacitación Docente.', 
        footer: 'Documentos Web', 
        image: 'https://i.postimg.cc/XqjCL7yt/Asistencia.jpg', 
        action: 'irDocumentosWeb' },

];
