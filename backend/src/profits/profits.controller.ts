import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ProfitsService } from './profits.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type Viewer = { id: number; role: 'client' | 'admin' | 'superadmin' };

@Controller('profits')
@UseGuards(JwtAuthGuard)
export class ProfitsController {
  constructor(private readonly service: ProfitsService) { }

  @Get('summary/bank')
  async summaryByBank(@Req() req: any, @Query('userId') userId?: string, @Query('currency') currency?: string) {
    const viewer: Viewer = req.user;
    const effectiveUserId =
      viewer.role === 'client' ? viewer.id : userId ? Number(userId) : undefined;
    return this.service.summaryByBank(viewer, effectiveUserId, currency);
  }

  @Get('summary/month')
  async summaryByMonth(@Req() req: any, @Query('userId') userId?: string, @Query('currency') currency?: string) {
    const viewer: Viewer = req.user;
    const effectiveUserId =
      viewer.role === 'client' ? viewer.id : userId ? Number(userId) : undefined;
    return this.service.summaryByMonth(viewer, effectiveUserId, currency);
  }

  @Get('document/:documentId')
  async byDocument(@Param('documentId') documentId: string, @Req() req: any) {
    const viewer: Viewer = req.user;
    const rows = await this.service.findByDocument(Number(documentId), viewer);
    return Array.isArray(rows) ? rows : [];
  }
}