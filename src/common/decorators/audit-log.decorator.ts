import { SetMetadata } from '@nestjs/common';
import { AuditAction } from '../services/audit-log.service';

/**
 * Audit Log Decorator
 *
 * Automatically logs method executions to the audit log.
 * Use this decorator on controller methods or service methods that perform
 * sensitive operations requiring audit trails.
 *
 * The decorator stores metadata that is later processed by AuditLogInterceptor.
 *
 * Features:
 * - Automatic logging of method calls
 * - Captures user context (userId, IP, user agent)
 * - Tracks before/after values for updates
 * - Configurable entity type and action
 *
 * Usage:
 * ```typescript
 * @AuditLog({
 *   action: AuditAction.USER_UPDATE,
 *   entity: 'User',
 *   getEntityId: (args) => args[0], // First parameter is userId
 * })
 * @Put(':id')
 * async updateUser(@Param('id') id: string, @Body() dto: UpdateUserDto) {
 *   return this.userService.update(id, dto);
 * }
 * ```
 *
 * Advanced Usage (track changes):
 * ```typescript
 * @AuditLog({
 *   action: AuditAction.ROLE_ASSIGN,
 *   entity: 'User',
 *   getEntityId: (args) => args[0],
 *   trackChanges: true, // Captures old values before update
 * })
 * @Post(':id/roles')
 * async assignRole(@Param('id') id: string, @Body() dto: AssignRoleDto) {
 *   return this.userService.assignRole(id, dto.roleId);
 * }
 * ```
 */

export const AUDIT_LOG_METADATA = 'audit_log';

export interface AuditLogOptions {
  /**
   * The action being performed (e.g., LOGIN, USER_UPDATE, ROLE_ASSIGN)
   */
  action: AuditAction | string;

  /**
   * The entity type being affected (e.g., 'User', 'Role', 'Permission')
   */
  entity: string;

  /**
   * Function to extract entity ID from method arguments
   * @param args Method arguments
   * @returns Entity ID (string)
   *
   * Example:
   * - getEntityId: (args) => args[0] // First parameter
   * - getEntityId: (args) => args[0].id // Extract from DTO
   * - getEntityId: (args) => args[1]?.userId // Second parameter
   */
  getEntityId?: (args: any[]) => string | undefined;

  /**
   * Whether to track changes (old values vs new values)
   * If true, the interceptor will query the entity before the method execution
   * Default: false
   */
  trackChanges?: boolean;

  /**
   * Custom metadata to include in audit log
   */
  metadata?: Record<string, any>;
}

/**
 * Audit Log Decorator
 * Marks a method for automatic audit logging
 */
export const AuditLog = (options: AuditLogOptions) => SetMetadata(AUDIT_LOG_METADATA, options);
