import { Injectable, Logger } from '@nestjs/common';
import { PortalClient } from './portal.client';
import { PortalMessages } from './constants/portal.messages';
import type { PortalAbsence, PortalResponse, PortalUser } from './portal.types';

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

  //получаем график отсутствий за период
  async getAbsences(params: {
    dateFrom: string;
    dateTo: string;
    userId?: string;
  }): Promise<PortalAbsence[]> {
    try {
      const { dateFrom, dateTo, userId } = params;

      const filter: Record<string, string> = {
        '>=DATE_FROM': dateFrom,
        '<=DATE_TO': dateTo,
      };

      if (userId) {
        filter.USER_ID = userId;
      }

      const { data } = await this.portalClient.instance.post<
        PortalResponse<PortalAbsence[]>
      >('timeman.timecontrol.reports.get.json', {
        filter,
      });

      this.logger.log(PortalMessages.PORTAL_ABSENCE_FETCH_SUCCESS);
      return data.result;
    } catch (error) {
      this.logger.error(PortalMessages.PORTAL_ABSENCE_FETCH_ERROR, error);
      return [];
    }
  }

  // получаем график отсутствий пользователя за период
  async getUserAbsences(params: {
    userId: string;
    dateFrom: string;
    dateTo: string;
  }): Promise<PortalAbsence[]> {
    try {
      const { userId, dateFrom, dateTo } = params;

      const { data } = await this.portalClient.instance.post<
        PortalResponse<PortalAbsence[]>
      >('user.absence.get.json', {
        FILTER: {
          USER_ID: userId,
          DATE_FROM: dateFrom,
          DATE_TO: dateTo,
        },
      });

      this.logger.log(PortalMessages.PORTAL_ABSENCE_FETCH_SUCCESS);
      return data.result;
    } catch (error) {
      this.logger.error(PortalMessages.PORTAL_ABSENCE_FETCH_ERROR, error);
      return [];
    }
  }
}
