import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsObject, IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Hand-written DTO classes decorated with `@nestjs/swagger` and `class-validator`.
 * They are the single source of truth for the OpenAPI document emitted by
 * `openapi:emit`, which `tako generate` then turns into Zod schemas and an
 * Angular client for the frontend.
 */

export class Project {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty()
  @IsString()
  name!: string;
}

export class User {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;

  @ApiProperty({ format: 'email' })
  @IsString()
  email!: string;

  @ApiProperty()
  @IsString()
  name!: string;
}

export class Task {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  title!: string;

  @ApiProperty()
  done!: boolean;

  @ApiProperty({ type: () => Project })
  project!: Project;

  @ApiPropertyOptional({ type: () => User })
  assignee?: User;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: 'Free-form string labels attached to the task.',
  })
  labels!: Record<string, string>;
}

export class NewTask {
  @ApiProperty()
  @IsString()
  title!: string;

  @ApiProperty({ description: 'Id of an existing project (see GET /tasks).' })
  @IsString()
  projectId!: string;

  @ApiPropertyOptional({ description: 'Id of an existing user.' })
  @IsOptional()
  @IsString()
  assigneeId?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: { type: 'string' } })
  @IsOptional()
  @IsObject()
  labels?: Record<string, string>;
}
