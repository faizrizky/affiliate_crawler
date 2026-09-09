import {
  CanActivate,
  ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
  createParamDecorator,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { AuthService, type JwtPayload } from "./auth.service";

export const IS_PUBLIC = "auth:isPublic";

export const Public = () => SetMetadata(IS_PUBLIC, true);

type AuthRequest = {
  headers: { authorization?: string };
  user?: JwtPayload;
};

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) =>
    ctx.switchToHttp().getRequest<AuthRequest>().user,
);

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ")
      ? header.slice("Bearer ".length)
      : undefined;
    if (!token) {
      throw new UnauthorizedException("Missing authentication token");
    }
    request.user = this.auth.verifyToken(token);
    return true;
  }
}
