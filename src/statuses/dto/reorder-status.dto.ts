import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsNotEmpty, IsNumber, IsUUID, ValidateNested } from 'class-validator';

export class StatusOrderItemDto {
  @ApiProperty({ example: '4ac53b2c-1fbd-4aab-8de1-2730f53a45ba', description: 'ID Status' })
  @IsNotEmpty()
  @IsUUID('4', { message: 'id status harus berupa UUID v4 valid' })
  id: string;

  @ApiProperty({ example: 1, description: 'Urutan baru' })
  @IsNotEmpty()
  @IsNumber({}, { message: 'order harus berupa angka' })
  order: number;
}

export class ReorderStatusDto {
  @ApiProperty({ type: [StatusOrderItemDto], description: 'Daftar item status dengan order baru' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StatusOrderItemDto)
  statuses: StatusOrderItemDto[];
}