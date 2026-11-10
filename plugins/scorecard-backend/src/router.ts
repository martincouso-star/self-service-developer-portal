import { Entity } from '@backstage/catalog-model';
import { evaluateScorecard } from '@internal/plugin-scorecard-common';
import express from 'express';
import Router from 'express-promise-router';

/** Catalog lookup used by the entity route. Tests pass a fake. */
export interface ScorecardCatalog {
  getEntityByRef(entityRef: string): Promise<Entity | undefined>;
}

function isEntity(value: unknown): value is Entity {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<Entity>;
  return (
    typeof candidate.apiVersion === 'string' &&
    typeof candidate.kind === 'string' &&
    !!candidate.metadata &&
    typeof candidate.metadata === 'object' &&
    typeof candidate.metadata.name === 'string'
  );
}

export async function createRouter(options: {
  catalog: ScorecardCatalog;
}): Promise<express.Router> {
  const router = Router();
  router.use(express.json());

  router.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  router.post('/evaluate', (req, res) => {
    if (!isEntity(req.body?.entity)) {
      res.status(400).json({
        error:
          'Expected a JSON body { entity } with apiVersion, kind, and metadata.name.',
      });
      return;
    }
    res.json(evaluateScorecard(req.body.entity));
  });

  router.get('/entities/:namespace/:kind/:name', async (req, res) => {
    const { namespace, kind, name } = req.params;
    const entityRef = `${kind}:${namespace}/${name}`.toLowerCase();
    const entity = await options.catalog.getEntityByRef(entityRef);
    if (!entity) {
      res.status(404).json({ error: `Entity not found: ${entityRef}` });
      return;
    }
    res.json(evaluateScorecard(entity));
  });

  router.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction,
    ) => {
      const message = err instanceof Error ? err.message : 'Unknown error';
      res.status(500).json({ error: message });
    },
  );

  return router;
}
