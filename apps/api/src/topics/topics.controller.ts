import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
} from "@nestjs/common";
import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";
import { CurrentUser } from "../auth/auth.guard";
import type { JwtPayload } from "../auth/auth.service";
import { TopicsService } from "./topics.service";

class SearchDto {
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  keyword: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number;
}

class PostsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  pageSize?: number;
}

@Controller("topics")
export class TopicsController {
  constructor(private readonly topics: TopicsService) {}

  @Get()
  list() {
    return this.topics.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.topics.get(id);
  }

  @Get(":id/posts")
  posts(
    @Param("id") id: string,
    @Query() query: PostsQueryDto,
  ) {
    return this.topics.getPosts(id, query.page ?? 1, query.pageSize ?? 20);
  }

  @Post("search")
  @HttpCode(202)
  search(@Body() dto: SearchDto, @CurrentUser() user: JwtPayload) {
    return this.topics.search(dto.keyword, dto.limit ?? 20, user.sub);
  }

  @Delete(":id")
  @HttpCode(204)
  delete(@Param("id") id: string) {
    return this.topics.delete(id);
  }
}
