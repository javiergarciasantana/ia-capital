import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserRole } from './user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  @Get()
  async getUsers(@Query('role') role?: string) {
    return this.usersService.findByRole(role);
  }

  @Post()
  async create(@Body() dto: CreateUserDto) {
    return this.usersService.create(dto);
  }

  // (útil para panel de admin)
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(Number(id), dto);
  }

  @Patch(':id/activate')
  async activate(@Param('id') id: string) {
    return this.usersService.activate(Number(id));
  }

  @Patch(':id/deactivate')
  async deactivate(@Param('id') id: string) {
    return this.usersService.deactivate(Number(id));
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    await this.usersService.remove(Number(id));
    return { ok: true };
  }
}
