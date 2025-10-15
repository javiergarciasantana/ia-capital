export class CreateDocumentDto {
  type?: string;
  date?: string;
  title?: string;
  description?: string;
  month?: string;
  year?: string;
  bank?: string;
  userId?: number | null;
}
