import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

//глобальные настройки бота (единственный документ в коллекции)
@Schema({ collection: 'bot-settings', timestamps: true })
export class BotSettings {
  //уникальный ключ, всегда 'default'
  @Prop({ required: true, unique: true, default: 'default' })
  key!: string;

  //активен ли бот сегодня (отправлять ли отчёты, управляется календарём)
  @Prop({ default: true })
  isActive!: boolean;

  //причина деактивации по календарю (например: "Выходной день", "Праздник")
  @Prop({ type: String, default: null })
  reason!: string | null;

  //принудительная блокировка бота (приоритетнее isActive)
  @Prop({ default: false })
  isForceBlocked!: boolean;

  //причина принудительной блокировки (например: "Работы на проде", "Баг")
  @Prop({ type: String, default: null })
  forceBlockReason!: string | null;
}

export type BotSettingsDocument = HydratedDocument<BotSettings>;
export const BotSettingsSchema = SchemaFactory.createForClass(BotSettings);
