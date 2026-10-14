# Instructions for work on Slink

Before changing this project, read these documents in order:

1. [`docs/PROJECT_MANDATE.md`](docs/PROJECT_MANDATE.md) — the persistent reminder of the user’s actual goal, how to work, and what counts as evidence.
2. [`docs/BUILD_CHARTER.md`](docs/BUILD_CHARTER.md) — the user’s actual end goal and non-negotiable product rules.
3. [`docs/DELIVERY_ROADMAP.md`](docs/DELIVERY_ROADMAP.md) — current evidence, open gaps, priority order, and release gates.

Also read [`docs/PRODUCT.md`](docs/PRODUCT.md) before changing business workflows. [`docs/README.md`](docs/README.md) explains the purpose and reading order of the documentation set.

## Keep the real goal in view

Slink is meant to become a paid, customer-deliverable retail operations product that can be used for real transactions on iOS and Android 10+. The existing interface is an accepted design direction. Do not describe the product as complete while essential workflows, durable data, security, deployment, and release evidence remain unfinished.

## Build real behavior

- A screen is complete only when its action validates input, changes the correct business records, preserves history, survives reload/device change as required, and reports failures clearly.
- Do not substitute sample numbers, local-only mutations, inert controls, or success messages for a real business operation.
- Preserve money as integer VND at storage boundaries. Make stock, order, payment, debt, return, and cashbook changes atomic and traceable.
- Prevent overselling, over-refunding, duplicate submissions, cross-store data access, and silent data loss.
- Keep demo data visibly separate from a real store. Never seed demo sales into a customer’s production account.
- Preserve the accepted visual language unless a usability or accessibility issue requires a focused change.
- Keep user-facing copy in Vietnamese and design for touch, small screens, keyboard input, and assistive technologies.

## Maintain continuity

- Update `docs/DELIVERY_ROADMAP.md` whenever evidence changes a milestone status or reveals a new blocker.
- Every milestone must name its purpose, implementation scope, dependencies, and evidence required to pass.
- Do not mark a milestone complete based only on files existing or code compiling. Use runtime and business-flow evidence appropriate to the requirement.
- Record assumptions when external accounts, provider credentials, legal review, hosting, or device access are unavailable. Never invent credentials or claim a deployment that did not happen.
- Keep the roadmap active until every release gate in `docs/BUILD_CHARTER.md` has evidence.
