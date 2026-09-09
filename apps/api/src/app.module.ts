import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { JobsModule } from "./jobs/jobs.module";
import { HealthModule } from "./health/health.module";
import { TopicsModule } from "./topics/topics.module";
import { CrawlModule } from "./crawl/crawl.module";
import { TemplatesModule } from "./templates/templates.module";
import { AffiliateModule } from "./affiliate/affiliate.module";
import { AuthModule } from "./auth/auth.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    JobsModule,
    HealthModule,
    TopicsModule,
    CrawlModule,
    TemplatesModule,
    AffiliateModule,
    AuthModule,
  ],
})
export class AppModule {}
