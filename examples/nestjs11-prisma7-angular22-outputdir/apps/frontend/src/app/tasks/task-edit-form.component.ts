import { Component } from '@angular/core';
import { type Field, FormField, submit } from '@angular/forms/signals';
import { createTaskUpdateForm } from 'tasks/angular';
import { TaskCreateSchema } from 'tasks/zod';
import { TasksApiService } from './tasks-api.service';

// No PUT/PATCH endpoint exists on the backend (out of scope, see #80) — this
// component demonstrates the Signal Forms *update* factory/schema side by side
// with the reactive *create* factory (TaskCreateFormComponent), then submits
// through the same POST /tasks the reactive form uses.
//
// `createTaskUpdateForm` always fills every field with a concrete value (see
// the generated `createTaskUpdateModel`), but its declared type is
// `TaskUpdateDto` — a `Partial<...>`, since the Update variant also supports
// partial patches. `[formField]` requires a `Field<T>` with no `undefined` in
// `T`, so the per-field getters below narrow that back to the concrete type
// this component actually guarantees at runtime.
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

  protected readonly form = createTaskUpdateForm({
    title: '',
    projectId: '',
    assigneeId: null,
  });

  protected get titleField(): Field<string> {
    return this.form.title as unknown as Field<string>;
  }

  protected get projectIdField(): Field<string> {
    return this.form.projectId as unknown as Field<string>;
  }

  // The native text `<input>` control only binds `Field<string>` /
  // `Field<number | null>` — not `Field<string | null>` — so this field is
  // narrowed to `string` here; an empty string is treated as "no assignee"
  // when the form is submitted below.
  protected get assigneeIdField(): Field<string> {
    return this.form.assigneeId as unknown as Field<string>;
  }

  submitForm(event: SubmitEvent): void {
    event.preventDefault();
    submit(this.form, async (f) => {
      const value = f().value();
      const result = TaskCreateSchema.safeParse({
        ...value,
        assigneeId: value.assigneeId || null,
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
