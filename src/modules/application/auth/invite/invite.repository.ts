import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Invite, InviteDocument } from './invite.schema';
import { InviteMessages } from './constants/invite.messages';

/**
 * InviteRepository - репозиторий для работы с invite-кодами в MongoDB
 *
 * Структура коллекции invite:
 * - code: string (уникальный, индекс)
 * - adminId: string (GitLab username)
 * - role: string (роль в компании)
 * - expiresAt: Date (срок действия, TTL индекс)
 * - used: boolean (использован ли код)
 *
 * TTL индекс:
 * MongoDB автоматически удаляет документы когда expiresAt < now
 * Это происходит в фоне примерно каждые 60 секунд
 */
@Injectable()
export class InviteRepository {
  constructor(
    @InjectModel(Invite.name)
    private readonly inviteModel: Model<InviteDocument>,
  ) {}

  /**
   * Найти один invite по фильтру
   */
  async findOne(filter: Partial<Invite>) {
    return this.inviteModel.findOne(filter);
  }

  /**
   * Найти все invite по фильтру
   */
  find(filter?: Partial<Invite>) {
    return this.inviteModel.find(filter ?? {});
  }

  /**
   * Создать новый invite
   */
  async create(invite: Partial<Invite>) {
    return this.inviteModel.create(invite);
  }

  /**
   * Обновить invite
   *
   * @param filter - фильтр для поиска
   * @param partialInvite - поля для обновления
   * @throws NotFoundException если invite не найден
   */
  async updateOne(filter: Partial<Invite>, partialInvite: Partial<Invite>) {
    const invite = await this.inviteModel.findOneAndUpdate(
      filter,
      { $set: partialInvite },
      { new: true }, // Вернуть обновлённый документ
    );

    if (!invite) {
      throw new NotFoundException(InviteMessages.INVITE_NOT_FOUND);
    }

    return invite;
  }

  /**
   * Удалить invite
   */
  async deleteOne(filter: Partial<Invite>) {
    return this.inviteModel.findOneAndDelete(filter);
  }
}
