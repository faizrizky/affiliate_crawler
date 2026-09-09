import { Controller, Get } from "@nestjs/common";
import { Public } from "../auth/auth.guard";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../jobs/redis.service";

@Controller("health")
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Public()
  @Get()
  async check() {
    const [db, redis] = await Promise.all([
      this.prisma
        .$queryRaw`SELECT 1`
        .then(() => true)
        .catch(() => false),
      this.redis.client
        .ping()
        .then(() => true)
        .catch(() => false),
    ]);
    return {
      status: db && redis ? "ok" : "degraded",
      db,
      redis,
      timestamp: new Date().toISOString(),
    };
  }
}
