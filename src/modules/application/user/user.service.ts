import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRepository } from './user.repository';
import { User } from './user.schema';
import { Settings } from './settings/settings.schema';
import { UserMessages } from './constants/user.messages';
import { CreateUserInput, UserGender, UserStatus } from './user.interface';
import { GitLabService } from 'src/modules/vendors/gitlab/gitlab.service';
import { GitLabMessages } from 'src/modules/vendors/gitlab/constants/gitlab.messages';
import { PortalService } from 'src/modules/vendors/portal/portal.service';
import { PortalMessages } from 'src/modules/vendors/portal/constants/portal.messages';

@Injectable()
export class UserService {
  constructor(
    private readonly userRepository: UserRepository,
    private readonly gitLabService: GitLabService,
    private readonly portalService: PortalService,
  ) {}

  async findOne(filter: Partial<User>) {
    return this.userRepository.findOne(filter);
  }

  async find(filter?: Partial<User>) {
    return this.userRepository.find(filter);
  }

  async create(user: User) {
    return this.userRepository.create(user);
  }

  async updateOne(filter: Partial<User>, partialUser: Partial<User>) {
    const user = await this.userRepository.updateOne(
      filter,
      { $set: partialUser },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException(UserMessages.USER_NOT_FOUND);
    }

    return user;
  }

  async findByReportHour(hour: number) {
    return this.userRepository.findByReportHour(hour);
  }

  async updateUserSettings(
    filter: Partial<User>,
    partialSettings: Partial<Settings>,
  ) {
    return this.userRepository.updateSettings(filter, partialSettings);
  }

  async createUser(input: CreateUserInput) {
    const gitLabUser = await this.gitLabService.findUserByUsername(
      input.adminId,
    );
    if (!gitLabUser) {
      throw new NotFoundException(GitLabMessages.GITLAB_USER_NOT_FOUND);
    }

    const portalUser = await this.portalService.findUserByFullName(
      gitLabUser.name,
    );
    if (!portalUser) {
      throw new NotFoundException(PortalMessages.PORTAL_USER_NOT_FOUND);
    }

    const user = await this.create({
      adminId: input.adminId,
      telegramId: input.telegramId,
      gitLabId: Number(gitLabUser.id),
      portalId: Number(portalUser.ID),
      role: input.role,
      gender:
        portalUser.PERSONAL_GENDER === 'F'
          ? UserGender.FEMALE
          : UserGender.MALE,
      status: UserStatus.ACTIVE,
      settings: {
        reportHour: Number(input.reportHour),
        useAI: true,
      },
    });
    return user;
  }
}
