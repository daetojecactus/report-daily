import { Injectable } from '@nestjs/common';
import { randomInt, timingSafeEqual, createHmac } from 'crypto';
import { CryptoCode } from './constants/crypto.code';

@Injectable()
export class CryptoService {
  generateCode(): string {
    return randomInt(CryptoCode.CODE_MIN, CryptoCode.CODE_MAX + 1).toString();
  }

  compareCodes(providedCode: string, storedCode: string): boolean {
    if (!providedCode || !storedCode) return false;

    //превращаем строки в Buffer
    //используем HMAC или SHA256, чтобы привести обе строки к фиксированной длине.
    //это полностью устраняет утечку информации о длине строки
    const hashA = createHmac('sha256', process.env.OTP_SALT || 'default-salt')
      .update(providedCode)
      .digest();

    const hashB = createHmac('sha256', process.env.OTP_SALT || 'default-salt')
      .update(storedCode)
      .digest();

    //сравнение
    return timingSafeEqual(hashA, hashB);
  }
}
