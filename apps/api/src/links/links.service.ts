import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const DUPLICATE_NAME = "P2002";

@Injectable()
export class LinksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.affiliateLink.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        // Dipakai modal hapus: user diberi tahu berapa template/draft yang
        // referensinya akan jadi NULL sebelum menghapus.
        include: {
          category: { select: { id: true, name: true } },
          _count: { select: { templates: true, affiliateContents: true } },
        },
      }),
      this.prisma.affiliateLink.count({ where: { userId } }),
    ]);
    return {
      links: items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async get(id: string, userId: string) {
    const link = await this.prisma.affiliateLink.findFirst({ where: { id, userId } });
    if (!link) {
      throw new NotFoundException("Link not found");
    }
    return link;
  }

  async create(name: string, url: string, userId: string, categoryId: string | null = null) {
    if (categoryId) await this.assertCategoryExists(categoryId, userId);
    try {
      return await this.prisma.affiliateLink.create({
        data: { name, url, userId, categoryId },
        include: { category: { select: { id: true, name: true } } },
      });
    } catch (err) {
      throw this.rethrowDuplicate(err, name);
    }
  }

  async update(
    id: string,
    userId: string,
    dto: { name?: string; url?: string; categoryId?: string | null },
  ) {
    await this.get(id, userId);
    if (dto.categoryId) await this.assertCategoryExists(dto.categoryId, userId);
    try {
      return await this.prisma.affiliateLink.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.url !== undefined ? { url: dto.url } : {}),
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId || null } : {}),
        },
        include: { category: { select: { id: true, name: true } } },
      });
    } catch (err) {
      throw this.rethrowDuplicate(err, dto.name ?? "");
    }
  }

  async remove(id: string, userId: string) {
    await this.get(id, userId);
    // Tidak memblokir saat link masih dipakai: relasi di Template dan
    // AffiliateContent memakai onDelete: SetNull, dan UI sudah menampilkan
    // jumlah pemakaian di modal konfirmasi sebelum sampai ke sini.
    await this.prisma.affiliateLink.delete({ where: { id } });
  }

  // Kategori wajib milik user yang sama: tanpa ini id kategori orang lain bisa
  // ditempel ke link sendiri hanya dengan menebak.
  private async assertCategoryExists(categoryId: string, userId: string) {
    const category = await this.prisma.category.findFirst({ where: { id: categoryId, userId } });
    if (!category) throw new NotFoundException("Category not found");
  }

  private rethrowDuplicate(err: unknown, name: string): unknown {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === DUPLICATE_NAME
    ) {
      return new ConflictException(`Link "${name}" already exists`);
    }
    return err;
  }
}
