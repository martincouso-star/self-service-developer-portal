import { Entity } from '@backstage/catalog-model';

/**
 * Production-readiness grade. Thresholds are inclusive on the lower bound.
 * A is 90-100, B is 75-89, C is 60-74, D is 40-59, and F is below 40.
 */
export type ScorecardGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export type ScorecardCheckStatus = 'passed' | 'failed' | 'not-applicable';

export interface ScorecardCheck {
  id: string;
  title: string;
  description: string;
  status: ScorecardCheckStatus;
  detail: string;
}

export interface ScorecardResult {
  entityRef: string;
  score: number;
  grade: ScorecardGrade;
  passed: number;
  failed: number;
  applicable: number;
  checks: ScorecardCheck[];
}

interface CheckOutcome {
  passed: boolean;
  detail: string;
}

interface CheckDefinition {
  id: string;
  title: string;
  description: string;
  applies: (entity: Entity) => boolean;
  evaluate: (entity: Entity) => CheckOutcome;
}

const MINIMUM_DESCRIPTION_LENGTH = 20;
const MINIMUM_SLO_PERCENT = 99;

export function gradeFor(score: number): ScorecardGrade {
  if (score >= 90) {
    return 'A';
  }
  if (score >= 75) {
    return 'B';
  }
  if (score >= 60) {
    return 'C';
  }
  if (score >= 40) {
    return 'D';
  }
  return 'F';
}

function kindOf(entity: Entity): string {
  return entity.kind.toLowerCase();
}

function isComponent(entity: Entity): boolean {
  return kindOf(entity) === 'component';
}

function isLifecycleKind(entity: Entity): boolean {
  const kind = kindOf(entity);
  return kind === 'component' || kind === 'api';
}

function specValue(entity: Entity, key: string): unknown {
  return entity.spec?.[key];
}

