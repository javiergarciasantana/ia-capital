import { Controller, Post, Param, ParseIntPipe, Res, Delete, Get, UseGuards, ForbiddenException, Body } from '@nestjs/common';
import { Response } from 'express';
import { User } from '../auth/user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { InvoiceService } from './invoice.service';
import { UsersService } from '../users/users.service';
const archiver = require('archiver');

@Controller('invoices')
export class InvoiceController {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly usersService: UsersService
  ) {}

  // Download all invoices as ZIP (admin only)
  @Get('all-pdfs')
  @UseGuards(JwtAuthGuard)
  async getAllInvoicePdfs(@Res() res: Response, @User() user: any) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden descargar todas las facturas.');
    }
    const pdfs = await this.invoiceService.getAllInvoicePdfs();
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="all_invoices.zip"',
    });
    const archive = archiver('zip');
    archive.pipe(res);
    pdfs.forEach((item) => {
      if (item.pdf) {
        archive.append(item.pdf, { name: `invoice_${item.id}.pdf` });
      }
    });
    await archive.finalize();
  }



  // List all invoices for a user (metadata only)
  @Get('user/:id')
  @UseGuards(JwtAuthGuard)
  async getAllUserInvoices(
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
  ) {
    const fullUser = await this.usersService.findById(user.id);
    if (!fullUser.isActive) {
      throw new ForbiddenException('Usuario no activo.');
    }
    const invoices = await this.invoiceService.getUserInvoices(id);
    return { message: 'Facturas recuperadas', data: invoices };
  }

  @Get('user/:id/download/all-pdfs')
  @UseGuards(JwtAuthGuard)
  async getAllUserInvoicePdfs(
    @Res() res: Response,
    @Param('id', ParseIntPipe) id: number,
    @User() user: any,
  ) {
    const fullUser = await this.usersService.findById(user.id);
    if (!fullUser.isActive) {
      throw new ForbiddenException('Usuario no activo.');
    }

    const Pdfs = await this.invoiceService.getUserInvoicePdfs(id);
    if (!Pdfs || Pdfs.length === 0 || !Pdfs[0].pdf) {
      return res.status(404).json({ message: 'No se encontró la factura o el PDF.' });
    }
    res.set({
      'Content-Type': 'application/zip',
      'Content-Disposition': 'attachment; filename="all_invoices.zip"',
    });

    const archive = archiver('zip');
    archive.pipe(res);
    Pdfs.forEach((item) => {
      if (item.pdf) {
        archive.append(item.pdf, { name: `invoice_${item.id}.pdf` });
      }
    });
    await archive.finalize();
  }

  // Download a single invoice PDF by invoice id
  @Get(':invoiceId/download')
  @UseGuards(JwtAuthGuard)
  async downloadInvoicePdf(
    @Res() res: Response,
    @Param('invoiceId', ParseIntPipe) invoiceId: number,
    @User() user: any,
  ) {
    const invoice = await this.invoiceService.getInvoice(invoiceId);
    if (!invoice || !invoice.invoicePdf || !invoice.invoicePdf.pdf) {
      return res.status(404).json({ message: 'No se encontró la factura o el PDF.' });
    }
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="invoice_${invoice.id}.pdf"`,
    });
    return res.send(invoice.invoicePdf.pdf);
  }

  // Endpoint to manually trigger invoice generation for a client (unchanged)
  @Post('test/:clientId')
  @UseGuards(JwtAuthGuard)
  async testGenerateInvoice(
    @Param('clientId', ParseIntPipe) clientId: number,
    @Res() res: Response
  ) {
    console.log(`Manually generating invoice for client ${clientId}...`);
    const result = await this.invoiceService.generateInvoiceForClient(clientId);

    if (!result) {
      return res.status(400).json({ message: 'Invoice not generated. Check logs (Client not found, no reports, or 0 amount).' });
    }

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice_${result.invoice?.id ?? 'unknown'}.pdf"`,
    });
    return res.send(result.pdf);
  }

  // Endpoint to delete all invoices (admin only)
  @Delete('delete-all')
  @UseGuards(JwtAuthGuard)
  async deleteAllInvoices(
    @Res() res: Response,
    @User() user: any
  ) {
    if (user.role !== 'admin') {
      throw new ForbiddenException('Solo los administradores pueden eliminar facturas.');
    }
    await this.invoiceService.deleteAllInvoices();
    return res.status(200).json({ message: 'All invoices deleted successfully.' });
  }

  @Delete('delete-all-pdfs')
  @UseGuards(JwtAuthGuard)
  async deleteAllPdf(@Res() res: Response) {
    await this.invoiceService.deleteAllPdfs();
    return res.status(200).json({ message: 'All PDFs deleted successfully.' });
  }
}