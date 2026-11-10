# Production-readiness scorecard

Component overview pages include a **Production readiness** card. The card and
the backend call `evaluateScorecard` in `@internal/plugin-scorecard-common`, so
they cannot drift.

The score is the percentage of applicable checks that pass, rounded to the
nearest integer.

| Grade | Score |
| --- | --- |
| A | 90 to 100 |
| B | 75 to 89 |
| C | 60 to 74 |
| D | 40 to 59 |
| F | below 40 |

## Checks

| Id | Applies to | Pass condition |
| --- | --- | --- |
| `owner` | Every entity | `spec.owner` is non-empty |
| `description` | Every entity | `metadata.description` is at least 20 characters |
| `lifecycle` | Components and APIs | `spec.lifecycle` is production, experimental, or deprecated |
| `production-lifecycle` | Components and APIs | `spec.lifecycle` is production |
| `system` | Components | `spec.system` is set |
| `source` | Every entity | `backstage.io/source-location` or `github.com/project-slug` |
| `techdocs` | Every entity | `backstage.io/techdocs-ref` |
| `oncall` | Components | `marlow.dev/oncall` |
| `runbook` | Components | `marlow.dev/runbook` is an http(s) URL |
| `slo` | Service components | `marlow.dev/slo` is a percentage of at least 99%, such as `99.9%` |
| `tests` | Components | `marlow.dev/has-tests` is `"true"` |
| `api-relation` | Service components | `providesApis`, `consumesApis`, or `marlow.dev/api-reviewed: "true"` |

Checks that do not apply are listed and left out of the percentage. A website
is not asked for an SLO.

`checkout-api` and `identity-api` in the seed catalog are annotated to pass
every applicable check. `legacy-billing-sync` is intentionally sparse.
`payments-gateway` is in production and is missing TechDocs, a runbook, and an
SLO, so the card shows those gaps.

## HTTP API

The backend plugin is mounted at `/api/scorecard`.

- `GET /api/scorecard/health`
- `POST /api/scorecard/evaluate` with a JSON body `{ "entity": { ... } }`
- `GET /api/scorecard/entities/:namespace/:kind/:name`

This local configuration allows those reads without an auth token, consistent
with the allow-all permission policy shipped for local development. Do not
expose that unauthenticated policy on a shared host.
