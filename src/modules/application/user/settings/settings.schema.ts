import { Prop } from '@nestjs/mongoose';

export class Settings {
  @Prop({ default: false })
  useAI!: boolean;

  //час отправки автоматического отчета (0–23), null = отключено
  @Prop({ type: Number, default: null })
  reportHour!: number | null;
}
