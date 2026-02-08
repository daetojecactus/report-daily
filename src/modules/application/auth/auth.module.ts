import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Invite, InviteSchema } from './invite/invite.schema';
import {
  Verification,
  VerificationSchema,
} from './verification/verification.schema';
import { AuthService } from './auth.service';
import { TelegramGuard } from './guards/telegram.guard';
import { UserModule } from '../user/user.module';
import { InviteService } from './invite/invite.service';
import { InviteRepository } from './invite/invite.repository';
import { VerificationService } from './verification/verification.service';
import { VerificationRepository } from './verification/verification.repository';
import { CryptoModule } from 'src/modules/vendors/crypto/crypto.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Invite.name, schema: InviteSchema },
      { name: Verification.name, schema: VerificationSchema },
    ]),
    forwardRef(() => UserModule),
    CryptoModule,
  ],
  providers: [
    InviteRepository,
    VerificationRepository,
    InviteService,
    VerificationService,
    AuthService,
    TelegramGuard,
  ],
  exports: [AuthService, TelegramGuard],
})
export class AuthModule {}
