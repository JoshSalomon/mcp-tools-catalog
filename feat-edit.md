## Adding Editing capabilities, first step
### Make the tools enable/disable state persistent
- The tools state that can be edited (via checkbox) in the server details screen should be persisted across sessions
- The server details screen shoudl have 2 buttons, Save and Cancel which are disabled by default and enabled once a change in the status of the tools has been detected.
- persistency is done only once teh save button is selected

### Creating new workloads
- In the workloads list screen we should add a Create button
- The create button starts a new qorkload creation screes
-- the screen has Save and Cancel buttons.
-- the screen should have text fields for all metadata fields (name, description, ...)
-- the screen shows a tree view of all the servers, for each server expandable/collapsable list of the tools
-- tools that are enabled can be selected (a checkbox before their names)
-- disabled tools should be visible with visual mark that they are disabled and can't be selected.
- The save button will create a new workload via call to the API

### Deleting a workload
- In the workloads list screen, there should be an expandable menu in the right side of each line with the option to delete the workload.
