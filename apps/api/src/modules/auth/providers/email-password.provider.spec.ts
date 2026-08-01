jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { EmailPasswordProvider } from './email-password.provider';

describe('EmailPasswordProvider', () => {
  const prisma: any = { user: { findUnique: jest.fn() } };
  const provider = new EmailPasswordProvider(prisma, 12);

  beforeEach(() => jest.clearAllMocks());

  it('rejects a soft-deleted user before checking its password', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1', email: 'deleted@example.com', passwordHash: 'hash', deletedAt: new Date(),
    });

    await expect(provider.verify({
      email: 'deleted@example.com', password: 'password', mode: 'login',
    })).rejects.toThrow(UnauthorizedException);
    expect(bcrypt.compare).not.toHaveBeenCalled();
  });
});
