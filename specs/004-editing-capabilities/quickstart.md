# Quickstart: Editing Capabilities

**Feature**: 004-editing-capabilities
**Date**: 2025-12-18

This guide walks through the editing capabilities added to the MCP Tools Catalog.

## Prerequisites

- Access to OpenShift Console with MCP Tools Catalog plugin installed
- **mcp-admin** role for editing tool states
- **mcp-user** role for creating, editing, or deleting workloads

## Workflow 1: Editing Tool States (Batch Save/Cancel)

**Role Required**: mcp-admin

### Steps

1. **Navigate to Server Detail Page**
   - Go to MCP Catalog → Servers tab
   - Click on a server name to view details

2. **Review Current Tool States**
   - Tool checkboxes show current enabled/disabled state
   - Save and Cancel buttons are visible but disabled

3. **Make Changes**
   - Toggle tool checkboxes to change their enabled/disabled state
   - Save and Cancel buttons become enabled when changes are detected
   - You can toggle multiple tools before saving

4. **Save Changes**
   - Click **Save** to persist all changes
   - Changes are batched and sent to the backend
   - Save/Cancel buttons become disabled after successful save
   - Tool states reflect the updated values

5. **Cancel Changes** (Alternative)
   - Click **Cancel** to revert all unsaved changes
   - Tool checkboxes revert to their original state
   - Save/Cancel buttons become disabled

### Example

```
1. Navigate to "GitHub Server" detail page
2. Toggle "create-issue" tool to Disabled
3. Toggle "read-file" tool to Enabled
4. Click Save
5. All changes persist, page refreshes with updated states
```

**Time**: Under 30 seconds for typical batch changes (SC-001)

---

## Workflow 2: Creating a New Workload

**Role Required**: mcp-user

### Steps

1. **Navigate to Workloads Tab**
   - Go to MCP Catalog → Workloads tab
   - Click **Create** button (top right)

2. **Fill Metadata Fields**
   - **Name** (required): Enter workload name (e.g., "my-workload")
   - **Namespace** (required): Enter namespace (default: "default")
   - **Description** (optional): Enter description
   - **Lifecycle** (optional): Select lifecycle stage
   - **Owner** (optional): Enter owner entity reference

3. **Select Tools**
   - Expand server nodes in the tree view to see their tools
   - Check boxes next to enabled tools to select them
   - Disabled tools are visible but cannot be selected (grayed out)
   - You can select tools from multiple servers
   - Tools selection is optional (empty workloads allowed)

4. **Save Workload**
   - Click **Save** to create the workload
   - Form validates required fields (name, namespace)
   - If validation passes, workload is created via API
   - You are returned to the workloads list
   - New workload appears in the list

5. **Cancel** (Alternative)
   - Click **Cancel** to discard changes
   - No workload is created
   - You are returned to the workloads list

### Example

```
1. Click Create button
2. Enter name: "project-setup-automation"
3. Enter namespace: "default"
4. Enter description: "Automates project initialization"
5. Expand "GitHub Server" → Select "create-issue" tool
6. Expand "File Server" → Select "read-file" tool
7. Click Save
8. Workload appears in workloads list
```

**Time**: Under 2 minutes end-to-end (SC-003)

---

## Workflow 3: Editing an Existing Workload

**Role Required**: mcp-user

### Steps

1. **Navigate to Workloads Tab**
   - Go to MCP Catalog → Workloads tab
   - Find the workload you want to edit

2. **Open Edit Screen**
   - Click the menu (kebab icon) on the workload row
   - Select **Edit** from the menu
   - Edit screen opens with form pre-populated

3. **Modify Workload**
   - Change metadata fields (name, description, lifecycle, owner)
   - Add tools: Check boxes next to additional tools
   - Remove tools: Uncheck boxes for tools to remove
   - Save/Cancel buttons become enabled when changes are detected

