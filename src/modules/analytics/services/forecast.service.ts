import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { CacheService } from '../../../common/services/cache.service';
import { OrderStatus } from '@prisma/client';

/**
 * Forecast Service - Predictive Analytics
 *
 * Provides revenue forecasting, demand prediction, and anomaly detection
 * using statistical methods and historical data analysis.
 */
@Injectable()
export class ForecastService {
  private readonly logger = new Logger(ForecastService.name);
  private readonly FORECAST_CACHE_PREFIX = 'analytics:forecast';
  private readonly FORECAST_TTL = 3600; // 1 hour cache

  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Forecast revenue for next N days using linear regression
   */
  async forecastRevenue(days: number = 30): Promise<any> {
    const cacheKey = `${this.FORECAST_CACHE_PREFIX}:revenue:${days}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for revenue forecast: ${days} days`);
      return cached;
    }

    // Get historical data (last 90 days)
    const historicalDays = Math.max(days * 3, 90);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - historicalDays);

    const orders = await this.prisma.order.findMany({
      where: {
        status: OrderStatus.DELIVERED,
        createdAt: { gte: startDate },
      },
      select: {
        total: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    if (orders.length === 0) {
      throw new NotFoundException('No historical data available for forecasting');
    }

    // Aggregate by day
    const dailyRevenue = this.aggregateByDay(orders);

    // Calculate linear regression
    const forecast = this.calculateLinearRegression(dailyRevenue, days);

    // Calculate confidence intervals
    const confidence = this.calculateConfidenceIntervals(dailyRevenue, forecast);

    const result = {
      historical: dailyRevenue.slice(-30), // Last 30 days
      forecast: forecast,
      confidence: confidence,
      metadata: {
        historicalDays: dailyRevenue.length,
        forecastDays: days,
        accuracy: confidence.accuracy,
        generatedAt: new Date().toISOString(),
      },
    };

    await this.cacheService.set(cacheKey, result, this.FORECAST_TTL);
    return result;
  }

  /**
   * Predict product demand based on historical sales
   */
  async predictDemand(productId?: string, days: number = 30): Promise<any> {
    const cacheKey = `${this.FORECAST_CACHE_PREFIX}:demand:${productId || 'all'}:${days}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for demand prediction`);
      return cached;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 90); // Last 90 days

    const where: any = {
      createdAt: { gte: startDate },
      status: OrderStatus.DELIVERED,
    };

    const orderItems = await this.prisma.orderItem.findMany({
      where: productId ? { ...where, productId } : { order: where },
      select: {
        quantity: true,
        productId: true,
        order: {
          select: {
            createdAt: true,
          },
        },
        product: {
          select: {
            name: true,
          },
        },
      },
    });

    if (orderItems.length === 0) {
      throw new NotFoundException('No sales data available for demand prediction');
    }

    // Group by product and calculate trends
    const demandByProduct = this.groupDemandByProduct(orderItems);

    // Calculate predictions for each product
    const predictions = Object.entries(demandByProduct).map(([prodId, data]: [string, any]) => {
      const dailyDemand = this.aggregateDemandByDay(data.sales);
      const avgDailyDemand =
        dailyDemand.reduce((sum, d) => sum + d.quantity, 0) / dailyDemand.length;
      const trend = this.calculateTrend(dailyDemand);

      return {
        productId: prodId,
        productName: data.productName,
        historical: {
          totalSold: data.totalQuantity,
          avgDailyDemand: Math.round(avgDailyDemand * 100) / 100,
          trend: trend.direction,
          trendStrength: trend.strength,
        },
        forecast: {
          nextPeriod: Math.round(avgDailyDemand * days),
          dailyAverage: Math.round(avgDailyDemand * 100) / 100,
          confidence: trend.confidence,
        },
      };
    });

    const result = {
      predictions: predictions.sort((a, b) => b.historical.totalSold - a.historical.totalSold),
      metadata: {
        productsAnalyzed: predictions.length,
        forecastDays: days,
        generatedAt: new Date().toISOString(),
      },
    };

    await this.cacheService.set(cacheKey, result, this.FORECAST_TTL);
    return result;
  }

  /**
   * Detect anomalies in revenue or sales patterns
   */
  async detectAnomalies(
    type: 'revenue' | 'orders' | 'users' = 'revenue',
    days: number = 30,
  ): Promise<any> {
    const cacheKey = `${this.FORECAST_CACHE_PREFIX}:anomalies:${type}:${days}`;
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for anomaly detection: ${type}`);
      return cached;
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    let dataPoints: any[] = [];

    if (type === 'revenue') {
      const orders = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.DELIVERED,
          createdAt: { gte: startDate },
        },
        select: {
          total: true,
          createdAt: true,
        },
      });
      dataPoints = this.aggregateByDay(orders);
    } else if (type === 'orders') {
      const orders = await this.prisma.order.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: startDate } },
        _count: { id: true },
      });
      dataPoints = orders.map(o => ({
        date: o.createdAt.toISOString().split('T')[0],
        value: o._count.id,
      }));
    } else if (type === 'users') {
      const users = await this.prisma.user.groupBy({
        by: ['createdAt'],
        where: { createdAt: { gte: startDate } },
        _count: { id: true },
      });
      dataPoints = users.map(u => ({
        date: u.createdAt.toISOString().split('T')[0],
        value: u._count.id,
      }));
    }

    if (dataPoints.length === 0) {
      throw new NotFoundException('No data available for anomaly detection');
    }

    // Calculate statistics
    const values = dataPoints.map(d => d.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const stdDev = Math.sqrt(
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length,
    );

    // Detect anomalies (values outside 2 standard deviations)
    const threshold = 2;
    const anomalies = dataPoints
      .map((point, index) => ({
        ...point,
        deviation: Math.abs((point.value - mean) / stdDev),
        isAnomaly: Math.abs(point.value - mean) > threshold * stdDev,
      }))
      .filter(point => point.isAnomaly);

    const result = {
      anomalies: anomalies,
      statistics: {
        mean: Math.round(mean * 100) / 100,
        stdDev: Math.round(stdDev * 100) / 100,
        threshold: threshold,
        dataPoints: dataPoints.length,
        anomalyCount: anomalies.length,
        anomalyRate: Math.round((anomalies.length / dataPoints.length) * 10000) / 100,
      },
      metadata: {
        type: type,
        period: `${days} days`,
        generatedAt: new Date().toISOString(),
      },
    };

    await this.cacheService.set(cacheKey, result, this.FORECAST_TTL);
    return result;
  }

  // Helper methods

  private aggregateByDay(orders: any[]): any[] {
    const dailyMap = new Map<string, number>();

    orders.forEach(order => {
      const date = order.createdAt.toISOString().split('T')[0];
      const current = dailyMap.get(date) || 0;
      dailyMap.set(date, current + Number(order.total));
    });

    return Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, value]) => ({ date, value }));
  }

  private aggregateDemandByDay(sales: any[]): any[] {
    const dailyMap = new Map<string, number>();

    sales.forEach(sale => {
      const date = sale.createdAt.toISOString().split('T')[0];
      const current = dailyMap.get(date) || 0;
      dailyMap.set(date, current + sale.quantity);
    });

    return Array.from(dailyMap.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, quantity]) => ({ date, quantity }));
  }

  private calculateLinearRegression(data: any[], forecastDays: number): any[] {
    const n = data.length;
    let sumX = 0,
      sumY = 0,
      sumXY = 0,
      sumXX = 0;

    data.forEach((point, index) => {
      const x = index;
      const y = point.value;
      sumX += x;
      sumY += y;
      sumXY += x * y;
      sumXX += x * x;
    });

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    const forecast: any[] = [];
    for (let i = 0; i < forecastDays; i++) {
      const x = n + i;
      const predictedValue = slope * x + intercept;
      const date = new Date();
      date.setDate(date.getDate() + i + 1);

      forecast.push({
        date: date.toISOString().split('T')[0],
        value: Math.max(0, Math.round(predictedValue * 100) / 100),
      });
    }

    return forecast;
  }

  private calculateConfidenceIntervals(historical: any[], forecast: any[]): any {
    const values = historical.map(h => h.value);
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Calculate R-squared for accuracy
    const predictions = historical.map((_, i) => {
      const slope = (forecast[0].value - historical[historical.length - 1].value) / forecast.length;
      return historical[historical.length - 1].value + slope * (i - historical.length + 1);
    });

    const ssRes = historical.reduce(
      (sum, point, i) => sum + Math.pow(point.value - predictions[i], 2),
      0,
    );
    const ssTot = historical.reduce((sum, point) => sum + Math.pow(point.value - mean, 2), 0);
    const rSquared = 1 - ssRes / ssTot;

    return {
      margin: Math.round(stdDev * 1.96 * 100) / 100, // 95% confidence
      accuracy: Math.round(Math.max(0, rSquared) * 10000) / 100, // percentage
    };
  }

  private groupDemandByProduct(items: any[]): any {
    const grouped: any = {};

    items.forEach(item => {
      if (!grouped[item.productId]) {
        grouped[item.productId] = {
          productName: item.product.name,
          totalQuantity: 0,
          sales: [],
        };
      }
      grouped[item.productId].totalQuantity += item.quantity;
      grouped[item.productId].sales.push({
        quantity: item.quantity,
        createdAt: item.order.createdAt,
      });
    });

    return grouped;
  }

  private calculateTrend(data: any[]): any {
    if (data.length < 2) {
      return { direction: 'stable', strength: 0, confidence: 0 };
    }

    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));

    const firstAvg = firstHalf.reduce((sum, d) => sum + d.quantity, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.quantity, 0) / secondHalf.length;

    const change = ((secondAvg - firstAvg) / firstAvg) * 100;

    let direction = 'stable';
    if (change > 10) direction = 'increasing';
    else if (change < -10) direction = 'decreasing';

    return {
      direction,
      strength: Math.abs(Math.round(change * 100) / 100),
      confidence: Math.min(100, Math.round((data.length / 30) * 100)),
    };
  }
}
