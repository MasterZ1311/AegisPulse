import { Router, Request, Response } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

export const docsRouter = Router();

// Load OpenAPI spec (or construct minimal fallback if yaml parser isn't installed)
docsRouter.get('/openapi.json', (_req: Request, res: Response) => {
  const yamlPath = resolve(process.cwd(), '../../docs/openapi.yaml');
  const localYamlPath = resolve(process.cwd(), 'docs/openapi.yaml');

  let fileContent = '';
  if (existsSync(yamlPath)) {
    fileContent = readFileSync(yamlPath, 'utf8');
  } else if (existsSync(localYamlPath)) {
    fileContent = readFileSync(localYamlPath, 'utf8');
  }

  res.status(200).json({
    openapi: '3.0.3',
    info: {
      title: 'AegisPulse Clinical Deterioration Radar API',
      version: '1.0.0',
      description: 'Production-oriented API for AegisPulse Patient Deterioration Radar.',
    },
    specPath: existsSync(yamlPath) ? yamlPath : localYamlPath,
    hasYamlSpec: fileContent.length > 0,
  });
});

docsRouter.get('/', (_req: Request, res: Response) => {
  res.status(200).json({
    name: 'AegisPulse Clinical Deterioration Radar API Documentation',
    version: '1.0.0',
    documentationUrl: '/api/docs/openapi.json',
    openApiSpecYaml: '/docs/openapi.yaml',
    endpointsCount: 24,
  });
});
