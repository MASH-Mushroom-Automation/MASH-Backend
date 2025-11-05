import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class ElasticsearchService implements OnModuleInit {
  private readonly logger = new Logger(ElasticsearchService.name);
  private client!: Client | null;

  constructor(private config: ConfigService) {}

  async onModuleInit() {
    const node = this.config.get('ELASTICSEARCH_NODE');
    const username = this.config.get('ELASTICSEARCH_USERNAME');
    const password = this.config.get('ELASTICSEARCH_PASSWORD');

    // Skip initialization if no Elasticsearch node is configured
    if (!node || node.trim() === '') {
      this.logger.warn('⚠️ ELASTICSEARCH_NODE not configured - Search features disabled');
      this.client = null;
      return;
    }

    this.logger.log(`🔍 Initializing Elasticsearch client for ${node}...`);

    // Initialize Elasticsearch client with simplified configuration
    // Note: Elasticsearch v9 client handles timeouts internally
    this.client = new Client({
      node,
      ...(username && password ? { auth: { username, password } } : {}),
      // Retry configuration
      maxRetries: this.config.get('ELASTICSEARCH_MAX_RETRIES', 3),
      // Request timeout in milliseconds
      requestTimeout: 30000,
      // Connection settings
      compression: false, // Disable compression to avoid timeout issues
      sniffOnStart: false,
    });

    // Check connection in background (non-blocking)
    this.checkConnection().catch(error => {
      this.logger.warn('⚠️ Elasticsearch connection failed during startup:', error.message);
      this.logger.warn('⚠️ Search functionality will be limited until connection is established');
    });
  }

  private async checkConnection() {
    try {
      const health = await this.client.cluster.health();
      this.logger.log(`✅ Elasticsearch connected successfully`);
      this.logger.log(`📊 Cluster status: ${health.status}`);
      this.logger.log(`🔢 Number of nodes: ${health.number_of_nodes}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.warn(`⚠️ Elasticsearch connection check failed: ${errorMessage}`);
      throw error;
    }
  }

  /**
   * Get the Elasticsearch client instance
   */
  getClient(): Client {
    if (!this.client) {
      throw new Error('Elasticsearch is not configured or initialized');
    }
    return this.client;
  }

  /**
   * Check if Elasticsearch is available
   */
  isAvailable(): boolean {
    return this.client !== null;
  }

  /**
   * Create an index with mappings
   */
  async createIndex(index: string, mapping: Record<string, any>): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ index });

      if (!exists) {
        await this.client.indices.create({
          index,
          mappings: mapping,
        });
        this.logger.log(`✅ Created index: ${index}`);
      } else {
        this.logger.log(`ℹ️ Index already exists: ${index}`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to create index ${index}:`, error.message);
      throw error;
    }
  }

  /**
   * Index a single document
   */
  async indexDocument(index: string, id: string, document: any): Promise<void> {
    try {
      await this.client.index({
        index,
        id,
        document,
      });
      this.logger.debug(`✅ Indexed document ${id} in ${index}`);
    } catch (error) {
      this.logger.error(`❌ Failed to index document ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Bulk index multiple documents
   */
  async bulkIndex(index: string, documents: Array<{ id: string; data: any }>): Promise<void> {
    try {
      const operations = documents.flatMap(doc => [
        { index: { _index: index, _id: doc.id } },
        doc.data,
      ]);

      const result = await this.client.bulk({ operations });

      if (result.errors) {
        this.logger.warn(`⚠️ Bulk indexing had errors`);
      } else {
        this.logger.log(`✅ Bulk indexed ${documents.length} documents in ${index}`);
      }
    } catch (error) {
      this.logger.error(`❌ Bulk indexing failed:`, error.message);
      throw error;
    }
  }

  /**
   * Update a document
   */
  async updateDocument(index: string, id: string, updates: Record<string, any>): Promise<void> {
    try {
      await this.client.update({
        index,
        id,
        doc: updates,
      });
      this.logger.debug(`✅ Updated document ${id} in ${index}`);
    } catch (error) {
      this.logger.error(`❌ Failed to update document ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete a document
   */
  async deleteDocument(index: string, id: string): Promise<void> {
    try {
      await this.client.delete({
        index,
        id,
      });
      this.logger.debug(`✅ Deleted document ${id} from ${index}`);
    } catch (error) {
      this.logger.error(`❌ Failed to delete document ${id}:`, error.message);
      throw error;
    }
  }

  /**
   * Search documents
   */
  async search(index: string, query: Record<string, any>): Promise<any> {
    try {
      const result = await this.client.search({
        index,
        ...query,
      });
      return result;
    } catch (error) {
      this.logger.error(`❌ Search failed on ${index}:`, error.message);
      throw error;
    }
  }

  /**
   * Delete an index
   */
  async deleteIndex(index: string): Promise<void> {
    try {
      const exists = await this.client.indices.exists({ index });
      if (exists) {
        await this.client.indices.delete({ index });
        this.logger.log(`✅ Deleted index: ${index}`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to delete index ${index}:`, error.message);
      throw error;
    }
  }

  /**
   * Get cluster health
   */
  async getHealth(): Promise<any> {
    try {
      return await this.client.cluster.health();
    } catch (error) {
      this.logger.error('❌ Failed to get cluster health:', error.message);
      throw error;
    }
  }
}
