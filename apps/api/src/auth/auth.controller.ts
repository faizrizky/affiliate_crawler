import { Body, Controller, Get, HttpCode, HttpStatus, NotFoundException, Post } from "@nestjs/common";
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentUser, Public } from "./auth.guard";
import { AuthService, toUserDto, type JwtPayload } from "./auth.service";

export const USERNAME_RULE = /^@?[a-zA-Z0-9._]{3,30}$/;
export const USERNAME_MESSAGE = "username 3-30 karakter: huruf, angka, titik, underscore";

class RegisterDto {
  @Matches(USERNAME_RULE, { message: USERNAME_MESSAGE })
  username: string;

  @IsEmail({}, { message: "email tidak valid" })
  email: string;

  @IsString()
  @MinLength(8, { message: "password minimal 8 karakter" })
  @MaxLength(128)
  password: string;

  @IsOptional()
  @Matches(USERNAME_RULE, { message: "threadsUsername tidak valid" })
  threadsUsername?: string;
}

class LoginDto {
  // `email` tetap diterima supaya klien lama (form login email) tidak rusak.
  @ValidateIf((dto: LoginDto) => !dto.email)
  @IsString()
  @IsNotEmpty({ message: "username atau email wajib diisi" })
  usernameOrEmail?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

class RefreshDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

class ForgotPasswordDto {
  @IsEmail({}, { message: "email tidak valid" })
  email: string;
}

class ResetPasswordDto {
  @IsString()
  @IsNotEmpty()
  token: string;

  @IsString()
  @MinLength(8, { message: "password minimal 8 karakter" })
  @MaxLength(128)
  newPassword: string;
}

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly prisma: PrismaService,
  ) {}

  @Public()
  @Post("register")
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.usernameOrEmail ?? dto.email ?? "", dto.password);
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  refresh(@Body() dto: RefreshDto) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.forgotPassword(dto.email);
    // Respons identik apa pun hasilnya (anti-enumerasi email).
    return { message: "Kalau email terdaftar, link reset sudah dikirim" };
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto.token, dto.newPassword);
    return { message: "Password berhasil diganti" };
  }

  @Get("me")
  async me(@CurrentUser() user: JwtPayload) {
    const record = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!record) throw new NotFoundException("User not found");
    return toUserDto(record);
  }
}
