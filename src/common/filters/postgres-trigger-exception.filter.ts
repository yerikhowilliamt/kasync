import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { AllocationExceededError } from '../errors/allocation-exceeded.error';

@Catch(Prisma.PrismaClientKnownRequestError)
export class PostgresTriggerExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // P2010: Raw query failed (e.g. trigger RAISE EXCEPTION)
    // P2034: Transaction failed due to a write conflict or trigger rollback
    if (exception.code === 'P2010' || exception.code === 'P2034') {
      const dbErrorMessage =
        (exception.meta?.message as string) ||
        (exception.meta?.database_error as string) ||
        exception.message;

      if (
        dbErrorMessage.includes('Allocation total') ||
        dbErrorMessage.includes('exceed')
      ) {
        const error = new AllocationExceededError(
          undefined,
          undefined,
          undefined,
          dbErrorMessage,
        );
        return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          error: error.name,
          message: error.message,
        });
      }

      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'Bad Request',
        message: dbErrorMessage,
      });
    }

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: exception.message,
    });
  }
}
