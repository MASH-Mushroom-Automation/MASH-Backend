import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ElasticsearchService } from '../elasticsearch/elasticsearch.service';
import { PrismaService } from '../../../database/prisma.service';
import { productMapping, productSettings } from '../elasticsearch/mappings/product.mapping';

/**
 * Product Indexer Service
 *
 * Handles indexing, updating, and removing products from Elasticsearch.
 * Automatically syncs product data from PostgreSQL to Elasticsearch.
 */
@Injectable()
export class ProductIndexerService implements OnModuleInit {
  private readonly logger = new Logger(ProductIndexerService.name);
  private readonly indexName = 'products';

  constructor(
    private readonly elasticsearch: ElasticsearchService,
    private readonly prisma: PrismaService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/require-await
  async onModuleInit() {
    // Create product index with mapping on startup (non-blocking)
    this.createIndexIfNotExists().catch(error => {
      this.logger.error('Failed to initialize product index:', error);
    });
  }

  /**
   * Create the products index with mapping if it doesn't exist
   */
  private async createIndexIfNotExists(): Promise<void> {
    try {
      const client = this.elasticsearch.getClient();

      // Skip if Elasticsearch is not configured
      if (!client) {
        this.logger.warn('⚠️ Elasticsearch not configured - product indexing disabled');
        return;
      }

      const exists = await client.indices.exists({
        index: this.indexName,
      });

      if (!exists) {
        this.logger.log(`Creating index: ${this.indexName}...`);
        await this.elasticsearch.createIndex(this.indexName, productMapping, productSettings);
        this.logger.log(`✅ Index ${this.indexName} created successfully with autocomplete analyzer`);
      } else {
        this.logger.log(`✅ Index ${this.indexName} already exists`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(
        `⚠️ Failed to create index ${this.indexName}: ${errorMessage} (Search functionality will be limited)`,
      );
      // Don't throw - allow app to start even if indexing fails
    }
  }

  /**
   * Index a single product
   */
  async indexProduct(productId: string): Promise<void> {
    try {
      // Fetch product from database
      const product = await this.prisma.product.findUnique({
        where: { id: productId },
      });

      if (!product) {
        this.logger.warn(`Product ${productId} not found in database`);
        return;
      }

      // Transform to Elasticsearch document
      const document = this.transformProduct(product);

      // Index the document
      await this.elasticsearch.indexDocument(this.indexName, productId, document);

      this.logger.debug(`✅ Indexed product: ${product.name}`);
    } catch (error) {
      this.logger.error(`Failed to index product ${productId}:`, error.message);
      throw error;
    }
  }

  /**
   * Bulk index multiple products
   */
  async bulkIndex(productIds: string[]): Promise<void> {
    try {
      this.logger.log(`Bulk indexing ${productIds.length} products...`);

      // Fetch all products
      const products = await this.prisma.product.findMany({
        where: {
          id: { in: productIds },
        },
      });

      // Transform products to Elasticsearch documents
      const documents = products.map(product => ({
        id: product.id,
        data: this.transformProduct(product),
      }));

      // Bulk index
      await this.elasticsearch.bulkIndex(this.indexName, documents);

      this.logger.log(`✅ Bulk indexed ${documents.length} products`);
    } catch (error) {
      this.logger.error('Failed to bulk index products:', error.message);
      throw error;
    }
  }

  /**
   * Update a product in the index
   */
  async updateProduct(productId: string, updates: Record<string, any>): Promise<void> {
    try {
      await this.elasticsearch.updateDocument(this.indexName, productId, updates);

      this.logger.debug(`✅ Updated product: ${productId}`);
    } catch (error) {
      this.logger.error(`Failed to update product ${productId}:`, error.message);
      throw error;
    }
  }

  /**
   * Remove a product from the index
   */
  async deleteProduct(productId: string): Promise<void> {
    try {
      await this.elasticsearch.deleteDocument(this.indexName, productId);

      this.logger.debug(`✅ Deleted product from index: ${productId}`);
    } catch (error) {
      this.logger.error(`Failed to delete product ${productId}:`, error.message);
      throw error;
    }
  }

  /**
   * Reindex all products from database
   */
  async reindexAll(): Promise<void> {
    try {
      this.logger.log('Starting full reindex of products...');

      // Get total count
      const totalProducts = await this.prisma.product.count();
      this.logger.log(`Found ${totalProducts} products to reindex`);

      // Batch size for processing
      const batchSize = 100;
      let processedCount = 0;

      // Process in batches
      for (let skip = 0; skip < totalProducts; skip += batchSize) {
        const products = await this.prisma.product.findMany({
          take: batchSize,
          skip,
        });

        // Transform and bulk index
        const documents = products.map(product => ({
          id: product.id,
          data: this.transformProduct(product),
        }));

        await this.elasticsearch.bulkIndex(this.indexName, documents);

        processedCount += products.length;
        this.logger.log(`Progress: ${processedCount}/${totalProducts} products indexed`);
      }

      this.logger.log(`✅ Reindexing completed: ${totalProducts} products`);
    } catch (error) {
      this.logger.error('Failed to reindex all products:', error.message);
      throw error;
    }
  }

  /**
   * Transform Prisma product model to Elasticsearch document
   */
  private transformProduct(product: any): Record<string, any> {
    // Parse categories from JSON field
    const categories = Array.isArray(product.categories) ? product.categories : [];

    const primaryCategory = categories[0] || 'Uncategorized';

    return {
      id: product.id,
      name: product.name,
      description: product.description || '',
      category: primaryCategory,
      price: parseFloat(product.price.toString()) || 0,
      stock: product.stock || 0,
      tags: Array.isArray(product.tags) ? product.tags : [],
      rating: 0, // Will be calculated from reviews later
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      status: product.isActive ? 'active' : 'inactive',
      images: Array.isArray(product.images) ? product.images : [],
      reviewCount: 0, // Will be calculated from reviews later
      salesCount: 0, // Will be calculated from orders later
      isFeatured: product.isFeatured || false,
      slug: product.slug,
      sku: product.sku,
    };
  }
}
