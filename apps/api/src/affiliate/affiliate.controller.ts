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
} from "@nestjs/common";
import { IsNotEmpty, IsOptional, IsString } from "class-validator";
import { PrismaService } from "../prisma/prisma.service";

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
  async generate(@Body() dto: GenerateContentDto) {
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
