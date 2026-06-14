import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Settings } from './settings/settings.schema';
import { UserGender, UserRole, UserStatus } from './user.enums';

@Schema({ collection: 'users', timestamps: true })
export class User {
  @Prop({ unique: true })
  adminId!: string;

  @Prop({ required: true, unique: true })
  telegramId!: number;

  @Prop({ required: true, unique: true })
  gitLabId!: number;

  @Prop({ required: true, unique: true })
  portalId!: number;

  @Prop({ required: true, enum: UserRole })
  role!: UserRole;

  @Prop({ default: UserStatus.ACTIVE, enum: UserStatus })
  status!: UserStatus;

  @Prop({ required: true, enum: UserGender })
  gender!: UserGender;

  @Prop({ type: Settings })
  settings!: Settings;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
