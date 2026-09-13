import {
  Body,
  Controller,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import { IsInt, Max, Min } from "class-validator";
import { CurrentUser } from "../auth/auth.guard";
import type { JwtPayload } from "../auth/auth.service";
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
  getJob(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.crawl.getJob(id, user.sub);
  }

  @Post(":id/progress")
  updateProgress(
    @Param("id") id: string,
    @Body() dto: ProgressDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.crawl.updateProgress(id, dto.progress, dto.total ?? 0, user.sub);
  }
}
