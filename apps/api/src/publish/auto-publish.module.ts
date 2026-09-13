import { Module } from "@nestjs/common";
import { AutoPublishController } from "./auto-publish.controller";
import { AutoPublishService } from "./auto-publish.service";

@Module({
  controllers: [AutoPublishController],
  providers: [AutoPublishService],
})
export class AutoPublishModule {}
