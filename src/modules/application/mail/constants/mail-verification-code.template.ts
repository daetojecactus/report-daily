export const emailVerificationTemplate = (code: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">🔐 Код подтверждения</h2>
        <p>Ваш код подтверждения:</p>
        <div style="background: #f0f0f0; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #333;">
            ${code}
          </span>
        </div>
        <p style="color: #666; font-size: 14px;">
          Код действителен в течение 15 минут.
        </p>
        <p style="color: #999; font-size: 12px; margin-top: 20px;">
          Если вы не запрашивали этот код, проигнорируйте это письмо.
        </p>
      </div>
    `;
