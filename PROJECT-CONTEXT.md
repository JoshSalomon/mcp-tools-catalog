# MCP Tools Catalog - Project Context

**Last Updated**: 2025-12-30  
**Version**: 0.1.0-alpha  
**Status**: PoC Development (Pre-Demo)

This document provides comprehensive context for developers joining the MCP Tools Catalog project. It covers all implementation phases from initial catalog browsing through current editing capabilities.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [Architecture](#architecture)
3. [Development Principles](#development-principles)
4. [What's Implemented](#whats-implemented)
5. [What's Deferred](#whats-deferred)
6. [Key Implementation Details](#key-implementation-details)
7. [Getting Started](#getting-started)
8. [Testing & Validation](#testing--validation)
9. [Known Issues & Workarounds](#known-issues--workarounds)
10. [Future Architectural Considerations](#future-architectural-considerations)

---

## Project Overview

### What Is It?

The **MCP Tools Catalog** is an OpenShift Console dynamic plugin that provides a catalog interface for browsing and managing Model Context Protocol (MCP) entities:

- **MCP Servers**: Services that expose MCP tools
- **MCP Tools**: Individual capabilities provided by servers
- **MCP Workloads**: User-defined combinations of tools from multiple servers

### Project Goals

**Implemented** (Phases 001-004):
1. ✅ **Browse Catalog**: Users can explore available MCP servers, tools, and workloads (Phase 001)
2. ✅ **Manage Tool States**: Admins can enable/disable tools with batch save operations (Phases 002, 004)
3. ✅ **Entity Management API**: RESTful CRUD API with RBAC for all entity types (Phase 003)
4. ✅ **Manage Workloads**: Users can create, edit, and delete workloads via UI (Phase 004)
5. ✅ **GitOps Integration**: Support YAML-defined entities with GitHub catalog provider (Phase 001)

**Future Enhancements**:
6. 🔮 Auto-discovery of MCP servers
7. 🔮 Health monitoring and status indicators
8. 🔮 Usage analytics and metrics
9. 🔮 Conflict detection for concurrent edits (T034/T035)
10. 🔮 Tool recommendation engine

### Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| **Frontend** | React | 17.x |
| **UI Framework** | PatternFly | 6.2+ |
| **Language** | TypeScript | 4.7+ |
| **Console Integration** | OpenShift Console Plugin SDK | 1.4.0 |
| **Backend** | Backstage (Node.js/Express) | Latest |
| **Database** | SQLite | 3.x |
| **Testing** | Jest + React Testing Library | Latest |
| **Container** | UBI9 Nginx (frontend), Node (backend) | Latest |

---

## Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   OpenShift Console UI                      │
│                 (React + PatternFly)                        │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│               Console Plugin Proxy                          │
│     /api/mcp-entity-api/* → Backstage Backend              │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                  Backstage Backend                          │
│            (Custom MCP Entity API Plugin)                   │
│                                                             │
│  ┌─────────────────┐        ┌──────────────────┐          │
│  │  Catalog API    │◄───────┤  MCP Entity API  │          │
│  │  (Read YAML)    │        │  (CRUD + Merge)  │          │
│  └────────┬────────┘        └────────┬─────────┘          │
│           │                          │                     │
│           │     ┌────────────────────┼──────────┐         │
│           │     │                    │          │         │
│           ▼     ▼                    ▼          ▼         │
│  ┌────────────────────┐    ┌──────────────────────┐      │
│  │  Backstage Catalog │    │  SQLite Database     │      │
│  │  (YAML Entities)   │    │  (User Edits + API)  │      │
│  └────────────────────┘    └──────────────────────┘      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                         ▲
                         │
                  ┌──────┴────────┐
                  │  GitHub YAML  │
                  │  Entity Files │
                  └───────────────┘
```

### Key Architectural Decisions

#### 1. Merge Architecture (Catalog + Database)

**Why**: Backstage Catalog is the source of truth for YAML-defined entities, but we need to store user edits and API-created entities.

**How**: 
- YAML entities live in Backstage Catalog (read-only from YAML files)
- User edits and API-created entities live in SQLite database
- Backend merges both sources: Database overrides win for editable fields

**Trade-offs**:
- ✅ GitOps-friendly (YAML entities in Git)
- ✅ API-driven (programmatic entity creation)
- ⚠️ Complex merge logic
- ⚠️ Eventual consistency (API entities propagate to catalog asynchronously)

#### 2. Soft Delete for YAML Entities

**Why**: YAML entities are continuously re-ingested from Git. Hard delete doesn't work—they reappear.

**How**: Mark YAML entities with `mcp-catalog.io/deleted: 'true'` annotation in database. Filter them from UI.

**Trade-offs**:
- ✅ Prevents "zombie entities" from reappearing
- ✅ Reversible (undelete via admin API)
- ⚠️ Database grows (deleted entities remain)

#### 3. Frontend-Only Plugin (No Catalog Backend Modifications)

**Why**: Minimize changes to Backstage core. Plugin should be self-contained.

**How**: Custom backend plugin (`mcp-entity-api`) provides RESTful API. Frontend talks exclusively to this API.

**Trade-offs**:
- ✅ Plugin isolation
- ✅ Standard REST API patterns
- ⚠️ Extra proxy layer (Console → Backend API)

---

## Development Principles

### Constitutional Principles

These principles guide all development decisions:

#### I. User Verification of Fixes
**Critical**: Always propose fixes and wait for explicit user approval before implementing. Never implement changes without approval, even if they seem obvious.

**Process**:
1. Identify the issue
2. Propose solution with options (A, B, C)
3. Ask: "Do you approve this fix? (yes/no)"
4. Wait for explicit "yes" or option selection
5. Only then proceed with implementation

#### II. Incremental Testing
**Practice**: Test each feature independently before moving to the next. Stop at checkpoints to validate.

#### III. GitOps-Friendly
**Goal**: YAML entities should coexist with API-driven entities. No forced migration.

#### IV. Performance First
**Target**: UI interactions complete in <2 seconds (SC-003, SC-005). Batch operations where possible.

#### V. Accessibility
**Standard**: All UI components must have ARIA labels and keyboard navigation support.

### Code Style

- **TypeScript strict mode** enabled
- **PatternFly React components** for all UI
- **React hooks** for state management (no class components)
- **Client-side filtering** after initial API fetch (performance optimization)
- **Error boundaries** wrap all major sections
- **Explicit entity type parameters** when calling `useCatalogEntity()` hook

---

## What's Implemented

The project has progressed through four major feature phases, each building upon the previous:

### Phase 001: MCP Tools Catalog - Initial Browsing (Complete ✅)

**Branch**: `001-mcp-tools-catalog`  
**Spec**: `specs/001-mcp-tools-catalog/spec.md`  
**Goal**: Provide catalog browsing interface for MCP servers, tools, and workloads

**User Stories Implemented**:

**US1 - Browse MCP Servers (P1)**:
- ✅ Main catalog page with tabs (Servers, Tools, Workloads)
- ✅ Servers list with search and filtering  
- ✅ Server detail page showing metadata and tools
- ✅ Clickable tool links from server page

**US2 - Explore MCP Tools (P2)**:
- ✅ Tools list tab with server references
- ✅ Tool detail page showing metadata
- ✅ Server-to-tool navigation
- ✅ "Used by Workloads" pane on tool page

**US3 - Manage MCP Workloads (P3)**:
- ✅ Workloads list tab
- ✅ Workload detail page showing referenced tools
- ✅ Tool-to-workload relationships displayed

**US4 - GitHub Catalog Integration (P1)**:
- ✅ Backstage catalog configured to load entities from GitHub
- ✅ GitHub organization catalog provider
- ✅ YAML entity definitions in `entities/` directory

**Key Files**:
- `src/components/McpCatalogPage.tsx` - Main page with tabs
- `src/components/ServersTab.tsx`, `ToolsTab.tsx`, `WorkloadsTab.tsx`
- `src/components/McpServerPage.tsx`, `McpToolPage.tsx`, `McpWorkloadPage.tsx`
- `src/services/catalogService.ts` - Catalog API integration
- `entities/*.yaml` - Example entity definitions

**Deliverable**: Users can browse and discover MCP entities through OpenShift Console.

---

### Phase 002: Disable Tools Checkbox (Complete ✅)

**Branch**: `002-disable-tools-checkbox`  
**Spec**: `specs/002-disable-tools-checkbox/spec.md`  
**Goal**: Enable admins to disable/enable tools with visual indicators

**User Stories Implemented**:

**US1 - Disable Individual Tools (P1)**:
- ✅ "Disabled" checkbox column in server detail page tools table
- ✅ Checkbox toggles tool disabled state
- ✅ Visual feedback on state change

**US2 - Persist Disabled State (P1)**:
- ✅ Disabled state persists across sessions
- ✅ State stored in entity annotations
- ✅ Survives browser close/reopen

**US3 - Visual Distinction for Disabled Tools (P2)**:
- ✅ Disabled tools shown with reduced opacity
- ✅ Visual indicators in all catalog views
- ✅ Disabled badge/icon in tools list

**Implementation**:
- ✅ Immediate persistence on checkbox toggle
- ✅ Error handling with retry
- ✅ Read-only view for non-admin users
- ✅ Role-based access control (mcp-admin role)

**Key Files**:
- `src/components/shared/DisabledCheckbox.tsx`
- `src/hooks/useToolDisabledState.ts`
- `src/services/catalogService.ts` (toggle persistence)

**Deliverable**: Admins can mark tools as disabled, with state persisting and visible across all views.

---

### Phase 003: Entity Management API (Complete ✅)

**Branch**: `003-entity-management-api`  
**Spec**: `specs/003-entity-management-api/spec.md`  
**Goal**: Provide RESTful CRUD API for MCP entities with RBAC

**User Stories Implemented**:

**US1 - CRUD Operations for MCP Entities (P1)**:
- ✅ Backend API endpoints for Servers, Tools, Workloads
- ✅ POST `/api/mcp-entity-api/{entities}` - Create
- ✅ GET `/api/mcp-entity-api/{entities}/{namespace}/{name}` - Read
- ✅ PUT `/api/mcp-entity-api/{entities}/{namespace}/{name}` - Update
- ✅ DELETE `/api/mcp-entity-api/{entities}/{namespace}/{name}` - Delete
- ✅ Database as source of truth (merge with catalog)

**US2 - Role-Based Access Control (P1)**:
- ✅ OCP role integration via OpenShift API
- ✅ `mcp-admin` role for Servers and Tools (write)
- ✅ `mcp-user` role for Workloads (write)
- ✅ Public read access (no role required)
- ✅ 403 Forbidden for unauthorized requests

**Implementation Details**:
- ✅ Backstage database integration (SQLite)
- ✅ Cascade delete for Server → Tools
- ✅ Orphan behavior for Tool/Workload deletion
- ✅ Schema validation before persistence
- ✅ Last-write-wins for concurrent updates
- ✅ Standard HTTP status codes + JSON errors
- ✅ Merge architecture (YAML catalog + database overrides)

**Key Files**:
- `backstage-app/packages/backend/src/plugins/mcp-entity-api/router.ts`
- `backstage-app/packages/backend/src/plugins/mcp-entity-api/service.ts`
- `backstage-app/packages/backend/src/plugins/mcp-entity-api/database.ts`
- `backstage-app/packages/backend/src/plugins/mcp-entity-api/auth.ts`
- `backstage-app/packages/backend/src/plugins/mcp-entity-api/entityProvider.ts`

**Deliverable**: External systems and UI can programmatically manage MCP entities with proper authorization.

---

### Phase 004: Editing Capabilities (Complete ✅ with Deferrals)

**Branch**: `004-editing-capabilities`  
**Spec**: `specs/004-editing-capabilities/spec.md`  
**Goal**: Provide full UI-driven entity management workflows

**Foundation** (Phase 004 Prerequisites):
- ✅ Project structure, dependencies, API proxy configuration
- ✅ Authentication hooks (`useCanEditWorkloads`, role checks)
- ✅ Catalog service hooks extended (batch updates, workload CRUD)
- ✅ Backend API endpoints already exist from Phase 003

**User Stories Implemented**:

**US1 - Batch Tool State Editing (P1) - Complete ✅**:
- ✅ Replaced immediate checkbox persistence (Phase 002) with batch Save/Cancel workflow
- ✅ `ToolStateEditor` component with Save/Cancel buttons
- ✅ `useBatchToolState` hook for state management
- ✅ Multiple tool toggles before save
- ✅ Permission checks (mcp-admin role)
- ✅ Error handling with retry

**US2 - Create New Workloads (P2) - Complete ✅**:
- ✅ Create button in WorkloadsTab
- ✅ `WorkloadForm` component with metadata fields
- ✅ PatternFly TreeView for server/tool selection
- ✅ Multi-server tool selection
- ✅ Disabled tools grayed out (non-selectable)
- ✅ Form validation (name, namespace required)
- ✅ Permission checks (mcp-user role)

**US3 - Edit Existing Workloads (P2) - Partial ⚠️**:
- ✅ Edit menu item in WorkloadsTab
- ✅ WorkloadForm in edit mode (pre-populated)
- ✅ Tool selection tree with pre-selected tools
- ✅ Change detection enables Save/Cancel
- ✅ Workload name **read-only** (rename = delete+create pattern)
- ✅ `ConflictDialog` component created
- ⚠️ **Conflict detection DEFERRED** (T034/T035) - Current: last-write-wins
- ⚠️ **Disabled tool warnings DEFERRED** (T042)

**US4 - Delete Workloads (P3) - Complete ✅**:
- ✅ Delete menu item with confirmation
- ✅ **Soft delete** for YAML-managed workloads (prevents re-ingestion)
- ✅ **Hard delete** for API-created workloads
- ✅ Permission checks (mcp-user role)
- ✅ Error handling

**Polish & Admin Tools**:
- ✅ Loading states and spinners
- ✅ Error messages and user feedback
- ✅ Accessibility (ARIA labels, keyboard nav)
- ✅ Empty state handling
- ✅ Permission checks across all operations
- ✅ Code cleanup and documentation
- ✅ **Admin API endpoints** for managing soft-deleted workloads

**Key Files**:
- `src/components/WorkloadForm.tsx` - Create/edit form
- `src/components/ToolStateEditor.tsx` - Batch tool editing
- `src/components/ConflictDialog.tsx` - Conflict resolution (not integrated)
- `src/hooks/useWorkloadForm.ts` - Form state management
- `src/hooks/useBatchToolState.ts` - Tool state batching
- `backstage-app/.../service.ts` - Soft delete implementation

**Admin Endpoints** (Developer Tools):
```
GET    /api/mcp-entity-api/admin/soft-deleted-workloads
DELETE /api/mcp-entity-api/admin/soft-deleted-workloads/{ns}/{name}?mode=undelete
DELETE /api/mcp-entity-api/admin/soft-deleted-workloads/{ns}/{name}?mode=hard-delete
```

**Usage** (via port-forward):
```bash
oc port-forward -n backstage deployment/backstage 7007:7007
curl http://localhost:7007/api/mcp-entity-api/admin/soft-deleted-workloads | jq
```

**Deliverable**: Complete UI workflows for workload management with soft delete support for YAML entities.

---

### Cross-Cutting Features (All Phases)

**Throughout all phases**:
- ✅ Global search across all entity types
- ✅ Entity type filters (quick filter chips)
- ✅ Breadcrumb navigation
- ✅ Loading states and spinners
- ✅ Error boundaries and error handling
- ✅ Empty state handling
- ✅ Accessibility (ARIA labels, keyboard nav)
- ✅ Pagination (client-side)
- ✅ Offline indicator
- ✅ Performance monitoring utilities

---

## What's Deferred

### T034/T035: Conflict Detection (User Story 3)

**What**: Detect concurrent edits using `metadata.lastModified` timestamp comparison

**Why Deferred**: 
- Edge case (requires two users editing same workload simultaneously)
- ConflictDialog component exists and is functional
- Low priority for PoC demo

**Current Behavior**: Last-write-wins (later save overwrites earlier save)

**Future Work**:
- Implement timestamp comparison in `WorkloadForm`
- Show `ConflictDialog` when conflict detected
- Estimated effort: 2-3 hours

### T042: Disabled Tool Warnings (User Story 3)

**What**: Auto-uncheck disabled tools with warning message when editing workload

**Why Deferred**: 
- Edge case (requires admin to disable tool after workload selects it)
- Current behavior: Disabled tools shown grayed-out (acceptable)

**Current Behavior**: Disabled tools remain selected but grayed out in edit form

**Future Work**:
- Detect disabled tools in `selectedTools` array
- Show warning banner
- Auto-uncheck disabled tools on form load
- Estimated effort: 1-2 hours

### T055: Quickstart Validation (Phase 7)

**What**: Manual testing of all workflows described in `quickstart.md`

**Status**: 
- ✅ Code review complete (implementation validated)
- ⏳ Manual testing pending (50+ test scenarios documented)

**Testing Guide**: See `specs/004-editing-capabilities/T055-validation-results.md`

**Estimated Effort**: 30-45 minutes of manual testing

---

## Key Implementation Details

### 1. Entity Relationship Resolution

**Problem**: Multiple ways to express relationships in Backstage entities.

**Solution**: Priority-based resolution in `validationService.ts`

**Tool → Server Resolution Priority**:
1. `spec.subcomponentOf` (canonical Backstage way)
2. `spec.partOf` (alternative field)
3. `relations[]` with `type: 'partOf'`
4. `spec.mcp.server` (legacy MCP-specific field)
5. `metadata.labels['mcp-catalog.io/server']` (fallback)

**Workload → Tool Resolution Priority**:
1. `spec.dependsOn` (canonical for dependencies)
2. `spec.consumes` (alternative field)
3. `spec.mcp.tools` (legacy MCP-specific field)
4. `relations[]` with `type: 'dependsOn'`

### 2. Entity Type Detection in `useCatalogEntity` Hook

**Problem**: Frontend was trying all three endpoints (`/servers`, `/tools`, `/workloads`) sequentially, causing wrong entity type to load.

**Solution**: Add optional `entityType` parameter to `useCatalogEntity` hook.

**Usage**:
```typescript
// Explicitly fetch from /workloads endpoint
const [workload, loaded, error] = useCatalogEntity<CatalogMcpWorkload>(
  CATALOG_MCP_WORKLOAD_KIND,
  name,
  namespace,
  location.search,
  'workload'  // ← Explicit entity type
);
```

**Implementation** (`src/services/catalogService.ts`):
```typescript
export const useCatalogEntity = <T extends Entity>(
  kind: string, 
  name: string, 
  namespace: string = 'default', 
  refreshTrigger?: string | number,
  entityType?: 'server' | 'tool' | 'workload'  // ← Optional parameter
): [T | null, boolean, Error | null] => {
  // If entityType provided, use direct endpoint
  // Otherwise, fallback to sequential try (backward compatibility)
};
```

### 3. Merge Logic for YAML + Database Entities

**Backend** (`service.ts`):

```typescript
// For YAML-defined entity
const catalogEntity = await catalog.getEntityByRef({ ... });
const dbEntity = await database.getEntity(entityRef);

// Merge: Database overrides win
const mergedEntity = {
  ...catalogEntity,
  metadata: {
    ...catalogEntity.metadata,
    description: dbEntity.metadata.description || catalogEntity.metadata.description,
    annotations: {
      ...catalogEntity.metadata.annotations,
      ...dbEntity.metadata.annotations  // DB wins
    }
  },
  spec: {
    ...catalogEntity.spec,
    dependsOn: dbEntity.spec.dependsOn  // DB wins for user-editable fields
  }
};
```

**Database-Only Entities** (API-created, not yet in catalog):
```typescript
// If not in catalog, check database
if (!catalogEntity) {
  const dbEntity = await database.getEntity(entityRef);
  if (dbEntity) {
    return dbEntity;  // Return database-only entity
  }
  throw new NotFoundError(entityRef);
}
```

### 4. Soft Delete Implementation

**Mark as Deleted** (`deleteWorkload` in `service.ts`):
```typescript
const softDeletedEntity = {
  ...catalogEntity,
  metadata: {
    ...catalogEntity.metadata,
    annotations: {
      ...catalogEntity.metadata.annotations,
      'mcp-catalog.io/deleted': 'true',
      'mcp-catalog.io/deleted-at': new Date().toISOString(),
    },
  },
};
await database.upsertEntity(softDeletedEntity);
```

**Filter from Lists** (`listWorkloads` in `service.ts`):
```typescript
const mergedEntities = await Promise.all(
  catalogEntities.map(async (catalogEntity) => {
    const dbEntity = await database.getEntity(entityRef);
    if (dbEntity) {
      const merged = { /* merge logic */ };
      const annotations = merged.metadata.annotations || {};
      if (annotations['mcp-catalog.io/deleted'] === 'true') {
        return null;  // Exclude soft-deleted
      }
      return merged;
    }
    return catalogEntity;
  })
);
const filteredEntities = mergedEntities.filter(e => e !== null);
```

**Return 404 for Gets** (`getWorkload` in `service.ts`):
```typescript
const annotations = entity.metadata.annotations || {};
if (annotations['mcp-catalog.io/deleted'] === 'true') {
  throw new NotFoundError(entityRef);  // Treat as not found
}
```

### 5. Cache Invalidation Strategy

**Problem**: Browser caches React bundles. After deployment, users see stale code.

**Solutions Used**:

1. **Query Parameter Refresh** (`location.search` or timestamp):
```typescript
const [entity, loaded, error] = useCatalogEntity(
  kind, 
  name, 
  namespace,
  location.search  // ← Changes on navigation, forces refetch
);
```

2. **Explicit State Reset**:
```typescript
setData(null);  // Clear cached data
// Trigger useEffect to refetch
```

3. **Hard Browser Refresh**: Ctrl+Shift+R (Ctrl+F5 on Windows)

4. **Container Image Tagging**: Use timestamp tags to force new image pull:
```bash
podman build -t quay.io/jsalomon/mcp-tools-catalog:$(date +%Y%m%d-%H%M%S) .
```

---

## Getting Started

### Prerequisites

- OpenShift cluster access with admin privileges
- Node.js 18+
- Yarn package manager
- Podman (or Docker)
- `oc` CLI configured and authenticated

### Initial Setup

```bash
# 1. Clone repository
git clone <repo-url>
cd mcp-tools-catalog

# 2. Install frontend dependencies
yarn install

# 3. Install backend dependencies
cd backstage-app
yarn install
cd ..

# 4. Build frontend
yarn build

# 5. Build backend
cd backstage-app
yarn build:backend
cd ..
```

### Local Development

**Frontend Only** (against deployed backend):
```bash
yarn start:console
# Access at http://localhost:9000
```

**Backend Only** (local Backstage):
```bash
cd backstage-app
yarn start
# Backend at http://localhost:7007
```

### Build & Deploy to OpenShift

**One-Command Deploy** (recommended):
```bash
./build-push-deploy-test.sh
```

**Manual Steps**:
```bash
# 1. Build frontend
yarn build

# 2. Build frontend container
./build-container.sh --local
podman tag localhost/mcp-tools-catalog:latest quay.io/<your-org>/mcp-tools-catalog:latest
podman push quay.io/<your-org>/mcp-tools-catalog:latest

# 3. Build backend
cd backstage-app
yarn build:backend
podman build -f packages/backend/Dockerfile -t quay.io/<your-org>/backstage:latest .
podman push quay.io/<your-org>/backstage:latest
cd ..

# 4. Deploy to OpenShift
oc apply -f deployment/

# 5. Update images
oc set image deployment/mcp-tools-catalog mcp-tools-catalog=quay.io/<your-org>/mcp-tools-catalog:latest
oc set image deployment/backstage backstage=quay.io/<your-org>/backstage:latest -n backstage
```

### Accessing the UI

```bash
# Get console URL
oc get route console -n openshift-console -o jsonpath='{.spec.host}'

# Navigate to: https://<console-url>/mcp-catalog
```

---

## Testing & Validation

### Unit Tests

```bash
# Run all tests
yarn test

# Run specific test
yarn test src/services/catalogService.spec.ts

# Watch mode
yarn test --watch
```

**Coverage** (as of 2025-12-28):
- ✅ `ServersTab.spec.tsx`
- ✅ `searchService.spec.ts`
- ✅ `validationService.spec.ts`
- ⏳ 6 component tests pending (McpServerPage, McpToolPage, etc.)

### Manual Testing

**T055 Validation Checklist**: See `specs/004-editing-capabilities/T055-validation-results.md`

**Quick Smoke Test**:
1. Browse servers → verify list loads
2. Click server → verify detail page with tools
3. Browse workloads → verify list loads
4. Create workload → select tools → save → verify appears in list
5. Edit workload → modify → save → verify changes
6. Delete workload → confirm → verify removed from list

### Sanity Tests

```bash
# Quick health check
./tests/sanity/quick-check.sh

# Full sanity suite
./tests/sanity/run-sanity-tests.sh
```

---

## Known Issues & Workarounds

### Issue 1: Frontend Cache After Deployment

**Symptom**: After deploying new frontend code, UI shows old behavior.

**Root Cause**: Browser caches JavaScript bundles. Container layer caching may also reuse old `dist/` files.

**Workaround**:
1. Hard refresh browser: Ctrl+Shift+R (Ctrl+F5 Windows)
2. Clean frontend build:
   ```bash
   rm -rf dist && yarn build
   ```
3. Force container rebuild without cache:
   ```bash
   podman build --no-cache -t quay.io/jsalomon/mcp-tools-catalog:$(date +%Y%m%d-%H%M%S) .
   ```
4. Use timestamped image tags (not `:latest`)

### Issue 2: Workload Name Cannot Be Renamed

**Symptom**: Attempting to edit workload name in form causes "Entity not found" error or silently fails.

**Root Cause**: Entity name is part of its unique identifier (`component:namespace/name`). Renaming requires delete+recreate pattern.

**Workaround**: Name field is read-only in edit mode. To "rename":
1. Note workload's current configuration
2. Delete workload
3. Create new workload with desired name and same configuration

**Future Enhancement**: Add "Rename" menu item that automates delete+recreate.

### Issue 3: YAML Workloads Reappear After Deletion

**Symptom**: Deleting a YAML-defined workload makes it disappear, but it comes back after a few minutes.

**Root Cause**: Backstage continuously re-ingests entities from YAML files in Git.

**Solution**: Soft delete (implemented as of 2025-12-28)
- YAML workloads marked with `mcp-catalog.io/deleted: 'true'`
- Filtered from UI in `listWorkloads()` and `getWorkload()`
- Remains hidden even after re-ingestion

**Admin Recovery**: Use admin API to undelete or hard delete:
```bash
oc port-forward -n backstage deployment/backstage 7007:7007
curl -X DELETE "http://localhost:7007/api/mcp-entity-api/admin/soft-deleted-workloads/default/workload-name?mode=hard-delete"
```

### Issue 4: API-Created Workload Not Immediately Visible

**Symptom**: Create workload via API → workload detail page shows error or wrong entity.

**Root Cause**: Eventual consistency. API-created entities are in database but not yet in Backstage catalog.

**Solution** (implemented):
- `getWorkload()` and `listWorkloads()` now check database for entities not yet in catalog
- Frontend explicitly passes `entityType` parameter to prevent wrong endpoint query

**Verification**: After creating workload, detail page should load immediately (no waiting for catalog sync).

### Issue 5: Tool "Used by Workloads" Pane Empty for API Workloads

**Symptom**: Tool detail page doesn't show API-created workloads in "Used by Workloads" pane.

**Root Cause**: Filter logic only checked `spec.consumes` and `spec.mcp.tools`, but API workloads use `spec.dependsOn`.

**Solution** (implemented):
```typescript
const workloadsUsingTool = workloads.filter(workload => {
  const dependsOn = workload.spec.dependsOn || [];
  if (dependsOn.includes(toolRef)) return true;
  // ... also check consumes, mcp.tools, relations
});
```

---

## Future Architectural Considerations

### 1. Remove Backstage Dependency?

**Analysis** (2025-12-28):

**Current Pain Points**:
- Merge architecture complexity (catalog + database)
- Eventual consistency issues
- Soft delete workarounds
- Multiple sources of truth

**Requirements**:
- ✅ Servers/Tools: API-driven from external component (no YAML needed)
- ✅ Workloads: UI-driven (no YAML needed)
- 🤔 Future entities: May be YAML-initiated, but one-time import is sufficient

**Potential Simplified Architecture**:
```
OpenShift Console Frontend
         ↓
   Standalone Backend API (Express)
         ↓
   SQLite Database (single source of truth)
```

**Benefits**:
- ✅ True CRUD (no soft delete hacks)
- ✅ Rename works naturally
- ✅ Immediate consistency
- ✅ Simpler code (no merge logic)
- ✅ Smaller deployment

**Trade-offs**:
- ❌ Lose GitOps for YAML entities (but may not be needed)
- ❌ Lose Backstage catalog features (but may not be used)

**Decision**: Deferred to post-PoC. Current architecture works for demo.

**Migration Path** (if pursued):
1. Extract backend API from Backstage (standalone Express app)
2. Remove catalog provider / entity provider code
3. Simplify service layer (remove merge logic)
4. Add YAML import endpoint/feature (one-time load)
5. Deploy as separate service

### 2. Kubernetes Custom Resources?

**Analysis** (2025-12-28):

**Scale** (~25 servers, ~500 tools, single-digit workloads per cluster):
- ✅ CRs can handle this scale easily

**Pros**:
- ✅ k8s-native RBAC
- ✅ GitOps friendly
- ✅ CLI access (`oc get mcptools`)
- ✅ No database to manage

**Cons**:
- ❌ **Relationship management is complex** (no referential integrity)
- ❌ No SQL-like queries
- ❌ Need custom controller/operator
- ❌ Cascading deletes require custom logic

**Example Problem**:
```yaml
# Tool references server by name - just a string, no enforcement
apiVersion: mcp.redhat.com/v1alpha1
kind: MCPTool
spec:
  serverRef: "github-server"  # ← Can reference non-existent server
```

Finding all tools for a server = list all tools, filter in code (no JOIN).

**Decision**: Stick with database. Relationships are critical for this use case.

**When CRs Would Make Sense**:
- If entities controlled k8s resources (they don't)
- If multi-cluster GitOps needed
- If k8s RBAC at entity level required

---

## Quick Reference

### Project History & Phases

The project evolved through four feature branches:

1. **`001-mcp-tools-catalog`** (Oct 2025): Initial catalog browsing + GitHub integration
2. **`002-disable-tools-checkbox`** (Dec 2025): Tool enable/disable with visual indicators
3. **`003-entity-management-api`** (Dec 2025): RESTful CRUD API + RBAC
4. **`004-editing-capabilities`** (Dec 2025): Full editing workflows + soft delete

Each phase built incrementally upon the previous, with all features integrated into `main` branch. See `specs/{phase}/spec.md` for detailed requirements and acceptance criteria.

### File Structure

```
src/
├── components/          # React components
│   ├── McpCatalogPage.tsx       # Main catalog page with tabs
│   ├── McpServerPage.tsx        # Server detail page
│   ├── McpToolPage.tsx          # Tool detail page
│   ├── McpWorkloadPage.tsx      # Workload detail page
│   ├── ServersTab.tsx           # Servers list
│   ├── ToolsTab.tsx             # Tools list
│   ├── WorkloadsTab.tsx         # Workloads list + CRUD
│   ├── WorkloadForm.tsx         # Create/edit workload form
│   ├── ToolStateEditor.tsx      # Batch tool editing
│   ├── ConflictDialog.tsx       # Conflict resolution (not integrated)
│   └── shared/                  # Shared components
├── models/              # TypeScript interfaces
├── services/            # Business logic & API calls
│   ├── catalogService.ts        # CRUD operations + hooks
│   ├── searchService.ts         # Filtering utilities
│   └── validationService.ts     # Relationship validation
└── hooks/               # Custom React hooks
    ├── useWorkloadForm.ts       # Workload form state
    └── useBatchToolState.ts     # Batch tool editing

backstage-app/packages/backend/src/plugins/mcp-entity-api/
├── router.ts            # Express routes
├── service.ts           # Business logic (merge, CRUD)
├── database.ts          # SQLite operations
├── entityProvider.ts    # Backstage catalog integration
├── auth.ts              # RBAC middleware
└── errors.ts            # Error handling

entities/                # Example YAML entity definitions
specs/                   # Design documentation
tests/sanity/            # Sanity test scripts
```

### Common Commands

```bash
# Development
yarn build                        # Build frontend
yarn test                         # Run tests
yarn start:console                # Local dev server

# Deployment
./build-push-deploy-test.sh       # One-command deploy
./build-container.sh --local      # Build frontend container
oc get pods -n backstage          # Check backend pods
oc logs -f deployment/backstage -n backstage  # Backend logs

# Admin
oc port-forward -n backstage deployment/backstage 7007:7007  # Port forward
curl http://localhost:7007/api/mcp-entity-api/admin/soft-deleted-workloads | jq
```

### Key Configuration Files

- `package.json` - Frontend dependencies
- `backstage-app/package.json` - Backend dependencies
- `console-extensions.json` - Console plugin registration
- `deployment/backstage-deployment-sqlite.yaml` - Backend deployment
- `charts/openshift-console-plugin/values.yaml` - Helm values

### Specifications & Documentation

Each feature phase has comprehensive documentation in `specs/{phase}/`:
- **`spec.md`**: Feature requirements, user stories, acceptance criteria
- **`plan.md`**: Implementation plan, architecture decisions
- **`tasks.md`**: Task breakdown for implementation
- **`quickstart.md`**: End-user workflow guide
- **`contracts/`**: API contracts, schemas (Phase 001, 003)

**Speckit Workflow**: This project uses Speckit commands (`.cursor/commands/`) for structured feature development:
- `/speckit.specify` - Create feature specification from natural language
- `/speckit.plan` - Generate implementation plan
- `/speckit.tasks` - Break down into actionable tasks
- `/speckit.implement` - Track implementation progress

### Useful Links

- **Backstage Docs**: https://backstage.io/docs
- **PatternFly React**: https://www.patternfly.org/v4/
- **OpenShift Console Plugin SDK**: https://github.com/openshift/console/tree/master/dynamic-demo-plugin
- **Project Specs**: `specs/` directory in repository

---

## Getting Help

### When Something Breaks

1. **Check logs**:
   ```bash
   # Backend logs
   oc logs -f deployment/backstage -n backstage
   
   # Frontend logs (browser console)
   F12 → Console tab
   ```

2. **Verify deployment**:
   ```bash
   oc get pods -n backstage
   oc get deployment/mcp-tools-catalog
   ```

3. **Check entity data**:
   ```bash
   oc port-forward -n backstage deployment/backstage 7007:7007
   curl http://localhost:7007/api/mcp-entity-api/servers | jq
   ```

4. **Review this document's "Known Issues" section**

### Common Questions

**Q: Why is my workload not showing up?**  
A: Check if it's soft-deleted: `curl http://localhost:7007/api/mcp-entity-api/admin/soft-deleted-workloads`

**Q: Why can't I rename a workload?**  
A: Name is part of entity identity. Must delete and recreate. Name field is read-only by design.

**Q: Why does my deployment show old code?**  
A: Browser cache or container layer cache. See "Issue 1" in Known Issues.

**Q: Can I test locally without deploying?**  
A: Frontend yes (`yarn start:console`). Backend requires Backstage environment (use deployed backend).

---

## Contact & Collaboration

This project uses AI-assisted development (Claude/Cursor). When onboarding:

1. Share this document with your AI assistant
2. Reference specific sections: "See PROJECT-CONTEXT.md § Known Issues"
3. Follow Constitutional Principle I: Get approval before implementing fixes
4. Use incremental testing approach (Principle II)

**Questions?** Check `specs/` directory for detailed design docs.

**Ready to contribute?** Start with `specs/004-editing-capabilities/tasks.md` for pending work.

---

**Document Version**: 1.0  
**Last Updated**: 2025-12-28  
**Next Review**: After PoC demo completion
