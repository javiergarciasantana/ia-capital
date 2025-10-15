export type ProfitItem = {
  label: string;
  amount: number;          // importe numérico
  currency: 'EUR' | 'USD' | string;
  source?: string;         // banco / procedencia
  period?: { month?: string; year?: number };
  confidence?: number;     // 0..1
};

export type ExtractionResult = {
  documentId: number;
  summary?: string;
  profits: ProfitItem[];
  rawTextChars?: number;
  elapsedMs?: number;
};
