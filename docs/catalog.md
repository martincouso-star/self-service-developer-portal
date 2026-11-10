# Catalog

The seed catalog describes Marlow. It is not a dump of a real company, and the
GitHub slugs under `marlow-labs` are labels in the descriptors. The portal
repository itself is the only slug that points at this project.

## Layout

| Path | What it contains |
| --- | --- |
| `catalog-info.yaml` | This portal |
| `catalog/domains.yaml` | `commerce` and `platform` |
| `catalog/systems.yaml` | Checkout, identity, storefront, developer platform |
| `catalog/org.yaml` | Teams and people, plus the development guest user |
| `catalog/apis.yaml` | OpenAPI and AsyncAPI descriptors |
| `catalog/resources.yaml` | Postgres databases |
| `catalog/components.yaml` | Services that demonstrate missing scorecard checks |
| `catalog/components/checkout-api/` | A service with TechDocs and a full scorecard |
| `catalog/components/identity-api/` | A second documented service |

`app-config.yaml` registers each file as a catalog location. Paths are relative
to `packages/backend`, which is the backend process working directory.

## Ownership

Components, APIs, systems, and domains use full owner refs such as
`group:default/checkout`. Guest sign-in is `user:development/guest`, which is a
member of `group:default/guests`.
