import { Pool, PoolClient } from "pg";

// Database connection pool using pg (same as your Express backend)
const pool = new Pool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "5432"),
  database: process.env.DB_NAME || "esports_platform",
  user: process.env.DB_USER || "postgres",
  password: process.env.DB_PASSWORD || "",
  ssl:
    process.env.DB_SSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 3, // Very small pool for Aiven free tier (limited connections)
  idleTimeoutMillis: 30000, // Close idle clients after 30 seconds
  connectionTimeoutMillis: 10000, // Wait up to 10 seconds for connection
  query_timeout: 30000, // Queries timeout after 30 seconds
  statement_timeout: 30000, // Statement timeout 30 seconds
  keepAlive: false, // Don't keep connections alive to free slots
});

// Handle pool errors to prevent crashes
pool.on("error", (err: Error) => {
  console.error("Unexpected database pool error:", err.message);
});

// Test connection on startup (only in development)
if (process.env.NODE_ENV === "development") {
  pool
    .query("SELECT NOW()")
    .then(() => console.log("✅ Database connected successfully"))
    .catch((err) => console.error("❌ Database connection failed:", err.message));
}

export default pool;

// Helper function for transactions
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
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
