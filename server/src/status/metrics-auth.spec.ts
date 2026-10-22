import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { StatusController, StatusAliasController } from './status.controller';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';

describe.each(['/status', '/metrics'])(
  'metrics authentication over HTTP: %s',
  (path) => {
    let app: INestApplication;
    const original = process.env.KUBERO_METRICS_TOKEN;

    beforeAll(async () => {
      const module = await Test.createTestingModule({
        imports: [
          PrometheusModule.register({
            path: '/metrics',
            controller: StatusController,
            defaultMetrics: { enabled: false },
          }),
        ],
        controllers: [StatusAliasController],
      }).compile();
      app = module.createNestApplication();
      await app.init();
    });
    beforeEach(() => {
      process.env.KUBERO_METRICS_TOKEN = 'test-scrape-credential';
    });
    afterAll(async () => {
      if (original === undefined) delete process.env.KUBERO_METRICS_TOKEN;
      else process.env.KUBERO_METRICS_TOKEN = original;
      await app.close();
    });

    it.each([undefined, '', '203.0.113.1'])(
      'rejects anonymous access regardless of forwarded header %s',
      async (header) => {
        const req = request(app.getHttpServer()).get(path);
        if (header !== undefined) req.set('X-Forwarded-For', header);
        await req.expect(401);
      },
    );
    it.each([
      'Bearer wrong',
      'Basic test-scrape-credential',
      'Bearer test-scrape-credential extra',
    ])('rejects invalid credentials %s', async (auth) => {
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', auth)
        .expect(401);
    });
    it('fails closed when the scrape credential is not configured', async () => {
      delete process.env.KUBERO_METRICS_TOKEN;
      await request(app.getHttpServer())
        .get(path)
        .set('Authorization', 'Bearer test-scrape-credential')
        .expect(401);
    });
    it.each([false, true])(
      'allows an authenticated scraper behind a proxy: %s',
      async (forwarded) => {
        const req = request(app.getHttpServer())
          .get(path)
          .set('Authorization', 'Bearer test-scrape-credential');
        if (forwarded) req.set('X-Forwarded-For', '203.0.113.1');
        await req.expect(200).expect('Content-Type', /text\/plain/);
      },
    );
  },
);
