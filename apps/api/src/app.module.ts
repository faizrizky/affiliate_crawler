import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { JobsModule } from "./jobs/jobs.module";
import { HealthModule } from "./health/health.module";
import { TopicsModule } from "./topics/topics.module";
import { CrawlModule } from "./crawl/crawl.module";
import { TemplatesModule } from "./templates/templates.module";
import { LinksModule } from "./links/links.module";
import { CategoriesModule } from "./categories/categories.module";
import { AffiliateModule } from "./affiliate/affiliate.module";
import { AuthModule } from "./auth/auth.module";
import { AutoPublishModule } from "./publish/auto-publish.module";
import { MailModule } from "./mail/mail.module";
import { UserModule } from "./user/user.module";

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, validate: validateEnv }),
    PrismaModule,
    JobsModule,
    HealthModule,
    TopicsModule,
    CrawlModule,
    TemplatesModule,
    // LinksModule sebelum AffiliateModule: route GET /affiliate/links harus
    // terdaftar lebih dulu daripada GET /affiliate/:id.
    LinksModule,
    CategoriesModule,
    AffiliateModule,
    AutoPublishModule,
    MailModule,
    AuthModule,
    UserModule,
  ],
})
export class AppModule {}
