import { BadRequestException, type PipeTransform } from '@nestjs/common';
import { z } from 'zod';

export class ZodValidationPipe<Schema extends z.ZodType>
  implements PipeTransform
{
  constructor(private readonly schema: Schema) {}

  transform(value: unknown): z.infer<Schema> {
    try {
      return this.schema.parse(value);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new BadRequestException(z.flattenError(error));
      }
      throw error;
    }
  }
}
