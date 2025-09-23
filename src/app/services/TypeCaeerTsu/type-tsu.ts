import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { AxlesTsu } from '../../Interface/Alex2';

@Injectable({
  providedIn: 'root'
})
export class AxlesTsuService {

  private apiUrl = 'http://localhost:8080/api/axles-tsu';

  constructor(private http: HttpClient) {}

  getAll(): Observable<AxlesTsu[]> {
    return this.http.get<AxlesTsu[]>(this.apiUrl);
  }

  getById(id: string): Observable<AxlesTsu> {
    return this.http.get<AxlesTsu>(`${this.apiUrl}/${id}`);
  }

  save(axle: AxlesTsu): Observable<AxlesTsu> {
    return this.http.post<AxlesTsu>(this.apiUrl, axle);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  getByCalCareerId(calCareerId: string): Observable<AxlesTsu[]> {
    return this.http.get<AxlesTsu[]>(`${this.apiUrl}/career/${calCareerId}`);
  }
}
