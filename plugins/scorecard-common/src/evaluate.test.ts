import { Entity } from '@backstage/catalog-model';
import {
  evaluateScorecard,
  gradeFor,
  SCORECARD_CHECK_IDS,
} from './evaluate';

function entity(partial: Partial<Entity> & Pick<Entity, 'kind'>): Entity {
  return {
    apiVersion: 'backstage.io/v1alpha1',
    spec: {},
    ...partial,
    metadata: {
      name: 'example',
      ...partial.metadata,
    },
  };
}

function readyService(): Entity {
  return entity({
    kind: 'Component',
    metadata: {
      name: 'checkout-api',
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
  });
}

describe('gradeFor', () => {
  it.each([
    [100, 'A'],
    [90, 'A'],
    [89.99, 'B'],
    [75, 'B'],
    [74.99, 'C'],
    [60, 'C'],
    [59.99, 'D'],
    [40, 'D'],
    [39.99, 'F'],
    [0, 'F'],
  ] as const)('maps %s to %s', (score, grade) => {
    expect(gradeFor(score)).toBe(grade);
  });
});

describe('evaluateScorecard', () => {
  it('uses stable check ids', () => {
    expect(new Set(SCORECARD_CHECK_IDS).size).toBe(SCORECARD_CHECK_IDS.length);
    expect(SCORECARD_CHECK_IDS).toEqual([
      'owner',
      'description',
      'lifecycle',
      'production-lifecycle',
      'system',
      'source',
      'techdocs',
      'oncall',
      'runbook',
      'slo',
      'tests',
      'api-relation',
    ]);
  });

  it('scores a fully annotated production service as 100 / A', () => {
    const result = evaluateScorecard(readyService());

    expect(result.entityRef).toBe('component:default/checkout-api');
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
    expect(result.failed).toBe(0);
    expect(result.passed).toBe(result.applicable);
    expect(result.checks.every(check => check.status === 'passed')).toBe(true);
  });

  it('fails individual missing annotations without dropping the other checks', () => {
    const service = readyService();
    delete service.metadata.annotations?.['marlow.dev/runbook'];
    delete service.metadata.annotations?.['marlow.dev/slo'];
    service.spec = {
      ...service.spec,
      lifecycle: 'experimental',
    };

    const result = evaluateScorecard(service);
    const byId = Object.fromEntries(
      result.checks.map(check => [check.id, check.status]),
    );

    expect(byId.runbook).toBe('failed');
    expect(byId.slo).toBe('failed');
    expect(byId['production-lifecycle']).toBe('failed');
    expect(byId.lifecycle).toBe('passed');
    expect(byId.owner).toBe('passed');
    expect(result.failed).toBe(3);
    expect(result.score).toBe(Math.round((9 / 12) * 100));
    expect(result.grade).toBe('B');
  });

  it('rejects an SLO that is below 99% or not a percentage', () => {
    const low = readyService();
    low.metadata.annotations = {
      ...low.metadata.annotations,
      'marlow.dev/slo': '98%',
    };
    expect(
      evaluateScorecard(low).checks.find(check => check.id === 'slo')?.status,
    ).toBe('failed');

    const malformed = readyService();
    malformed.metadata.annotations = {
      ...malformed.metadata.annotations,
      'marlow.dev/slo': 'three nines',
    };
    expect(
      evaluateScorecard(malformed).checks.find(check => check.id === 'slo')
        ?.detail,
    ).toContain('99.9%');
  });

  it('accepts a GitHub project slug as the source location', () => {
    const service = readyService();
    delete service.metadata.annotations?.['backstage.io/source-location'];
    service.metadata.annotations = {
      ...service.metadata.annotations,
      'github.com/project-slug': 'marlow-labs/checkout-api',
    };

    expect(
      evaluateScorecard(service).checks.find(check => check.id === 'source')
        ?.status,
    ).toBe('passed');
  });

  it('does not require an SLO or API relation for a website', () => {
    const website = entity({
      kind: 'Component',
      metadata: {
        name: 'storefront-web',
        description: 'Customer storefront that renders the commerce catalog.',
        annotations: {
          'github.com/project-slug': 'marlow-labs/storefront-web',
          'backstage.io/techdocs-ref': 'dir:.',
          'marlow.dev/oncall': 'storefront',
          'marlow.dev/runbook': 'https://marlow.example/runbooks/storefront',
          'marlow.dev/has-tests': 'true',
        },
      },
      spec: {
        type: 'website',
        lifecycle: 'production',
        owner: 'group:default/storefront',
        system: 'storefront',
      },
    });

    const result = evaluateScorecard(website);
    const byId = Object.fromEntries(
      result.checks.map(check => [check.id, check.status]),
    );

    expect(byId.slo).toBe('not-applicable');
    expect(byId['api-relation']).toBe('not-applicable');
    expect(result.applicable).toBe(10);
    expect(result.score).toBe(100);
    expect(result.grade).toBe('A');
  });

  it('fails an empty owner and a short description', () => {
    const result = evaluateScorecard(
      entity({
        kind: 'Component',
        metadata: { name: 'legacy-billing-sync', description: 'old' },
        spec: { type: 'service', lifecycle: 'deprecated', owner: '   ' },
      }),
    );
    const byId = Object.fromEntries(
      result.checks.map(check => [check.id, check.status]),
    );

    expect(byId.owner).toBe('failed');
    expect(byId.description).toBe('failed');
    expect(byId.lifecycle).toBe('passed');
    expect(byId['production-lifecycle']).toBe('failed');
    expect(result.grade).toBe('F');
  });

  it('counts an API review annotation as the API relationship', () => {
    const service = readyService();
    service.spec = {
      type: 'service',
      lifecycle: 'production',
      owner: 'group:default/checkout',
      system: 'checkout',
    };
    service.metadata.annotations = {
      ...service.metadata.annotations,
      'marlow.dev/api-reviewed': 'true',
    };

    expect(
      evaluateScorecard(service).checks.find(
        check => check.id === 'api-relation',
      )?.status,
    ).toBe('passed');
  });

  it('skips component-only checks for a location', () => {
    const result = evaluateScorecard(
      entity({
        kind: 'Location',
        metadata: {
          name: 'seed-catalog',
          description: 'File location that loads the Marlow catalog seed.',
          annotations: {
            'backstage.io/source-location':
              'url:https://github.com/martincouso-star/self-service-developer-portal',
            'backstage.io/techdocs-ref': 'dir:.',
          },
        },
        spec: { owner: 'group:default/platform' },
      }),
    );
    const byId = Object.fromEntries(
      result.checks.map(check => [check.id, check.status]),
    );

    expect(byId.owner).toBe('passed');
    expect(byId.lifecycle).toBe('not-applicable');
    expect(byId.system).toBe('not-applicable');
    expect(byId.oncall).toBe('not-applicable');
    expect(byId.slo).toBe('not-applicable');
    expect(byId.tests).toBe('not-applicable');
    expect(result.score).toBe(100);
  });
});
