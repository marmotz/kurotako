import { Component } from '@angular/core';
import { type Field, FormField, submit } from '@angular/forms/signals';
import { createNewTaskUpdateForm } from 'tasks/angular';
import { NewTaskCreateSchema } from 'tasks/zod';
import { TasksApiService } from './tasks-api.service';

// No PUT/PATCH endpoint exists on the backend (out of scope) — this component
// demonstrates the Signal Forms *update* factory/schema generated from the
// OpenAPI `NewTask` schema, side by side with the reactive *create* factory
// (TaskCreateFormComponent), then submits through the same POST /tasks.
@Component({
  selector: 'app-task-edit-form',
  imports: [FormField],
  template: `
    <form (submit)="submitForm($event)">
      <label>
        Title
        <input type="text" [formField]="titleField" />
      </label>
      <label>
        Project id
        <input type="text" [formField]="projectIdField" />
      </label>
      <label>
        Assignee id (optional)
        <input type="text" [formField]="assigneeIdField" />
      </label>
      @for (error of form().errors(); track error.message) {
        <p class="error">{{ error.message }}</p>
      }
      <button type="submit">Save (signal forms)</button>
    </form>
  `,
})
export class TaskEditFormComponent {
  constructor(private readonly tasksApi: TasksApiService) {}

  protected readonly form = createNewTaskUpdateForm({
    title: '',
    projectId: '',
    assigneeId: '',
  });

  protected get titleField(): Field<string> {
    return this.form.title as unknown as Field<string>;
  }

  protected get projectIdField(): Field<string> {
    return this.form.projectId as unknown as Field<string>;
  }

  protected get assigneeIdField(): Field<string> {
    return this.form.assigneeId as unknown as Field<string>;
  }

  submitForm(event: SubmitEvent): void {
    event.preventDefault();
    submit(this.form, async (f) => {
      const value = f().value();
      const result = NewTaskCreateSchema.safeParse({
        ...value,
        assigneeId: value.assigneeId || undefined,
      });
      if (!result.success) {
        return result.error.issues.map((issue) => ({
          kind: 'zod' as const,
          message: issue.message,
        }));
      }
      await this.tasksApi.createTask(result.data).toPromise();
      return undefined;
    });
  }
}
