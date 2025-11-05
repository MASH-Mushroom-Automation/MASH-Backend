import { Controller, Get, Post, Patch, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiParam } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import { CreateInventoryDto } from './dto/create-inventory.dto';
import { UpdateInventoryDto } from './dto/update-inventory.dto';

@ApiTags('inventory')
@Controller('inventory')
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Post()
  create(@Body() dto: CreateInventoryDto) {
    return this.inventoryService.create(dto);
  }

  @Get()
  findAll() {
    return this.inventoryService.findAll();
  }

  @Get('search')
  search(@Query('q') query: string) {
    return this.inventoryService.search(query);
  }

  @Get(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Inventory item ID',
    required: true,
  })
  findOne(@Param('id') id: string) {
    return this.inventoryService.findOne(+id);
  }

  @Patch(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Inventory item ID',
    required: true,
  })
  update(@Param('id') id: string, @Body() dto: UpdateInventoryDto) {
    return this.inventoryService.update(+id, dto);
  }

  @Patch(':id/restore')
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Inventory item ID',
    required: true,
  })
  restore(@Param('id') id: string) {
    return this.inventoryService.restore(+id);
  }

  @Delete(':id')
  @ApiParam({
    name: 'id',
    type: Number,
    description: 'Inventory item ID',
    required: true,
  })
  remove(@Param('id') id: string) {
    return this.inventoryService.remove(+id);
  }
}
