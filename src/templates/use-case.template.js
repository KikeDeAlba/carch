export function buildUseCaseCoreTemplate() {
  return `import { Observable } from 'rxjs';

export interface IUseCase<I, O> {
    execute(command: I): Promise<O> | Observable<O>;
}

export interface IPromiseUseCase<I, O> {
    execute(command: I): Promise<O>;
}

export interface IObservableUseCase<I, O> {
    execute(command: I): Observable<O>;
}
`;
}

export function buildDomainUseCaseTemplate({
  useCaseClassName,
  contextName,
  useCaseName,
  asyncMode,
}) {
  const useCaseContract =
    asyncMode === 'promise' ? 'IPromiseUseCase' : 'IObservableUseCase';
  const returnType = asyncMode === 'promise' ? 'Promise' : 'Observable';

  return `import { ${useCaseContract} } from '@/common/core/use-case';
${asyncMode === 'observable' ? "import { Observable } from 'rxjs';\n" : ''}import { I${useCaseClassName}Input } from '@/domain/${contextName}/interfaces/inputs/${useCaseName}.input';
import { I${useCaseClassName}Output } from '@/domain/${contextName}/interfaces/outputs/${useCaseName}.output';

export abstract class ${useCaseClassName} implements ${useCaseContract}<
    I${useCaseClassName}Input,
    I${useCaseClassName}Output
> {
    abstract execute(
        command: I${useCaseClassName}Input,
    ): ${returnType}<I${useCaseClassName}Output>;
}
`;
}

export function buildApplicationUseCaseTemplate({
  useCaseClassName,
  useCaseImplClassName,
  contextName,
  useCaseName,
  asyncMode,
  repository,
  execution,
}) {
  const returnType = asyncMode === 'promise' ? 'Promise' : 'Observable';
  const asyncKeyword = asyncMode === 'promise' ? 'async ' : '';
  const executionBodyByMode = execution?.byMode?.[asyncMode];
  const returnStatement = executionBodyByMode
    ? executionBodyByMode
    : asyncMode === 'promise'
      ? `const output = new ${useCaseClassName}Output();
        return output;`
      : `const output = new ${useCaseClassName}Output();
        return of(output);`;
  const rxjsImports =
    asyncMode === 'observable'
      ? Array.from(
          new Set([
            'Observable',
            ...(execution?.observableImports ?? []),
            ...(executionBodyByMode ? [] : ['of']),
          ]),
        )
      : [];
  const rxjsImport =
    rxjsImports.length > 0
      ? `import { ${rxjsImports.join(', ')} } from 'rxjs';\n`
      : '';
  const nestImports = repository ? '{ Injectable, Inject }' : '{ Injectable }';
  const repositoryImport = repository
    ? `import { ${repository.tokenName} } from '${repository.importPath}';\n`
    : '';
  const constructorBlock = repository
    ? `
    constructor(
        @Inject(${repository.tokenName})
        private readonly ${repository.propertyName}: ${repository.tokenName},
    ) {
        super();
    }
`
    : '';

  return `import ${nestImports} from '@nestjs/common';
${rxjsImport}import { ${useCaseClassName} } from '@/domain/${contextName}/use-cases/${useCaseName}.usecase';
import { I${useCaseClassName}Input } from '@/domain/${contextName}/interfaces/inputs/${useCaseName}.input';
import { I${useCaseClassName}Output } from '@/domain/${contextName}/interfaces/outputs/${useCaseName}.output';
import { ${useCaseClassName}Output } from '@/application/${contextName}/interfaces/outputs/${useCaseName}.output';
${repositoryImport}

@Injectable()
export class ${useCaseImplClassName} extends ${useCaseClassName} {
${constructorBlock}
    ${asyncKeyword}execute(
        command: I${useCaseClassName}Input,
    ): ${returnType}<I${useCaseClassName}Output> {
        ${returnStatement}
    }
}
`;
}

