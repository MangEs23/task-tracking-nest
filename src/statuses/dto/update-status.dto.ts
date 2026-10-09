import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsString,
  ValidateIf,
} from 'class-validator';

export class UpdateStatusDto {
  @ApiPropertyOptional({
    example: 'In Review',
    description: 'Nama status',
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty({ message: 'Nama status tidak boleh kosong' })
  name?: string;

  @ApiPropertyOptional({
    example: true,
    description: 'Menandakan status default project',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  is_default?: boolean;

  @ApiPropertyOptional({
    example: false,
    description: 'Menandakan task sudah selesai',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  is_done?: boolean;
}