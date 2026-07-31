# ADR-0005: Cloudinary for uploads, with a local-disk dev fallback

- **Status**: Accepted (backfilled)
- **Date**: 2026-07-31 (documents the decision when uploads shipped)

## Context

The app stores images (avatars, receipts, payment QR codes). Vercel's
filesystem is read-only/ephemeral, so production needs object storage.
Alternatives: S3/R2 (more setup: buckets, CDN, signing), Vercel Blob
(vendor lock, newer), UploadThing (another vendor). Local dev should need
zero configuration.

## Decision

Cloudinary via server-side signed uploads (`src/lib/cloudinary.ts`, API
secret never reaches the browser), activated only when all three
`CLOUDINARY_*` env vars are set; otherwise files land in
`public/uploads/` on disk. Regardless of backend, uploads are compressed
client-side first (`src/lib/upload/compress-image-client.ts`) and validated
server-side by type, size, and magic bytes
(`src/lib/validation/upload-path.ts`). `next.config.ts` allow-lists only
`res.cloudinary.com/<cloud-name>` for `next/image`.

## Consequences

Zero-config local dev, free-tier-friendly production with CDN delivery and
image transforms available later. Costs: the local fallback silently
doesn't persist on Vercel — Cloudinary is effectively mandatory in
production (documented in SCALING.md) — and we accept a vendor dependency.
Revisit if transformation quotas or pricing bite; the storage interface is
narrow enough to swap for R2.
