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
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  ValidateIf,
} from "class-validator";
import { PrismaService } from "../prisma/prisma.service";
import { CurrentUser } from "../auth/auth.guard";
import type { JwtPayload } from "../auth/auth.service";

type AffiliateContentStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

class GenerateContentDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  // Wajib: link produk diambil dari katalog AffiliateLink, bukan teks bebas.
  @IsString()
  @IsNotEmpty()
  linkId: string;

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

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  threadPostId?: string;
}

class GenerateBatchDto {
  @IsString()
  @IsNotEmpty()
  templateId: string;

  @IsString()
  @IsNotEmpty()
  linkId: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  threadPostIds: string[];

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

  // Link balasan di Threads yang di-paste user; string kosong = hapus.
  @IsOptional()
  @ValidateIf((dto: UpdateContentDto) => Boolean(dto.replyLink))
  @Matches(/^https:\/\/(www\.)?threads\.(com|net)\/@[\w.]+\/post\/[\w-]+/i, {
    message: "replyLink harus berupa link post Threads (https://www.threads.com/@user/post/...)",
  })
  replyLink?: string;
}

const VARIABLE_MAP: Record<string, keyof TemplateValues> = {
  product: "product",
  category: "category",
  context: "context",
  affiliate_link: "affiliateLink",
};

type TemplateValues = {
  product: string;
  category?: string;
  context?: string;
  affiliateLink?: string;
};

function renderTemplate(content: string, input: TemplateValues): string {
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
    const template = await this.prisma.template.findFirst({
      where: { id: dto.templateId, userId: user.sub },
    });
    if (!template) {
      throw new NotFoundException("Template not found");
    }
    const link = await this.prisma.affiliateLink.findFirst({
      where: { id: dto.linkId, userId: user.sub },
    });
    if (!link) {
      throw new NotFoundException("Link not found");
    }

    let topicId = dto.topicId;

    if (dto.threadPostId) {
      const post = await this.prisma.threadPost.findFirst({
        where: { id: dto.threadPostId, topic: { userId: user.sub } },
      });
      if (!post) {
        throw new NotFoundException("Thread post not found");
      }
      topicId = post.topicId;
    } else if (topicId) {
      const topic = await this.prisma.topic.findFirst({
        where: { id: topicId, userId: user.sub },
      });
      if (!topic) {
        throw new NotFoundException("Topic not found");
      }
    }

    // affiliateLink tetap disimpan sebagai snapshot URL saat generate: draft
    // harus tetap terbaca walau link-nya kelak dihapus (linkId jadi NULL).
    return this.prisma.affiliateContent.create({
      data: {
        product: dto.product,
        category: dto.category,
        context: dto.context,
        affiliateLink: link.url,
        content: renderTemplate(template.content, { ...dto, affiliateLink: link.url }),
        status: "DRAFT",
        templateId: dto.templateId,
        linkId: link.id,
        topicId,
        threadPostId: dto.threadPostId,
        userId: user.sub,
      },
      include: { template: true, link: true },
    });
  }

  @Post("generate-batch")
  @HttpCode(HttpStatus.CREATED)
  async generateBatch(
    @Body() dto: GenerateBatchDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const template = await this.prisma.template.findFirst({
      where: { id: dto.templateId, userId: user.sub },
    });
    if (!template) {
      throw new NotFoundException("Template not found");
    }
    const link = await this.prisma.affiliateLink.findFirst({
      where: { id: dto.linkId, userId: user.sub },
    });
    if (!link) {
      throw new NotFoundException("Link not found");
    }

    if (dto.topicId) {
      const topic = await this.prisma.topic.findFirst({
        where: { id: dto.topicId, userId: user.sub },
      });
      if (!topic) {
        throw new NotFoundException("Topic not found");
      }
    }

    // Post milik topik user lain masuk skippedIds, sama seperti id yang tidak ada.
    const posts = await this.prisma.threadPost.findMany({
      where: { id: { in: dto.threadPostIds }, topic: { userId: user.sub } },
    });
    const skippedIds = dto.threadPostIds.filter(
      (id) => !posts.some((p) => p.id === id),
    );

    const created = await Promise.all(
      posts.map((post) =>
        this.prisma.affiliateContent.create({
          data: {
            product: dto.product,
            category: dto.category,
            context: dto.context,
            affiliateLink: link.url,
            content: renderTemplate(template.content, {
              ...dto,
              affiliateLink: link.url,
            }),
            status: "DRAFT",
            templateId: dto.templateId,
            linkId: link.id,
            topicId: post.topicId ?? dto.topicId,
            threadPostId: post.id,
            userId: user.sub,
          },
          include: { template: true, link: true },
        }),
      ),
    );

    return { created, skippedIds };
  }

  @Get()
  async list(@CurrentUser() user: JwtPayload) {
    return this.prisma.affiliateContent.findMany({
      where: { userId: user.sub },
      orderBy: { createdAt: "desc" },
      include: {
        template: { select: { id: true, name: true } },
        link: { select: { id: true, name: true, url: true } },
        threadPost: {
          select: {
            id: true,
            sourceUrl: true,
            authorUsername: true,
            authorDisplayName: true,
            authorAvatarUrl: true,
            content: true,
          },
        },
      },
    });
  }

  @Get(":id")
  async get(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    const content = await this.prisma.affiliateContent.findFirst({
      where: { id, userId: user.sub },
      include: { template: true, topic: true },
    });
    if (!content) {
      throw new NotFoundException("Affiliate content not found");
    }
    return content;
  }

  @Put(":id")
  async update(
    @Param("id") id: string,
    @Body() dto: UpdateContentDto,
    @CurrentUser() user: JwtPayload,
  ) {
    const existing = await this.prisma.affiliateContent.findFirst({
      where: { id, userId: user.sub },
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
        ...(dto.replyLink !== undefined && { replyLink: dto.replyLink || null }),
        ...(dto.status !== undefined && {
          status: dto.status,
          // Tandai terkirim manual juga mengisi publishedAt; kembali ke DRAFT
          // menghapusnya supaya auto-publish tidak salah membaca riwayat.
          publishedAt: dto.status === "PUBLISHED" ? existing.publishedAt ?? new Date() : null,
        }),
      },
      include: { template: { select: { id: true, name: true } } },
    });
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    const existing = await this.prisma.affiliateContent.findFirst({
      where: { id, userId: user.sub },
    });
    if (!existing) {
      throw new NotFoundException("Affiliate content not found");
    }
    await this.prisma.affiliateContent.delete({ where: { id } });
  }
}
