import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpStatus,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { GatewayService } from '../services/gateway.service';
import { LoadBalancerService } from '../services/load-balancer.service';
import { CircuitBreakerService } from '../services/circuit-breaker.service';
import { CreateGatewayConfigDto, UpdateGatewayConfigDto } from '../dto/gateway-config.dto';
import { PrismaService } from '../../../database/prisma.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@ApiTags('Gateway Management')
@Controller('api/v1/gateway')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class GatewayController {
  constructor(
    private readonly gatewayService: GatewayService,
    private readonly loadBalancerService: LoadBalancerService,
    private readonly circuitBreakerService: CircuitBreakerService,
    private readonly prisma: PrismaService,
  ) {}

  // ==================== Gateway Configuration ====================

  @Get('config')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all gateway route configurations' })
  @ApiResponse({ status: 200, description: 'Routes retrieved successfully' })
  async getConfigs() {
    const routes = await this.gatewayService.getRoutes();
    return {
      statusCode: HttpStatus.OK,
      message: 'Gateway configurations retrieved successfully',
      data: routes,
    };
  }

  @Post('config')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new gateway route configuration' })
  @ApiResponse({ status: 201, description: 'Route created successfully' })
  async createConfig(@Body() dto: CreateGatewayConfigDto) {
    const config = await this.prisma.apiGatewayConfig.create({
      data: dto,
    });

    // Invalidate cache
    await this.gatewayService.invalidateCache();

    return {
      statusCode: HttpStatus.CREATED,
      message: 'Gateway configuration created successfully',
      data: config,
    };
  }

  @Put('config/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update gateway route configuration' })
  @ApiResponse({ status: 200, description: 'Route updated successfully' })
  async updateConfig(@Param('id') id: string, @Body() dto: UpdateGatewayConfigDto) {
    const config = await this.prisma.apiGatewayConfig.update({
      where: { id },
      data: dto,
    });

    // Invalidate cache
    await this.gatewayService.invalidateCache();

    return {
      statusCode: HttpStatus.OK,
      message: 'Gateway configuration updated successfully',
      data: config,
    };
  }

  @Delete('config/:id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete gateway route configuration' })
  @ApiResponse({ status: 200, description: 'Route deleted successfully' })
  async deleteConfig(@Param('id') id: string) {
    await this.prisma.apiGatewayConfig.delete({
      where: { id },
    });

    // Invalidate cache
    await this.gatewayService.invalidateCache();

    return {
      statusCode: HttpStatus.OK,
      message: 'Gateway configuration deleted successfully',
    };
  }

  // ==================== Gateway Status & Health ====================

  @Get('health')
  @ApiOperation({ summary: 'Get gateway health status' })
  @ApiResponse({ status: 200, description: 'Health status retrieved' })
  async getHealth() {
    const stats = await this.gatewayService.getStatistics();
    const lbStats = this.loadBalancerService.getStatistics();
    const cbStats = await this.circuitBreakerService.getStatistics();

    return {
      statusCode: HttpStatus.OK,
      message: 'Gateway is operational',
      data: {
        gateway: stats,
        loadBalancer: lbStats,
        circuitBreaker: cbStats,
        timestamp: new Date().toISOString(),
      },
    };
  }

  @Get('services')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get service registry' })
  @ApiResponse({ status: 200, description: 'Services retrieved successfully' })
  async getServices() {
    const routes = await this.gatewayService.getRoutes();
    const services = routes.map(route => ({
      serviceName: route.serviceName,
      basePath: route.basePath,
      targetUrl: route.targetUrl,
      isActive: route.isActive,
      loadBalancing: route.loadBalancing,
      instances: this.loadBalancerService.getInstances(route.serviceName),
    }));

    return {
      statusCode: HttpStatus.OK,
      message: 'Services retrieved successfully',
      data: services,
    };
  }

  @Get('services/:serviceName/health')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get health status of specific service' })
  @ApiResponse({ status: 200, description: 'Service health retrieved' })
  async getServiceHealth(@Param('serviceName') serviceName: string) {
    const lbStats = this.loadBalancerService.getStatistics(serviceName);
    const cbStates = await this.circuitBreakerService.getAllStates();
    const cbState = cbStates.find(s => s.serviceName === serviceName);

    return {
      statusCode: HttpStatus.OK,
      message: 'Service health retrieved successfully',
      data: {
        serviceName,
        loadBalancer: lbStats,
        circuitBreaker: cbState,
      },
    };
  }

  // ==================== Circuit Breaker Management ====================

  @Get('circuit-breakers')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get all circuit breaker states' })
  @ApiResponse({ status: 200, description: 'Circuit breaker states retrieved' })
  async getCircuitBreakers() {
    const stats = await this.circuitBreakerService.getStatistics();

    return {
      statusCode: HttpStatus.OK,
      message: 'Circuit breaker states retrieved successfully',
      data: stats,
    };
  }

  @Post('circuit-breakers/:serviceName/reset')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reset circuit breaker for a service' })
  @ApiResponse({
    status: 200,
    description: 'Circuit breaker reset successfully',
  })
  async resetCircuitBreaker(@Param('serviceName') serviceName: string) {
    await this.circuitBreakerService.reset(serviceName);

    return {
      statusCode: HttpStatus.OK,
      message: `Circuit breaker reset successfully for ${serviceName}`,
    };
  }

  // ==================== Load Balancer Management ====================

  @Get('load-balancer/stats')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get load balancer statistics' })
  @ApiResponse({ status: 200, description: 'Load balancer stats retrieved' })
  async getLoadBalancerStats() {
    const stats = this.loadBalancerService.getStatistics();

    return {
      statusCode: HttpStatus.OK,
      message: 'Load balancer statistics retrieved successfully',
      data: stats,
    };
  }

  // ==================== Cache Management ====================

  @Post('cache/invalidate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Invalidate gateway routes cache' })
  @ApiResponse({ status: 200, description: 'Cache invalidated successfully' })
  async invalidateCache() {
    await this.gatewayService.invalidateCache();

    return {
      statusCode: HttpStatus.OK,
      message: 'Gateway routes cache invalidated successfully',
    };
  }
}
