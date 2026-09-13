import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createTransport, type Transporter } from "nodemailer";

/**
 * Kirim email transaksional (reset password). Selama SMTP belum dikonfigurasi,
 * isi email dicetak ke log API supaya alur reset tetap bisa diuji di dev —
 * tidak pernah gagal diam-diam dan tidak pernah membocorkan token ke respons HTTP.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);
  private readonly transporter: Transporter | null;
  private readonly from: string;

  constructor(config: ConfigService) {
    const host = config.get<string>("SMTP_HOST");
    this.from = config.get<string>("EMAIL_FROM") ?? "Threads Research <no-reply@localhost>";
    this.transporter = host
      ? createTransport({
          host,
          port: Number(config.get("SMTP_PORT") ?? 587),
          secure: Number(config.get("SMTP_PORT") ?? 587) === 465,
          auth: config.get("SMTP_USER")
            ? { user: config.get("SMTP_USER"), pass: config.get("SMTP_PASS") }
            : undefined,
        })
      : null;
    if (!this.transporter) {
      this.logger.warn("SMTP_HOST kosong — email dicetak ke log, tidak dikirim");
    }
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[email:dev] to=${to} subject="${subject}"\n${text}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text });
  }
}