4. **Save Changes**
   - Click **Save** to update the workload
   - Form validates required fields
   - If conflict detected (another user modified the workload):
     - Conflict dialog appears
     - Choose to **Overwrite** (proceed with your changes) or **Cancel** (abort save)
   - If no conflict, workload is updated
   - You are returned to the workloads list
   - Updated workload reflects your changes

5. **Cancel** (Alternative)
   - Click **Cancel** to discard changes
   - No changes are saved
   - You are returned to the workloads list

### Example

```
1. Find "project-setup-automation" workload
2. Click menu → Edit
3. Change description to "Updated automation workflow"
4. Uncheck "read-file" tool (remove it)
5. Check "write-file" tool (add it)
6. Click Save
7. Workload updated in list
```

**Time**: Under 2 minutes end-to-end (SC-005)

---

## Workflow 4: Deleting a Workload

**Role Required**: mcp-user

### Steps

1. **Navigate to Workloads Tab**
   - Go to MCP Catalog → Workloads tab
   - Find the workload you want to delete

2. **Open Delete Menu**
   - Click the menu (kebab icon) on the workload row
   - Select **Delete** from the menu

3. **Confirm Deletion**
   - Confirmation dialog appears
   - Click **Confirm** to proceed with deletion
   - Or click **Cancel** to abort

4. **Deletion Complete**
   - Workload is deleted via API
   - Workload is removed from the list
   - If deletion fails (e.g., permission denied), error message is displayed

### Example

```
1. Find "old-workload" workload
2. Click menu → Delete
3. Click Confirm in dialog
4. Workload removed from list
```

**Time**: Under 10 seconds (SC-007)

---

## Permission Scenarios

### Without mcp-admin Role

- **Tool state editing**: Tool checkboxes are disabled (read-only)
- **Save/Cancel buttons**: Not shown on server detail page
- **Workload operations**: Still available if you have mcp-user role

### Without mcp-user Role

- **Create button**: Disabled or hidden
- **Edit menu item**: Disabled or hidden
- **Delete menu item**: Disabled or hidden
- **Workload viewing**: Still available (read-only)

### With Both Roles

- Full editing capabilities for both tool states and workloads

---

## Error Scenarios

### Validation Errors

**Scenario**: Attempting to save workload without required fields

**Behavior**:
- Validation errors displayed inline with form fields
- Save button disabled until errors resolved
- Error messages appear within 1 second (SC-008)

**Example**:
```
Name field: "Name is required" (red text)
Namespace field: "Namespace cannot be empty" (red text)
```

### Conflict Detection

**Scenario**: Another user modifies workload while you're editing

**Behavior**:
- Conflict warning dialog appears when you click Save
- Dialog shows:
  - "This workload was modified by another user"
  - Options: **Overwrite** (proceed) or **Cancel** (abort)
- If you choose Overwrite, your changes replace theirs
- If you choose Cancel, no changes are saved

### Network Errors

**Scenario**: API call fails (network error, server unavailable)

**Behavior**:
- Error message displayed: "Failed to save changes. Please try again."
- Retry option available
- Unsaved changes preserved (can retry or cancel)

### Permission Errors

**Scenario**: User lacks required role for operation

**Behavior**:
- Permission error message displayed
- Operation is blocked
- UI elements disabled or hidden based on role

---

## Tips

1. **Batch Tool Changes**: Make multiple tool state changes before clicking Save to reduce API calls
2. **Empty Workloads**: You can create workloads without selecting any tools
3. **Conflict Resolution**: If you see a conflict dialog, review the changes before overwriting
4. **Cancel Anytime**: Use Cancel to discard unsaved changes without affecting the backend
5. **Validation**: Required fields (name, namespace) are validated before save

---

## Next Steps

- Explore the MCP Tools Catalog to discover available servers and tools
- Create workloads that combine tools from multiple servers
- Manage tool states to enable/disable capabilities as needed
- Edit workloads as requirements evolve
