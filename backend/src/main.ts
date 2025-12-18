// backend/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';

function parseOrigins(): string[] {
  const list = [
    (process.env.CORS_ORIGIN_DEV || 'http://localhost:3000').trim(),
    (process.env.CORS_ORIGIN_PROD || '').trim(),
    ...(process.env.FRONTEND_ORIGIN || '').split(',').map(s => s.trim()),
    ...(process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()),
  ].filter(Boolean);
  return Array.from(new Set(list));
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bufferLogs: true,
  });

  // Prefijo global /api
  app.setGlobalPrefix('api');

  const port = parseInt(process.env.PORT || '5000', 10);

  // Origen del frontend en producción (tu dominio en Hostinger)
  const FRONTEND_PROD =
    process.env.FRONTEND_PROD_ORIGIN ||
    'https://ia-capital-frontend-iacapital.fn24pb.easypanel.host';

  const allowedOrigins = parseOrigins();
  if (!allowedOrigins.includes(FRONTEND_PROD)) allowedOrigins.push(FRONTEND_PROD);

  // Archivos estáticos (PDFs)
  app.useStaticAssets(join(process.cwd(), 'uploads'), { prefix: '/uploads/' });

  // CORS (incluye preflight correcto)
  app.enableCors({
    origin: (origin, cb) => cb(null, true),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    maxAge: 86400,
    preflightContinue: false,
    optionsSuccessStatus: 204,
  });

  // ⛔️ IMPORTANTE: NO usar server.options('*', …) (rompe path-to-regexp)
  // En su lugar, si quieres forzar respuesta a OPTIONS, usa un middleware sin ruta:
  app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
      const origin = req.get('origin');
      if (origin && allowedOrigins.includes(origin)) {
        res.header('Access-Control-Allow-Origin', origin);
        res.header('Vary', 'Origin');
        res.header('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Access-Control-Max-Age', '86400');
      }
      return res.sendStatus(204);
    }
    next();
  });

  // Validación global
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  await app.listen(port, '0.0.0.0');
  console.log(`🚀 API escuchando en :${port}`);
  console.log(`CORS permitido: ${allowedOrigins.join(', ')}`);
}
// setInterval(() => {
//   console.log('Mensaje de log cada 5 segundos');
// }, 5000);
bootstrap();