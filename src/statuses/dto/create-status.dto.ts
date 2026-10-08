import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString } from 'class-validator';

export class CreateStatusDto {
  @ApiProperty({ example: 'In Progress', description: 'Nama status' })
  @IsNotEmpty({ message: 'Nama status tidak boleh kosong' })
  @IsString()
  name: string;
}