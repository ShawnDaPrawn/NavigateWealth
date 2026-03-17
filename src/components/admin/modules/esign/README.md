# E-Signature Module

## Purpose

Provides document preparation, field placement, and signature collection workflows for advisers and clients. Integrates PDF rendering via pdf.js with a drag-and-drop field placement studio.

## Architecture

- **Query hooks**: `useEnvelopesQuery.ts` contains the React Query hooks and the authoritative `esignKeys` query key factory. The legacy `useEnvelopes.ts` hook has been migrated to use React Query internally for backward compatibility.
- **Mutation hooks**: `useEnvelopeMutations.ts` handles document upload, field saving, envelope sending, voiding, and OTP-based signing flows.
- **PDF rendering**: `PDFViewer.tsx` uses pdf.js (npm import) with canvas-based rendering. Page dimensions are read from the actual PDF metadata, not hardcoded.
- **Field placement**: `PrepareFormStudio.tsx` is a three-column editor (palette, canvas, properties) with undo/redo history.

## Key Constraints

- The pdf.js worker is loaded from CDN (jsdelivr) matching the installed library version to avoid CSP issues.
- Signer colours are assigned by index from `SIGNER_COLORS` in `constants.ts` for consistency across the UI.
- All icon-only buttons in this module carry `aria-label` attributes for WCAG 2.1 AA compliance.
