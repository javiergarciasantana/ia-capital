import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { ValidationPipe } from '@nestjs/common';

function parseOrigins(): string[] {
  // Admite: CORS_ORIGINS="https://app.com,https://admin.app.com"
  // o FRONTEND_ORIGIN="https://app.com"
  const fromList =
    (process.env.CORS_ORIGINS || '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);

  const single = (process.env.FRONTEND_ORIGIN || '').trim();

  // Soporte a tus variables actuales:
  const dev = process.env.CORS_ORIGIN_DEV || 'http://localhost:3000';
  const prod = (process.env.CORS_ORIGIN_PROD || '').trim();

  return [dev, prod, single, ...fromList]
    .filter((v, i, a) => v && a.indexOf(v) === i);
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  const port = parseInt(process.env.PORT || '5000', 10);

  const allowedOrigins = parseOrigins();

  const allowed = (process.env.FRONTEND_ORIGIN || 'http://localhost:3000')
    .split(',').map(s => s.trim());
  app.enableCors({ origin: allowed, credentials: true });
  await app.listen(port, '0.0.0.0');

  // CORS seguro para lista de orígenes y útil para Postman/healthchecks (origin null)
  app.enableCors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // curl, Postman, SSR interno
      const ok = allowedOrigins.includes(origin);
      cb(ok ? null : new Error(`CORS blocked for origin: ${origin}`), ok);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Archivos estáticos (Render: monta un Disk en /app/uploads)
  app.useStaticAssets(join(process.cwd(), 'uploads'), {
    prefix: '/uploads/',
  });

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));

  await app.listen(port, '0.0.0.0');
}
bootstrap();
