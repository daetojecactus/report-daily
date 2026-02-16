import { Prop } from '@nestjs/mongoose';

export class Settings {
  @Prop({ default: false })
  useAI!: boolean;

  //час отправки автоматического отчета (0–23)
  @Prop({ type: Number })
  reportHour!: number;
}
