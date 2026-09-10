import { Component, signal } from '@angular/core';
import { type Field, FormField, form, schema } from '@angular/forms/signals';
import { zodTreeValidate } from '@example/tasks/angular/zod-forms.runtime';
import { NewTaskUpdateSchema } from '@example/tasks/zod/index';
import type { NewTaskUpdateDto } from '@example/tasks/zod/index';
import { TasksApiService } from './tasks-api.service';

// No PUT/PATCH endpoint exists on the backend — this component demonstrates
// Signal Forms side by side with the reactive create form, then submits through
// the same POST /tasks.
//
// The generated `createNewTaskUpdateForm` wrapper is NOT used: its file also
// declares the `NewTaskFormFactory` `@Injectable` class and mode B builds with
// tsup, so importing it crashes the app (NG0202). `zod-forms.runtime` has no
// class and is safe, so the form is composed by hand from the same generated
// `NewTaskUpdateSchema` and `zodTreeValidate` helper.
const initialTask: NewTaskUpdateDto = {
  title: '',
  projectId: '',
  assigneeId: '',
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
    schema<NewTaskUpdateDto>((path) => {
      zodTreeValidate(path, NewTaskUpdateSchema);
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

  submitForm(event: SubmitEvent): void {
    event.preventDefault();
    const value = this.model();
    this.tasksApi
      .createTask({
        title: value.title ?? '',
        projectId: value.projectId ?? '',
        assigneeId: value.assigneeId || undefined,
      })
      .subscribe();
  }
}
