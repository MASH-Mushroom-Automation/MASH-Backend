import { Response } from 'supertest';

export interface ErrorDiagnosis {
  endpoint: string;
  method: string;
  statusCode: number;
  errorType: string;
  rootCause: string;
  affectedComponents: string[];
  fixSuggestions: FixSuggestion[];
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  timestamp: Date;
  detailedMessage: string;
}

export interface FixSuggestion {
  step: number;
  description: string;
  file?: string;
  line?: number;
  command?: string;
  codeChange?: {
    from: string;
    to: string;
  };
}

export class ErrorAnalyzer {
  async analyze(
    response: any,
    context?: {
      expectedStatus: number;
      endpoint: string;
      testCase: string;
    },
  ): Promise<ErrorDiagnosis> {
    const statusCode = response.status;
    const body = response.body;
    const endpoint = context?.endpoint || response.req?.path || 'Unknown';
    const method = response.req?.method || 'Unknown';

    const errorType = this.categorizeError(statusCode, body);
    const rootCause = await this.identifyRootCause(errorType, body, context);
    const fixSuggestions = this.generateFixSuggestions(errorType, body, context);
    const severity = this.calculateSeverity(statusCode, errorType);

    const diagnosis: ErrorDiagnosis = {
      endpoint,
      method,
      statusCode,
      errorType,
      rootCause,
      affectedComponents: this.identifyAffectedComponents(errorType, endpoint),
      fixSuggestions,
      severity,
      timestamp: new Date(),
      detailedMessage: this.buildDetailedMessage(
        errorType,
        rootCause,
        statusCode,
        body,
      ),
    };

    return diagnosis;
  }

  private categorizeError(statusCode: number, body: any): string {
    // 401: Authentication failures
    if (statusCode === 401) {
      if (body.message?.includes('Invalid credentials')) {
        return 'INVALID_CREDENTIALS';
      }
      if (body.message?.includes('token')) {
        return 'INVALID_TOKEN';
      }
      if (body.message?.includes('expired')) {
        return 'TOKEN_EXPIRED';
      }
      return 'AUTHENTICATION_FAILURE';
    }

    // 400: Validation errors
    if (statusCode === 400) {
      if (Array.isArray(body.message) && body.message.some(m => m.includes('validation'))) {
        return 'VALIDATION_ERROR';
      }
      if (body.message?.includes('already exists')) {
        return 'DUPLICATE_ENTRY';
      }
      return 'BAD_REQUEST';
    }

    // 429: Rate limit
    if (statusCode === 429) {
      return 'RATE_LIMIT_EXCEEDED';
    }

    // 500: Server errors
    if (statusCode === 500) {
      if (body.message?.includes('database') || body.message?.includes('prisma')) {
        return 'DATABASE_ERROR';
      }
      if (body.message?.includes('jwt') || body.message?.includes('token')) {
        return 'JWT_SIGNING_ERROR';
      }
      return 'INTERNAL_SERVER_ERROR';
    }

    // 404: Not found
    if (statusCode === 404) {
      return 'RESOURCE_NOT_FOUND';
    }

    return 'UNKNOWN_ERROR';
  }

  private async identifyRootCause(
    errorType: string,
    body: any,
    context?: any,
  ): Promise<string> {
    const rootCauseMap: Record<string, string> = {
      INVALID_CREDENTIALS:
        'User provided incorrect email or password. Password hash does not match stored hash.',
      INVALID_TOKEN:
        'JWT token is malformed, has invalid signature, or was signed with different secret key.',
      TOKEN_EXPIRED:
        'JWT token has passed its expiration time (exp claim < current time).',
      VALIDATION_ERROR: `Request body failed DTO validation: ${Array.isArray(body.message) ? body.message.join(', ') : body.message}`,
      RATE_LIMIT_EXCEEDED:
        'Client exceeded the maximum number of requests allowed within the throttle time window.',
      DATABASE_ERROR:
        'PostgreSQL database connection failed or query execution error occurred.',
      JWT_SIGNING_ERROR:
        'JWT signing failed. Likely cause: JWT_SECRET environment variable not set or mismatch.',
      DUPLICATE_ENTRY:
        'Attempted to create resource with unique constraint violation (e.g., duplicate email).',
      RESOURCE_NOT_FOUND: 'Requested resource does not exist in database.',
      INTERNAL_SERVER_ERROR:
        'Uncaught exception in service or controller layer. Check server logs for stack trace.',
    };

    return rootCauseMap[errorType] || `Unknown error occurred: ${body.message || body.error}`;
  }

