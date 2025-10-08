import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AlertRuleService } from '../services/alert-rule.service';
import { CreateAlertRuleDto } from '../dto/create-alert-rule.dto';
import { UpdateAlertRuleDto } from '../dto/update-alert-rule.dto';

/**
 * Alert Rules Controller
 * Manages alert rule configuration via REST API
 *
 * @tag Alerts
 */
@ApiTags('Alert Rules')
@Controller('alerts/rules')
// @UseGuards(JwtAuthGuard) // Uncomment when auth is ready
// @ApiBearerAuth()
export class AlertRulesController {
  constructor(private readonly alertRuleService: AlertRuleService) {}

  /**
   * Create a new alert rule
   * POST /api/alerts/rules
   */
  @Post()
  @ApiOperation({
    summary: 'Create alert rule',
    description:
      'Create a new alert rule with specified conditions and thresholds',
  })
  @ApiResponse({
    status: 201,
    description: 'Alert rule created successfully',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid input data',
  })
  @ApiResponse({
    status: 409,
    description: 'Alert rule with this name already exists',
  })
  async create(
    @Body() createAlertRuleDto: CreateAlertRuleDto,
    @Request() req: any,
  ) {
    // TODO: Get userId from JWT token when auth is implemented
    const userId = req.user?.id || 'system'; // Temporary fallback

    return this.alertRuleService.create(createAlertRuleDto, userId);
  }

  /**
   * Get all alert rules with optional filtering
   * GET /api/alerts/rules?category=SENSOR&priority=HIGH&isActive=true
   */
  @Get()
  @ApiOperation({
    summary: 'List alert rules',
    description:
      'Get all alert rules with optional filtering by category, priority, and status',
  })
  @ApiQuery({
    name: 'category',
    required: false,
    description: 'Filter by alert category',
    enum: [
      'SYSTEM',
      'SECURITY',
      'BUSINESS',
      'USER',
      'SENSOR',
      'ORDER',
      'PAYMENT',
    ],
  })
  @ApiQuery({
    name: 'priority',
    required: false,
    description: 'Filter by alert priority',
    enum: ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'],
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: 'Filter by active status',
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'List of alert rules',
  })
  async findAll(
    @Query('category') category?: string,
    @Query('priority') priority?: string,
    @Query('isActive') isActive?: string,
  ) {
    const filters: any = {};

    if (category) filters.category = category;
    if (priority) filters.priority = priority;
    if (isActive !== undefined) {
      filters.isActive = isActive === 'true';
    }

    return this.alertRuleService.findAll(filters);
  }

  /**
   * Get a single alert rule by ID
   * GET /api/alerts/rules/:id
   */
  @Get(':id')
  @ApiOperation({
    summary: 'Get alert rule',
    description: 'Get detailed information about a specific alert rule',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert rule details',
  })
  @ApiResponse({
    status: 404,
    description: 'Alert rule not found',
  })
  async findOne(@Param('id') id: string) {
    return this.alertRuleService.findOne(id);
  }

  /**
   * Update an existing alert rule
   * PATCH /api/alerts/rules/:id
   */
  @Patch(':id')
  @ApiOperation({
    summary: 'Update alert rule',
    description: 'Update an existing alert rule configuration',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert rule updated successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Alert rule not found',
  })
  @ApiResponse({
    status: 409,
    description: 'Alert rule with this name already exists',
  })
  async update(
    @Param('id') id: string,
    @Body() updateAlertRuleDto: UpdateAlertRuleDto,
    @Request() req: any,
  ) {
    // TODO: Get userId from JWT token when auth is implemented
    const userId = req.user?.id || 'system';

    return this.alertRuleService.update(id, updateAlertRuleDto, userId);
  }

  /**
   * Delete an alert rule
   * DELETE /api/alerts/rules/:id
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete alert rule',
    description: 'Permanently delete an alert rule',
  })
  @ApiResponse({
    status: 204,
    description: 'Alert rule deleted successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Alert rule not found',
  })
  async remove(@Param('id') id: string) {
    await this.alertRuleService.remove(id);
  }

  /**
   * Toggle alert rule active status
   * POST /api/alerts/rules/:id/toggle
   */
  @Post(':id/toggle')
  @ApiOperation({
    summary: 'Toggle alert rule',
    description: 'Enable or disable an alert rule',
  })
  @ApiResponse({
    status: 200,
    description: 'Alert rule toggled successfully',
  })
  @ApiResponse({
    status: 404,
    description: 'Alert rule not found',
  })
  async toggleActive(@Param('id') id: string, @Request() req: any) {
    // TODO: Get userId from JWT token when auth is implemented
    const userId = req.user?.id || 'system';

    return this.alertRuleService.toggleActive(id, userId);
  }

  /**
   * Get active rules by category
   * GET /api/alerts/rules/category/:category/active
   */
  @Get('category/:category/active')
  @ApiOperation({
    summary: 'Get active rules by category',
    description: 'Get all active alert rules for a specific category',
  })
  @ApiResponse({
    status: 200,
    description: 'List of active alert rules',
  })
  async getActiveByCategory(@Param('category') category: string) {
    return this.alertRuleService.getActiveRulesByCategory(category);
  }
}
