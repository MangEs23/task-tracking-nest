import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsUUID } from 'class-validator';

export class AssignUserDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'ID User yang akan di-assign ke task',
  })
  @IsNotEmpty({ message: 'user_id tidak boleh kosong' })
  @IsUUID('4', { message: 'user_id harus berupa UUID v4 valid' })
  user_id: string;
}
