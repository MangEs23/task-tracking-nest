import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateStatusDto {
  @ApiProperty({ example: 'In Progress', description: 'Nama status' })
  @IsNotEmpty({ message: 'Nama status tidak boleh kosong' })
  @IsString()
  name: string;

  // @ApiPropertyOptional({ example: 2, description: 'Urutan tampilan status (opsional)' })
  // @IsOptional()
  // @IsNumber({}, { message: 'Order harus berupa angka' })
  // order?: number;

  // @ApiPropertyOptional({ example: false, default: false, description: 'Menandakan apakah status ini status default proyek' })
  // @IsOptional()
  // @IsBoolean()
  // is_default?: boolean = false;

  // @ApiPropertyOptional({ example: false, default: false, description: 'Menandakan apakah status ini menandakan task selesai' })
  // @IsOptional()
  // @IsBoolean()
  // is_done?: boolean = false;
}