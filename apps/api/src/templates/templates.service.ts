import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.template.findMany({ orderBy: { createdAt: "asc" } });
  }

  async get(id: string) {
    const template = await this.prisma.template.findUnique({ where: { id } });
    if (!template) {
      throw new NotFoundException("Template not found");
    }
    return template;
  }

  create(name: string, content: string, variables: string[]) {
    return this.prisma.template.create({
      data: { name, content, variables },
    });
  }

  async update(id: string, dto: { name?: string; content?: string }, variables?: string[]) {
    const existing = await this.get(id);
    void existing;
    return this.prisma.template.update({
      where: { id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.content !== undefined ? { content: dto.content } : {}),
        ...(variables !== undefined ? { variables } : {}),
      },
    });
  }

  async remove(id: string) {
    const existing = await this.get(id);
    void existing;
    return this.prisma.template.delete({ where: { id } });
  }
}
