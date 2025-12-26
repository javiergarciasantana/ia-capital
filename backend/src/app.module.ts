// backend/src/app.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { XlsxModule } from './xlsx/xlsx.module'
import { ReportsModule } from './reports/reports.module';
import { PrivateAiModule } from './private-ai/private-ai.module';
import { AiChatModule } from './ai-chat/ai-chat.module';

@Module({
  imports: [
    // Carga .env y expone process.env vía ConfigService (global)
    ConfigModule.forRoot({ isGlobal: true }),

    // DB config segura y flexible para prod/dev
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => {
        // Debug: print TYPEORM_SYNC value
        // console.log('TYPEORM_SYNC from .env:', cfg.get('TYPEORM_SYNC'));
        // const isProd = (cfg.get('NODE_ENV') || '').toLowerCase() === 'production';
        const isProd = true;

        // Si DB está fuera (Render/AWS/etc.) probablemente requiere SSL.
        // En Postgres local de Easypanel normalmente => false.
        // const useSsl =
        //   (cfg.get('DB_SSL') || '').toString().toLowerCase() === 'true'
        //     ? { rejectUnauthorized: false }
        //     : false;
        const useSsl = false;
        // Por defecto: en prod no sincroniza; en dev sí.
        // Always synchronize schema (for development only, not recommended for production)
        const synchronize = true;
        // const synchronize =
        //   (cfg.get('TYPEORM_SYNC') ?? (isProd ? 'false' : 'true')).toString() === 'true';

        // Logging útil en dev; en prod suele ir a false
        const logging =
          (cfg.get('TYPEORM_LOGGING') ?? (isProd ? 'false' : 'true')).toString() === 'true';

        return {
          type: 'postgres',
          host: cfg.get<string>('DB_HOST'),
          port: parseInt(cfg.get<string>('DB_PORT') ?? '5432', 10),
          username: cfg.get<string>('DB_USER'),
          password: cfg.get<string>('DB_PASSWORD'),
          database: cfg.get<string>('DB_NAME'),

          autoLoadEntities: true,
          synchronize,
          logging,
          ssl: useSsl,

          // Mantiene la conexión viva entre reinicios calientes (opcional)
          keepConnectionAlive: true,
        };
      },
    }),

    AuthModule,
    UsersModule,
    XlsxModule,
    ReportsModule,
    PrivateAiModule,
    AiChatModule,
  ],
})
export class AppModule { }
