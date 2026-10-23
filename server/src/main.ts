import { NestFactory } from '@nestjs/core';
import { Logger } from '@nestjs/common';
import { CustomConsoleLogger } from './logger/logger';
import { createValidationPipe } from './validation';
import { LogLevel } from '@nestjs/common/services/logger.service';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { DatabaseService } from './database/database.service';

import helmet from 'helmet';

import * as dotenv from 'dotenv';
dotenv.config();

async function bootstrap() {
  const logLevels = process.env.LOGLEVEL?.split(',') ?? [
    'log',
    'fatal',
    'error',
    'warn',
    'debug',
    'verbose',
  ];
  Logger.log(`Log levels: ${logLevels.join(',')}`, 'Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: new CustomConsoleLogger({
      prefix: 'Kubero',
      logLevels: logLevels as LogLevel[],
    }),
    // el cliente se sirve desde este mismo servidor (ServeStaticModule), así
    // que en producción no hace falta aceptar cualquier origen; en
    // desarrollo el cliente corre aparte (Vite, otro puerto) y sí lo necesita.
    cors: process.env.NODE_ENV !== 'production',
    // los webhooks se firman sobre el cuerpo tal cual llegó
    rawBody: true,
  });
  app.useGlobalPipes(createValidationPipe());

  await DatabaseService.DBinit();

  app.use(
    helmet({
      // Borrador para probar contra la UI real antes de dejarlo fijo (ver
      // issue #205): el cliente se sirve desde este mismo origen, Vuetify
      // mete estilos inline, y las fuentes quedan empaquetadas (unplugin-fonts
      // las descarga en build time, no se piden a Google en el navegador).
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          // Vite/Vuetify inyectan varios scripts inline distintos según la
          // ruta (polyfills, precarga de chunks); pinearlos uno por uno por
          // hash es frágil (basta con no probar una página para que quede
          // rota en producción sin que nadie se entere). Quedan con
          // 'unsafe-inline': el script-src de abajo igual sigue exigiendo
          // 'self' para cualquier <script src="..."> externo, que es donde
          // está el riesgo real de inyectar código ajeno.
          scriptSrcElem: ["'self'", "'unsafe-inline'"],
          scriptSrcAttr: [
            "'unsafe-hashes'",
            "'sha256-F1noxsLOnJhyRSgc0zu5JgzoLjG2BBMaXaSG24k2mRM='",
          ],
          styleSrc: ["'self'", "'unsafe-inline'"],
          // los iconos de los templates de servicios son URLs externas
          // definidas por cada template (ej. devicon en GitHub), y los
          // avatares de PR de GitHub también son externos — no hay una lista
          // fija de hosts posible, así que queda abierto solo para imágenes
          // (no ejecutan código, el riesgo real está en script/connect-src).
          imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
          // la página de Templates trae el catálogo directo desde el
          // navegador (configurable en config.yaml, templates.catalogs); si
          // se agrega un catálogo en otro host hay que sumarlo acá también.
          connectSrc: [
            "'self'",
            'ws:',
            'wss:',
            'https://raw.githubusercontent.com',
          ],
          fontSrc: ["'self'", 'data:'],
          objectSrc: ["'none'"],
          frameAncestors: ["'self'"],
          formAction: ["'self'"],
        },
      },
      crossOriginEmbedderPolicy: { policy: 'require-corp' },
      strictTransportSecurity: { maxAge: 63072000, includeSubDomains: true },
      crossOriginOpenerPolicy: { policy: 'same-origin' },
    }),
  );

  // la documentación expone la forma completa de la API; no hace falta
  // montarla en producción, solo sirve durante el desarrollo.
  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('Kubero')
      .setDescription(
        'Kubero is a web-based tool deploy applications on a Kubernetes clusters. It provides a simple and intuitive interface to manage your clusters, applications, and pipelines.',
      )
      .setVersion('3.0')
      .addServer('/', 'Local (default)')
      .addSecurity('bearerAuth', {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      })
      .addSecurity('oauth2', {
        type: 'oauth2',
        flows: {
          implicit: {
            authorizationUrl: 'http://example.org/api/oauth/dialog',
            scopes: {
              'write:example': 'modify pets in your example',
              'read:example': 'read your example',
            },
          },
        },
      })
      .build();
    const documentFactory = () => SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, documentFactory, {
      customSiteTitle: 'Kubero API Documentation',
      //customfavIcon: '/favicon.ico',
      swaggerOptions: {
        tagsSorter: 'alpha',
        persistAuthorization: true,
        displayRequestDuration: true,
        //docExpansion: 'none', // 'none' to collapse all sections by default
      },
    });
  }

  await app.listen(process.env.PORT ?? 2000); // Use port 2000 for compatibility with kubero v2

  Logger.log(
    `⚡️[server]: Server is running at: ${await app.getUrl()}`,
    'Bootstrap',
  );

  //app.enableShutdownHooks();
}
void bootstrap();
