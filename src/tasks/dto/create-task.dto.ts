import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';

export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent',
}

export class CreateTaskDto {
  @ApiProperty({ example: 'Implementasi JWT Auth' })
  @IsString()
  @IsNotEmpty({ message: 'title must not be empty' })
  title: string;

  @ApiPropertyOptional({ example: 'Membuat guard dan strategy di NestJS' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: TaskPriority, example: TaskPriority.MEDIUM })
  @IsNotEmpty({ message: 'priority is required' })
  @IsEnum(TaskPriority, {
    message: 'priority must be one of Low, Medium, High, Urgent',
  })
  priority: TaskPriority;

  @ApiPropertyOptional({ example: '2026-10-15T23:59:59.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'due_date must be a valid ISO date string' })
  due_date?: string;

  @ApiPropertyOptional({ description: 'Kosong = pakai status default project' })
  @IsOptional()
  @IsUUID('4', { message: 'status_id must be a valid UUID v4' })
  status_id?: string;
}
