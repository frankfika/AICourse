import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllExceptionsFilter } from './all-exceptions.filter';

describe('AllExceptionsFilter', () => {
  const status = jest.fn();
  const json = jest.fn();
  const response = { status, json };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
    }),
  } as unknown as ArgumentsHost;

  beforeEach(() => {
    jest.clearAllMocks();
    status.mockReturnValue(response);
  });

  it.each([
    ['P2002', HttpStatus.CONFLICT, 'Resource already exists'],
    ['P2025', HttpStatus.NOT_FOUND, 'Resource not found'],
    ['P2003', HttpStatus.CONFLICT, 'Resource is still referenced'],
    ['P2023', HttpStatus.BAD_REQUEST, 'Invalid identifier'],
  ])('maps Prisma %s without leaking database details', (code, expectedStatus, message) => {
    const error = new Prisma.PrismaClientKnownRequestError('sensitive database detail', {
      code,
      clientVersion: 'test',
    });

    new AllExceptionsFilter().catch(error, host);

    expect(status).toHaveBeenCalledWith(expectedStatus);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: expectedStatus, message }),
    );
    expect(JSON.stringify(json.mock.calls)).not.toContain('sensitive database detail');
  });
});
