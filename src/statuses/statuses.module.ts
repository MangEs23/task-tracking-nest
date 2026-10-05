import { Module } from '@nestjs/common';
import { StatusesService } from './statuses.service';
import { StatusesController } from './statuses.controller';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectsModule } from '../projects/projects.module';
import { StatusAdminGuard } from './guards/status-admin.guard';

@Module({
  imports: [PrismaModule, ProjectsModule],
  controllers: [StatusesController],
  providers: [StatusesService, StatusAdminGuard],
  exports: [StatusesService],
})
export class StatusesModule {}