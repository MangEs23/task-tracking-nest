import { Module } from '@nestjs/common';
import { ProjectsModule } from '../projects/projects.module';
import { EpicsController } from './epics.controller';
import { EpicsService } from './epics.service';
import { EpicAdminGuard } from './guards/epic-admin.guard';
import { EpicMemberGuard } from './guards/epic-member.guard';

@Module({
  imports: [ProjectsModule],
  controllers: [EpicsController],
  providers: [EpicsService, EpicAdminGuard, EpicMemberGuard],
})
export class EpicsModule {}
