import { Injectable, NotFoundException } from '@nestjs/common';
import { InviteRepository } from './invite.repository';
import { Invite } from './invite.schema';
import { InviteMessages } from './constants/invite.messages';

@Injectable()
export class InviteService {
  constructor(private readonly inviteRepository: InviteRepository) {}

  async findOne(filter: Partial<Invite>) {
    return this.inviteRepository.findOne(filter);
  }

  async find(filter?: Partial<Invite>) {
    return this.inviteRepository.find(filter);
  }

  async create(invite: Invite) {
    return this.inviteRepository.create(invite);
  }

  async updateOne(filter: Partial<Invite>, partialInvite: Partial<Invite>) {
    const invite = await this.inviteRepository.updateOne(
      filter,
      { $set: partialInvite },
      { new: true },
    );
    if (!invite) {
      throw new NotFoundException(InviteMessages.INVITE_NOT_FOUND);
    }

    return invite;
  }

  async deleteOne(filter: Partial<Invite>) {
    await this.inviteRepository.deleteOne(filter);
  }
}
