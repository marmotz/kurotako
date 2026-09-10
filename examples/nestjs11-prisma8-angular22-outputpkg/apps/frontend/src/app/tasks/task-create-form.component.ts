import { Component, inject } from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { TaskCreateDeepSchema } from '@example/tasks/zod/index';
import { TasksApiService } from './tasks-api.service';

// relations: 'deep' in this project's tako.config.ts: the generated form nests a
// FormGroup for `project` (required) and one for `assignee` (optional), on top of
// the flat `projectId`/`assigneeId` scalars the backend's POST /tasks still expects
// (see #82) — `TaskCreateDeepSchema` validates both together.
//
// This form is built by hand with plain `FormGroup`/`FormControl` instead of the
// generated `TaskFormFactory` reactive factory: `@example/tasks` (mode B) is built
// by tsup, not ng-packagr, so its `@Injectable` classes (`TaskFormFactory` and the
// `ProjectFormFactory`/`UserFormFactory` it mutually constructor-injects) carry no
// precompiled Ivy metadata and no `design:paramtypes` reflection (esbuild doesn't
// emit TypeScript's `emitDecoratorMetadata` output) — importing that class at all
// makes Angular fall back to JIT-compiling the `@Injectable()` decorator, which
// then fails with NG0202 the moment the module loads, before any code here even
// runs. The zod schema below has no such issue (a plain function, no decorators),
// so client-side validation still genuinely exercises the generated deep schema.
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

      <fieldset formGroupName="project">
        <legend>Project (nested, required)</legend>
        <label>
          Name
          <input formControlName="name" />
        </label>
      </fieldset>

      <fieldset formGroupName="assignee">
        <legend>Assignee (nested, optional)</legend>
        <label>
          Name
          <input formControlName="name" />
        </label>
        <label>
          Email
          <input formControlName="email" />
        </label>
      </fieldset>

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
    project: new FormGroup({
      name: new FormControl('', {
        nonNullable: true,
        validators: [Validators.required],
      }),
    }),
    assignee: new FormGroup({
      name: new FormControl('', { nonNullable: true }),
      email: new FormControl('', { nonNullable: true }),
    }),
  });

  protected formErrors: string[] = [];

  submit(): void {
    const value = this.form.getRawValue();
    // An empty email means "no assignee" — clearing the optional nested group.
    const hasAssignee = value.assignee.email.trim() !== '';

    const result = TaskCreateDeepSchema.safeParse({
      ...value,
      done: false,
      assigneeId: value.assigneeId || null,
      assignee: hasAssignee ? value.assignee : undefined,
    });
    if (!result.success) {
      this.formErrors = result.error.issues.map((issue) => issue.message);
      return;
    }

    this.formErrors = [];
    this.tasksApi
      .createTask({
        title: result.data.title,
        done: result.data.done,
        projectId: result.data.projectId,
        assigneeId: result.data.assigneeId,
      })
      .subscribe(() => this.form.reset());
  }
}
