# MCP Tools Catalog - Testing Guide

This guide covers all aspects of testing the MCP Tools Catalog plugin, from unit tests to end-to-end integration testing.

## 🧪 Testing Overview

The MCP Tools Catalog includes multiple levels of testing:

- **Unit Tests**: Component and utility function testing
- **Integration Tests**: API and database integration testing  
- **End-to-End Tests**: Complete user workflow testing
- **Manual Tests**: Real-world scenario validation

## ⚙️ Test Setup

### Prerequisites

```bash
# Install dependencies
yarn install

# Install testing tools
cd plugins/mcp-tools-catalog
yarn install
```

### Test Configuration

The plugin uses standard Backstage testing configuration:
- **Jest** for unit testing
- **React Testing Library** for component testing
- **Cypress** for end-to-end testing
- **MSW** for API mocking

## 🔧 Unit Testing

### Running Unit Tests

```bash
# Run all unit tests
cd plugins/mcp-tools-catalog
yarn test

# Run tests in watch mode
yarn test --watch

# Run tests with coverage
yarn test --coverage

# Run specific test file
yarn test McpEntityProcessor.test.ts
```

### Test Structure

```
src/
├── __tests__/           # Test files
│   ├── components/
│   ├── services/
│   ├── utils/
│   └── processors/
├── __mocks__/          # Mock files
└── setupTests.ts       # Test setup
```

### Example Unit Tests

**Entity Schema Validation:**
```typescript
// src/__tests__/utils/validation.test.ts
import { validateMcpServerEntity } from '../utils/validation';

describe('validateMcpServerEntity', () => {
  it('should validate valid MCP server entity', () => {
    const entity = {
      apiVersion: 'mcp-catalog.io/v1alpha1',
      kind: 'MCPServer',
      metadata: { name: 'test-server' },
      spec: {
        type: 'stdio' as const,
        version: '1.0.0',
        endpoint: 'test-command'
      }
    };

    const result = validateMcpServerEntity(entity);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should reject invalid server type', () => {
    const entity = {
      apiVersion: 'mcp-catalog.io/v1alpha1',
      kind: 'MCPServer',
      metadata: { name: 'test-server' },
      spec: {
        type: 'invalid' as any,
        version: '1.0.0'
      }
    };

    const result = validateMcpServerEntity(entity);
    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.objectContaining({
        field: 'spec.type',
        code: 'INVALID_VALUE'
      })
    );
  });
});
```

**Component Testing:**
```typescript
// src/__tests__/components/McpServerCard.test.tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TestApiProvider } from '@backstage/test-utils';
import { McpServerCard } from '../../components/McpServerCard';

const mockEntity = {
  apiVersion: 'mcp-catalog.io/v1alpha1',
  kind: 'MCPServer',
  metadata: {
    name: 'github-server',
    description: 'GitHub integration server'
  },
  spec: {
    type: 'stdio' as const,
    version: '1.0.0',
    capabilities: ['tools', 'resources']
  }
};

describe('McpServerCard', () => {
  it('renders server information correctly', () => {
    render(
      <TestApiProvider apis={[]}>
        <McpServerCard entity={mockEntity} />
      </TestApiProvider>
    );

    expect(screen.getByText('github-server')).toBeInTheDocument();
    expect(screen.getByText('GitHub integration server')).toBeInTheDocument();
    expect(screen.getByText('stdio')).toBeInTheDocument();
    expect(screen.getByText('1.0.0')).toBeInTheDocument();
  });

  it('displays capabilities as tags', () => {
    render(
      <TestApiProvider apis={[]}>
        <McpServerCard entity={mockEntity} />
      </TestApiProvider>
    );

    expect(screen.getByText('tools')).toBeInTheDocument();
    expect(screen.getByText('resources')).toBeInTheDocument();
  });
});
```

### Mocking Strategy

**API Mocks:**
```typescript
// src/__mocks__/McpCatalogApi.ts
export const mockMcpCatalogApi = {
  getServerTools: jest.fn(),
  getToolWorkloads: jest.fn(),
  getWorkloadTools: jest.fn(),
  addToolToWorkload: jest.fn(),
  removeToolFromWorkload: jest.fn(),
  getHealthStatus: jest.fn(),
  validateRelationships: jest.fn(),
};
```

**Entity Mocks:**
```typescript
// src/__mocks__/entities.ts
export const mockMcpServer = {
  apiVersion: 'mcp-catalog.io/v1alpha1',
  kind: 'MCPServer',
  metadata: {
    name: 'test-server',
    namespace: 'default'
  },
  spec: {
    type: 'stdio',
    version: '1.0.0',
    endpoint: 'test-command'
  }
};

export const mockMcpTool = {
  apiVersion: 'mcp-catalog.io/v1alpha1',
  kind: 'MCPTool',
  metadata: {
    name: 'test-tool',
    namespace: 'default'
  },
  spec: {
    server: 'mcpserver:default/test-server',
    type: 'api-call'
  }
};
```

## 🔗 Integration Testing

