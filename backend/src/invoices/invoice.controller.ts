import { Controller, Post, Param, ParseIntPipe, Res, Delete, Get, UseGuards} from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

import { InvoiceService } from './invoice.service';
const archiver = require('archiver');


@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  // Endpoint to manually trigger invoice generation for a client
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

    // Set headers to display PDF in browser
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="invoice_${result.invoice.id}.pdf"`,
    });

    // Send the PDF buffer (assuming result.pdf is a Buffer)
    return res.send(result.pdf);
  }
  // Endpoint to get all invoice PDFs
  @Get('all-pdfs')
  @UseGuards(JwtAuthGuard)
  async getAllInvoicePdfs(@Res() res: Response) {
    const pdfs = await this.invoiceService.getAllInvoicePdfs();

    // Assuming pdfs is an array of objects: [{ id, pdf }]
    // Create a zip file with all PDFs
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

  @Get('user/:id/download')
  @UseGuards(JwtAuthGuard)
  async getAllUserInvoicePdfs(@Res() res: Response, @Param('id') id: Number,) {
    const pdfs = await this.invoiceService.getUserInvoicePdfs(id);

    // Assuming pdfs is an array of objects: [{ id, pdf }]
    // Create a zip file with all PDFs
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

  // Endpoint to delete all invoices
  @Delete('delete-all')
  async deleteAllInvoices(@Res() res: Response) {
    await this.invoiceService.deleteAllInvoices();
    return res.status(200).json({ message: 'All invoices deleted successfully.' });
  }

  @Delete('delete-all-pdfs')
  async deleteAllPdf(@Res() res: Response) {
    await this.invoiceService.deleteAllPdfs();
    return res.status(200).json({ message: 'All PDFs deleted successfully.' });
  }

}
