export function buildControllerTemplate({ className, routeName }) {
  return `import { Controller, Get, HttpStatus } from '@nestjs/common';
import { GenericServerResponse } from '@/common/dto/http/models/server-response.model';

@Controller('${routeName}')
export class ${className}Controller {
  @Get()
  health(): GenericServerResponse {
    return new GenericServerResponse(
      { message: '${className} controller ready' },
      HttpStatus.OK,
    );
  }
}
`;
}

export function buildModuleTemplate({ className, resourceName }) {
  return `import { Module } from '@nestjs/common';
import { ${className}Controller } from './${resourceName}.controller';

@Module({
  controllers: [${className}Controller],
})
export class ${className}Module {}
`;
}

export function buildSpecTemplate({ className, routeName }) {
  return `/* eslint-disable */

import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { ${className}Controller } from '@/api/${routeName}/${routeName}.controller';

describe('${className}Controller (http)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [${className}Controller],
      providers: [],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    if (app) {
      await app.close();
    }
  });

  it('GET /${routeName} returns 200', async () => {
    const response = await request(app.getHttpServer()).get('/${routeName}');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe(200);
  });
});
`;
}

export function buildGenericServerResponseModelTemplate() {
  return `import { HttpStatus } from '@nestjs/common';

export abstract class ServerResponse<T = unknown> {
    status: HttpStatus = HttpStatus.OK;
    meta: Record<string, unknown> = {};
    data: T;
}

export class GenericServerResponse extends ServerResponse {
    data: Record<string, unknown> | object;
    status: HttpStatus = HttpStatus.OK;
    constructor(
        data: Record<string, unknown> | object,
        status: HttpStatus = HttpStatus.OK,
    ) {
        super();
        this.status = status;
        this.data = data;
    }
}
`;
}
