# MCP Tools Catalog - Documentation Index

## Quick Start
- **[README.md](README.md)** - Project overview, quick start, features
- **[CLAUDE.md](CLAUDE.md)** - Development guidelines, project structure, commands

## Feature Documentation

### Disable/Enable Tools (Latest Feature)
- **[DISABLE-TOOLS-FIX-COMPLETE.md](DISABLE-TOOLS-FIX-COMPLETE.md)** - ⭐ Complete fix summary, status, testing
- **[CHECKBOX-UI-FIX.md](CHECKBOX-UI-FIX.md)** - ⭐ Checkbox UI state fix (destructuring, stable callbacks)
- **[MERGE-ARCHITECTURE.md](MERGE-ARCHITECTURE.md)** - ⭐ Architecture, data flow, diagrams  
- **[YAML-ENTITY-FIX.md](YAML-ENTITY-FIX.md)** - Fix history, before/after

### Authentication & Authorization
- **[AUTHENTICATION.md](AUTHENTICATION.md)** - Comprehensive auth guide, troubleshooting
- **[AUTHENTICATION-FIX-SUMMARY.md](AUTHENTICATION-FIX-SUMMARY.md)** - Auth fixes, CSRF, nginx headers

### Validation
- **[VALIDATION-APPROACH.md](VALIDATION-APPROACH.md)** - Why we removed strict validation

## Deployment & Operations
- **[DEPLOYMENT.md](DEPLOYMENT.md)** - Deployment guide, OpenShift setup, auth architecture
- **[TROUBLESHOOTING-DEPLOYMENT.md](TROUBLESHOOTING-DEPLOYMENT.md)** - Deployment issues
- **[SELF-SIGNED-CERTS.md](SELF-SIGNED-CERTS.md)** - Certificate configuration

## Testing
- **[TESTING.md](TESTING.md)** - Test strategy, unit tests, integration tests

## Development
- **[VERIFY-PLUGIN.md](VERIFY-PLUGIN.md)** - Plugin verification steps

## Documentation by Audience

### For Developers
1. [CLAUDE.md](CLAUDE.md) - Start here for development setup
2. [MERGE-ARCHITECTURE.md](MERGE-ARCHITECTURE.md) - Understand the architecture
3. [TESTING.md](TESTING.md) - Run tests
4. [README.md](README.md) - Commands and structure

### For Operators
1. [DEPLOYMENT.md](DEPLOYMENT.md) - Deploy to OpenShift
2. [AUTHENTICATION.md](AUTHENTICATION.md) - Configure authentication
3. [TROUBLESHOOTING-DEPLOYMENT.md](TROUBLESHOOTING-DEPLOYMENT.md) - Fix deployment issues
4. [SELF-SIGNED-CERTS.md](SELF-SIGNED-CERTS.md) - Certificate setup

### For Users
1. [README.md](README.md) - What is MCP Tools Catalog
2. [DISABLE-TOOLS-FIX-COMPLETE.md](DISABLE-TOOLS-FIX-COMPLETE.md) - How to disable tools

