import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TaskPriority } from './create-task.dto';

export class FilterTaskDto {
  @ApiPropertyOptional({ description: 'Filter berdasarkan status_id' })
  @IsOptional()
  @IsUUID('4', { message: 'status harus berupa UUID v4 valid' })
  status?: string;

  @ApiPropertyOptional({ description: 'Filter berdasarkan user_id assignee' })
  @IsOptional()
  @IsUUID('4', { message: 'assignee harus berupa UUID v4 valid' })
  assignee?: string;

  @ApiPropertyOptional({ enum: TaskPriority, description: 'Filter berdasarkan tingkat prioritas' })
  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @ApiPropertyOptional({ description: 'Filter task yang tenggat waktunya sebelum atau pada tanggal ini (ISO Date)' })
  @IsOptional()
  @IsDateString()
  due_before?: string;
}