# Marlow Developer Portal

This is the documentation for the portal itself. Marlow is a fictional commerce
company used as seed data. The running app is a Backstage portal with a local
SQLite database and guest sign-in.

Use the portal to:

- browse systems, components, APIs, and teams in the software catalog
- scaffold a FastAPI or Node.js service from a software template
- read TechDocs on a component page
- see the production-readiness scorecard on a component overview

The catalog files live in `catalog/`. The templates live in `templates/`.
The scorecard rules live in `plugins/scorecard-common` and are shared by the
entity card and the backend API.
