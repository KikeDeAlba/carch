import prettier from 'prettier';

export async function formatGeneratedCode(filePath, content) {
  const config = (await prettier.resolveConfig(filePath, {
    editorconfig: true,
  })) || {};

  return await prettier.format(content, {
    ...config,
    filepath: filePath,
  });
}
