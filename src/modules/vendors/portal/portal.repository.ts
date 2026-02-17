import { Injectable, Logger } from '@nestjs/common';
import { PortalClient } from './portal.client';
import { PortalMessages } from './constants/portal.messages';
import type {
  PortalAccessibility,
  PortalResponse,
  PortalUser,
} from './portal.interface';

@Injectable()
export class PortalRepository {
  private readonly logger = new Logger(PortalRepository.name);
  constructor(private readonly portalClient: PortalClient) {}

  //находим пользователя по email
  async findUserByEmail(email: string): Promise<PortalUser | null> {
    try {
      const { data } = await this.portalClient.instance.post<
        PortalResponse<PortalUser[]>
      >('user.get.json', {
        filter: { EMAIL: email },
      });

      this.logger.log(PortalMessages.PORTAL_USER_FETCH_SUCCESS);
      return data.result.length > 0 ? data.result[0] : null;
    } catch (error) {
      this.logger.error(PortalMessages.PORTAL_USER_FETCH_ERROR, error);
      return null;
    }
  }

  //находим пользователя по имени и фамилии
  async findUserByName(
    name: string,
    lastName: string,
  ): Promise<PortalUser | null> {
    try {
      const { data } = await this.portalClient.instance.post<
        PortalResponse<PortalUser[]>
      >('user.get.json', {
        filter: { NAME: name, LAST_NAME: lastName },
      });

      this.logger.log(PortalMessages.PORTAL_USER_FETCH_SUCCESS);
      return data.result.length > 0 ? data.result[0] : null;
    } catch (error) {
      this.logger.error(PortalMessages.PORTAL_USER_FETCH_ERROR, error);
      return null;
    }
  }

  //получаем занятость пользователей из календаря
  async getUsersAccessibility(
    userIds: string[],
    dateFrom: string,
    dateTo: string,
  ): Promise<PortalAccessibility[]> {
    const { data } = await this.portalClient.instance.post<
      PortalResponse<PortalAccessibility[]>
    >('calendar.accessibility.get.json', {
      users: userIds,
      from: dateFrom,
      to: dateTo,
    });

    return data.result ?? [];
  }
}
