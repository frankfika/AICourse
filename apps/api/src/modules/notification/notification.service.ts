import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * 通知服务
 *
 * 支持多种 Provider，按优先级尝试发送：
 * 1. console（默认，开发环境打印日志）
 * 2. sendgrid（需配置 SENDGRID_API_KEY）
 * 3. ses（AWS SES，TODO）
 *
 * 生产接入时替换为真实 provider 即可。
 */
@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(private readonly config: ConfigService) {}

  private get provider(): string {
    return this.config.get<string>('EMAIL_PROVIDER') ?? 'console';
  }

  async sendEnterpriseInquiryNotification(data: {
    name: string;
    email: string;
    company: string;
    teamSize: string;
    phone?: string;
    topic: string;
    description?: string;
  }) {
    const subject = `【企业咨询】${data.company} - ${data.topic}`;
    const body = this.buildEnterpriseInquiryEmail(data);

    await this.send({
      to: this.config.get<string>('ENTERPRISE_NOTIFY_EMAIL') ?? 'contact@opencsg.com',
      subject,
      body,
    });

    // 同时打印到控制台，方便开发调试
    this.logger.log(`[Email Notification]\n  To: contact@opencsg.com\n  Subject: ${subject}\n  Body:\n${body}`);
  }

  private buildEnterpriseInquiryEmail(data: {
    name: string;
    email: string;
    company: string;
    teamSize: string;
    phone?: string;
    topic: string;
    description?: string;
  }): string {
    return [
      `【企业咨询报名】`,
      ``,
      `姓名：${data.name}`,
      `邮箱：${data.email}`,
      `公司：${data.company}`,
      `团队规模：${data.teamSize} 人`,
      data.phone ? `电话：${data.phone}` : '',
      ``,
      `培训主题：${data.topic}`,
      data.description ? `\n详细描述：\n${data.description}` : '',
      ``,
      `提交时间：${new Date().toLocaleString('zh-CN')}`,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private async send(opts: { to: string; subject: string; body: string }) {
    switch (this.provider) {
      case 'sendgrid':
        await this.sendViaSendGrid(opts);
        break;
      case 'ses':
        await this.sendViaSes(opts);
        break;
      default:
        // console: already logged above
        break;
    }
  }

  private async sendViaSendGrid(opts: { to: string; subject: string; body: string }) {
    const apiKey = this.config.get<string>('SENDGRID_API_KEY');
    if (!apiKey) {
      this.logger.warn('SENDGRID_API_KEY not configured, skipping email');
      return;
    }

    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: opts.to }] }],
        from: { email: this.config.get<string>('EMAIL_FROM') ?? 'noreply@opencsg.com' },
        subject: opts.subject,
        content: [{ type: 'text/plain', value: opts.body }],
      }),
    });

    if (!res.ok) {
      this.logger.error(`SendGrid error: ${res.status} ${await res.text()}`);
    }
  }

  private async sendViaSes(_opts: { to: string; subject: string; body: string }) {
    // TODO: implement AWS SES
    this.logger.warn('SES provider not yet implemented');
  }
}
