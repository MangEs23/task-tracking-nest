import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { IsAttachmentUrl } from '../validators/is-attachment-url.validator';

export class UpdateAttachmentDto {
  @ApiPropertyOptional({
    example: 'https://www.figma.com/file/updated123',
    description: 'URL pengganti, harus http/https tanpa kredensial',
    maxLength: 2048,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsAttachmentUrl()
  url?: string;

  @ApiPropertyOptional({
    example: 'Desain terbaru',
    description: 'Judul pengganti; string kosong memakai hostname URL',
    maxLength: 150,
  })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsString({ message: 'Title must be a string' })
  @MaxLength(150, {
    message: 'Title must not exceed 150 characters',
  })
  title?: string;
}