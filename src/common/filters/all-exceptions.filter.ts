import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const body = exception.getResponse();
      const message =
        typeof body === 'string'
          ? body
          : (body as { message?: string | string[] }).message;
      res.status(status).json({ status, message });
      return;
    }

    // Error tak terduga (Prisma, bug, dll): log di server, jangan bocorkan ke klien
    this.logger.error(
      exception instanceof Error ? exception.stack : String(exception),
    );
    res.status(500).json({ status: 500, message: 'Internal server error' });
  }
}