import type { Routes } from '@angular/router';
import { TaskCreateFormComponent } from './tasks/task-create-form.component';
import { TaskEditFormComponent } from './tasks/task-edit-form.component';
import { TaskListComponent } from './tasks/task-list.component';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'tasks' },
  { path: 'tasks', component: TaskListComponent },
  { path: 'tasks/new', component: TaskCreateFormComponent },
  { path: 'tasks/edit', component: TaskEditFormComponent },
];
