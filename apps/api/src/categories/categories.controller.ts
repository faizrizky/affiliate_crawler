import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post } from "@nestjs/common";
import { IsString, Matches, MaxLength } from "class-validator";
import { CurrentUser } from "../auth/auth.guard";
import type { JwtPayload } from "../auth/auth.service";
import { CategoriesService } from "./categories.service";

class CategoryDto {
  @IsString()
  // IsNotEmpty meloloskan "   ", yang lalu di-trim jadi nama kosong di DB.
  @Matches(/\S/, { message: "nama kategori wajib diisi" })
  @MaxLength(60)
  name: string;
}

@Controller("categories")
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  list(@CurrentUser() user: JwtPayload) {
    return this.categories.list(user.sub);
  }

  @Post()
  create(@Body() dto: CategoryDto, @CurrentUser() user: JwtPayload) {
    return this.categories.create(dto.name.trim(), user.sub);
  }

  @Patch(":id")
  update(@Param("id") id: string, @Body() dto: CategoryDto, @CurrentUser() user: JwtPayload) {
    return this.categories.update(id, user.sub, dto.name.trim());
  }

  @Delete(":id")
  @HttpCode(204)
  remove(@Param("id") id: string, @CurrentUser() user: JwtPayload) {
    return this.categories.remove(id, user.sub);
  }
}
