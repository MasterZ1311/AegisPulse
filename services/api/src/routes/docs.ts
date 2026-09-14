import { Router, Request, Response } from 'express';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import YAML from 'yaml';

export const docsRouter = Router();

function loadOpenApiSpec(): { yamlString: string; jsonObject: any } {
  const candidatePaths = [
    resolve(process.cwd(), 'docs/openapi.yaml'),
    resolve(process.cwd(), '../../docs/openapi.yaml'),
    resolve(__dirname, '../../../../docs/openapi.yaml'),
    resolve(__dirname, '../../../docs/openapi.yaml'),
  ];

  for (const p of candidatePaths) {
    if (existsSync(p)) {
      const yamlString = readFileSync(p, 'utf8');
      try {
        const jsonObject = YAML.parse(yamlString);
        return { yamlString, jsonObject };
      } catch {
        // Continue to fallback
      }
    }
  }

  const fallback = {
    openapi: '3.0.3',
    info: {
      title: 'AegisPulse Clinical Deterioration Radar API',
      version: '1.0.0',
      description: 'Production-oriented API for AegisPulse Patient Deterioration Radar.',
    },
    paths: {},
  };
  return { yamlString: YAML.stringify(fallback), jsonObject: fallback };
}

// Serve OpenAPI Specification in JSON format
docsRouter.get('/openapi.json', (_req: Request, res: Response) => {
  const { jsonObject } = loadOpenApiSpec();
  res.status(200).json(jsonObject);
});

// Serve OpenAPI Specification in YAML format
docsRouter.get('/openapi.yaml', (_req: Request, res: Response) => {
  const { yamlString } = loadOpenApiSpec();
  res.setHeader('Content-Type', 'text/yaml; charset=utf-8');
  res.status(200).send(yamlString);
});

// Serve Swagger UI HTML for interactive API exploration
docsRouter.get('/', (_req: Request, res: Response) => {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>AegisPulse API Documentation | Swagger UI</title>
  <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui.css" />
  <style>
    body { margin: 0; background: #0f172a; color: #f8fafc; font-family: Inter, system-ui, sans-serif; }
    .topbar { display: none; }
    .swagger-ui { background: #ffffff; border-radius: 8px; margin: 24px auto; max-width: 1400px; padding: 24px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.5); }
    .header-banner { background: #1e293b; padding: 20px 32px; border-bottom: 2px solid #0284c7; display: flex; align-items: center; justify-content: space-between; }
    .header-banner h1 { margin: 0; font-size: 1.5rem; color: #38bdf8; }
    .header-banner a { color: #94a3b8; text-decoration: none; margin-left: 16px; font-size: 0.9rem; }
    .header-banner a:hover { color: #38bdf8; }
  </style>
</head>
<body>
  <div class="header-banner">
    <div>
      <h1>AegisPulse Clinical Deterioration Radar API</h1>
      <small style="color: #64748b;">Deterministic Patient Deterioration Radar & Attention Priority Engine</small>
    </div>
    <div>
      <a href="/api/docs/openapi.json" target="_blank">Download openapi.json</a>
      <a href="/api/docs/openapi.yaml" target="_blank">Download openapi.yaml</a>
    </div>
  </div>
  <div id="swagger-ui"></div>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-bundle.js" charset="UTF-8"></script>
  <script src="https://unpkg.com/swagger-ui-dist@5.11.0/swagger-ui-standalone-preset.js" charset="UTF-8"></script>
  <script>
    window.onload = () => {
      window.ui = SwaggerUIBundle({
        url: '/api/docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        presets: [
          SwaggerUIBundle.presets.apis,
          SwaggerUIStandalonePreset
        ],
        layout: "StandaloneLayout"
      });
    };
  </script>
</body>
</html>`;
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.status(200).send(html);
});

