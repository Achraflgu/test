import { Redis } from '@upstash/redis';

// Initialize Redis client using Upstash credentials
const redis = process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN
  ? new Redis({
      url: process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    })
  : null;

const COOKIE_PREFIX = 'cookie_pool:';
const METADATA_KEY = 'cookie_metadata';
const POOL_METADATA_KEY = 'cookie_pool_metadata';
const PRIMARY_COOKIE_KEY = 'cookie_primary';

// Check if Redis is available
export function isRedisAvailable() {
  return redis !== null;
}

// Save cookie to Redis
export async function saveCookieToRedis(index, cookieContent, metadata = {}) {
  if (!redis) return false;
  
  try {
    const key = `${COOKIE_PREFIX}${index}`;
    await redis.set(key, cookieContent);
    
    // Save metadata
    if (Object.keys(metadata).length > 0) {
      await redis.hset(`${key}:meta`, metadata);
    }
    
    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to save cookie ${index} to Redis: ${err.message}`);
    return false;
  }
}

// Get cookie from Redis
export async function getCookieFromRedis(index) {
  if (!redis) return null;
  
  try {
    const key = `${COOKIE_PREFIX}${index}`;
    const content = await redis.get(key);
    return content;
  } catch (err) {
    console.log(`  ⚠️ Failed to get cookie ${index} from Redis: ${err.message}`);
    return null;
  }
}

// Get all cookies from Redis
export async function getAllCookiesFromRedis() {
  if (!redis) return [];
  
  try {
    const keys = await redis.keys(`${COOKIE_PREFIX}*`);
    const cookies = [];
    
    for (const key of keys) {
      if (!key.includes(':meta')) {
        const index = parseInt(key.replace(COOKIE_PREFIX, ''));
        const content = await redis.get(key);
        
        if (content) {
          try {
            const metadata = await redis.hgetall(`${key}:meta`);
            cookies.push({
              index,
              path: key, // Virtual path for compatibility
              content,
              metadata
            });
          } catch {
            cookies.push({
              index,
              path: key,
              content
            });
          }
        }
      }
    }
    
    return cookies.sort((a, b) => a.index - b.index);
  } catch (err) {
    console.log(`  ⚠️ Failed to get cookies from Redis: ${err.message}`);
    return [];
  }
}

// Save primary cookie
export async function savePrimaryCookieToRedis(cookieContent) {
  if (!redis) return false;
  
  try {
    await redis.set(PRIMARY_COOKIE_KEY, cookieContent);
    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to save primary cookie to Redis: ${err.message}`);
    return false;
  }
}

// Get primary cookie
export async function getPrimaryCookieFromRedis() {
  if (!redis) return null;
  
  try {
    return await redis.get(PRIMARY_COOKIE_KEY);
  } catch (err) {
    console.log(`  ⚠️ Failed to get primary cookie from Redis: ${err.message}`);
    return null;
  }
}

// Save cookie metadata
export async function saveCookieMetadataToRedis(metadata) {
  if (!redis) return false;
  
  try {
    await redis.set(METADATA_KEY, JSON.stringify(metadata));
    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to save cookie metadata to Redis: ${err.message}`);
    return false;
  }
}

// Load cookie metadata
export async function loadCookieMetadataFromRedis() {
  if (!redis) return null;
  
  try {
    const data = await redis.get(METADATA_KEY);
    if (!data) return null;
    
    // Handle both string and already-parsed objects (Upstash may return either)
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (parseErr) {
        // If parsing fails, it might be stored incorrectly - return null
        console.log(`  ⚠️ Invalid JSON in Redis metadata: ${parseErr.message}`);
        return null;
      }
    }
    return data; // Already parsed
  } catch (err) {
    console.log(`  ⚠️ Failed to load cookie metadata from Redis: ${err.message}`);
    return null;
  }
}

// Save cookie pool metadata
export async function saveCookiePoolMetadataToRedis(metadata) {
  if (!redis) return false;
  
  try {
    await redis.set(POOL_METADATA_KEY, JSON.stringify(metadata));
    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to save pool metadata to Redis: ${err.message}`);
    return false;
  }
}

// Load cookie pool metadata
export async function loadCookiePoolMetadataFromRedis() {
  if (!redis) return null;
  
  try {
    const data = await redis.get(POOL_METADATA_KEY);
    if (!data) return null;
    
    // Handle both string and already-parsed objects (Upstash may return either)
    if (typeof data === 'string') {
      try {
        return JSON.parse(data);
      } catch (parseErr) {
        // If parsing fails, it might be stored incorrectly - return null
        console.log(`  ⚠️ Invalid JSON in Redis pool metadata: ${parseErr.message}`);
        return null;
      }
    }
    return data; // Already parsed
  } catch (err) {
    console.log(`  ⚠️ Failed to load pool metadata from Redis: ${err.message}`);
    return null;
  }
}

// Delete cookie from Redis
export async function deleteCookieFromRedis(index) {
  if (!redis) return false;
  
  try {
    const key = `${COOKIE_PREFIX}${index}`;
    await redis.del(key);
    await redis.del(`${key}:meta`);
    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to delete cookie ${index} from Redis: ${err.message}`);
    return false;
  }
}

// Clear all cookies from Redis
export async function clearAllCookiesFromRedis() {
  if (!redis) return false;
  
  try {
    const keys = await redis.keys(`${COOKIE_PREFIX}*`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    await redis.del(METADATA_KEY);
    await redis.del(POOL_METADATA_KEY);
    await redis.del(PRIMARY_COOKIE_KEY);
    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to clear cookies from Redis: ${err.message}`);
    return false;
  }
}

