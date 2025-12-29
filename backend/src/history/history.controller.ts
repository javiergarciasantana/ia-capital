import { Controller,UseGuards, Param, Body, Get, ForbiddenException } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { HistoryService } from './history.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service'; 
import { User } from '../auth/user.decorator';

import { Delete } from '@nestjs/common';


@Controller('history')
export class HistoryController {
  constructor(
    private readonly historyService: HistoryService,
    private readonly usersService: UsersService
  ) {}

  // Admin-only: Get history between two dates
  @Get('all/:upto')
  @UseGuards(JwtAuthGuard)
  async getAllHistoryUptoDate(
    @Param('upto') upto: string,
    @User() user: any
  ) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden ver todos los informes.');
    }
    if (!upto) {
      throw new BadRequestException('Missing required date.');
    }
    const toDate = new Date(upto);
    const reports = await this.historyService.getHistoryUpToDate(toDate);
    return { message: 'Informes recuperados', data: reports };
  }

  @Get('/all')
  @UseGuards(JwtAuthGuard)
  async getAllHistory(    
    @User() user: any,
  ) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden ver todos los informes.');
    }
    const fullUser = await this.usersService.findById(user.id);
    if (!fullUser.isActive) {
      throw new ForbiddenException('Usuario no activo.');
    }    
    const reports = await this.historyService.getHistory();
    return { message: 'Informes recuperados', data: reports };
  }

  @Get('myinfo/all')
  @UseGuards(JwtAuthGuard)
  async getAllMyHistory(    
    @User() user: any,
  ) {
    const fullUser = await this.usersService.findById(user.id);
   if (!fullUser.isActive) {
      throw new ForbiddenException('Usuario no activo.');
    }    
    const reports = await this.historyService.getHistoryForUser(user.id);
    return { message: 'Informes recuperados', data: reports };
  }

  // Public: Get published info
  @Get('myinfo/:upto')
  @UseGuards(JwtAuthGuard)
  async getMyHistoryUptoDate(    
    @Param('upto') upto: string,
    @User() user: any,
    ) {
    const fullUser = await this.usersService.findById(user.id);
    if (!fullUser.isActive) {
      throw new ForbiddenException('Usuario no activo.');
    }
    if (!upto) {
      throw new BadRequestException('Missing required date range.');
    }
    const toDate = new Date(upto);
    const reports = await this.historyService.getHistorUpToForUser(toDate, user.id);
    return { message: 'Informes recuperados', data: reports };
    }

  // Admin-only: Delete all reports
  @Delete('delete-all')
  @UseGuards(JwtAuthGuard)
  async deleteAllHistory(@User() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden eliminar informes.');
    }
    await this.historyService.deleteHistory();
    return { message: 'Todos los informes han sido eliminados.' };
  }
}
