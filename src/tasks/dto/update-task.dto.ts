import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TaskPriority } from './create-task.dto';

export class UpdateTaskDto {
  @ApiPropertyOptional({ example: 'Implementasi JWT Auth Updated' })
  @IsOptional()
  @IsString()
  title?: string;

  @ApiPropertyOptional({ example: 'Deskripsi yang diperbarui' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: 'High', enum: TaskPriority })
  @IsOptional()
  @IsEnum(TaskPriority, { message: 'Priority harus berupa Low, Medium, High, atau Urgent' })
  priority?: TaskPriority;

  @ApiPropertyOptional({ example: '2026-10-20T23:59:59.000Z' })
  @IsOptional()
  @IsDateString({}, { message: 'Format due_date harus ISO date string' })
  due_date?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsOptional()
  @IsUUID('4', { message: 'status_id harus berupa UUID v4 valid' })
  status_id?: string;
}