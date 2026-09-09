import { Module } from "@nestjs/common";
import { CrawlController } from "./crawl.controller";
import { CrawlService } from "./crawl.service";
import { CrawlWorker } from "./crawl.worker";

@Module({
  controllers: [CrawlController],
  providers: [CrawlService, CrawlWorker],
  exports: [CrawlService],
})
export class CrawlModule {}
