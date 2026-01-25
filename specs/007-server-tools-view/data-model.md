# Data Model: Server Tools View Consolidation

**Feature Branch**: `007-server-tools-view`
**Created**: 2026-01-08

## Overview

This feature extends the existing MCP Tool entity with an optional `alternativeDescription` field. No new entities are created; this is an extension of the existing merge architecture.

## Entity Extensions

### MCPToolEntity (Extended)

The existing `MCPToolEntity` is extended with an `alternativeDescription` field that is stored in the database and merged with catalog data at query time.

```typescript
// Extension to existing MCPToolEntity
interface MCPToolEntityExtension {
  // Added to the merged entity response
  alternativeDescription?: string;
}

// Full merged response includes catalog data + database extension
interface MCPToolEntityWithAlternative extends MCPToolEntity {
  alternativeDescription?: string;
}
```

**Source of Truth**:
- Catalog (YAML/API): `metadata.description` - original description
- Database: `alternative_description` column - override description
- Merged Response: Uses `alternativeDescription` if non-empty, otherwise `metadata.description`

## Database Schema Changes

### mcp_entities Table Extension

Add a new column to the existing `mcp_entities` table:

```sql
ALTER TABLE mcp_entities
ADD COLUMN alternative_description TEXT NULL;
```

**Column Details**:

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `alternative_description` | TEXT | NULL, max 2000 chars | Optional override for entity description |

**Migration Strategy**:
- Column is nullable with no default
- Existing rows will have NULL (no alternative description)
- Application validation enforces 2000 character limit

### Schema Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ mcp_entities                                                 │
├─────────────────────────────────────────────────────────────┤
│ id                    STRING PRIMARY KEY                     │
│ entity_ref            STRING UNIQUE NOT NULL                 │
│ entity_type           STRING NOT NULL                        │
│ namespace             STRING NOT NULL                        │
│ name                  STRING NOT NULL                        │
│ entity_json           TEXT NOT NULL                          │
│ created_at            TIMESTAMP                              │
│ updated_at            TIMESTAMP                              │
│ alternative_description TEXT NULL  [NEW]                     │
└─────────────────────────────────────────────────────────────┘
```

## Merge Architecture

The existing merge pattern is extended to include `alternative_description`:

```
┌───────────────────┐     ┌───────────────────┐
│  Backstage        │     │  MCP Entity       │
│  Catalog          │     │  Database         │
│  (YAML/API)       │     │  (SQLite)         │
└────────┬──────────┘     └────────┬──────────┘
         │                         │
         │  metadata.description   │  alternative_description
         │                         │
         └──────────┬──────────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  Service Layer       │
         │  (Merge Logic)       │
         └──────────┬───────────┘
                    │
                    ▼
         ┌──────────────────────┐
         │  Merged Response     │
         │  - description       │  ← alternativeDescription || metadata.description
         │  - alternativeDescription │  ← raw DB value (for edit UI)
         └──────────────────────┘
```

## API Request/Response Types

### GET /servers/:namespace/:name/tools

Returns tools for a server, sorted alphabetically by name.

**Response**:
```typescript
interface ServerToolsResponse {
  items: MCPToolEntityWithAlternative[];
  totalCount: number;
}

interface MCPToolEntityWithAlternative {
  apiVersion: 'backstage.io/v1alpha1';
  kind: 'Component';
  metadata: {
    name: string;
    namespace: string;
    description?: string;  // Original from catalog
    // ... other metadata
  };
  spec: MCPToolSpec;
  // Extension fields (merged from database)
  alternativeDescription?: string;  // Override description if set
  disabled?: boolean;               // Existing disabled state
}
```

### PUT /tools/:namespace/:name/alternative-description

Updates the alternative description for a tool.

**Request**:
```typescript
interface UpdateAlternativeDescriptionRequest {
  alternativeDescription: string;  // Empty string to clear
}
```

**Response**:
```typescript
// Returns updated MCPToolEntityWithAlternative
```

## Validation Rules

### Alternative Description

| Rule | Value | Error Message |
|------|-------|---------------|
| Max Length | 2000 characters | "Alternative description must not exceed 2000 characters" |
| Whitespace Handling | Trim before save; treat whitespace-only as empty | N/A (silent normalization) |
| Character Set | Any UTF-8 | N/A |

## State Transitions

### Alternative Description Lifecycle

```
┌─────────────┐    Set non-empty    ┌─────────────┐
│   Unset     │ ─────────────────► │    Set      │
│  (NULL)     │                     │  (value)    │
└─────────────┘                     └─────────────┘
       ▲                                   │
       │        Clear (empty string)       │
       └───────────────────────────────────┘
```

- **Unset (NULL)**: Tool displays `metadata.description` from catalog
- **Set (value)**: Tool displays `alternativeDescription` in all UI locations

## Relationships

No new relationships are added. The feature relies on existing relationships:

- **Tool → Server**: `spec.subcomponentOf` (existing)
- **Server → Tools**: `relations[type='hasPart']` (existing, derived)

## Performance Considerations

### Query Optimization

1. **Server Tools Query**: When expanding a server, tools are fetched with a single query filtered by `spec.subcomponentOf`
2. **Sorting**: Tools are sorted alphabetically (A-Z) in the service layer after merge
3. **Caching**: No additional caching required; follows existing catalog caching patterns

### Index Recommendations

The existing index on `(namespace, name)` is sufficient. No new indexes required since `alternative_description` is not queried directly.
