import { Body, Controller, Get, Post } from "@nestjs/common";
import { IsEmail, IsNotEmpty, IsString } from "class-validator";
import { CurrentUser, Public } from "./auth.guard";
import { AuthService, type JwtPayload } from "./auth.service";

class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post("login")
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get("me")
  me(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
