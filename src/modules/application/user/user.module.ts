import { Module } from '@nestjs/common';
import { ChannelRepository } from './channel/channel.repository';
import { ChannelService } from './channel/channel.service';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';
import { UserSourceRepository } from './user-source/user-source.repository';
import { UserSourceService } from './user-source/user-source.service';

@Module({
  providers: [
    UserService,
    UserRepository,
    ChannelService,
    ChannelRepository,
    UserSourceService,
    UserSourceRepository,
  ],
  exports: [UserService, ChannelService, UserSourceService],
})
export class UserModule {}
