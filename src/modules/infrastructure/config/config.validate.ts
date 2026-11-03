import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ConfigMessages } from './constants/config.messages';
import { AppEnvs } from './config.env';

export function validateEnv(config: Record<string, unknown>): AppEnvs {
  const env = plainToInstance(AppEnvs, config, { exposeDefaultValues: true });
  const errors = validateSync(env, { whitelist: true });

  if (errors.length > 0) {
    const messages = errors.flatMap((error) =>
      Object.values(error.constraints ?? {}),
    );
    throw new Error(
      `${ConfigMessages.ENV_VALIDATION_FAILED}:\n${messages.join('\n')}`,
    );
  }

  return env;
}
