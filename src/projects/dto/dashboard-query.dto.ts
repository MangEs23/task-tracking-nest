import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export class DashboardQueryDto {
  @ApiPropertyOptional({
    example: 3,
    default: 3,
    description: 'Jumlah hari ke depan untuk menghitung task due soon (1 - 365)',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'due_within harus berupa bilangan bulat' })
  @Min(1, { message: 'due_within minimal 1' })
  @Max(365, { message: 'due_within maksimal 365' })
  due_within?: number = 3;
}