import { Injectable } from '@nestjs/common';
import type { TaskCreateDto } from '@example/tasks/zod/index';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.db.orm.public.Task.include('project')
      .include('assignee')
      .all();
  }

  async create(data: TaskCreateDto) {
    const task = await this.prisma.db.orm.public.Task.create(data);
    return this.prisma.db.orm.public.Task.where({ id: task.id })
      .include('project')
      .include('assignee')
      .first();
  }
}
