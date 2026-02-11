import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose/dist/mongoose.module';
import { User, UserSchema } from './user.schema';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';
import { SettingsService } from './settings/settings.service';
import {
  Verification,
  VerificationSchema,
} from './auth/verification/verification.schema';
import { Invite, InviteSchema } from './auth/invite/invite.schema';
import { CryptoModule } from 'src/modules/vendors/crypto/crypto.module';
import { InviteRepository } from './auth/invite/invite.repository';
import { InviteService } from './auth/invite/invite.service';
import { VerificationRepository } from './auth/verification/verification.repository';
import { VerificationService } from './auth/verification/verification.service';
import { AuthService } from './auth/auth.service';
import { TelegramGuard } from './auth/guards/telegram.guard';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Invite.name, schema: InviteSchema },
      { name: Verification.name, schema: VerificationSchema },
    ]),
    CryptoModule,
  ],
  providers: [
    UserRepository,
    UserService,
    SettingsService,
    InviteRepository,
    InviteService,
    VerificationRepository,
    VerificationService,
    AuthService,
    TelegramGuard,
  ],
  exports: [UserService, SettingsService],
})
export class UserModule {}
