import { Body, Controller, Get, Post } from '@nestjs/common';
import type { TaskCreateDto } from 'tasks/zod';
import { TaskCreateSchema } from 'tasks/zod';
import { TasksService } from './tasks.service';
import { ZodValidationPipe } from './zod-validation.pipe';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  list() {
    return this.tasksService.list();
  }

  @Post()
  create(
    @Body(new ZodValidationPipe(TaskCreateSchema)) body: TaskCreateDto,
  ) {
    return this.tasksService.create(body);
  }
}
