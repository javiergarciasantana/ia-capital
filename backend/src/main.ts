// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';

function parseOrigins(): string[] {
  // Admite:
  //  - FRONTEND_ORIGIN="https://app.com,https://admin.app.com"
  //  - CORS_ORIGINS="https://app.com,https://admin.app.com"
  //  - CORS_ORIGIN_DEV / CORS_ORIGIN_PROD
  const list = [
    (process.env.CORS_ORIGIN_DEV || 'http://localhost:3000').trim(),
    (process.env.CORS_ORIGIN_PROD || '').trim(),
    ...(process.env.FRONTEND_ORIGIN || '')
      .split(',')
      .map(s => s.trim()),
    ...(process.env.CORS_ORIGINS || '')
      .split(',')
      .map(s => s.trim()),
  ].filter(Boolean);
  // dedupe
  return Array.from(new Set(list));
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  const port = parseInt(process.env.PORT || '5000', 10);
  const allowedOrigins = parseOrigins();

  // Archivos estáticos (PDFs)
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  // CORS (una sola vez)
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl/Postman/healthchecks
      const ok = allowedOrigins.includes(origin);
      cb(ok ? null : new Error(`CORS blocked for origin: ${origin}`), ok);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Validación global
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 API escuchando en :${port}`);
  console.log(`CORS permitido: ${allowedOrigins.join(', ') || '(none)'}`);
}
bootstrap();
