/**
 * Socket Event Throttling Utilities
 * 
 * Provides throttling, debouncing, and batching for WebSocket events
 * to prevent overwhelming the server and improve performance.
 */

/**
 * Create a throttled function that only invokes at most once per wait period
 * Uses leading edge execution (executes immediately on first call)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function throttle<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): T & { cancel: () => void } {
  let lastTime = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;

  const throttled = function (this: unknown, ...args: Parameters<T>) {
    const now = Date.now();
    const remaining = wait - (now - lastTime);

    lastArgs = args;

    if (remaining <= 0) {
      // Execute immediately if enough time has passed
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      lastTime = now;
      func.apply(this, args);
    } else if (!timeoutId) {
      // Schedule trailing edge execution
      timeoutId = setTimeout(() => {
        lastTime = Date.now();
        timeoutId = null;
        if (lastArgs) {
          func.apply(this, lastArgs);
        }
      }, remaining);
    }
  } as T & { cancel: () => void };

  throttled.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
  };

  return throttled;
}

/**
 * Create a debounced function that delays invocation until after wait ms
 * have elapsed since the last call
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function debounce<T extends (...args: any[]) => void>(
  func: T,
  wait: number
): T & { cancel: () => void; flush: () => void } {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  let lastThis: unknown = null;

  const debounced = function (this: unknown, ...args: Parameters<T>) {
    lastArgs = args;
    lastThis = this;

    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      timeoutId = null;
      if (lastArgs) {
        func.apply(lastThis, lastArgs);
        lastArgs = null;
        lastThis = null;
      }
    }, wait);
  } as T & { cancel: () => void; flush: () => void };

  debounced.cancel = () => {
    if (timeoutId) {
      clearTimeout(timeoutId);
      timeoutId = null;
    }
    lastArgs = null;
    lastThis = null;
  };

  debounced.flush = () => {
    if (timeoutId && lastArgs) {
      clearTimeout(timeoutId);
      timeoutId = null;
      func.apply(lastThis, lastArgs);
      lastArgs = null;
      lastThis = null;
    }
  };

  return debounced;
}

/**
 * Event batcher that collects events and processes them in batches
 */
export class EventBatcher<T> {
  private queue: T[] = [];
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private readonly maxBatchSize: number;
  private readonly maxWaitMs: number;
  private readonly processor: (batch: T[]) => void;

  constructor(
    processor: (batch: T[]) => void,
    options: { maxBatchSize?: number; maxWaitMs?: number } = {}
  ) {
    this.processor = processor;
    this.maxBatchSize = options.maxBatchSize ?? 10;
    this.maxWaitMs = options.maxWaitMs ?? 100;
  }

  /**
   * Add an event to the batch queue
   */
  add(event: T): void {
    this.queue.push(event);

    // Process immediately if batch is full
    if (this.queue.length >= this.maxBatchSize) {
      this.flush();
      return;
    }

    // Start timer for delayed flush if not already running
    if (!this.timeoutId) {
      this.timeoutId = setTimeout(() => {
        this.flush();
      }, this.maxWaitMs);
    }
  }

  /**
   * Process all queued events immediately
   */
  flush(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }

    if (this.queue.length > 0) {
      const batch = [...this.queue];
      this.queue = [];
      this.processor(batch);
    }
  }

  /**
   * Clear the queue without processing
   */
  clear(): void {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    this.queue = [];
  }

  /**
   * Get current queue size
   */
  get size(): number {
    return this.queue.length;
  }
}

/**
 * Backpressure handler for managing overwhelmed connections
 */
export class BackpressureHandler {
  private pendingCount = 0;
  private readonly maxPending: number;
  private readonly onPressure: () => void;
  private readonly onRelease: () => void;
  private isPressured = false;

  constructor(options: {
    maxPending?: number;
    onPressure?: () => void;
    onRelease?: () => void;
  } = {}) {
    this.maxPending = options.maxPending ?? 50;
    this.onPressure = options.onPressure ?? (() => {});
    this.onRelease = options.onRelease ?? (() => {});
  }

  /**
   * Check if we're under backpressure
   */
  get isUnderPressure(): boolean {
    return this.isPressured;
  }

  /**
   * Get current pending count
   */
  get pending(): number {
    return this.pendingCount;
  }

  /**
   * Increment pending count, returns false if should reject
   */
  acquire(): boolean {
    if (this.isPressured) {
      return false;
    }

    this.pendingCount++;

    if (this.pendingCount >= this.maxPending && !this.isPressured) {
      this.isPressured = true;
      this.onPressure();
    }

    return true;
  }

  /**
   * Decrement pending count
   */
  release(): void {
    this.pendingCount = Math.max(0, this.pendingCount - 1);

    // Release pressure when we're at 50% capacity
    if (this.isPressured && this.pendingCount < this.maxPending / 2) {
      this.isPressured = false;
      this.onRelease();
    }
  }

  /**
   * Reset the handler
   */
  reset(): void {
    this.pendingCount = 0;
    this.isPressured = false;
  }
}

/**
 * Sliding window rate limiter for events
 */
export class SlidingWindowRateLimiter {
  private timestamps: Map<string, number[]> = new Map();
  private readonly windowMs: number;
  private readonly maxEvents: number;

  constructor(windowMs: number = 60000, maxEvents: number = 60) {
    this.windowMs = windowMs;
    this.maxEvents = maxEvents;
  }

