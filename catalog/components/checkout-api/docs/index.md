# Checkout API

Checkout API accepts a basket and returns a checkout id. It calls Identity
to confirm the shopper session and Payments to authorize the card.

The catalog entry for this service is annotated so the production-readiness
scorecard passes every applicable check: owner, lifecycle, source, TechDocs,
on-call, runbook, SLO, and tests.

This repository path is fictional seed data. The docs file exists so the
portal can generate TechDocs from `dir:.` next to `catalog-info.yaml`.
