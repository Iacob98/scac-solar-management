import nodemailer from 'nodemailer';

interface EmailOptions {
  from: string;
  to: string;
  subject: string;
  htmlBody?: string;
  textBody?: string;
  attachments?: Array<{
    name: string;
    content: string; // base64 encoded
    contentType: string;
  }>;
}

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  password: string;
  secure: boolean;
}

export class SmtpService {
  private transporter: nodemailer.Transporter;

  constructor(config: SmtpConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.host,
      port: config.port,
      secure: config.secure,
      auth: {
        user: config.user,
        pass: config.password,
      },
    });
  }

  async sendEmail(options: EmailOptions): Promise<any> {
    const mailOptions: nodemailer.SendMailOptions = {
      from: options.from,
      to: options.to,
      subject: options.subject,
      html: options.htmlBody,
      text: options.textBody,
    };

    if (options.attachments && options.attachments.length > 0) {
      mailOptions.attachments = options.attachments.map(att => ({
        filename: att.name,
        content: Buffer.from(att.content, 'base64'),
        contentType: att.contentType,
      }));
    }

    return await this.transporter.sendMail(mailOptions);
  }

  async sendTestEmail(from: string, to: string): Promise<any> {
    return this.sendEmail({
      from,
      to,
      subject: 'Тестовое письмо от SCAC',
      textBody: 'Это тестовое письмо для проверки настроек SMTP.',
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Тестовое письмо от SCAC</h2>
          <p>Это тестовое письмо для проверки настроек SMTP.</p>
          <p>Если вы получили это письмо, значит интеграция работает корректно.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Отправлено из системы SCAC
          </p>
        </div>
      `,
    });
  }
}
