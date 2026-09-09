import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
} from "@nestjs/common";
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
} from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentUser } from "../auth/auth.guard";
import type { JwtPayload } from "../auth/auth.service";

type AffiliateContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

class GenerateContentDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  topicId?: string;

  @IsString()
  @IsNotEmpty()
  product: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  category?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  context?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  affiliateLink?: string;
}

class UpdateContentDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  product?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  context?: string;

  @IsOptional()
  @IsString()
  affiliateLink?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  content?: string;

  @IsOptional()
  @IsIn(["DRAFT", "PUBLISHED", "ARCHIVED"])
  status?: AffiliateContentStatus;
}

const VARIABLE_MAP: Record<string, keyof GenerateContentDto> = {
  product: "product",
  category: "category",
  context: "context",
  affiliate_link: "affiliateLink",
};

function renderTemplate(
  content: string,
  input: GenerateContentDto,
): string {
  return content.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    const field = VARIABLE_MAP[key];
    const value = field ? input[field] : undefined;
    return value && value.trim() ? value : match;
  });
}

@Controller("affiliate")
export class AffiliateController {
  constructor(private readonly prisma: PrismaService) {}

  @Post("generate")
  @HttpCode(HttpStatus.CREATED)
  async generate(@Body() dto: GenerateContentDto, @CurrentUser() user: JwtPayload) {
    const template = await this.prisma.template.findUnique({
      where: { id: dto.templateId },
    });
    if (!template) {
      throw new NotFoundException("Template not found");
    }

    if (dto.topicId) {
      const topic = await this.prisma.topic.findUnique({
        where: { id: dto.topicId },
      });
      if (!topic) {
        throw new NotFoundException("Topic not found");
      }
    }

    return this.prisma.affiliateContent.create({
      data: {
        product: dto.product,
        category: dto.category,
        context: dto.context,
        affiliateLink: dto.affiliateLink,
        content: renderTemplate(template.content, dto),
        status: "DRAFT",
        templateId: dto.templateId,
        topicId: dto.topicId,
        userId: user.sub,
      },
      include: { template: true },
    });
  }

  @Get()
  async list() {
    return this.prisma.affiliateContent.findMany({
      orderBy: { createdAt: "desc" },
      include: { template: { select: { id: true, name: true } } },
    });
  }

  @Get(":id")
  async get(@Param("id") id: string) {
    const content = await this.prisma.affiliateContent.findUnique({
      where: { id },
      include: { template: true, topic: true },
    });
    if (!content) {
      throw new NotFoundException("Affiliate content not found");
    }
    return content;
  }

  @Put(":id")
  async update(@Param("id") id: string, @Body() dto: UpdateContentDto) {
    const existing = await this.prisma.affiliateContent.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException("Affiliate content not found");
    }

    return this.prisma.affiliateContent.update({
      where: { id },
      data: {
        ...(dto.product !== undefined && { product: dto.product }),
        ...(dto.category !== undefined && {
          category: dto.category || null,
        }),
        ...(dto.context !== undefined && { context: dto.context || null }),
        ...(dto.affiliateLink !== undefined && {
          affiliateLink: dto.affiliateLink || null,
        }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: { template: { select: { id: true, name: true } } },
    });
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string) {
    const existing = await this.prisma.affiliateContent.findUnique({
      where: { id },
    });
    if (!existing) {
      throw new NotFoundException("Affiliate content not found");
    }
    await this.prisma.affiliateContent.delete({ where: { id } });
  }
}
