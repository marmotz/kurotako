import { Body, Controller, Get, Post } from '@nestjs/common';
import type { TaskCreateDto } from '@example/tasks/zod';
import { TaskCreateSchema, TaskReadDeepSchema } from '@example/tasks/zod';
import { z } from 'zod';
import { TasksService } from './tasks.service';
import { ZodValidationPipe } from './zod-validation.pipe';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  // The read schema drops `User.passwordHash` (declared `hidden`) from the nested
  // assignee, which the ORM row carries.
  @Get()
  async list() {
    return z.array(TaskReadDeepSchema).parse(await this.tasksService.list());
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(TaskCreateSchema)) body: TaskCreateDto,
  ) {
    return this.tasksService.create(body);
  }
}
