import { Injectable } from '@nestjs/common';
import type { TaskCreateDto } from '@example/tasks/zod/index';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.task.findMany({
      include: { project: true, assignee: true },
    });
  }

  create(data: TaskCreateDto) {
    return this.prisma.task.create({
      data,
      include: { project: true, assignee: true },
    });
  }
}
