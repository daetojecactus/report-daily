import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserGender, UserRole } from '../../user.interface';

//коды приглашения для регистрации новых сотрудников
@Schema({ collection: 'invite', timestamps: true })
export class Invite {
  @Prop({ required: true, unique: true, index: true })
  code!: string;

  @Prop({ required: true })
  adminId!: string;

  @Prop({ required: true })
  email!: string;

  @Prop({ required: true, enum: UserRole })
  role!: UserRole;

  @Prop({ required: true, enum: UserGender })
  gender!: UserGender;

  @Prop({ index: true })
  createdAt!: Date;
}

export type InviteDocument = HydratedDocument<Invite>;
export const InviteSchema = SchemaFactory.createForClass(Invite);

//день жизни кода пришлашения
InviteSchema.index({ createdAt: 1 }, { expireAfterSeconds: 24 * 60 * 60 });
