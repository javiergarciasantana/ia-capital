import {
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
  Body,
  Get,
  Param,
  Delete,
  Patch,
  Req,
  UseGuards,
  ForbiddenException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

type Viewer = { id: number; role: 'client' | 'admin' | 'superadmin' };

@Controller('documents')
@UseGuards(JwtAuthGuard)
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) { }

  // Solo admin/superadmin deben poder subir
  @Post('upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './uploads',
        filename: (req, file, cb) => {
          const unique = Date.now() + '-' + Math.round(Math.random() * 1e9);
          cb(null, unique + extname(file.originalname));
        },
      }),
    }),
  )
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() body: any,
    @Req() req: any,
  ) {
    const viewer: Viewer = req.user;
    if (viewer.role === 'client') {
      throw new ForbiddenException('No autorizado para subir documentos');
    }
    return this.documentsService.saveFile(file, body);
  }

  // Clientes: solo ven los suyos + los generales; admin/superadmin ven todos
  @Get()
  async listFiles(@Req() req: any) {
    const viewer: Viewer = req.user;
    return this.documentsService.findAllFor(viewer);
  }

  // Reprocesar un documento (útil en pruebas) — solo admin/superadmin
  @Post(':id/reprocess')
  async reprocess(@Param('id') id: string, @Req() req: any) {
    const viewer: Viewer = req.user;
    if (viewer.role === 'client') {
      throw new ForbiddenException('No autorizado para reprocesar');
    }
    return this.documentsService.reprocess(Number(id));
  }

  // Editar metadatos — solo admin/superadmin
  @Patch(':id')
  async updateDoc(
    @Param('id') id: string,
    @Body() body: Partial<CreateDocumentDto>,
    @Req() req: any,
  ) {
    const viewer: Viewer = req.user;
    if (viewer.role === 'client') {
      throw new ForbiddenException('No autorizado para editar');
    }
    return this.documentsService.update(Number(id), body);
  }

  // Eliminar — solo admin/superadmin
  @Delete(':id')
  async deleteDoc(@Param('id') id: string, @Req() req: any) {
    const viewer: Viewer = req.user;
    if (viewer.role === 'client') {
      throw new ForbiddenException('No autorizado para eliminar');
    }
    return this.documentsService.delete(Number(id));
  }
}
