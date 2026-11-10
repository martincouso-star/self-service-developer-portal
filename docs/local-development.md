# Local development

The app is meant to start with Node.js 22, Yarn 4, and no cloud credentials.

```sh
yarn install
yarn start
```

Open http://localhost:3000 and choose Guest.

Copy `.env.example` to `.env` when you want the GitHub integration to publish
templates. The backend reads `GITHUB_TOKEN` from the environment. An empty
value is valid and leaves the integration installed without a token.

SQLite files are written to `.local-data/` at the repository root. That
directory is gitignored. Set `SQLITE_DIR` to move it. The path is resolved from
`packages/backend`.

## TechDocs

TechDocs generation runs locally with MkDocs, not Docker:

```sh
pip install mkdocs-techdocs-core
```

`mkdocs.yml` at the repository root is the portal doc site. Component docs for
checkout and identity sit next to their `catalog-info.yaml` files because the
annotation is `backstage.io/techdocs-ref: dir:.`.

## Checks

```sh
yarn lint:all
yarn tsc
yarn test
yarn build
yarn validate
```

`yarn validate` checks catalog and template YAML, entity references, and the
required skeleton files.
