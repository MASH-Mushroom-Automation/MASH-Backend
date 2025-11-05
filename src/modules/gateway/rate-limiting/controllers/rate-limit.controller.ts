import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiParam,
} from '@nestjs/swagger';
import { Roles } from '../../../auth/decorators/roles.decorator';
import { RolesGuard } from '../../../auth/guards/roles.guard';
import { JwtAuthGuard } from '../../../auth/guards/jwt-auth.guard';
import { DynamicRateLimitService } from '../services/dynamic-rate-limit.service';
import { RateLimitAnalyticsService } from '../services/rate-limit-analytics.service';
import {
  CreateRateLimitOverrideDto,
  UpdateRateLimitOverrideDto,
  RateLimitOverrideResponseDto,
  PaginatedOverridesResponseDto,
  RateLimitUsageResponseDto,
  ViolationStatsResponseDto,
  AbusePatternResponseDto,
  TestRateLimitDto,
} from '../dto/rate-limit-override.dto';

/**
 * RateLimitController - Manage rate limit overrides and analytics
 *
 * Provides REST endpoints for:
 * - Creating/updating/deleting per-user/API-key rate limit overrides
 * - Viewing current rate limit usage and violations
 * - Accessing rate limiting analytics and abuse detection
 * - Testing rate limit configurations
 *
 * Security:
 * - All endpoints require JWT authentication
 * - Most endpoints require ADMIN or SUPER_ADMIN role
 * - Usage endpoints accessible to authenticated users
 *
 * Use Cases:
 * - Grant premium users higher rate limits
 * - Temporarily increase limits during promotions
 * - Block abusive users with low limits
 * - Monitor API usage patterns
 * - Detect and respond to abuse
 */
