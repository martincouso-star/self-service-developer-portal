import { Entity } from '@backstage/catalog-model';
import express from 'express';
import request from 'supertest';
import { createRouter, ScorecardCatalog } from './router';

const checkoutApi: Entity = {
  apiVersion: 'backstage.io/v1alpha1',
  kind: 'Component',
  metadata: {
    name: 'checkout-api',
    namespace: 'default',
    description: 'Accepts checkout requests and records payment attempts.',
    annotations: {
      'backstage.io/source-location':
        'url:https://github.com/marlow-labs/checkout-api',
      'backstage.io/techdocs-ref': 'dir:.',
      'marlow.dev/oncall': 'checkout-primary',
      'marlow.dev/runbook': 'https://marlow.example/runbooks/checkout-api',
      'marlow.dev/slo': '99.9%',
      'marlow.dev/has-tests': 'true',
    },
  },
  spec: {
    type: 'service',
    lifecycle: 'production',
    owner: 'group:default/checkout',
    system: 'checkout',
    providesApis: ['checkout-openapi'],
  },
};

function catalogOf(entities: Record<string, Entity>): ScorecardCatalog {
  return {
    async getEntityByRef(entityRef) {
      return entities[entityRef];
    },
  };
}

async function appWith(catalog: ScorecardCatalog) {
  const app = express();
  app.use(await createRouter({ catalog }));
  return app;
}

describe('scorecard router', () => {
  it('reports health', async () => {
    const app = await appWith(catalogOf({}));
    const response = await request(app).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
  });

  it('evaluates an entity posted by the caller', async () => {
    const app = await appWith(catalogOf({}));
    const response = await request(app)
      .post('/evaluate')
      .send({ entity: checkoutApi });

    expect(response.status).toBe(200);
    expect(response.body.entityRef).toBe('component:default/checkout-api');
    expect(response.body.score).toBe(100);
    expect(response.body.grade).toBe('A');
  });

  it('rejects a body that is not an entity', async () => {
    const app = await appWith(catalogOf({}));
    const response = await request(app).post('/evaluate').send({ name: 'nope' });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('metadata.name');
  });

  it('loads an entity from the catalog by ref', async () => {
    const app = await appWith(
      catalogOf({
        'component:default/checkout-api': checkoutApi,
      }),
    );
    const response = await request(app).get(
      '/entities/default/Component/checkout-api',
    );

    expect(response.status).toBe(200);
    expect(response.body.score).toBe(100);
    expect(response.body.passed).toBe(12);
  });

  it('returns 404 when the catalog has no matching entity', async () => {
    const app = await appWith(catalogOf({}));
    const response = await request(app).get(
      '/entities/default/component/missing',
    );

    expect(response.status).toBe(404);
    expect(response.body.error).toBe(
      'Entity not found: component:default/missing',
    );
  });

  it('returns 500 when the catalog lookup throws', async () => {
    const app = await appWith({
      async getEntityByRef() {
        throw new Error('catalog unavailable');
      },
    });
    const response = await request(app).get(
      '/entities/default/component/checkout-api',
    );

    expect(response.status).toBe(500);
    expect(response.body.error).toBe('catalog unavailable');
  });
});
