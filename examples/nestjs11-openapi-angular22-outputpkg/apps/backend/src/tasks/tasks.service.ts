import { Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { NewTask, Project, Task, User } from './dto';

/**
 * In-memory store. This example is about the OpenAPI -> kurotako pipeline, so it
 * keeps no database: the data lives in plain arrays seeded at startup.
 */
@Injectable()
export class TasksService {
  private readonly projects: Project[] = [
    { id: 'p1', name: 'Platform' },
    { id: 'p2', name: 'Website' },
  ];

  private readonly users: User[] = [
    { id: 'u1', email: 'ada@example.com', name: 'Ada' },
  ];

  private readonly tasks: Task[] = [
    {
      id: 't1',
      title: 'Write the OpenAPI example',
      done: false,
      project: this.projects[0]!,
      assignee: this.users[0],
      labels: { priority: 'high' },
    },
  ];

  list(): Task[] {
    return this.tasks;
  }

  get(id: string): Task {
    const task = this.tasks.find((entry) => entry.id === id);
    if (task === undefined) throw new NotFoundException(`No task ${id}`);
    return task;
  }

  create(input: NewTask): Task {
    const project = this.projects.find((entry) => entry.id === input.projectId);
    if (project === undefined)
      throw new NotFoundException(`No project ${input.projectId}`);
    const assignee =
      input.assigneeId === undefined
        ? undefined
        : this.users.find((entry) => entry.id === input.assigneeId);

    const task: Task = {
      id: randomUUID(),
      title: input.title,
      done: false,
      project,
      labels: input.labels ?? {},
      ...(assignee !== undefined ? { assignee } : {}),
    };
    this.tasks.push(task);
    return task;
  }
}
