import { HttpClient, httpResource } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { NewTaskCreateDto, TaskDto } from 'tasks/zod';

const API_BASE_URL = 'http://localhost:3000';

@Injectable({ providedIn: 'root' })
export class TasksApiService {
  private readonly http = inject(HttpClient);

  getTasks() {
    return httpResource<TaskDto[]>(() => `${API_BASE_URL}/tasks`, {
      defaultValue: [],
    });
  }

  createTask(task: NewTaskCreateDto) {
    return this.http.post<TaskDto>(`${API_BASE_URL}/tasks`, task);
  }
}
