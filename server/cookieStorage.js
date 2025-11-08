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

// ====================================
// 🎁 COOKIE BACKUP POOL (for extra strong cookies)
// ====================================
const BACKUP_PREFIX = 'cookie_backup:';
const BACKUP_MAX_SIZE = 10; // Keep max 10 backup cookies

// Save cookie to backup pool
export async function saveCookieToBackup(cookieContent, metadata = {}) {
  if (!redis) return false;
  
  try {
    // Get current backup count
    const keys = await redis.keys(`${BACKUP_PREFIX}*`);
    const currentCount = keys.filter(k => !k.includes(':meta')).length;
    
    // If at max size, remove oldest (FIFO)
    if (currentCount >= BACKUP_MAX_SIZE) {
      const allKeys = await redis.keys(`${BACKUP_PREFIX}*`);
      const backupKeys = allKeys.filter(k => !k.includes(':meta')).sort();
      if (backupKeys.length > 0) {
        const oldestKey = backupKeys[0];
        await redis.del(oldestKey);
        await redis.del(`${oldestKey}:meta`);
      }
    }
    
    // Generate unique backup ID (timestamp-based)
    const backupId = `${BACKUP_PREFIX}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    await redis.set(backupId, cookieContent);
    
    // Save metadata
    const fullMetadata = {
      quality: 'strong',
      savedAt: new Date().toISOString(),
      ...metadata
    };
    await redis.set(`${backupId}:meta`, JSON.stringify(fullMetadata));
    
    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to save cookie to backup pool: ${err.message}`);
    return false;
  }
}

// Get one cookie from backup pool (FIFO - oldest first)
export async function getCookieFromBackup() {
  if (!redis) return null;
  
  try {
    const keys = await redis.keys(`${BACKUP_PREFIX}*`);
    const backupKeys = keys.filter(k => !k.includes(':meta')).sort();
    
    if (backupKeys.length === 0) return null;
    
    // Get oldest (first in sorted list)
    const oldestKey = backupKeys[0];
    const content = await redis.get(oldestKey);
    
    if (!content) {
      // Clean up if content is missing
      await redis.del(oldestKey);
      await redis.del(`${oldestKey}:meta`);
      return null;
    }
    
    // Get metadata
    let metadata = {};
    try {
      const metaStr = await redis.get(`${oldestKey}:meta`);
      if (metaStr) {
        metadata = typeof metaStr === 'string' ? JSON.parse(metaStr) : metaStr;
      }
    } catch {}
    
    // Remove from backup (it's being used)
    await redis.del(oldestKey);
    await redis.del(`${oldestKey}:meta`);
    
    return {
      content,
      metadata,
      backupId: oldestKey
    };
  } catch (err) {
    console.log(`  ⚠️ Failed to get cookie from backup pool: ${err.message}`);
    return null;
  }
}

// Get backup pool count
export async function getBackupPoolCount() {
  if (!redis) return 0;
  
  try {
    const keys = await redis.keys(`${BACKUP_PREFIX}*`);
    return keys.filter(k => !k.includes(':meta')).length;
  } catch (err) {
    return 0;
  }
}

// ====================================
// 🌐 YOUTUBE-WORKING PROXY PERSISTENCE
// ====================================
const PROXY_PREFIX = 'youtube_proxy:';
const PROXY_LIST_KEY = 'youtube_proxy_list';
const PROXY_METADATA_KEY = 'youtube_proxy_metadata';

// Save YouTube-working proxies to Redis
export async function saveYouTubeProxiesToRedis(proxies) {
  if (!redis) return false;
  
  try {
    // Save as a list (array) for easy retrieval
    if (proxies.length === 0) {
      await redis.del(PROXY_LIST_KEY);
      return true;
    }
    
    await redis.set(PROXY_LIST_KEY, JSON.stringify(proxies));
    
    // Also save metadata (timestamp, count)
    const metadata = {
      savedAt: Date.now(),
      count: proxies.length,
      lastValidated: Date.now()
    };
    await redis.set(PROXY_METADATA_KEY, JSON.stringify(metadata));
    
    console.log(`  💾 Saved ${proxies.length} YouTube-working proxies to Redis`);
    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to save YouTube proxies to Redis: ${err.message}`);
    return false;
  }
}

// Load YouTube-working proxies from Redis
export async function loadYouTubeProxiesFromRedis() {
  if (!redis) return [];
  
  try {
    const data = await redis.get(PROXY_LIST_KEY);
    if (!data) return [];
    
    // Handle both string and already-parsed arrays
    let proxies;
    if (typeof data === 'string') {
      try {
        proxies = JSON.parse(data);
      } catch (parseErr) {
        console.log(`  ⚠️ Invalid JSON in Redis proxy list: ${parseErr.message}`);
        return [];
      }
    } else {
      proxies = data;
    }
    
    if (!Array.isArray(proxies)) {
      console.log(`  ⚠️ Redis proxy data is not an array`);
      return [];
    }
    
    // Get metadata
    let metadata = null;
    try {
      const metaData = await redis.get(PROXY_METADATA_KEY);
      if (metaData) {
        metadata = typeof metaData === 'string' ? JSON.parse(metaData) : metaData;
      }
    } catch {}
    
    if (proxies.length > 0) {
      const age = metadata ? Date.now() - metadata.savedAt : 0;
      const ageHours = Math.floor(age / (1000 * 60 * 60));
      console.log(`  📥 Loaded ${proxies.length} YouTube-working proxies from Redis (saved ${ageHours}h ago)`);
    }
    
    return proxies;
  } catch (err) {
    console.log(`  ⚠️ Failed to load YouTube proxies from Redis: ${err.message}`);
    return [];
  }
}

// Update proxy metadata
export async function updateProxyMetadata(metadata = {}) {
  if (!redis) return false;
  
  try {
    const existing = await redis.get(PROXY_METADATA_KEY);
    let currentMetadata = {};
    
    if (existing) {
      try {
        currentMetadata = typeof existing === 'string' ? JSON.parse(existing) : existing;
      } catch {}
    }
    
    const updatedMetadata = {
      ...currentMetadata,
      ...metadata,
      lastUpdated: Date.now()
    };
    
    await redis.set(PROXY_METADATA_KEY, JSON.stringify(updatedMetadata));
    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to update proxy metadata: ${err.message}`);
    return false;
  }
}

