import { Module } from '@nestjs/common';
import { CertificatesController } from './certificates.controller';
import { CertificatesService } from './certificates.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [PrismaModule, AuditModule],
  controllers: [CertificatesController],
  providers: [CertificatesService],
  exports: [CertificatesService],
})
export class CertificatesModule {}
