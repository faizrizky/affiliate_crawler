import { Module } from "@nestjs/common";
import { CrawlModule } from "../crawl/crawl.module";
import { TopicsController } from "./topics.controller";
import { TopicsService } from "./topics.service";

@Module({
  imports: [CrawlModule],
  controllers: [TopicsController],
  providers: [TopicsService],
})
export class TopicsModule {}
