import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsUUID,
  Matches,
  ValidateIf,
} from 'class-validator';
import { TaskPriority } from './create-task.dto';
import { Transform } from 'class-transformer';

const UUID_OR_ME =
  /^(me|[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i;

export class FilterTaskDto {
  @ApiPropertyOptional({ description: 'status_id' })
  @IsOptional()
  @IsUUID('4', { message: 'status must be a valid UUID v4' })
  status?: string;

  @ApiPropertyOptional({ description: 'user_id assignee, atau "me"' })
  @IsOptional()
  @Matches(UUID_OR_ME, { message: 'assignee must be a UUID v4 or "me"' })
  assignee?: string;

  @ApiPropertyOptional({
    description: 'Filter task yang menyebut user: UUID user atau "me"',
    example: 'me',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @Matches(UUID_OR_ME, {
    message: 'mentioned must be a UUID v4 or "me"',
  })
  mentioned?: string;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Due date <= tanggal ini (ISO date)' })
  @IsOptional()
  @IsDateString()
  due_before?: string;
}
