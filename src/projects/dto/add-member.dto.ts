import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional } from 'class-validator';

export enum ProjectRole {
  ADMIN = 'admin',
  MEMBER = 'member',
}

export class AddMemberDto {
  @ApiProperty({
    example: 'anggota.baru@example.com',
    description: 'Email user yang akan ditambahkan ke proyek',
  })
  @IsEmail({}, { message: 'Format email tidak valid' })
  @IsNotEmpty({ message: 'Email tidak boleh kosong' })
  email: string;

  @ApiPropertyOptional({
    example: 'member',
    enum: ProjectRole,
    default: ProjectRole.MEMBER,
    description: 'Role member di dalam proyek (admin / member)',
  })
  @IsOptional()
  @IsEnum(ProjectRole, { message: 'Role harus berupa "admin" atau "member"' })
  role?: ProjectRole = ProjectRole.MEMBER;
}
