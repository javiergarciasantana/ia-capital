  
  
  import { Controller, Post, UseGuards, UseInterceptors, UploadedFile, Param, Body, Get } from '@nestjs/common';
  import { FileInterceptor } from '@nestjs/platform-express';
  import { JwtAuthGuard } from '../auth/jwt-auth.guard';
  import { XlsxService } from './xlsx.service';

  @Controller('xlsx')
  export class XlsxController {
    // Admin-only: Upload and process XLSX file
    @Post(':id/upload')
    @UseGuards(JwtAuthGuard)
    @UseInterceptors(FileInterceptor('file'))
    async uploadXlsx(@Param('id') id: number, @UploadedFile() file: Express.Multer.File) {
      console.log("xlsx controller speaking")
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
      return { message: 'Informe procesado correctamente', data: finalReport };
    }

    // Admin-only: Publish processed info (requires clientId, report, and monthYear)
    @Post('publish')
    @UseGuards(JwtAuthGuard)
    async publish(@Body() body: { clientId: number, report: any, monthYear: string }) {
      const { clientId, report, monthYear } = body;
      if (!clientId || !report || !monthYear) {
        return { message: 'Missing required fields: clientId, report, monthYear', error: true };
      }
      // TODO: Save published data to DB with clientId and monthYear
      return { message: 'Publicado correctamente', clientId, monthYear, data: report };
    }

    // Public: Get published info
    @Get('public')
    async getPublished() {
      // TODO: Fetch published data from DB
      return { message: 'Datos publicados', data: null };
    }
  }
