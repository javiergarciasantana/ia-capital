// backend/src/ai-chat/user-facts.service.ts
import { Injectable } from '@nestjs/common';
import { ReportsService } from '../reports/reports.service';

export type ReportKPIs = {
  totalPatrimony: number;
  debt: number;
  ytdReturn: string; // ej. "3.38%"
  monthlyReturn: number;
  bankBreakdown?: string[];
};

export type ReportFact = {
  id: number;
  fechaInforme: string;
  clienteId: number;
  clientName: string; // ✅ MEJORA: Usamos el nombre real para la IA
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
    
    // 1. Obtención de datos según Rol
    // Admin: Trae todo para la "visión global". Cliente: Solo lo suyo.
    if (user.role === 'admin') {
      reportsRaw = await this.reportsService.getReportsBetweenDates(
        new Date('2020-01-01'), 
        new Date()
      );
    } else {
      reportsRaw = await this.reportsService.getReportsForUser(user.id);
    }

    // 2. Mapeo inteligente de datos (Extracción de Hechos)
    const reports: ReportFact[] = reportsRaw.map((r) => {
      // a) Extracción de KPIs numéricos (fallback a snapshot si falta resumen ejecutivo)
      const totalPatrimony = r.resumenEjecutivo?.totalPatrimonio ?? r.snapshot?.patrimonioNeto ?? 0;
      const debt = r.snapshot?.deuda ?? 0;
      
      // b) Formato de Rendimiento (string o calculado del histórico)
      let ytdStr = r.resumenEjecutivo?.rendimientoAnualActual ?? '0%';
      if (typeof r.history?.slice(-1)[0]?.rendimientoYTD === 'number') {
        ytdStr = `${r.history.slice(-1)[0].rendimientoYTD.toFixed(2)}%`;
      }

      // c) Desglose de Bancos (Texto legible para la IA)
      const bankBreakdown = r.resumenEjecutivo?.desgloseBancos 
        ? Object.entries(r.resumenEjecutivo.desgloseBancos).map(
            ([bank, data]: any) => `${bank}: ${this.formatCurrency(data.patrimonioNeto || 0)}`
          )
        : [];

      // d) Resolución de Nombre del Cliente
      // Busca nombre -> email -> ID
      const rawClient = r.client || r.user; 
      const displayName = rawClient 
        ? (rawClient.name || rawClient.email || `Cliente #${r.clienteId}`)
        : `Cliente #${r.clienteId}`;

      // e) Resumen narrativo
      // Si está vacío, ponemos un texto explícito para que la IA sepa que no hay análisis.
      const resumenText = (r.resumenEjecutivo?.resumen && r.resumenEjecutivo.resumen.length > 5)
        ? r.resumenEjecutivo.resumen
        : 'No hay un resumen narrativo o análisis detallado disponible en este informe.';

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

    // Ordenar: Más recientes primero
    reports.sort((a, b) => new Date(b.fechaInforme).getTime() - new Date(a.fechaInforme).getTime());

    // 3. Cálculo de Métricas Globales (Solo para Admin)
    let globalMetrics;
    if (user.role === 'admin' && reports.length > 0) {
      // Filtrar último reporte por cliente para no duplicar AUM en la suma global
      const latestPerClient = new Map<number, ReportFact>();
      reports.forEach(r => {
        if (!latestPerClient.has(r.clienteId) || new Date(r.fechaInforme) > new Date(latestPerClient.get(r.clienteId)!.fechaInforme)) {
          latestPerClient.set(r.clienteId, r);
        }
      });

      const uniqueReports = Array.from(latestPerClient.values());
      const totalAUM = uniqueReports.reduce((sum, r) => sum + r.kpis.totalPatrimony, 0);
      const totalDebt = uniqueReports.reduce((sum, r) => sum + r.kpis.debt, 0);
      
      // Promedio simple de rendimiento YTD
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

  // Convierte los datos estructurados en texto plano para el Prompt del LLM
  factsToPromptText(f: Facts): string {
    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { year: 'numeric', month: 'long' });
    const lines: string[] = [];

    // --- SECCIÓN 1: CONTEXTO GLOBAL (Para responder "qué me dices de todos los reports") ---
    lines.push(`ROL USUARIO: ${f.role.toUpperCase()}`);
    
    if (f.globalMetrics) {
      lines.push(`\n=== RESUMEN GENERAL DE LA FIRMA (Estadísticas Globales) ===`);
      lines.push(`• AUM Total (Activos bajo gestión): ${this.formatCurrency(f.globalMetrics.totalAUM)}`);
      lines.push(`• Deuda Total Agregada: ${this.formatCurrency(f.globalMetrics.totalDebt)}`);
      lines.push(`• Clientes Activos con informes: ${f.globalMetrics.activeClients}`);
      lines.push(`• Rendimiento Promedio YTD Global: ${f.globalMetrics.avgReturn}`);
      lines.push(`===========================================================\n`);
    }

    // --- SECCIÓN 2: DETALLE INDIVIDUAL (Para responder sobre clientes específicos) ---
    lines.push(`=== INFORMES INDIVIDUALES POR CLIENTE ===`);
    
    if (f.role === 'admin') {
      // Agrupar reportes por NOMBRE DE CLIENTE
      const byClient = f.reports.reduce((acc, r) => {
        const key = r.clientName; 
        acc[key] = acc[key] || [];
        acc[key].push(r);
        return acc;
      }, {} as Record<string, ReportFact[]>);

      Object.entries(byClient).forEach(([clientName, clientReports]) => {
        lines.push(`\nCLIENTE: ${clientName}`);
        // Limitamos a los 3 últimos informes para no saturar el prompt
        clientReports.slice(0, 3).forEach(r => lines.push(this.formatSingleReport(r, fmtDate))); 
      });
    } else {
      // Si es usuario normal, mostramos su historial reciente (últimos 5)
      f.reports.slice(0, 5).forEach(r => lines.push(this.formatSingleReport(r, fmtDate)));
    }

    return lines.join('\n');
  }

  private formatSingleReport(r: ReportFact, dateFmt: (d: string) => string): string {
    let txt = `   - [Informe ${dateFmt(r.fechaInforme)}]`;
    txt += ` Patrimonio: ${this.formatCurrency(r.kpis.totalPatrimony)} |`;
    txt += ` Deuda: ${this.formatCurrency(r.kpis.debt)} |`;
    txt += ` Retorno YTD: ${r.kpis.ytdReturn}`;
    
    if (r.kpis.bankBreakdown && r.kpis.bankBreakdown.length > 0) {
      txt += `\n     Bancos involucrados: ${r.kpis.bankBreakdown.join(', ')}`;
    }
    
    // Aquí se inyecta el texto del resumen o el aviso de "No hay resumen narrativo"
    if (r.resumenText) { 
      txt += `\n     Resumen/Notas: "${r.resumenText}"`;
    }
    return txt;
  }
}