### Database Integration Tests

```typescript
// src/__tests__/integration/entity-relationships.test.ts
import { getVoidLogger } from '@backstage/backend-common';
import { McpEntityProcessor } from '../../processors/McpEntityProcessor';

describe('McpEntityProcessor Integration', () => {
  let processor: McpEntityProcessor;

  beforeEach(() => {
    processor = new McpEntityProcessor();
  });

  it('should process tool relationships correctly', async () => {
    const mockEmit = jest.fn();
    const toolEntity = mockMcpTool;

    await processor.postProcessEntity(
      toolEntity,
      { type: 'url', target: 'test' },
      mockEmit
    );

    expect(mockEmit).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'relation',
        relation: {
          type: 'dependsOn',
          targetRef: toolEntity.spec.server
        }
      })
    );
  });
});
```

### API Integration Tests

```typescript
// src/__tests__/integration/api-endpoints.test.ts
import { McpCatalogClient } from '../../api/McpCatalogApi';

describe('McpCatalogClient Integration', () => {
  let client: McpCatalogClient;
  
  beforeEach(() => {
    client = new McpCatalogClient({
      discoveryApi: mockDiscoveryApi,
      identityApi: mockIdentityApi
    });
  });

  it('should fetch server tools correctly', async () => {
    // Mock network requests
    fetchMock.mockResponseOnce(JSON.stringify({
      server: mockMcpServer,
      tools: [mockMcpTool]
    }));

    const result = await client.getServerTools('test-server');
    
    expect(result.server.metadata.name).toBe('test-server');
    expect(result.tools).toHaveLength(1);
    expect(result.tools[0].metadata.name).toBe('test-tool');
  });
});
```

## 🌐 End-to-End Testing

### Cypress Setup

```typescript
// integration-tests/support/commands.ts
declare global {
  namespace Cypress {
    interface Chainable {
      loginToBackstage(): Chainable<Element>;
      registerMcpEntity(entity: any): Chainable<Element>;
      navigateToMcpCatalog(): Chainable<Element>;
    }
  }
}

Cypress.Commands.add('loginToBackstage', () => {
  cy.visit('/');
  // Backstage auth flow
});

Cypress.Commands.add('registerMcpEntity', (entity) => {
  cy.intercept('POST', '/api/catalog/entities', {
    statusCode: 201,
    body: entity
  });
});

Cypress.Commands.add('navigateToMcpCatalog', () => {
  cy.visit('/mcp-catalog');
  cy.get('[data-testid="mcp-catalog-page"]').should('be.visible');
});
```

### End-to-End Test Scenarios

```typescript
// integration-tests/tests/mcp-entity-management.cy.ts
describe('MCP Entity Management', () => {
  beforeEach(() => {
    cy.loginToBackstage();
  });

  it('should register and display MCP server', () => {
    const serverEntity = {
      apiVersion: 'mcp-catalog.io/v1alpha1',
      kind: 'MCPServer',
      metadata: { name: 'test-server' },
      spec: { type: 'stdio', version: '1.0.0' }
    };

    // Register entity
    cy.registerMcpEntity(serverEntity);
    
    // Navigate to catalog
    cy.navigateToMcpCatalog();
    
    // Verify entity appears
    cy.contains('test-server').should('be.visible');
    cy.get('[data-testid="mcp-server-card"]').should('contain', 'stdio');
  });

  it('should navigate from server to tools', () => {
    cy.navigateToMcpCatalog();
    
    // Click on server
    cy.get('[data-testid="mcp-server-card"]').first().click();
    
    // Should navigate to server detail page
    cy.url().should('include', '/mcp-server/');
    cy.get('[data-testid="server-tools-section"]').should('be.visible');
    
    // Click on a tool
    cy.get('[data-testid="tool-link"]').first().click();
    
    // Should navigate to tool detail page
    cy.url().should('include', '/mcp-tool/');
  });
});
```

### Test Data Setup

```typescript
// integration-tests/fixtures/mcp-entities.ts
export const testEntities = {
  server: {
    apiVersion: 'mcp-catalog.io/v1alpha1',
    kind: 'MCPServer',
    metadata: {
      name: 'github-integration-server',
      description: 'GitHub API integration server'
    },
    spec: {
      type: 'stdio',
      endpoint: 'docker run -i --rm github-mcp-server',
      version: '1.0.0',
      capabilities: ['tools', 'resources']
    }
  },
  tool: {
    apiVersion: 'mcp-catalog.io/v1alpha1',
    kind: 'MCPTool',
    metadata: {
      name: 'create-issue',
      description: 'Create GitHub issues'
    },
    spec: {
      server: 'mcpserver:default/github-integration-server',
      type: 'api-call',
      inputSchema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          body: { type: 'string' }
        }
      }
    }
  }
};
```

## 🔍 Manual Testing

### Test Scenarios

#### 1. Entity Registration Flow

