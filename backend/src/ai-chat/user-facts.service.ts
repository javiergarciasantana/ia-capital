// backend/src/ai-chat/user-facts.service.ts
import { Injectable } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service';

// Tipos definidos para estructurar la información
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
  clientName: string; // Guardamos el nombre real aquí
  kpis: ReportKPIs;
  resumenText: string;
};

export type Facts = {
  role: string;
  globalMetrics?: {
    totalAUM: number;
    totalDebt: number;
    activeClients: number;
    avgReturn: string;
  };
  reports: ReportFact[];
  latestReport?: ReportFact;
};

@Injectable()
export class UserFactsService {
  constructor(private readonly reportsService: ReportsService) {}

  private formatCurrency(val: number) {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(val);
  }

  async buildFacts(user: { id: number; role: string }): Promise<Facts> {
    let reportsRaw: any[] = [];
    
    // 1. Obtener datos según el rol
    if (user.role === 'admin') {
      // Traemos todo el histórico relevante para construir contexto global
      reportsRaw = await this.reportsService.getReportsBetweenDates(
        new Date('2020-01-01'), 
        new Date()
      );
    } else {
      reportsRaw = await this.reportsService.getReportsForUser(user.id);
    }

    // 2. Procesar y enriquecer los datos
    const reports: ReportFact[] = reportsRaw.map((r) => {
      // Extracción de KPIs con fallbacks seguros
      const totalPatrimony = r.resumenEjecutivo?.totalPatrimony ?? r.snapshot?.patrimonioNeto ?? 0;
      const debt = r.snapshot?.deuda ?? 0;
      
      let ytdStr = r.resumenEjecutivo?.rendimientoAnualActual ?? '0%';
      // Intentar sacar dato numérico preciso del histórico si existe
      if (typeof r.history?.slice(-1)[0]?.rendimientoYTD === 'number') {
        ytdStr = `${r.history.slice(-1)[0].rendimientoYTD.toFixed(2)}%`;
      }

      // Formatear desglose de bancos para lectura fácil
      const bankBreakdown = r.resumenEjecutivo?.desgloseBancos 
        ? Object.entries(r.resumenEjecutivo.desgloseBancos).map(
            ([bank, data]: any) => `${bank}: ${this.formatCurrency(data.patrimonioNeto || 0)}`
          )
        : [];

      // RESOLUCIÓN DE NOMBRE: Prioridad Nombre -> Email -> ID
      // Esto soluciona que te salga "Cliente #6"
      const rawClient = r.client || r.user; 
      // Buscar el nombre del cliente por ID en reportsRaw
      let displayName = `${r.clienteId}`;
      const clientReport = reportsRaw.find(rep => rep.clienteId === r.clienteId && (rep.client?.name || rep.user?.name));
      if (clientReport) {
        displayName = clientReport.client?.name || clientReport.user?.name || displayName;
      }

      const resumenText = (r.resumenEjecutivo?.resumen && r.resumenEjecutivo.resumen.length > 5)
        ? r.resumenEjecutivo.resumen
        : 'No hay un resumen narrativo disponible.';

      return {
        id: r.id,
        fechaInforme: r.fechaInforme instanceof Date ? r.fechaInforme.toISOString() : String(r.fechaInforme),
        clienteId: r.clienteId,
        clientName: displayName, 
        resumenText: resumenText,
        kpis: {
          totalPatrimony,
          debt,
          ytdReturn: ytdStr,
          monthlyReturn: r.history?.slice(-1)[0]?.rendimientoMensual ?? 0,
          bankBreakdown
        }
      };
    });

    // Ordenar por fecha (más reciente primero)
    reports.sort((a, b) => new Date(b.fechaInforme).getTime() - new Date(a.fechaInforme).getTime());

    // 3. Generar Métricas Globales (Solo Admin)
    // Esto acelera respuestas a preguntas tipo "¿cómo va la firma?"
    let globalMetrics;
    if (user.role === 'admin' && reports.length > 0) {
      // Usar solo el último reporte por cliente para no duplicar sumas
      const latestPerClient = new Map<number, ReportFact>();
      reports.forEach(r => {
        if (!latestPerClient.has(r.clienteId) || new Date(r.fechaInforme) > new Date(latestPerClient.get(r.clienteId)!.fechaInforme)) {
          latestPerClient.set(r.clienteId, r);
        }
      });

      const uniqueReports = Array.from(latestPerClient.values());
      const totalAUM = uniqueReports.reduce((sum, r) => sum + r.kpis.totalPatrimony, 0);
      const totalDebt = uniqueReports.reduce((sum, r) => sum + r.kpis.debt, 0);
      
      const validReturns = uniqueReports
        .map(r => parseFloat(r.kpis.ytdReturn))
        .filter(n => !isNaN(n));
      const avgReturn = validReturns.length 
        ? (validReturns.reduce((a, b) => a + b, 0) / validReturns.length).toFixed(2) + '%' 
        : '0%';

      globalMetrics = {
        totalAUM,
        totalDebt,
        activeClients: uniqueReports.length,
        avgReturn
      };
    }

    return {
      role: user.role,
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