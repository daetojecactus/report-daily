import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { HealthStatus } from 'src/modules/application/system/system.enums';
import { SystemService } from 'src/modules/application/system/system.service';

@Controller('health')
export class HealthController {
  constructor(private readonly systemService: SystemService) {}

  @Get('live')
  live() {
    return { status: HealthStatus.OK };
  }

  @Get('ready')
  async ready(@Res({ passthrough: true }) reply: FastifyReply) {
    const health = await this.systemService.getHealth();
    if (health.status !== HealthStatus.OK) {
      void reply.status(HttpStatus.SERVICE_UNAVAILABLE);
    }
    return health;
  }
}
