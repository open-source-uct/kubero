import { MailService } from './mail.service';

const sendMailMock = jest.fn().mockResolvedValue(undefined);

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: sendMailMock })),
}));

describe('MailService', () => {
  const ORIGINAL_ENV = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...ORIGINAL_ENV };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  it('does not send anything when SMTP is not configured', async () => {
    delete process.env.SMTP_HOST;
    delete process.env.SMTP_USER;
    delete process.env.SMTP_PASSWORD;
    const service = new MailService();
    await service.sendPasswordChangedEmail('user@example.com', 'ana');
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('does not send anything when the user has no email', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'kubero@example.com';
    process.env.SMTP_PASSWORD = 'secret';
    const service = new MailService();
    await service.sendPasswordChangedEmail(undefined, 'ana');
    expect(sendMailMock).not.toHaveBeenCalled();
  });

  it('sends the password-changed email when SMTP is configured', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'kubero@example.com';
    process.env.SMTP_PASSWORD = 'secret';
    process.env.SMTP_FROM = 'kubero@example.com';
    const service = new MailService();
    await service.sendPasswordChangedEmail('user@example.com', 'ana');

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'kubero@example.com',
        to: 'user@example.com',
        subject: expect.any(String),
        text: expect.stringContaining('ana'),
        html: expect.stringContaining('ana'),
      }),
    );
  });

  it('does not throw if sending fails (best effort)', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'kubero@example.com';
    process.env.SMTP_PASSWORD = 'secret';
    sendMailMock.mockRejectedValueOnce(new Error('smtp down'));
    const service = new MailService();
    await expect(
      service.sendPasswordChangedEmail('user@example.com', 'ana'),
    ).resolves.toBeUndefined();
  });

  it('sends the password-reset email with the link when SMTP is configured', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'kubero@example.com';
    process.env.SMTP_PASSWORD = 'secret';
    process.env.SMTP_FROM = 'kubero@example.com';
    const service = new MailService();
    await service.sendPasswordResetEmail(
      'user@example.com',
      'ana',
      'https://kubero.example.com/reset-password?token=abc123',
    );

    expect(sendMailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        from: 'kubero@example.com',
        to: 'user@example.com',
        subject: expect.any(String),
        text: expect.stringContaining(
          'https://kubero.example.com/reset-password?token=abc123',
        ),
        html: expect.stringContaining(
          'https://kubero.example.com/reset-password?token=abc123',
        ),
      }),
    );
  });

  it('does not throw if sending the reset email fails (best effort)', async () => {
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_USER = 'kubero@example.com';
    process.env.SMTP_PASSWORD = 'secret';
    sendMailMock.mockRejectedValueOnce(new Error('smtp down'));
    const service = new MailService();
    await expect(
      service.sendPasswordResetEmail(
        'user@example.com',
        'ana',
        'https://kubero.example.com/reset-password?token=abc123',
      ),
    ).resolves.toBeUndefined();
  });
});
