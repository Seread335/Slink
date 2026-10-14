# ADR 0001 — Runtime and system-of-record storage

- **Status:** Accepted for implementation; revisit only if deployment evidence changes the trade-offs.
- **Date:** 2026-10-12
- **Purpose:** Choose a foundation that can support real stores, several staff/devices, durable records, and transactional sales without replacing the approved PWA interface.

## Decision

- Keep the current plain-JavaScript PWA as the client and keep its visual system.
- Add a same-origin JSON API using **Node.js 24 LTS** and **Fastify 5**.
- Use **PostgreSQL** as the authoritative system of record. Require a PostgreSQL major release still supported by its upstream project at deployment time.
- Use a typed/validated API contract, parameterized SQL, explicit database migrations, and transaction-scoped domain operations. Store no business-critical state only in browser storage.
- Keep the implementation provider-neutral: production deployment needs an approved Node host and managed PostgreSQL, but the API must not depend on a single cloud vendor.

## Why this fits the verified workspace

- The client is already plain JavaScript and has no build pipeline; a JSON API keeps the accepted UI and avoids a forced framework rewrite.
- Real sales, returns, tenders, stock movements, and balances must change together. PostgreSQL transactions are designed to commit or roll back a unit of work and support concurrent clients.
- Node 24 is available in the workspace and is in the upstream LTS line. Fastify 5 supports maintained Node.js releases; its current LTS policy follows Node.js supported release lines.
- The available Node 24 `node:sqlite` API is listed by upstream as **release candidate**, and file-local SQLite would not create a multi-device system of record. Do not use that experimental/release-candidate API for production storage.
- No Docker, PostgreSQL server/client, account credentials, mail provider, hosting project, or payment/invoice provider exists in the current workspace. The application code can be built here; live deployment/integrations need those external resources.

## Rejected for the production system of record

### Browser `localStorage`

It is device-scoped, available to client-side code, has no server authorization or transaction boundary, and cannot coordinate concurrent devices. Keep it only for non-sensitive UI preferences or an explicitly labelled offline cache.

### Node built-in SQLite / one JSON file

They are convenient for a local proof, but do not provide the chosen multi-user deployment boundary here. In addition, Node upstream marks SQLite release-candidate in this runtime line. Do not build a temporary local persistence layer and label it production-ready.

### A single-vendor backend as an implicit dependency

No user-owned project or credentials are connected. Do not choose or create an external service account silently. Preserve portable API/database boundaries until the user supplies or authorizes the production destination.

## Security and data constraints for implementation

- Tenant/store scope comes from authenticated membership on the server, never a client-provided `storeId` alone.
- Use password hashes from a maintained password-hashing implementation, opaque server-side sessions, secure cookie flags, CSRF/origin protection, rate limits, and secret configuration outside source control.
- Put sales, tender/refund records, stock movements, receivable/payable entries, cashbook entries, and audit events in the same transaction boundary where they represent one business action.
- Enforce retry idempotency and inventory availability under concurrent writes; return conflict responses where a retry cannot safely be merged.
- Money is integer VND. Use explicit store timezone and store business-date boundaries.
- Retain immutable financial/inventory history; corrections use reversing/adjustment records with actor, reason, time, and links to the original record.
- Browser offline queue is a later explicit design: pending and acknowledged operations must be distinguishable. No optimistic message may say “đã thanh toán” before a provider confirms it.

## Consequences and next actions

- Add project package/dependency lock, API, migration runner, PostgreSQL development configuration, server-side authorization, and integration tests.
- Separate domain services from routes and static serving. The current app must migrate from wholesale client-state saves to validated domain APIs.
- Keep sample data out of production migrations and account creation; seed only an isolated development/demo environment.
- External production rollout stays open until a hosting/PostgreSQL provider is chosen and configured with user-authorized credentials.
- A persistent local PGlite runtime is provided only to make development and workflow review runnable without a native PostgreSQL install. It serializes local requests and locks its data directory, but does not replace the production PostgreSQL deployment or multi-device/security acceptance.

## Source basis

- [Node.js release lines](https://nodejs.org/en/about/previous-releases)
- [Node.js 24 line status](https://nodejs.org/en/blog/migrations/v22-to-v24)
- [Node.js SQLite API and stability](https://nodejs.org/download/release/latest-v24.x/docs/api/sqlite.html)
- [Fastify documentation](https://fastify.dev/docs/latest/)
- [Fastify LTS policy](https://fastify.dev/docs/latest/Reference/LTS/)
- [PostgreSQL transaction processing](https://www.postgresql.org/docs/current/transactions.html)
