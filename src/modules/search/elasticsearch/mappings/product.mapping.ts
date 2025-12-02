/**
 * Elasticsearch Product Index Mapping
 *
 * Defines the schema and field types for product documents in Elasticsearch.
 * Optimized for:
 * - Full-text search on name and description
 * - Autocomplete functionality
 * - Faceted filtering (price, category, rating, stock)
 * - Nested seller information
 */

/**
 * Index settings including autocomplete analyzer
 */
export const productSettings = {
  analysis: {
    analyzer: {
      autocomplete: {
        type: 'custom',
        tokenizer: 'standard',
        filter: ['lowercase', 'autocomplete_filter'],
      },
    },
    filter: {
      autocomplete_filter: {
        type: 'edge_ngram',
        min_gram: 2,
        max_gram: 20,
      },
    },
  },
};

/**
 * Index mappings
 */
export const productMapping = {
  properties: {
    // Primary identifier
    id: {
      type: 'keyword',
    },

    // Product name with multiple analyzers
    name: {
      type: 'text',
      analyzer: 'standard',
      fields: {
        // Exact match for sorting
        keyword: {
          type: 'keyword',
          ignore_above: 256,
        },
        // Autocomplete support
        autocomplete: {
          type: 'text',
          analyzer: 'autocomplete',
          search_analyzer: 'standard',
        },
      },
    },

    // Product description - full-text search
    description: {
      type: 'text',
      analyzer: 'standard',
    },

    // Category for filtering
    category: {
      type: 'keyword',
    },

    // Price for range filtering and sorting
    price: {
      type: 'float',
    },

    // Stock quantity
    stock: {
      type: 'integer',
    },

    // Tags for additional filtering
    tags: {
      type: 'keyword',
    },

    // Average rating
    rating: {
      type: 'float',
    },

    // Seller information (nested object)
    seller: {
      type: 'nested',
      properties: {
        id: {
          type: 'keyword',
        },
        name: {
          type: 'text',
          fields: {
            keyword: {
              type: 'keyword',
              ignore_above: 256,
            },
          },
        },
        rating: {
          type: 'float',
        },
      },
    },

    // Timestamps
    createdAt: {
      type: 'date',
    },

    updatedAt: {
      type: 'date',
    },

    // Product status
    status: {
      type: 'keyword',
    },

    // Images for display
    images: {
      type: 'keyword',
      index: false, // Don't index image URLs
    },

    // Total reviews count
    reviewCount: {
      type: 'integer',
    },

    // Sales count for trending/popularity
    salesCount: {
      type: 'integer',
    },
  },
  // Index settings
  settings: {
    number_of_shards: 1,
    number_of_replicas: 1,
    analysis: {
      analyzer: {
        // Custom autocomplete analyzer
        autocomplete: {
          type: 'custom',
          tokenizer: 'edge_ngram_tokenizer',
          filter: ['lowercase', 'asciifolding'],
        },
      },
      tokenizer: {
        edge_ngram_tokenizer: {
          type: 'edge_ngram',
          min_gram: 2,
          max_gram: 10,
          token_chars: ['letter', 'digit'],
        },
      },
    },
  },
};
