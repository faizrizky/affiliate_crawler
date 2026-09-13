import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  list(userId: string) {
    return this.prisma.category.findMany({
      where: { userId },
      orderBy: { name: "asc" },
      // Dipakai dialog hapus: berapa template & link yang kehilangan kategori.
      include: { _count: { select: { templates: true, links: true } } },
    });
  }

  async get(id: string, userId: string) {
    const category = await this.prisma.category.findFirst({ where: { id, userId } });
    if (!category) throw new NotFoundException("Category not found");
    return category;
  }

  async create(name: string, userId: string) {
    try {
      return await this.prisma.category.create({ data: { name, userId } });
    } catch (err) {
      throw this.duplicate(err, name);
    }
  }

  async update(id: string, userId: string, name: string) {
    await this.get(id, userId);
    try {
      return await this.prisma.category.update({ where: { id }, data: { name } });
    } catch (err) {
      throw this.duplicate(err, name);
    }
  }

  async remove(id: string, userId: string) {
    await this.get(id, userId);
    // Template.categoryId & AffiliateLink.categoryId memakai onDelete: SetNull —
    // template dan link tetap ada, hanya jadi tanpa kategori.
    await this.prisma.category.delete({ where: { id } });
  }

  private duplicate(err: unknown, name: string): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return new ConflictException(`Kategori "${name}" sudah ada`);
    }
    return err;
  }
}
