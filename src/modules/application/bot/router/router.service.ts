import { Injectable, type OnModuleInit } from '@nestjs/common';
import { DiscoveryService } from '@nestjs/core';
import { BotCommand } from '../types/bot.enums';
import {
  BOT_BUTTON_DATA_SCHEMA,
  BOT_BUTTON_DATA_SEPARATOR,
  BOT_COMMAND_SCHEMA,
} from '../constants/bot.constants';
import { BotMessages } from '../constants/bot.messages';
import { BotSection } from '../bot.decorator';
import type { BotHandler, BotMenuItem, BotRoute } from '../types/bot.interface';

@Injectable()
export class RouterService implements OnModuleInit {
  private readonly routes: BotRoute[] = [];

  constructor(private readonly discoveryService: DiscoveryService) {}

  onModuleInit() {
    const wrappers = this.discoveryService.getProviders({
      metadataKey: BotSection.KEY,
    });
    for (const wrapper of wrappers) {
      const options = this.discoveryService.getMetadataByDecorator(BotSection, wrapper);
      if (options?.access) {
        this.register({ ...options, handler: wrapper.instance as BotHandler });
      }
    }
  }

  findByCommand(command: string) {
    const parsed = BOT_COMMAND_SCHEMA.safeParse(command);
    if (!parsed.success) {
      return null;
    }
    return this.routes.find((route) => route.commands?.includes(parsed.data)) ?? null;
  }

  findByNamespace(namespace: string) {
    return this.routes.find((route) => route.namespace === namespace) ?? null;
  }

  findByButton(data: string) {
    const parsed = BOT_BUTTON_DATA_SCHEMA.safeParse(data);
    if (!parsed.success) {
      return null;
    }
    return this.findByNamespace(parsed.data.split(BOT_BUTTON_DATA_SEPARATOR)[0]);
  }

  listMenu(): BotMenuItem[] {
    return Object.values(BotCommand).flatMap((command) => {
      const route = this.findByCommand(command);
      return route ? [{ command, access: route.access }] : [];
    });
  }

  private register(route: BotRoute) {
    for (const command of route.commands ?? []) {
      if (this.findByCommand(command)) {
        throw new Error(`${BotMessages.DUPLICATE_COMMAND}: ${command}`);
      }
    }
    if (route.namespace && this.findByNamespace(route.namespace)) {
      throw new Error(`${BotMessages.DUPLICATE_NAMESPACE}: ${route.namespace}`);
    }
    this.routes.push(route);
  }
}
