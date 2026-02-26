# Fork-Workspace Design Proposal

## Problem Statement

The fork API (`POST /projects/:id/fork`) currently assigns the forked project to the **source project's workspace** (line 265 of `projects.ts`):

```ts
workspaceId: sourceProject.workspaceId,  // BUG: should be forker's workspace
```

This causes:
1. **Ownership confusion** — the fork appears in the original creator's workspace, not the forker's
2. **Billing misattribution** — generation credits are charged against the wrong workspace
3. **Access control violations** — the forker may not be a member of the source workspace, causing 401 errors on subsequent API calls
4. **Cross-workspace asset leakage** — assets generated in the fork are stored under the source workspace

## Proposed Fix (Phase 2B)

### Option A: Asset Grants (Recommended)

The fork is created in the **forker's workspace**. Upstream source release assets remain in the original workspace. The fork project gets **read-only grants** to reference those assets by ID without copying them.

#### DB Changes

```sql
-- New table: asset_grants
CREATE TABLE asset_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES assets(id),
  granted_to_workspace_id UUID NOT NULL REFERENCES workspaces(id),
  granted_by_project_id UUID NOT NULL REFERENCES projects(id),  -- source release context
  source_release_id UUID REFERENCES source_releases(id),
  access_level TEXT NOT NULL DEFAULT 'read',  -- 'read' only for Phase 2B
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,  -- NULL = never expires
  UNIQUE(asset_id, granted_to_workspace_id)
);

CREATE INDEX asset_grants_workspace_idx ON asset_grants(granted_to_workspace_id);
CREATE INDEX asset_grants_asset_idx ON asset_grants(asset_id);
```

#### API Changes

1. **Fork endpoint** (`POST /projects/:id/fork`):
   - Change `workspaceId` from `sourceProject.workspaceId` to the forker's workspace (from JWT `request.user.workspaceId` or request body)
   - After creating the fork, insert `asset_grants` rows for each asset in the selected source release
   - No asset data is copied — only grant records

2. **Asset access middleware** — modify asset read endpoints (`GET /assets/:id`, `GET /assets/:id/download`) to check:
   ```
   asset.workspaceId === requestWorkspaceId
   OR EXISTS asset_grant WHERE asset_id = :id AND granted_to_workspace_id = requestWorkspaceId
   ```

3. **Render worker** — when resolving shot asset references during render, apply the same grant check so forked projects can render with upstream assets

4. **Upstream Library component** — no change needed; it already fetches assets via the release endpoint which is public/share-token gated

#### Pros
- No data duplication — storage efficient
- Original creator retains full ownership of assets
- Grants can be revoked (e.g., license expiry)
- Clear audit trail of cross-workspace access

#### Cons
- Adds a new authorization layer to every asset read
- If original asset is deleted, forked projects break (mitigated: soft-delete + grant check)

---

### Option B: Asset Cloning

The fork copies all source release assets into the forker's workspace. Each cloned asset gets a new ID but retains provenance linking back to the original.

#### DB Changes

```sql
-- New columns on assets table
ALTER TABLE assets ADD COLUMN cloned_from_asset_id UUID REFERENCES assets(id);
ALTER TABLE assets ADD COLUMN clone_source_workspace_id UUID REFERENCES workspaces(id);
```

#### API Changes

1. **Fork endpoint**: Change workspace assignment + deep-copy each source release asset into the forker's workspace
2. **Commit snapshot rewriting**: After cloning assets, rewrite all `visual_asset_id` / `audio_asset_id` references in the copied commits to point to the new cloned asset IDs
3. **Provenance chain**: Each cloned asset's `provenance` manifest links back to the original via `cloned_from_asset_id`

#### Pros
- Simpler authorization — no cross-workspace reads needed
- Fork is fully self-contained; survives if source is deleted

#### Cons
- Storage duplication (video files can be large)
- Asset ID rewriting in snapshots is error-prone
- Harder to track license compliance (clones are independent)
- No mechanism to revoke access after cloning

---

## Recommendation

**Option A (Asset Grants)** is the better fit for Phork's architecture because:
1. The 6 Core Invariants emphasize **immutable asset provenance** — grants preserve the original asset identity without creating duplicates
2. License enforcement (revocation, expiry) is a natural extension
3. Storage costs are linear rather than multiplicative with fork count
4. The Upstream Library UI already fetches assets by release, so the grant check only affects render-time resolution and direct asset downloads

## E2E Assertions (Phase 2B)

1. **Fork creates project in forker's workspace** — `SELECT workspace_id FROM projects WHERE id = :forkId` matches forker's workspace
2. **Asset grants exist** — `SELECT * FROM asset_grants WHERE granted_to_workspace_id = :forkerWs` returns one row per source release asset
3. **Forker can access upstream assets** — `GET /assets/:upstreamAssetId` succeeds with forker's token
4. **Forker can render with upstream assets** — render job succeeds and output video is created
5. **Grant revocation blocks access** — after deleting grant row, `GET /assets/:upstreamAssetId` returns 403
6. **Credits charged to forker's workspace** — credit ledger entries for fork generations reference forker's workspace_id
7. **Source workspace unaffected** — source workspace credit balance unchanged after fork generates content

## Implementation Timeline

| Task | Estimate |
|------|----------|
| Create `asset_grants` table + migration | 0.5 day |
| Fix fork endpoint workspace assignment | 0.5 day |
| Insert grants on fork (from source release) | 0.5 day |
| Asset access middleware (grant check) | 1 day |
| Render worker grant resolution | 0.5 day |
| E2E test suite for fork-workspace flow | 1 day |
| **Total** | **4 days** |
