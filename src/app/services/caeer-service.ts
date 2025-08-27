import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { Career } from '../Interface/Career';

@Injectable({
  providedIn: 'root'
})
export class CareerService {
  private apiUrl = 'http://localhost:8080/api/carreras';

  constructor(private http: HttpClient) {}

  guardarCarrera(career: Career): Observable<Career> {
    return this.http.post<Career>(this.apiUrl, career);
  }

  obtenerCarreras(): Observable<Career[]> {
    return this.http.get<Career[]>(this.apiUrl);
  }

  actualizarCarrera(id: number, career: Career): Observable<Career> {
    return this.http.put<Career>(`${this.apiUrl}/${id}`, career);
  }

  eliminarCarrera(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }
}
