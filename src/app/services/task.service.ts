import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

import { Task } from '../models/task';

@Injectable({
  providedIn: 'root',
})
export class TaskService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  getTasks(): Observable<Task[]> {
    return this.http.get<Task[]>(this.apiUrl);
  }

  createTask(title: string, description: string = ''): Observable<Task> {
    return this.http.post<Task>(this.apiUrl, {
      title,
      description: description.trim() || null,
    });
  }

  updateTaskCompletion(id: number, isCompleted: boolean): Observable<void> {
    return this.http.patch<void>(`${this.apiUrl}/${id}/complete`, { isCompleted });
  }

  deleteTask(id: number): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  updateTask(id: number, title: string, description: string): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${id}`, {
      title,
      description: description.trim() || null,
    });
  }
}
