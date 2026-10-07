import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';

export class UpdateEpicDto {
  @ApiPropertyOptional({
    example: 'Epic Autentikasi',
    description: 'Judul epic (3 - 100 karakter)',
  })
  @ValidateIf((o) => o.title !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'Judul epic tidak boleh kosong' })
  @Length(3, 100, { message: 'Judul epic harus antara 3 hingga 100 karakter' })
  title?: string;

  @ApiPropertyOptional({
    example: 'Semua pekerjaan terkait login dan register',
    description: 'Deskripsi epic (maks 500 karakter)',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500, { message: 'Deskripsi maksimal 500 karakter' })
  description?: string | null;

  @ApiPropertyOptional({
    example: '2026-10-01',
    description: 'Tanggal mulai (ISO 8601)',
  })
  @ValidateIf((o) => o.start_date !== undefined)
  @IsDateString(
    {},
    { message: 'start_date harus berupa tanggal ISO 8601 yang valid' },
  )
  start_date?: string;

  @ApiPropertyOptional({
    example: '2026-10-31',
    description: 'Tanggal selesai (ISO 8601), harus >= start_date',
  })
  @ValidateIf((o) => o.end_date !== undefined)
  @IsDateString(
    {},
    { message: 'end_date harus berupa tanggal ISO 8601 yang valid' },
  )
  end_date?: string;
}
