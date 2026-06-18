import { beforeAll, describe, expect, it } from 'vitest';

const brightRockAlreadySentOtpText = [
  'Introducing 2-step authentication',
  'One Time Password (OTP)',
  'Please note that your OTP details have been sent to cellphone number *** *** 2479.',
  'OTP:',
  'SUBMIT',
  'Send OTP',
].join(' ');

describe('provider portal OTP handling', () => {
  let chooseSmsOtpDeliveryIfPresent: (
    page: { locator: (selector: string) => { innerText: () => Promise<string> } },
    flow: Record<string, never>,
  ) => Promise<boolean>;
  let looksLikeOtpSentConfirmation: (text: string) => boolean;

  beforeAll(async () => {
    process.env.NW_PORTAL_JOB_ID = process.env.NW_PORTAL_JOB_ID || 'test-job';
    process.env.NW_PORTAL_WORKER_SECRET = process.env.NW_PORTAL_WORKER_SECRET || 'test-secret';

    const otpModule = await import('../../../../scripts/portal-worker/otp.mjs');
    chooseSmsOtpDeliveryIfPresent = otpModule.chooseSmsOtpDeliveryIfPresent;
    looksLikeOtpSentConfirmation = otpModule.looksLikeOtpSentConfirmation;
  });

  it('recognises BrightRock pages where the SMS OTP has already been sent', () => {
    expect(looksLikeOtpSentConfirmation(brightRockAlreadySentOtpText)).toBe(true);
  });

  it('does not try to reselect SMS once BrightRock has already sent the OTP', async () => {
    const page = {
      locator(selector: string) {
        if (selector !== 'body') {
          throw new Error(`Unexpected locator lookup for ${selector}`);
        }
        return {
          innerText: async () => brightRockAlreadySentOtpText,
        };
      },
    };

    await expect(chooseSmsOtpDeliveryIfPresent(page, {})).resolves.toBe(true);
  });
});
