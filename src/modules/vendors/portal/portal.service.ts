import { Injectable } from '@nestjs/common';
import { PortalRepository } from './portal.repository';
import type { PortalUser } from './portal.interface';
import { formatDateToISO } from 'src/common/helpers/date.helper';
import { PortalAccessibilityType } from './portal.type';

@Injectable()
export class PortalService {
  constructor(private readonly portalRepository: PortalRepository) {}

  async findUserByEmail(email: string): Promise<PortalUser | null> {
    return this.portalRepository.findUserByEmail(email);
  }

  async findUserByName(
    name: string,
    lastName: string,
  ): Promise<PortalUser | null> {
    return this.portalRepository.findUserByName(name, lastName);
  }

  async findUserByFullName(fullName: string): Promise<PortalUser | null> {
    const [name, lastName] = fullName.split(' ');
    return this.findUserByName(name, lastName);
  }

  async getUsersAccessibility(
    userIds: string[],
    dateFrom: string,
    dateTo: string,
  ) {
    return this.portalRepository.getUsersAccessibility(
      userIds,
      dateFrom,
      dateTo,
    );
  }

  async getTodayOffUsers(userIds: string[]) {
    const date = formatDateToISO();

    const userAccessibilities = await this.getUsersAccessibility(
      userIds,
      date,
      date,
    );

    const offUsers: string[] = [];

    for (const userId of userIds) {
      const records = userAccessibilities[userId] ?? [];

      const isAbsentToday = records.some(
        (record) => record.ACCESSIBILITY === PortalAccessibilityType.ABSENT,
      );

      if (isAbsentToday) {
        offUsers.push(userId);
      }
    }

    return offUsers;
  }
}
