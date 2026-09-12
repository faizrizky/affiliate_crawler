import { Injectable, NotFoundException } from "@nestjs/common";
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

  list() {
    return this.prisma.template.findMany({
      orderBy: { createdAt: "asc" },
      include: TemplatesService.LINK_SELECT,
    });
  }

  async get(id: string) {
    const template = await this.prisma.template.findUnique({
      where: { id },
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
    await this.assertLinkExists(linkId);
    return this.prisma.template.create({
      data: { name, content, variables, linkId, userId },
      include: TemplatesService.LINK_SELECT,
    });
  }

  async update(
    id: string,
    dto: { name?: string; content?: string; linkId?: string },
    variables?: string[],
  ) {
    await this.get(id);
    if (dto.linkId !== undefined) {
      await this.assertLinkExists(dto.linkId);
    }
    return this.prisma.template.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(dto.linkId !== undefined ? { linkId: dto.linkId } : {}),
        ...(variables !== undefined ? { variables } : {}),
      },
      include: TemplatesService.LINK_SELECT,
    });
  }

  private async assertLinkExists(linkId: string) {
    const link = await this.prisma.affiliateLink.findUnique({
      where: { id: linkId },
    });
    if (!link) {
      throw new NotFoundException("Link not found");
    }
  }

  async remove(id: string) {
    const existing = await this.get(id);
    void existing;
    return this.prisma.template.delete({ where: { id } });
  }
}
