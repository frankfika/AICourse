"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var NotificationService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const common_1 = require("@nestjs/common");
const config_1 = require("@nestjs/config");
let NotificationService = NotificationService_1 = class NotificationService {
    constructor(config) {
        this.config = config;
        this.logger = new common_1.Logger(NotificationService_1.name);
    }
    get provider() {
        return this.config.get('EMAIL_PROVIDER') ?? 'console';
    }
    async sendEnterpriseInquiryNotification(data) {
        const subject = `【企业咨询】${data.company} - ${data.topic}`;
        const body = this.buildEnterpriseInquiryEmail(data);
        await this.send({
            to: this.config.get('ENTERPRISE_NOTIFY_EMAIL') ?? 'contact@opencsg.com',
            subject,
            body,
        });
        this.logger.log(`[Email Notification]\n  To: contact@opencsg.com\n  Subject: ${subject}\n  Body:\n${body}`);
    }
    buildEnterpriseInquiryEmail(data) {
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
    async send(opts) {
        switch (this.provider) {
            case 'sendgrid':
                await this.sendViaSendGrid(opts);
                break;
            case 'ses':
                await this.sendViaSes(opts);
                break;
            default:
                break;
        }
    }
    async sendViaSendGrid(opts) {
        const apiKey = this.config.get('SENDGRID_API_KEY');
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
                from: { email: this.config.get('EMAIL_FROM') ?? 'noreply@opencsg.com' },
                subject: opts.subject,
                content: [{ type: 'text/plain', value: opts.body }],
            }),
        });
        if (!res.ok) {
            this.logger.error(`SendGrid error: ${res.status} ${await res.text()}`);
        }
    }
    async sendViaSes(_opts) {
        this.logger.warn('SES provider not yet implemented');
    }
};
exports.NotificationService = NotificationService;
exports.NotificationService = NotificationService = NotificationService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_1.ConfigService])
], NotificationService);
//# sourceMappingURL=notification.service.js.map