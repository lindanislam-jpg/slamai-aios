# Integrations

## External QMS / SharePoint / document systems — NOT CONNECTED

No existing QMS, SharePoint or document store was found configured for this project, and no credentials were provided, so **no live integration exists**. The UI says "Not connected to live QMS" and the Command Centre is the system of record for what it holds.

An adapter interface is ready in `src/lib/integrations/qms.ts` (`QmsAdapter`: `testConnection`, optional `exportNcr`). To connect a system:
1. Confirm which system, its API (e.g. Microsoft Graph for SharePoint) and that IT approves the access.
2. Obtain a dedicated service account / app registration with the **minimum** permissions (read for import; write only to a dedicated library/list if exporting).
3. Implement an adapter, register it, set `QMS_PROVIDER` and the credentials as environment variables.
4. Integrations must be one-way and additive: never overwrite or delete historical records in the other system.

Until then use controlled exchange: Excel exports from every register, and PDF reports.

## AI-assisted photo review — optional

Set `ANTHROPIC_API_KEY` (and optionally `AI_VISION_MODEL`, default `claude-opus-5-5`). The photo page then offers *Generate AI draft*: a caption, description, suggested category and *possible* observations, labelled as an unverified draft. Nothing is applied until a user ticks the fields to copy, and that is recorded in the audit trail. The prompt forbids compliance statements, measurements and identification guesses; the output schema has no fields for acceptance or release. Server-side refusal fallback is enabled on the request. Photos are sent to Anthropic's API when this is used — confirm this is acceptable under company data policy before enabling. HEIC files cannot be analysed (not decodable on the server).

## Storage

`STORAGE_DRIVER=local` (default) keeps files under `STORAGE_DIR`, outside the web root, served only through authenticated routes.
`STORAGE_DRIVER=s3` uses any S3-compatible bucket (`S3_*` variables, server-side encryption requested). The S3 driver is implemented but **has not been tested against a real bucket** in this build.

## Email

Not configured. No emails are sent. Reminders are in-app only. Adding email needs an approved provider (e.g. Microsoft 365 SMTP / Graph) and a decision on who receives what.
