import { Controller, Post, Param, ParseIntPipe, Res, Delete } from '@nestjs/common';
import { Response } from 'express';
import { InvoiceService } from './invoice.service';


@Controller('invoices')
export class InvoiceController {
  constructor(private readonly invoiceService: InvoiceService) {}

  // Endpoint to manually trigger invoice generation for a client
  @Post('test/:clientId')
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
  
  // Endpoint to delete all invoices
  @Delete('delete-all')
  async deleteAllInvoices(@Res() res: Response) {
    await this.invoiceService.deleteAllInvoices();
    return res.status(200).json({ message: 'All invoices deleted successfully.' });
  }
}
