import { Controller,UseGuards, Param, Body, Get, Post, ForbiddenException, Res } from '@nestjs/common';
import { BadRequestException } from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from '../reports/reports.service';
import { HistoryService } from 'src/history/history.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UsersService } from '../users/users.service'; 
import { User } from '../auth/user.decorator';

import { Delete } from '@nestjs/common';


@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly usersService: UsersService,
    private readonly historyService: HistoryService

  ) {}

  // Admin-only: Publish processed info (requires clientId, report, and monthYear)
  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  async publish(
    @Body() body: { 
      clientId: number, 
      report: any, 
      monthYear: string,
      resumenGlobal: string,      
      resumenTailored: string 
    }, 
    @User() user: any
  ) {
      if (user.role !== 'admin') {
        throw new ForbiddenException('Solo los administradores pueden subir archivos.');
      }
      const { clientId, report, monthYear, resumenGlobal, resumenTailored } = body;
      if (!clientId || !report || !monthYear) {
        throw new BadRequestException('Missing required fields: clientId, report, monthYear');
      }

      try {
        await this.reportsService.saveReport({
          ...report,
          clienteId: clientId,
          fechaInforme: monthYear,
          resumenGlobal: resumenGlobal,
          resumenTailored: resumenTailored
        });

      } catch (error) {
        throw new BadRequestException(`Error al guardar el informe: ${error.message}`);
      }

      try {
        await this.historyService.saveHistory(
          clientId,
          report.historico
        );
      } catch (error) {
        throw new BadRequestException(`Error al guardar el histórico: ${error.message}`);
      }
      return { message: 'Publicado correctamente', clientId, monthYear, data: report};
  }
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

  @Get(':id/pdf')
  @UseGuards(JwtAuthGuard)
  async getReportPdf(@Param('id') id: number, @Res() res: Response) {
    const reportPdf = await this.reportsService.getReportPdfForUser(id);

    if (!reportPdf?.pdf) {
      return res.status(404).json({ message: 'PDF not found' });
    }
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="report_${id}.pdf"`,
    });
    return res.send(reportPdf?.pdf);
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
