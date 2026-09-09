import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import { IsInt, Max, Min } from "class-validator";
import { CrawlService } from "./crawl.service";

class ProgressDto {
  @IsInt()
  @Min(0)
  @Max(100)
  progress: number;

  @IsInt()
  total?: number;
}

@Controller("crawl/jobs")
export class CrawlController {
  constructor(private readonly crawl: CrawlService) {}

  @Get(":id")
  getJob(@Param("id") id: string) {
    return this.crawl.getJob(id);
  }

  @Post(":id/progress")
  updateProgress(
    @Param("id") id: string,
    @Body() dto: ProgressDto,
  ) {
    return this.crawl.updateProgress(id, dto.progress, dto.total ?? 0);
  }
}
