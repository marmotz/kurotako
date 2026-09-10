import { Component, inject } from '@angular/core';
import { TasksApiService } from './tasks-api.service';

@Component({
  selector: 'app-task-list',
  template: `
    @if (tasks.isLoading()) {
      <p>Loading tasks…</p>
    }
    @if (tasks.error()) {
      <p>Failed to load tasks.</p>
    }
    <ul>
      @for (task of tasks.value(); track task.id) {
        <li>
          {{ task.title }} — {{ task.project.name }}
          @if (task.assignee) {
            (assigned to {{ task.assignee.name }})
          }
          @if (task.done) {
            ✅
          }
        </li>
      }
    </ul>
  `,
})
export class TaskListComponent {
  private readonly tasksApi = inject(TasksApiService);
  protected readonly tasks = this.tasksApi.getTasks();
}
