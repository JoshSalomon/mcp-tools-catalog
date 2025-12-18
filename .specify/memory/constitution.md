<!--
Sync Impact Report:
- Version change: 1.1.0 → 1.2.0
- New principles added:
  * VII. Vanilla OpenShift Platform Target
  * VIII. TypeScript-First Development
  * IX. Strict Typing for Python
- Modified principles: None
- Added sections: Three new principle sections with detailed rationale
- Removed sections: None
- Templates requiring updates:
  ✅ plan-template.md - Technical Context section aligns with language preferences
  ✅ spec-template.md - Requirements compatible with platform and language constraints
  ✅ tasks-template.md - Task categorization compatible with new principles
- Follow-up TODOs: None
-->

# MCP Tool Catalog Constitution

## Core Principles

### I. Security-First (NON-NEGOTIABLE)
Security takes precedence over user experience and performance optimization. All components MUST implement defense-in-depth strategies. Code MUST be audited for vulnerabilities before deployment. Secrets and sensitive data MUST never be logged or exposed in configuration files. Container images MUST use minimal base images and non-root users.

**Rationale**: Given the OpenShift cluster deployment and enterprise context, security vulnerabilities could compromise the entire platform.

### II. Configuration-First
Catalog extensions MUST be achieved through configuration changes with minimal to zero code changes. Dynamic plugin configurations MUST be externalized and version-controlled. Container deployments MUST support environment-based configuration override.

**Rationale**: Configuration-based approaches reduce deployment complexity, improve maintainability, and enable rapid iteration without code rebuilds.

### III. Container-Ready
All components MUST be packaged as container images suitable for OpenShift deployment. Components MUST support health checks, graceful shutdown, and resource limits. Images MUST follow Red Hat best practices for container security and optimization.

**Rationale**: OpenShift deployment model requires containerized applications with proper lifecycle management.

### IV. Test-First Development
Test code MUST validate remote HTTP requests to OpenShift clusters. Integration tests MUST verify end-to-end component communication. UI components MUST have automated testing for critical user journeys. Tests MUST run in isolated environments that don't impact production clusters.

**Rationale**: Remote cluster testing requires rigorous validation to prevent deployment failures and service disruptions.

### V. Component Isolation
The three components (catalog extension, UI plugin, test suite) MUST be independently deployable and testable. Changes to one component MUST NOT require rebuilding others unless explicitly required for integration. Each component MUST have its own lifecycle management and versioning.

**Rationale**: Independent deployment enables faster iteration cycles and reduces blast radius of changes.

### VI. Backstage Software Catalog First
All MCP infrastructure entities (servers, tools, workloads) MUST be registered and discoverable through the Backstage software catalog. Entity schemas MUST use Backstage catalog-model conventions and validation. Relationships between entities MUST leverage Backstage EntityRef format and catalog graph capabilities. UI components MUST integrate with Backstage core-components and authentication system. No custom databases or entity stores MUST be introduced for MCP artifacts.

**Rationale**: The Backstage software catalog provides battle-tested entity management, relationship tracking, search capabilities, and authentication integration. Building on this foundation ensures consistency with organizational service catalogs, reduces maintenance burden, leverages existing tooling (catalog processors, validation, API clients), and provides users with a unified discovery experience across all infrastructure assets.

### VII. Vanilla OpenShift Platform Target
All components MUST target vanilla OpenShift platform without proprietary extensions or vendor-specific features. The project MUST use Backstage upstream distributions as the software catalog foundation. Deployment artifacts (Helm charts, manifests, container images) MUST be compatible with standard OpenShift installations without modification. Features MUST NOT rely on Red Hat Developer Hub proprietary capabilities unless a documented fallback exists for vanilla Backstage.

**Rationale**: Targeting vanilla OpenShift and upstream Backstage ensures maximum portability across OpenShift installations, avoids vendor lock-in, enables broader community adoption, and simplifies testing against standard Kubernetes/OpenShift distributions. This approach maintains compatibility with both community OpenShift and Red Hat OpenShift Container Platform while keeping the project accessible to the wider open source ecosystem.

### VIII. TypeScript-First Development
TypeScript MUST be the default implementation language for all new code. JavaScript MUST NOT be used when TypeScript is viable. All TypeScript code MUST enable strict mode (`strict: true` in tsconfig.json). Type annotations MUST be explicit and avoid `any` types except where interfacing with untyped third-party libraries. Code reviews MUST reject loosely-typed TypeScript that bypasses type safety.

**Rationale**: TypeScript provides compile-time type safety, improved IDE support, better refactoring capabilities, and enhanced code documentation through types. Strict typing catches bugs early in development, reduces runtime errors, and improves maintainability across large codebases. The OpenShift Console plugin SDK and Backstage ecosystem both provide comprehensive TypeScript support, making it the natural choice for this project.

### IX. Strict Typing for Python
When Python is used for tooling, automation, or backend services, all code MUST use Python 3.9+ type hints. Type checking MUST be enforced via mypy with strict mode enabled (`--strict` flag). Function signatures, class attributes, and return values MUST include explicit type annotations. Code reviews MUST reject untyped or loosely-typed Python code.

**Rationale**: Python's optional typing system, when used strictly, provides similar benefits to TypeScript: early error detection, improved IDE support, better documentation, and enhanced maintainability. In mixed-language projects, consistent typing discipline across both TypeScript and Python reduces cognitive overhead and maintains uniform code quality standards.

## Security Requirements

All code MUST undergo security review before production deployment. Container images MUST be scanned for vulnerabilities and updated regularly. Network communication between components MUST use encrypted channels. Authentication and authorization MUST follow Red Hat Developer Hub standards. No sensitive data MUST be stored in container images or configuration files.

## Deployment Standards

Components MUST support Blue-Green deployment patterns on OpenShift. Resource limits and requests MUST be specified for all containers. Components MUST implement proper logging for observability without exposing sensitive information. Rollback procedures MUST be tested and documented for each component.

## Governance

This constitution supersedes all other development practices. All pull requests MUST verify compliance with these principles. Any deviation from security-first principle requires explicit justification and security team approval. Component isolation violations MUST be documented with technical rationale. Configuration-first violations require architecture review. Backstage catalog integration MUST be demonstrated for all MCP entity types. Platform compatibility MUST be verified against vanilla OpenShift. Language choice MUST be justified if deviating from TypeScript-first principle. Type safety violations require explicit justification and technical review.

**Version**: 1.2.0 | **Ratified**: 2025-10-26 | **Last Amended**: 2025-11-25
