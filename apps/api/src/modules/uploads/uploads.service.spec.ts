import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from '../audit/audit-log.service';
import { PrismaService } from '../prisma/prisma.service';
import { S3StorageService } from './storage/s3-storage.service';
import { UploadsService } from './uploads.service';

const mockPrisma: any = {
  user: { update: jest.fn() },
};
const mockStorage: any = {
  headObject: jest.fn(),
  deleteObject: jest.fn(),
  getPublicUrlBase: jest.fn().mockReturnValue('https://assets.example.test/ai-academy'),
};
const mockAuditLog: any = { log: jest.fn().mockResolvedValue({ id: 'audit-1' }) };

describe('UploadsService', () => {
  let service: UploadsService;
  const user = { userId: 'user-1', role: 'student' };
  const key = 'users/avatars/user-1/123-avatar.png';

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrisma.user.update.mockResolvedValue({ id: 'user-1' });
    mockStorage.deleteObject.mockResolvedValue(undefined);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UploadsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: S3StorageService, useValue: mockStorage },
        { provide: AuditLogService, useValue: mockAuditLog },
      ],
    }).compile();
    service = module.get(UploadsService);
  });

  it('uses actual object metadata and accepts an allowed upload', async () => {
    mockStorage.headObject.mockResolvedValue({ key, size: 1024, contentType: 'image/png; charset=binary' });

    const result = await service.complete({ scope: 'user-avatar', key, refId: 'user-1' }, user);

    expect(result.writtenBack).toBe(true);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { avatarUrl: 'https://assets.example.test/ai-academy/users/avatars/user-1/123-avatar.png' },
    });
    expect(mockStorage.deleteObject).not.toHaveBeenCalled();
  });

  it('rejects and removes an object whose actual size exceeds the scope limit', async () => {
    mockStorage.headObject.mockResolvedValue({ key, size: 2 * 1024 * 1024 + 1, contentType: 'image/png' });

    await expect(service.complete({ scope: 'user-avatar', key }, user)).rejects.toThrow(BadRequestException);
    expect(mockStorage.deleteObject).toHaveBeenCalledWith(key);
    expect(mockAuditLog.log).not.toHaveBeenCalled();
  });

  it('rejects and removes an object whose actual content type is not allowed', async () => {
    mockStorage.headObject.mockResolvedValue({ key, size: 1024, contentType: 'application/octet-stream' });

    await expect(service.complete({ scope: 'user-avatar', key }, user)).rejects.toThrow('实际文件类型');
    expect(mockStorage.deleteObject).toHaveBeenCalledWith(key);
  });

  it('rejects empty uploaded objects', async () => {
    mockStorage.headObject.mockResolvedValue({ key, size: 0, contentType: 'image/png' });

    await expect(service.complete({ scope: 'user-avatar', key }, user)).rejects.toThrow('上传文件为空');
    expect(mockStorage.deleteObject).toHaveBeenCalledWith(key);
  });

  it('does not issue public sponsor-logo upload URLs for SVG files', async () => {
    await expect(
      service.sign(
        {
          scope: 'hackathon-sponsor-logo',
          filename: 'logo.svg',
          mimeType: 'image/svg+xml',
          size: 1024,
        },
        { userId: 'admin-1', role: 'admin' },
      ),
    ).rejects.toThrow('不接受 image/svg+xml');
  });
});
