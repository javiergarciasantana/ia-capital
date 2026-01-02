import { Controller,UseGuards, Param, Body, Get, ForbiddenException } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service'; 
import { User } from '../auth/user.decorator';

import { Delete } from '@nestjs/common';


@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly usersService: UsersService
  ) {}

  // Admin-only: Get all reports between two dates
  @Get('all/:from/:to')
  @UseGuards(JwtAuthGuard)
  async getAllReportsBetweenDates(
    @Param('from') from: string,
    @Param('to') to: string,
    @User() user: any
  ) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden ver todos los informes.');
    }
    if (!from || !to) {
      throw new BadRequestException('Missing required date range.');
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const reports = await this.reportsService.getReportsBetweenDates(fromDate, toDate);
    return { message: 'Informes recuperados', data: reports };
  }

  @Get('/all')
  @UseGuards(JwtAuthGuard)
  async getAllReports(    
    @User() user: any,
  ) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden ver todos los informes.');
    }
    const fullUser = await this.usersService.findById(user.id);
    if (!fullUser.isActive) {
      throw new ForbiddenException('Usuario no activo.');
    }    
    const reports = await this.reportsService.getReports();
    return { message: 'Informes recuperados', data: reports };
  }

  @Get('myinfo/all')
  @UseGuards(JwtAuthGuard)
  async getAllMyReports(    
    @User() user: any,
  ) {
    const fullUser = await this.usersService.findById(user.id);
   if (!fullUser.isActive) {
      throw new ForbiddenException('Usuario no activo.');
    }    
    const reports = await this.reportsService.getReportsForUser(user.id);
    return { message: 'Informes recuperados', data: reports };
  }

  // Public: Get published info
  @Get('myinfo/:from/:to')
  @UseGuards(JwtAuthGuard)
  async getMyReportsBetweenDates(    
    @Param('from') from: string,
    @Param('to') to: string,
    @User() user: any,
    ) {
    const fullUser = await this.usersService.findById(user.id);
    if (!fullUser.isActive) {
      throw new ForbiddenException('Usuario no activo.');
    }
    if (!from || !to) {
      throw new BadRequestException('Missing required date range.');
    }
    const fromDate = new Date(from);
    const toDate = new Date(to);
    const reports = await this.reportsService.getReportsBetweenDatesForUser(fromDate, toDate, user.id);
    return { message: 'Informes recuperados', data: reports };
    }


  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  async deleteReportById(
    @Param('id') id: string,
    @User() user: any
  ) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden eliminar informes.');
    }
    const reportId = parseInt(id, 10);
    if (isNaN(reportId)) {
      throw new BadRequestException('ID de informe inválido.');
    }
    try {
      await this.reportsService.deleteReport(reportId);
      return { message: 'Informe eliminado correctamente.' };
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }
  
  // Admin-only: Delete all reports
  @Delete('')
  @UseGuards(JwtAuthGuard)
  async deleteAllReports(@User() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden eliminar informes.');
    }
    await this.reportsService.deleteAllReports();
    return { message: 'Todos los informes han sido eliminados.' };
  }
}
