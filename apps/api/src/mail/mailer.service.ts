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
    const port = Number(config.get("SMTP_PORT") ?? 587);
    // SMTP_SECURE eksplisit menang; kalau tidak diisi, TLS langsung hanya
    // untuk port 465 (587 memakai STARTTLS).
    const secureRaw = config.get<string>("SMTP_SECURE");
    const secure = secureRaw === undefined || secureRaw === "" ? port === 465 : secureRaw === "true";
    this.transporter = host
      ? createTransport({
          host,
          port,
          secure,
          auth: config.get("SMTP_USER")
            ? { user: config.get("SMTP_USER"), pass: config.get("SMTP_PASS") }
            : undefined,
        })
      : null;
    if (!this.transporter) {
      this.logger.warn("SMTP_HOST kosong — email dicetak ke log, tidak dikirim");
    }
  }

  /** Cek koneksi + login SMTP tanpa mengirim email. */
  async verify(): Promise<boolean> {
    if (!this.transporter) return false;
    await this.transporter.verify();
    return true;
  }

  async send(to: string, subject: string, text: string): Promise<void> {
    if (!this.transporter) {
      this.logger.log(`[email:dev] to=${to} subject="${subject}"\n${text}`);
      return;
    }
    await this.transporter.sendMail({ from: this.from, to, subject, text });
  }
}