### For Troubleshooting
1. [DISABLE-TOOLS-FIX-COMPLETE.md](DISABLE-TOOLS-FIX-COMPLETE.md#troubleshooting) - Disable feature issues
2. [AUTHENTICATION.md](AUTHENTICATION.md) - Auth issues (401, 403)
3. [TROUBLESHOOTING-DEPLOYMENT.md](TROUBLESHOOTING-DEPLOYMENT.md) - Deployment issues
4. [DEPLOYMENT.md](DEPLOYMENT.md#authentication--authorization-architecture) - Auth architecture

## Documentation by Topic

### Architecture
- [MERGE-ARCHITECTURE.md](MERGE-ARCHITECTURE.md) - Catalog + Database merge pattern
- [CLAUDE.md](CLAUDE.md#project-structure) - Code organization
- [DEPLOYMENT.md](DEPLOYMENT.md#authentication--authorization-architecture) - Auth flow

### Authentication
- [AUTHENTICATION.md](AUTHENTICATION.md) - Complete guide
- [AUTHENTICATION-FIX-SUMMARY.md](AUTHENTICATION-FIX-SUMMARY.md) - Fix history
- [DEPLOYMENT.md](DEPLOYMENT.md#authentication--authorization-architecture) - Deployment config

### Validation
- [VALIDATION-APPROACH.md](VALIDATION-APPROACH.md) - Why Option A (no strict validation)
- [YAML-ENTITY-FIX.md](YAML-ENTITY-FIX.md#root-cause-2-catalog-provider-conflicts) - Validation conflicts

### Entity Management
- [MERGE-ARCHITECTURE.md](MERGE-ARCHITECTURE.md) - How entities are merged
- [YAML-ENTITY-FIX.md](YAML-ENTITY-FIX.md) - YAML entity support
- [DISABLE-TOOLS-FIX-COMPLETE.md](DISABLE-TOOLS-FIX-COMPLETE.md) - Disable/enable workflow

### Testing
- [TESTING.md](TESTING.md) - Test strategy
- [DISABLE-TOOLS-FIX-COMPLETE.md](DISABLE-TOOLS-FIX-COMPLETE.md#testing) - Feature testing
- [VERIFY-PLUGIN.md](VERIFY-PLUGIN.md) - Plugin verification

## Recent Changes

### December 25, 2025
- ✅ **Checkbox UI Fix Complete** - Visual state now updates correctly
- ✅ Added [CHECKBOX-UI-FIX.md](CHECKBOX-UI-FIX.md) - React state management best practices
- ✅ **Disable Tools Feature Complete** - State now persists
- ✅ Added [MERGE-ARCHITECTURE.md](MERGE-ARCHITECTURE.md) - Complete architecture
- ✅ Added [DISABLE-TOOLS-FIX-COMPLETE.md](DISABLE-TOOLS-FIX-COMPLETE.md) - Status & testing
- ✅ Updated [YAML-ENTITY-FIX.md](YAML-ENTITY-FIX.md) - Added merge logic
- ✅ Updated [CLAUDE.md](CLAUDE.md) - Phase 6 status, React hooks best practices
- ✅ Updated [README.md](README.md) - YAML entity support

### December 24, 2025
- ✅ Added [AUTHENTICATION-FIX-SUMMARY.md](AUTHENTICATION-FIX-SUMMARY.md)
- ✅ Added [AUTHENTICATION.md](AUTHENTICATION.md)
- ✅ Added [VALIDATION-APPROACH.md](VALIDATION-APPROACH.md)
- ✅ Updated [DEPLOYMENT.md](DEPLOYMENT.md) - Auth section

## Documentation Standards

### File Naming
- `FEATURE-NAME.md` - Feature documentation
- `FEATURE-NAME-FIX.md` - Fix history
- `FEATURE-NAME-SUMMARY.md` - Quick summary
- `UPPERCASE.md` - Important/reference docs

### Structure
Each documentation file should have:
- **Title** - Clear, descriptive
- **Overview** - What this doc covers
- **Problem** (if applicable) - What was wrong
- **Solution** (if applicable) - How it was fixed
- **Examples** - Code, commands, screenshots
- **References** - Links to related docs

### Maintenance
- Update docs when code changes
- Keep examples current
- Add dates to "Last Updated"
- Cross-reference related docs

## Contributing to Documentation

### Adding New Documentation
1. Create file following naming convention
2. Add to this index under appropriate section
3. Add cross-references in related docs
4. Update "Recent Changes" section

### Updating Existing Documentation
1. Update file content
2. Update "Last Updated" date
3. Add to "Recent Changes" if significant
4. Update cross-references if structure changed

### Documentation Review Checklist
- [ ] Clear title and overview
- [ ] Examples are accurate and tested
- [ ] Cross-references are valid
- [ ] Grammar and spelling checked
- [ ] Code blocks have language tags
- [ ] Diagrams are clear (if applicable)

## Feedback

Found an issue with documentation? Have a suggestion?
- Create GitHub issue with label `documentation`
- Submit PR with documentation improvements

---

**Last Updated**: December 25, 2025

**Total Documentation Files**: 15
