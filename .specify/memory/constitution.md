<!--
Sync Impact Report:
- Version change: 1.3.0 → 1.5.0
- New principles added:
  * X. Red Hat Registry First - Container images must use Red Hat supported registries
  * XI. User Approval - User must verify problem solutions before execution
- Modified principles: None
- Added sections: None
- Removed sections: None
- Templates requiring updates:
  ✅ plan-template.md - Constitution Check section dynamically references principles; no changes needed
  ✅ spec-template.md - No direct principle references; compatible
  ✅ tasks-template.md - No direct principle references; compatible
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
All MCP infrastructure entities (servers, tools, workloads) MUST be registered and discoverable through the Backstage software catalog. The Backstage internal database MUST be the authoritative source of truth for all MCP entities; YAML files MUST NOT be treated as the primary data store. The catalog MUST provide APIs for creating, reading, updating, and deleting all MCP entity types. Entity schemas MUST use Backstage catalog-model conventions and validation. Relationships between entities MUST leverage Backstage EntityRef format and catalog graph capabilities. UI components MUST integrate with Backstage core-components and authentication system. No custom databases or entity stores MUST be introduced for MCP artifacts.

**Rationale**: The Backstage software catalog provides battle-tested entity management, relationship tracking, search capabilities, and authentication integration. Using the database as source of truth (rather than static YAML files) enables dynamic entity management, programmatic updates, and real-time catalog modifications. Exposing CRUD APIs allows external systems and users to manage entities without direct file system access, improving automation capabilities and reducing manual configuration overhead.

### VII. Vanilla OpenShift Platform Target
All components MUST target vanilla OpenShift platform without proprietary extensions or vendor-specific features. The project MUST use Backstage upstream distributions as the software catalog foundation. Deployment artifacts (Helm charts, manifests, container images) MUST be compatible with standard OpenShift installations without modification. Features MUST NOT rely on Red Hat Developer Hub proprietary capabilities unless a documented fallback exists for vanilla Backstage.

**Rationale**: Targeting vanilla OpenShift and upstream Backstage ensures maximum portability across OpenShift installations, avoids vendor lock-in, enables broader community adoption, and simplifies testing against standard Kubernetes/OpenShift distributions. This approach maintains compatibility with both community OpenShift and Red Hat OpenShift Container Platform while keeping the project accessible to the wider open source ecosystem.

### VIII. TypeScript-First Development
TypeScript MUST be the default implementation language for all new code. JavaScript MUST NOT be used when TypeScript is viable. All TypeScript code MUST enable strict mode (`strict: true` in tsconfig.json). Type annotations MUST be explicit and avoid `any` types except where interfacing with untyped third-party libraries. Code reviews MUST reject loosely-typed TypeScript that bypasses type safety.

**Rationale**: TypeScript provides compile-time type safety, improved IDE support, better refactoring capabilities, and enhanced code documentation through types. Strict typing catches bugs early in development, reduces runtime errors, and improves maintainability across large codebases. The OpenShift Console plugin SDK and Backstage ecosystem both provide comprehensive TypeScript support, making it the natural choice for this project.

### IX. Strict Typing for Python
When Python is used for tooling, automation, or backend services, all code MUST use Python 3.9+ type hints. Type checking MUST be enforced via mypy with strict mode enabled (`--strict` flag). Function signatures, class attributes, and return values MUST include explicit type annotations. Code reviews MUST reject untyped or loosely-typed Python code.

**Rationale**: Python's optional typing system, when used strictly, provides similar benefits to TypeScript: early error detection, improved IDE support, better documentation, and enhanced maintainability. In mixed-language projects, consistent typing discipline across both TypeScript and Python reduces cognitive overhead and maintains uniform code quality standards.

### X. Red Hat Registry First
All container images MUST be sourced from Red Hat supported registries (registry.redhat.io, registry.access.redhat.com, quay.io). Docker Hub (docker.io) MUST NOT be used as an image source due to rate limiting constraints that cause deployment failures. Base images MUST prefer UBI (Universal Base Image) variants when available. Third-party images MUST be mirrored to Quay.io or an internal registry before use in deployments. Dockerfiles and deployment manifests MUST explicitly specify full registry paths to prevent implicit Docker Hub resolution.

**Rationale**: Docker Hub imposes aggressive rate limits on unauthenticated and free-tier image pulls that cause unpredictable deployment failures in CI/CD pipelines and OpenShift cluster environments. Red Hat registries provide enterprise-grade reliability, SLA guarantees, and integrated security scanning. Using consistent registry sources simplifies image pull secret management, ensures predictable deployment behavior, and aligns with enterprise OpenShift best practices.

### XI. User Verification of Fixes
When the user identifies a problem, the proposed solution MUST be verified by the user before implementation. However, when the user provides explicit instructions, the agent SHOULD NOT request additional verification.

**Rationale**: Automated solutions to user-identified problems may lack context or be incorrect. User verification ensures the proposed fix aligns with intent. Conversely, redundant verification of explicit instructions slows down the development workflow.

## Security Requirements

All code MUST undergo security review before production deployment. Container images MUST be scanned for vulnerabilities and updated regularly. Network communication between components MUST use encrypted channels. Authentication and authorization MUST follow Red Hat Developer Hub standards. No sensitive data MUST be stored in container images or configuration files.

## Deployment Standards

Components MUST support Blue-Green deployment patterns on OpenShift. Resource limits and requests MUST be specified for all containers. Components MUST implement proper logging for observability without exposing sensitive information. Rollback procedures MUST be tested and documented for each component.

## Governance

This constitution supersedes all other development practices. All pull requests MUST verify compliance with these principles. Any deviation from security-first principle requires explicit justification and security team approval. Component isolation violations MUST be documented with technical rationale. Configuration-first violations require architecture review. Backstage catalog integration MUST be demonstrated for all MCP entity types, including verification that the database serves as source of truth and CRUD APIs are available. Platform compatibility MUST be verified against vanilla OpenShift. Language choice MUST be justified if deviating from TypeScript-first principle. Type safety violations require explicit justification and technical review. Container image sources MUST be verified against approved Red Hat registries; any Docker Hub usage MUST be flagged and remediated before merge.

**Version**: 1.5.0 | **Ratified**: 2025-10-26 | **Last Amended**: 2025-12-21
