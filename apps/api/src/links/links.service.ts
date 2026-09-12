import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

const DUPLICATE_NAME = "P2002";

@Injectable()
export class LinksService {
  constructor(private readonly prisma: PrismaService) {}

  async list(page: number, pageSize: number) {
    const [items, total] = await Promise.all([
      this.prisma.affiliateLink.findMany({
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        // Dipakai modal hapus: user diberi tahu berapa template/draft yang
        // referensinya akan jadi NULL sebelum menghapus.
        include: {
          _count: { select: { templates: true, affiliateContents: true } },
        },
      }),
      this.prisma.affiliateLink.count(),
    ]);
    return {
      links: items,
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  async get(id: string) {
    const link = await this.prisma.affiliateLink.findUnique({ where: { id } });
    if (!link) {
      throw new NotFoundException("Link not found");
    }
    return link;
  }

  async create(name: string, url: string, userId: string) {
    try {
      return await this.prisma.affiliateLink.create({
        data: { name, url, userId },
      });
    } catch (err) {
      throw this.rethrowDuplicate(err, name);
    }
  }

  async update(id: string, dto: { name?: string; url?: string }) {
    await this.get(id);
    try {
      return await this.prisma.affiliateLink.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.url !== undefined ? { url: dto.url } : {}),
        },
      });
    } catch (err) {
      throw this.rethrowDuplicate(err, dto.name ?? "");
    }
  }

  async remove(id: string) {
    await this.get(id);
    // Tidak memblokir saat link masih dipakai: relasi di Template dan
    // AffiliateContent memakai onDelete: SetNull, dan UI sudah menampilkan
    // jumlah pemakaian di modal konfirmasi sebelum sampai ke sini.
    await this.prisma.affiliateLink.delete({ where: { id } });
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
