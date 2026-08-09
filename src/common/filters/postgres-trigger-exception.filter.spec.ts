import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { PostgresTriggerExceptionFilter } from './postgres-trigger-exception.filter';

interface MockResponse {
  status: jest.Mock;
  json: jest.Mock;
}

describe('PostgresTriggerExceptionFilter', () => {
  let filter: PostgresTriggerExceptionFilter;
  let mockResponse: MockResponse;
  let mockArgumentsHost: ArgumentsHost;

  beforeEach(() => {
    filter = new PostgresTriggerExceptionFilter();
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    mockArgumentsHost = {
      switchToHttp: jest.fn().mockReturnValue({
        getResponse: () => mockResponse as unknown as Response,
      }),
    } as unknown as ArgumentsHost;
  });

  it('should map P2010 allocation exceed trigger exception to 400 Bad Request AllocationExceededError', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Allocation total (150.00) would exceed bank transaction amount (100.00) for transaction txn-123',
      {
        code: 'P2010',
        clientVersion: '5.22.0',
        meta: {
          message:
            'Allocation total (150.00) would exceed bank transaction amount (100.00) for transaction txn-123',
        },
      },
    );

    filter.catch(prismaError, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'AllocationExceededError',
      message:
        'Allocation total (150.00) would exceed bank transaction amount (100.00) for transaction txn-123',
    });
  });

  it('should map unknown P2010 exception to 400 Bad Request', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Raw query failed',
      {
        code: 'P2010',
        clientVersion: '5.22.0',
        meta: { message: 'Some custom DB constraint failed' },
      },
    );

    filter.catch(prismaError, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      message: 'Some custom DB constraint failed',
    });
  });

  it('should map other Prisma errors to 500 Internal Server Error', () => {
    const prismaError = new Prisma.PrismaClientKnownRequestError(
      'Unique constraint failed',
      {
        code: 'P2002',
        clientVersion: '5.22.0',
      },
    );

    filter.catch(prismaError, mockArgumentsHost);

    expect(mockResponse.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(mockResponse.json).toHaveBeenCalledWith({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      message: 'An unexpected error occurred. Please try again later.',
    });
  });
});
