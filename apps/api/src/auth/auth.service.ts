import { Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sign, verify } from "jsonwebtoken";
import { PrismaService } from "../prisma/prisma.service";
import { verifyPassword } from "./password";

export type JwtPayload = { sub: string; email: string };

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private get secret(): string {
    return this.config.get<string>("JWT_SECRET") ?? "";
  }

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (!user?.passwordHash || !verifyPassword(password, user.passwordHash)) {
      throw new UnauthorizedException("Invalid email or password");
    }
    const token = sign({ sub: user.id, email: user.email }, this.secret, {
      expiresIn: "7d",
    });
    return {
      token,
      user: { id: user.id, email: user.email, name: user.name },
    };
  }

  verifyToken(token: string): JwtPayload {
    try {
      const payload = verify(token, this.secret);
      if (typeof payload === "string" || !payload.sub || !payload.email) {
        throw new Error("invalid payload");
      }
      return { sub: payload.sub, email: payload.email };
    } catch {
      throw new UnauthorizedException("Invalid or expired token");
    }
  }
}
