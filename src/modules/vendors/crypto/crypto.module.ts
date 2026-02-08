import { Module } from '@nestjs/common';
import { CryptoService } from './crypto.service';

@Module({
  imports: [],
  providers: [CryptoService],
  exports: [CryptoService],
})
export class CryptoModule {}
