import { Module } from '@nestjs/common';
import { ChannelRepository } from './channel/channel.repository';
import { ChannelService } from './channel/channel.service';
import { UserRepository } from './user.repository';
import { UserService } from './user.service';

@Module({
  providers: [UserService, UserRepository, ChannelService, ChannelRepository],
  exports: [UserService, ChannelService],
})
export class UserModule {}
