# Architecture decisions

## ADR-001: Keep Next.js
The existing user interface and route handlers are reusable. Rewriting the application would increase delivery risk.

## ADR-002: Use Supabase PostgreSQL
Supabase provides PostgreSQL, authentication, row-level security, storage, and a management interface suitable for the ten-day prototype. The relational schema remains portable.

## ADR-003: Store files outside database rows
Videos, images, invoices, and contracts are stored in object storage. Database tables store metadata, ownership, status, and storage paths.

## ADR-004: Modular monolith
The first version remains one Next.js application, organized into domain, service, repository, and UI modules. This is faster than microservices and remains expandable.

## ADR-005: Official social APIs plus fallback
Metrics are synchronized through official APIs when permissions and ownership allow. Otherwise, the system accepts verified manual snapshots. Every snapshot records source and collection time.

## ADR-006: Employee performance is event-based
Performance uses assignments, deadlines, review cycles, response time, data completion, and audit events. It must not depend on a single subjective score.

## ADR-007: Legacy lint exceptions are file-scoped
The inherited SmartSuite routes use untyped response payloads and old effect patterns. Temporary ESLint exceptions are limited to legacy files so the clean baseline can be validated. New Supabase/domain code must pass strict rules, and each exception is removed during migration.
