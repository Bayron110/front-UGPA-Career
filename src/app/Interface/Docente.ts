export interface Docente {
  id?: string;   // opcional, lo genera MongoDB
  nombre: string; // único campo obligatorio
  carreraId?: string
}