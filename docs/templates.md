# Software templates

Two templates are registered from `templates/`:

- **FastAPI Service** (`template:default/fastapi-service`) generates a Python
  service with `app/main.py`, `tests/test_health.py`, a Dockerfile, a GitHub
  Actions workflow, TechDocs, and `catalog-info.yaml`.
- **Node.js Service** (`template:default/node-service`) generates a TypeScript
  HTTP service with `src/server.ts`, `src/server.test.ts`, a Dockerfile, CI,
  TechDocs, and `catalog-info.yaml`.

## What you fill in

The form asks for a name, description, owner, system, on-call rotation, runbook
URL, and a GitHub repository location. `publishToGithub` defaults to false so
the fetch step can run without a token. Turn it on only when `GITHUB_TOKEN` is
set. The publish step uses `publish:github`, then `catalog:register` reads
`catalog-info.yaml` from the new repository.

## Dry run

On the template page, use the dry-run control after filling the form. Backstage
renders the skeleton with your values and shows the files. It does not need
GitHub credentials. Executing with publish left off stops after the skeleton is
rendered in the scaffolder workspace.

The skeleton `catalog-info.yaml` files contain `${{ values.* }}` placeholders.
They are not catalog locations. Only `template.yaml` is registered.
