import { Component, inject } from '@angular/core';
import { ReactiveFormsModule } from '@angular/forms';
import { TaskFormFactory } from 'tasks/angular';
import { TaskCreateSchema } from 'tasks/zod';
import { TasksApiService } from './tasks-api.service';

@Component({
  selector: 'app-task-create-form',
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label>
        Title
        <input formControlName="title" />
        @if (form.controls.title.errors?.['zod']) {
          <span class="error">{{ form.controls.title.errors!['zod'] }}</span>
        }
      </label>
      <label>
        Project id
        <input formControlName="projectId" />
        @if (form.controls.projectId.errors?.['zod']) {
          <span class="error">{{ form.controls.projectId.errors!['zod'] }}</span>
        }
      </label>
      <label>
        Assignee id (optional)
        <input formControlName="assigneeId" />
      </label>
      <button type="submit">Create (reactive)</button>
    </form>
  `,
})
export class TaskCreateFormComponent {
  private readonly taskFormFactory = inject(TaskFormFactory);
  private readonly tasksApi = inject(TasksApiService);

  protected readonly form = this.taskFormFactory.createCreateForm();

  submit(): void {
    const result = TaskCreateSchema.safeParse(this.form.getRawValue());
    if (!result.success) {
      for (const issue of result.error.issues) {
        const controlName = issue.path[0] as keyof typeof this.form.controls;
        this.form.controls[controlName]?.setErrors({ zod: issue.message });
      }
      return;
    }
    this.tasksApi.createTask(result.data).subscribe(() => this.form.reset());
  }
}
