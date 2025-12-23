  import { Controller, Post, UseGuards, UseInterceptors, UploadedFile, Param, Body, Get, ForbiddenException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BadRequestException } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service'; 
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { XlsxService } from './xlsx.service';
import { UsersService } from '../users/users.service'; 
import { User } from '../auth/user.decorator';

import { Delete } from '@nestjs/common';


@Controller('xlsx')
export class XlsxController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly usersService: UsersService
  ) {}

  // Admin-only: Upload and process XLSX file
  @Post(':id/upload')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadXlsx(@Param('id') id: number, @UploadedFile() file: Express.Multer.File, @User() user: any) {
    console.log("xlsx controller speaking, user:", user);
    
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden subir archivos.');
    }
    const helper = new XlsxService(file.buffer);
    const totalResult = helper.extractTotals();
    const banksResult = helper.extractBankInfo();
    const monthlyHistory = helper.extractMonthlyHistory();
    const assetAllocation = helper.extractAssesAllocationFromTable();
    const assetAllocationChild = helper.extractAssesAllocationFromTable(true);

    const finalReport = {
      clienteId: id, // TODO: set client_id if available
      fechaInforme: new Date().toISOString(),
      resumenEjecutivo: {
        desgloseBancos: banksResult,
        totalPatrimonio: totalResult.patrimonioNeto,
        deudaSobrePatrimonio: totalResult.patrimonioNeto > 0
          ? (Math.abs(totalResult.deuda) / totalResult.patrimonioNeto * 100).toFixed(2) + '%'
          : '0.00%',
        rendimientoAnualActual: monthlyHistory.length > 0
          ? monthlyHistory[monthlyHistory.length - 1].rendimientoYTD.toFixed(2) + '%'
          : '0.00%'
      },
      snapshot: totalResult,
      historico: monthlyHistory,
      distribucion: assetAllocation,
      distribucion_hijos: assetAllocationChild,
    };
    // TODO: Save to DB or cache for publish step
    console.log("Final report", finalReport);
    return { message: 'Informe procesado correctamente', data: finalReport };
  }

  // Admin-only: Publish processed info (requires clientId, report, and monthYear)
  @Post(':id/publish')
  @UseGuards(JwtAuthGuard)
  async publish(@Body() body: { clientId: number, report: any, monthYear: string }, @User() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden subir archivos.');
    }
    const { clientId, report, monthYear } = body;
    if (!clientId || !report || !monthYear) {
      throw new BadRequestException('Missing required fields: clientId, report, monthYear');
    }
    // Save published data to DB
    console.log('saveReport received:', report);
    const savedReport = await this.reportsService.saveReport({
      ...report,
      clienteId: clientId,
      fechaInforme: monthYear, // or use report.fechaInforme if appropriate
    });
    return { message: 'Publicado correctamente', clientId, monthYear, data: report };
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

  // Admin-only: Delete all reports
  @Delete('delete-all')
  @UseGuards(JwtAuthGuard)
  async deleteAllReports(@User() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden eliminar informes.');
    }
    await this.reportsService.deleteAllReports();
    return { message: 'Todos los informes han sido eliminados.' };
  }
}
