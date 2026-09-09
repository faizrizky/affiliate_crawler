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
import { IsNotEmpty, IsOptional, IsString, MaxLength } from "class-validator";
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
}

function extractVariables(content: string): string[] {
  return [...new Set([...content.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]))];
}

@Controller("templates")
export class TemplatesController {
  constructor(private readonly templates: TemplatesService) {}

  @Get()
  list() {
    return this.templates.list();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.templates.get(id);
  }

  @Post()
  create(@Body() dto: TemplateCreateDto, @CurrentUser() user: JwtPayload) {
    const variables = extractVariables(dto.content);
    return this.templates.create(dto.name, dto.content, variables, user.sub);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: TemplateUpdateDto) {
    const variables =
      dto.content !== undefined ? extractVariables(dto.content) : undefined;
    return this.templates.update(id, dto, variables);
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string) {
    return this.templates.remove(id);
  }
}
