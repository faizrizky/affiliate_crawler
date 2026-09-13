import { Controller, HttpCode, HttpStatus, Post } from "@nestjs/common";
import { AutoPublishService } from "./auto-publish.service";

@Controller("publish")
export class AutoPublishController {
  constructor(private readonly autoPublish: AutoPublishService) {}

  /** Pemicu manual satu siklus — dipakai untuk uji tanpa menunggu interval. */
  @Post("check")
  @HttpCode(HttpStatus.OK)
  check() {
    return this.autoPublish.checkAndPublishDrafts();
  }
}
