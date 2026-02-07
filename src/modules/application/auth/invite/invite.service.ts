import { Injectable } from '@nestjs/common';
import { InviteRepository } from './invite.repository';
import { Invite } from './invite.schema';

/**
 * InviteService - сервис для работы с invite-кодами
 *
 * Invite-коды используются для регистрации новых сотрудников:
 * 1. Админ создаёт invite с привязкой к GitLab username
 * 2. Сотрудник получает ссылку t.me/bot?start=CODE
 * 3. При переходе по ссылке invite активируется и создаётся user
 *
 * Особенности:
 * - Коды одноразовые (после использования удаляются)
 * - Коды имеют TTL (по умолчанию 48 часов)
 * - MongoDB автоматически удаляет просроченные коды через TTL индекс
 */
@Injectable()
export class InviteService {
  constructor(private readonly inviteRepository: InviteRepository) {}

  /**
   * Найти invite по фильтру
   */
  async findOne(filter: Partial<Invite>) {
    return this.inviteRepository.findOne(filter);
  }

  /**
   * Найти все invite по фильтру
   */
  async find(filter?: Partial<Invite>) {
    return this.inviteRepository.find(filter);
  }

  /**
   * Создать новый invite
   *
   * @param invite - данные invite (code, adminId, role, expiresAt)
   */
  async create(invite: Invite) {
    return this.inviteRepository.create(invite);
  }

  /**
   * Найти неиспользованный invite по коду
   *
   * @param code - invite-код
   * @returns invite или null если не найден/использован
   */
  async findByCode(code: string) {
    return this.inviteRepository.findOne({ code, used: false });
  }

  /**
   * Пометить invite как использованный
   * (альтернатива удалению, если нужна история)
   *
   * @param code - invite-код
   */
  async markAsUsed(code: string) {
    return this.inviteRepository.updateOne({ code }, { used: true });
  }

  /**
   * Удалить invite по коду
   * Вызывается после успешной активации или при истечении срока
   *
   * @param code - invite-код
   */
  async deleteOne(filter: Partial<Invite>) {
    await this.inviteRepository.deleteOne(filter);
  }
}
