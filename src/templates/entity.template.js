export function buildDomainEntityInterfaceTemplate({ entityClassName }) {
  return `export interface I${entityClassName}Entity {
    id: string;
    createdAt: Date;
    updatedAt: Date;
}
`;
}

export function buildDomainRepositoryInterfaceTemplate({
  contextName,
  entityName,
  entityClassName,
  methods,
  importLines,
}) {
  return `import { I${entityClassName}Entity } from '@/domain/${contextName}/interfaces/entities/${entityName}.entity';
${importLines && importLines.length > 0 ? `${importLines.join('\n')}\n` : ''}

export abstract class I${entityClassName}Repository {
${methods}
}
`;
}

export function buildTypeOrmPersistenceEntityTemplate({
  contextName,
  entityName,
  entityClassName,
  entityTableName,
}) {
  return `import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { I${entityClassName}Entity } from '@/domain/${contextName}/interfaces/entities/${entityName}.entity';

@Entity('${entityTableName}')
export class ${entityClassName}Entity implements I${entityClassName}Entity {
    @PrimaryGeneratedColumn('uuid')
    id: string;

    @CreateDateColumn({ type: 'timestamp' })
    createdAt: Date;

    @UpdateDateColumn({ type: 'timestamp' })
    updatedAt: Date;

    @Column({ type: 'jsonb', nullable: true })
    payload?: Record<string, unknown>;
}
`;
}

export function buildTypeOrmRepositoryImplTemplate({
  contextName,
  entityName,
  entityClassName,
  methods,
}) {
  return `import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindManyOptions, Repository } from 'typeorm';
import { I${entityClassName}Repository } from '@/domain/${contextName}/repositories/${entityName}.repository';
import { I${entityClassName}Entity } from '@/domain/${contextName}/interfaces/entities/${entityName}.entity';
import { ${entityClassName}Entity } from '@/infrastructure/persistence/${contextName}/entities/${entityName}.entity';

@Injectable()
export class ${entityClassName}RepositoryImpl extends I${entityClassName}Repository {
    constructor(
        @InjectRepository(${entityClassName}Entity)
        private readonly repository: Repository<${entityClassName}Entity>,
    ) {
        super();
    }

${methods}
}
`;
}

export function buildMongoosePersistenceSchemaTemplate({
  contextName,
  entityName,
  entityClassName,
}) {
  return `import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { I${entityClassName}Entity } from '@/domain/${contextName}/interfaces/entities/${entityName}.entity';

export type ${entityClassName}Document = HydratedDocument<${entityClassName}Schema>;

@Schema({ collection: '${entityName}', timestamps: true })
export class ${entityClassName}Schema implements I${entityClassName}Entity {
    id: string;

    @Prop({ type: Object, default: {} })
    payload?: Record<string, unknown>;

    createdAt: Date;
    updatedAt: Date;
}

export const ${entityClassName}MongooseSchema =
    SchemaFactory.createForClass(${entityClassName}Schema);
`;
}

export function buildMongooseRepositoryImplTemplate({
  contextName,
  entityName,
  entityClassName,
  methods,
}) {
  return `import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, QueryOptions } from 'mongoose';
import { I${entityClassName}Repository } from '@/domain/${contextName}/repositories/${entityName}.repository';
import { I${entityClassName}Entity } from '@/domain/${contextName}/interfaces/entities/${entityName}.entity';
import { ${entityClassName}Schema, ${entityClassName}Document } from '@/infrastructure/persistence/${contextName}/schemas/${entityName}.schema';

@Injectable()
export class ${entityClassName}RepositoryImpl extends I${entityClassName}Repository {
    constructor(
        @InjectModel(${entityClassName}Schema.name)
        private readonly model: Model<${entityClassName}Document>,
    ) {
        super();
    }

${methods}
}
`;
}

