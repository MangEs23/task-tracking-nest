import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export enum TaskPriority {
  LOW = 'Low',
  MEDIUM = 'Medium',
  HIGH = 'High',
  URGENT = 'Urgent',
}

export class CreateTaskDto {
  @ApiProperty({ example: 'Implementasi JWT Auth', description: 'Judul task' })
  @IsNotEmpty({ message: 'Title tidak boleh kosong' })
  @IsString()
  title: string;

  @ApiPropertyOptional({ example: 'Membuat guard dan strategy di NestJS', description: 'Deskripsi task' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    example: 'Medium',
    enum: TaskPriority,
    default: TaskPriority.MEDIUM,
    description: 'Prioritas task (Low | Medium | High | Urgent)',
  })
  @IsOptional()
  @IsEnum(TaskPriority, { message: 'Priority harus berupa Low, Medium, High, atau Urgent' })
  priority?: TaskPriority = TaskPriority.MEDIUM;

  @ApiPropertyOptional({ example: '2026-10-15T23:59:59.000Z', description: 'Tenggat waktu task (ISO Date)' })
  @IsOptional()
  @IsDateString({}, { message: 'Format due_date harus ISO date string' })
  due_date?: string;

  @ApiPropertyOptional({ example: '550e8400-e29b-41d4-a716-446655440000', description: 'ID Status (opsional, jika kosong akan menggunakan default status proyek)' })
  @IsOptional()
  @IsUUID('4', { message: 'status_id harus berupa UUID v4 valid' })
  status_id?: string;
}