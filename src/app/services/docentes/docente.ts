import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Docente } from '../../Interface/Docente';

@Injectable({
  providedIn: 'root'
})
export class DocenteService {
  private apiUrl = 'https://baken-ugpa-career.onrender.com/api/docentes';

  constructor(private http: HttpClient) {}

  // Crear docente (solo nombre)
  crearDocente(docente: Docente): Observable<Docente> {
  return this.http.post<Docente>(this.apiUrl, docente);
}

  // Obtener todos los docentes
  obtenerDocentes(): Observable<Docente[]> {
    return this.http.get<Docente[]>(this.apiUrl);
  }

  // Obtener docente por ID
  obtenerDocentePorId(id: string): Observable<Docente> {
    return this.http.get<Docente>(`${this.apiUrl}/${id}`);
  }

  // Actualizar docente
  actualizarDocente(id: string, docente: Docente): Observable<Docente> {
    return this.http.put<Docente>(`${this.apiUrl}/${id}`, docente);
  }

  // Eliminar docente
  eliminarDocente(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
  obtenerPorCarrera(carreraId: string): Observable<Docente[]> {
  return this.http.get<Docente[]>(`${this.apiUrl}/carrera/${carreraId}`);
}

}