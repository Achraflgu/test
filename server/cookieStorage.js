import { MongoClient } from 'mongodb';

// ====================================
// 🗄️ MONGODB CONNECTION
// ====================================

const MONGODB_URI = process.env.MONGODB_URI;

let client = null;
let db = null;
let isConnected = false;

// Collection names
const COLLECTIONS = {
  cookies: 'cookies',
  cookieMetadata: 'cookie_metadata',
  cookieBackups: 'cookie_backups',
  proxies: 'proxies'
};

// Initialize MongoDB connection
async function connectToMongo() {
  if (isConnected && client) {
    return db;
  }

  if (!MONGODB_URI) {
    console.log('⚠️ MONGODB_URI not configured - database storage disabled');
    return null;
  }

  try {
    client = new MongoClient(MONGODB_URI, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    await client.connect();
    db = client.db(); // Uses database from connection string
    isConnected = true;

    console.log('✅ Connected to MongoDB');

    // Create indexes for better performance
    await createIndexes();

    return db;
  } catch (err) {
    console.error('❌ MongoDB connection error:', err.message);
    isConnected = false;
    return null;
  }
}

// Create indexes for better query performance
async function createIndexes() {
  try {
    const cookiesCol = db.collection(COLLECTIONS.cookies);
    const backupsCol = db.collection(COLLECTIONS.cookieBackups);

    await cookiesCol.createIndex({ index: 1 }, { unique: true });
    await cookiesCol.createIndex({ type: 1 });
    await backupsCol.createIndex({ createdAt: 1 });
    await backupsCol.createIndex({ type: 1 });
  } catch (err) {
    // Indexes may already exist
  }
}

// Check if database is available
export function isRedisAvailable() {
  // Keep the same function name for compatibility
  return isConnected || !!MONGODB_URI;
}

// Ensure connection before operations
async function ensureConnection() {
  if (!isConnected) {
    await connectToMongo();
  }
  return db;
}

// ====================================
// 🍪 COOKIE POOL FUNCTIONS
// ====================================

// Save cookie to database
export async function saveCookieToRedis(index, cookieContent, metadata = {}) {
  try {
    const database = await ensureConnection();
    if (!database) return false;

    const collection = database.collection(COLLECTIONS.cookies);

    await collection.updateOne(
      { index, type: 'pool' },
      {
        $set: {
          index,
          type: 'pool',
          content: cookieContent,
          metadata,
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to save cookie ${index} to MongoDB: ${err.message}`);
    return false;
  }
}

// Get cookie from database
export async function getCookieFromRedis(index) {
  try {
    const database = await ensureConnection();
    if (!database) return null;

    const collection = database.collection(COLLECTIONS.cookies);
    const doc = await collection.findOne({ index, type: 'pool' });

    return doc ? doc.content : null;
  } catch (err) {
    console.log(`  ⚠️ Failed to get cookie ${index} from MongoDB: ${err.message}`);
    return null;
  }
}

// Get all cookies from database
export async function getAllCookiesFromRedis() {
  try {
    const database = await ensureConnection();
    if (!database) return [];

    const collection = database.collection(COLLECTIONS.cookies);
    const docs = await collection.find({ type: 'pool' }).sort({ index: 1 }).toArray();

    return docs.map(doc => ({
      index: doc.index,
      path: `cookie_${doc.index}`,
      content: doc.content,
      metadata: doc.metadata || {}
    }));
  } catch (err) {
    console.log(`  ⚠️ Failed to get cookies from MongoDB: ${err.message}`);
    return [];
  }
}

// Save primary cookie
export async function savePrimaryCookieToRedis(cookieContent) {
  try {
    const database = await ensureConnection();
    if (!database) return false;

    const collection = database.collection(COLLECTIONS.cookies);

    await collection.updateOne(
      { type: 'primary' },
      {
        $set: {
          type: 'primary',
          content: cookieContent,
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to save primary cookie to MongoDB: ${err.message}`);
    return false;
  }
}

// Get primary cookie
export async function getPrimaryCookieFromRedis() {
  try {
    const database = await ensureConnection();
    if (!database) return null;

    const collection = database.collection(COLLECTIONS.cookies);
    const doc = await collection.findOne({ type: 'primary' });

    return doc ? doc.content : null;
  } catch (err) {
    console.log(`  ⚠️ Failed to get primary cookie from MongoDB: ${err.message}`);
    return null;
  }
}

// ====================================
// 📊 METADATA FUNCTIONS
// ====================================

// Save cookie metadata
export async function saveCookieMetadataToRedis(metadata) {
  try {
    const database = await ensureConnection();
    if (!database) return false;

    const collection = database.collection(COLLECTIONS.cookieMetadata);

    await collection.updateOne(
      { type: 'cookie_metadata' },
      {
        $set: {
          type: 'cookie_metadata',
          data: metadata,
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to save cookie metadata to MongoDB: ${err.message}`);
    return false;
  }
}

// Load cookie metadata
export async function loadCookieMetadataFromRedis() {
  try {
    const database = await ensureConnection();
    if (!database) return null;

    const collection = database.collection(COLLECTIONS.cookieMetadata);
    const doc = await collection.findOne({ type: 'cookie_metadata' });

    return doc ? doc.data : null;
  } catch (err) {
    console.log(`  ⚠️ Failed to load cookie metadata from MongoDB: ${err.message}`);
    return null;
  }
}

// Save cookie pool metadata
export async function saveCookiePoolMetadataToRedis(metadata) {
  try {
    const database = await ensureConnection();
    if (!database) return false;

    const collection = database.collection(COLLECTIONS.cookieMetadata);

    await collection.updateOne(
      { type: 'pool_metadata' },
      {
        $set: {
          type: 'pool_metadata',
          data: metadata,
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to save pool metadata to MongoDB: ${err.message}`);
    return false;
  }
}

// Load cookie pool metadata
export async function loadCookiePoolMetadataFromRedis() {
  try {
    const database = await ensureConnection();
    if (!database) return null;

    const collection = database.collection(COLLECTIONS.cookieMetadata);
    const doc = await collection.findOne({ type: 'pool_metadata' });

    return doc ? doc.data : null;
  } catch (err) {
    console.log(`  ⚠️ Failed to load pool metadata from MongoDB: ${err.message}`);
    return null;
  }
}

// Delete cookie from database
export async function deleteCookieFromRedis(index) {
  try {
    const database = await ensureConnection();
    if (!database) return false;

    const collection = database.collection(COLLECTIONS.cookies);
    await collection.deleteOne({ index, type: 'pool' });

    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to delete cookie ${index} from MongoDB: ${err.message}`);
    return false;
  }
}

// Clear all cookies from database
export async function clearAllCookiesFromRedis() {
  try {
    const database = await ensureConnection();
    if (!database) return false;

    const cookiesCol = database.collection(COLLECTIONS.cookies);
    const metadataCol = database.collection(COLLECTIONS.cookieMetadata);

    await cookiesCol.deleteMany({});
    await metadataCol.deleteMany({});

    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to clear cookies from MongoDB: ${err.message}`);
    return false;
  }
}

// ====================================
// 🎁 COOKIE BACKUP POOL
// ====================================
const BACKUP_MAX_SIZE = 10;

// Save cookie to backup pool
export async function saveCookieToBackup(cookieContent, metadata = {}) {
  try {
    const database = await ensureConnection();
    if (!database) return false;

    const collection = database.collection(COLLECTIONS.cookieBackups);

    // Count current backups
    const count = await collection.countDocuments({ type: 'backup' });

    // If at max size, remove oldest
    if (count >= BACKUP_MAX_SIZE) {
      const oldest = await collection.findOne(
        { type: 'backup' },
        { sort: { createdAt: 1 } }
      );
      if (oldest) {
        await collection.deleteOne({ _id: oldest._id });
      }
    }

    // Insert new backup
    await collection.insertOne({
      type: 'backup',
      content: cookieContent,
      metadata: {
        quality: 'strong',
        savedAt: new Date().toISOString(),
        ...metadata
      },
      createdAt: new Date()
    });

    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to save cookie to backup pool: ${err.message}`);
    return false;
  }
}

// Get one cookie from backup pool (FIFO)
export async function getCookieFromBackup() {
  try {
    const database = await ensureConnection();
    if (!database) return null;

    const collection = database.collection(COLLECTIONS.cookieBackups);

    // Get and delete oldest backup
    const oldest = await collection.findOneAndDelete(
      { type: 'backup' },
      { sort: { createdAt: 1 } }
    );

    if (!oldest) return null;

    return {
      content: oldest.content,
      metadata: oldest.metadata || {},
      backupId: oldest._id.toString()
    };
  } catch (err) {
    console.log(`  ⚠️ Failed to get cookie from backup pool: ${err.message}`);
    return null;
  }
}

// Get backup pool count
export async function getBackupPoolCount() {
  try {
    const database = await ensureConnection();
    if (!database) return 0;

    const collection = database.collection(COLLECTIONS.cookieBackups);
    return await collection.countDocuments({ type: 'backup' });
  } catch (err) {
    return 0;
  }
}

// ====================================
// 🌐 YOUTUBE PROXY PERSISTENCE
// ====================================

// Save YouTube-working proxies
export async function saveYouTubeProxiesToRedis(proxies) {
  try {
    const database = await ensureConnection();
    if (!database) return false;

    const collection = database.collection(COLLECTIONS.proxies);

    await collection.updateOne(
      { type: 'youtube_proxies' },
      {
        $set: {
          type: 'youtube_proxies',
          proxies: proxies,
          count: proxies.length,
          savedAt: Date.now(),
          lastValidated: Date.now(),
          updatedAt: new Date()
        },
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

    console.log(`  💾 Saved ${proxies.length} YouTube-working proxies to MongoDB`);
    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to save YouTube proxies to MongoDB: ${err.message}`);
    return false;
  }
}

// Load YouTube-working proxies
export async function loadYouTubeProxiesFromRedis() {
  try {
    const database = await ensureConnection();
    if (!database) return [];

    const collection = database.collection(COLLECTIONS.proxies);
    const doc = await collection.findOne({ type: 'youtube_proxies' });

    if (!doc || !doc.proxies) return [];

    const proxies = doc.proxies;
    const age = doc.savedAt ? Date.now() - doc.savedAt : 0;
    const ageHours = Math.floor(age / (1000 * 60 * 60));

    if (proxies.length > 0) {
      console.log(`  📥 Loaded ${proxies.length} YouTube-working proxies from MongoDB (saved ${ageHours}h ago)`);
    }

    return proxies;
  } catch (err) {
    console.log(`  ⚠️ Failed to load YouTube proxies from MongoDB: ${err.message}`);
    return [];
  }
}

// Update proxy metadata
export async function updateProxyMetadata(metadata = {}) {
  try {
    const database = await ensureConnection();
    if (!database) return false;

    const collection = database.collection(COLLECTIONS.proxies);

    await collection.updateOne(
      { type: 'youtube_proxies' },
      {
        $set: {
          ...metadata,
          lastUpdated: Date.now(),
          updatedAt: new Date()
        }
      }
    );

    return true;
  } catch (err) {
    console.log(`  ⚠️ Failed to update proxy metadata: ${err.message}`);
    return false;
  }
}

// ====================================
// 🔌 CONNECTION MANAGEMENT
// ====================================

// Graceful shutdown
export async function closeDatabaseConnection() {
  if (client) {
    await client.close();
    isConnected = false;
    console.log('✅ MongoDB connection closed');
  }
}

// Initialize connection on module load
connectToMongo().catch(err => {
  console.log('⚠️ Initial MongoDB connection failed:', err.message);
});
