import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, Length, MaxLength } from 'class-validator';

export class CreateProjectDto {
  @ApiProperty({
    example: 'test create project',
    description: 'Nama project (3 - 100 karakter)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Nama project tidak boleh kosong' })
  @Length(3, 100, { message: 'Nama project harus antara 3 hingga 100 karakter' })
  name: string;

  @ApiPropertyOptional({
    example: 'test deskripsi project',
    description: 'Deskripsi project (opsional, maks 500 karakter)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Deskripsi maksimal 500 karakter' })
  description?: string;
}