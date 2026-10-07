import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateProjectDto {
  @ApiPropertyOptional({
    example: 'test update project',
    description: 'Nama project (3 - 100 karakter)',
  })
  @ValidateIf((o) => o.name !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'Nama project tidak boleh kosong' })
  @Length(3, 100, {
    message: 'Nama project harus antara 3 hingga 100 karakter',
  })
  name?: string;

  @ApiPropertyOptional({
    example: 'deskripsi baru',
    description: 'Deskripsi project (maks 500 karakter)',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Deskripsi maksimal 500 karakter' })
  description?: string | null;
}
