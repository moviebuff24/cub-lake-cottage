# Vision Boards — Design Spec
**Date:** 2026-06-12  
**Status:** Approved for implementation

---

## Overview

Replace the current single-pool Vision section with a multi-board system. Each board is a self-contained card containing a photo grid, link previews with thumbnails, and a notes field. Users can add as many boards as they want and name them freely (e.g. "Hot Tub Inspo", "Interior Decor", "Dock Ideas").

The approved visual direction is in:
`.superpowers/brainstorm/1223-1781286982/content/board-tiles-v3.html`

---

## Architecture

Three new files, one edit to `page.tsx`:

| File | Purpose |
|---|---|
| `components/vision-boards.tsx` | All board state, Firebase subscription, CRUD, rendering |
| `app/api/link-preview/route.ts` | Server-side og: tag fetching for link previews |
| `page.tsx` | Replace vision section JSX with `<VisionBoards />`, remove old `visionPhotos` state |

`VisionBoards` manages its own Firebase subscription independently — it does not share state with `page.tsx`. Photo uploads within boards use their own file input ref, separate from the existing property/inspiration photo inputs.

---

## Data Model

New Firebase path `visionBoards/` alongside the existing `photos/` path.

```
visionBoards/
  {boardId}/
    id: string
    label: string          // e.g. "Hot Tub Inspo"
    order: number          // integer for display ordering
    notes: string          // free text
    photos/
      {photoId}/
        id: string
        url: string        // base64 data URL (same as existing photo pattern)
        name: string
    links/
      {linkId}/
        id: string
        url: string        // original URL the user pasted
        title: string      // fetched og:title
        description: string // fetched og:description
        thumbnail: string  // fetched og:image URL
```

### Migration

On first load, if the `visionBoards` Firebase snapshot value is `null` (path never written) but `photos/visionPhotos` contains existing photos, migrate those photos into a default board named "Vision Board". The `photos/visionPhotos` path is left untouched — no destructive write.

---

## Components

### `VisionBoards` (top-level export)

- Subscribes to `visionBoards/` in Firebase on mount, unsubscribes on unmount
- Renders a 1-column grid on mobile, 2-column on `md:` breakpoint (768px+), matching the existing page's responsive pattern
- "Add board" dashed tile at the end of the grid opens an inline modal (same pattern as existing `addSlotModal` in `page.tsx`) to enter the board name
- Owns board ordering (by `order` field)

### `BoardTile` (internal, not exported)

**Header:**
- Board label, editable inline on click (blur saves to Firebase)
- `+ Photo` button and `⋯` menu
- `⋯` menu contains: "Delete board" (requires confirmation before writing to Firebase)

**Photo grid:**
- Same 4/3 aspect ratio tile grid as the existing inspiration board
- Click tile to upload, ✕ on hover to remove
- Photos stored at `visionBoards/{boardId}/photos/`
- Dashed `+` tile at the end for adding more photos
- Own `<input type="file">` ref, accepts `image/*`

**Links section:**
- Text input (URL paste/enter triggers fetch)
- On paste or Enter: POST to `/api/link-preview`, show loading state, then render preview card
- Each saved link renders as a card: thumbnail (left, ~72px wide), site name, favicon (derived at render time from `https://www.google.com/s2/favicons?domain={domain}` — not stored in Firebase), title, description (2-line clamp), ✕ to remove
- If og: fetch fails: fall back to domain name as title, no thumbnail
- "+ Add link" affordance always visible below saved links

**Notes:**
- `<textarea>` with placeholder "Add notes…"
- Debounced 800ms write to `visionBoards/{boardId}/notes`

---

## API Route — `/api/link-preview`

**Method:** POST  
**Body:** `{ url: string }`  
**Returns:** `{ title: string, description: string, thumbnail: string }`

Implementation:
1. Validate the URL (must be http/https)
2. `fetch(url)` server-side with a 5-second timeout and a browser-like User-Agent header (some sites block default fetch agents)
3. Parse the HTML response body for `og:title`, `og:description`, `og:image` using regex
4. If `og:image` is a relative path, resolve it against the base URL
5. Return parsed values; fall back to `{ title: domain, description: '', thumbnail: '' }` on any error

No external dependency needed — native `fetch` + regex is sufficient.

---

## Mockup Reference

The final approved visual design is at:
`.superpowers/brainstorm/1223-1781286982/content/board-tiles-v3.html`

Key visual details from the mockup:
- Board tiles: `background: #fff`, `border: 1px solid #d0e4cc`, `border-radius: 16px`
- Photo grid: 3 columns, `aspect-ratio: 4/3`, `border-radius: 8px`
- Link preview card: thumbnail 72px wide on the left, title + description text on the right
- Section labels ("Links", "Notes"): `0.63rem`, uppercase, `color: #8aaa88`
- "Add board" tile: dashed border, matches existing "Add Category" style in inspiration board

---

## Out of Scope

- Drag-to-reorder boards (boards can be added/deleted; reordering is not included in this pass)
- Drag-to-reorder photos within a board (same as above)
- Sharing individual boards or making them public
- Caching link previews beyond Firebase storage
