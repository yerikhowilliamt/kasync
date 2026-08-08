import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { AllocationExceededError } from '../errors/allocation-exceeded.error';

@Catch(Error, Prisma.PrismaClientKnownRequestError, HttpException)
export class PostgresTriggerExceptionFilter implements ExceptionFilter {
  catch(exception: Error | Prisma.PrismaClientKnownRequestError | HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    if (exception instanceof HttpException) {
      return response.status(exception.getStatus()).json(exception.getResponse());
    }

    if (exception instanceof AllocationExceededError || exception.name === 'AllocationExceededError' || (exception instanceof Error && exception.message.includes('AllocationExceededError'))) {
      const dbErrorMessage = exception.message;
      return response.status(HttpStatus.BAD_REQUEST).json({
        statusCode: HttpStatus.BAD_REQUEST,
        error: 'AllocationExceededError',
        message: dbErrorMessage,
      });
    }

    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
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
    } else if (exception instanceof Error && exception.message.includes('AllocationExceededError')) {
       return response.status(HttpStatus.BAD_REQUEST).json({
          statusCode: HttpStatus.BAD_REQUEST,
          error: 'AllocationExceededError',
          message: exception.message,
        });
    }

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: exception.message,
    });
  }
}
