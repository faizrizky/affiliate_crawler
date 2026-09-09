import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Redis } from "ioredis";

@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService) {
    this.client = new Redis(config.get("REDIS_URL") as string, {
      maxRetriesPerRequest: null,
    });
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
