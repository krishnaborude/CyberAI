class RateLimiter {
  constructor({ windowMs, maxRequests }) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;
    this.buckets = new Map();
  }

  check(userId) {
    const now = Date.now();
    const bucket = this.buckets.get(userId) || [];
    const recent = bucket.filter((timestamp) => now - timestamp < this.windowMs);

    if (recent.length >= this.maxRequests) {
      const retryAfterMs = this.windowMs - (now - recent[0]);
      this.buckets.set(userId, recent);
      return { limited: true, retryAfterMs: Math.max(retryAfterMs, 1000) };
    }

    recent.push(now);
    this.buckets.set(userId, recent);
    return { limited: false, retryAfterMs: 0 };
  }
}

module.exports = RateLimiter;