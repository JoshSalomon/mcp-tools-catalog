# Research: Server Tools View Consolidation

**Feature Branch**: `007-server-tools-view`
**Created**: 2026-01-08

## Overview

No significant unknowns required research for this feature. The implementation follows established patterns from previous features.

## Decisions

### 1. Database Schema Approach

**Decision**: Add `alternative_description` column to existing `mcp_entities` table

**Rationale**:
- Follows existing pattern used for other tool state (e.g., disabled flag in annotations)
- No new tables required
- Migration is additive and non-breaking
- Leverages existing merge architecture

**Alternatives Considered**:
- Separate `mcp_tool_extensions` table: Rejected - unnecessary complexity for a single field
- Store in JSON blob: Rejected - harder to query and migrate

### 2. Expandable Row Pattern

**Decision**: Use PatternFly's expandable table row pattern

**Rationale**:
- PatternFly provides built-in expandable row support via `Tr` with `isExpanded` prop
- Consistent with PatternFly design system used throughout the project
- Accessible out of the box

**Alternatives Considered**:
- Accordion component: Rejected - doesn't integrate well with table layout
- Modal/drawer for tools: Rejected - requires extra click, breaks flow

### 3. Tool Sorting

**Decision**: Sort tools alphabetically (A-Z) by name in the service layer

**Rationale**:
- Consistent with user expectation for list views
- Simple to implement with `Array.sort()`
- Clarified in spec as explicit requirement

**Alternatives Considered**:
- Sort in database query: Rejected - tools come from catalog API, not direct DB query
- Client-side sort only: Rejected - service layer ensures consistent ordering for API consumers

### 4. Alternative Description Override Behavior

**Decision**: Alternative description completely overrides original when set and non-empty

**Rationale**:
- Simple mental model for users
- Clear precedence rule
- Whitespace-only treated as empty (original shows)

**Alternatives Considered**:
- Append/prepend to original: Rejected - confusing UX
- Show both in UI: Rejected - clutters interface, unclear which is authoritative

## Dependencies Verified

| Dependency | Version | Status |
|------------|---------|--------|
| PatternFly expandable rows | 6.2+ | ✅ Available |
| Existing merge architecture | Current | ✅ Works with additional field |
| mcp-admin role | Current | ✅ Already implemented |

## Conclusion

All technical approaches are well-understood and follow existing patterns. Ready to proceed to implementation.
