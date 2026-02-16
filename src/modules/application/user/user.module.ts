import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose/dist/mongoose.module';
import { User, UserSchema } from './user.schema';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';
import { SettingsService } from './settings/settings.service';
import { AuthService } from './auth/auth.service';
import { TelegramGuard } from './auth/guards/telegram.guard';
import { VendorModule } from 'src/modules/vendors/vendor.module';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    VendorModule,
  ],
  providers: [
    UserRepository,
    UserService,
    SettingsService,
    AuthService,
    TelegramGuard,
  ],
  exports: [UserService, SettingsService],
})
export class UserModule {}
