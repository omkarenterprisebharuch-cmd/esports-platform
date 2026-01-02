# Redis Configuration Guide

This document provides comprehensive guidance for configuring and using Redis in the Esports Platform.

## Quick Start

### 1. Set Environment Variable

Add your Redis URL to `.env.local`:

```env
# Redis Cloud
REDIS_URL=redis://default:<password>@<host>:<port>

# Local Redis
REDIS_URL=redis://localhost:6379

# Redis with TLS (use rediss://)
REDIS_URL=rediss://default:<password>@<host>:<port>
```

### 2. Verify Connection

Run the test script:

```bash
npx tsx scripts/test-redis.ts
```

### 3. Warm the Cache

Pre-populate frequently accessed data:

```bash
npx tsx scripts/warm-cache.ts --all
```

## Connection URL Format

```
redis://[username]:[password]@[host]:[port]
```

| Component | Description | Example |
|-----------|-------------|---------|
| Protocol | `redis://` or `rediss://` (TLS) | `redis://` |
| Username | Usually `default` for Redis Cloud | `default` |
| Password | Your Redis password | `NeBHF8f...` |
| Host | Redis server hostname | `redis-13456.c330.asia-south1-1.gce.cloud.redislabs.com` |
| Port | Redis port (default: 6379) | `13456` |

## Cache Architecture

### TTL (Time-To-Live) Values

```typescript
TTL.SHORT   = 60      // 1 minute - frequently changing data
TTL.MEDIUM  = 300     // 5 minutes - default for lists
TTL.LONG    = 900     // 15 minutes - stable data
TTL.HOUR    = 3600    // 1 hour - rarely changing data
TTL.DAY     = 86400   // 24 hours - static data
```

### Cache Key Prefixes

| Prefix | Purpose |
|--------|---------|
| `tournaments` | Tournament lists |
| `tournament` | Individual tournament data |
| `users` | User profiles |
| `teams` | Team data |
| `leaderboard` | Leaderboard rankings |
| `hof` | Hall of Fame data |
| `stats` | Platform statistics |

## Usage Examples

### Basic Cache Operations

```typescript
import { cache } from "@/lib/redis";

// Get or set with automatic caching
const tournaments = await cache.getOrSet(
  "tournaments:featured",
  () => fetchFeaturedTournaments(),
  300 // 5 minutes TTL
);

// Manual get/set
await cache.set("user:123", userData, 600);
const user = await cache.get("user:123");

// Delete specific key
await cache.del("user:123");

// Invalidate pattern
await cache.invalidatePattern("tournaments:*");
```

### Using Cached Queries

```typescript
import { cachedQueries } from "@/lib/db-cache";

// These automatically cache results
const upcoming = await cachedQueries.getUpcomingTournaments(10);
const leaderboard = await cachedQueries.getTournamentLeaderboard(tournamentId);
const stats = await cachedQueries.getPlatformStats();
```

### Cache Invalidation

```typescript
import { invalidatePattern } from "@/lib/redis";

// After creating/updating a tournament
await invalidatePattern("tournaments:*");
await invalidatePattern(`tournament:${tournamentId}:*`);

// After updating user profile
await invalidatePattern(`user:${userId}:*`);
```

## Best Practices

### 1. Security

- **Never commit credentials**: Keep `REDIS_URL` in `.env.local` (gitignored)
- **Use TLS in production**: Use `rediss://` protocol for encrypted connections
- **Rotate passwords**: Regularly rotate Redis passwords
- **Network security**: Use private endpoints when available

### 2. Performance

- **Appropriate TTLs**: Match TTL to data volatility
  - Real-time data: 30-60 seconds
  - User profiles: 5-15 minutes
  - Static content: 1 hour+
  
- **Key naming**: Use consistent, hierarchical keys
  ```
  tournament:123:details
  tournament:123:leaderboard
  tournament:123:registrations
  ```

- **Batch operations**: Use pipelines for multiple operations
  ```typescript
  const pipeline = redis.pipeline();
  pipeline.get("key1");
  pipeline.get("key2");
  const results = await pipeline.exec();
  ```

- **Memory management**: Set `maxmemory-policy` to `allkeys-lru` for cache use

### 3. Resilience

- **Graceful degradation**: App works without Redis (falls back to DB)
- **Connection pooling**: ioredis handles this automatically
- **Retry strategy**: Configure appropriate retry limits
- **Health checks**: Monitor Redis availability

### 4. Cache Warming

Pre-populate cache on deployment:

```bash
# Warm all caches
npx tsx scripts/warm-cache.ts --all

# Warm specific caches
npx tsx scripts/warm-cache.ts --tournaments
npx tsx scripts/warm-cache.ts --stats
npx tsx scripts/warm-cache.ts --tournament <id>
```

## Monitoring

### Check Cache Stats

Visit `/api/owner/cache-stats` (owner access required) or run:

```typescript
const stats = await cache.getStats();
console.log(stats.info.used_memory_human);
```

### Redis Cloud Console

- Monitor memory usage
- View connected clients
- Check slow log
- Configure alerts

## Troubleshooting

### Connection Refused

```
Error: connect ECONNREFUSED
```

**Solutions:**
1. Verify `REDIS_URL` is correct
2. Check firewall/security group rules
3. Ensure Redis server is running

### Authentication Failed

```
Error: NOAUTH Authentication required
```

**Solutions:**
1. Verify password in URL is correct
2. Check for special characters (URL encode if needed)

### Timeout Errors

```
Error: Connection timeout
```

**Solutions:**
1. Check network connectivity
2. Increase `connectTimeout` in Redis options
3. Verify host/port are correct

### Memory Limit Exceeded

```
Error: OOM command not allowed
```

**Solutions:**
1. Upgrade Redis plan
2. Reduce TTLs
3. Implement cache eviction
4. Prune unused keys

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `REDIS_URL` | Yes | - | Redis connection URL |
| `REDIS_ENABLED` | No | `true` | Set to `"false"` to disable caching |

## Scripts Reference

| Script | Description |
|--------|-------------|
| `scripts/test-redis.ts` | Test Redis connectivity |
| `scripts/warm-cache.ts` | Pre-populate cache |
| `scripts/cleanup-resources.ts` | Clean up expired data |

## Redis Cloud Setup

1. **Create account**: [Redis Cloud](https://redis.com/try-free/)
2. **Create database**: Choose region closest to your server
3. **Copy connection URL**: Format: `redis://default:<password>@<host>:<port>`
4. **Add to `.env.local`**: Set `REDIS_URL`
5. **Test connection**: Run `npx tsx scripts/test-redis.ts`

## Production Checklist

- [ ] Use `rediss://` (TLS) in production
- [ ] Set appropriate memory limits
- [ ] Configure eviction policy (`allkeys-lru`)
- [ ] Enable persistence if needed
- [ ] Set up monitoring/alerts
- [ ] Configure automatic backups
- [ ] Test failover scenarios
- [ ] Document cache invalidation strategies
