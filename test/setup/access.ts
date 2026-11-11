import type { INestApplicationContext } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { Permission } from 'src/modules/application/user/types/user.enums';
import { BotSection } from 'src/modules/application/bot/core/bot.decorator';
import { BotAccess } from 'src/modules/application/bot/core/types/bot.enums';

const HANDLER_SUFFIX = 'Handler';

export function findBotHandlersWithoutAccess(app: INestApplicationContext) {
  const accessLevels = new Set<string>([...Object.values(BotAccess), ...Object.values(Permission)]);
  const discoveryService = app.get(DiscoveryService);
  const missing: string[] = [];

  for (const wrapper of discoveryService.getProviders()) {
    const name = String(wrapper.name);
    if (!name.endsWith(HANDLER_SUFFIX)) {
      continue;
    }
    const options = discoveryService.getMetadataByDecorator(BotSection, wrapper);
    if (!options || !accessLevels.has(options.access)) {
      missing.push(name);
    }
  }

  return missing;
}
