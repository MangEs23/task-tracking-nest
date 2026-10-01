import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateStatusDto {
  @ApiPropertyOptional({ example: 'In Review', description: 'Nama status' })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({ example: 3, description: 'Urutan tampilan status' })
  @IsOptional()
  @IsNumber({}, { message: 'Order harus berupa angka' })
  order?: number;

  @ApiPropertyOptional({ example: true, description: 'Menandakan apakah status ini status default proyek' })
  @IsOptional()
  @IsBoolean()
  is_default?: boolean;

  @ApiPropertyOptional({ example: false, description: 'Menandakan apakah status ini menandakan task selesai' })
  @IsOptional()
  @IsBoolean()
  is_done?: boolean;
}