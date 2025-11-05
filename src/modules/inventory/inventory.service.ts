import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';

export interface InventoryItem {
  id: number;
  itemName: string;
  sku?: string;
  quantity: number;
  price?: number;
  warehouseLocation?: string;
  supplierName?: string;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class InventoryService {
  private inventory: InventoryItem[] = [];
  private idCounter = 1;
  // store deleted items temporarily to allow restore
  private deleted: Map<number, InventoryItem> = new Map();

  create(dto: CreateInventoryDto): InventoryItem {
    const item = {
      id: this.idCounter++,
      ...dto,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.inventory.push(item);
    return item;
  }

  findAll(): InventoryItem[] {
    return this.inventory;
  }

  /**
   * Search inventory items by a query string. Matches against itemName, sku,
   * supplierName and warehouseLocation (case-insensitive substring search).
   */
  search(query?: string): InventoryItem[] {
    if (!query || !query.trim()) return this.findAll();
    const q = query.trim().toLowerCase();
    return this.inventory.filter(item => {
      return (
        item.itemName.toLowerCase().includes(q) ||
        (item.sku || '').toLowerCase().includes(q) ||
        (item.supplierName || '').toLowerCase().includes(q) ||
        (item.warehouseLocation || '').toLowerCase().includes(q)
      );
    });
  }

  findOne(id: number): InventoryItem {
    const item = this.inventory.find(inv => inv.id === id);
    if (!item) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }
    return item;
  }

  update(id: number, dto: UpdateInventoryDto): InventoryItem {
    const index = this.inventory.findIndex(inv => inv.id === id);
    if (index === -1) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }

    const updated = {
      ...this.inventory[index],
      ...dto,
      updatedAt: new Date(),
    };
    this.inventory[index] = updated;
    return updated;
  }

  remove(id: number): InventoryItem {
    const index = this.inventory.findIndex(inv => inv.id === id);
    if (index === -1) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }
    const [removed] = this.inventory.splice(index, 1);
    // keep a copy in the deleted map for potential restore
    this.deleted.set(removed.id, removed);
    return removed;
  }

  /**
   * Restores a previously deleted inventory item by id.
   * If the item exists in the deleted cache and no active item with the same id exists,
   * it will be re-inserted into the inventory and removed from the deleted cache.
   */
  restore(id: number): InventoryItem {
    const deletedItem = this.deleted.get(id);
    if (!deletedItem) {
      throw new NotFoundException(`Deleted inventory item with ID ${id} not found`);
    }

    // Ensure no active item already has the same id (shouldn't normally happen)
    const exists = this.inventory.find(inv => inv.id === id);
    if (exists) {
      // remove from deleted cache if a conflict exists, but keep active item unchanged
      this.deleted.delete(id);
      return exists;
    }

    // restore timestamps
    const restored: InventoryItem = {
      ...deletedItem,
      updatedAt: new Date(),
    };

    this.inventory.push(restored);
    this.deleted.delete(id);
    return restored;
  }
}
