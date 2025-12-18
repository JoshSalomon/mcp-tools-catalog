import { Entity } from '@backstage/catalog-model';
/**
 * Validation result interface
 */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings: ValidationWarning[];
}
export interface ValidationError {
    field: string;
    message: string;
    code: string;
}
export interface ValidationWarning {
    field: string;
    message: string;
    code: string;
}
/**
 * Validate MCP Server entity
 */
export declare function validateMcpServerEntity(entity: Entity): ValidationResult;
/**
 * Validate MCP Tool entity
 */
export declare function validateMcpToolEntity(entity: Entity): ValidationResult;
/**
 * Validate MCP Workload entity
 */
export declare function validateMcpWorkloadEntity(entity: Entity): ValidationResult;
/**
 * Validate any MCP entity based on its kind
 */
export declare function validateMcpEntity(entity: Entity): ValidationResult;
//# sourceMappingURL=validation.d.ts.map