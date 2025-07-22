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
  messageStream?: string;
}

export class PostmarkService {
  private serverToken: string;
  private baseUrl = 'https://api.postmarkapp.com';

  constructor(serverToken: string) {
    this.serverToken = serverToken;
  }

  async sendEmail(options: EmailOptions): Promise<any> {
    const response = await fetch(`${this.baseUrl}/email`, {
      method: 'POST',
      headers: {
        'X-Postmark-Server-Token': this.serverToken,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        From: options.from,
        To: options.to,
        Subject: options.subject,
        HtmlBody: options.htmlBody,
        TextBody: options.textBody,
        Attachments: options.attachments,
        MessageStream: options.messageStream || 'outbound',
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Postmark error: ${error.Message || error.ErrorCode}`);
    }

    return await response.json();
  }

  async sendTestEmail(from: string, to: string): Promise<any> {
    return this.sendEmail({
      from,
      to,
      subject: 'Тестовое письмо от SCAC',
      textBody: 'Это тестовое письмо для проверки настроек Postmark.',
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Тестовое письмо от SCAC</h2>
          <p>Это тестовое письмо для проверки настроек Postmark.</p>
          <p>Если вы получили это письмо, значит интеграция работает корректно.</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Отправлено из системы SCAC
          </p>
        </div>
      `,
    });
  }

  async sendInvoiceEmail(options: {
    from: string;
    to: string;
    invoiceNumber: string;
    clientName: string;
    amount: string;
    pdfBase64?: string;
    messageStream?: string;
  }): Promise<any> {
    const attachments = options.pdfBase64 ? [{
      name: `invoice_${options.invoiceNumber}.pdf`,
      content: options.pdfBase64,
      contentType: 'application/pdf',
    }] : undefined;

    return this.sendEmail({
      from: options.from,
      to: options.to,
      subject: `Счет №${options.invoiceNumber} от SCAC`,
      htmlBody: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2>Счет на оплату</h2>
          <p>Уважаемый(ая) ${options.clientName},</p>
          <p>Высылаем вам счет №${options.invoiceNumber} на сумму ${options.amount}.</p>
          <p>Счет находится во вложении к этому письму.</p>
          <p>Пожалуйста, произведите оплату в соответствии с условиями договора.</p>
          <br>
          <p>С уважением,<br>
          Команда SCAC</p>
          <hr>
          <p style="color: #666; font-size: 12px;">
            Это письмо отправлено автоматически. Пожалуйста, не отвечайте на него.
          </p>
        </div>
      `,
      textBody: `
Счет на оплату

Уважаемый(ая) ${options.clientName},

Высылаем вам счет №${options.invoiceNumber} на сумму ${options.amount}.

Счет находится во вложении к этому письму.

Пожалуйста, произведите оплату в соответствии с условиями договора.

С уважением,
Команда SCAC
      `,
      attachments,
      messageStream: options.messageStream,
    });
  }
}