function specString(entity: Entity, key: string): string | undefined {
  const value = specValue(entity, key);
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function specStringList(entity: Entity, key: string): string[] {
  const value = specValue(entity, key);
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter(
    (item): item is string => typeof item === 'string' && item.trim() !== '',
  );
}

function annotation(entity: Entity, key: string): string | undefined {
  const value = entity.metadata.annotations?.[key];
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function isService(entity: Entity): boolean {
  return isComponent(entity) && specString(entity, 'type') === 'service';
}

function entityRefOf(entity: Entity): string {
  const namespace = entity.metadata.namespace ?? 'default';
  return `${kindOf(entity)}:${namespace}/${entity.metadata.name}`;
}

const CHECKS: CheckDefinition[] = [
  {
    id: 'owner',
    title: 'Owner assigned',
    description: 'spec.owner names the group or user accountable for the entity.',
    applies: () => true,
    evaluate: entity => {
      const owner = specString(entity, 'owner');
      if (!owner) {
        return { passed: false, detail: 'spec.owner is empty.' };
      }
      return { passed: true, detail: `Owned by ${owner}.` };
    },
  },
  {
    id: 'description',
    title: 'Description',
    description: `metadata.description explains the entity in at least ${MINIMUM_DESCRIPTION_LENGTH} characters.`,
    applies: () => true,
    evaluate: entity => {
      const description = entity.metadata.description?.trim() ?? '';
      if (description.length < MINIMUM_DESCRIPTION_LENGTH) {
        return {
          passed: false,
          detail: `Description is ${description.length} characters; ${MINIMUM_DESCRIPTION_LENGTH} are required.`,
        };
      }
      return {
        passed: true,
        detail: `Description is ${description.length} characters.`,
      };
    },
  },
  {
    id: 'lifecycle',
    title: 'Lifecycle declared',
    description:
      'spec.lifecycle is production, experimental, or deprecated.',
    applies: isLifecycleKind,
    evaluate: entity => {
      const lifecycle = specString(entity, 'lifecycle');
      const allowed = ['production', 'experimental', 'deprecated'];
      if (!lifecycle || !allowed.includes(lifecycle)) {
        return {
          passed: false,
          detail: 'spec.lifecycle must be production, experimental, or deprecated.',
        };
      }
      return { passed: true, detail: `Lifecycle is ${lifecycle}.` };
    },
  },
  {
    id: 'production-lifecycle',
    title: 'Production lifecycle',
    description: 'spec.lifecycle is production.',
    applies: isLifecycleKind,
    evaluate: entity => {
      const lifecycle = specString(entity, 'lifecycle');
      if (lifecycle === 'production') {
        return { passed: true, detail: 'Lifecycle is production.' };
      }
      return {
        passed: false,
        detail: `Lifecycle is ${lifecycle ?? 'unset'}, not production.`,
      };
    },
  },
  {
    id: 'system',
    title: 'System membership',
    description: 'spec.system places the component in a catalog system.',
    applies: isComponent,
    evaluate: entity => {
      const system = specString(entity, 'system');
      if (!system) {
        return { passed: false, detail: 'spec.system is empty.' };
      }
      return { passed: true, detail: `System is ${system}.` };
    },
  },
  {
    id: 'source',
    title: 'Source location',
    description:
      'backstage.io/source-location or github.com/project-slug points at the repository.',
    applies: () => true,
    evaluate: entity => {
      const source = annotation(entity, 'backstage.io/source-location');
      const slug = annotation(entity, 'github.com/project-slug');
      if (source) {
        return { passed: true, detail: `Source location is ${source}.` };
      }
      if (slug) {
        return { passed: true, detail: `GitHub project is ${slug}.` };
      }
      return {
        passed: false,
        detail:
          'Set backstage.io/source-location or github.com/project-slug.',
      };
    },
  },
  {
    id: 'techdocs',
    title: 'TechDocs',
    description: 'backstage.io/techdocs-ref links the entity to documentation.',
    applies: () => true,
    evaluate: entity => {
      const ref = annotation(entity, 'backstage.io/techdocs-ref');
      if (!ref) {
        return {
          passed: false,
          detail: 'Missing annotation backstage.io/techdocs-ref.',
        };
      }
      return { passed: true, detail: `TechDocs ref is ${ref}.` };
    },
  },
  {
    id: 'oncall',
    title: 'On-call rotation',
    description: 'marlow.dev/oncall names the rotation that answers pages.',
    applies: isComponent,
    evaluate: entity => {
      const oncall = annotation(entity, 'marlow.dev/oncall');
      if (!oncall) {
        return {
          passed: false,
          detail: 'Missing annotation marlow.dev/oncall.',
        };
      }
      return { passed: true, detail: `On-call rotation is ${oncall}.` };
    },
  },
  {
    id: 'runbook',
    title: 'Runbook',
    description: 'marlow.dev/runbook is an http(s) URL for incident response.',
    applies: isComponent,
    evaluate: entity => {
      const runbook = annotation(entity, 'marlow.dev/runbook');
      if (!runbook) {
        return {
          passed: false,
          detail: 'Missing annotation marlow.dev/runbook.',
        };
      }
      if (!/^https?:\/\//.test(runbook)) {
        return {
          passed: false,
          detail: 'marlow.dev/runbook must start with http:// or https://.',
        };
      }
      return { passed: true, detail: `Runbook is ${runbook}.` };
    },
  },
  {
    id: 'slo',
    title: 'Service level objective',
    description: `marlow.dev/slo is a percentage of at least ${MINIMUM_SLO_PERCENT}%, for example 99.9%.`,
    applies: isService,
    evaluate: entity => {
      const slo = annotation(entity, 'marlow.dev/slo');
      if (!slo) {
        return { passed: false, detail: 'Missing annotation marlow.dev/slo.' };
      }
      const match = /^(\d+(?:\.\d+)?)%$/.exec(slo);
      if (!match) {
        return {
          passed: false,
          detail: 'marlow.dev/slo must look like 99.9%.',
        };
      }
      const value = Number(match[1]);
      if (value < MINIMUM_SLO_PERCENT) {
        return {
          passed: false,
          detail: `SLO ${slo} is below ${MINIMUM_SLO_PERCENT}%.`,
        };
      }
      return { passed: true, detail: `SLO is ${slo}.` };
    },
  },
  {
    id: 'tests',
    title: 'Automated tests',
    description: 'marlow.dev/has-tests is "true" when CI runs an automated test suite.',
    applies: isComponent,
    evaluate: entity => {
      const hasTests = annotation(entity, 'marlow.dev/has-tests');
      if (hasTests === 'true') {
        return { passed: true, detail: 'Automated tests are declared.' };
      }
      return {
        passed: false,
        detail: 'Set marlow.dev/has-tests to "true" when CI runs tests.',
      };
    },
  },
  {
    id: 'api-relation',
    title: 'API relationship',
    description:
      'A service provides or consumes at least one API, or sets marlow.dev/api-reviewed to "true".',
    applies: isService,
    evaluate: entity => {
      const provides = specStringList(entity, 'providesApis');
      const consumes = specStringList(entity, 'consumesApis');
      if (provides.length > 0 || consumes.length > 0) {
        return {
          passed: true,
          detail: `Provides ${provides.length} and consumes ${consumes.length} APIs.`,
        };
      }
      if (annotation(entity, 'marlow.dev/api-reviewed') === 'true') {
        return {
          passed: true,
          detail: 'API review is recorded on marlow.dev/api-reviewed.',
        };
      }
      return {
        passed: false,
        detail:
          'Add providesApis, consumesApis, or marlow.dev/api-reviewed: "true".',
      };
    },
  },
];

export const SCORECARD_CHECK_IDS: readonly string[] = CHECKS.map(
  check => check.id,
);

/**
 * Evaluate production readiness from catalog spec fields and annotations.
 * The same function is used by the entity card and the scorecard backend.
 */
export function evaluateScorecard(entity: Entity): ScorecardResult {
  const checks = CHECKS.map<ScorecardCheck>(check => {
    if (!check.applies(entity)) {
      return {
        id: check.id,
        title: check.title,
        description: check.description,
        status: 'not-applicable',
        detail: 'This check does not apply to this entity.',
      };
    }
    const outcome = check.evaluate(entity);
    return {
      id: check.id,
      title: check.title,
      description: check.description,
      status: outcome.passed ? 'passed' : 'failed',
      detail: outcome.detail,
    };
  });

  const applicableChecks = checks.filter(
    check => check.status !== 'not-applicable',
  );
  const passed = applicableChecks.filter(
    check => check.status === 'passed',
  ).length;
  const failed = applicableChecks.length - passed;
  const score =
    applicableChecks.length === 0
      ? 0
      : Math.round((passed / applicableChecks.length) * 100);

  return {
    entityRef: entityRefOf(entity),
    score,
    grade: gradeFor(score),
    passed,
    failed,
    applicable: applicableChecks.length,
    checks,
  };
}