  /**
   * Check if event is allowed for given key
   * Returns { allowed: boolean, remaining: number, resetIn: number }
   */
  check(key: string): { allowed: boolean; remaining: number; resetIn: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let timestamps = this.timestamps.get(key) || [];

    // Remove old timestamps
    timestamps = timestamps.filter((ts) => ts > windowStart);

    const remaining = Math.max(0, this.maxEvents - timestamps.length);
    const resetIn = timestamps.length > 0
      ? Math.max(0, timestamps[0] + this.windowMs - now)
      : 0;

    if (timestamps.length >= this.maxEvents) {
      this.timestamps.set(key, timestamps);
      return { allowed: false, remaining: 0, resetIn };
    }

    // Add new timestamp
    timestamps.push(now);
    this.timestamps.set(key, timestamps);

    return { allowed: true, remaining: remaining - 1, resetIn };
  }

  /**
   * Clear rate limit data for a key
   */
  clear(key: string): void {
    this.timestamps.delete(key);
  }

  /**
   * Clear all rate limit data matching a prefix
   */
  clearByPrefix(prefix: string): void {
    for (const key of this.timestamps.keys()) {
      if (key.startsWith(prefix)) {
        this.timestamps.delete(key);
      }
    }
  }

  /**
   * Get rate limit info without consuming a slot
   */
  peek(key: string): { remaining: number; resetIn: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    const timestamps = (this.timestamps.get(key) || []).filter(
      (ts) => ts > windowStart
    );

    return {
      remaining: Math.max(0, this.maxEvents - timestamps.length),
      resetIn: timestamps.length > 0
        ? Math.max(0, timestamps[0] + this.windowMs - now)
        : 0,
    };
  }
}

/**
 * Typing indicator throttler
 * Groups rapid typing updates into single events
 */
export class TypingThrottler {
  private typingUsers: Map<string, NodeJS.Timeout> = new Map();
  private readonly typingTimeout: number;
  private readonly onTypingStart: (userId: string) => void;
  private readonly onTypingStop: (userId: string) => void;

  constructor(options: {
    typingTimeout?: number;
    onTypingStart: (userId: string) => void;
    onTypingStop: (userId: string) => void;
  }) {
    this.typingTimeout = options.typingTimeout ?? 3000;
    this.onTypingStart = options.onTypingStart;
    this.onTypingStop = options.onTypingStop;
  }

  /**
   * Update typing status for a user
   */
  update(userId: string): void {
    const existing = this.typingUsers.get(userId);

    if (existing) {
      // Reset the timeout
      clearTimeout(existing);
    } else {
      // New typing start
      this.onTypingStart(userId);
    }

    // Set new timeout
    const timeout = setTimeout(() => {
      this.typingUsers.delete(userId);
      this.onTypingStop(userId);
    }, this.typingTimeout);

    this.typingUsers.set(userId, timeout);
  }

  /**
   * Stop typing for a user
   */
  stop(userId: string): void {
    const existing = this.typingUsers.get(userId);
    if (existing) {
      clearTimeout(existing);
      this.typingUsers.delete(userId);
      this.onTypingStop(userId);
    }
  }

  /**
   * Get list of currently typing users
   */
  getTypingUsers(): string[] {
    return Array.from(this.typingUsers.keys());
  }

  /**
   * Clear all typing states
   */
  clear(): void {
    for (const timeout of this.typingUsers.values()) {
      clearTimeout(timeout);
    }
    this.typingUsers.clear();
  }
}

/**
 * Create a throttled event emitter wrapper
 */
export function createThrottledEmitter<T>(
  emit: (event: string, data: T) => void,
  eventName: string,
  throttleMs: number
): (data: T) => void {
  let lastData: T | null = null;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let lastEmitTime = 0;

  return (data: T) => {
    const now = Date.now();
    lastData = data;

    if (now - lastEmitTime >= throttleMs) {
      // Emit immediately
      lastEmitTime = now;
      emit(eventName, data);
      return;
    }

    // Schedule for later
    if (!timeoutId) {
      timeoutId = setTimeout(() => {
        timeoutId = null;
        lastEmitTime = Date.now();
        if (lastData !== null) {
          emit(eventName, lastData);
        }
      }, throttleMs - (now - lastEmitTime));
    }
  };
}

// Pre-configured throttle times for common events
export const THROTTLE_TIMES = {
  // Very frequent events - heavy throttling
  TYPING_INDICATOR: 1000, // 1 second
  CURSOR_POSITION: 50, // 50ms for smooth cursor tracking
  SCROLL_POSITION: 100, // 100ms for scroll sync

  // Moderate frequency events
  ACTIVE_USERS_UPDATE: 2000, // 2 seconds
  PRESENCE_UPDATE: 5000, // 5 seconds

  // User actions - light throttling
  MESSAGE_SEND: 500, // 500ms between messages (UI feedback)
  ROOM_JOIN: 1000, // 1 second
  
  // Batching times
  BATCH_MESSAGES: 100, // Batch messages every 100ms
  BATCH_NOTIFICATIONS: 500, // Batch notifications every 500ms
} as const;

// Pre-configured rate limits
export const RATE_LIMITS = {
  MESSAGES_PER_MINUTE: 20,
  JOINS_PER_MINUTE: 10,
  TYPING_EVENTS_PER_MINUTE: 60,
} as const;
