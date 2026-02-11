import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserGender, UserRole } from '../../user.interface';

@Schema({ collection: 'verification', timestamps: true })
export class Verification {
  @Prop({ required: true })
  code!: string;

  @Prop({ required: true, unique: true })
  telegramId!: number;

  @Prop({ required: true })
  email!: string;

  @Prop({ required: true, unique: true })
  adminId!: string;

  @Prop({ required: true, enum: UserRole })
  role!: UserRole;

  @Prop({ required: true, enum: UserGender })
  gender!: UserGender;

  @Prop({ required: true, default: 0 })
  attempts!: number;

  @Prop({ required: true, index: true })
  createdAt!: Date;
}

export type VerificationDocument = HydratedDocument<Verification>;
export const VerificationSchema = SchemaFactory.createForClass(Verification);

//TTL 15 минут
VerificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 15 * 60 });
