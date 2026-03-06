import { mkdirSync, readdirSync, readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';
import { toKebabCase, toPascalCase } from '../utils/case.js';
import { writeFileSafely, writeFormattedFile } from '../utils/fs.js';
import { ensureAtAlias } from '../utils/tsconfig.js';
import { readCarchConfig } from '../utils/carch-config.js';
import { ensureOrmDependenciesInstalled } from '../utils/dependencies.js';
import { generateUseCaseResource } from './use-case.generator.js';
import { buildGenericServerResponseModelTemplate } from '../templates/controller.template.js';
import {
  buildEntityCrudControllerTemplate,
  buildEntityCrudModuleTemplate,
  buildDomainEntityInterfaceTemplate,
  buildDomainRepositoryInterfaceTemplate,
  buildMongoosePersistenceSchemaTemplate,
  buildMongooseRepositoryImplTemplate,
  buildTypeOrmPersistenceEntityTemplate,
  buildTypeOrmRepositoryImplTemplate,
} from '../templates/entity.template.js';

function toConstantCase(value) {
  return toKebabCase(value).replace(/-/g, '_').toUpperCase();
}

function listFilesByExtension(dirPath, extension) {
  if (!existsSync(dirPath)) {
    return [];
  }

  return readdirSync(dirPath)
    .filter((file) => file.endsWith(extension))
    .sort();
}

async function writeRepositoriesIndex({
  repositoriesDir,
  contextName,
  domainRepositoriesDir,
}) {
  const repositoryImplFiles = listFilesByExtension(repositoriesDir, '.ts').filter(
    (file) => file !== 'index.ts' && file.endsWith('-impl.repository.ts'),
  );

  const providerImports = [];
  const tokenImports = [];
  const providerConsts = [];
  const providerNames = [];
  const exportLines = [];

  for (const file of repositoryImplFiles) {
    const entityName = file.replace('-impl.repository.ts', '');
    const pascalEntity = toPascalCase(entityName);
    const tokenName = `I${pascalEntity}Repository`;
    const implName = `${pascalEntity}RepositoryImpl`;
    const providerName = `${pascalEntity}RepositoryProvider`;

    if (!existsSync(join(domainRepositoriesDir, `${entityName}.repository.ts`))) {
      continue;
    }

    tokenImports.push(
      `import { ${tokenName} } from '@/domain/${contextName}/repositories/${entityName}.repository';`,
    );
    providerImports.push(`import { ${implName} } from './${entityName}-impl.repository';`);
    exportLines.push(`export * from './${entityName}-impl.repository';`);
    providerConsts.push(`export const ${providerName}: Provider = {
    provide: ${tokenName},
    useClass: ${implName},
};`);
    providerNames.push(providerName);
  }

  const providersConstName = `${toConstantCase(contextName)}_PERSISTENCE_PROVIDERS`;
  const content = `import { Provider } from '@nestjs/common';
${tokenImports.join('\n')}
${providerImports.join('\n')}

${exportLines.join('\n')}

${providerConsts.join('\n\n')}

export const ${providersConstName}: Provider[] = [
${providerNames.map((name) => `    ${name},`).join('\n')}
];
`;

  await writeFormattedFile(join(repositoriesDir, 'index.ts'), content);
}

async function writeContextPersistenceModule({
  contextName,
  orm,
  persistenceContextDir,
  domainRepositoriesDir,
}) {
  const moduleClassName = `${toPascalCase(contextName)}PersistenceModule`;
  const providersConstName = `${toConstantCase(contextName)}_PERSISTENCE_PROVIDERS`;
  const domainRepoFiles = listFilesByExtension(domainRepositoriesDir, '.repository.ts');
  const repoTokens = domainRepoFiles.map((file) => `I${toPascalCase(file.replace('.repository.ts', ''))}Repository`);

  if (orm === 'typeorm') {
    const entityFiles = listFilesByExtension(
      join(persistenceContextDir, 'entities'),
      '.entity.ts',
    );
    const entityClasses = entityFiles.map(
      (file) => `${toPascalCase(file.replace('.entity.ts', ''))}Entity`,
    );

    const entityImports = entityFiles
      .map((file) => {
        const entityName = file.replace('.entity.ts', '');
        return `import { ${toPascalCase(entityName)}Entity } from './entities/${entityName}.entity';`;
      })
      .join('\n');

    const content = `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${providersConstName} } from './repositories';
${entityImports}

@Module({
    imports: [TypeOrmModule.forFeature([${entityClasses.join(', ')}])],
    providers: [...${providersConstName}],
    exports: [...${providersConstName}],
})
export class ${moduleClassName} {}
`;

    await writeFormattedFile(
      join(persistenceContextDir, `${contextName}-persistence.module.ts`),
      content,
    );
    return;
  }

  const schemaFiles = listFilesByExtension(
    join(persistenceContextDir, 'schemas'),
    '.schema.ts',
  );
  const schemaFeatureRows = schemaFiles
    .map((file) => {
      const entityName = file.replace('.schema.ts', '');
      const pascalEntity = toPascalCase(entityName);
      return `{ name: ${pascalEntity}Schema.name, schema: ${pascalEntity}MongooseSchema }`;
    })
    .join(', ');
  const schemaImports = schemaFiles
    .map((file) => {
      const entityName = file.replace('.schema.ts', '');
      const pascalEntity = toPascalCase(entityName);
      return `import { ${pascalEntity}Schema, ${pascalEntity}MongooseSchema } from './schemas/${entityName}.schema';`;
    })
    .join('\n');

  const content = `import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ${providersConstName} } from './repositories';
${schemaImports}

@Module({
    imports: [MongooseModule.forFeature([${schemaFeatureRows}])],
    providers: [...${providersConstName}],
    exports: [...${providersConstName}],
})
export class ${moduleClassName} {}
`;

  await writeFormattedFile(
    join(persistenceContextDir, `${contextName}-persistence.module.ts`),
    content,
  );
}

async function ensurePersistenceRootModule({ srcRoot, contextName }) {
  const persistenceRootDir = join(srcRoot, 'infrastructure', 'persistence');
  const persistenceRootModuleFile = join(persistenceRootDir, 'persistence.module.ts');
  const moduleClassName = `${toPascalCase(contextName)}PersistenceModule`;
  const moduleImportLine = `import { ${moduleClassName} } from './${contextName}/${contextName}-persistence.module';`;

  if (!existsSync(persistenceRootModuleFile)) {
    const content = `import { Module } from '@nestjs/common';
${moduleImportLine}

@Module({
    imports: [${moduleClassName}],
    exports: [${moduleClassName}],
})
export class PersistenceModule {}
`;
    await writeFormattedFile(persistenceRootModuleFile, content);
    return;
  }

  let content = readFileSync(persistenceRootModuleFile, 'utf8');
  if (!content.includes(moduleImportLine)) {
    content = `${moduleImportLine}\n${content}`;
  }

  if (!content.includes('PersistenceModule')) {
    return;
  }

  if (content.includes(moduleClassName)) {
    await writeFormattedFile(persistenceRootModuleFile, content);
    return;
  }

  content = content.replace(/imports:\s*\[([\s\S]*?)\]/m, (match, group) => {
    const updated = group.trim().length === 0 ? `\n        ${moduleClassName},\n    ` : `${group}\n        ${moduleClassName},\n    `;
    return `imports: [${updated}]`;
  });
  content = content.replace(/exports:\s*\[([\s\S]*?)\]/m, (match, group) => {
    const updated = group.trim().length === 0 ? `\n        ${moduleClassName},\n    ` : `${group}\n        ${moduleClassName},\n    `;
    return `exports: [${updated}]`;
  });

  await writeFormattedFile(persistenceRootModuleFile, content);
}

async function ensureInfrastructureModule({ srcRoot }) {
  const infrastructureDir = join(srcRoot, 'infrastructure');
  const infrastructureModuleFile = join(infrastructureDir, 'infrastructure.module.ts');
  const persistenceImportLine = `import { PersistenceModule } from './persistence/persistence.module';`;

  if (!existsSync(infrastructureModuleFile)) {
    const content = `import { Module } from '@nestjs/common';
${persistenceImportLine}

@Module({
    imports: [PersistenceModule],
    exports: [PersistenceModule],
})
export class InfrastructureModule {}
`;
    await writeFormattedFile(infrastructureModuleFile, content);
    return;
  }

  let content = readFileSync(infrastructureModuleFile, 'utf8');
  if (!content.includes(persistenceImportLine)) {
    content = `${persistenceImportLine}\n${content}`;
  }

  if (!content.includes('PersistenceModule')) {
    await writeFormattedFile(infrastructureModuleFile, content);
    return;
  }

  if (!/imports:\s*\[[\s\S]*PersistenceModule/.test(content)) {
    content = content.replace(/imports:\s*\[([\s\S]*?)\]/m, (match, group) => {
      const updated = group.trim().length === 0 ? `\n        PersistenceModule,\n    ` : `${group}\n        PersistenceModule,\n    `;
      return `imports: [${updated}]`;
    });
  }

  if (!/exports:\s*\[[\s\S]*PersistenceModule/.test(content)) {
    content = content.replace(/exports:\s*\[([\s\S]*?)\]/m, (match, group) => {
      const updated = group.trim().length === 0 ? `\n        PersistenceModule,\n    ` : `${group}\n        PersistenceModule,\n    `;
      return `exports: [${updated}]`;
    });
  }

  await writeFormattedFile(infrastructureModuleFile, content);
}

async function ensureGenericServerResponse(srcRoot) {
  const modelDir = join(srcRoot, 'common', 'dto', 'http', 'models');
  const modelFile = join(modelDir, 'server-response.model.ts');

  if (existsSync(modelFile)) {
    return;
  }

  mkdirSync(modelDir, { recursive: true });
  await writeFormattedFile(modelFile, buildGenericServerResponseModelTemplate());
}

function getRepositoryMethodsByOrm(entityClassName, orm) {
  const common = [
    {
      method: 'create',
      useCaseName: null,
      signature: `    abstract create(
        payload: Partial<I${entityClassName}Entity>,
    ): Promise<I${entityClassName}Entity>;`,
    },
    {
      method: 'findById',
      useCaseName: null,
      signature: `    abstract findById(id: string): Promise<I${entityClassName}Entity | null>;`,
    },
    {
      method: 'updateById',
      useCaseName: null,
      signature: `    abstract updateById(
        id: string,
        payload: Partial<I${entityClassName}Entity>,
    ): Promise<I${entityClassName}Entity | null>;`,
    },
    {
      method: 'deleteById',
      useCaseName: null,
      signature: `    abstract deleteById(id: string): Promise<boolean>;`,
    },
  ];

  if (orm === 'typeorm') {
    return [
      ...common,
      {
        method: 'save',
        useCaseName: null,
        signature: `    abstract save(
        payload: Partial<I${entityClassName}Entity>,
    ): Promise<I${entityClassName}Entity>;`,
      },
      {
        method: 'findAll',
        useCaseName: null,
        signature: `    abstract findAll(
        options?: FindManyOptions<I${entityClassName}Entity>,
    ): Promise<I${entityClassName}Entity[]>;`,
      },
      {
        method: 'count',
        useCaseName: null,
        signature: `    abstract count(
        options?: FindManyOptions<I${entityClassName}Entity>,
    ): Promise<number>;`,
      },
    ];
  }

  return [
    ...common,
    {
      method: 'findMany',
      useCaseName: null,
      signature: `    abstract findMany(
        filter?: FilterQuery<I${entityClassName}Entity>,
        options?: QueryOptions<I${entityClassName}Entity>,
    ): Promise<I${entityClassName}Entity[]>;`,
    },
    {
      method: 'countDocuments',
      useCaseName: null,
      signature:
        `    abstract countDocuments(
        filter?: FilterQuery<I${entityClassName}Entity>,
        options?: QueryOptions<I${entityClassName}Entity>,
    ): Promise<number>;`,
    },
  ];
}

function pluralizeEntityName(entityName) {
  if (/(s|x|z|ch|sh)$/i.test(entityName)) {
    return `${entityName}es`;
  }

  if (/[^aeiou]y$/i.test(entityName)) {
    return `${entityName.slice(0, -1)}ies`;
  }

  return `${entityName}s`;
}

function getTypeOrmRepositoryImplMethods(entityClassName) {
  return `    async create(
        payload: Partial<I${entityClassName}Entity>,
    ): Promise<I${entityClassName}Entity> {
        const entity = this.repository.create(payload);
        return await this.repository.save(entity);
    }

    async save(
        payload: Partial<I${entityClassName}Entity>,
    ): Promise<I${entityClassName}Entity> {
        const entity = this.repository.create(payload);
        return await this.repository.save(entity);
    }

    async findById(id: string): Promise<I${entityClassName}Entity | null> {
        return await this.repository.findOne({ where: { id } });
    }

    async findAll(
        options?: FindManyOptions<I${entityClassName}Entity>,
    ): Promise<I${entityClassName}Entity[]> {
        return await this.repository.find(options);
    }

    async updateById(
        id: string,
        payload: Partial<I${entityClassName}Entity>,
    ): Promise<I${entityClassName}Entity | null> {
        const current = await this.repository.findOne({ where: { id } });
        if (!current) {
            return null;
        }

        const merged = this.repository.merge(current, payload);
        return await this.repository.save(merged);
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await this.repository.delete(id);
        return (result.affected ?? 0) > 0;
    }

    async count(options?: FindManyOptions<I${entityClassName}Entity>): Promise<number> {
        return await this.repository.count({ where: options?.where });
    }`;
}

function getMongooseRepositoryImplMethods(entityClassName) {
  return `    async create(
        payload: Partial<I${entityClassName}Entity>,
    ): Promise<I${entityClassName}Entity> {
        const created = new this.model(payload);
        const saved = await created.save();
        return {
            id: saved.id,
            createdAt: saved.createdAt,
            updatedAt: saved.updatedAt,
        };
    }

    async findById(id: string): Promise<I${entityClassName}Entity | null> {
        const doc = await this.model.findById(id).exec();
        if (!doc) {
            return null;
        }

        return {
            id: doc.id,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
        };
    }

    async findMany(
        filter: FilterQuery<I${entityClassName}Entity> = {},
        options: QueryOptions<I${entityClassName}Entity> = {},
    ): Promise<I${entityClassName}Entity[]> {
        const docs = await this.model
            .find(filter)
            .setOptions(options)
            .exec();

        return docs.map((doc) => ({
            id: doc.id,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
        }));
    }

    async updateById(
        id: string,
        payload: Partial<I${entityClassName}Entity>,
    ): Promise<I${entityClassName}Entity | null> {
        const doc = await this.model
            .findByIdAndUpdate(id, payload, { new: true })
            .exec();

        if (!doc) {
            return null;
        }

        return {
            id: doc.id,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt,
        };
    }

    async deleteById(id: string): Promise<boolean> {
        const result = await this.model.findByIdAndDelete(id).exec();
        return !!result;
    }

    async countDocuments(
        filter: FilterQuery<I${entityClassName}Entity> = {},
        options: QueryOptions<I${entityClassName}Entity> = {},
    ): Promise<number> {
        return await this.model.countDocuments(filter).setOptions(options).exec();
    }`;
}

function getEntityUseCaseBlueprints({ orm, contextName, entityName, entityClassName }) {
  const repositoryTokenName = `I${entityClassName}Repository`;
  const repositoryImportPath = `@/domain/${contextName}/repositories/${entityName}.repository`;
  const repositoryPropertyName = `${entityName.replace(/-([a-z])/g, (_, c) => c.toUpperCase())}Repository`;
  const entityType = `I${entityClassName}Entity`;
  const entityImportLine = `import { ${entityType} } from '@/domain/${contextName}/interfaces/entities/${entityName}.entity';`;
  const typeOrmOptionsImportLine = "import { FindManyOptions } from 'typeorm';";
  const mongooseFilterImportLine = "import { FilterQuery } from 'mongoose';";
  const mongooseOptionsImportLine = "import { QueryOptions } from 'mongoose';";

  const shared = {
    repository: {
      tokenName: repositoryTokenName,
      importPath: repositoryImportPath,
      propertyName: repositoryPropertyName,
    },
  };

  const baseBlueprints = [
    {
      name: `create-${entityName}`,
      inputFields: [{ name: 'payload', type: `Partial<${entityType}>` }],
      outputFields: [{ name: 'entity', type: entityType }],
      execution: {
        byMode: {
          promise:
            "const entity = await this." +
            `${repositoryPropertyName}.create(command.payload);\n` +
            `        return new ${toPascalCase(`create-${entityName}`)}UseCaseOutput({ entity });`,
          observable:
            "return from(this." +
            `${repositoryPropertyName}.create(command.payload)).pipe(\n` +
            `            map((entity) => new ${toPascalCase(`create-${entityName}`)}UseCaseOutput({ entity })),\n` +
            '        );',
        },
        observableImports: ['from', 'map'],
      },
    },
    {
      name: `find-${entityName}-by-id`,
      inputFields: [{ name: 'id', type: 'string' }],
      outputFields: [{ name: 'entity', type: `${entityType} | null` }],
      execution: {
        byMode: {
          promise:
            "const entity = await this." +
            `${repositoryPropertyName}.findById(command.id);\n` +
            `        return new ${toPascalCase(`find-${entityName}-by-id`)}UseCaseOutput({ entity });`,
          observable:
            "return from(this." +
            `${repositoryPropertyName}.findById(command.id)).pipe(\n` +
            `            map((entity) => new ${toPascalCase(`find-${entityName}-by-id`)}UseCaseOutput({ entity })),\n` +
            '        );',
        },
        observableImports: ['from', 'map'],
      },
    },
    {
      name: `update-${entityName}-by-id`,
      inputFields: [
        { name: 'id', type: 'string' },
        { name: 'payload', type: `Partial<${entityType}>` },
      ],
      outputFields: [{ name: 'entity', type: `${entityType} | null` }],
      execution: {
        byMode: {
          promise:
            "const entity = await this." +
            `${repositoryPropertyName}.updateById(command.id, command.payload);\n` +
            `        return new ${toPascalCase(`update-${entityName}-by-id`)}UseCaseOutput({ entity });`,
          observable:
            "return from(this." +
            `${repositoryPropertyName}.updateById(command.id, command.payload)).pipe(\n` +
            `            map((entity) => new ${toPascalCase(`update-${entityName}-by-id`)}UseCaseOutput({ entity })),\n` +
            '        );',
        },
        observableImports: ['from', 'map'],
      },
    },
    {
      name: `delete-${entityName}-by-id`,
      inputFields: [{ name: 'id', type: 'string' }],
      outputFields: [{ name: 'deleted', type: 'boolean' }],
      execution: {
        byMode: {
          promise:
            "const deleted = await this." +
            `${repositoryPropertyName}.deleteById(command.id);\n` +
            `        return new ${toPascalCase(`delete-${entityName}-by-id`)}UseCaseOutput({ deleted });`,
          observable:
            "return from(this." +
            `${repositoryPropertyName}.deleteById(command.id)).pipe(\n` +
            `            map((deleted) => new ${toPascalCase(`delete-${entityName}-by-id`)}UseCaseOutput({ deleted })),\n` +
            '        );',
        },
        observableImports: ['from', 'map'],
      },
    },
  ];

  if (orm === 'typeorm') {
    return [
      ...baseBlueprints,
      {
        name: `save-${entityName}`,
        inputFields: [{ name: 'payload', type: `Partial<${entityType}>` }],
        outputFields: [{ name: 'entity', type: entityType }],
        execution: {
          byMode: {
            promise:
              "const entity = await this." +
              `${repositoryPropertyName}.save(command.payload);\n` +
              `        return new ${toPascalCase(`save-${entityName}`)}UseCaseOutput({ entity });`,
            observable:
              "return from(this." +
              `${repositoryPropertyName}.save(command.payload)).pipe(\n` +
              `            map((entity) => new ${toPascalCase(`save-${entityName}`)}UseCaseOutput({ entity })),\n` +
              '        );',
          },
          observableImports: ['from', 'map'],
        },
      },
      {
        name: `find-all-${entityName}`,
        inputFields: [
          { name: 'options', type: `FindManyOptions<${entityType}>`, optional: true },
        ],
        outputFields: [{ name: 'items', type: `${entityType}[]` }],
        execution: {
          byMode: {
            promise:
              "const items = await this." +
              `${repositoryPropertyName}.findAll(command.options);\n` +
              `        return new ${toPascalCase(`find-all-${entityName}`)}UseCaseOutput({ items });`,
            observable:
              "return from(this." +
              `${repositoryPropertyName}.findAll(command.options)).pipe(\n` +
              `            map((items) => new ${toPascalCase(`find-all-${entityName}`)}UseCaseOutput({ items })),\n` +
              '        );',
          },
          observableImports: ['from', 'map'],
        },
      },
      {
        name: `count-${entityName}`,
        inputFields: [
          { name: 'options', type: `FindManyOptions<${entityType}>`, optional: true },
        ],
        outputFields: [{ name: 'total', type: 'number' }],
        execution: {
          byMode: {
            promise:
              "const total = await this." +
              `${repositoryPropertyName}.count(command.options);\n` +
              `        return new ${toPascalCase(`count-${entityName}`)}UseCaseOutput({ total });`,
            observable:
              "return from(this." +
              `${repositoryPropertyName}.count(command.options)).pipe(\n` +
              `            map((total) => new ${toPascalCase(`count-${entityName}`)}UseCaseOutput({ total })),\n` +
              '        );',
          },
          observableImports: ['from', 'map'],
        },
      },
    ].map((bp) => ({
      ...shared,
      ...bp,
      inputImportLines: bp.inputFields.some((f) => f.type.includes(entityType))
        ? [
            entityImportLine,
            ...(bp.inputFields.some((f) => f.type.includes('FindManyOptions'))
              ? [typeOrmOptionsImportLine]
              : []),
          ]
        : bp.inputFields.some((f) => f.type.includes('FindManyOptions'))
          ? [typeOrmOptionsImportLine]
          : [],
      outputImportLines: bp.outputFields.some((f) => f.type.includes(entityType))
        ? [entityImportLine]
        : [],
      appInputImportLines: bp.inputFields.some((f) => f.type.includes(entityType))
        ? [
            entityImportLine,
            ...(bp.inputFields.some((f) => f.type.includes('FindManyOptions'))
              ? [typeOrmOptionsImportLine]
              : []),
          ]
        : bp.inputFields.some((f) => f.type.includes('FindManyOptions'))
          ? [typeOrmOptionsImportLine]
          : [],
      appOutputImportLines: bp.outputFields.some((f) => f.type.includes(entityType))
        ? [entityImportLine]
        : [],
    }));
  }

  return [
    ...baseBlueprints,
    {
      name: `find-many-${entityName}`,
      inputFields: [
        { name: 'filter', type: `FilterQuery<${entityType}>`, optional: true },
        { name: 'options', type: `QueryOptions<${entityType}>`, optional: true },
      ],
      outputFields: [{ name: 'items', type: `${entityType}[]` }],
      execution: {
        byMode: {
          promise:
            "const items = await this." +
            `${repositoryPropertyName}.findMany(command.filter, command.options);\n` +
            `        return new ${toPascalCase(`find-many-${entityName}`)}UseCaseOutput({ items });`,
          observable:
            "return from(this." +
            `${repositoryPropertyName}.findMany(command.filter, command.options)).pipe(\n` +
            `            map((items) => new ${toPascalCase(`find-many-${entityName}`)}UseCaseOutput({ items })),\n` +
            '        );',
        },
        observableImports: ['from', 'map'],
      },
    },
    {
      name: `count-${entityName}-documents`,
      inputFields: [
        { name: 'filter', type: `FilterQuery<${entityType}>`, optional: true },
        { name: 'options', type: `QueryOptions<${entityType}>`, optional: true },
      ],
      outputFields: [{ name: 'total', type: 'number' }],
      execution: {
        byMode: {
          promise:
            "const total = await this." +
            `${repositoryPropertyName}.countDocuments(command.filter, command.options);\n` +
            `        return new ${toPascalCase(`count-${entityName}-documents`)}UseCaseOutput({ total });`,
          observable:
            "return from(this." +
            `${repositoryPropertyName}.countDocuments(command.filter, command.options)).pipe(\n` +
            `            map((total) => new ${toPascalCase(`count-${entityName}-documents`)}UseCaseOutput({ total })),\n` +
            '        );',
        },
        observableImports: ['from', 'map'],
      },
    },
  ].map((bp) => ({
    ...shared,
    ...bp,
    inputImportLines: bp.inputFields.some((f) => f.type.includes(entityType))
      ? [
          entityImportLine,
          ...(bp.inputFields.some((f) => f.type.includes('FilterQuery'))
            ? [mongooseFilterImportLine]
            : []),
          ...(bp.inputFields.some((f) => f.type.includes('QueryOptions'))
            ? [mongooseOptionsImportLine]
            : []),
        ]
      : [
          ...(bp.inputFields.some((f) => f.type.includes('FilterQuery'))
            ? [mongooseFilterImportLine]
            : []),
          ...(bp.inputFields.some((f) => f.type.includes('QueryOptions'))
            ? [mongooseOptionsImportLine]
            : []),
        ],
    outputImportLines: bp.outputFields.some((f) => f.type.includes(entityType))
      ? [entityImportLine]
      : [],
    appInputImportLines: bp.inputFields.some((f) => f.type.includes(entityType))
      ? [
          entityImportLine,
          ...(bp.inputFields.some((f) => f.type.includes('FilterQuery'))
            ? [mongooseFilterImportLine]
            : []),
          ...(bp.inputFields.some((f) => f.type.includes('QueryOptions'))
            ? [mongooseOptionsImportLine]
            : []),
        ]
      : [
          ...(bp.inputFields.some((f) => f.type.includes('FilterQuery'))
            ? [mongooseFilterImportLine]
            : []),
          ...(bp.inputFields.some((f) => f.type.includes('QueryOptions'))
            ? [mongooseOptionsImportLine]
            : []),
        ],
    appOutputImportLines: bp.outputFields.some((f) => f.type.includes(entityType))
      ? [entityImportLine]
      : [],
  }));
}

export async function generateEntityResource(context, name, options) {
  const contextName = toKebabCase(context);
  const entityName = toKebabCase(name);

  if (!contextName) {
    throw new Error('Invalid context name.');
  }

  if (!entityName) {
    throw new Error('Invalid entity name.');
  }

  const entityClassName = toPascalCase(entityName);
  const entityTableName = pluralizeEntityName(entityName);
  const srcRoot = resolve(process.cwd(), options.srcRoot);
  const projectRoot = resolve(srcRoot, '..');
  const { config } = readCarchConfig(projectRoot);
  const orm = config.orm;
  const repositoryImportLines =
    orm === 'typeorm'
      ? ["import { FindManyOptions } from 'typeorm';"]
      : ["import { FilterQuery, QueryOptions } from 'mongoose';"];

  await ensureOrmDependenciesInstalled({ orm, projectRoot });

  const domainEntitiesDir = join(
    srcRoot,
    'domain',
    contextName,
    'interfaces',
    'entities',
  );
  const domainRepositoriesDir = join(
    srcRoot,
    'domain',
    contextName,
    'repositories',
  );
  const persistenceContextDir = join(
    srcRoot,
    'infrastructure',
    'persistence',
    contextName,
  );

  mkdirSync(domainEntitiesDir, { recursive: true });
  mkdirSync(domainRepositoriesDir, { recursive: true });
  mkdirSync(persistenceContextDir, { recursive: true });

  ensureAtAlias({ srcRoot });
  await ensureGenericServerResponse(srcRoot);

  const domainEntityFile = join(domainEntitiesDir, `${entityName}.entity.ts`);
  const domainRepositoryFile = join(
    domainRepositoriesDir,
    `${entityName}.repository.ts`,
  );
  const repositoryMethods = getRepositoryMethodsByOrm(entityClassName, orm);

  await writeFileSafely(
    domainEntityFile,
    buildDomainEntityInterfaceTemplate({
      entityClassName,
    }),
  );
  await writeFileSafely(
    domainRepositoryFile,
    buildDomainRepositoryInterfaceTemplate({
      contextName,
      entityName,
      entityClassName,
      methods: repositoryMethods.map((m) => m.signature).join('\n\n'),
      importLines: repositoryImportLines,
    }),
  );

  if (orm === 'typeorm') {
    const persistenceEntitiesDir = join(persistenceContextDir, 'entities');
    const persistenceRepositoriesDir = join(
      persistenceContextDir,
      'repositories',
    );
    mkdirSync(persistenceEntitiesDir, { recursive: true });
    mkdirSync(persistenceRepositoriesDir, { recursive: true });

    const persistenceEntityFile = join(
      persistenceEntitiesDir,
      `${entityName}.entity.ts`,
    );
    const persistenceRepositoryFile = join(
      persistenceRepositoriesDir,
      `${entityName}-impl.repository.ts`,
    );

    await writeFileSafely(
      persistenceEntityFile,
      buildTypeOrmPersistenceEntityTemplate({
        contextName,
        entityName,
        entityClassName,
        entityTableName,
      }),
    );
    await writeFileSafely(
      persistenceRepositoryFile,
      buildTypeOrmRepositoryImplTemplate({
        contextName,
        entityName,
        entityClassName,
        methods: getTypeOrmRepositoryImplMethods(entityClassName),
      }),
    );

    await writeRepositoriesIndex({
      repositoriesDir: persistenceRepositoriesDir,
      contextName,
      domainRepositoriesDir,
    });
    await writeContextPersistenceModule({
      contextName,
      orm,
      persistenceContextDir,
      domainRepositoriesDir,
    });
  }

  if (orm === 'mongoose') {
    const persistenceSchemasDir = join(persistenceContextDir, 'schemas');
    const persistenceRepositoriesDir = join(
      persistenceContextDir,
      'repositories',
    );
    mkdirSync(persistenceSchemasDir, { recursive: true });
    mkdirSync(persistenceRepositoriesDir, { recursive: true });

    const persistenceSchemaFile = join(
      persistenceSchemasDir,
      `${entityName}.schema.ts`,
    );
    const persistenceRepositoryFile = join(
      persistenceRepositoriesDir,
      `${entityName}-impl.repository.ts`,
    );

    await writeFileSafely(
      persistenceSchemaFile,
      buildMongoosePersistenceSchemaTemplate({
        contextName,
        entityName,
        entityClassName,
      }),
    );
    await writeFileSafely(
      persistenceRepositoryFile,
      buildMongooseRepositoryImplTemplate({
        contextName,
        entityName,
        entityClassName,
        methods: getMongooseRepositoryImplMethods(entityClassName),
      }),
    );

    await writeRepositoriesIndex({
      repositoriesDir: persistenceRepositoriesDir,
      contextName,
      domainRepositoriesDir,
    });
    await writeContextPersistenceModule({
      contextName,
      orm,
      persistenceContextDir,
      domainRepositoriesDir,
    });
  }

  await ensurePersistenceRootModule({ srcRoot, contextName });
  await ensureInfrastructureModule({ srcRoot });

  const useCasesToGenerate = getEntityUseCaseBlueprints({
    orm,
    contextName,
    entityName,
    entityClassName,
  });

  for (const useCaseDefinition of useCasesToGenerate) {
    await generateUseCaseResource(contextName, useCaseDefinition.name, {
      srcRoot: options.srcRoot,
      testPath: options.testPath ?? 'test',
      spec: options.spec,
      definition: {
        inputFields: useCaseDefinition.inputFields,
        outputFields: useCaseDefinition.outputFields,
        inputImportLines: useCaseDefinition.inputImportLines,
        outputImportLines: useCaseDefinition.outputImportLines,
        appInputImportLines: useCaseDefinition.appInputImportLines,
        appOutputImportLines: useCaseDefinition.appOutputImportLines,
        repository: useCaseDefinition.repository,
        execution: useCaseDefinition.execution,
      },
    });
  }

  if (options.withController) {
    const apiRoot = resolve(process.cwd(), options.apiPath ?? 'src/api');
    const controllerDir = join(apiRoot, pluralizeEntityName(entityName));
    mkdirSync(controllerDir, { recursive: true });

    const controllerFile = join(controllerDir, `${entityName}.controller.ts`);
    const moduleFile = join(controllerDir, `${entityName}.module.ts`);

    const listUseCaseFileName =
      orm === 'typeorm' ? `find-all-${entityName}` : `find-many-${entityName}`;
    const countUseCaseFileName =
      orm === 'typeorm'
        ? `count-${entityName}`
        : `count-${entityName}-documents`;

    const listUseCaseClassName = `${toPascalCase(listUseCaseFileName)}UseCase`;
    const countUseCaseClassName = `${toPascalCase(countUseCaseFileName)}UseCase`;

    const extraImports =
      orm === 'typeorm'
        ? [
            "import { FindManyOptions } from 'typeorm';",
          ]
        : [
            "import { FilterQuery, QueryOptions } from 'mongoose';",
          ];
    const listInputPayloadLine =
      orm === 'typeorm'
        ? `            options: query as unknown as FindManyOptions<I${entityClassName}Entity>,`
        : `            filter: (query.filter ?? {}) as FilterQuery<I${entityClassName}Entity>,
            options: (query.options ?? {}) as QueryOptions<I${entityClassName}Entity>,`;
    const countInputPayloadLine =
      orm === 'typeorm'
        ? `            options: query as unknown as FindManyOptions<I${entityClassName}Entity>,`
        : `            filter: (query.filter ?? {}) as FilterQuery<I${entityClassName}Entity>,
            options: (query.options ?? {}) as QueryOptions<I${entityClassName}Entity>,`;

    await writeFileSafely(
      controllerFile,
      buildEntityCrudControllerTemplate({
        contextName,
        entityName,
        entityClassName,
        routeName: pluralizeEntityName(entityName),
        listUseCaseClassName,
        countUseCaseClassName,
        listUseCaseFileName,
        countUseCaseFileName,
        extraImports,
        listInputPayloadLine,
        countInputPayloadLine,
      }),
    );
    await writeFileSafely(
      moduleFile,
      buildEntityCrudModuleTemplate({
        contextName,
        entityName,
        entityClassName,
      }),
    );
  }

  return persistenceContextDir;
}
