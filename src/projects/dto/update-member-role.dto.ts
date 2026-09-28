import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty } from 'class-validator';
import { ProjectRole } from './add-member.dto';

export class UpdateMemberRoleDto {
  @ApiProperty({
    example: 'admin',
    enum: ProjectRole,
    description: 'Role baru untuk member proyek (admin / member)',
  })
  @IsNotEmpty({ message: 'Role tidak boleh kosong' })
  @IsEnum(ProjectRole, { message: 'Role harus berupa "admin" atau "member"' })
  role: ProjectRole;
}