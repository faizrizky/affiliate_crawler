import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
} from "@nestjs/common";
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from "class-validator";
import { CurrentUser } from "../auth/auth.guard";
import type { JwtPayload } from "../auth/auth.service";
import { TemplatesService } from "./templates.service";

class TemplateCreateDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name: string;

  @IsString()
  @IsNotEmpty()
  content: string;

  // Urutan menentukan nomor placeholder: linkIds[0] -> {{affiliate_link_1}}.
  @IsArray()
  @ArrayNotEmpty({ message: "pilih minimal satu link" })
  @ArrayMaxSize(20)
  @IsString({ each: true })
  linkIds: string[];

  @IsOptional()
  @IsString()
  categoryId?: string | null;
}

class TemplateUpdateDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty({ message: "pilih minimal satu link" })
  @ArrayMaxSize(20)
  @IsString({ each: true })
  linkIds?: string[];

  // null / string kosong = lepas kategori.
  @IsOptional()
  @IsString()
  categoryId?: string | null;
}

function extractVariables(content: string): string[] {
  return [...new Set([...content.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
}

@Controller("templates")
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.templates.list(user.sub);
  }

  @Get(":id")
  get(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.templates.get(id, user.sub);
  }

  @Post()
  create(@Body() dto: TemplateCreateDto, @CurrentUser() user: JwtPayload) {
    const variables = extractVariables(dto.content);
    return this.templates.create(
      dto.name,
      dto.content,
      variables,
      dto.linkIds,
      user.sub,
      dto.categoryId || null,
    );
  }

  @Patch(":id")
  update(
    @Param("id") id: string,
    @Body() dto: TemplateUpdateDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const variables =
      dto.content !== undefined ? extractVariables(dto.content) : undefined;
    return this.templates.update(id, user.sub, dto, variables);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.templates.remove(id, user.sub);
  }
}
