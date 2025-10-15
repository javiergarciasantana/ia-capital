import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const allowedOrigins = [
    process.env.CORS_ORIGIN_DEV ?? 'http://localhost:3000',
    process.env.CORS_ORIGIN_PROD ?? undefined,
  ].filter((v): v is string => typeof v === 'string' && v.length > 0);

  app.enableCors({
    origin: allowedOrigins,   // <- ahora es string[]
    credentials: true,
  });

  // ✅ Servir archivos estáticos desde ./uploads
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));


  await app.listen(5000, '0.0.0.0');
}
bootstrap();
