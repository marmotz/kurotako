import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { NewTask, Task } from './dto';
import { TasksService } from './tasks.service';

@ApiTags('tasks')
@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  @ApiOperation({ operationId: 'listTasks' })
  @ApiOkResponse({ type: [Task] })
  list(): Task[] {
    return this.tasksService.list();
  }

  @Get(':id')
  @ApiOperation({ operationId: 'getTask' })
  @ApiOkResponse({ type: Task })
  get(@Param('id') id: string): Task {
    return this.tasksService.get(id);
  }

  @Post()
  @ApiOperation({ operationId: 'createTask' })
  @ApiCreatedResponse({ type: Task })
  create(@Body() body: NewTask): Task {
    return this.tasksService.create(body);
  }
}
