import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from "@nestjs/common";
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";
import { CurrentUser } from "../auth/auth.guard";
import type { JwtPayload } from "../auth/auth.service";
import { LinksService } from "./links.service";

const URL_RULES = { require_protocol: true, protocols: ["http", "https"] };

class LinkCreateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsUrl(URL_RULES, { message: "url must be a valid http(s) URL" })
  @MaxLength(2048)
  url: string;
}

class LinkUpdateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsUrl(URL_RULES, { message: "url must be a valid http(s) URL" })
  @MaxLength(2048)
  url?: string;
}

function toPositiveInt(value: string | undefined, fallback: number, max: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

// Path "affiliate/links" harus terdaftar sebelum AffiliateController, yang punya
// route GET /affiliate/:id — kalau urutannya terbalik, ":id" menelan "links".
// Dijaga oleh LinksModule yang diimpor lebih dulu di AppModule.
@Controller("affiliate/links")
export class LinksController {
  constructor(private readonly links: LinksService) {}

  @Get()
  list(@Query("page") page?: string, @Query("pageSize") pageSize?: string) {
    return this.links.list(
      toPositiveInt(page, 1, 10_000),
      toPositiveInt(pageSize, 50, 200),
    );
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.links.get(id);
  }

  @Post()
  create(@Body() dto: LinkCreateDto, @CurrentUser() user: JwtPayload) {
    return this.links.create(dto.name.trim(), dto.url.trim(), user.sub);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: LinkUpdateDto) {
    return this.links.update(id, {
      ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
      ...(dto.url !== undefined ? { url: dto.url.trim() } : {}),
    });
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string) {
    return this.links.remove(id);
  }
}
