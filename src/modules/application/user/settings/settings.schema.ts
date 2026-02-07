import { Prop } from '@nestjs/mongoose';

export class Settings {
  @Prop({ default: false })
  skipAI!: boolean;

  @Prop({ default: false })
  skipGitLab!: boolean;
}
