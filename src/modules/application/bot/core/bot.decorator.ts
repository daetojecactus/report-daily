import { DiscoveryService } from '@nestjs/core';
import type { BotSectionOptions } from './types/bot.interface';

export const BotSection = DiscoveryService.createDecorator<BotSectionOptions>();
