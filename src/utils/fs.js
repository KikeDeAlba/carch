import { existsSync, writeFileSync } from 'fs';
import { formatGeneratedCode } from './formatter.js';

export async function writeFileSafely(filePath, content) {
  if (existsSync(filePath)) {
    throw new Error(`File already exists: ${filePath}`);
  }

  const formattedContent = await formatGeneratedCode(filePath, content);
  writeFileSync(filePath, formattedContent, 'utf8');
}

export async function writeFormattedFile(filePath, content) {
  const formattedContent = await formatGeneratedCode(filePath, content);
  writeFileSync(filePath, formattedContent, 'utf8');
}
