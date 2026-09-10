import { Component, inject } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { NewTaskCreateSchema } from '@example/tasks/zod/index';
import { TasksApiService } from './tasks-api.service';

// This form is built by hand with plain `FormGroup`/`FormControl` instead of the
// generated `NewTaskFormFactory` reactive factory: `@example/tasks` (mode B) is
// built by tsup, not ng-packagr, so its `@Injectable` factory classes carry no
// `design:paramtypes` metadata and importing that file crashes the app at load
// time (NG0202). `NewTaskCreateSchema` is a plain function with no decorators, so
// client-side validation still exercises the real generated schema.
@Component({
  selector: 'app-task-create-form',
  imports: [ReactiveFormsModule],
  template: `
    <form [formGroup]="form" (ngSubmit)="submit()">
      <label>
        Title
        <input formControlName="title" />
      </label>
      <label>
        Project id
        <input formControlName="projectId" />
      </label>
      <label>
        Assignee id (optional)
        <input formControlName="assigneeId" />
      </label>
      @for (error of formErrors; track error) {
        <p class="error">{{ error }}</p>
      }
      <button type="submit">Create (reactive)</button>
    </form>
  `,
})
export class TaskCreateFormComponent {
  private readonly tasksApi = inject(TasksApiService);

  protected readonly form = new FormGroup({
    title: new FormControl('', { nonNullable: true }),
    projectId: new FormControl('', { nonNullable: true }),
    assigneeId: new FormControl('', { nonNullable: true }),
  });

  protected formErrors: string[] = [];

  submit(): void {
    const value = this.form.getRawValue();
    const result = NewTaskCreateSchema.safeParse({
      ...value,
      assigneeId: value.assigneeId || undefined,
    });
    if (!result.success) {
      this.formErrors = result.error.issues.map((issue) => issue.message);
      return;
    }
    this.formErrors = [];
    this.tasksApi.createTask(result.data).subscribe(() => this.form.reset());
  }
}
