import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { UserRole, UserStatus } from './user.interface';
import { Settings } from './settings/settings.schema';

@Schema({ collection: 'user', timestamps: true })
export class User {
  @Prop({ unique: true })
  adminId!: string;

  @Prop({ required: true, unique: true })
  telegramId!: number;

  @Prop({ required: true, enum: UserRole })
  role!: UserRole;

  @Prop({ default: UserStatus.PENDING, enum: UserStatus })
  status!: UserStatus;

  @Prop({ type: Settings })
  settings: Settings;
}

export type UserDocument = HydratedDocument<User>;
export const UserSchema = SchemaFactory.createForClass(User);
