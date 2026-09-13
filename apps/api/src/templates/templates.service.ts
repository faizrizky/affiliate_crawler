import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "../generated/prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  private static readonly LINK_SELECT = {
    link: { select: { id: true, name: true, url: true } },
    // AffiliateContent.templateId memakai onDelete: Cascade — menghapus
    // template ikut menghapus draftnya, jadi UI perlu tahu jumlahnya.
    _count: { select: { affiliateContents: true } },
  };

  list(userId: string) {
    return this.prisma.template.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      include: TemplatesService.LINK_SELECT,
    });
  }

  async get(id: string, userId: string) {
    const template = await this.prisma.template.findFirst({
      where: { id, userId },
      include: TemplatesService.LINK_SELECT,
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
    linkId: string,
    userId: string,
  ) {
    await this.assertLinkExists(linkId, userId);
    try {
      return await this.prisma.template.create({
        data: { name, content, variables, linkId, userId },
        include: TemplatesService.LINK_SELECT,
      });
    } catch (err) {
      throw this.duplicateName(err, name);
    }
  }

  async update(
    id: string,
    userId: string,
    dto: { name?: string; content?: string; linkId?: string },
    variables?: string[],
  ) {
    await this.get(id, userId);
    if (dto.linkId !== undefined) {
      await this.assertLinkExists(dto.linkId, userId);
    }
    try {
      return await this.prisma.template.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.linkId !== undefined ? { linkId: dto.linkId } : {}),
        ...(variables !== undefined ? { variables } : {}),
      },
      include: TemplatesService.LINK_SELECT,
      });
    } catch (err) {
      throw this.duplicateName(err, dto.name ?? "");
    }
  }

  private duplicateName(err: unknown, name: string): unknown {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return new ConflictException(`Template "${name}" sudah ada`);
    }
    return err;
  }

  // Link wajib milik user yang sama: tanpa ini user bisa menempelkan link
  // affiliate orang lain ke template-nya hanya dengan menebak id.
  private async assertLinkExists(linkId: string, userId: string) {
    const link = await this.prisma.affiliateLink.findFirst({
      where: { id: linkId, userId },
    });
    if (!link) {
      throw new NotFoundException("Link not found");
    }
  }

  async remove(id: string, userId: string) {
    const existing = await this.get(id, userId);
    void existing;
    return this.prisma.template.delete({ where: { id } });
  }
}
