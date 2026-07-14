import { Module, forwardRef } from '@nestjs/common';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CertificatesModule } from '../certificates/certificates.module';

@Module({
  imports: [PrismaModule, forwardRef(() => CertificatesModule)],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
