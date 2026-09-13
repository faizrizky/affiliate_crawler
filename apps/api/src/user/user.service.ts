import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import {
  AuthService,
  normalizeEmail,
  normalizeUsername,
  toUserDto,
} from "../auth/auth.service";
import { hashPassword, verifyPassword } from "../auth/password";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class UserService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auth: AuthService,
  ) {}

  private async find(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException("User not found");
    return user;
  }

  async getProfile(userId: string) {
    return toUserDto(await this.find(userId));
  }

  async updateProfile(
    userId: string,
    dto: { username?: string; email?: string; threadsUsername?: string | null },
  ) {
    await this.find(userId);
    const data: Prisma.UserUpdateInput = {};
    if (dto.username !== undefined) data.username = normalizeUsername(dto.username);
    if (dto.email !== undefined) data.email = normalizeEmail(dto.email);
    if (dto.threadsUsername !== undefined) {
      data.threadsUsername = dto.threadsUsername ? normalizeUsername(dto.threadsUsername) : null;
    }

    try {
      const user = await this.prisma.user.update({ where: { id: userId }, data });
      // Username/email ada di dalam token; terbitkan sesi baru supaya klaim
      // token yang dipegang klien tidak basi.
      return this.auth.issueSession(user);
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        const target = String((err.meta as { target?: unknown } | undefined)?.target ?? "");
        throw new ConflictException(
          target.includes("username") ? "Username sudah dipakai" : "Email sudah terdaftar",
        );
      }
      throw err;
    }
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.find(userId);
    if (!user.passwordHash || !verifyPassword(currentPassword, user.passwordHash)) {
      throw new UnauthorizedException("Password saat ini salah");
    }
    if (currentPassword === newPassword) {
      throw new BadRequestException("Password baru harus berbeda dari yang lama");
    }
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: hashPassword(newPassword), passwordChangedAt: new Date() },
    });
    // passwordChangedAt mencabut semua refresh token lama (perangkat lain);
    // perangkat yang sedang dipakai langsung dapat sesi baru.
    return this.auth.issueSession(updated);
  }
}
