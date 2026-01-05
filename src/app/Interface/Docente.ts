export interface Docente {
  id?: string;        // opcional, lo genera MongoDB
  nombre: string;     // obligatorio
  carreraId?: string; // vínculo con la carrera

  // 🔹 Nuevos campos
  cedula?: string;      // identificación del docente
  formacion?: string;   // Ej: Ingeniería, Licenciatura
  programa?: string;    // Ej: Maestría en Educación, Doctorado
  estado?: string;      // Ej: Cursando, Finalizado
  periodo?: string;     // Ej: 2022-2024, 2021-I
}