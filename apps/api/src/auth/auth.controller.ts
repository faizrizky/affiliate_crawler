import { Controller, Get, NotImplementedException } from "@nestjs/common";

@Controller("auth")
export class AuthController {
  @Get("me")
  me() {
    throw new NotImplementedException("Auth is not available yet");
  }
}