```bash
# 1. Create test MCP server
cat > test-server.yaml << EOF
apiVersion: mcp-catalog.io/v1alpha1
kind: MCPServer
metadata:
  name: test-github-server
  description: "Test GitHub integration server"
spec:
  type: stdio
  endpoint: "echo 'test server'"
  version: "1.0.0"
  capabilities: ["tools"]
EOF

# 2. Register in Backstage UI
# - Go to "Create Component"
# - Select "Register Existing Component"
# - Upload test-server.yaml
# - Verify entity appears in catalog

# 3. Verify entity details
# - Click on the entity
# - Check all metadata is displayed correctly
# - Verify relationships section is present
```

#### 2. Relationship Testing

```bash
# 1. Create tool linked to server
cat > test-tool.yaml << EOF
apiVersion: mcp-catalog.io/v1alpha1
kind: MCPTool
metadata:
  name: test-tool
  description: "Test tool"
spec:
  server: "mcpserver:default/test-github-server"
  type: "test-type"
EOF

# 2. Register tool and verify:
# - Tool appears in catalog
# - Server page shows tool in "Tools" section
# - Tool page shows server in "Server" section
# - Navigation links work correctly
```

#### 3. Error Handling

```bash
# 1. Test broken reference
cat > broken-tool.yaml << EOF
apiVersion: mcp-catalog.io/v1alpha1
kind: MCPTool
metadata:
  name: broken-tool
spec:
  server: "mcpserver:default/nonexistent-server"
  type: "test"
EOF

# 2. Register and verify:
# - Error message is displayed
# - Validation endpoint reports the issue
# - UI shows broken reference indicator
```

### Performance Testing

#### Load Testing

```bash
# Generate multiple entities for load testing
for i in {1..100}; do
cat > test-server-$i.yaml << EOF
apiVersion: mcp-catalog.io/v1alpha1
kind: MCPServer
metadata:
  name: test-server-$i
spec:
  type: stdio
  version: "1.0.0"
  endpoint: "test-command-$i"
EOF
done

# Register all entities and measure:
# - Registration time
# - Catalog loading time
# - Search/filter performance
# - Memory usage
```

#### Browser Performance

```javascript
// Use browser dev tools to measure:
// - Page load times
// - JavaScript bundle size
// - Memory usage
// - Network requests

// Performance test script
console.time('catalog-load');
// Navigate to MCP catalog
console.timeEnd('catalog-load');

console.time('entity-search');
// Perform entity search
console.timeEnd('entity-search');
```

## 📊 Test Coverage

### Coverage Requirements

- **Unit Tests**: >80% line coverage
- **Integration Tests**: All API endpoints covered
- **E2E Tests**: All user workflows covered

### Generate Coverage Reports

```bash
# Generate unit test coverage
cd plugins/mcp-tools-catalog
yarn test --coverage

# View coverage report
open coverage/lcov-report/index.html
```

### Coverage Configuration

```javascript
// jest.config.js
module.exports = {
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
    '!src/**/__mocks__/**'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
};
```

## 🐛 Test Debugging

### Debug Unit Tests

```bash
# Run tests with Node debugger
node --inspect-brk node_modules/.bin/jest --runInBand

# Debug specific test
yarn test --testNamePattern="should validate MCP server" --verbose
```

### Debug Cypress Tests

```bash
# Open Cypress in debug mode
yarn cypress:open

# Run specific test file
yarn cypress run --spec "integration-tests/tests/entity-management.cy.ts"

# Debug with browser dev tools
yarn cypress open --browser chrome
```

### Common Test Issues

#### Mock Issues
```typescript
// Clear mocks between tests
afterEach(() => {
  jest.clearAllMocks();
});

// Reset modules
beforeEach(() => {
  jest.resetModules();
});
```

#### Async Testing
```typescript
// Use proper async/await
it('should handle async operations', async () => {
  const promise = someAsyncFunction();
  await expect(promise).resolves.toEqual(expectedResult);
});

// Wait for elements in tests
await screen.findByText('Loading...', {}, { timeout: 3000 });
```

## 🚀 Continuous Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml
name: Test MCP Tools Catalog

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'yarn'
      
      - name: Install dependencies
        run: yarn install --frozen-lockfile
      
      - name: Run unit tests
        run: |
          cd plugins/mcp-tools-catalog
          yarn test --coverage
      
      - name: Run integration tests
        run: yarn test:integration
      
      - name: Run E2E tests
        run: |
          cd integration-tests
          yarn cypress:run
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
```

## 📋 Test Checklist

Before releasing, ensure all tests pass:

- [ ] Unit tests pass with >80% coverage
- [ ] Integration tests pass for all APIs
- [ ] E2E tests pass for all user workflows
- [ ] Manual testing scenarios completed
- [ ] Performance benchmarks met
- [ ] Error handling tested
- [ ] Browser compatibility verified
- [ ] Accessibility tests pass
- [ ] Security scan clean

---

**Need help with testing?** Check the [troubleshooting guide](README.md#troubleshooting) or [open an issue](https://github.com/your-org/mcp-tools-catalog/issues).