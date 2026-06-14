import { Prop } from '@nestjs/mongoose';
import { Language } from '../../../../common/i18n/i18n';
import { ReportTemplate } from '../user.enums';

export class Settings {
  @Prop({ default: false })
  useAI!: boolean;

  //час отправки автоматического отчета (0–23)
  @Prop({ type: Number })
  reportHour!: number;

  //шаблон формата отчёта
  @Prop({ default: ReportTemplate.STANDARD, enum: ReportTemplate })
  reportTemplate!: ReportTemplate;

  //язык интерфейса и отчётов
  @Prop({ default: Language.RU, enum: Language })
  language!: Language;
}
