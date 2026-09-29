import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';

export class CreateEpicDto {
  @ApiProperty({
    example: 'Epic Autentikasi',
    description: 'Judul epic (3 - 100 karakter)',
  })
  @IsString()
  @IsNotEmpty({ message: 'Judul epic tidak boleh kosong' })
  @Length(3, 100, { message: 'Judul epic harus antara 3 hingga 100 karakter' })
  title: string;

  @ApiPropertyOptional({
    example: 'Semua pekerjaan terkait login dan register',
    description: 'Deskripsi epic (opsional, maks 500 karakter)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Deskripsi maksimal 500 karakter' })
  description?: string;

  @ApiProperty({
    example: '2026-10-01',
    description: 'Tanggal mulai (ISO 8601)',
  })
  @IsNotEmpty({ message: 'start_date tidak boleh kosong' })
  @IsDateString(
    {},
    { message: 'start_date harus berupa tanggal ISO 8601 yang valid' },
  )
  start_date: string;

  @ApiProperty({
    example: '2026-10-31',
    description: 'Tanggal selesai (ISO 8601), harus >= start_date',
  })
  @IsNotEmpty({ message: 'end_date tidak boleh kosong' })
  @IsDateString(
    {},
    { message: 'end_date harus berupa tanggal ISO 8601 yang valid' },
  )
  end_date: string;
}
