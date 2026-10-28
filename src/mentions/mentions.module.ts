import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MentionsController } from './mentions.controller';
import { MentionsService } from './mentions.service';

@Module({
  imports: [PrismaModule],
  controllers: [MentionsController],
  providers: [MentionsService],
})
export class MentionsModule {}