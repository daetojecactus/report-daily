import { Module } from '@nestjs/common';
import { GitLabModule } from './gitlab/gitlab.module';
import { PortalModule } from './portal/portal.module';
import { GroqModule } from './groq/groq.module';
import { OpenRouterModule } from './open-router/open-router.module';
import { ProductionCalendarModule } from './production-calendar/production-calendar.module';
import { TelegramModule } from './telegram/telegram.module';

@Module({
  imports: [
    GitLabModule,
    GroqModule,
    OpenRouterModule,
    PortalModule,
    ProductionCalendarModule,
    TelegramModule,
  ],
  exports: [
    GitLabModule,
    GroqModule,
    OpenRouterModule,
    PortalModule,
    ProductionCalendarModule,
    TelegramModule,
  ],
})
export class VendorModule {}
