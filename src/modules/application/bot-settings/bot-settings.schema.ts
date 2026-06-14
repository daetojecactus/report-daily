import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ collection: 'bot_settings', timestamps: true })
export class BotSettings {
  @Prop({ required: true, unique: true, default: 'default' })
  key!: string;

  @Prop({ default: true })
  isActive!: boolean;

  @Prop({ default: false })
  isForceBlocked!: boolean;
}

export type BotSettingsDocument = HydratedDocument<BotSettings>;
export const BotSettingsSchema = SchemaFactory.createForClass(BotSettings);