@ApiTags('rate-limits')
@Controller('rate-limits')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RateLimitController {
  constructor(
    private readonly dynamicRateLimit: DynamicRateLimitService,
    private readonly analytics: RateLimitAnalyticsService,
  ) {}

  /**
   * Get all rate limit overrides (paginated)
   *
   * Returns a paginated list of all configured rate limit overrides.
   * Useful for admin dashboards and auditing.
   *
   * @param skip - Number of records to skip (for pagination)
   * @param take - Number of records to return (max 100)
   * @returns Paginated list of rate limit overrides
   */
  @Get('overrides')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List all rate limit overrides',
    description:
      'Returns paginated list of all rate limit overrides with user details. Requires ADMIN role.',
  })
  @ApiQuery({
    name: 'skip',
    required: false,
    type: Number,
    description: 'Number of records to skip (pagination)',
    example: 0,
  })
  @ApiQuery({
    name: 'take',
    required: false,
    type: Number,
    description: 'Number of records to return (max 100)',
    example: 20,
  })
  @ApiResponse({
    status: 200,
    description: 'Overrides retrieved successfully',
    type: [RateLimitOverrideResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async listOverrides(
    @Query('skip') skip?: number,
    @Query('take') take?: number,
  ): Promise<PaginatedOverridesResponseDto> {
    const skipNum = skip ? parseInt(String(skip), 10) : 0;
    const takeNum = take ? Math.min(parseInt(String(take), 10), 100) : 20;

    return this.dynamicRateLimit.getOverrides(skipNum, takeNum);
  }

  /**
   * Get rate limit overrides for a specific user
   *
   * Returns all rate limit overrides configured for a specific user.
   * Useful for user profile pages and support tools.
   *
   * @param userId - User ID to lookup
   * @returns List of rate limit overrides for the user
   */
  @Get('overrides/user/:userId')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get overrides for specific user',
    description: 'Returns all rate limit overrides for a specific user ID',
  })
  @ApiParam({
    name: 'userId',
    type: String,
    description: 'User ID',
    example: 'clx1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'User overrides retrieved successfully',
    type: [RateLimitOverrideResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getUserOverrides(@Param('userId') userId: string): Promise<RateLimitOverrideResponseDto[]> {
    return this.dynamicRateLimit.getUserOverrides(userId);
  }

  /**
   * Create a new rate limit override
   *
   * Creates a custom rate limit for a specific user, API key, or endpoint.
   * Can be used to grant premium access, handle promotions, or block abusive users.
   *
   * Priority rules:
   * - User + Endpoint (highest priority)
   * - Endpoint only
   * - User only
   * - Default rate limit (lowest priority)
   *
   * @param dto - Rate limit override configuration
   * @returns Created override with ID
   */
  @Post('overrides')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Create rate limit override',
    description:
      'Creates a custom rate limit for a user, API key, or endpoint. Higher priority overrides take precedence.',
  })
  @ApiResponse({
    status: 201,
    description: 'Override created successfully',
    type: RateLimitOverrideResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async createOverride(
    @Body() dto: CreateRateLimitOverrideDto,
  ): Promise<RateLimitOverrideResponseDto> {
    return this.dynamicRateLimit.createOverride(dto);
  }

  /**
   * Update an existing rate limit override
   *
   * Updates configuration for an existing rate limit override.
   * Can be used to adjust limits, change strategies, or update expiration.
   *
   * @param id - Override ID
   * @param dto - Updated configuration (partial)
   * @returns Updated override
   */
  @Put('overrides/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update rate limit override',
    description: 'Updates an existing rate limit override. All fields are optional.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Override ID',
    example: 'clx0987654321',
  })
  @ApiResponse({
    status: 200,
    description: 'Override updated successfully',
    type: RateLimitOverrideResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid input data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 404, description: 'Override not found' })
  async updateOverride(
    @Param('id') id: string,
    @Body() dto: UpdateRateLimitOverrideDto,
  ): Promise<RateLimitOverrideResponseDto> {
    return this.dynamicRateLimit.updateOverride(id, dto);
  }

  /**
   * Delete a rate limit override
   *
   * Removes a rate limit override. User will revert to default rate limits.
   *
   * @param id - Override ID
   * @returns Success confirmation
   */
  @Delete('overrides/:id')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete rate limit override',
    description: 'Deletes a rate limit override. User reverts to default rate limits.',
  })
  @ApiParam({
    name: 'id',
    type: String,
    description: 'Override ID',
    example: 'clx0987654321',
  })
  @ApiResponse({
    status: 200,
    description: 'Override deleted successfully',
    schema: {
      example: { success: true, message: 'Override deleted successfully' },
    },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({ status: 404, description: 'Override not found' })
  async deleteOverride(@Param('id') id: string): Promise<{ success: boolean; message: string }> {
    await this.dynamicRateLimit.deleteOverride(id);
    return {
      success: true,
      message: 'Override deleted successfully',
    };
  }

  /**
   * Get current rate limit usage for the authenticated user
   *
   * Returns current rate limit status including:
   * - Current limit and remaining requests
   * - Time until reset
   * - Applied strategy (if custom override exists)
   * - Usage statistics (24h, 1h)
   *
   * @param userId - Current user ID (from JWT)
   * @param endpoint - Optional endpoint to check
   * @returns Current rate limit usage
   */
  @Get('usage')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get current rate limit usage',
    description: 'Returns current rate limit status for authenticated user',
  })
  @ApiQuery({
    name: 'endpoint',
    required: false,
    type: String,
    description: 'Optional endpoint to check',
    example: '/api/v1/products',
  })
  @ApiResponse({
    status: 200,
    description: 'Usage retrieved successfully',
    type: RateLimitUsageResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getUsage(
    @Query('userId') userId: string,
    @Query('endpoint') endpoint?: string,
  ): Promise<RateLimitUsageResponseDto> {
    // TODO: Get userId from JWT token once auth is integrated
    const targetEndpoint = endpoint || '/api/v1/*';

    // Check current limit configuration
    const result = await this.dynamicRateLimit.checkLimit(userId, targetEndpoint, 'GET');

    // Get violation statistics
    const stats = await this.analytics.getViolationStats(userId);

    return {
      identifier: userId,
      endpoint: targetEndpoint,
      allowed: result.allowed,
      limit: result.limit,
      remaining: result.remaining,
      resetAt: new Date(Date.now() + result.resetMs),
      retryAfterMs: result.retryAfterMs,
      strategy: result.metadata?.strategy || 'default',
      stats: {
        violations24h: stats?.violationsLast24h || 0,
        violations1h: stats?.violationsLastHour || 0,
      },
    };
  }

  /**
   * Get recent rate limit violations
   *
   * Returns recent violations for analytics and monitoring.
   * Can be filtered by identifier and endpoint.
   *
   * @param identifier - Optional user ID or API key
   * @param endpoint - Optional endpoint to filter
   * @param limit - Max number of violations to return
   * @returns List of recent violations
   */
  @Get('violations')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get recent rate limit violations',
    description: 'Returns recent violations with optional filtering',
  })
  @ApiQuery({
    name: 'identifier',
    required: false,
    type: String,
    description: 'User ID or API key',
  })
  @ApiQuery({
    name: 'endpoint',
    required: false,
    type: String,
    description: 'Endpoint to filter',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max violations to return',
    example: 100,
  })
  @ApiResponse({
    status: 200,
    description: 'Violations retrieved successfully',
    type: [ViolationStatsResponseDto],
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getViolations(
    @Query('identifier') identifier?: string,
    @Query('endpoint') endpoint?: string,
    @Query('limit') limit?: number,
  ): Promise<any[]> {
    const limitNum = limit ? Math.min(parseInt(String(limit), 10), 1000) : 100;
    return this.analytics.getViolations(identifier, endpoint, limitNum);
  }

  /**
   * Get violation statistics for a user
   *
   * Returns aggregated statistics including:
   * - Total violations
   * - Violations in last 24h and 1h
   * - Top violated endpoints
   * - First and last violation timestamps
   *
   * @param identifier - User ID or API key
   * @returns Violation statistics
   */
  @Get('violations/stats/:identifier')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get violation statistics for user',
    description: 'Returns aggregated violation stats for a specific user',
  })
  @ApiParam({
    name: 'identifier',
    type: String,
    description: 'User ID or API key',
    example: 'clx1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Statistics retrieved successfully',
    type: ViolationStatsResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  @ApiResponse({
    status: 404,
    description: 'No violations found for identifier',
  })
  async getViolationStats(@Param('identifier') identifier: string): Promise<any> {
    return this.analytics.getViolationStats(identifier);
  }

  /**
   * Get top violators (abuse detection)
   *
   * Returns users with highest violation counts.
   * Useful for identifying abusive behavior and potential attacks.
   *
   * @param limit - Max violators to return
   * @returns List of top violators with counts
   */
  @Get('violations/top-violators')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Get top rate limit violators',
    description: 'Returns users with highest violation counts for abuse detection',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Max violators to return',
    example: 10,
  })
  @ApiResponse({
    status: 200,
    description: 'Top violators retrieved successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async getTopViolators(@Query('limit') limit?: number): Promise<any[]> {
    const limitNum = limit ? Math.min(parseInt(String(limit), 10), 100) : 10;
    return this.analytics.getTopViolators(limitNum);
  }

  /**
   * Detect abuse patterns for a user
   *
   * Analyzes violation patterns and assigns risk score.
   * Returns recommended actions (MONITOR, WARN, THROTTLE, BLOCK).
   *
   * Risk Factors:
   * - High violation rate (>100/24h)
   * - Rapid violations (>20/hour)
   * - API scraping patterns (>20 unique endpoints)
   * - Persistent attacking (>80% blocked rate)
   *
   * @param identifier - User ID or API key
   * @returns Abuse pattern analysis with risk score and recommendation
   */
  @Get('analytics/abuse-detection/:identifier')
  @Roles('ADMIN', 'SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Detect abuse patterns',
    description:
      'Analyzes user behavior and returns risk score with recommended action (MONITOR/WARN/THROTTLE/BLOCK)',
  })
  @ApiParam({
    name: 'identifier',
    type: String,
    description: 'User ID or API key',
    example: 'clx1234567890',
  })
  @ApiResponse({
    status: 200,
    description: 'Abuse pattern analysis completed',
    type: AbusePatternResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Admin access required',
  })
  async detectAbusePattern(@Param('identifier') identifier: string): Promise<any> {
    return this.analytics.detectAbusePattern(identifier);
  }

  /**
   * Test rate limit check (admin debugging)
   *
   * Performs a rate limit check without actually consuming a request.
   * Useful for testing configurations and debugging issues.
   *
   * @param userId - User ID to test
   * @param endpoint - Endpoint to test
   * @param method - HTTP method
   * @returns Rate limit check result
   */
  @Post('test')
  @Roles('SUPER_ADMIN')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Test rate limit configuration',
    description: 'Tests rate limit check without consuming request. For debugging and validation.',
  })
  @ApiResponse({
    status: 200,
    description: 'Test completed successfully',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({
    status: 403,
    description: 'Forbidden - Super admin access required',
  })
  async testRateLimit(@Body() body: TestRateLimitDto): Promise<any> {
    const method = body.method || 'GET';
    const requestCount = body.requestCount || 1;

    // Test multiple requests if specified
    const results = [];
    for (let i = 0; i < requestCount; i++) {
      const result = await this.dynamicRateLimit.checkLimit(body.identifier, body.endpoint, method);
      results.push({
        requestNumber: i + 1,
        allowed: result.allowed,
        limit: result.limit,
        current: result.current,
        remaining: result.remaining,
        resetMs: result.resetMs,
        strategy: result.metadata?.strategy || 'default',
      });

      // Stop if limit exceeded
      if (!result.allowed) {
        break;
      }
    }

    return {
      success: true,
      test: {
        identifier: body.identifier,
        endpoint: body.endpoint,
        method,
        requestCount,
      },
      results,
      summary: {
        totalRequests: results.length,
        allowedRequests: results.filter(r => r.allowed).length,
        blockedRequests: results.filter(r => !r.allowed).length,
      },
    };
  }
}
