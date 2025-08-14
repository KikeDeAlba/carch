import { Command } from 'commander';
import fs from 'fs';
import path from 'path';
import chalk from 'chalk';
import { fileURLToPath } from 'url';
import prettier from 'prettier'

export const entityCommand = new Command('entity');

/**
 * 
 * @param {string} content 
 * @returns string
 */
function removeMarkDown(content) {
    return content.replaceAll('```ts', '').replaceAll('```', '');
}

/**
 * 
 * @param {string} content 
 * @param {{[key: string]: string}} replacements 
 * @returns Promise<string> 
 */
async function replaceContent(content, replacements) {
    let result = removeMarkDown(content);
    for (const [key, value] of Object.entries(replacements)) {
        result = result.replaceAll(`{${key}}`, value);
    }
    return prettier.format(result, {
        parser: "typescript",
        singleQuote: true,
        semi: true,
        tabWidth: 4,
        trailingComma: 'all'
    });
}

entityCommand
    .description('Generate a new entity')
    .argument('[entity-name]', 'name of the entity')
    .action(async (entityName) => {
        const entityNameKebapCase = entityName.replace(/([a-z])([A-Z])/g, '$1-$2').toLowerCase();
        const entityNamePascalCase = entityName.charAt(0).toUpperCase() + entityName.slice(1);
        const entityNamePluralSnakeCase = entityNameKebapCase.endsWith('s') ? entityNameKebapCase : `${entityNameKebapCase}s`;

        const replaceObject = {
            PascalCaseName: entityNamePascalCase,
            PluralSnakeCaseName: entityNamePluralSnakeCase,
            KebabCaseName: entityNameKebapCase
        }

        const __filename = fileURLToPath(import.meta.url);

        if (!entityName) {
            console.error('Entity name is required');
            process.exit(1);
        }

        // Domain generation
        const domainPath = path.join(process.cwd(), 'src', 'domain');
        const modelsPath = path.join(domainPath, entityNameKebapCase, 'models');
        const modelTemplatePath = path.join(path.dirname(__filename), '..', 'templates', 'domain', 'entity', 'models', 'model.template');
        const modelTemplateContent = fs.readFileSync(modelTemplatePath, 'utf-8');
        const modelContent = await replaceContent(modelTemplateContent, replaceObject);

        fs.mkdirSync(modelsPath, { recursive: true });
        fs.writeFileSync(path.join(modelsPath, `${entityNameKebapCase}.model.ts`), modelContent);

        // Infrastructure Generation
        const persistencePath = path.join(process.cwd(), 'src', 'infrastructure', 'persistence');
        const entityPath = path.join(persistencePath, entityNameKebapCase, 'entities', `${entityNameKebapCase}.entity.ts`);
        const entityTemplatePath = path.join(path.dirname(__filename), '..', 'templates', 'infrastructure', 'persistence', 'entity', 'entities', 'entity.model');
        const entityTemplateContent = fs.readFileSync(entityTemplatePath, 'utf-8');
        const entityContent = await replaceContent(entityTemplateContent, replaceObject);

        fs.mkdirSync(path.dirname(entityPath), { recursive: true });
        fs.writeFileSync(entityPath, entityContent);
    });
