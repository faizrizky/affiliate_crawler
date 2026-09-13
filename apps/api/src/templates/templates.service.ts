import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly INCLUDE = {
    // Berurutan: posisi N = {{affiliate_link_N}}.
    links: {
      orderBy: { position: "asc" as const },
      select: {
        position: true,
        link: { select: { id: true, name: true, url: true, categoryId: true } },
      },
    },
    category: { select: { id: true, name: true } },
    // AffiliateContent.templateId memakai onDelete: Cascade — menghapus
    // template ikut menghapus draftnya, jadi UI perlu tahu jumlahnya.
    _count: { select: { affiliateContents: true } },
  };

  list(userId: string) {
    return this.prisma.template.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: TemplatesService.INCLUDE,
    });
  }

  async get(id: string, userId: string) {
    const template = await this.prisma.template.findFirst({
      where: { id, userId },
      include: TemplatesService.INCLUDE,
    });
    if (!template) {
      throw new NotFoundException("Template not found");
    }
    return template;
  }

  async create(
    name: string,
    content: string,
    variables: string[],
    linkIds: string[],
    userId: string,
    categoryId: string | null = null,
  ) {
    await this.assertLinksOwned(linkIds, userId);
    if (categoryId) await this.assertCategoryExists(categoryId, userId);
    try {
      return await this.prisma.template.create({
        data: {
          name,
          content,
          variables,
          userId,
          categoryId,
          links: { create: linkIds.map((linkId, i) => ({ linkId, position: i + 1 })) },
        },
        include: TemplatesService.INCLUDE,
      });
    } catch (err) {
      throw this.duplicateName(err, name);
    }
  }

  async update(
    id: string,
    userId: string,
    dto: { name?: string; content?: string; linkIds?: string[]; categoryId?: string | null },
    variables?: string[],
  ) {
    await this.get(id, userId);
    if (dto.linkIds !== undefined) await this.assertLinksOwned(dto.linkIds, userId);
    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId, userId);
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (dto.linkIds !== undefined) {
          // Susunan link diganti utuh sesuai urutan yang dikirim klien.
          await tx.templateLink.deleteMany({ where: { templateId: id } });
          await tx.templateLink.createMany({
            data: dto.linkIds.map((linkId, i) => ({ templateId: id, linkId, position: i + 1 })),
          });
        }
        return tx.template.update({
          where: { id },
          data: {
            ...(dto.name !== undefined ? { name: dto.name } : {}),
            ...(dto.content !== undefined ? { content: dto.content } : {}),
            ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId || null } : {}),
            ...(variables !== undefined ? { variables } : {}),
          },
          include: TemplatesService.INCLUDE,
        });
      });
    } catch (err) {
      throw this.duplicateName(err, dto.name ?? "");
    }
  }

  async remove(id: string, userId: string) {
    const existing = await this.get(id, userId);
    void existing;
    return this.prisma.template.delete({ where: { id } });
  }

  private duplicateName(err: unknown, name: string): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return new ConflictException(`Template "${name}" sudah ada`);
    }
    return err;
  }

  private async assertCategoryExists(categoryId: string, userId: string) {
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) throw new NotFoundException("Category not found");
  }

  // Semua link wajib milik user yang sama: tanpa ini user bisa menempelkan
  // link affiliate orang lain ke template-nya hanya dengan menebak id.
  private async assertLinksOwned(linkIds: string[], userId: string) {
    if (new Set(linkIds).size !== linkIds.length) {
      throw new BadRequestException("Link yang sama tidak boleh dipilih dua kali");
    }
    const count = await this.prisma.affiliateLink.count({
      where: { id: { in: linkIds }, userId },
    });
    if (count !== linkIds.length) {
      throw new NotFoundException("Link not found");
    }
  }
}
