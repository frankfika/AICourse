import { CertificatesService } from './certificates.service';

describe('CertificatesService', () => {
  it('reissues after a revoked certificate instead of returning the invalid row', async () => {
    const revoked = { id: 'revoked-cert', revokedAt: new Date() };
    const replacement = { id: 'replacement-cert', revokedAt: null };
    const prisma = {
      certificate: {
        findFirst: jest
          .fn()
          .mockResolvedValueOnce(null) // no active certificate
          .mockResolvedValueOnce({ serialNumber: 'OCSG-2026-DEGREE-0001' }),
        create: jest.fn().mockResolvedValue(replacement),
      },
    };
    const auditLog = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new CertificatesService(prisma as never, auditLog as never);

    await expect(
      service.issueCertificate({
        userId: 'user-1',
        type: 'degree',
        refId: 'degree-1',
        title: 'Degree certificate',
      }),
    ).resolves.toBe(replacement);

    expect(prisma.certificate.findFirst).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ revokedAt: null }),
      }),
    );
    expect(prisma.certificate.create).toHaveBeenCalled();
    expect(revoked.id).not.toBe(replacement.id);
  });
});
