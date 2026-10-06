import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { TaskPriority } from './create-task.dto';

export class UpdateTaskDto {
  @ApiPropertyOptional({ example: 'Implementasi JWT Auth (revisi)' })
  @IsOptional()
  @IsString()
  @IsNotEmpty({ message: 'title must not be empty' })
  title?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority, { message: 'priority must be one of Low, Medium, High, Urgent' })
  priority?: TaskPriority;

  @ApiPropertyOptional({ example: '2026-10-20T23:59:59.000Z', nullable: true })
  @IsOptional()
  @IsDateString({}, { message: 'due_date must be a valid ISO date string' })
  due_date?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID('4', { message: 'status_id must be a valid UUID v4' })
  status_id?: string;
}