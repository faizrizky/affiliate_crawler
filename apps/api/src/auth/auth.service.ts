import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { User } from "../generated/prisma/client";
import { Prisma } from "../generated/prisma/client";
import { MailerService } from "../mail/mailer.service";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword, verifyPassword } from "./password";
import { issueToken, readToken, secretFor, type TokenType } from "./tokens";

export type JwtPayload = { sub: string; email: string; username: string };

export type UserDto = {
  id: string;
  username: string;
  email: string;
  name: string | null;
  threadsUsername: string | null;
  createdAt: Date;
};

export type AuthSession = {
  user: UserDto;
  tokens: { accessToken: string; refreshToken: string };
};

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@/, "").toLowerCase();
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function toUserDto(user: User): UserDto {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    name: user.name,
    threadsUsername: user.threadsUsername,
    createdAt: user.createdAt,
  };
}

/** Token terbit sebelum password terakhir diganti = sudah dicabut. */
export function issuedBeforePasswordChange(iat: number, user: User): boolean {
  if (!user.passwordChangedAt) return false;
  return iat < Math.floor(user.passwordChangedAt.getTime() / 1000);
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly mailer: MailerService,
  ) {}

  private secret(typ: TokenType): string {
    return secretFor(typ, this.config.get<string>("JWT_SECRET") ?? "", {
      refresh: this.config.get<string>("JWT_REFRESH_SECRET"),
      reset: this.config.get<string>("JWT_RESET_SECRET"),
    });
  }

  issueSession(user: User): AuthSession {
    const claims = { sub: user.id, username: user.username, email: user.email };
    return {
      user: toUserDto(user),
      tokens: {
        accessToken: issueToken(claims, "access", this.secret("access")),
        refreshToken: issueToken(claims, "refresh", this.secret("refresh")),
      },
    };
  }

  async register(input: {
    username: string;
    email: string;
    password: string;
    threadsUsername?: string;
  }): Promise<AuthSession> {
    const username = normalizeUsername(input.username);
    const email = normalizeEmail(input.email);

    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ username }, { email }] },
      select: { username: true, email: true },
    });
    if (existing) {
      throw new ConflictException(
        existing.username === username
          ? "Username sudah dipakai"
          : "Email sudah terdaftar",
      );
    }

    try {
      const user = await this.prisma.user.create({
        data: {
          username,
          email,
          passwordHash: hashPassword(input.password),
          threadsUsername: input.threadsUsername
            ? normalizeUsername(input.threadsUsername)
            : null,
        },
      });
      return this.issueSession(user);
    } catch (err) {
      // Dua pendaftaran bersamaan bisa lolos cek di atas; unique index yang jadi hakim.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        throw new ConflictException("Username atau email sudah terdaftar");
      }
      throw err;
    }
  }

  async login(identifier: string, password: string): Promise<AuthSession> {
    const value = identifier.trim().toLowerCase();
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ username: normalizeUsername(value) }, { email: value }] },
    });
    // Pesan sama untuk "user tidak ada" dan "password salah" supaya endpoint ini
    // tidak bisa dipakai menebak username/email mana yang terdaftar.
    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException("Username/email atau password salah");
    }
    return this.issueSession(user);
  }

  async refresh(refreshToken: string): Promise<AuthSession["tokens"]> {
    let claims;
    try {
      claims = readToken(refreshToken, "refresh", this.secret("refresh"));
    } catch {
      throw new UnauthorizedException("Refresh token tidak valid");
    }
    const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user || issuedBeforePasswordChange(claims.iat, user)) {
      throw new UnauthorizedException("Sesi sudah berakhir, silakan login ulang");
    }
    // Rotasi: refresh token lama tetap berlaku sampai kedaluwarsa, tapi klien
    // selalu memakai yang terbaru.
    return this.issueSession(user).tokens;
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email: normalizeEmail(email) },
    });
    if (!user) return; // jangan bocorkan email mana yang terdaftar

    const token = issueToken(
      { sub: user.id, username: user.username, email: user.email },
      "reset",
      this.secret("reset"),
    );
    const appUrl = (this.config.get<string>("APP_URL") ?? "http://localhost:3000").replace(/\/$/, "");
    const link = `${appUrl}/reset-password?token=${encodeURIComponent(token)}`;

    try {
      await this.mailer.send(
        user.email,
        "Reset password Threads Research",
        [
          `Halo ${user.username},`,
          "",
          "Klik link di bawah untuk membuat password baru. Link berlaku 30 menit",
          "dan hanya bisa dipakai sekali.",
          "",
          link,
          "",
          "Kalau kamu tidak meminta reset password, abaikan email ini.",
        ].join("\n"),
      );
    } catch (err) {
      // Gagal kirim tidak boleh mengubah respons (anti-enumerasi) — cukup dicatat.
      this.logger.error(`gagal kirim email reset: ${err instanceof Error ? err.message : err}`);
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    let claims;
    try {
      claims = readToken(token, "reset", this.secret("reset"));
    } catch {
      throw new BadRequestException("Link reset tidak valid atau sudah kedaluwarsa");
    }
    const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user || issuedBeforePasswordChange(claims.iat, user)) {
      throw new BadRequestException("Link reset sudah dipakai atau kedaluwarsa");
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hashPassword(newPassword), passwordChangedAt: new Date() },
    });
  }

  verifyToken(token: string): JwtPayload {
    try {
      const claims = readToken(token, "access", this.secret("access"));
      return { sub: claims.sub, email: claims.email, username: claims.username };
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
