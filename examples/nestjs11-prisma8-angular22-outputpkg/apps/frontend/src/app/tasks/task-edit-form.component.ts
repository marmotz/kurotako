import { Component, signal } from '@angular/core';
import { type Field, form, FormField, schema } from '@angular/forms/signals';
import { zodTreeValidate } from '@example/tasks/angular/zod-forms.runtime';
import { TaskUpdateDeepSchema } from '@example/tasks/zod/index';
import type { TaskUpdateDeepDto } from '@example/tasks/zod/index';
import { TasksApiService } from './tasks-api.service';

// No PUT/PATCH endpoint exists on the backend (out of scope, see #82) — this
// component demonstrates Signal Forms side by side with the reactive *create*
// form (TaskCreateFormComponent), then submits through the same POST /tasks.
//
// The generated `createTaskUpdateForm`/`taskUpdateFormSchema` convenience
// wrappers (Task.form.ts) are NOT used here: that file also declares the
// `TaskFormFactory` `@Injectable` class, and `@example/tasks` (mode B) is built
// by tsup, not ng-packagr — tsup's esbuild step never emits the
// `design:paramtypes` metadata Angular's DI needs for a decorated class, so
// merely importing that file crashes the app at load time (NG0202), before any
// application code runs. `zod-forms.runtime.ts` has no such class and is safe to
// import directly, so the form below is composed by hand from the same
// generated `TaskUpdateDeepSchema` and `zodTreeValidate` helper Task.form.ts
// itself would have used.
//
// `TaskUpdateDeepDto` is a `Partial<...>` (the Update variant also supports
// partial patches), but `[formField]` requires a `Field<T>` with no `undefined`
// in `T` — the getters below narrow that back to the concrete type `initialTask`
// actually guarantees.
const initialTask: TaskUpdateDeepDto = {
  title: '',
  projectId: '',
  assigneeId: null,
  project: { name: '' },
};

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
      <fieldset>
        <legend>Project (nested, required)</legend>
        <label>
          Name
          <input type="text" [formField]="projectNameField" />
        </label>
      </fieldset>
      @for (error of taskForm().errors(); track error.message) {
        <p class="error">{{ error.message }}</p>
      }
      <button type="submit">Save (signal forms)</button>
    </form>
  `,
})
export class TaskEditFormComponent {
  constructor(private readonly tasksApi: TasksApiService) {}

  private readonly model = signal(initialTask);
  protected readonly taskForm = form(
    this.model,
    schema<TaskUpdateDeepDto>((path) => {
      zodTreeValidate(path, TaskUpdateDeepSchema);
    }),
  );

  protected get titleField(): Field<string> {
    return this.taskForm.title as unknown as Field<string>;
  }

  protected get projectIdField(): Field<string> {
    return this.taskForm.projectId as unknown as Field<string>;
  }

  protected get assigneeIdField(): Field<string> {
    return this.taskForm.assigneeId as unknown as Field<string>;
  }

  protected get projectNameField(): Field<string> {
    return (this.taskForm.project as unknown as { name: Field<string> })
      .name;
  }

  submitForm(event: SubmitEvent): void {
    event.preventDefault();
    const value = this.model();
    this.tasksApi
      .createTask({
        title: value.title ?? '',
        done: false,
        projectId: value.projectId ?? '',
        assigneeId: value.assigneeId || null,
      })
      .subscribe();
  }
}
