import { Controller, Get, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';
import { PrismaService } from './prisma/prisma.service';

@ApiTags('health')
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Health check (public)' })
  getHello(): string {
    return this.appService.getHello();
  }

  @Public()
  @Get('health/db')
  @ApiOperation({ summary: 'Check database connection' })
  async checkDb() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
      };
    } catch (error) {
      return {
        status: 'error',
        database: 'disconnected',
        message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check auth guard - returns current user' })
  getMe(@Request() req: any) {
    return {
      message: 'Auth guard works',
      user: req.user,
    };
  }
}
