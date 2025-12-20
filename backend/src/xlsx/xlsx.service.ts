
import * as XLSX from 'xlsx';

export class XlsxService
 {
  private workbook: XLSX.WorkBook;
  private sheetTotales: XLSX.WorkSheet;
  private sheetDist: XLSX.WorkSheet;
  private sheetDistChild: XLSX.WorkSheet;
  private rowsTotales: any[][];
  private rowsDist: any[][];
  private rowsDistChild: any[][];
  private walletFilter = ['RV USA','RV EUR','RV EM','RF IG','RF HY','Preferentes','Estructurados','Alternativo','Activos Digitales','Liquidez','Total'];


  constructor(buffer: Buffer) {
    this.workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true });
    this.sheetTotales = this.workbook.Sheets['Totales'];
    this.sheetDist = this.workbook.Sheets['Distribución'];
    this.sheetDistChild = this.workbook.Sheets['Distribución Hijos'];
    this.rowsTotales = XLSX.utils.sheet_to_json(this.sheetTotales, { header: 1, defval: null });
    this.rowsDist = this.sheetDist
      ? XLSX.utils.sheet_to_json(this.sheetDist, { header: 1, defval: null })
      : [];
    this.rowsDistChild = this.sheetDistChild
      ? XLSX.utils.sheet_to_json(this.sheetDistChild, { header: 1, defval: null })
      : [];
  }

  private static cleanNum(val: any): number {
    if (typeof val === 'number') return val;
    if (!val || val === 'NaN') return 0;
    return parseFloat(val.toString().replace(/[$.]/g, '').replace(',', '.'));
  }

  extractTotals(): any {
    const totalRow = this.rowsTotales.find(r => { 
      if (!r) return false; 
      return r.some(cell => { 
        if (cell == null) return false; 
        return cell.toString().trim().toLowerCase() === 'total'; 
      }); 
    });
    let totalResult = {
      custodia: 0,
      fueraCustodia: 0,
      deuda: 0,
      patrimonioNeto: 0,
    };
    if (totalRow) {
      totalResult = {
        custodia: XlsxService.cleanNum(totalRow[1]),    // Columna D 
        fueraCustodia: XlsxService.cleanNum(totalRow[2]), // Columna E 
        deuda: XlsxService.cleanNum(totalRow[3]),         // Columna F 
        patrimonioNeto: XlsxService.cleanNum(totalRow[4]) // Columna G 
      };
    }
    return totalResult;
  }

  extractBankInfo(): Record<string, any> {
    const bancoRowIdx = this.rowsTotales.findIndex(r =>
      r && r.some(cell => cell && cell.toString().toLowerCase().includes('banco'))
    );

    // Encuentra el índice de la fila que contiene "total" después de bancoRowIdx
    const totalRowIdx = this.rowsTotales.findIndex((r, idx) =>
      idx > bancoRowIdx && r && r.some(cell => cell && cell.toString().toLowerCase().includes('total'))
    );

    // Extrae la matriz de filas entre bancoRowIdx y totalRowIdx (excluyendo ambas)
    let bancosMatrix: any[][] = [];
    if (bancoRowIdx !== -1 && totalRowIdx !== -1 && totalRowIdx > bancoRowIdx) {
      bancosMatrix = this.rowsTotales.slice(bancoRowIdx + 1, totalRowIdx);
    }
    const bancosHash: Record<string, any> = {};
    for (const banco of bancosMatrix) {
      const bancoName = banco[0] ? banco[0].toString().trim() : 'Desconocido';
      let bancoStatus = {
        custodia: XlsxService.cleanNum(banco[1]),    // Columna D 
        fueraCustodia: XlsxService.cleanNum(banco[2]), // Columna E 
        deuda: XlsxService.cleanNum(banco[3]),         // Columna F 
        patrimonioNeto: XlsxService.cleanNum(banco[4]) // Columna G 
      }
      bancosHash[bancoName] = bancoStatus;
    }
    return bancosHash;
  }

  extractMonthlyHistory(): any {
    // EXTRACCIÓN DE HISTÓRICO (Columnas K a N -> Indices 10 a 13) ---
    return this.rowsTotales
      .filter(r => 
        r && 
        r[8] && 
        (r[8] instanceof Date || r[8].toString().match(/^\d{4}/)) &&
        XlsxService.cleanNum(r[9]) !== 0
      )
      .map(r => ({
        fecha: r[8],
        valorNeto: XlsxService.cleanNum(r[9]),           // Columna L 
        rendimientoMensual: XlsxService.cleanNum(r[10]) * 100, // Columna M 
        rendimientoYTD: XlsxService.cleanNum(r[11]) * 100      // Columna N 
      }));
  }

  extractAssesAllocation(isChild: boolean = false): any {
    // EXTRACCIÓN DE DISTRIBUCION DE ASSETS (Columnas J a L -> Indices 7 a 9) --
    const targetSheet = isChild ? this.rowsDistChild : this.rowsDist;
    return targetSheet
      .filter(r => r && this.walletFilter.includes(r[7]))
      .map(r => ({
        categoria: r[7], // Columna J
        valor: XlsxService.cleanNum(r[8]), // Columna K
        porcentaje: XlsxService.cleanNum(r[9]) * 100 // Columna L
      }));
  }

    /**
   * Finds a table where the first row contains all walletFilter elements, then extracts asset allocation info from that table.
   * Returns an array of objects with categoria, valor, porcentaje.
   */
  extractAssesAllocationFromTable(isChild: boolean = false): any {
    const targetSheet = isChild ? this.rowsDistChild : this.rowsDist;
    if (!targetSheet || targetSheet.length === 0) return [];

    // 1. Encontrar el punto de inicio buscando "TOTAL CARTERA"
    // En tus archivos, esta tabla suele estar en la columna J o L (índice 9 o 11) 
    let startRowIdx = -1;
    let categoryColIdx = -1;

    for (let i = 0; i < targetSheet.length; i++) {
        const row = targetSheet[i];
        if (!row) continue;
        
        // Buscamos la celda que contiene "TOTAL CARTERA" para fijar las coordenadas [cite: 109]
        const colIdx = row.findIndex(cell => 
            cell && cell.toString().toUpperCase().includes('TOTAL CARTERA')
        );

        if (colIdx !== -1) {
            startRowIdx = i;
            categoryColIdx = colIdx; 
            break;
        }
    }

    if (startRowIdx === -1) return [];

    const result: { categoria: string; valor: number; porcentaje: number }[] = [];
    const tableRows = targetSheet.slice(startRowIdx + 1);

    // 2. Extraer los datos comparando con walletFilter
    // walletFilter debe contener: ["RV USA", "RV EUR", "RV EM", "RF IG", "RF HY", "Preferentes", "Estructurados", "Alternativo", "Activos Digitales", "Liquidez"] [cite: 5, 22, 97]
    for (const filter of this.walletFilter) {
        // Buscamos en la misma columna donde encontramos el título
        const row = tableRows.find(r => 
            r && r[categoryColIdx] && 
            r[categoryColIdx].toString().trim().toLowerCase() === filter.toLowerCase()
        );

        if (row) {
            result.push({
                categoria: filter,
                // En tus archivos, el valor está justo a la derecha (colIdx + 1) y el % en (colIdx + 2) 
                valor: XlsxService.cleanNum(row[categoryColIdx + 1]),
                porcentaje: XlsxService.cleanNum(row[categoryColIdx + 2]) * 100
            });
        }
    }

    return result;
  }
}