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


  getAll(): Observable<AxlesSuperior[]> {
    return this.http.get<AxlesSuperior[]>(this.apiUrl);
  }

  getById(id: string): Observable<AxlesSuperior> {
    return this.http.get<AxlesSuperior>(`${this.apiUrl}/${id}`);
  }


  save(axle: AxlesSuperior): Observable<AxlesSuperior> {
    return this.http.post<AxlesSuperior>(this.apiUrl, axle);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getByCalCareerId(calCareerId: string): Observable<AxlesSuperior[]> {
    return this.http.get<AxlesSuperior[]>(`${this.apiUrl}/career/${calCareerId}`);
  }
}