import { Injectable } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service';
import { HistoryService } from 'src/history/history.service';
import { InvoiceService } from 'src/invoices/invoice.service';
import { UsersService } from 'src/users/users.service';

export type ReportKPIs = {
  totalPatrimony: number;
  debt: number;
  ytdReturn: string;
  monthlyReturn: number;
  bankBreakdown?: string[];
};

export type ReportFact = {
  id: number;
  fechaInforme: string;
  clienteId: number;
  clientName: string;
  kpis: ReportKPIs;
  resumenText: string;
  distribution?: any[];
  invoices?: any[];
  history?: any[];
};

export type Facts = {
  role: string;
  userProfile?: any;
  globalMetrics?: {
    totalAUM: number;
    totalDebt: number;
    activeClients: number;
    avgReturn: string;
    topClients: Array<{ name: string; value: number }>;
    aggregatedDistribution: Array<{ name: string; value: number }>;
  };
  reports: ReportFact[];
  latestReport?: ReportFact;
};

@Injectable()
export class UserFactsService {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly usersService: UsersService,
    private readonly historyService: HistoryService,
    private readonly invoiceService: InvoiceService,
  ) {}

  private formatCurrency(val: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
  }

  async buildFacts(user: { id: number; role: string }): Promise<Facts> {
    let reportsRaw: any[] = [];
    let userProfile: any = null;

    // 1. Get user profile
    const fullUser = await this.usersService.findById(user.id);
    if (fullUser?.profile) userProfile = fullUser.profile;

    // 2. Get reports
    if (user.role === 'admin') {
      reportsRaw = await this.reportsService.getReportsBetweenDates(
        new Date('2020-01-01'),
        new Date()
      );
    } else {
      reportsRaw = await this.reportsService.getReportsForUser(user.id);
    }

    // 3. Get history and invoices for each report
    const reports: ReportFact[] = await Promise.all(reportsRaw.map(async (r) => {
      const totalPatrimony = r.resumenEjecutivo?.totalPatrimonio ?? r.snapshot?.patrimonioNeto ?? 0;
      const debt = r.snapshot?.deuda ?? 0;
      let ytdStr = r.resumenEjecutivo?.rendimientoAnualActual ?? '0%';
      if (typeof r.history?.slice(-1)[0]?.rendimientoYTD === 'number') {
        ytdStr = `${r.history.slice(-1)[0].rendimientoYTD.toFixed(2)}%`;
      }
      const bankBreakdown = r.resumenEjecutivo?.desgloseBancos
        ? Object.entries(r.resumenEjecutivo.desgloseBancos).map(
            ([bank, data]: any) => `${bank}: ${this.formatCurrency(data.patrimonioNeto || 0)}`
          )
        : [];
      const rawClient = r.client || r.user;
      let displayName = `${r.clienteId}`;
      const clientReport = reportsRaw.find(rep => rep.clienteId === r.clienteId && (rep.client?.name || rep.user?.name));
      if (clientReport) {
        displayName = clientReport.client?.name || clientReport.user?.name || displayName;
      }
      const resumenText = (r.resumenEjecutivo?.resumen && r.resumenEjecutivo.resumen.length > 5)
        ? r.resumenEjecutivo.resumen
        : 'No hay un resumen narrativo disponible.';

      // Fetch history and invoices for this report
      let history: any[] = [];
      if (user.role === 'admin') {
        history = await this.historyService.getHistoryUpToDate?.(new Date()) ?? [];
      } else {
        history = await this.historyService.getHistoryForUser?.(user.id) ?? [];
      }
      const invoices = r.invoice ? [r.invoice] : [];

      return {
        id: r.id,
        fechaInforme: r.fechaInforme instanceof Date ? r.fechaInforme.toISOString() : String(r.fechaInforme),
        clienteId: r.clienteId,
        clientName: displayName,
        resumenText,
        kpis: {
          totalPatrimony,
          debt,
          ytdReturn: ytdStr,
          monthlyReturn: r.history?.slice(-1)[0]?.rendimientoMensual ?? 0,
          bankBreakdown
        },
        distribution: r.distribution ?? [],
        invoices,
        history,
      };
    }));

    // 4. Calculate global metrics (latest report per client)
    let globalMetrics;
    if (user.role === 'admin' && reports.length > 0) {
      const latestReportsMap = new Map<number, ReportFact>();
      reports.forEach(r => {
        const existing = latestReportsMap.get(r.clienteId);
        if (!existing || new Date(r.fechaInforme) > new Date(existing.fechaInforme)) {
          latestReportsMap.set(r.clienteId, r);
        }
      });
      const uniqueReports = Array.from(latestReportsMap.values());
      const totalAUM = uniqueReports.reduce((sum, r) => sum + (r.kpis.totalPatrimony || 0), 0);
      const totalDebt = uniqueReports.reduce((sum, r) => sum + (r.kpis.debt || 0), 0);
      const validYtds = uniqueReports
        .map(r => parseFloat(r.kpis.ytdReturn))
        .filter(n => !isNaN(n));
      const avgReturn = validYtds.length
        ? (validYtds.reduce((a, b) => a + b, 0) / validYtds.length).toFixed(2) + '%'
        : '0%';
      // Top clients
      const topClients = uniqueReports
        .map(r => ({ name: r.clientName, value: r.kpis.totalPatrimony || 0 }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);
      // Aggregate distribution
      const distMap = new Map<string, number>();
      uniqueReports.forEach(r => {
        r.distribution?.forEach(d => {
          if (d.categoria !== 'Total') {
            const current = distMap.get(d.categoria) || 0;
            distMap.set(d.categoria, current + d.valor);
          }
        });
      });
      const aggregatedDistribution = Array.from(distMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);

      globalMetrics = {
        totalAUM,
        totalDebt,
        activeClients: uniqueReports.length,
        avgReturn,
        topClients,
        aggregatedDistribution,
      };
    }

    return {
      role: user.role,
      userProfile,
      reports,
      latestReport: reports[0],
      globalMetrics
    };
  }

  // Genera el texto que se inyectará en el prompt del sistema
  factsToPromptText(f: Facts): string {
    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
    const lines: string[] = [];

    lines.push(`ROL USUARIO: ${f.role.toUpperCase()}`);

    if (f.userProfile) {
      lines.push(`\n=== PERFIL DEL USUARIO ===`);
      lines.push(`Nombre: ${f.userProfile.firstName} ${f.userProfile.lastName}`);
      lines.push(`Email: ${f.userProfile.email}`);
      if (f.userProfile.feePercentage) lines.push(`Comisión: ${(f.userProfile.feePercentage * 100).toFixed(2)}%`);
      if (f.userProfile.preferredCurrency) lines.push(`Divisa preferida: ${f.userProfile.preferredCurrency}`);
      // Removed system.push block as 'system' is not defined
    }

    if (f.reports?.length) {
      const recentInvoices = f.reports.flatMap(r => r.invoices || []).slice(0, 3);
      if (recentInvoices.length) {
        lines.push(`\n=== FACTURAS RECIENTES ===`);
        recentInvoices.forEach(inv => {
          lines.push(`Factura #${inv.id} (${inv.fechaFactura}): ${inv.importe}€`);
        });
      }
      const recentHistory = f.reports.flatMap(r => r.history || []).slice(0, 3);
      if (recentHistory.length) {
        lines.push(`\n=== HISTORIAL RECIENTE ===`);
        recentHistory.forEach(h => {
          lines.push(`Historial: ${JSON.stringify(h)}`);
        });
      }
    }
    
    // Bloque Global: Respuesta rápida para preguntas generales
    if (f.globalMetrics) {
      lines.push(`\n=== RESUMEN GLOBAL DE LA FIRMA ===`);
      lines.push(`• AUM Total: ${this.formatCurrency(f.globalMetrics.totalAUM)}`);
      lines.push(`• Deuda Total: ${this.formatCurrency(f.globalMetrics.totalDebt)}`);
      lines.push(`• Clientes Activos: ${f.globalMetrics.activeClients}`);
      lines.push(`• Rendimiento Promedio: ${f.globalMetrics.avgReturn}`);
      lines.push(`==================================\n`);
    }

    // Bloque Detallado: Para preguntas específicas sobre clientes
    lines.push(`=== INFORMES DETALLADOS POR CLIENTE ===`);
    
    if (f.role === 'admin') {
      // Agrupar por nombre de cliente para dar estructura lógica
      const byClient = f.reports.reduce((acc, r) => {
        const key = r.clientName; 
        acc[key] = acc[key] || [];
        acc[key].push(r);
        return acc;
      }, {} as Record<string, ReportFact[]>);

      Object.entries(byClient).forEach(([clientName, clientReports]) => {
        lines.push(`\nCLIENTE: ${clientName}`);
        // Solo incluimos los 2 últimos reportes para no saturar el contexto
        clientReports.slice(0, 2).forEach(r => lines.push(this.formatSingleReport(r, fmtDate))); 
      });
    } else {
      // Usuario normal: Últimos 5 reportes
      f.reports.slice(0, 5).forEach(r => lines.push(this.formatSingleReport(r, fmtDate)));
    }

    return lines.join('\n');
  }

  private formatSingleReport(r: ReportFact, dateFmt: (d: string) => string): string {
    let txt = `   - [${dateFmt(r.fechaInforme)}]`;
    txt += ` Patrimonio: ${this.formatCurrency(r.kpis.totalPatrimony)} |`;
    txt += ` Deuda: ${this.formatCurrency(r.kpis.debt)} |`;
    txt += ` Retorno YTD: ${r.kpis.ytdReturn}`;
    
    if (r.kpis.bankBreakdown && r.kpis.bankBreakdown.length > 0) {
      txt += `\n     Bancos: ${r.kpis.bankBreakdown.join(', ')}`;
    }
    
    if (r.resumenText && r.resumenText !== 'No hay un resumen narrativo disponible.') { 
      txt += `\n     Nota: "${r.resumenText}"`;
    }
    return txt;
  }
}