import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: PrismaService,
          useValue: { $queryRaw: jest.fn() },
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health/db', () => {
    it('should return connected when query succeeds', async () => {
      const prisma = (appController as any).prisma;
      prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
      await expect(appController.checkDb()).resolves.toEqual({
        status: 'ok',
        database: 'connected',
      });
    });

    it('should return disconnected when query fails', async () => {
      const prisma = (appController as any).prisma;
      prisma.$queryRaw.mockRejectedValue(new Error('boom'));
      await expect(appController.checkDb()).resolves.toEqual({
        status: 'error',
        database: 'disconnected',
        message: 'boom',
      });
    });
  });
});