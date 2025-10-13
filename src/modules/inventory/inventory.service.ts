import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';

interface InventoryItem {
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

  findOne(id: number): InventoryItem {
    const item = this.inventory.find((inv) => inv.id === id);
    if (!item) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }
    return item;
  }

  update(id: number, dto: UpdateInventoryDto): InventoryItem {
    const index = this.inventory.findIndex((inv) => inv.id === id);
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
    const index = this.inventory.findIndex((inv) => inv.id === id);
    if (index === -1) {
      throw new NotFoundException(`Inventory item with ID ${id} not found`);
    }
    const [removed] = this.inventory.splice(index, 1);
    return removed;
  }
}
