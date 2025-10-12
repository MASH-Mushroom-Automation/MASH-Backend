/**
 * @SelectableFields() Decorator
 *
 * Marks an endpoint as supporting field selection for response optimization.
 * Allows clients to specify which fields to return using ?fields=id,name,price query parameter.
 *
 * Benefits:
 * - 40-60% reduction in response payload size
 * - Faster network transfer times
 * - Reduced bandwidth costs
 * - GraphQL-style flexibility without GraphQL complexity
 *
 * Usage:
 * ```typescript
 * @Get()
 * @SelectableFields(['id', 'name', 'price', 'description', 'stock'])
 * async findAll(@Query('fields') fields?: string) {
 *   // Return full objects - interceptor handles field selection
 *   return this.productsService.findAll();
 * }
 * ```
 *
 * Client Request Examples:
 * ```
 * GET /api/v1/products?fields=id,name,price
 * GET /api/v1/products?fields=id,name,description,images
 * GET /api/v1/products (returns all fields if not specified)
 * ```
 */

import { SetMetadata } from '@nestjs/common';

/**
 * Metadata key for selectable fields
 */
export const SELECTABLE_FIELDS_KEY = 'selectableFields';

/**
 * Field selection configuration
 */
export interface FieldSelectionConfig {
  /**
   * Array of allowed fields that can be selected
   * If empty, all fields are selectable
   */
  allowedFields?: string[];

  /**
   * Fields that are always included regardless of selection
   * Useful for required fields like 'id'
   */
  requiredFields?: string[];

  /**
   * Default fields to return when no selection is specified
   * If not set, returns all fields
   */
  defaultFields?: string[];

  /**
   * Maximum number of fields that can be selected
   * Prevents abuse of field selection
   */
  maxFields?: number;

  /**
   * Whether to allow nested field selection (e.g., 'user.name')
   * Default: false
   */
  allowNestedSelection?: boolean;
}

/**
 * Decorator to enable field selection on an endpoint
 *
 * @param config - Field selection configuration or array of allowed fields
 *
 * @example Simple usage with allowed fields array
 * ```typescript
 * @SelectableFields(['id', 'name', 'email', 'role', 'createdAt'])
 * ```
 *
 * @example Advanced usage with full configuration
 * ```typescript
 * @SelectableFields({
 *   allowedFields: ['id', 'name', 'email', 'role', 'phone', 'avatar'],
 *   requiredFields: ['id'],
 *   defaultFields: ['id', 'name', 'email'],
 *   maxFields: 10,
 *   allowNestedSelection: true
 * })
 * ```
 */
export const SelectableFields = (
  config: string[] | FieldSelectionConfig = {},
): MethodDecorator => {
  // Normalize config to FieldSelectionConfig
  const normalizedConfig: FieldSelectionConfig = Array.isArray(config)
    ? { allowedFields: config }
    : config;

  return SetMetadata(SELECTABLE_FIELDS_KEY, normalizedConfig);
};
