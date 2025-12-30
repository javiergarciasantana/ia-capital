import { Controller, Post, UseGuards, UseInterceptors, UploadedFile, Param, Body, Get, ForbiddenException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { BadRequestException } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service';
import { HistoryService } from '../history/history.service'; 
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { XlsxService } from './xlsx.service';
import { User } from '../auth/user.decorator';

@Controller('xlsx')
export class XlsxController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly historyService: HistoryService
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
      clienteId: id, // 
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
    //console.log("Final report", finalReport);
    return { message: 'Informe procesado correctamente', data: finalReport };
  }

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
    @User() user: any) {
      if (user.role !== 'admin') {
        throw new ForbiddenException('Solo los administradores pueden subir archivos.');
      }
      const { clientId, report, monthYear, resumenGlobal, resumenTailored } = body;
      if (!clientId || !report || !monthYear) {
        throw new BadRequestException('Missing required fields: clientId, report, monthYear');
      }
      // Save published data to DB
      //console.log('saveReport received:', report);
      const savedReport = await this.reportsService.saveReport({
        ...report,
        clienteId: clientId,
        fechaInforme: monthYear,
        resumenGlobal: resumenGlobal,
        resumenTailored: resumenTailored
      });
      const savedHistory = await this.historyService.saveHistory(
        clientId,
        report.historico
      )
      return { message: 'Publicado correctamente', clientId, monthYear, data: report };
  }
}
