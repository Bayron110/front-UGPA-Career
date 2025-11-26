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

  // Crear docente
  crearDocente(docente: Docente): Observable<Docente> {
    return this.http.post<Docente>(`${this.apiUrl}`, docente);
  }

  // Obtener docentes por carrera
  obtenerPorCarrera(carreraId: string): Observable<Docente[]> {
  return this.http.get<Docente[]>(`${this.apiUrl}/${carreraId}`);
}


  // Toggle participación
  cambiarParticipacion(id: string): Observable<Docente> {
    return this.http.put<Docente>(`${this.apiUrl}/${id}/participacion`, {});
  }
}