export function buildUseCaseImplProviderTemplate({
  useCaseClassName,
  useCaseImplClassName,
  useCaseImplProviderName,
  useCaseName,
  contextName,
}) {
  return `import { Provider } from '@nestjs/common';
import { ${useCaseClassName} } from '@/domain/${contextName}/use-cases/${useCaseName}.usecase';
import { ${useCaseImplClassName} } from './${useCaseName}-impl.usecase';

export const ${useCaseImplProviderName}: Provider = {
    provide: ${useCaseClassName},
    useClass: ${useCaseImplClassName},
};
`;
}

export function buildUseCaseSpecTemplate({
  useCaseImplClassName,
  contextName,
  useCaseName,
}) {
  return `import { ${useCaseImplClassName} } from '@/application/${contextName}/use-cases/${useCaseName}-impl/${useCaseName}-impl.usecase';

describe('${useCaseImplClassName}', () => {
    it('should be defined', () => {
        const useCase = new ${useCaseImplClassName}();
        expect(useCase).toBeDefined();
    });
});
`;
}

function renderTypedFields(fields, fallbackLine) {
  if (!fields || fields.length === 0) {
    return `    ${fallbackLine}\n`;
  }

  return `${fields
    .map(
      (field) =>
        `    ${field.name}${field.optional ? '?' : ''}: ${field.type};`,
    )
    .join('\n')}\n`;
}

function renderImportLines(importLines) {
  if (!importLines || importLines.length === 0) {
    return '';
  }

  return `${importLines.join('\n')}\n\n`;
}

export function buildUseCaseInputTemplate({
  useCaseClassName,
  fields,
  importLines,
}) {
  const renderedFields = renderTypedFields(fields, '[key: string]: unknown;');
  return `${renderImportLines(importLines)}export interface I${useCaseClassName}Input {
${renderedFields}}
`;
}

export function buildUseCaseOutputTemplate({
  useCaseClassName,
  fields,
  importLines,
}) {
  const renderedFields = renderTypedFields(fields, '[key: string]: unknown;');
  return `${renderImportLines(importLines)}export interface I${useCaseClassName}Output {
${renderedFields}}
`;
}

export function buildApplicationUseCaseInputClassTemplate({
  useCaseClassName,
  contextName,
  useCaseName,
  fields,
  importLines,
}) {
  const renderedFields = renderTypedFields(fields, '[key: string]: unknown;');
  return `import { I${useCaseClassName}Input } from '@/domain/${contextName}/interfaces/inputs/${useCaseName}.input';
${importLines && importLines.length > 0 ? `${importLines.join('\n')}\n` : ''}

export class ${useCaseClassName}Input implements I${useCaseClassName}Input {
${renderedFields}
    constructor(data: Partial<I${useCaseClassName}Input> = {}) {
        Object.assign(this, data);
    }
}
`;
}

export function buildApplicationUseCaseOutputClassTemplate({
  useCaseClassName,
  contextName,
  useCaseName,
  fields,
  importLines,
}) {
  const renderedFields = renderTypedFields(fields, '[key: string]: unknown;');
  return `import { I${useCaseClassName}Output } from '@/domain/${contextName}/interfaces/outputs/${useCaseName}.output';
${importLines && importLines.length > 0 ? `${importLines.join('\n')}\n` : ''}

export class ${useCaseClassName}Output implements I${useCaseClassName}Output {
${renderedFields}
    constructor(data: Partial<I${useCaseClassName}Output> = {}) {
        Object.assign(this, data);
    }
}
`;
}

export function buildUseCasesIndexTemplate({
  contextDiToken,
  useCaseImplProviderName,
  useCaseName,
}) {
  return `import { Provider } from '@nestjs/common';
import { ${useCaseImplProviderName} } from './${useCaseName}-impl';

export const ${contextDiToken}: Provider[] = [
    ${useCaseImplProviderName},
];
`;
}
