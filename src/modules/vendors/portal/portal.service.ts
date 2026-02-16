import { Injectable } from '@nestjs/common';
import { PortalRepository } from './portal.repository';
import type { PortalAbsence, PortalUser } from './portal.types';

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

  async getAbsences(params: {
    dateFrom: string;
    dateTo: string;
    userId?: string;
  }): Promise<PortalAbsence[]> {
    return this.portalRepository.getAbsences(params);
  }

  async getTodayOffUsers(): Promise<PortalAbsence[]> {
    const today = new Date();
    const date = today.toISOString().split('T')[0];
    return this.getAbsences({ dateFrom: date, dateTo: date });
  }

  async getUserAbsencesForDate(userId: string) {
    const today = new Date();
    const date = today.toISOString().split('T')[0];
    return this.getAbsences({ dateFrom: date, dateTo: date, userId });
  }
}
