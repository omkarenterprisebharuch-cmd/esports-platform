import { Pool, PoolClient, PoolConfig } from "pg";

// Allow self-signed certificates for cloud database providers
// Only set in development to avoid the warning during production builds
// The SSL config with rejectUnauthorized: false handles this properly
if (process.env.NODE_ENV === "development") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

// ============ Connection Queue Management ============
// For Aiven free tier with 3-connection limit

interface QueuedRequest {
  resolve: (client: PoolClient) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

const connectionQueue: QueuedRequest[] = [];
let activeConnections = 0;
const MAX_CONNECTIONS = 3;
const QUEUE_TIMEOUT = 30000; // 30 seconds max wait in queue

// Parse DATABASE_URL if available, otherwise use individual vars
function getPoolConfig(): PoolConfig {
  const databaseUrl = process.env.DATABASE_URL;
  
  // Log which connection method is being used
  if (process.env.NODE_ENV === "development") {
    console.log(`📊 Database config: ${databaseUrl ? "Using DATABASE_URL" : "Using individual DB_* vars"}`);
  }
  
  // Common SSL config for Aiven and other cloud providers
  const sslConfig = {
    rejectUnauthorized: false,
  };
  
  if (databaseUrl) {
    // Parse the connection string - always use SSL with rejectUnauthorized: false for Aiven
    return {
      connectionString: databaseUrl,
      ssl: sslConfig,
      max: MAX_CONNECTIONS,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  }
  
  // Fall back to individual environment variables
  return {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "5432"),
    database: process.env.DB_NAME || "esports_platform",
    user: process.env.DB_USER || "postgres",
    password: process.env.DB_PASSWORD || "",
    ssl: process.env.DB_SSL === "true" ? sslConfig : undefined,
    max: MAX_CONNECTIONS,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}

// Database connection pool using pg
const pool = new Pool(getPoolConfig());

// Handle pool errors to prevent crashes
pool.on("error", (err: Error) => {
  console.error("Unexpected database pool error:", err.message);
});

// Log connection stats in development
pool.on("connect", () => {
  activeConnections++;
  if (process.env.NODE_ENV === "development") {
    console.log(`📊 DB Connection opened (${activeConnections}/${MAX_CONNECTIONS} active)`);
  }
});

pool.on("remove", () => {
  activeConnections = Math.max(0, activeConnections - 1);
  // Process queued requests when a connection is released
  processQueue();
});

// Process waiting requests when a connection becomes available
function processQueue() {
  if (connectionQueue.length > 0 && activeConnections < MAX_CONNECTIONS) {
    const request = connectionQueue.shift();
    if (request) {
      clearTimeout(request.timeout);
      pool.connect()
        .then(request.resolve)
        .catch(request.reject);
    }
  }
}

// Get a connection with queue management
async function getConnection(): Promise<PoolClient> {
  // If we have capacity, connect directly
  if (activeConnections < MAX_CONNECTIONS) {
    return pool.connect();
  }

  // Otherwise queue the request
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      const index = connectionQueue.findIndex((r) => r.resolve === resolve);
      if (index > -1) {
        connectionQueue.splice(index, 1);
      }
      reject(new Error("Connection queue timeout - database is busy"));
    }, QUEUE_TIMEOUT);

    connectionQueue.push({ resolve, reject, timeout });
  });
}

// Get pool statistics for monitoring
export function getPoolStats() {
  return {
    totalConnections: pool.totalCount,
    idleConnections: pool.idleCount,
    waitingClients: pool.waitingCount,
    activeConnections,
    queueLength: connectionQueue.length,
    maxConnections: MAX_CONNECTIONS,
  };
}

// Test connection on startup (only in development)
if (process.env.NODE_ENV === "development") {
  pool
    .query("SELECT NOW()")
    .then(() => console.log("✅ Database connected successfully"))
    .catch((err) => console.error("❌ Database connection failed:", err.message));
}

export default pool;

// Helper function for transactions with queue management
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getConnection();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

// Type-safe query helper with retry logic
export async function query<T = unknown>(
  text: string,
  params?: unknown[],
  retries = 2
): Promise<T[]> {
  try {
    const result = await pool.query(text, params);
    return result.rows as T[];
  } catch (error) {
    if (retries > 0 && isRetryableError(error)) {
      console.log(`Retrying query... (${retries} attempts left)`);
      await sleep(500);
      return query(text, params, retries - 1);
    }
    throw error;
  }
}

// Get single row with retry logic
export async function queryOne<T = unknown>(
  text: string,
  params?: unknown[],
  retries = 2
): Promise<T | null> {
  try {
    const result = await pool.query(text, params);
    return (result.rows[0] as T) || null;
  } catch (error) {
    if (retries > 0 && isRetryableError(error)) {
      console.log(`Retrying query... (${retries} attempts left)`);
      await sleep(500);
      return queryOne(text, params, retries - 1);
    }
    throw error;
  }
}

// Helper to check if error is retryable
function isRetryableError(error: unknown): boolean {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("connection terminated") ||
      message.includes("connection timeout") ||
      message.includes("connection refused") ||
      message.includes("econnreset")
    );
  }
  return false;
}

// Sleep helper
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============ Batch Query Helpers ============

/**
 * Execute multiple queries in a single transaction for efficiency
 * Useful for batch inserts/updates
 */
export async function batchQuery<T = unknown>(
  queries: { text: string; params?: unknown[] }[]
): Promise<T[][]> {
  return withTransaction(async (client) => {
    const results: T[][] = [];
    for (const { text, params } of queries) {
      const result = await client.query(text, params);
      results.push(result.rows as T[]);
    }
    return results;
  });
}

/**
 * Batch insert using a single query with multiple VALUES
 * More efficient than multiple INSERT statements
 */
export async function batchInsert<T = unknown>(
  table: string,
  columns: string[],
  rows: unknown[][],
  returning?: string
): Promise<T[]> {
  if (rows.length === 0) return [];

  const placeholders: string[] = [];
  const values: unknown[] = [];
  let paramIndex = 1;

  for (const row of rows) {
    const rowPlaceholders: string[] = [];
    for (const value of row) {
      rowPlaceholders.push(`$${paramIndex}`);
      values.push(value);
      paramIndex++;
    }
    placeholders.push(`(${rowPlaceholders.join(", ")})`);
  }

  const query = `
    INSERT INTO ${table} (${columns.join(", ")})
    VALUES ${placeholders.join(", ")}
    ${returning ? `RETURNING ${returning}` : ""}
  `;

  const result = await pool.query(query, values);
  return result.rows as T[];
}

/**
 * Fetch multiple rows by IDs in a single query
 * Prevents N+1 queries when fetching related data
 */
export async function fetchByIds<T = unknown>(
  table: string,
  idColumn: string,
  ids: (string | number)[],
  columns = "*"
): Promise<T[]> {
  if (ids.length === 0) return [];

  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
  const query = `SELECT ${columns} FROM ${table} WHERE ${idColumn} IN (${placeholders})`;
  
  const result = await pool.query(query, ids);
  return result.rows as T[];
}

/**
 * Check existence of multiple items in one query
 * Returns a Set of existing IDs
 */
export async function checkExistence(
  table: string,
  idColumn: string,
  ids: (string | number)[]
): Promise<Set<string | number>> {
  if (ids.length === 0) return new Set();

  const placeholders = ids.map((_, i) => `$${i + 1}`).join(", ");
  const query = `SELECT ${idColumn} FROM ${table} WHERE ${idColumn} IN (${placeholders})`;
  
  const result = await pool.query(query, ids);
  return new Set(result.rows.map((row) => row[idColumn]));
}
