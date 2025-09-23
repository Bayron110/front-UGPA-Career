import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { TypeCareer } from '../../Interface/TypeCareer';

@Injectable({
  providedIn: 'root'
})
export class TypeCareerService {
  private apiUrl = 'http://localhost:8080/api/type-career';

  constructor(private http: HttpClient) {}

  guardarTipoCarrera(tipo: TypeCareer): Observable<TypeCareer> {
    return this.http.post<TypeCareer>(this.apiUrl, tipo);
  }

  obtenerTipos(): Observable<TypeCareer[]> {
    return this.http.get<TypeCareer[]>(this.apiUrl);
  }

  actualizarTipo(id: string, tipo: TypeCareer): Observable<TypeCareer> {
    return this.http.put<TypeCareer>(`${this.apiUrl}/${id}`, tipo);
  }

  eliminarTipo(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
