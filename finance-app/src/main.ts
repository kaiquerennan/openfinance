import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const config = app.get(ConfigService);
  const port = config.get<number>('PORT', 3000);

  // Libera o frontend (Next.js). Em dev, aceita localhost e IPs de rede
  // privada (acesso pelo celular na mesma rede).
  const corsOrigins = config.get<string>('CORS_ORIGINS');
  app.enableCors({
    origin: corsOrigins
      ? corsOrigins.split(',').map((o) => o.trim())
      : [
          /^http:\/\/localhost:\d+$/,
          /^http:\/\/127\.\d+\.\d+\.\d+:\d+$/,
          /^http:\/\/192\.168\.\d+\.\d+:\d+$/,
          /^http:\/\/10\.\d+\.\d+\.\d+:\d+$/,
          /^http:\/\/172\.(1[6-9]|2\d|3[01])\.\d+\.\d+:\d+$/,
        ],
  });

  await app.listen(port);
  Logger.log(`Finance App rodando em http://localhost:${port}`, 'Bootstrap');
}

bootstrap();
