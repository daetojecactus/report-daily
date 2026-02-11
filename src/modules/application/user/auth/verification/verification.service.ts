import {
  Injectable,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { VerificationRepository } from './verification.repository';
import { VerificationMessages } from './constants/verification.messages';
import {
  CreateVerificationInput,
  VerifyCodeInput,
} from './verification.interface';
import { MAX_ATTEMPTS } from './constants/verification.constants';
import { CryptoService } from 'src/modules/vendors/crypto/crypto.service';
import { Verification } from './verification.schema';

@Injectable()
export class VerificationService {
  constructor(
    private readonly verificationRepository: VerificationRepository,
    private readonly cryptoService: CryptoService,
  ) {}

  async findOne(filter: Partial<Verification>) {
    return this.verificationRepository.findOne(filter);
  }

  async create(verification: Verification) {
    return this.verificationRepository.create(verification);
  }

  async updateOne(
    filter: Partial<Verification>,
    partialVerification: Partial<Verification>,
  ) {
    const verification = await this.verificationRepository.updateOne(
      filter,
      {
        $set: partialVerification,
      },
      { new: true },
    );
    if (!verification) {
      throw new NotFoundException(VerificationMessages.VERIFICATION_NOT_FOUND);
    }

    return verification;
  }

  async deleteOne(filter: Partial<Verification>) {
    return this.verificationRepository.deleteOne(filter);
  }

  //создаем код для верификации email
  async createVerification(input: CreateVerificationInput) {
    const existingVerification = await this.verificationRepository.findOne({
      telegramId: input.telegramId,
    });

    if (existingVerification) {
      //пользователь исчерпал попытки
      if (existingVerification.attempts >= MAX_ATTEMPTS) {
        //подумать над выводом времени
        throw new ForbiddenException(
          VerificationMessages.VERIFICATION_MAX_ATTEMPTS,
        );
      }

      throw new BadRequestException(
        VerificationMessages.VERIFICATION_ALREADY_EXISTS,
      );
    }

    const code = this.cryptoService.generateCode();

    await this.create({
      code,
      telegramId: input.telegramId,
      email: input.email,
      adminId: input.adminId,
      role: input.role,
      gender: input.gender,
      attempts: 0,
      createdAt: new Date(),
    });

    return code;
  }

  //проверяем код
  async verifyCode(input: VerifyCodeInput) {
    const verification = await this.findOne({
      telegramId: input.telegramId,
    });

    //нет активного кода
    if (!verification) {
      throw new BadRequestException(
        VerificationMessages.VERIFICATION_NOT_FOUND,
      );
    }

    //три попытки исчерпаны
    if (verification.attempts >= MAX_ATTEMPTS) {
      throw new BadRequestException(
        VerificationMessages.VERIFICATION_MAX_ATTEMPTS,
      );
    }

    //сравниваем коды
    const isValid = this.cryptoService.compareCodes(
      input.code,
      verification.code,
    );

    if (!isValid) {
      const updated = await this.verificationRepository.updateOne(
        { telegramId: input.telegramId },
        { $inc: { attempts: 1 } },
        { new: true },
      );
      const attemptsLeft = MAX_ATTEMPTS - (updated?.attempts ?? MAX_ATTEMPTS);

      //если это была последняя попытка
      if (attemptsLeft <= 0) {
        throw new ForbiddenException(
          VerificationMessages.VERIFICATION_MAX_ATTEMPTS,
        );
      }

      return {
        success: false,
        attemptsLeft: Math.max(0, attemptsLeft),
      };
    }

    //код верный и удаляем запись
    await this.verificationRepository.deleteOne({
      telegramId: input.telegramId,
    });

    return {
      success: true,
      verification,
    };
  }
}
