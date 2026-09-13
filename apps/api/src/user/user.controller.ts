import { Body, Controller, Get, Patch } from "@nestjs/common";
import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from "class-validator";
import { USERNAME_MESSAGE, USERNAME_RULE } from "../auth/auth.controller";
import { CurrentUser } from "../auth/auth.guard";
import type { JwtPayload } from "../auth/auth.service";
import { UserService } from "./user.service";

class UpdateProfileDto {
  @IsOptional()
  @Matches(USERNAME_RULE, { message: USERNAME_MESSAGE })
  username?: string;

  @IsOptional()
  @IsEmail({}, { message: "email tidak valid" })
  email?: string;

  // String kosong / null = hapus threadsUsername.
  @IsOptional()
  @ValidateIf((dto: UpdateProfileDto) => Boolean(dto.threadsUsername))
  @Matches(USERNAME_RULE, { message: "threadsUsername tidak valid" })
  threadsUsername?: string | null;
}

class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8, { message: "password minimal 8 karakter" })
  @MaxLength(128)
  newPassword: string;
}

@Controller("user")
export class UserController {
  constructor(private readonly users: UserService) {}

  @Get("profile")
  profile(@CurrentUser() user: JwtPayload) {
    return this.users.getProfile(user.sub);
  }

  @Patch("profile")
  updateProfile(@CurrentUser() user: JwtPayload, @Body() dto: UpdateProfileDto) {
    return this.users.updateProfile(user.sub, dto);
  }

  @Patch("password")
  changePassword(@CurrentUser() user: JwtPayload, @Body() dto: ChangePasswordDto) {
    return this.users.changePassword(user.sub, dto.currentPassword, dto.newPassword);
  }
}
