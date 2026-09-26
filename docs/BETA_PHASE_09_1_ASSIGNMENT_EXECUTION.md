# Beta Phase 09.1 — Assignment + Brief + Execution Workflow

Version: `0.1.0-beta.9.1`

## Scope

Phase 09.1 turns a campaign assignment into an operational workflow instead of a simple participant record.

The execution path is now:

`accepted → brief_pending → product_pending (when PR/product is required) → content_pending → existing content review workflow`

## Added

- Creator-specific brief override while preserving the campaign brief.
- Explicit product / PR requirement and fulfillment status.
- Product dispatched / received timestamps.
- Coordinator execution notes.
- Execution milestone panel on the staff assignment page.
- Read-only execution summary in the influencer portal.
- Workflow audit table (`assignment_execution_events`).
- Protected RPC for workflow transitions.
- Coordinator progress now includes acceptance, brief, and PR/product milestones.
- Newly accepted community applications start at `brief_pending`, not `invited`.

## Permissions

- Admin / Coordinator: can update execution workflow.
- Reviewer / Finance / Viewer: no execution mutation through this RPC.
- Influencer: read-only current workflow in their portal.

## Not included yet

Phase 09.2 will focus on the full content cycle: submission versions, change requests, re-upload, approval, publication link, performance/results, and final task closure.
