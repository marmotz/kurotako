import type { INestApplication } from '@nestjs/common';
import { Test, type TestingModule } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { configureApp } from './../src/setup';

describe('TasksController (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  it('GET /tasks returns an array', () => {
    return request(app.getHttpServer())
      .get('/tasks')
      .expect(200)
      .expect((res) => {
        expect(Array.isArray(res.body)).toBe(true);
      });
  });

  it('POST /tasks rejects a body missing the required title', () => {
    return request(app.getHttpServer())
      .post('/tasks')
      .send({ projectId: 'p1' })
      .expect(400);
  });

  it('POST /tasks creates a task from a valid body', () => {
    return request(app.getHttpServer())
      .post('/tasks')
      .send({ title: 'ship it', projectId: 'p1' })
      .expect(201)
      .expect((res) => {
        expect(res.body.title).toBe('ship it');
        expect(res.body.project.id).toBe('p1');
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
