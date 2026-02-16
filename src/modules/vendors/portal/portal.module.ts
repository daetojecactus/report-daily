import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PortalClient } from './portal.client';
import { PortalRepository } from './portal.repository';
import { PortalService } from './portal.service';

@Module({
  imports: [ConfigModule],
  providers: [PortalClient, PortalRepository, PortalService],
  exports: [PortalService],
})
export class PortalModule {}
