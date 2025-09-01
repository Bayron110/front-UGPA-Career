// src/app/services/axles-superior.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AxlesSuperior } from '../../Interface/Alex1';

@Injectable({
  providedIn: 'root'
})
export class AxlesSuperiorService {

  private apiUrl = 'http://localhost:8080/api/axles-superior';

  constructor(private http: HttpClient) {}

  // Obtener todos los registros
  getAll(): Observable<AxlesSuperior[]> {
    return this.http.get<AxlesSuperior[]>(this.apiUrl);
  }

  // Obtener por ID
  getById(id: number): Observable<AxlesSuperior> {
    return this.http.get<AxlesSuperior>(`${this.apiUrl}/${id}`);
  }

  // Crear o actualizar
  save(axle: AxlesSuperior): Observable<AxlesSuperior> {
    return this.http.post<AxlesSuperior>(this.apiUrl, axle);
  }

  // Eliminar por ID
  delete(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Buscar por calCareerId
  getByCalCareerId(calCareerId: number): Observable<AxlesSuperior[]> {
    return this.http.get<AxlesSuperior[]>(`${this.apiUrl}/career/${calCareerId}`);
  }
}