export function buildEntityCrudControllerTemplate({
  contextName,
  entityName,
  entityClassName,
  routeName,
  listUseCaseClassName,
  countUseCaseClassName,
  listUseCaseFileName,
  countUseCaseFileName,
  extraImports,
  listInputPayloadLine,
  countInputPayloadLine,
}) {
  const pascalEntity = entityClassName;
  const createUseCase = `Create${pascalEntity}UseCase`;
  const findByIdUseCase = `Find${pascalEntity}ByIdUseCase`;
  const updateByIdUseCase = `Update${pascalEntity}ByIdUseCase`;
  const deleteByIdUseCase = `Delete${pascalEntity}ByIdUseCase`;
  const listUseCase = listUseCaseClassName;
  const countUseCase = countUseCaseClassName;

  const createInput = `Create${pascalEntity}UseCaseInput`;
  const findByIdInput = `Find${pascalEntity}ByIdUseCaseInput`;
  const updateByIdInput = `Update${pascalEntity}ByIdUseCaseInput`;
  const deleteByIdInput = `Delete${pascalEntity}ByIdUseCaseInput`;
  const listInput = `${listUseCaseClassName}Input`;
  const countInput = `${countUseCaseClassName}Input`;

  return `import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { from, map, Observable } from 'rxjs';
import { GenericServerResponse } from '@/common/dto/http/models/server-response.model';
${extraImports && extraImports.length > 0 ? `${extraImports.join('\n')}\n` : ''}import { I${entityClassName}Entity } from '@/domain/${contextName}/interfaces/entities/${entityName}.entity';
import { ${createUseCase} } from '@/domain/${contextName}/use-cases/create-${entityName}.usecase';
import { ${findByIdUseCase} } from '@/domain/${contextName}/use-cases/find-${entityName}-by-id.usecase';
import { ${updateByIdUseCase} } from '@/domain/${contextName}/use-cases/update-${entityName}-by-id.usecase';
import { ${deleteByIdUseCase} } from '@/domain/${contextName}/use-cases/delete-${entityName}-by-id.usecase';
import { ${listUseCase} } from '@/domain/${contextName}/use-cases/${listUseCaseFileName}.usecase';
import { ${countUseCase} } from '@/domain/${contextName}/use-cases/${countUseCaseFileName}.usecase';
import { ${createInput} } from '@/application/${contextName}/interfaces/inputs/create-${entityName}.input';
import { ${findByIdInput} } from '@/application/${contextName}/interfaces/inputs/find-${entityName}-by-id.input';
import { ${updateByIdInput} } from '@/application/${contextName}/interfaces/inputs/update-${entityName}-by-id.input';
import { ${deleteByIdInput} } from '@/application/${contextName}/interfaces/inputs/delete-${entityName}-by-id.input';
import { ${listInput} } from '@/application/${contextName}/interfaces/inputs/${listUseCaseFileName}.input';
import { ${countInput} } from '@/application/${contextName}/interfaces/inputs/${countUseCaseFileName}.input';

@Controller('${routeName}')
export class ${pascalEntity}Controller {
    constructor(
        private readonly createUseCase: ${createUseCase},
        private readonly findByIdUseCase: ${findByIdUseCase},
        private readonly updateByIdUseCase: ${updateByIdUseCase},
        private readonly deleteByIdUseCase: ${deleteByIdUseCase},
        private readonly listUseCase: ${listUseCase},
        private readonly countUseCase: ${countUseCase},
    ) {}

    private toResponse<T extends Record<string, unknown> | object>(
        value: Promise<T> | Observable<T>,
        status: HttpStatus,
    ): Observable<GenericServerResponse> {
        return from(value).pipe(
            map((result) => new GenericServerResponse(result, status)),
        );
    }

    @Post()
    @HttpCode(HttpStatus.CREATED)
    create(
        @Body() payload: Partial<I${entityClassName}Entity>,
    ): Observable<GenericServerResponse> {
        const input = new ${createInput}({ payload });
        return this.toResponse(this.createUseCase.execute(input), HttpStatus.CREATED);
    }

    @Get()
    findAll(
        @Query() query: Record<string, unknown>,
    ): Observable<GenericServerResponse> {
        const input = new ${listInput}({
${listInputPayloadLine}
        });
        return this.toResponse(this.listUseCase.execute(input), HttpStatus.OK);
    }

    @Get('count')
    count(
        @Query() query: Record<string, unknown>,
    ): Observable<GenericServerResponse> {
        const input = new ${countInput}({
${countInputPayloadLine}
        });
        return this.toResponse(this.countUseCase.execute(input), HttpStatus.OK);
    }

    @Get(':id')
    findById(@Param('id') id: string): Observable<GenericServerResponse> {
        const input = new ${findByIdInput}({ id });
        return this.toResponse(this.findByIdUseCase.execute(input), HttpStatus.OK);
    }

    @Patch(':id')
    updateById(
        @Param('id') id: string,
        @Body() payload: Partial<I${entityClassName}Entity>,
    ): Observable<GenericServerResponse> {
        const input = new ${updateByIdInput}({ id, payload });
        return this.toResponse(this.updateByIdUseCase.execute(input), HttpStatus.OK);
    }

    @Delete(':id')
    deleteById(@Param('id') id: string): Observable<GenericServerResponse> {
        const input = new ${deleteByIdInput}({ id });
        return this.toResponse(this.deleteByIdUseCase.execute(input), HttpStatus.OK);
    }
}
`;
}

export function buildEntityCrudModuleTemplate({
  contextName,
  entityName,
  entityClassName,
}) {
  const contextToken = `${contextName.replace(/-/g, '_').toUpperCase()}_DI_USE_CASES`;
  return `import { Module } from '@nestjs/common';
import { ${entityClassName}Controller } from './${entityName}.controller';
import { InfrastructureModule } from '@/infrastructure/infrastructure.module';
import { ${contextToken} } from '@/application/${contextName}/use-cases';

@Module({
    controllers: [${entityClassName}Controller],
    imports: [InfrastructureModule],
    providers: [...${contextToken}],
})
export class ${entityClassName}Module {}
`;
}
