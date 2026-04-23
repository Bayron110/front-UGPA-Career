import { HomeCard } from "../../Interface/home/HomeCards";

export const HOME_CARDS: HomeCard[] = [
        
    { badge: 'Control de Asistencia', 
        title: 'Panel de Administrador', 
        description: 'Control de inducciones al proceso de titulación.', 
        footer: 'Inducciones', 
        image: 'https://i.postimg.cc/XqjCL7yt/Asistencia.jpg', 
        action: 'iraControlInd' },
        
        { badge: 'Documentos Docentes', 
        title: 'Documentos Web Docentes', 
        description: 'Control de los Documentos de la Capacitación Docente.', 
        footer: 'Documentos Web', 
        image: 'https://i.postimg.cc/V6wPpzdv/pexels-karola-g-7876786.jpg', 
        action: 'irDocumentosWeb' },

                { badge: 'Agenda', 
        title: 'Agenda de Actividades', 
        description: 'Agenda de actividades de los procesos en vigencia.', 
        footer: 'Agendar', 
        image: 'https://i.postimg.cc/sg2XH9ts/pexels-karola-g-5387241.jpg', 
        action: 'irAAgendar' },

];
