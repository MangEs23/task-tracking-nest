import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class MentionProjectFilterDto {
  @ApiPropertyOptional({
    description: 'Batasi hasil ke project tertentu',
    format: 'uuid',
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsUUID('4', {
    message: 'project_id must be a valid UUID v4',
  })
  project_id?: string;
}

export class MentionInboxQueryDto extends MentionProjectFilterDto {
  @ApiPropertyOptional({
    description: 'true: hanya mention yang belum dibaca',
    default: false,
    type: Boolean,
  })
  @Transform(({ value }) => {
    if (value === 'true') return true;
    if (value === 'false') return false;
    return value;
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean({
    message: 'unread must be true or false',
  })
  unread: boolean = false;

  @ApiPropertyOptional({
    description: 'Jumlah item per halaman',
    default: 20,
    minimum: 1,
    maximum: 50,
    type: Number,
  })
  @Transform(({ value }) =>
    typeof value === 'string' && /^\d+$/.test(value)
      ? Number(value)
      : value,
  )
  @ValidateIf((_, value) => value !== undefined)
  @IsInt({
    message: 'limit must be an integer',
  })
  @Min(1, {
    message: 'limit minimal 1',
  })
  @Max(50, {
    message: 'limit maksimal 50',
  })
  limit: number = 20;

  @ApiPropertyOptional({
    description: 'Gunakan next_cursor dari respons halaman sebelumnya',
    type: String,
  })
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  cursor?: string;
}

export class ReadAllMentionsDto extends MentionProjectFilterDto {}