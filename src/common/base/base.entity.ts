/**
 * Base Entity Class
 * 
 * Abstract class providing common fields and methods for all entities
 * Features:
 * - Auto-generated UUID
 * - Timestamp management (createdAt, updatedAt)
 * - Soft delete support (deletedAt)
 * - Serialization control
 * 
 * @abstract
 */
export abstract class BaseEntity {
  /**
   * Unique identifier (UUID)
   */
  id: string;

  /**
   * Timestamp when entity was created
   */
  createdAt: Date;

  /**
   * Timestamp when entity was last updated
   */
  updatedAt: Date;

  /**
   * Timestamp when entity was soft deleted (null if not deleted)
   */
  deletedAt?: Date | null;

  /**
   * Constructor - Initialize entity with partial data
   */
  constructor(partial: Partial<BaseEntity>) {
    Object.assign(this, partial);
  }

  /**
   * Soft delete the entity
   * Sets deletedAt to current timestamp
   */
  softDelete(): void {
    this.deletedAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Restore a soft-deleted entity
   * Sets deletedAt to null
   */
  restore(): void {
    this.deletedAt = null;
    this.updatedAt = new Date();
  }

  /**
   * Check if entity is soft deleted
   */
  isDeleted(): boolean {
    return this.deletedAt !== null && this.deletedAt !== undefined;
  }

  /**
   * Check if entity is active (not deleted)
   */
  isActive(): boolean {
    return !this.isDeleted();
  }

  /**
   * Convert entity to plain object (for JSON serialization)
   * Override this method in child classes to customize serialization
   */
  toJSON(): Record<string, any> {
    const obj: Record<string, any> = {};

    Object.keys(this).forEach((key) => {
      const value = (this as any)[key];
      
      // Skip null/undefined values
      if (value === null || value === undefined) {
        return;
      }

      // Convert Date objects to ISO strings
      if (value instanceof Date) {
        obj[key] = value.toISOString();
      } else {
        obj[key] = value;
      }
    });

    return obj;
  }

  /**
   * Get entity metadata (id, timestamps)
   */
  getMetadata(): {
    id: string;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
  } {
    return {
      id: this.id,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      deletedAt: this.deletedAt,
    };
  }
}