  private generateFixSuggestions(
    errorType: string,
    body: any,
    context?: any,
  ): FixSuggestion[] {
    const fixMap: Record<string, FixSuggestion[]> = {
      INVALID_CREDENTIALS: [
        {
          step: 1,
          description: 'Verify test user exists in database',
          command: 'npx prisma studio',
        },
        {
          step: 2,
          description: 'Check password hashing algorithm matches',
          file: 'src/modules/auth/auth.service.ts',
          line: 234,
        },
        {
          step: 3,
          description: 'Ensure Clerk user is synced with database',
          file: 'src/modules/auth/services/clerk.service.ts',
        },
      ],
      INVALID_TOKEN: [
        {
          step: 1,
          description: 'Verify JWT_SECRET in .env matches service configuration',
          file: '.env',
          line: 12,
          codeChange: {
            from: 'JWT_SECRET=wrong-secret',
            to: 'JWT_SECRET=<CORRECT_SECRET>',
          },
        },
        {
          step: 2,
          description: 'Check JWT signing uses environment variable',
          file: 'src/modules/auth/auth.service.ts',
          line: 234,
          codeChange: {
            from: "secret: 'hardcoded-secret'",
            to: 'secret: this.configService.get<string>("JWT_SECRET")',
          },
        },
        {
          step: 3,
          description: 'Verify ConfigModule loads .env file',
          file: 'src/app.module.ts',
          line: 15,
        },
      ],
      VALIDATION_ERROR: [
        {
          step: 1,
          description: 'Review DTO validation decorators',
          file: 'src/modules/auth/dto/*.dto.ts',
        },
        {
          step: 2,
          description: 'Check if all required fields are present in test data',
        },
        {
          step: 3,
          description: 'Verify data types match DTO expectations',
        },
      ],
      DATABASE_ERROR: [
        {
          step: 1,
          description: 'Check if PostgreSQL is running',
          command: 'docker compose -f docker-compose.dev.yml ps postgres',
        },
        {
          step: 2,
          description: 'Verify DATABASE_URL in .env',
          command: 'echo %DATABASE_URL%',
        },
        {
          step: 3,
          description: 'Run database migrations',
          command: 'npx prisma migrate deploy',
        },
        {
          step: 4,
          description: 'Test Prisma connection',
          command: 'npx prisma db push',
        },
      ],
      RATE_LIMIT_EXCEEDED: [
        {
          step: 1,
          description: 'Check @Throttle decorator configuration on endpoint',
          file: 'src/modules/auth/auth.controller.ts',
        },
        {
          step: 2,
          description: 'Adjust rate limits for testing environment',
          file: 'src/config/rate-limit.config.ts',
        },
        {
          step: 3,
          description: 'Implement exponential backoff in test suite',
        },
      ],
    };

    return (
      fixMap[errorType] || [
        {
          step: 1,
          description: 'Check server logs for detailed error message',
          command: 'tail -f logs/error.log',
        },
        {
          step: 2,
          description: 'Review recent code changes',
          command: 'git log --oneline -10',
        },
      ]
    );
  }

  private identifyAffectedComponents(errorType: string, endpoint: string): string[] {
    const baseComponents: Record<string, string[]> = {
      INVALID_CREDENTIALS: ['AuthService', 'ClerkService', 'PrismaService'],
      INVALID_TOKEN: ['JwtAuthGuard', 'AuthService', 'JwtStrategy'],
      VALIDATION_ERROR: ['ValidationPipe', 'DTO classes', 'class-validator'],
      RATE_LIMIT_EXCEEDED: ['ThrottlerGuard', 'RedisService', 'ThrottlerStorage'],
      DATABASE_ERROR: ['PrismaService', 'PostgreSQL', 'Database migrations'],
      JWT_SIGNING_ERROR: ['AuthService', 'ConfigService', 'Environment variables'],
    };

    const components = baseComponents[errorType] || ['Unknown'];

    // Add endpoint-specific components
    if (endpoint.includes('/auth')) {
      components.push('AuthController', 'auth.service.ts');
    }

    return components;
  }

  private calculateSeverity(statusCode: number, errorType: string): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
    if (statusCode === 500 || errorType.includes('DATABASE') || errorType.includes('JWT_SIGNING')) {
      return 'CRITICAL';
    }
    if (statusCode === 401 || statusCode === 403) {
      return 'HIGH';
    }
    if (statusCode === 400 || statusCode === 429) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private buildDetailedMessage(
    errorType: string,
    rootCause: string,
    statusCode: number,
    body: any,
  ): string {
    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ TEST FAILURE DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Error Type: ${errorType}
Status Code: ${statusCode}
Root Cause: ${rootCause}

Response Body:
${JSON.stringify(body, null, 2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `.trim();
  }
}
