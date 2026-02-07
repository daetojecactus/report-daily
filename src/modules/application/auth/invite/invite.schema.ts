import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserRole } from '../../user/user.interface';

//коды приглашения для регистрации новых сотрудников
@Schema({ collection: 'invite', timestamps: true })
export class Invite {
  @Prop({ required: true, unique: true, index: true })
  code!: string;

  @Prop({ required: true })
  adminId!: string;

  @Prop({ required: true, enum: UserRole })
  role!: UserRole;

  @Prop({ required: true, index: true })
  expiresAt!: Date;

  @Prop({ default: false })
  used!: boolean;
}

export type InviteDocument = HydratedDocument<Invite>;
export const InviteSchema = SchemaFactory.createForClass(Invite);

InviteSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
