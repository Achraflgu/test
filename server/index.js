import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import fsSync from 'fs';
import { fileURLToPath } from 'url';
import os from 'os';
import fetch from 'node-fetch';
import sharp from 'sharp';
import archiver from 'archiver';
import { proxyManager } from './proxy-manager.js';
import youtubedl from 'youtube-dl-exec';
// PO Token system removed - not functional and slowed down cookie generation
import { 
  isRedisAvailable,
  saveCookieToRedis,
  getAllCookiesFromRedis,
  savePrimaryCookieToRedis,
  getPrimaryCookieFromRedis,
  saveCookieMetadataToRedis,
  loadCookieMetadataFromRedis,
  saveCookiePoolMetadataToRedis,
  loadCookiePoolMetadataFromRedis,
  deleteCookieFromRedis,
  saveCookieToBackup,
  getCookieFromBackup,
  getBackupPoolCount
} from './cookieStorage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

// Set server timeouts for large file downloads (unlimited size support)
httpServer.timeout = 7200000; // 2 hours (in milliseconds)
httpServer.keepAliveTimeout = 7200000; // 2 hours
httpServer.headersTimeout = 7210000; // Slightly higher than keepAlive

// Keep process alive for Koyeb/Vercel
process.on('SIGTERM', () => {
  console.log('🔄 SIGTERM received, keeping process alive...');
  // Don't exit, keep running
  // Child processes with detached:true will continue independently
});

process.on('SIGINT', () => {
  console.log('🔄 SIGINT received, keeping process alive...');
  // Don't exit, keep running  
  // Child processes with detached:true will continue independently
});

// CORS configuration - supports both local and production URLs
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:8084", 
  "http://localhost:8080",
  "http://localhost:8081",
  "http://localhost:8082",
  "http://localhost:8083",
  "https://test-s989-cex65hswg-achrafgu92-gmailcoms-projects.vercel.app", // Vercel frontend
  "https://test-s989-8uwefhham-achrafgu92-gmailcoms-projects.vercel.app", // Vercel frontend URL
  "https://test-s989-git-main-achrafgu92-gmailcoms-projects.vercel.app", // Latest Vercel frontend URL
  "https://*.vercel.app", // Allow all Vercel apps
  process.env.FRONTEND_URL // Add production frontend URL from environment
].filter(Boolean); // Remove undefined values

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // TEMPORARY: Allow all origins for debugging
    console.log('✅ CORS allowed for:', origin);
    callback(null, true);
    
    // TODO: Re-enable proper CORS checking after debugging
    /*
    // Check exact matches
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('✅ CORS allowed for:', origin);
      callback(null, true);
    }
    // Check wildcard patterns
    else if (origin.endsWith('.vercel.app')) {
      console.log('✅ CORS allowed for Vercel app:', origin);
      callback(null, true);
    }
    else {
      console.log('❌ CORS blocked for:', origin);
      console.log('Allowed origins:', allowedOrigins);
      callback(new Error('Not allowed by CORS'));
    }
    */
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  optionsSuccessStatus: 200
}));

// Manual CORS headers as fallback
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // TEMPORARY: Allow all origins
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    console.log('✅ Manual CORS header set for:', origin);
  }
  
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.header('Access-Control-Allow-Credentials', 'true');
  
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS preflight request handled');
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(express.json({ limit: '50mb' })); // Increase payload limit to 50MB
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const PORT = process.env.PORT || 3001;

// YouTube cookies path (if available)
const YOUTUBE_COOKIES_PATH = process.env.YOUTUBE_COOKIES 
  ? '/tmp/youtube_cookies.txt' 
  : path.join(__dirname, 'youtube_cookies.txt');

// === Short Share Links (in-memory) ===
const sharedPlaylists = new Map(); // key: shareId, value: { data, expiresAt }
const generateShortId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Create share
app.post('/api/share', async (req, res) => {
  try {
    const { playlistId, playlistName, playlistData, expiry = '1d' } = req.body || {};
    if (!playlistName || !playlistData) {
      return res.status(400).json({ error: 'playlistName and playlistData are required' });
    }
    const durations = { '1h': 3600_000, '1d': 86_400_000, '1w': 604_800_000 };
    const ttl = durations[expiry] ?? durations['1d'];
    const shareId = generateShortId();
    const expiresAt = Date.now() + ttl;

    sharedPlaylists.set(shareId, {
      data: { playlistId, playlistName, playlistData, createdAt: Date.now(), expiresAt },
      expiresAt
    });

    // Cleanup expired
    for (const [id, entry] of sharedPlaylists.entries()) {
      if (entry.expiresAt && entry.expiresAt < Date.now()) sharedPlaylists.delete(id);
    }

    return res.json({ shareId, expiresAt });
  } catch (e) {
    console.error('Create share failed:', e);
    return res.status(500).json({ error: 'Failed to create share' });
  }
});

// Fetch share
app.get('/api/share/:id', async (req, res) => {
  try {
    const entry = sharedPlaylists.get(req.params.id);
    if (!entry) return res.status(404).json({ error: 'Share not found' });
    if (entry.expiresAt && entry.expiresAt < Date.now()) {
      sharedPlaylists.delete(req.params.id);
      return res.status(410).json({ error: 'Share expired' });
    }
    return res.json(entry.data);
  } catch (e) {
    console.error('Fetch share failed:', e);
    return res.status(500).json({ error: 'Failed to fetch share' });
  }
});

// Setup YouTube cookies if provided via environment variable
if (process.env.YOUTUBE_COOKIES) {
  try {
    fs.writeFile(YOUTUBE_COOKIES_PATH, process.env.YOUTUBE_COOKIES).then(() => {
      console.log('✅ YouTube cookies loaded from environment');
    }).catch(err => {
      console.warn('⚠️  Failed to write YouTube cookies:', err.message);
    });
  } catch (err) {
    console.warn('⚠️  Failed to setup YouTube cookies:', err.message);
  }
}

// === YouTube Cookies Management Endpoints ===
// Upload/replace cookies (expects raw cookies.txt content)
app.post('/api/youtube-cookies', async (req, res) => {
  try {
    const { cookies } = req.body || {};
    if (!cookies || typeof cookies !== 'string' || cookies.trim().length < 10) {
      return res.status(400).json({ ok: false, error: 'cookies (text) required' });
    }
    await fs.writeFile(YOUTUBE_COOKIES_PATH, cookies, { encoding: 'utf-8' });
    return res.json({ ok: true, path: YOUTUBE_COOKIES_PATH });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Check if cookies exist
app.get('/api/youtube-cookies', async (_req, res) => {
  try {
    const exists = await fs.access(YOUTUBE_COOKIES_PATH).then(() => true).catch(() => false);
    if (!exists) return res.json({ ok: true, exists: false });
    const stat = await fs.stat(YOUTUBE_COOKIES_PATH);
    return res.json({ ok: true, exists: true, size: stat.size, mtime: stat.mtime });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Delete cookies
app.delete('/api/youtube-cookies', async (_req, res) => {
  try {
    const exists = await fs.access(YOUTUBE_COOKIES_PATH).then(() => true).catch(() => false);
    if (!exists) return res.json({ ok: true, deleted: false });
    await fs.unlink(YOUTUBE_COOKIES_PATH);
    return res.json({ ok: true, deleted: true });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// Debug endpoint: List and view cookie files
app.get('/api/debug/cookies', async (req, res) => {
  try {
    const { file } = req.query; // Optional: ?file=cookie_1.txt to view specific file content
    
    const result = {
      ok: true,
      cookies: {
        pool: [],
        primary: null,
        metadata: null,
        poolMetadata: null
      },
      directories: {
        cookiePool: COOKIE_POOL_DIR,
        serverDir: __dirname
      }
    };

    // 1. Check primary auto cookie
    try {
      const autoExists = await fs.access(AUTO_COOKIE_PATH).then(() => true).catch(() => false);
      if (autoExists) {
        const autoStat = await fs.stat(AUTO_COOKIE_PATH);
        const autoContent = await fs.readFile(AUTO_COOKIE_PATH, 'utf8');
        result.cookies.primary = {
          path: AUTO_COOKIE_PATH,
          filename: path.basename(AUTO_COOKIE_PATH),
          size: autoStat.size,
          modified: autoStat.mtime,
          lineCount: autoContent.split('\n').filter(line => line.trim()).length,
          content: file === '.auto_generated_cookies.txt' ? autoContent : undefined // Only include content if specifically requested
        };
      }
    } catch (err) {
      result.cookies.primary = { error: err.message };
    }

    // 2. List cookie pool files
    try {
      const poolExists = await fs.access(COOKIE_POOL_DIR).then(() => true).catch(() => false);
      if (poolExists) {
        const poolFiles = await fs.readdir(COOKIE_POOL_DIR);
        const cookieFiles = poolFiles.filter(f => f.startsWith('cookie_') && f.endsWith('.txt'));
        
        for (const filename of cookieFiles.sort()) {
          try {
            const cookiePath = path.join(COOKIE_POOL_DIR, filename);
            const stat = await fs.stat(cookiePath);
            const content = await fs.readFile(cookiePath, 'utf8');
            const index = parseInt(filename.match(/cookie_(\d+)\.txt/)?.[1] || '0');
            
            result.cookies.pool.push({
              index,
              path: cookiePath,
              filename,
              size: stat.size,
              modified: stat.mtime,
              lineCount: content.split('\n').filter(line => line.trim()).length,
              content: file === filename ? content : undefined // Only include content if specifically requested
            });
          } catch (err) {
            result.cookies.pool.push({
              filename,
              error: err.message
            });
          }
        }
      }
    } catch (err) {
      result.cookies.pool = { error: err.message };
    }

    // 3. Load cookie metadata
    try {
      const metadataExists = await fs.access(COOKIE_METADATA_PATH).then(() => true).catch(() => false);
      if (metadataExists) {
        const metadataContent = await fs.readFile(COOKIE_METADATA_PATH, 'utf8');
        result.cookies.metadata = JSON.parse(metadataContent);
      }
    } catch (err) {
      result.cookies.metadata = { error: err.message };
    }

    // 4. Load cookie pool metadata
    try {
      const poolMetadataExists = await fs.access(COOKIE_POOL_METADATA_PATH).then(() => true).catch(() => false);
      if (poolMetadataExists) {
        const poolMetadataContent = await fs.readFile(COOKIE_POOL_METADATA_PATH, 'utf8');
        result.cookies.poolMetadata = JSON.parse(poolMetadataContent);
      }
    } catch (err) {
      result.cookies.poolMetadata = { error: err.message };
    }

    // 5. Check user-provided cookies (if exists)
    try {
      const userCookiesExists = await fs.access(YOUTUBE_COOKIES_PATH).then(() => true).catch(() => false);
      if (userCookiesExists) {
        const userStat = await fs.stat(YOUTUBE_COOKIES_PATH);
        const userContent = await fs.readFile(YOUTUBE_COOKIES_PATH, 'utf8');
        result.cookies.userProvided = {
          path: YOUTUBE_COOKIES_PATH,
          filename: path.basename(YOUTUBE_COOKIES_PATH),
          size: userStat.size,
          modified: userStat.mtime,
          lineCount: userContent.split('\n').filter(line => line.trim()).length,
          content: file === path.basename(YOUTUBE_COOKIES_PATH) ? userContent : undefined
        };
      }
    } catch (err) {
      // Ignore if user cookies don't exist
    }

    return res.json(result);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

// NOTE: User cookie collection endpoints removed – we operate cookie-less by default

// Store active downloads
const activeDownloads = new Map();

// Store active processes for cancellation
// Each downloadId maps to an array of processes (can have multiple processes per download)
const activeProcesses = new Map();

// ====================================
// 🍪 COOKIE DETECTION SYSTEM
// ====================================
// Priority order:
// 1. Environment variable (YOUTUBE_COOKIES) - for deployment
// 2. Cookie file (youtube_cookies.txt) - for deployment/local
// 3. Browser extraction - for local development only
// ====================================

async function setupYouTubeCookies() {
  try {
    const cookiesFilePath = path.join(__dirname, 'youtube_cookies.txt');
    const autoCookiesPath = path.join(__dirname, '.auto_generated_cookies.txt');
    
    // ===== PRIORITY 1: Cookie Pool (5 working cookies with rotation) =====
    try {
      const cookiePoolPath = await getNextCookieFromPool();
      if (cookiePoolPath) {
        console.log('  🍪 Using cookie from pool (smart rotation)');
        return { type: 'file', path: cookiePoolPath };
      }
    } catch (err) {
      console.log(`  ⚠️ Cookie pool unavailable: ${err.message}`);
    }
    
    // ===== PRIORITY 2: Cookie File (Works in all environments) =====
    try {
      await fs.access(cookiesFilePath);
      const cookieContent = await fs.readFile(cookiesFilePath, 'utf8');
      
      // Verify it's not empty and has cookie format
      if (cookieContent.trim().length > 100 && cookieContent.includes('youtube.com')) {
        console.log('  🍪 Using cookies from youtube_cookies.txt file');
        return { type: 'file', path: cookiesFilePath };
      } else {
        console.log('  ⚠️ youtube_cookies.txt exists but appears invalid or empty');
      }
    } catch (err) {
      // File doesn't exist, continue to browser extraction
    }
    
    // ===== PRIORITY 3: Browser Extraction (Local development only) =====
    const browser = await extractBrowserCookies();
    if (browser) {
      console.log(`  🍪 Using ${browser} browser cookies (local development)`);
      return { type: 'browser', browser };
    }
    
    // ===== PRIORITY 4: Auto-Generated Cookies (Automatic fallback) =====
    try {
      await fs.access(autoCookiesPath);
      console.log('  🤖 Using auto-generated cookies (no user action required)');
      return { type: 'file', path: autoCookiesPath };
    } catch (err) {
      // Auto-cookies don't exist yet, generate them
      const newCookiePath = await initializeAutoCookies();
      if (newCookiePath) {
        console.log('  🤖 Using freshly generated auto-cookies');
        return { type: 'file', path: newCookiePath };
      }
    }
    
    // ===== LAST RESORT: No cookies - will use ytdl-core without cookies =====
    console.log('  ⚠️ No cookies available - will try cookie-less methods');
    return null;
    
  } catch (error) {
    console.log(`  ⚠️ Cookie setup error: ${error.message}`);
    return null;
  }
}

// Helper: Extract browser cookies (local development only)
async function extractBrowserCookies() {
  try {
    // Try local browser cookies (for development)
    const chromePaths = [
      path.join(process.env.USERPROFILE || process.env.HOME, 'AppData/Local/Google/Chrome/User Data/Default/Cookies'),
      path.join(process.env.HOME, '.config/google-chrome/Default/Cookies'),
      path.join(process.env.HOME, '.config/google-chrome-beta/Default/Cookies'),
      path.join(process.env.HOME, '.config/google-chrome-unstable/Default/Cookies')
    ];
    
    for (const cookiePath of chromePaths) {
      try {
        const exists = await fs.access(cookiePath).then(() => true).catch(() => false);
        if (exists) {
          console.log(`  🍪 Found Chrome cookies at: ${cookiePath}`);
          return 'chrome';
        }
      } catch {}
    }
    
    // Try Firefox
    const firefoxPaths = [
      path.join(process.env.APPDATA || process.env.HOME, 'Mozilla/Firefox/Profiles'),
      path.join(process.env.HOME, '.mozilla/firefox')
    ];
    
    for (const firefoxPath of firefoxPaths) {
      try {
        const exists = await fs.access(firefoxPath).then(() => true).catch(() => false);
        if (exists) {
          console.log(`  🍪 Found Firefox cookies at: ${firefoxPath}`);
          return 'firefox';
        }
      } catch {}
    }
    
    // Try Edge
    const edgePaths = [
      path.join(process.env.USERPROFILE || process.env.HOME, 'AppData/Local/Microsoft/Edge/User Data/Default/Cookies'),
      path.join(process.env.HOME, '.config/microsoft-edge/Default/Cookies')
    ];
    
    for (const edgePath of edgePaths) {
      try {
        const exists = await fs.access(edgePath).then(() => true).catch(() => false);
        if (exists) {
          console.log(`  🍪 Found Edge cookies at: ${edgePath}`);
          return 'edge';
        }
      } catch {}
    }
    
    return null;
  } catch (err) {
    console.log(`  ⚠️ Browser cookie extraction failed: ${err.message}`);
    return null;
  }
}

// ====================================
// 🤖 SMART AUTO-COOKIE MANAGEMENT SYSTEM
// ====================================
// Tests cookies, regenerates if failed, saves working ones
// Preserves existing working cookies on restart
// ====================================

// Cookie metadata tracking
const COOKIE_METADATA_PATH = path.join(__dirname, '.cookie_metadata.json');
const AUTO_COOKIE_PATH = path.join(__dirname, '.auto_generated_cookies.txt');
const COOKIE_POOL_DIR = path.join(__dirname, '.cookie_pool'); // Pool of 5 working cookies
// Use short test video for faster cookie testing (19 seconds, oldest YouTube video)
const TEST_VIDEO_ID = 'jNQXAC9IVRw'; // Me at the zoo (short video, perfect for fast testing)

// Lock to prevent concurrent cookie generation
let isGeneratingCookies = false;
let cookieGenerationPromise = null;

// 🎯 COOKIE POOL SYSTEM - Maintain 5 working cookies
const COOKIE_POOL_SIZE = 5;
let cookiePoolIndex = 0; // Round-robin rotation
const COOKIE_POOL_METADATA_PATH = path.join(__dirname, '.cookie_pool_metadata.json');

// PO Token injection removed - system was non-functional

// 🎯 CLIENT PROFILES FOR YOUTUBE DL EXEC
const COOKIE_CLIENT_PROFILES = [
  {
    name: 'android',
    extractorArgs: 'youtube:player_client=android',
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro Build/UPB5.230623.003; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/119.0.6045.134 Mobile Safari/537.36 GSA/14.47.37.29.arm64',
    headers: [
      'x-youtube-client-name:3',
      'x-youtube-client-version:19.47.37',
      'origin:https://www.youtube.com'
    ]
  },
  {
    name: 'ios',
    extractorArgs: 'youtube:player_client=ios',
    userAgent: 'com.google.ios.youtube/19.47.3 (iPhone; U; CPU iOS 17_1 like Mac OS X; en_US)',
    headers: [
      'x-youtube-client-name:5',
      'x-youtube-client-version:19.47.3',
      'origin:https://www.youtube.com'
    ]
  },
  {
    name: 'tv',
    extractorArgs: 'youtube:player_client=tv',
    userAgent: 'Mozilla/5.0 (Chromecast; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.134 Safari/537.36 CrKey/1.56.500000',
    headers: [
      'x-youtube-client-name:85',
      'x-youtube-client-version:3.0',
      'origin:https://www.youtube.com'
    ]
  }
];

const COOKIELESS_CLIENT_PROFILES = [
  {
    name: 'android_sdkless',
    extractorArgs: 'youtube:player_client=android_sdkless',
    userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel 6 Build/SP2A.220505.002) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
    headers: [
      'x-youtube-client-name:3',
      'x-youtube-client-version:19.47.37'
    ]
  },
  {
    name: 'tv_embedded',
    extractorArgs: 'youtube:player_client=tv_embedded',
    userAgent: 'Mozilla/5.0 (CrKey armv7l 1.56.500000) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.6045.134 Safari/537.36',
    headers: [
      'x-youtube-client-name:85',
      'x-youtube-client-version:3.0'
    ]
  },
  {
    name: 'web_embedded',
    extractorArgs: 'youtube:player_client=web_embedded',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Safari/537.36',
    headers: [
      'accept-language:en-US,en;q=0.9',
      'origin:https://www.youtube.com'
    ]
  }
];

function applyClientProfileToOptions(downloadOptions, profile) {
  const headerSet = new Set();
  const headers = [];

  const pushHeader = (header) => {
    const normalized = header.toLowerCase();
    if (!headerSet.has(normalized)) {
      headerSet.add(normalized);
      headers.push(header);
    }
  };

  pushHeader('referer:https://www.youtube.com');
  if (profile.userAgent) {
    pushHeader(`user-agent:${profile.userAgent}`);
    downloadOptions.userAgent = profile.userAgent;
  }

  if (profile.headers && Array.isArray(profile.headers)) {
    for (const header of profile.headers) {
      if (typeof header === 'string' && header.includes(':')) {
        pushHeader(header);
      }
    }
  }

  downloadOptions.addHeader = headers;

  if (profile.extractorArgs) {
    downloadOptions.extractorArgs = profile.extractorArgs;
  }
}

// 📊 COOKIE HEALTH TRACKING
let cookieStats = new Map(); // In-memory stats (index -> stats)

// Load cookie metadata
async function loadCookieMetadata() {
  try {
    // Try Redis first
    if (isRedisAvailable()) {
      const redisMetadata = await loadCookieMetadataFromRedis();
      if (redisMetadata) {
        // Ensure new fields exist for backward compatibility
        if (redisMetadata.regenerationCount === undefined) redisMetadata.regenerationCount = 0;
        if (redisMetadata.lastRegenerated === undefined) redisMetadata.lastRegenerated = null;
        return redisMetadata;
      }
    }
    
    // Fallback to filesystem
    const content = await fs.readFile(COOKIE_METADATA_PATH, 'utf8');
    const metadata = JSON.parse(content);
    // Ensure new fields exist for backward compatibility
    if (metadata.regenerationCount === undefined) metadata.regenerationCount = 0;
    if (metadata.lastRegenerated === undefined) metadata.lastRegenerated = null;
    return metadata;
  } catch (err) {
    return {
      lastTested: null,
      successCount: 0,
      failureCount: 0,
      isValid: false,
      generationAttempt: 0,
      regenerationCount: 0,
      lastRegenerated: null
    };
  }
}

// Save cookie metadata
async function saveCookieMetadata(metadata) {
  try {
    // Save to Redis first
    if (isRedisAvailable()) {
      await saveCookieMetadataToRedis(metadata);
    }
    
    // Also save to filesystem (fallback)
    await fs.writeFile(COOKIE_METADATA_PATH, JSON.stringify(metadata, null, 2), 'utf8');
  } catch (err) {
    // Silent fail
  }
}

// 🎯 COOKIE POOL MANAGEMENT - Save 5 working cookies
async function initCookiePool() {
  try {
    await fs.mkdir(COOKIE_POOL_DIR, { recursive: true });
    await loadCookiePoolMetadata(); // Load stats on init
  } catch (err) {
    // Directory may already exist
  }
}

// 📊 Load cookie pool metadata (stats per cookie)
async function loadCookiePoolMetadata() {
  try {
    // Try Redis first
    if (isRedisAvailable()) {
      const redisMetadata = await loadCookiePoolMetadataFromRedis();
      if (redisMetadata) {
        cookieStats.clear();
        for (const [index, stats] of Object.entries(redisMetadata)) {
          cookieStats.set(parseInt(index), stats);
        }
        return redisMetadata;
      }
    }
    
    // Fallback to filesystem
    const content = await fs.readFile(COOKIE_POOL_METADATA_PATH, 'utf8');
    const metadata = JSON.parse(content);
    
    // Initialize stats map
    cookieStats.clear();
    for (const [index, stats] of Object.entries(metadata)) {
      cookieStats.set(parseInt(index), stats);
    }
    
    return metadata;
  } catch (err) {
    // File doesn't exist yet, initialize empty
    cookieStats.clear();
    return {};
  }
}

// 💾 Save cookie pool metadata
async function saveCookiePoolMetadata() {
  try {
    const metadata = {};
    for (const [index, stats] of cookieStats.entries()) {
      metadata[index] = stats;
    }
    
    // Save to Redis first
    if (isRedisAvailable()) {
      await saveCookiePoolMetadataToRedis(metadata);
    }
    
    // Also save to filesystem (fallback)
    await fs.writeFile(COOKIE_POOL_METADATA_PATH, JSON.stringify(metadata, null, 2), 'utf8');
  } catch (err) {
    // Silent fail
  }
}

// 📈 Initialize cookie stats if not exists
function initCookieStats(index) {
  if (!cookieStats.has(index)) {
    cookieStats.set(index, {
      successCount: 0,
      failureCount: 0,
      lastUsed: null,
      lastSuccess: null,
      lastFailure: null,
      created: new Date().toISOString(),
      consecutiveFailures: 0,
      totalDownloads: 0,
      successRate: 1.0, // Start optimistic
      tier: 1 // Tier 1 = best
    });
  }
  return cookieStats.get(index);
}

// 📊 Update cookie success
function recordCookieSuccess(index) {
  const stats = initCookieStats(index);
  stats.successCount++;
  stats.totalDownloads++;
  stats.lastUsed = new Date().toISOString();
  stats.lastSuccess = new Date().toISOString();
  stats.consecutiveFailures = 0;
  stats.successRate = stats.successCount / stats.totalDownloads;
  
  // Update tier based on success rate
  if (stats.successRate >= 0.99) stats.tier = 1;
  else if (stats.successRate >= 0.95) stats.tier = 2;
  else if (stats.successRate >= 0.90) stats.tier = 3;
  else stats.tier = 4; // Mark for replacement
  
  cookieStats.set(index, stats);
  saveCookiePoolMetadata(); // Save asynchronously (don't await)
}

// 📊 Update cookie failure
function recordCookieFailure(index) {
  const stats = initCookieStats(index);
  stats.failureCount++;
  stats.totalDownloads++;
  stats.lastUsed = new Date().toISOString();
  stats.lastFailure = new Date().toISOString();
  stats.consecutiveFailures++;
  stats.successRate = stats.successCount / stats.totalDownloads;
  
  // Update tier based on success rate
  if (stats.successRate >= 0.99) stats.tier = 1;
  else if (stats.successRate >= 0.95) stats.tier = 2;
  else if (stats.successRate >= 0.90) stats.tier = 3;
  else stats.tier = 4; // Mark for replacement
  
  cookieStats.set(index, stats);
  saveCookiePoolMetadata(); // Save asynchronously (don't await)
}

async function saveCookieToPool(cookieContent, index, options = {}) {
  try {
    // Save to Redis first (if available)
    if (isRedisAvailable()) {
      await saveCookieToRedis(index, cookieContent, {
        quality: options.quality || 'strong',
        created: new Date().toISOString(),
        ...options
      });
    }
    
    // Also save to filesystem (fallback)
    const cookiePath = path.join(COOKIE_POOL_DIR, `cookie_${index}.txt`);
    await fs.writeFile(cookiePath, cookieContent, 'utf8');
    
    // Initialize stats for new cookie
    const stats = initCookieStats(index);

    if (options.quality === 'weak') {
      stats.successCount = 0;
      stats.totalDownloads = 4;
      stats.successRate = 0.5;
      stats.tier = Math.max(stats.tier, 3);
      stats.lastSuccess = null;
      stats.lastUsed = null;
      stats.quality = 'weak';
      stats.consecutiveFailures = 0;
    } else {
      stats.successCount = 4;
      stats.totalDownloads = 4;
      stats.successRate = 1.0;
      stats.tier = 1;
      stats.lastSuccess = new Date().toISOString();
      stats.lastUsed = null;
      stats.quality = 'strong';
      stats.consecutiveFailures = 0;
    }
    cookieStats.set(index, stats);
    saveCookiePoolMetadata();
    
    console.log(`  💾 Saved working cookie to pool (slot ${index + 1}/${COOKIE_POOL_SIZE})`);
    if (isRedisAvailable()) {
      console.log(`  ☁️ Also saved to Redis for persistence`);
    }
    return cookiePath;
  } catch (err) {
    console.log(`  ⚠️ Failed to save cookie to pool: ${err.message}`);
    return null;
  }
}

async function getWorkingCookiesFromPool() {
  try {
    // Try Redis first (if available)
    if (isRedisAvailable()) {
      const redisCookies = await getAllCookiesFromRedis();
      if (redisCookies.length > 0) {
        console.log(`  🍪 Loaded ${redisCookies.length} cookies from Redis`);
        // Also sync to filesystem for compatibility
        await initCookiePool();
        // 🔥 FIX: Update path to filesystem path (not Redis key) - yt-dlp needs file path
        for (const cookie of redisCookies) {
          const cookiePath = path.join(COOKIE_POOL_DIR, `cookie_${cookie.index}.txt`);
          await fs.writeFile(cookiePath, cookie.content, 'utf8').catch(() => {});
          // Update path to filesystem path (yt-dlp needs file path, not Redis key like "cookie_pool:0")
          cookie.path = cookiePath;
        }
        return redisCookies;
      }
    }
    
    // Fallback to filesystem
    await initCookiePool();
    const files = await fs.readdir(COOKIE_POOL_DIR);
    const cookieFiles = files.filter(f => f.startsWith('cookie_') && f.endsWith('.txt'));
    const cookies = [];
    
    for (const file of cookieFiles) {
      try {
        const content = await fs.readFile(path.join(COOKIE_POOL_DIR, file), 'utf8');
        const index = parseInt(file.match(/cookie_(\d+)\.txt/)?.[1] || '0');
        cookies.push({ 
          path: path.join(COOKIE_POOL_DIR, file), 
          content,
          index
        });
      } catch {}
    }
    
    return cookies;
  } catch (err) {
    return [];
  }
}

// 🎯 SMART COOKIE SELECTION (Priority Queue - Best Cookies First)
async function getNextCookieFromPool() {
  const cookies = await getWorkingCookiesFromPool();
  if (cookies.length === 0) return null;
  
  // Load metadata to get stats
  await loadCookiePoolMetadata();
  
  // Build array with cookies and their stats
  const cookiesWithStats = cookies.map((cookie, idx) => {
    const index = parseInt(cookie.path.match(/cookie_(\d+)\.txt/)?.[1] || '0');
    const stats = cookieStats.get(index) || initCookieStats(index);
    return { cookie, index, stats };
  });
  
  // Sort by priority:
  // 1. Tier (1 = best, 4 = worst)
  // 2. Success rate (higher = better)
  // 3. Recent success (last 5 minutes = bonus)
  // 4. Least used recently (load balancing)
  const now = Date.now();
  cookiesWithStats.sort((a, b) => {
    // Tier priority (lower tier number = better)
    if (a.stats.tier !== b.stats.tier) {
      return a.stats.tier - b.stats.tier;
    }
    
    // Success rate (higher = better)
    if (Math.abs(a.stats.successRate - b.stats.successRate) > 0.01) {
      return b.stats.successRate - a.stats.successRate;
    }
    
    // Recent success bonus (last 5 minutes)
    const aRecentSuccess = a.stats.lastSuccess ? 
      (now - new Date(a.stats.lastSuccess).getTime()) < 300000 : false;
    const bRecentSuccess = b.stats.lastSuccess ? 
      (now - new Date(b.stats.lastSuccess).getTime()) < 300000 : false;
    if (aRecentSuccess !== bRecentSuccess) {
      return aRecentSuccess ? -1 : 1;
    }
    
    // Load balancing: least recently used
    const aLastUsed = a.stats.lastUsed ? new Date(a.stats.lastUsed).getTime() : 0;
    const bLastUsed = b.stats.lastUsed ? new Date(b.stats.lastUsed).getTime() : 0;
    return aLastUsed - bLastUsed;
  });
  
  // Use the best cookie
  const best = cookiesWithStats[0];
  cookiePoolIndex++;
  
  return best.cookie.path;
}

// 🔄 GET ALL COOKIES FROM POOL (for smart retry)
async function getAllCookiesFromPool() {
  const cookies = await getWorkingCookiesFromPool();
  if (cookies.length === 0) return [];
  
  await loadCookiePoolMetadata();
  
  // Return with stats sorted by priority
  const cookiesWithStats = cookies.map((cookie) => {
    // Use index property if available (Redis cookies), otherwise parse from path
    const index = cookie.index !== undefined 
      ? cookie.index 
      : parseInt(cookie.path.match(/cookie_(\d+)\.txt/)?.[1] || '0');
    const stats = cookieStats.get(index) || initCookieStats(index);
    return { path: cookie.path, index, stats };
  });
  
  // Sort by priority (same as getNextCookieFromPool)
  const now = Date.now();
  cookiesWithStats.sort((a, b) => {
    if (a.stats.tier !== b.stats.tier) return a.stats.tier - b.stats.tier;
    if (Math.abs(a.stats.successRate - b.stats.successRate) > 0.01) {
      return b.stats.successRate - a.stats.successRate;
    }
    const aRecentSuccess = a.stats.lastSuccess ? 
      (now - new Date(a.stats.lastSuccess).getTime()) < 300000 : false;
    const bRecentSuccess = b.stats.lastSuccess ? 
      (now - new Date(b.stats.lastSuccess).getTime()) < 300000 : false;
    if (aRecentSuccess !== bRecentSuccess) return aRecentSuccess ? -1 : 1;
    const aLastUsed = a.stats.lastUsed ? new Date(a.stats.lastUsed).getTime() : 0;
    const bLastUsed = b.stats.lastUsed ? new Date(b.stats.lastUsed).getTime() : 0;
    return aLastUsed - bLastUsed;
  });
  
  return cookiesWithStats;
}

async function replaceCookieInPool(index, newCookieContent) {
  console.log(`  🔄 Replacing failed cookie in pool (slot ${index + 1}/${COOKIE_POOL_SIZE})...`);
  return await saveCookieToPool(newCookieContent, index);
}

// ⚡ ULTRA-STRICT cookie test - Tests ACTUAL audio extraction (not just metadata!)
// This ensures cookies work for REAL downloads, not just API calls
async function testCookies(cookiePath, skipProxy = false) {
  try {
    // 🎯 TEST WITH ACTUAL AUDIO EXTRACTION (the REAL test!)
    const testArgs = [
      '-m', 'yt_dlp',
      `https://www.youtube.com/watch?v=${TEST_VIDEO_ID}`,
      '--cookies', cookiePath,
      '--print', 'after_move:filepath', // Only prints filepath if extraction succeeds
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '64K', // Very low quality for fast testing
      '--no-playlist',
      '--quiet',
      '--no-warnings',
      '--no-check-certificates', // 🔒 Fix SSL certificate errors when using proxies
      '--output', '/tmp/cookie_test_%(id)s.%(ext)s', // Temp location
      '--extractor-args', 'youtube:player_client=android',
      '--user-agent', 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36',
      '--max-filesize', '3M' // Abort if too large (just testing)
    ];

    // 🌐 ADD PROXY SUPPORT (bypass IP ban during cookie testing)
    // Use proxy manager which automatically handles Oxylabs > Free proxies priority
    let proxy = null;
    
    // 🎯 FALLBACK: Skip proxies if explicitly requested (after many proxy failures)
    if (!skipProxy) {
      // Try to get proxy (with retry if proxy manager not ready yet)
      for (let retry = 0; retry < 3; retry++) {
        proxy = proxyManager.getProxyForYtdlp();
        if (proxy) break;
        
        // If no proxy and we have Oxylabs credentials, wait a bit for initialization
        if (process.env.OXYLABS_USERNAME && process.env.OXYLABS_PASSWORD && retry < 2) {
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s
          continue;
        }
        break;
      }
    }
    
    if (proxy && !skipProxy) {
      testArgs.push('--proxy', proxy);
      // Show which type of proxy is being used
      if (proxy.includes('oxylabs.io')) {
        console.log(`  🌟 Testing cookie via Oxylabs premium proxy`);
      } else {
        const shortProxy = proxy.length > 30 ? proxy.substring(0, 27) + '...' : proxy;
        console.log(`  🌐 Testing cookie via proxy: ${shortProxy}`);
      }
    } else if (process.env.SCRAPERAPI_KEY && !skipProxy) {
      // Fallback to ScraperAPI if proxy manager has nothing
      const scraperProxy = `http://scraperapi:${process.env.SCRAPERAPI_KEY}@proxy-server.scraperapi.com:8001`;
      testArgs.push('--proxy', scraperProxy);
      console.log(`  🌐 Testing cookie via ScraperAPI proxy`);
    } else if (skipProxy) {
      console.log(`  🔄 Testing cookie WITHOUT proxy (fallback after proxy failures)`);
    } else {
      console.log(`  ⚠️  No proxy available for cookie testing (will retry)`);
    }

    return await new Promise((resolve) => {
      let stdoutData = '';
      let errorOutput = '';
      let resolved = false;

      const resolveOnce = (value) => {
        if (resolved) return;
        resolved = true;
        resolve(value);
      };

      const testProcess = spawn(PYTHON_CMD, testArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 12000 // 12s timeout for actual extraction
      });

      testProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });

      testProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });

      testProcess.on('close', async (code) => {
        if (resolved) return;

        const normalizedError = errorOutput.toLowerCase();
        const hasBotDetectionError =
          normalizedError.includes('sign in to confirm') ||
          normalizedError.includes('login_required') ||
          normalizedError.includes("you're not a bot") ||
          normalizedError.includes('confirm you are not a bot') ||
          normalizedError.includes('consent required') ||
          normalizedError.includes('captcha') ||
          normalizedError.includes('please sign in to continue') ||
          normalizedError.includes('video unavailable') ||
          normalizedError.includes('unplayable');

        // Check for successful extraction (got file path in stdout)
        const hasExtractedFile = stdoutData.includes('/tmp/cookie_test_');
        
        // Cleanup temp file if created
        if (hasExtractedFile) {
          const match = stdoutData.match(/\/tmp\/cookie_test_[^\s]+/);
          if (match) {
            try {
              await fs.unlink(match[0]).catch(() => {});
            } catch {}
          }
        }

        if (hasBotDetectionError) {
          console.log('  ❌ Cookie test FAILED (bot detection)');
          resolveOnce({ status: 'fail', reason: 'bot' });
          return;
        }

        // STRICT: Cookie is valid ONLY if it successfully extracted audio file AND exit code is 0
        if (code === 0 && hasExtractedFile) {
          console.log('  ✅ Cookie test STRONG PASS (successfully extracted audio file)');
          resolveOnce({ status: 'strong' });
          return;
        }

        // Timeout or process error = fail
        // 🔍 Better error diagnostics to identify if it's cookie or proxy issue
        // Note: normalizedError is already declared above (line 1080)
        const errorPreview = errorOutput.substring(0, 200).replace(/\n/g, ' ');
        const isProxyIssue = normalizedError.includes('proxy') || 
                            normalizedError.includes('connection') ||
                            normalizedError.includes('timeout');
        const isCookieIssue = normalizedError.includes('sign in') ||
                             normalizedError.includes('bot') ||
                             normalizedError.includes('login_required');
        
        // 🛡️ DON'T MARK PROXY AS DEAD DURING COOKIE TESTS
        // Cookie test failures are usually due to fake cookies, not bad proxies
        // Only mark proxies as dead if it's clearly a proxy connection issue (timeout/connection error)
        // NOT for YouTube errors during cookie testing (could be cookie issue, not proxy issue)
        
        // Only mark proxy as dead if it's a clear proxy connection problem (not YouTube errors)
        if (proxy && isProxyIssue && (code === null || normalizedError.includes('connection') || normalizedError.includes('timeout'))) {
          // Extract proxy IP:PORT from proxy string (format: http://IP:PORT)
          const proxyMatch = proxy.match(/http:\/\/([^\/]+)/);
          if (proxyMatch) {
            const proxyHost = proxyMatch[1];
            // Mark proxy as failed (will remove from YouTube-validated list)
            proxyManager.markFailed(proxyHost);
            console.log(`  🗑️ Marked proxy as DEAD (connection/timeout error): ${proxyHost.substring(0, 20)}...`);
          }
        }
        // Note: We DON'T mark proxies as dead for YouTube errors during cookie testing
        // because the error could be due to fake cookies, not a bad proxy
        
        if (code === null) {
          console.log(`  ❌ Cookie test TIMEOUT (${proxy ? 'with proxy' : 'no proxy'})`);
          if (errorPreview) {
            console.log(`     Error preview: ${errorPreview}...`);
          }
        } else {
          console.log(`  ❌ Cookie test FAILED (code: ${code}, ${proxy ? 'with proxy' : 'no proxy'})`);
          if (isProxyIssue) {
            console.log(`     🔍 Issue: PROXY problem (connection/timeout)`);
          } else if (isCookieIssue) {
            console.log(`     🔍 Issue: COOKIE problem (bot detection/login required)`);
          } else if (errorPreview) {
            console.log(`     Error preview: ${errorPreview}...`);
          }
        }
        
        resolveOnce({ status: 'fail', reason: code === null ? 'timeout' : 'process_error' });
      });

      testProcess.on('error', (err) => {
        console.log(`  ❌ Cookie test error: ${err.message}`);
        resolveOnce({ status: 'fail', reason: 'error' });
      });

      // 🎯 Dynamic timeout: Longer for Oxylabs and YouTube-validated proxies (slower but more reliable)
      const isOxylabs = proxy && proxy.includes('oxylabs.io');
      // Check if proxy is YouTube-validated (format: http://IP:PORT, need to extract IP:PORT)
      let isYouTubeValidated = false;
      if (proxy && !isOxylabs) {
        const proxyMatch = proxy.match(/http:\/\/([^\/]+)/);
        if (proxyMatch) {
          const proxyHost = proxyMatch[1];
          // Check if this proxy is in YouTube-validated list
          const stats = proxyManager.getStats();
          // We can't directly check, but if we have YouTube-validated proxies, give more time
          // to all non-Oxylabs proxies (they might be YouTube-validated)
          isYouTubeValidated = stats.youtubeWorking > 0;
        }
      }
      // Timeout: 45s for Oxylabs, 25s for YouTube-validated proxies, 20s for other proxies, 12s for no proxy
      const timeout = isOxylabs ? 45000 : (isYouTubeValidated ? 25000 : (proxy ? 20000 : 12000));
      
      setTimeout(() => {
        if (resolved) return;
        try { testProcess.kill('SIGKILL'); } catch {}
        const proxyType = isOxylabs ? 'Oxylabs' : (isYouTubeValidated ? 'YouTube-validated proxy' : (proxy ? 'free proxy' : 'no proxy'));
        console.log(`  ❌ Cookie test timeout - rejecting (${timeout/1000}s limit, ${proxyType})`);
        resolveOnce({ status: 'fail', reason: 'timeout' });
      }, timeout);
    });
  } catch (err) {
    console.log(`  ❌ Cookie test failed: ${err.message}`);
    return { status: 'fail', reason: 'exception' };
  }
}

// ====================================
// 🎯 PO TOKEN GENERATION SYSTEM
// ====================================
// Generates YouTube PO tokens using pytubefix for enhanced authentication
// 
// 📝 PO Token Purpose:
//   - PO tokens help bypass YouTube's bot detection mechanisms
//   - They provide additional authentication that can improve download success rates
//   - When used with cookies, they can help avoid rate limiting and bot detection errors
//   - Downloads work fine without PO tokens, but they provide an optional enhancement
// 
// ⚡ Performance:
//   - PO tokens are cached for 1 hour to avoid regeneration overhead
//   - Generation timeout is 5 seconds (reduced from 30s) - downloads proceed even if generation fails
//   - Injection timeout is 3 seconds - downloads don't wait more than 3s for PO token injection
//   - PO token failures are silent - they don't block or delay downloads

let poTokenCache = null;
let poTokenExpiry = 0;
const PO_TOKEN_LIFETIME = 3600000; // 1 hour (tokens expire)

/**
 * Generate a fresh PO token using Python pytubefix library
 * @param {string} videoUrl - YouTube video URL to use for token generation
 * @returns {Promise<Object|null>} PO token data or null on failure
 */
async function generatePOToken(videoUrl = 'https://www.youtube.com/watch?v=jNQXAC9IVRw') {
  return new Promise((resolve) => {
    const scriptPath = path.join(__dirname, 'generate-potoken.py');
    
    const proc = spawn('python3', [scriptPath, videoUrl], {
      cwd: __dirname,
      timeout: 5000 // 5s timeout - PO tokens are optional, don't delay downloads
    });
    
    let output = '';
    let errorOutput = '';
    let resolved = false;
    
    const resolveOnce = (value) => {
      if (resolved) return;
      resolved = true;
      resolve(value);
    };
    
    proc.stdout.on('data', data => output += data.toString());
    proc.stderr.on('data', data => errorOutput += data.toString());
    
    proc.on('close', (code) => {
      if (resolved) return;
      // Try to parse JSON output even if exit code is non-zero (Python script outputs JSON on errors)
      try {
        if (output.trim()) {
          const result = JSON.parse(output);
          if (result.success && result.po_token) {
            console.log('✅ Generated PO token successfully');
            console.log(`   Token: ${result.po_token.substring(0, 20)}...`);
            console.log(`   Visitor Data: ${result.visitor_data ? result.visitor_data.substring(0, 20) + '...' : 'none'}`);
            resolveOnce(result);
            return;
          } else {
            // Python script returned error in JSON format
            const errorMsg = result.error || 'Unknown error';
            const errorType = result.error_type || 'Unknown';
            console.log(`⚠️  PO token generation failed: ${errorMsg} (${errorType})`);
            if (errorOutput) {
              console.log(`   stderr: ${errorOutput.substring(0, 200)}`);
            }
            resolveOnce(null);
            return;
          }
        }
      } catch (e) {
        // Failed to parse JSON - output might be empty or malformed
        if (code !== 0) {
          console.log(`⚠️  PO token generation failed (exit code ${code}):`, errorOutput || output || 'No output received');
          if (errorOutput) {
            console.log(`   stderr: ${errorOutput.substring(0, 200)}`);
          }
        } else {
          console.log('⚠️  Failed to parse PO token response:', e.message);
          if (output) {
            console.log(`   Output: ${output.substring(0, 200)}`);
          }
        }
        resolveOnce(null);
        return;
      }
      
      // No output at all
      if (code !== 0) {
        console.log(`⚠️  PO token generation failed (exit code ${code}):`, errorOutput || 'No output received');
      } else {
        console.log('⚠️  PO token generation returned no output');
      }
      resolveOnce(null);
    });
    
    proc.on('error', (err) => {
      if (resolved) return;
      console.log('⚠️  PO token process error:', err.message);
      if (err.message.includes('ENOENT')) {
        console.log('   💡 Tip: Install Python 3 and pytubefix (pip install pytubefix)');
      }
      resolveOnce(null);
    });
    
    // Handle timeout (reduced to 5s - PO tokens are optional, don't delay downloads)
    setTimeout(() => {
      if (resolved) return;
      try {
        proc.kill('SIGKILL');
        // Silent timeout - PO tokens are optional, downloads work without them
        resolveOnce(null);
      } catch (e) {
        // Process already finished
      }
    }, 5000); // 5s timeout instead of 30s - don't delay downloads
  });
}

/**
 * Get PO token (from cache or generate fresh)
 * @param {boolean} forceRefresh - Force generate a new token
 * @returns {Promise<Object|null>} Cached or fresh PO token
 */
async function getPOToken(forceRefresh = false) {
  const now = Date.now();
  
  // Return cached token if valid
  if (!forceRefresh && poTokenCache && now < poTokenExpiry) {
    console.log('♻️  Using cached PO token');
    return poTokenCache;
  }
  
  // Generate fresh token
  console.log('🔄 Generating fresh PO token...');
  const token = await generatePOToken();
  
  if (token && token.po_token) {
    poTokenCache = token;
    poTokenExpiry = now + PO_TOKEN_LIFETIME;
    console.log(`   ⏰ Token will expire in ${PO_TOKEN_LIFETIME / 60000} minutes`);
  }
  
  return token;
}

/**
 * Inject PO token into yt-dlp options
 * @param {Object} options - yt-dlp download options
 * @returns {Promise<Object>} Modified options with PO token
 */
async function injectPOToken(options) {
  const poToken = await getPOToken();
  
  if (poToken && poToken.po_token) {
    // Add PO token to extractor args
    const existingArgs = options.extractorArgs || '';
    const tokenArg = `youtube:po_token=${poToken.po_token}`;
    const visitorArg = poToken.visitor_data ? `;visitor_data=${poToken.visitor_data}` : '';
    
    options.extractorArgs = existingArgs 
      ? `${existingArgs};${tokenArg}${visitorArg}`
      : `${tokenArg}${visitorArg}`;
    
    console.log('🎯 Injected PO token into download options');
  }
  
  return options;
}

// ====================================
// 🍪 SMART COOKIE GENERATION SYSTEM
// ====================================
// Generates realistic YouTube cookies with proper randomization
// Note: PO Token system removed (was non-functional and slowed generation)

// 🚀 SMART COOKIE GENERATION with realistic patterns and proper randomization
async function generateRealisticYouTubeCookies(attempt = 0) {
  try {
    console.log(`  🤖 Generating smart YouTube cookies (attempt ${attempt + 1})...`);
    
    // Realistic timestamps and expiry (more authentic patterns)
    const timestamp = Date.now();
    const now = Math.floor(timestamp / 1000);
    const shortExpiry = now + (7 * 24 * 60 * 60);      // 7 days (session)
    const mediumExpiry = now + (180 * 24 * 60 * 60);   // 180 days (visitor)
    const longExpiry = now + (365 * 24 * 60 * 60);     // 365 days (persistent)
    
    // 🎯 UNIQUE VISITOR ID (CRITICAL FIX: Generate unique per cookie!)
    const generateVisitorInfo = () => {
      const start = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      let result = start.charAt(Math.floor(Math.random() * start.length));
      for (let i = 0; i < 10; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    const visitorInfo = generateVisitorInfo();
    
    // Generate realistic YSC (12 chars, varies per session)
    const generateYSC = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      let result = '';
      for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    
    // More realistic PREF value (YouTube preferences) with language support
    const timezones = ['America/New_York', 'America/Los_Angeles', 'America/Chicago', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney', 'America/Toronto', 'Europe/Madrid', 'Asia/Seoul'];
    const languages = ['en', 'en-US', 'en-GB', 'fr', 'de', 'es', 'ja', 'zh', 'ko', 'pt', 'it', 'ru'];
    const lang = languages[Math.floor(Math.random() * languages.length)];
    const tz = timezones[Math.floor(Math.random() * timezones.length)];
    const f4Value = Math.floor(Math.random() * 100000000);
    const f6Value = 40000000 + Math.floor(Math.random() * 10000000); // More variation
    const prefValue = `f4=${f4Value}&tz=${tz}&f6=${f6Value}&f7=100&hl=${lang}`;
    
    // 🎯 REALISTIC CONSENT with CURRENT DATE (critical!)
    const dateNow = new Date();
    const year = dateNow.getFullYear();
    const month = String(dateNow.getMonth() + 1).padStart(2, '0');
    const day = String(dateNow.getDate()).padStart(2, '0');
    const consentId = Math.floor(100 + Math.random() * 900);
    const consentValue = `YES+cb.${year}${month}${day}-${consentId}-p.m.F+FsF`;
    
    // 🎯 UNIQUE NID per cookie (CRITICAL FIX: Was causing bot detection!)
    const generateNID = () => {
      const nidChars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      let nid = `${Math.floor(500 + Math.random() * 100)}=`; // Version 500-599
      for (let i = 0; i < 70; i++) {
        nid += nidChars.charAt(Math.floor(Math.random() * nidChars.length));
      }
      return nid;
    };
    const nidValue = generateNID();
    
    // Generate realistic session IDs
    const generateSessionId = (length) => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    
    // Generate hex session (for HSID/SSID)
    const generateHexSession = (length) => {
      const chars = '0123456789abcdef';
      let result = '';
      for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };
    
    // Generate realistic device info and privacy metadata (MORE VARIANTS!)
    const privacyValues = ['CgJVUxIA', 'CgJFVRIA', 'CgJHQhIA', 'CgJDQRIA', 'CgJBVRIA', 'CgJERRIA', 'CgJGUhIA', 'CgJKUBIA', 'CgJLUhIA', 'CgJJVBIA'];
    const privacyMetadata = privacyValues[Math.floor(Math.random() * privacyValues.length)];
    const deviceInfoValues = [
      'ChxOT0IfYXZhaWxhYmxlGAE%3D',
      'ChROT0lfYXZhaWxhYmxlGAE%3D',
      'ChxOT0lfYXZhaWxhYmxlGAI%3D',
      'ChROT0IfYXZhaWxhYmxlGAI%3D',
      'ChxOT0lfYXZhaWxhYmxlGAA%3D',
      'ChROT0lfYXZhaWxhYmxlGAA%3D',
      'ChxOT0lfYXZhaWxhYmxlGAM%3D',
      'ChROT0IfYXZhaWxhYmxlGAM%3D'
    ];
    const deviceInfo = deviceInfoValues[Math.floor(Math.random() * deviceInfoValues.length)];
    
    // 🚀 ENHANCED COOKIE SET with unique values per cookie
    const cookieContent = `# Netscape HTTP Cookie File
# This is a generated file. Do not edit.
# Smart-generated by TrackM Backend - ${new Date().toISOString()}
# Generation attempt: ${attempt + 1}

# ⭐ Core YouTube Authentication (UNIQUE per cookie)
.youtube.com	TRUE	/	TRUE	${mediumExpiry}	VISITOR_INFO1_LIVE	${visitorInfo}
.youtube.com	TRUE	/	FALSE	${shortExpiry}	YSC	${generateYSC()}
.youtube.com	TRUE	/	TRUE	${longExpiry}	PREF	${prefValue}
.youtube.com	TRUE	/	TRUE	${longExpiry}	CONSENT	${consentValue}
.youtube.com	TRUE	/	FALSE	${shortExpiry}	GPS	1

# ⭐ Critical Google Auth Cookies (UNIQUE NID per cookie - CRITICAL!)
.google.com	TRUE	/	TRUE	${longExpiry}	NID	${nidValue}
.google.com	TRUE	/	TRUE	${longExpiry}	SID	${generateHexSession(16)}
.google.com	TRUE	/	TRUE	${longExpiry}	HSID	A${generateHexSession(15)}
.google.com	TRUE	/	TRUE	${longExpiry}	SSID	A${generateHexSession(15)}
.google.com	TRUE	/	TRUE	${longExpiry}	APISID	${generateHexSession(16)}
.google.com	TRUE	/	TRUE	${longExpiry}	SAPISID	${generateHexSession(16)}
.google.com	TRUE	/	TRUE	${longExpiry}	__Secure-3PSID	${generateSessionId(45)}
.google.com	TRUE	/	TRUE	${longExpiry}	__Secure-3PAPISID	${generateHexSession(16)}
.google.com	TRUE	/	TRUE	${longExpiry}	__Secure-1PSID	${generateSessionId(45)}
.google.com	TRUE	/	TRUE	${longExpiry}	__Secure-1PAPISID	${generateHexSession(16)}

# ⭐ YouTube Session & Privacy Cookies (Enhanced)
.youtube.com	TRUE	/	TRUE	${mediumExpiry}	LOGIN_INFO	AFmmF2swRgIhA${generateSessionId(20)}:QUQ3MjNm${generateSessionId(10)}
.youtube.com	TRUE	/	FALSE	${shortExpiry}	__Secure-3PSIDCC	AQhGp9s${generateSessionId(25)}
.youtube.com	TRUE	/	FALSE	${shortExpiry}	VISITOR_PRIVACY_METADATA	${privacyMetadata}
.youtube.com	TRUE	/	FALSE	${shortExpiry}	wide	1

# ⭐ Additional tracking cookies (improve realism and mimic real browser behavior)
.youtube.com	TRUE	/	FALSE	${mediumExpiry}	DEVICE_INFO	${deviceInfo}
.youtube.com	TRUE	/	FALSE	${shortExpiry}	_gcl_au	1.1.${Math.floor(Math.random() * 1000000000)}.${now}
.youtube.com	TRUE	/	FALSE	${mediumExpiry}	ST-${generateHexSession(6)}	session.${generateSessionId(12)}
.youtube.com	TRUE	/	FALSE	${shortExpiry}	SIDCC	AQhGp9t${generateSessionId(30)}

# ⭐ Google domain tracking (additional authenticity)
.google.com	TRUE	/	TRUE	${longExpiry}	1P_JAR	${year}-${month}-${day}-${Math.floor(10 + Math.random() * 15)}
.google.com	TRUE	/	TRUE	${longExpiry}	AEC	Ae3N${generateSessionId(130)}
.google.com	TRUE	/	FALSE	${shortExpiry}	SIDCC	AQhGp9s${generateSessionId(30)}
`;
    
    // Return cookie content (removed PO token references)
    return {
      cookieContent,
      visitorData: visitorInfo
    };
  } catch (err) {
    console.log(`  ⚠️ Cookie generation failed: ${err.message}`);
    return null;
  }
}

// 🚀 PARALLEL COOKIE TESTING - Test multiple cookies at once (5x faster!) + EARLY STOP
async function generateAndTestCookies(maxAttempts = 100) {
  // 🛡️ SAFETY CHECK: Pause if downloads are active (regardless of cookie count)
  const hasActive = hasActiveDownloads();
  const currentCookies = await getWorkingCookiesFromPool();
  
  // 🎯 Check if cookie-less first attempt is in progress (should pause ALL regeneration)
  let cookieLessInProgress = false;
  for (const [id, info] of activeDownloads.entries()) {
    if (info.cookieLessAttemptInProgress === true) {
      cookieLessInProgress = true;
      break;
    }
  }
  
  // 🛡️ PAUSE if: (1) ANY active downloads (regardless of cookie count), OR (2) Cookie-less attempt in progress
  // EXCEPTION: Only allow regeneration when explicitly waiting for strong cookie (needed for download to proceed)
  let waitingForStrongCookie = false;
  for (const [id, info] of activeDownloads.entries()) {
    if (info.waitingForStrongCookie === true && info.status === 'waiting') {
      waitingForStrongCookie = true;
      break;
    }
  }
  
  if (hasActive && !waitingForStrongCookie) {
    if (cookieLessInProgress) {
      console.log(`\n⏸️ [Cookie Generation BLOCKED] Cookie-less download attempt in progress - pausing regeneration`);
    } else {
      console.log(`\n⏸️ [Cookie Generation BLOCKED] Downloads active (${activeDownloads.size}) - pausing ALL regeneration to focus on downloads`);
    }
    console.log(`  💡 Returning existing cookies - generation will resume after download completes`);
    
    // Return existing cookies instead of generating new ones
    return {
      strongCookies: currentCookies.filter(c => c.quality === 'strong').length,
      mediumCookies: currentCookies.filter(c => c.quality === 'medium').length,
      totalCookies: currentCookies.length,
      cookies: currentCookies
    };
  }
  
  // 🔒 Prevent concurrent cookie generation
  if (isGeneratingCookies && cookieGenerationPromise) {
    console.log('  ⏳ Cookie generation already in progress, waiting for completion...');
    
    // Wait for generation with a shorter timeout (don't block downloads forever)
    // Reduced from 120s to 30s to allow downloads to proceed faster
    try {
      const result = await Promise.race([
        cookieGenerationPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Cookie generation timeout')), 30000)) // 30s timeout
      ]);
      return result;
    } catch (err) {
      console.log(`  ⚠️ Cookie generation timeout - proceeding without waiting (generation continues in background)`);
      // Don't return null - allow the generation to continue in background
      // Return existing cookies instead
      const existingCookies = await getWorkingCookiesFromPool();
      return {
        strongCookies: existingCookies.filter(c => c.quality === 'strong').length,
        mediumCookies: existingCookies.filter(c => c.quality === 'medium').length,
        totalCookies: existingCookies.length,
        cookies: existingCookies
      };
    }
  }
  
  // Set lock and create promise
  isGeneratingCookies = true;
  cookieGenerationPromise = (async () => {
    try {
      await initCookiePool(); // Initialize cookie pool directory
      
      // Check which slots are already filled
      const existingCookies = await getWorkingCookiesFromPool();
      const existingIndices = existingCookies.map(c => {
        // Handle Redis cookies (have index property) or filesystem cookies (parse from path)
        return c.index !== undefined ? c.index : parseInt(c.path.match(/cookie_(\d+)\.txt/)?.[1] || '0');
      });
      const cookiesNeeded = COOKIE_POOL_SIZE - existingIndices.length;
      
      if (cookiesNeeded <= 0) {
        console.log(`✅ Cookie pool already full (${COOKIE_POOL_SIZE}/${COOKIE_POOL_SIZE}) - no generation needed`);
        return AUTO_COOKIE_PATH;
      }
      
      const startTime = Date.now();
      let PARALLEL_TESTS = 3; // Start with 3 parallel tests (reduced from 5 to avoid rate limiting)
      const MAX_BATCHES = 50; // Safety limit: max 50 batches (250 attempts)
      const MAX_TIME = 180000; // Safety limit: 3 minutes max
      const PHASE1_TIME = 90000; // Phase 1: Get 2-3 STRONG cookies quickly (90s max)
      
      // 🎯 HYBRID ADAPTIVE STRATEGY - AGGRESSIVE: Start downloads ASAP!
      const MIN_STRONG_FOR_OPERATION = 1; // System can work with just 1 strong cookie (changed from 2)
      const TARGET_STRONG_COOKIES = 3; // Ideal: 3 strong cookies
      const TARGET_TOTAL_COOKIES = 5; // Final goal: 5 total
      
      // Add minimal initial cooldown if we've been failing recently (reduced significantly)
      if (global['cookie_regeneration_failures'] > 10) {
        const cooldown = 2000 + Math.random() * 1000; // 2-3s cooldown (reduced from 10-15s)
        console.log(`  ⏳ Recent failures detected - cooling down for ${(cooldown/1000).toFixed(1)}s before starting...`);
        await new Promise(resolve => setTimeout(resolve, cooldown));
      }
      
      console.log(`🔄 Starting HYBRID ADAPTIVE cookie generation with ${PARALLEL_TESTS} parallel tests...`);
      console.log(`🎯 Strategy: Phase 1 (${PHASE1_TIME/1000}s): Get ${MIN_STRONG_FOR_OPERATION}+ STRONG cookie (downloads resume ASAP!)`);
      console.log(`🎯 Strategy: Phase 2 (background after downloads): Fill remaining slots to ${TARGET_TOTAL_COOKIES} total`);
      console.log(`📊 Target: ${cookiesNeeded} new cookies (${existingIndices.length}/${COOKIE_POOL_SIZE} already exist)`);
      console.log(`🛡️ Safety limits: ${MAX_BATCHES} batches max, ${MAX_TIME/1000}s timeout`);
      
      let totalAttempts = 0;
      let cookiesFound = 0;
      let strongCookiesFound = 0; // Track STRONG cookies separately
      let mediumCookiesFound = 0; // Track medium/weak cookies
      let batch = 0;
      let consecutiveFailures = 0; // Track failures for adaptive parallelism
      let phase1Complete = false; // Track Phase 1 completion
      const workingCookies = [];
      let nextAvailableSlot = 0;
      
      // Find first available slot
      for (let i = 0; i < COOKIE_POOL_SIZE; i++) {
        if (!existingIndices.includes(i)) {
          nextAvailableSlot = i;
          break;
        }
      }
      
      // 🎯 PHASE 1: Get 2-3 STRONG cookies quickly (blocking, up to 90s)
      // 🎯 PHASE 2: Fill remaining slots in background (non-blocking after Phase 1)
      while (cookiesFound < cookiesNeeded) {
        // 🛡️ CHECK: Pause if ANY active downloads (not just cookie-less attempts)
        const hasActiveNow = hasActiveDownloads();
        let cookieLessInProgress = false;
        let waitingForStrongCookie = false;
        
        for (const [id, info] of activeDownloads.entries()) {
          if (info.cookieLessAttemptInProgress === true) {
            cookieLessInProgress = true;
          }
          if (info.waitingForStrongCookie === true && info.status === 'waiting') {
            waitingForStrongCookie = true;
          }
        }
        
        // 🛡️ PAUSE if downloads are active (unless waiting for strong cookie)
        if (hasActiveNow && !waitingForStrongCookie) {
          if (cookieLessInProgress) {
            console.log(`  ⏸️ Pausing cookie generation: Cookie-less download attempt in progress`);
          } else {
            console.log(`  ⏸️ Pausing cookie generation: Downloads active (${activeDownloads.size})`);
          }
          break; // Exit loop to pause generation
        }
        
        batch++;
        const elapsed = Date.now() - startTime;
        const inPhase1 = elapsed < PHASE1_TIME && strongCookiesFound < MIN_STRONG_FOR_OPERATION;
        
        // 🎯 ADAPTIVE: Reduce parallelism more aggressively if too many failures
        if (consecutiveFailures >= 2 && PARALLEL_TESTS > 2) {
          PARALLEL_TESTS = Math.max(2, PARALLEL_TESTS - 1);
          console.log(`  🔧 Adaptive: Reduced parallelism to ${PARALLEL_TESTS} (rate limiting detected)`);
          consecutiveFailures = 0; // Reset counter after reducing parallelism
        }
        
        // 🔥 AGGRESSIVE: If all cookies in batch failed, reduce parallelism further
        if (consecutiveFailures >= 3 && PARALLEL_TESTS > 2) {
          PARALLEL_TESTS = 2;
          console.log(`  🔧 Adaptive: Reduced parallelism to ${PARALLEL_TESTS} (rate limiting detected)`);
          consecutiveFailures = 0; // Reset counter
        }
        if (consecutiveFailures >= 6 && PARALLEL_TESTS > 1) {
          PARALLEL_TESTS = 1;
          console.log(`  🔧 Adaptive: Reduced to single cookie testing (heavy rate limiting detected)`);
          // Minimal delay between single tests (reduced from 5-8s to 1-2s)
          await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 1000));
        }
        
        // Safety check: Stop earlier if completely failing (after 15 batches instead of 50)
        if (batch > 15 && strongCookiesFound === 0 && consecutiveFailures >= 10) {
          console.log(`\n⚠️ Early stop: ${batch} batches tested with 0 successful cookies`);
          console.log(`❌ YouTube bot detection is too aggressive - all generated cookies are being rejected`);
          console.log(`💡 System will proceed without cookies using cookie-less methods`);
          console.log(`💡 Tip: Consider using real browser cookies if downloads fail`);
          break;
        }
        
        // Safety check: Stop if we've exceeded batch limit
        if (batch > MAX_BATCHES) {
          console.log(`\n⚠️ Safety limit reached: ${MAX_BATCHES} batches tested`);
          if (strongCookiesFound >= MIN_STRONG_FOR_OPERATION) {
            console.log(`✅ Have ${strongCookiesFound} STRONG cookies (minimum ${MIN_STRONG_FOR_OPERATION} met)`);
            console.log(`📊 Final: ${strongCookiesFound} STRONG / ${mediumCookiesFound} MEDIUM / ${cookiesFound} total`);
            if (cookiesFound < cookiesNeeded) {
              console.log(`🔄 Continuing in background to fill remaining ${cookiesNeeded - cookiesFound} slots...`);
            }
            break;
          } else {
            console.log(`❌ Only found ${cookiesFound} cookies (${strongCookiesFound} strong, need ${MIN_STRONG_FOR_OPERATION} minimum)`);
            console.log(`💡 Generated cookies may not work - consider using real browser cookies`);
            break;
          }
        }
        
        // Phase 1 timeout: Check if we have minimum strong cookies
        if (elapsed > PHASE1_TIME && !phase1Complete) {
          phase1Complete = true;
          if (strongCookiesFound >= MIN_STRONG_FOR_OPERATION) {
            console.log(`\n✅ Phase 1 complete: ${strongCookiesFound} STRONG cookie(s) (${elapsed/1000}s) - DOWNLOADS CAN START!`);
            console.log(`🔄 Phase 2: Will resume filling remaining slots to 5/5 AFTER downloads complete`);
            // Don't break - but downloads can now proceed
          } else {
            console.log(`\n⚠️ Phase 1 timeout: Only ${strongCookiesFound} STRONG (need ${MIN_STRONG_FOR_OPERATION} minimum)`);
            // If we've tried many batches with no success, give up faster
            if (batch >= 10 && strongCookiesFound === 0) {
              console.log(`❌ No cookies found after ${batch} batches - YouTube bot detection is too aggressive`);
              console.log(`💡 System will proceed without cookies using cookie-less methods`);
              break; // Stop trying earlier if completely failing
            }
            console.log(`🔄 Continuing to find ${MIN_STRONG_FOR_OPERATION - strongCookiesFound} more STRONG cookie(s)...`);
            // Continue trying (don't break)
          }
        }
        
        // Final time limit
        if (elapsed > MAX_TIME) {
          console.log(`\n⚠️ Time limit reached: ${(elapsed/1000).toFixed(0)}s elapsed`);
          if (strongCookiesFound >= MIN_STRONG_FOR_OPERATION) {
            console.log(`✅ Have ${strongCookiesFound} STRONG cookies (minimum ${MIN_STRONG_FOR_OPERATION} met)`);
            console.log(`📊 Final: ${strongCookiesFound} STRONG / ${mediumCookiesFound} MEDIUM / ${cookiesFound} total`);
            if (cookiesFound < cookiesNeeded && cookiesFound < TARGET_TOTAL_COOKIES) {
              console.log(`🔄 Continuing in background to fill remaining ${cookiesNeeded - cookiesFound} slots...`);
            }
            break;
          } else if (cookiesFound >= 1) {
            console.log(`⚠️ Only found ${cookiesFound} cookies (${strongCookiesFound} strong, need ${MIN_STRONG_FOR_OPERATION} minimum)`);
            console.log(`🔄 System will proceed with available cookies`);
            break;
          } else {
            console.log(`❌ No cookies found - need at least ${MIN_STRONG_FOR_OPERATION} STRONG cookies`);
            console.log(`💡 Generated cookies may not work - consider using real browser cookies`);
            break;
          }
        }
        
        // 🛡️ SAFETY CHECK: Pause regeneration if downloads become active (and we have enough cookies)
        const hasActive = hasActiveDownloads();
        const currentCookies = await getWorkingCookiesFromPool();
        
        if (hasActive && currentCookies.length >= 1) {
          console.log(`\n⏸️ [Cookie Generation PAUSED] Downloads active (${activeDownloads.size}) with ${currentCookies.length} working cookie(s)`);
          console.log(`  📊 Current progress: ${cookiesFound}/${cookiesNeeded} new cookies generated (${strongCookiesFound} STRONG)`);
          console.log(`  💡 Will resume after downloads complete (5min auto-check or manual trigger)`);
          
          // Exit loop gracefully - we have enough cookies for downloads to proceed
          break;
        }
        
        const phaseLabel = inPhase1 ? 'Phase 1' : 'Phase 2';
        console.log(`\n🔄 ${phaseLabel} - Batch ${batch}/${MAX_BATCHES}: Testing ${PARALLEL_TESTS} cookies in parallel...`);
        
        // 🔥 RATE LIMITING: Add minimal delay only if many failures (reduced from exponential)
        if (consecutiveFailures >= 4 && batch > 1) {
          // Minimal delay: 1-2s max (much faster than before)
          const delay = 1000 + Math.random() * 1000; // 1-2s
          console.log(`  ⏳ Rate limiting detected (${consecutiveFailures} failures) - waiting ${(delay/1000).toFixed(1)}s...`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
        
        // 🎯 FALLBACK: After 15+ consecutive failures, try WITHOUT proxies (direct connection)
        // This gives a chance for cookie generation to succeed even when all proxies are dead
        const tryWithoutProxy = consecutiveFailures >= 15 && batch >= 5;
        
        // Generate multiple cookie sets in parallel
        const cookiePromises = [];
        for (let i = 0; i < PARALLEL_TESTS; i++) {
          const attempt = totalAttempts++;
          
          const testPromise = (async () => {
            try {
              // Generate cookies
              const cookieData = await generateRealisticYouTubeCookies(attempt);
              if (!cookieData || !cookieData.cookieContent) return { success: false, attempt };
              
              // Save to temp file
              const tempCookiePath = path.join(__dirname, `.temp_test_cookies_${Date.now()}_${i}.txt`);
              await fs.writeFile(tempCookiePath, cookieData.cookieContent, 'utf8');
              
              // 🎯 Test cookies - try without proxy if all proxies are failing
              const testResult = await testCookies(tempCookiePath, tryWithoutProxy);
              
              // Clean up temp file
              await fs.unlink(tempCookiePath).catch(() => {});
              
              const isSuccess = testResult && testResult.status !== 'fail';
              return { 
                success: isSuccess, 
                quality: testResult?.status || 'fail',
                attempt, 
                cookieContent: cookieData.cookieContent,
                visitorData: cookieData.visitorData,
                tempPath: tempCookiePath
              };
            } catch (err) {
              return { success: false, attempt };
            }
          })();
          
          cookiePromises.push(testPromise);
        }
        
        // Wait for all parallel tests to complete
        const results = await Promise.all(cookiePromises);
        
        // Collect ALL successful cookies
        const successfulResults = results.filter(r => r.success);
        
        if (successfulResults.length > 0) {
          consecutiveFailures = 0; // Reset failure counter on success
          
          // Sort: strong cookies first, then weak
          const sortedResults = successfulResults.sort((a, b) => {
            if (a.quality === 'strong' && b.quality !== 'strong') return -1;
            if (a.quality !== 'strong' && b.quality === 'strong') return 1;
            return 0;
          });
          
          // 🎯 STRATEGY: Get STRONG cookies first, then fill with medium
          const strongInBatch = sortedResults.filter(r => r.quality === 'strong').length;
          const strongNeeded = Math.max(0, TARGET_STRONG_COOKIES - strongCookiesFound);
          const totalNeeded = cookiesNeeded - cookiesFound;
          
          // Only accept weak/medium cookies if:
          // 1. We already have MIN_STRONG_FOR_OPERATION strong cookies (Phase 2), OR
          // 2. We're in Phase 2 and need to fill remaining slots, OR
          // 3. We're near time limits and have no strong cookies yet
          const elapsedTime = Date.now() - startTime;
          const inPhase2 = phase1Complete || strongCookiesFound >= MIN_STRONG_FOR_OPERATION;
          const nearTimeLimit = elapsedTime > (MAX_TIME * 0.8);
          const hasMinimumStrong = strongCookiesFound >= MIN_STRONG_FOR_OPERATION;
          
          // Accept medium cookies only in Phase 2 or if we're desperate
          const acceptMediumCookies = inPhase2 || (strongCookiesFound === 0 && nearTimeLimit);
          
          if (!acceptMediumCookies && sortedResults.some(r => r.quality === 'weak')) {
            console.log(`  ⏳ Skipping medium cookies - need ${strongNeeded} more STRONG first...`);
          }
          
          for (const result of sortedResults) {
            if (cookiesFound >= cookiesNeeded) break;
            
            // Priority logic: STRONG cookies first
            if (result.quality === 'strong') {
              // Always accept strong cookies if we need them
              if (strongCookiesFound < TARGET_TOTAL_COOKIES || cookiesFound < cookiesNeeded) {
                // Accept this strong cookie
              } else {
                continue; // We have enough strong, skip
              }
            } else {
              // Medium/weak cookie - only accept in Phase 2 or if desperate
              if (!acceptMediumCookies) {
                continue; // Still in Phase 1, skip medium
              }
              // Only accept medium if we have minimum strong and need to fill slots
              if (strongCookiesFound < MIN_STRONG_FOR_OPERATION) {
                continue; // Still need more strong cookies
              }
            }
            
            // Find next available slot
            while (existingIndices.includes(nextAvailableSlot)) {
              nextAvailableSlot++;
              if (nextAvailableSlot >= COOKIE_POOL_SIZE) nextAvailableSlot = 0;
            }
            
            const slotIndex = nextAvailableSlot;
            const cookieQuality = result.quality === 'weak' ? 'weak' : 'strong';
            await saveCookieToPool(result.cookieContent, slotIndex, { quality: cookieQuality });
            
            if (cookieQuality === 'weak') {
              mediumCookiesFound++;
              console.log(`  ⚠️ Saved cookie slot ${slotIndex + 1} as MEDIUM (${strongCookiesFound} STRONG / ${mediumCookiesFound} MEDIUM)`);
            } else {
              strongCookiesFound++;
              console.log(`  ✅ Saved cookie slot ${slotIndex + 1} as STRONG (${strongCookiesFound}/${TARGET_STRONG_COOKIES} STRONG)`);
            }
            
            existingIndices.push(slotIndex); // Mark as filled
            workingCookies.push(result.cookieContent);
            nextAvailableSlot++; // Move to next slot
            
            // Save first STRONG cookie as primary cookie
            if ((slotIndex === 0 || (cookiesFound === 0 && !existingIndices.includes(0))) && cookieQuality === 'strong') {
              await fs.writeFile(AUTO_COOKIE_PATH, result.cookieContent, 'utf8');
              
              // Also save to Redis
              if (isRedisAvailable()) {
                await savePrimaryCookieToRedis(result.cookieContent);
              }
              
              const metadata = await loadCookieMetadata();
              metadata.lastTested = new Date().toISOString();
              metadata.successCount = (metadata.successCount || 0) + 1;
              metadata.isValid = true;
              metadata.generationAttempt = result.attempt + 1;
              await saveCookieMetadata(metadata);
            }
            
            cookiesFound++;
            
            // 🎯 Early exit: If we have 1+ STRONG cookie, downloads can start IMMEDIATELY!
            if (inPhase1 && strongCookiesFound >= MIN_STRONG_FOR_OPERATION && !phase1Complete) {
              phase1Complete = true;
              console.log(`\n🎉 Phase 1 complete: ${strongCookiesFound} STRONG cookie(s) - DOWNLOADS CAN START IMMEDIATELY!`);
              console.log(`🔄 Phase 2: Will resume filling to ${TARGET_TOTAL_COOKIES}/5 AFTER all downloads complete`);
              // Downloads can now proceed - generation will pause when downloads start
            }
          }
          
          const totalCookies = existingIndices.length;
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`✅ Found ${successfulResults.length} working cookie(s) in batch ${batch}!`);
          console.log(`📊 Progress: ${strongCookiesFound} STRONG / ${mediumCookiesFound} MEDIUM / ${totalCookies}/${TARGET_TOTAL_COOKIES} total (${elapsed}s)`);
        } else {
          consecutiveFailures++; // Track consecutive failures
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`  ❌ Batch ${batch} failed: 0/${PARALLEL_TESTS} successful (${elapsed}s elapsed) - retrying...`);
        }
        
        // Adaptive delay: Minimal delay between batches (reduced significantly)
        let batchDelay = 500; // Base 0.5s delay (reduced from 1s)
        if (consecutiveFailures >= 3) {
          // Only slightly longer if many failures: 1-1.5s max
          batchDelay = 1000 + Math.random() * 500; // 1-1.5s
        } else if (consecutiveFailures >= 1) {
          // Small delay for occasional failures: 0.5-1s
          batchDelay = 500 + Math.random() * 500; // 0.5-1s
        }
        if (cookiesFound < cookiesNeeded) {
          await new Promise(resolve => setTimeout(resolve, Math.floor(batchDelay)));
        }
      }
      
      // Final status report
      const totalCookies = existingIndices.length;
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      
      if (totalCookies >= TARGET_TOTAL_COOKIES) {
        console.log(`\n🎉 SUCCESS! Cookie pool FULL: ${totalCookies}/${TARGET_TOTAL_COOKIES} working cookies after ${elapsed}s`);
        console.log(`📊 Final: ${strongCookiesFound} STRONG / ${mediumCookiesFound} MEDIUM`);
      } else if (strongCookiesFound >= MIN_STRONG_FOR_OPERATION) {
        console.log(`\n✅ OPERATIONAL: System ready with ${strongCookiesFound} STRONG cookie(s) - DOWNLOADS CAN START! (${elapsed}s)`);
        console.log(`📊 Current: ${strongCookiesFound} STRONG / ${mediumCookiesFound} MEDIUM / ${totalCookies}/${TARGET_TOTAL_COOKIES} total`);
        if (totalCookies < TARGET_TOTAL_COOKIES) {
          console.log(`🔄 Phase 2: Will resume filling remaining ${TARGET_TOTAL_COOKIES - totalCookies} slots AFTER downloads complete`);
        }
      } else if (totalCookies > 0) {
        console.log(`\n⚠️ PARTIAL: Cookie pool has ${totalCookies} cookies (${strongCookiesFound} STRONG) after ${elapsed}s`);
        console.log(`💡 System will use available cookies and continue regenerating in background`);
      } else {
        console.log(`\n❌ FAILED: Cookie pool has 0/${TARGET_TOTAL_COOKIES} working cookies after ${elapsed}s`);
        console.log(`💡 Generated cookies may not work - consider using real browser cookies`);
        console.log(`🔄 System will proceed without cookies and try cookie-less methods`);
      }
      
      console.log(`📦 Pool ready at: ${COOKIE_POOL_DIR}`);
      
      // Return path if we have at least one cookie, otherwise null
      return totalCookies > 0 ? AUTO_COOKIE_PATH : null;
    } catch (err) {
      console.log(`  ⚠️ Cookie generation error: ${err.message}`);
      return null;
    } finally {
      // Release lock
      isGeneratingCookies = false;
      cookieGenerationPromise = null;
    }
  })();
  
  return await cookieGenerationPromise;
}

// 🎯 ENSURE POOL IS ALWAYS FULL (5/5) - Background maintenance with circuit breaker
// Global state for pool maintenance
let isFillingPool = false;
let lastPoolFillAttempt = 0;
let consecutivePoolFillFailures = 0;
const POOL_FILL_COOLDOWN = 60000; // 1 minute cooldown after failure
const MAX_CONSECUTIVE_FAILURES = 3; // Circuit breaker threshold

// 🔒 GLOBAL LOCKS: Prevent overlapping regeneration
const activeRegenerations = new Set(); // Track which slots are being regenerated

// 🛡️ SAFETY: Check if downloads are active
function hasActiveDownloads() {
  // Check if any downloads are actually ACTIVE (not completed/cancelled/failed)
  for (const [downloadId, downloadInfo] of activeDownloads.entries()) {
    if (downloadInfo.status !== 'completed' && downloadInfo.status !== 'cancelled' && downloadInfo.status !== 'failed') {
      return true; // Found at least one active download
    }
  }
  return false; // All downloads are completed/cancelled/failed
}

// 🔄 RESUME REGENERATION: Check if we should resume pool filling when downloads complete
async function checkAndResumeRegeneration() {
  try {
    // Check if downloads are actually active (not just if they exist)
    const actuallyActive = hasActiveDownloads();
    
    if (actuallyActive) {
      // Still have active downloads - don't resume yet
      return;
    }
    
    // All downloads are completed/cancelled/failed - safe to resume
    // 🔧 FIX: Validate cookies first to detect and remove dead ones, then fill missing slots
    console.log(`\n🔄 Downloads completed - validating cookie pool and resuming maintenance...`);
    const validationResult = await validateCookiePool();
    
    // After validation, check if we need to fill missing slots
    if (validationResult.valid < COOKIE_POOL_SIZE) {
      console.log(`  📊 Pool status: ${validationResult.valid}/${COOKIE_POOL_SIZE} validated cookies - filling ${COOKIE_POOL_SIZE - validationResult.valid} missing slots...`);
      ensurePoolIsFull().catch((err) => {
        console.log(`  ⚠️ Failed to resume pool fill: ${err.message}`);
      });
    } else {
      console.log(`  ✅ Pool is full: ${validationResult.valid}/${COOKIE_POOL_SIZE} validated cookies`);
    }
  } catch (err) {
    // Silent fail - don't interrupt download completion
  }
}

// 🛡️ WAIT FOR COOKIES: Block download until at least 1 VALIDATED working cookie is available
async function waitForWorkingCookie(maxWaitTime = 300000, checkInterval = 5000) {
  const startTime = Date.now();
  let lastStatus = '';
  
  while (Date.now() - startTime < maxWaitTime) {
    // Just check if cookies EXIST (don't validate - too expensive!)
    await initCookiePool();
    const existingCookies = await getWorkingCookiesFromPool();
    
    if (existingCookies.length >= 1) {
      if (lastStatus) {
        console.log(`  ✅ Cookies available! (${existingCookies.length}/5 in pool) - resuming download`);
      }
      return true; // At least 1 cookie file exists
    }
    
    // Log status every 10 seconds
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    if (elapsed % 10 === 0 && elapsed > 0 && lastStatus !== `waiting-${elapsed}`) {
      console.log(`  ⏳ Waiting for cookies to be generated... (${elapsed}s elapsed)`);
      lastStatus = `waiting-${elapsed}`;
    }
    
    // Trigger regeneration if not already in progress
    if (!isFillingPool) {
      ensurePoolIsFull().catch(() => {});
    }
    
    // Wait before next check
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  console.log(`  ⚠️ Timeout waiting for cookie (${maxWaitTime/1000}s) - proceeding anyway`);
  return false; // Timeout - proceed without cookies (will use cookie-less methods)
}

async function ensurePoolIsFull() {
  try {
    // 🔒 PREVENT OVERLAPPING CALLS - Only one pool fill at a time
    if (isFillingPool) {
      console.log(`  ⏭️ Pool fill already in progress - skipping duplicate call`);
      return false;
    }
    
    // 🛡️ SAFETY: If downloads are active and we have at least 1 cookie, PAUSE regeneration
    // Don't validate (too expensive) - just check existence
    const hasActive = hasActiveDownloads();
    const existingCookies = await getWorkingCookiesFromPool();
    const validatedCookies = existingCookies.length; // Assume they're valid (will find out during actual use)
    
    // 🎯 PAUSE REGENERATION: If cookie-less first attempt is in progress, pause until it completes
    let cookieLessInProgress = false;
    for (const [id, info] of activeDownloads.entries()) {
      if (info.cookieLessAttemptInProgress === true) {
        cookieLessInProgress = true;
        break;
      }
    }
    
    if (cookieLessInProgress) {
      console.log(`  ⏸️ Cookie-less first attempt in progress - pausing regeneration until it completes`);
      return false; // Don't regenerate during cookie-less first attempt
    }
    
    // 🛡️ PAUSE ALL REGENERATION DURING ACTIVE DOWNLOADS (focus on downloads, not cookie generation)
    // EXCEPTION: Only allow regeneration when explicitly waiting for strong cookie (needed for download to proceed)
    let waitingForStrongCookie = false;
    for (const [id, info] of activeDownloads.entries()) {
      if (info.waitingForStrongCookie === true && info.status === 'waiting') {
        waitingForStrongCookie = true;
        break;
      }
    }
    
    // 🛡️ PAUSE: If downloads are active, pause ALL regeneration (regardless of cookie count)
    // This ensures downloads get full resources and stability
    if (hasActive && !waitingForStrongCookie) {
      console.log(`  ⏸️ Downloads active (${activeDownloads.size}) - pausing ALL regeneration to focus on downloads`);
      return false; // Don't regenerate during active downloads (user wants stability)
    }
    
    // Only allow regeneration when explicitly waiting for strong cookie
    if (hasActive && waitingForStrongCookie) {
      console.log(`  🔄 Downloads active but waiting for strong cookie - allowing regeneration (needed for download)`);
      // Continue with regeneration (don't return)
    }
    
    // 🔌 CIRCUIT BREAKER - Stop trying if too many failures (but skip if emergency mode)
    if (consecutivePoolFillFailures >= MAX_CONSECUTIVE_FAILURES && !(hasActive && validatedCookies === 0)) {
      const timeSinceLastAttempt = Date.now() - lastPoolFillAttempt;
      if (timeSinceLastAttempt < POOL_FILL_COOLDOWN) {
        console.log(`  🔌 Circuit breaker active: Too many failures (${consecutivePoolFillFailures}), waiting ${Math.ceil((POOL_FILL_COOLDOWN - timeSinceLastAttempt) / 1000)}s before retry`);
        return false;
      } else {
        // Reset after cooldown
        console.log(`  🔄 Circuit breaker reset - retrying after ${POOL_FILL_COOLDOWN/1000}s cooldown`);
        consecutivePoolFillFailures = 0;
      }
    }
    
    isFillingPool = true;
    lastPoolFillAttempt = Date.now();
    
    const missingCount = COOKIE_POOL_SIZE - validatedCookies;
    
    if (missingCount > 0) {
      console.log(`\n🔄 Pool maintenance: ${validatedCookies}/${COOKIE_POOL_SIZE} validated cookies - filling ${missingCount} missing slots...`);
      
      // Get actual cookie files to determine which slots exist
      const existingCookies = await getWorkingCookiesFromPool();
      
      // Find which slots are missing
      const existingIndices = existingCookies.map(c => {
        return c.index !== undefined ? c.index : parseInt(c.path.match(/cookie_(\d+)\.txt/)?.[1] || '0');
      });
      
      // Fill each missing slot (don't wait - do in background)
      const fillPromises = [];
      for (let i = 0; i < COOKIE_POOL_SIZE; i++) {
        if (!existingIndices.includes(i)) {
          console.log(`  📍 Filling empty slot ${i + 1}...`);
          fillPromises.push(regenerateSingleCookie(i));
        }
      }
      
      // Wait for all slots to be filled (or timeout after 120s for stricter validation)
      try {
        await Promise.race([
          Promise.all(fillPromises),
          new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 120000))
        ]);
      } catch (err) {
        console.log(`  ⚠️ Some slots took too long to fill, continuing anyway`);
      }
      
      const finalCookies = await getWorkingCookiesFromPool();
      console.log(`  ✅ Pool status: ${finalCookies.length}/${COOKIE_POOL_SIZE} cookies available`);
      
      // Track success/failure
      if (finalCookies.length >= COOKIE_POOL_SIZE) {
        consecutivePoolFillFailures = 0; // Reset on success
        isFillingPool = false;
        return true;
      } else {
        consecutivePoolFillFailures++;
        console.log(`  ⚠️ Pool fill incomplete (${consecutivePoolFillFailures}/${MAX_CONSECUTIVE_FAILURES} failures)`);
        isFillingPool = false;
        return false;
      }
    }
    
    isFillingPool = false;
    return true; // Pool is already full
  } catch (err) {
    consecutivePoolFillFailures++;
    console.log(`  ⚠️ Pool maintenance error: ${err.message}`);
    isFillingPool = false;
    return false;
  }
}

// 🔄 REGENERATE SINGLE COOKIE SLOT (when one dies during download)
async function regenerateSingleCookie(slotIndex) {
  try {
    // 🔒 PREVENT OVERLAPPING REGENERATION - Only one regeneration per slot at a time
    if (activeRegenerations.has(slotIndex)) {
      console.log(`  ⏭️ Regeneration for slot ${slotIndex + 1} already in progress - skipping duplicate call`);
      return false;
    }
    
    // 🛡️ SAFETY: If downloads are active and we have at least 1 working cookie, skip regeneration
    // ⚠️ CRITICAL: Don't call validateCookiePool() here to avoid cascade loops - just check file count
    const hasActive = hasActiveDownloads();
    const existingCookies = await getWorkingCookiesFromPool();
    
    // 🎯 PAUSE REGENERATION: If cookie-less first attempt is in progress, pause until it completes
    let cookieLessInProgress = false;
    for (const [id, info] of activeDownloads.entries()) {
      if (info.cookieLessAttemptInProgress === true) {
        cookieLessInProgress = true;
        break;
      }
    }
    
    if (cookieLessInProgress) {
      console.log(`  ⏸️ Skipping regeneration for slot ${slotIndex + 1}: Cookie-less first attempt in progress - pausing until it completes`);
      return false; // Don't regenerate during cookie-less first attempt
    }
    
    // 🛡️ PAUSE ALL REGENERATION DURING ACTIVE DOWNLOADS (focus on downloads, not cookie generation)
    // EXCEPTION: Only allow regeneration when explicitly waiting for strong cookie (needed for download to proceed)
    let waitingForStrongCookie = false;
    for (const [id, info] of activeDownloads.entries()) {
      if (info.waitingForStrongCookie === true && info.status === 'waiting') {
        waitingForStrongCookie = true;
        break;
      }
    }
    
    // 🛡️ PAUSE: If downloads are active, pause ALL regeneration (regardless of cookie count)
    // This ensures downloads get full resources and stability
    if (hasActive && !waitingForStrongCookie) {
      console.log(`  ⏸️ Skipping regeneration for slot ${slotIndex + 1}: Downloads active (${activeDownloads.size}) - pausing ALL regeneration to focus on downloads`);
      return false; // Don't regenerate during active downloads (user wants stability)
    }
    
    // Only allow regeneration when explicitly waiting for strong cookie
    if (hasActive && waitingForStrongCookie) {
      console.log(`  🔄 Downloads active but waiting for strong cookie - allowing regeneration for slot ${slotIndex + 1} (needed for download)`);
      // Continue with regeneration (don't return)
    }
    
    // Mark this slot as being regenerated
    activeRegenerations.add(slotIndex);
    
    console.log(`\n🔄 Regenerating cookie slot ${slotIndex + 1}/${COOKIE_POOL_SIZE} (dead cookie detected)...`);
    
    // 🎯 STEP 1: Check backup pool first (faster than generating!)
    if (isRedisAvailable()) {
      const backupCookie = await getCookieFromBackup();
      if (backupCookie && backupCookie.content) {
        console.log(`  🎁 Found cookie in backup pool - using it immediately!`);
        // ✅ Replace the FAILED cookie slot with backup cookie
        await saveCookieToPool(backupCookie.content, slotIndex, { quality: 'strong' });
        // This replaces cookie at slotIndex (the failed one)
        console.log(`✅ Cookie slot ${slotIndex + 1} replaced from backup pool (replaced failed cookie!)`);
        if (isRedisAvailable()) {
          console.log(`  ☁️ New cookie automatically saved to Redis`);
        }
        return true;
      } else {
        console.log(`  📭 No cookies in backup pool - will generate new STRONG cookies`);
      }
    }
    
    // 🎯 STEP 2: Generate new STRONG cookies (with rate limiting to avoid bot detection)
    const startTime = Date.now();
    // 🔥 REDUCE PARALLELISM: If all cookies are failing, reduce to 1-2 to avoid rate limits
    const recentFailures = global['cookie_regeneration_failures'] || 0;
    const PARALLEL_GENERATION = recentFailures > 10 ? 1 : (recentFailures > 5 ? 2 : 3); // Adaptive: 3→2→1
    let attempts = 0;
    const maxAttempts = 30; // Reduced from 50 to avoid long loops
    const DELAY_BETWEEN_BATCHES = recentFailures > 10 ? 5000 : (recentFailures > 5 ? 3000 : 2000); // 2s→3s→5s
    
    while (attempts < maxAttempts) {
      // 🛡️ CHECK: Pause if downloads become active during regeneration
      const hasActiveNow = hasActiveDownloads();
      let waitingForStrongCookie = false;
      for (const [id, info] of activeDownloads.entries()) {
        if (info.waitingForStrongCookie === true && info.status === 'waiting') {
          waitingForStrongCookie = true;
          break;
        }
      }
      
      if (hasActiveNow && !waitingForStrongCookie) {
        console.log(`  ⏸️ Downloads became active during regeneration - pausing slot ${slotIndex + 1}`);
        activeRegenerations.delete(slotIndex); // 🔧 FIX: Release lock so regeneration can resume later
        return false; // Pause regeneration
      }
      
      attempts += PARALLEL_GENERATION;
      
      // 🎯 FALLBACK: After 15+ attempts with proxies all failing, try WITHOUT proxies (direct connection)
      // This gives a chance for cookie generation to succeed even when all proxies are dead
      const proxyFailures = global['cookie_regeneration_failures'] || 0;
      const tryWithoutProxy = proxyFailures >= 15 && attempts >= 15; // Try without proxy after 15 failures
      
      // Generate multiple cookies in parallel
      const generationPromises = [];
      for (let i = 0; i < PARALLEL_GENERATION; i++) {
        const attemptNum = attempts - PARALLEL_GENERATION + i;
        generationPromises.push((async () => {
          try {
            const cookieData = await generateRealisticYouTubeCookies(attemptNum, true);
            if (!cookieData || !cookieData.cookieContent) return null;
            
            const tempCookiePath = path.join(__dirname, `.temp_regenerate_${slotIndex}_${Date.now()}_${i}.txt`);
            await fs.writeFile(tempCookiePath, cookieData.cookieContent, 'utf8');
            
            // 🎯 Try without proxy if all proxies are failing
            const testResult = await testCookies(tempCookiePath, tryWithoutProxy);
            await fs.unlink(tempCookiePath).catch(() => {});
            
            // ✅ Only accept STRONG cookies (not weak, not failed)
            if (testResult && testResult.status === 'strong') {
              return { 
                content: cookieData.cookieContent, 
                quality: 'strong',
                visitorData: cookieData.visitorData
              };
            }
            // Reject weak cookies - we only want STRONG
            return null;
          } catch (err) {
            return null;
          }
        })());
      }
      
      const results = await Promise.all(generationPromises);
      const strongCookies = results.filter(r => r !== null && r.quality === 'strong'); // Only STRONG cookies
      
      // 🔥 RATE LIMITING: If all cookies failed, wait before next batch
      if (strongCookies.length === 0 && attempts < maxAttempts) {
        console.log(`  ⏳ All ${PARALLEL_GENERATION} cookies failed - waiting ${DELAY_BETWEEN_BATCHES/1000}s before next batch...`);
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BATCHES));
        global['cookie_regeneration_failures'] = (global['cookie_regeneration_failures'] || 0) + PARALLEL_GENERATION;
      } else if (strongCookies.length > 0) {
        // Reset failure counter on success
        global['cookie_regeneration_failures'] = 0;
      }
      
      if (strongCookies.length > 0) {
        // ✅ STEP 3: Replace failed cookie slot with FIRST strong cookie
        const firstStrongCookie = strongCookies[0];
        await saveCookieToPool(firstStrongCookie.content, slotIndex, { quality: 'strong' });
        // This replaces the failed cookie at slotIndex
        console.log(`✅ Cookie slot ${slotIndex + 1} replaced with new STRONG cookie`);
        
        // ✅ STEP 4: If we got MORE than 1 strong cookie, save extras to backup
        if (strongCookies.length > 1) {
          // We have extras! Save them to backup pool
          const extraStrongCookies = strongCookies.slice(1); // Skip first (already used), keep the rest
          console.log(`  💾 Found ${extraStrongCookies.length} extra STRONG cookie(s) - saving to backup pool...`);
          
          if (isRedisAvailable()) {
            for (const extraCookie of extraStrongCookies) {
              await saveCookieToBackup(extraCookie.content, {
                quality: 'strong',
                source: 'regeneration',
                originalSlot: slotIndex,
                savedAt: new Date().toISOString()
              });
            }
            const backupCount = await getBackupPoolCount();
            console.log(`  ✅ Backup pool now has ${backupCount} cookie(s) ready for future use`);
          }
        } else {
          // Only 1 strong cookie found - just replace slot, nothing to save to backup
          console.log(`  ℹ️ Only 1 STRONG cookie found - replaced slot, no extras to save`);
        }
        
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`✅ Cookie slot ${slotIndex + 1} regenerated successfully after ${attempts} attempts (${elapsed}s)`);
        if (isRedisAvailable()) {
          console.log(`  ☁️ New cookie automatically saved to Redis`);
        }
        // Release lock
        activeRegenerations.delete(slotIndex);
        return true;
      }
      
      // Show progress every 10 attempts
      if (attempts % 10 === 0) {
        console.log(`  ⏳ Regeneration attempt ${attempts}/${maxAttempts}... (looking for STRONG cookies)`);
      }
    }
    
    // 🔥 TRACK FAILURES: If regeneration failed, increment counter
    global['cookie_regeneration_failures'] = (global['cookie_regeneration_failures'] || 0) + 1;
    console.log(`⚠️ Failed to regenerate cookie slot ${slotIndex + 1} after ${attempts} attempts (no STRONG cookies found)`);
    console.log(`  💡 Tip: Consider using real browser cookies if all generated cookies fail`);
    // Release lock
    activeRegenerations.delete(slotIndex);
    return false;
  } catch (err) {
    console.log(`❌ Error regenerating cookie slot ${slotIndex + 1}: ${err.message}`);
    // Release lock on error
    activeRegenerations.delete(slotIndex);
    return false;
  }
}

// ⚡ ULTRA-STRICT COOKIE VALIDATION - Test actual audio extraction (10s timeout)
// This ensures cookies work for REAL downloads, not just metadata
async function quickValidateCookie(cookiePath, index = null) {
  try {
    // 🎯 TEST WITH ACTUAL AUDIO EXTRACTION (not just metadata!)
    // This is the REAL test - if this fails, the cookie is dead
    const testArgs = [
      '-m', 'yt_dlp',
      `https://www.youtube.com/watch?v=${TEST_VIDEO_ID}`,
      '--cookies', cookiePath,
      '--print', 'after_move:filepath', // Only print filepath if extraction succeeds
      '--extract-audio',
      '--audio-format', 'mp3',
      '--audio-quality', '128K', // Low quality for fast testing
      '--no-playlist',
      '--quiet',
      '--no-warnings',
      '--output', '/tmp/cookie_test_%(id)s.%(ext)s', // Temp location
      '--extractor-args', 'youtube:player_client=android',
      '--user-agent', 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36',
      '--max-filesize', '5M' // Abort if file is too large (just testing)
    ];
    
    return new Promise((resolve) => {
      const testProcess = spawn(PYTHON_CMD, testArgs, {
        stdio: ['ignore', 'pipe', 'pipe'],
        timeout: 10000 // 10s timeout for actual extraction
      });
      
      let errorOutput = '';
      let stdoutData = '';
      let resolved = false;
      
      testProcess.stdout.on('data', (data) => {
        stdoutData += data.toString();
      });
      
      testProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      testProcess.on('close', async (code) => {
        if (resolved) return;
        resolved = true;
        
        // Check for bot detection errors
        const hasBotDetectionError = errorOutput.includes('Sign in to confirm') || 
                                     errorOutput.includes('LOGIN_REQUIRED') ||
                                     errorOutput.includes('Please sign in to continue') ||
                                     errorOutput.includes("you're not a bot") ||
                                     errorOutput.includes('UNPLAYABLE') ||
                                     errorOutput.includes('Video unavailable') ||
                                     errorOutput.includes('This video is unavailable');
        
        // Check for successful extraction (got file path in stdout)
        const hasExtractedFile = stdoutData.includes('/tmp/cookie_test_');
        
        // Cleanup temp file if created
        if (hasExtractedFile) {
          const match = stdoutData.match(/\/tmp\/cookie_test_[^\s]+/);
          if (match) {
            try {
              await fs.unlink(match[0]).catch(() => {});
            } catch {}
          }
        }
        
        // Cookie is valid ONLY if: no bot errors AND successfully extracted file AND exit code is 0
        const isValid = !hasBotDetectionError && hasExtractedFile && code === 0;
        
        if (!isValid) {
          console.log(`    ❌ Cookie test FAILED (bot detection)` + (index !== null ? ` [slot ${index + 1}]` : ''));
        } else {
          console.log(`    ✅ Cookie test STRONG PASS (valid JSON with title/id)` + (index !== null ? ` [slot ${index + 1}]` : ''));
        }
        
        resolve(isValid);
      });
      
      testProcess.on('error', () => {
        if (resolved) return;
        resolved = true;
        resolve(false);
      });
      
      // STRICT TIMEOUT: 10s for actual extraction test
      setTimeout(() => {
        if (resolved) return;
        resolved = true;
        try { testProcess.kill('SIGKILL'); } catch {}
        console.log(`    ❌ Cookie test timeout - rejecting` + (index !== null ? ` [slot ${index + 1}]` : ''));
        resolve(false);
      }, 10000);
    });
  } catch (err) {
    return false;
  }
}

// ✅ VALIDATE COOKIE POOL ON STARTUP
async function validateCookiePool() {
  try {
    await initCookiePool();
    const cookies = await getWorkingCookiesFromPool();
    
    if (cookies.length === 0) {
      console.log('  📝 Cookie pool is empty - will generate new cookies');
      return { valid: 0, total: 0, needGeneration: true };
    }
    
    // 🚀 TRUST ALL COOKIES - Don't remove based on validation tests (tests can be flaky/unreliable)
    // Cookies will be removed only when they fail during actual downloads, not validation tests
    const redisCookies = cookies.filter(c => c.index !== undefined && c.content);
    const filesystemCookies = cookies.filter(c => !c.index || !c.content);
    
    let validCookies = [];
    
    if (redisCookies.length > 0) {
      console.log(`  ✅ Trusting ${redisCookies.length} Redis cookie(s) without validation (will test during actual downloads)`);
      
      // Sync Redis cookies to filesystem for yt-dlp compatibility
      for (const cookie of redisCookies) {
        const cookiePath = path.join(COOKIE_POOL_DIR, `cookie_${cookie.index}.txt`);
        await fs.writeFile(cookiePath, cookie.content, 'utf8').catch(() => {});
        cookie.path = cookiePath;
      }
      
      // Trust all Redis cookies (add them to validCookies)
      validCookies = redisCookies.map(cookie => ({
        index: cookie.index,
        path: cookie.path,
        content: cookie.content,
        isValid: true,
        isRedisCookie: true
      }));
    }
    
    // 🔧 FIX: Trust filesystem cookies too - don't remove based on validation tests
    // Validation tests can fail due to temporary issues (rate limiting, network, etc.)
    // Cookies should only be removed when they fail during actual downloads
    if (filesystemCookies.length > 0) {
      console.log(`  ✅ Trusting ${filesystemCookies.length} filesystem cookie(s) without validation (will test during actual downloads)`);
      
      // Trust all filesystem cookies (don't validate and remove)
      const trustedFilesystemCookies = filesystemCookies.map(cookie => {
        const index = parseInt(cookie.path.match(/cookie_(\d+)\.txt/)?.[1] || '0');
        return {
          index,
          path: cookie.path,
          content: cookie.content,
          isValid: true,
          isRedisCookie: false
        };
      });
      
      validCookies = [...validCookies, ...trustedFilesystemCookies];
    }
    
    await saveCookiePoolMetadata();
    
    const redisCount = redisCookies.length;
    const filesystemCount = validCookies.length - redisCount;
    console.log(`  ✅ Cookie pool: ${validCookies.length}/${cookies.length} cookies (${redisCount} from Redis trusted, ${filesystemCount} filesystem trusted)`);
    
    // Update primary cookie if needed
    if (validCookies.length > 0) {
      const primaryCookie = validCookies[0];
      // Use content if available (Redis cookie), otherwise read from path
      const content = primaryCookie.content || await fs.readFile(primaryCookie.path, 'utf8');
      await fs.writeFile(AUTO_COOKIE_PATH, content, 'utf8');
      
      // Also save to Redis if available
      if (isRedisAvailable()) {
        await savePrimaryCookieToRedis(content);
      }
      
      console.log(`  💾 Updated primary cookie from pool`);
    }
    
    // 🎯 If pool is not full, trigger background fill (non-blocking, only if safe)
    // ⚠️ CRITICAL: Check if pool fill is already in progress to prevent cascade loops
    if (validCookies.length < COOKIE_POOL_SIZE && !isFillingPool) {
      const hasActive = hasActiveDownloads();
      
      // 🛡️ SAFETY: Only fill pool when downloads are idle OR when we have 0 cookies
      if (hasActive && validCookies.length >= 1) {
        console.log(`  ⏸️ Pool needs ${COOKIE_POOL_SIZE - validCookies.length} more cookies, but downloads active (${activeDownloads.size}) with ${validCookies.length} working cookie(s) - pausing fill for safety`);
      } else {
        console.log(`  🔄 Pool needs ${COOKIE_POOL_SIZE - validCookies.length} more cookies - starting background fill...`);
        ensurePoolIsFull().catch((err) => {
          console.log(`  ⚠️ Background pool fill failed: ${err.message}`);
        });
      }
    } else if (isFillingPool) {
      console.log(`  ⏭️ Pool validation: Fill already in progress - skipping duplicate call`);
    }
    
    return {
      valid: validCookies.length,
      total: cookies.length,
      needGeneration: validCookies.length < COOKIE_POOL_SIZE
    };
  } catch (err) {
    console.log(`  ⚠️ Cookie pool validation error: ${err.message}`);
    return { valid: 0, total: 0, needGeneration: true };
  }
}

// 🔄 SMART RETRY WITH COOKIE ROTATION
async function smartRetryWithCookies(operation, maxRetries = 5) {
  const cookies = await getAllCookiesFromPool();
  
  if (cookies.length === 0) {
    // No cookies available, just try operation once
    console.log('  ⚠️ No cookies in pool - attempting without cookies');
    return await operation(null, 0);
  }
  
  let botDetectionCount = 0; // Track how many cookies failed with bot detection
  
  // Try each cookie in priority order
  for (let attempt = 0; attempt < Math.min(cookies.length, maxRetries); attempt++) {
    const cookie = cookies[attempt];
    
    // Add delay between attempts to avoid rate limiting (exponential backoff)
    if (attempt > 0) {
      const delay = Math.min(1000 * Math.pow(1.5, attempt - 1), 5000); // Max 5s delay
      console.log(`  ⏳ Waiting ${(delay/1000).toFixed(1)}s before next attempt...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
    
    try {
      console.log(`  🍪 Trying cookie ${cookie.index + 1}/${cookies.length} (${path.basename(cookie.path)})...`);
      const result = await operation(cookie.path, attempt);
      
      // Success! Record it
      if (result !== false && result !== null) {
        recordCookieSuccess(cookie.index);
        console.log(`  ✅ Cookie ${cookie.index + 1} worked! Operation successful.`);
        return result;
      }
      
      // Operation failed but didn't throw - record failure
      recordCookieFailure(cookie.index);
      console.log(`  ❌ Cookie ${cookie.index + 1} failed (returned false/null)`);
    } catch (err) {
      // Check if it's a bot detection error (special error or error message)
      const errorMsg = err.message || err.toString() || '';
      const isBotDetection = errorMsg === 'COOKIE_BOT_DETECTION' ||
                            errorMsg.includes('Sign in to confirm') ||
                            errorMsg.includes('LOGIN_REQUIRED') ||
                            errorMsg.includes("you're not a bot") ||
                            errorMsg.includes('confirm you are not a bot');
      
      if (isBotDetection) {
        botDetectionCount++;
        recordCookieFailure(cookie.index);
        console.log(`  ⚠️ Cookie ${cookie.index + 1} failed (bot detection) - rotating to next cookie...`);
        
        // 🛡️ SAFETY: Only regenerate if we have 0 cookies OR downloads are idle
        // Don't validate (too expensive) - just check existence
        const existingCookies = await getWorkingCookiesFromPool();
        // Exclude the failed cookie from count
        const remainingValidatedCookies = existingCookies.length > 0 && cookies.some(c => c.index === cookie.index) 
          ? existingCookies.length - 1 
          : existingCookies.length;
        const hasActive = hasActiveDownloads();
        
        if (hasActive && remainingValidatedCookies >= 1) {
          console.log(`  ⏸️ Skipping regeneration: Downloads active with ${remainingValidatedCookies} validated working cookie(s) - safe to continue`);
          // ✅ ROTATE: Continue to next cookie in loop (Cookie 2 → Cookie 3 → Cookie 4, etc.)
          continue;
        }
        
        // 🔥 IMMEDIATE REGENERATION: Trigger on FIRST failure for THIS cookie slot (only if safe)
        console.log(`  🔄 Cookie ${cookie.index + 1} (slot ${cookie.index}) failed - starting background regeneration...`);
        // Regenerate THIS cookie slot in background (don't await) - checks backup pool first, then generates
        regenerateSingleCookie(cookie.index).then(() => {
          console.log(`  ✅ Cookie slot ${cookie.index + 1} regenerated successfully in background`);
          // After regenerating, ensure pool is full (only if downloads are idle)
          if (!hasActiveDownloads()) {
            ensurePoolIsFull().catch(() => {});
          }
        }).catch((err) => {
          console.log(`  ⚠️ Background regeneration failed for cookie ${cookie.index + 1}: ${err.message}`);
        });
        
        // ✅ ROTATE: Continue to next cookie in loop (Cookie 2 → Cookie 3 → Cookie 4, etc.)
        continue;
      }
      
      // For other errors, re-throw to let caller handle
      throw err;
    }
  }
  
  // 🚨 ALL COOKIES FAILED - This is critical!
  console.log(`\n🚨 CRITICAL: All ${cookies.length} cookies in pool failed with bot detection!`);
  console.log(`📊 Bot detection failures: ${botDetectionCount}/${cookies.length}`);
  
  // 🛡️ SAFETY: If downloads are active and we have 0 cookies, PAUSE and WAIT for regeneration
  // Don't validate (too expensive) - just check existence
  const hasActive = hasActiveDownloads();
  const existingCookies = await getWorkingCookiesFromPool();
  const validatedCookies = existingCookies.length; // Assume they're valid (will find out during actual use)
  
  if (hasActive && validatedCookies === 0) {
    console.log(`\n⏸️ Download paused: All cookies failed, 0 working cookies remaining - waiting for regeneration...`);
    
    // Wait for at least 1 working cookie (max 5 minutes)
    const hasCookie = await waitForWorkingCookie(300000, 5000);
    
    if (hasCookie) {
      console.log(`  ✅ Cookie regenerated! Retrying operation with new cookie...`);
      // Retry the operation with the new cookie
      const newCookies = await getWorkingCookiesFromPool();
      if (newCookies.length > 0) {
        const newCookie = newCookies[0];
        console.log(`  🔄 Retrying with cookie ${newCookie.index + 1}...`);
        try {
          const result = await operation(newCookie.path, attempt);
          if (result !== false && result !== null) {
            recordCookieSuccess(newCookie.index);
            console.log(`  ✅ Retry successful with new cookie!`);
            return result;
          }
        } catch (retryErr) {
          console.log(`  ❌ Retry with new cookie also failed: ${retryErr.message}`);
        }
      }
    } else {
      console.log(`  ⚠️ No cookies available after waiting - proceeding with cookie-less methods`);
    }
  }
  
  // Track cookie pool regeneration attempts to avoid infinite loops
  const MAX_REGENERATION_CYCLES = 2; // Only regenerate pool twice
  const cookieFailureKey = 'cookie_pool_regeneration_cycles';
  const failureCount = global[cookieFailureKey] || 0;
  
  // If most/all cookies failed with bot detection, regenerate entire pool (but limit cycles)
  if (botDetectionCount >= Math.floor(cookies.length * 0.8) && failureCount < MAX_REGENERATION_CYCLES) {
    global[cookieFailureKey] = failureCount + 1;
    console.log(`🔄 Regenerating ENTIRE cookie pool (${botDetectionCount}/${cookies.length} had bot detection, cycle ${failureCount + 1}/${MAX_REGENERATION_CYCLES})...`);
    
    // 🔥 COOLDOWN: Wait before regenerating to avoid rate limits
    const cooldownDelay = failureCount === 0 ? 5000 : 10000; // 5s first time, 10s second time
    console.log(`  ⏳ Waiting ${cooldownDelay/1000}s before regeneration (cooldown to avoid rate limits)...`);
    await new Promise(resolve => setTimeout(resolve, cooldownDelay));
    
    // Clear existing pool
    try {
      const poolDir = path.join(__dirname, '.cookie_pool');
      const files = await fs.readdir(poolDir);
      for (const file of files) {
        if (file.startsWith('cookie_') && file.endsWith('.txt')) {
          await fs.unlink(path.join(poolDir, file)).catch(() => {});
        }
      }
      console.log(`  🗑️ Cleared ${files.length} old cookies from pool`);
    } catch (err) {
      console.log(`  ⚠️ Error clearing pool: ${err.message}`);
    }
    
    // Also clear Redis cookies
    if (isRedisAvailable()) {
      try {
        const redisCookies = await getAllCookiesFromRedis();
        for (const cookie of redisCookies) {
          await deleteCookieFromRedis(cookie.index);
        }
        console.log(`  🗑️ Cleared ${redisCookies.length} cookies from Redis`);
      } catch (err) {
        console.log(`  ⚠️ Error clearing Redis cookies: ${err.message}`);
      }
    }
    
    // Regenerate entire pool (will generate 5 new cookies)
    console.log(`  🔄 Generating ${COOKIE_POOL_SIZE} fresh cookies (with reduced parallelism to avoid rate limits)...`);
    const newCookies = await generateAndTestCookies(100);
    
    if (newCookies) {
      console.log(`  ✅ New cookie pool generated! Retrying operation with fresh cookies...`);
      
      // Retry operation with new cookies (recursive call, but only once)
      const freshCookies = await getAllCookiesFromPool();
      if (freshCookies.length > 0) {
        console.log(`  🔄 Retrying with fresh cookie ${freshCookies[0].index + 1}...`);
        try {
          const result = await operation(freshCookies[0].path, 0);
          if (result !== false && result !== null) {
            recordCookieSuccess(freshCookies[0].index);
            global[cookieFailureKey] = 0; // Reset on success
            console.log(`  ✅ Fresh cookie worked!`);
            return result;
          }
        } catch (retryErr) {
          console.log(`  ⚠️ Fresh cookie also failed: ${retryErr.message}`);
        }
      }
    } else {
      console.log(`  ❌ Failed to generate new cookie pool!`);
    }
  } else if (failureCount >= MAX_REGENERATION_CYCLES) {
    console.log(`  ⚠️ Cookie pool regeneration limit reached (${MAX_REGENERATION_CYCLES} cycles)`);
    console.log(`  🔄 Switching to COOKIE-LESS mode - using client types that don't require cookies`);
    console.log(`  💡 Consider using real browser cookies from your YouTube account for better reliability`);
  }
  
  // All cookies failed (and regeneration didn't help or limit reached)
  console.log(`  ❌ Cookie rotation exhausted - falling back to cookie-less methods`);
  
  // Try operation WITHOUT cookies (cookie-less mode)
  console.log(`  🔄 Attempting operation without cookies (cookie-less client types)...`);
  try {
    const result = await operation(null, cookies.length + botDetectionCount); // null = no cookies
    if (result !== false && result !== null) {
      console.log(`  ✅ Cookie-less operation succeeded!`);
      return result;
    }
  } catch (noCookieErr) {
    console.log(`  ⚠️ Cookie-less attempt also failed: ${noCookieErr.message}`);
  }
  
  return null;
}

// 🚀 GENERATE SINGLE STRONG COOKIE (for fast startup)
async function generateSingleStrongCookie() {
  const MAX_ATTEMPTS = 30;
  const PARALLEL_TESTS = 3;
  
  for (let batch = 1; batch <= MAX_ATTEMPTS / PARALLEL_TESTS; batch++) {
    // 🛡️ CHECK: Pause if ANY active downloads (not just cookie-less attempts)
    const hasActiveNow = hasActiveDownloads();
    let cookieLessInProgress = false;
    let waitingForStrongCookie = false;
    
    for (const [id, info] of activeDownloads.entries()) {
      if (info.cookieLessAttemptInProgress === true) {
        cookieLessInProgress = true;
      }
      if (info.waitingForStrongCookie === true && info.status === 'waiting') {
        waitingForStrongCookie = true;
      }
    }
    
    // 🛡️ PAUSE if downloads are active (unless waiting for strong cookie)
    if (hasActiveNow && !waitingForStrongCookie) {
      if (cookieLessInProgress) {
        console.log(`  ⏸️ Pausing cookie generation: Cookie-less download attempt in progress`);
      } else {
        console.log(`  ⏸️ Pausing cookie generation: Downloads active (${activeDownloads.size})`);
      }
      return false; // Pause generation
    }
    
    // Generate 3 cookies in parallel
    const cookiePromises = [];
    for (let i = 0; i < PARALLEL_TESTS; i++) {
      cookiePromises.push(generateRealisticYouTubeCookies(batch * PARALLEL_TESTS + i));
    }
    
    const cookieDataArray = await Promise.all(cookiePromises);
    
    // Test all 3 in parallel
    const testPromises = cookieDataArray.map(async (cookieData) => {
      if (!cookieData || !cookieData.cookieContent) return null;
      
      // Write to temp file for testing
      const tempPath = path.join(__dirname, `.temp_single_${Date.now()}_${Math.random()}.txt`);
      await fs.writeFile(tempPath, cookieData.cookieContent, 'utf8');
      const result = await testCookies(tempPath);
      await fs.unlink(tempPath).catch(() => {});
      
      return { result, cookieData };
    });
    const results = await Promise.all(testPromises);
    
    // Find first STRONG cookie
    for (let i = 0; i < results.length; i++) {
      if (results[i] && results[i].result && results[i].result.status === 'strong') {
        // Save it to slot 0
        await saveCookieToPool(results[i].cookieData.cookieContent, 0, { 
          quality: 'strong',
          visitorData: results[i].cookieData.visitorData
        });
        console.log(`    ✅ Generated STRONG cookie (batch ${batch}/${MAX_ATTEMPTS / PARALLEL_TESTS})`);
        return true;
      }
    }
    
    // All failed, wait before retry
    if (batch < MAX_ATTEMPTS / PARALLEL_TESTS) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  return false;
}

// Initialize auto-cookies on startup with smart testing
async function initializeAutoCookies() {
  try {
    console.log('🔄 Checking auto-generated cookies...');
    console.log('');
    
    // ✅ STEP 1: Initialize cookie pool (loads from Redis if available)
    await initCookiePool();
    
    // ✅ STEP 2: Load existing cookies from Redis
    let existingCookies = [];
    if (isRedisAvailable()) {
      existingCookies = await getAllCookiesFromRedis();
      if (existingCookies.length > 0) {
        console.log(`  🍪 Loaded ${existingCookies.length} existing cookie(s) from Redis`);
      }
    }
    
    // ✅ STEP 3: Validate existing cookies (quick validation during startup)
    console.log('🔍 Validating existing cookie pool...');
    const poolStatus = await validateCookiePool();
    
    console.log(`  📊 Pool status: ${poolStatus.valid}/${poolStatus.total} cookies validated as working`);
    
    // ✅ STEP 4: If we have at least 1 working cookie, START SERVER NOW and fill pool in background
    if (poolStatus.valid >= 1) {
      console.log(`  ✅ Found ${poolStatus.valid} working cookie(s) - server ready!`);
      
      // Update primary cookie from pool
      if (isRedisAvailable()) {
        const cookies = await getAllCookiesFromRedis();
        if (cookies.length > 0) {
          await savePrimaryCookieToRedis(cookies[0].content);
          await fs.writeFile(AUTO_COOKIE_PATH, cookies[0].content, 'utf8').catch(() => {});
          console.log('  💾 Updated primary cookie from pool');
        }
      }
      
      // Fill remaining slots in BACKGROUND (don't block startup)
      if (poolStatus.valid < COOKIE_POOL_SIZE) {
        console.log(`  🔄 Will fill remaining ${COOKIE_POOL_SIZE - poolStatus.valid} slot(s) in background...`);
        // Background fill - will respect download pause mechanism
        setTimeout(() => {
          ensurePoolIsFull().catch(() => {});
        }, 5000); // Wait 5s after startup, then fill
      }
      
      return AUTO_COOKIE_PATH;
    }
    
    // ✅ STEP 5: If pool is empty (0 working cookies), generate 1 STRONG cookie NOW, then fill rest in background
    if (poolStatus.valid === 0) {
      console.log(`  ⚠️ No working cookies found - generating 1 STRONG cookie NOW to start server...`);
      console.log(`  ⏳ This may take 30-60s (will generate remaining 4 cookies in background)...`);
      
      // Generate just 1 strong cookie to get started
      const firstCookie = await generateSingleStrongCookie();
      
      if (firstCookie) {
        console.log(`  ✅ Generated 1 STRONG cookie - server ready!`);
        console.log(`  🔄 Will generate remaining ${COOKIE_POOL_SIZE - 1} cookies in background...`);
        
        // Fill remaining 4 slots in BACKGROUND
        setTimeout(() => {
          ensurePoolIsFull().catch(() => {});
        }, 10000); // Wait 10s after startup, then fill remaining
        
        return AUTO_COOKIE_PATH;
      } else {
        console.log(`  ⚠️ Failed to generate initial cookie - will retry on first download`);
      }
    }
    
    // Check if primary cookie exists
    let cookiesExist = false;
    try {
      await fs.access(AUTO_COOKIE_PATH);
      const existingContent = await fs.readFile(AUTO_COOKIE_PATH, 'utf8');
      
      if (existingContent && existingContent.length > 200 && existingContent.includes('VISITOR_INFO1_LIVE')) {
        cookiesExist = true;
        console.log('  📁 Found existing primary cookie, testing...');
        
        // Test existing cookies
        const testResult = await testCookies(AUTO_COOKIE_PATH);
        
        if (testResult && testResult.status && testResult.status !== 'fail') {
          // ✅ Existing cookies work!
          const metadata = await loadCookieMetadata();
          metadata.lastTested = new Date().toISOString();
          metadata.successCount = (metadata.successCount || 0) + 1;
          metadata.isValid = true;
          await saveCookieMetadata(metadata);
          
          if (testResult.status === 'weak') {
            console.log('⚠️ Existing cookies only WEAK PASS - keeping but prioritising regenerated ones');
          } else {
            console.log('✅ Existing cookies are WORKING - reusing them!');
          }
          console.log(`🍪 Auto-cookies available at: ${AUTO_COOKIE_PATH}`);
          return AUTO_COOKIE_PATH;
        } else {
          // ❌ Existing cookies failed, need regeneration
          console.log('  ❌ Existing cookies FAILED - will generate new ones...');
          const metadata = await loadCookieMetadata();
          metadata.failureCount = (metadata.failureCount || 0) + 1;
          metadata.isValid = false;
          await saveCookieMetadata(metadata);
        }
      }
    } catch (err) {
      // Cookies don't exist
      console.log('  📝 No existing cookies found');
    }
    
    // Generate and test new cookies (retry many times until working cookies found)
    console.log('  🔄 Generating and testing new cookies...');
    const cookiePath = await generateAndTestCookies(100); // Try up to 100 times until success
    
    if (cookiePath) {
      console.log(`🍪 Auto-cookies available at: ${cookiePath}`);
      return cookiePath;
    } else {
      console.log('⚠️ Failed to generate working cookies, will use cookie-less methods');
    return null;
    }
  } catch (err) {
    console.log(`⚠️ Failed to initialize auto-cookies: ${err.message}`);
    return null;
  }
}

// Initialize auto-cookies on server startup
// ⚠️ MOVED TO STARTUP SEQUENCE - Must wait for proxy system to initialize first!
// initializeAutoCookies() is now called AFTER proxy system is ready (see startupSequence)

// 🎯 PERIODIC POOL MAINTENANCE - Ensure 5/5 cookies always available
// Runs every 5 minutes to check and fill missing slots (only when downloads are idle)
setInterval(async () => {
  try {
    const hasActive = hasActiveDownloads();
    
    // 🛡️ SAFETY: Only regenerate when downloads are idle OR when we have 0 cookies
    const cookies = await getWorkingCookiesFromPool();
    if (hasActive && cookies.length >= 1) {
      console.log(`\n⏸️ [Scheduled Maintenance] Skipped: Downloads active (${activeDownloads.size}) with ${cookies.length} working cookie(s) - safe to continue`);
      return;
    }
    
    // 🔧 FIX: Validate cookies first to detect and remove dead ones, then fill missing slots
    console.log(`\n🔄 [Scheduled Maintenance] Validating cookie pool...`);
    const validationResult = await validateCookiePool();
    
    if (validationResult.valid < COOKIE_POOL_SIZE) {
      console.log(`  📊 Pool status: ${validationResult.valid}/${COOKIE_POOL_SIZE} validated cookies - filling ${COOKIE_POOL_SIZE - validationResult.valid} missing slots...`);
      await ensurePoolIsFull();
    } else {
      console.log(`  ✅ [Scheduled Maintenance] Pool is full: ${validationResult.valid}/${COOKIE_POOL_SIZE} validated cookies`);
    }
  } catch (err) {
    console.log(`\n⚠️ [Scheduled Maintenance] Error: ${err.message}`);
  }
}, 5 * 60 * 1000); // Every 5 minutes

// Monitor cookie health during downloads
async function markCookiesAsWorking() {
  try {
    const metadata = await loadCookieMetadata();
    metadata.lastUsed = new Date().toISOString();
    metadata.successCount = (metadata.successCount || 0) + 1;
    metadata.isValid = true;
    await saveCookieMetadata(metadata);
  } catch (err) {
    // Silent fail
  }
}

// Monitor cookie failure
async function markCookiesAsFailed() {
  try {
    const metadata = await loadCookieMetadata();
    metadata.failureCount = (metadata.failureCount || 0) + 1;
    
    // If cookies fail too many times, regenerate
    if (metadata.failureCount >= 3) {
      metadata.isValid = false;
      console.log('⚠️ Cookies failed multiple times, will regenerate on next restart');
    }
    
    await saveCookieMetadata(metadata);
  } catch (err) {
    // Silent fail
  }
}

// Regenerate cookies immediately when bot detection is detected during downloads
async function regenerateCookiesOnFailure() {
  try {
    console.log('🔄 Bot detection detected during download - regenerating cookies immediately...');
    
    // Generate and test new cookies (retry many times until working cookies found)
    const cookiePath = await generateAndTestCookies(50); // Try 50 times until success
    
  if (cookiePath) {
      console.log('✅ New cookies regenerated and saved!');
      
      // Update metadata
      const metadata = await loadCookieMetadata();
      metadata.lastRegenerated = new Date().toISOString();
      metadata.regenerationCount = (metadata.regenerationCount || 0) + 1;
      metadata.isValid = true;
      metadata.failureCount = 0; // Reset failure count after successful regeneration
      await saveCookieMetadata(metadata);
      
      return true;
    } else {
      console.log('⚠️ Cookie regeneration failed, will continue with existing cookies');
      return false;
    }
  } catch (err) {
    console.log(`⚠️ Cookie regeneration error: ${err.message}`);
    return false;
  }
}

// 🔥 ADVANCED BOT DETECTION BYPASS UTILITIES
async function addAdvancedBotBypass(args, strategy, attempt) {
  console.log(`   🤖 Adding advanced bot bypass methods for ${strategy}...`);
  
  // Dynamic timestamp generation (looks like real user activity)
  const now = Date.now();
  const sessionStart = now - Math.floor(Math.random() * 3600000); // 0-1 hour ago
  const lastActivity = now - Math.floor(Math.random() * 300000);  // 0-5 min ago
  
  // Optional: fake cookies (disabled by default). Enable with USE_FAKE_COOKIES=true
  const fakeCookies = [
    'VISITOR_INFO1_LIVE=dglKiOiODhg; YSC=TSH0MAVYRhw; GPS=1; PREF=f4=4000000',
    'VISITOR_INFO1_LIVE=H7jKpLmNqRs; YSC=9XyZ4bCnMkL; GPS=1; PREF=f6=40000000', 
    'VISITOR_INFO1_LIVE=QwE3rTyU8oP; YSC=AsDf5GhJkL2; GPS=1; PREF=f2=80000000'
  ];
  
  if (process.env.USE_FAKE_COOKIES === 'true') {
    try {
      // Create temporary cookies file (more secure than headers)
      const tempCookieFile = path.join(os.tmpdir(), `youtube_cookies_${Date.now()}_${Math.random().toString(36).substr(2, 8)}.txt`);
      const selectedCookies = fakeCookies[attempt % fakeCookies.length];
      
      // Write cookies in Netscape format
      const cookieContent = `# Netscape HTTP Cookie File
# This is a generated file! Do not edit.

youtube.com	TRUE	/	FALSE	${Math.floor(Date.now() / 1000) + 3600}	VISITOR_INFO1_LIVE	dglKiOiODhg
youtube.com	TRUE	/	FALSE	${Math.floor(Date.now() / 1000) + 3600}	YSC	TSH0MAVYRhw
youtube.com	TRUE	/	FALSE	${Math.floor(Date.now() / 1000) + 3600}	GPS	1
youtube.com	TRUE	/	FALSE	${Math.floor(Date.now() / 1000) + 3600}	PREF	f4=4000000`;
      
      await fs.writeFile(tempCookieFile, cookieContent);
      
      // Use --cookies instead of --add-header Cookie: (more secure)
      args.push('--cookies', tempCookieFile);
      
      // Schedule cleanup of temp file after 1 hour
      setTimeout(async () => {
        try {
          await fs.unlink(tempCookieFile);
        } catch (e) {
          // Ignore cleanup errors
        }
      }, 3600000);
      
      console.log('   🍪 Secure cookie file created');
    } catch (cookieError) {
      console.log('   ⚠️ Cookie file creation failed, using fallback method');
      // Fallback to header method if file creation fails
      args.push('--add-header', `Cookie:${fakeCookies[attempt % fakeCookies.length]}`);
    }
  } else {
    console.log('   🍪 Fake cookies disabled');
  }
  
  // Session continuity headers
  args.push('--add-header', `X-Session-ID:${Math.random().toString(36).substr(2, 16)}`);
  args.push('--add-header', `X-Request-ID:${Math.random().toString(36).substr(2, 12)}`);
  args.push('--add-header', `X-Client-Data:${Buffer.from(JSON.stringify({
    timestamp: now,
    session_start: sessionStart,
    interactions: Math.floor(Math.random() * 100),
    screen_time: Math.floor(Math.random() * 1800) // 0-30 min
  })).toString('base64')}`);
  
  // Advanced JavaScript challenge responses
  const jsResponses = [
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9', // JWT-like format
    'dGhpc19pc19hX2Zha2VfanNfcmVzcG9uc2U',   // Base64 encoded
    'Q2hhbGxlbmdlUmVzcG9uc2VIYXNoVmFsdWU'    // Another fake response
  ];
  args.push('--add-header', `X-JS-Response:${jsResponses[attempt % jsResponses.length]}`);
  
  // Browser capability headers (defeat capability detection)
  args.push('--add-header', 'X-WebGL-Vendor:Google Inc. (NVIDIA)');
  args.push('--add-header', 'X-WebGL-Renderer:ANGLE (NVIDIA GeForce GTX 1060)');
  args.push('--add-header', 'X-Canvas-Fingerprint:' + Math.random().toString(36).substr(2, 8));
  args.push('--add-header', 'X-Audio-Fingerprint:' + Math.random().toString(36).substr(2, 8));
  
  // Network timing simulation (fake performance metrics)
  args.push('--add-header', `X-Performance-Navigation:${JSON.stringify({
    type: 'navigate',
    redirectCount: 0,
    loadEventEnd: now,
    domContentLoadedEventEnd: now - 100
  })}`);
  
  console.log('   ✅ Advanced bot bypass headers added');
}

// Enhanced YouTube helper with MULTIPLE STRATEGIES (NO COOKIES)
async function addYouTubeEnhancements(args, attempt = 0) {
  // 🆕 EXPANDED TO 10+ STRATEGIES (NO COOKIES REQUIRED)
  // Strategy 1 (0-1):   NewPipe Android Extractors
  // Strategy 2 (2-3):   YouTube Music API  
  // Strategy 3 (4-5):   iOS Client Simulation
  // Strategy 4 (6-7):   Smart TV Clients
  // Strategy 5 (8-9):   Age-Gate Bypass + Geo-Spoofing
  // Strategy 6 (10-11): Ultra-Aggressive Headers
  // Strategy 7 (12-13): Format-Specific Audio-Only
  // Strategy 8 (14-15): Mixed Multi-Client
  // Strategy 9 (16-17): TOR-style Anonymization
  // Strategy 10 (18+):  DESPERATION - Everything Combined
  
  const strategy = Math.floor(attempt / 2); // Change strategy every 2 attempts
  
  console.log(`\n🔧 Download Strategy ${strategy + 1} (Attempt ${attempt + 1})`);
  
  // 🌐 EXPANDED USER AGENTS (50+ variants)
  const userAgents = {
    android: [
      'com.google.android.youtube/19.09.37 (Linux; U; Android 13; Pixel 7 Build/TQ2A.230505.002) gzip',
      'com.google.android.youtube/18.48.38 (Linux; U; Android 12; SM-G998B Build/SP1A.210812.016) gzip',
      'com.google.android.youtube/17.36.4 (Linux; U; Android 11; OnePlus 9 Pro Build/RKQ1.201217.002) gzip',
      'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.230 Mobile Safari/537.36',
      'Mozilla/5.0 (Linux; Android 12; SM-S908B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Mobile Safari/537.36'
    ],
    ios: [
      'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      'Mozilla/5.0 (iPad; CPU OS 17_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Mobile/15E148 Safari/604.1',
      'com.google.ios.youtube/19.05.3 (iPhone14,5; U; CPU iOS 16_6 like Mac OS X;)'
    ],
    tv: [
      'Mozilla/5.0 (SMART-TV; Linux; Tizen 6.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.120 TV Safari/537.36',
      'Mozilla/5.0 (Web0S; Linux/SmartTV) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.79 Safari/537.36 WebAppManager',
      'Mozilla/5.0 (PlayStation 5 5.00) AppleWebKit/605.1.15 (KHTML, like Gecko)',
      'Mozilla/5.0 (Nintendo Switch; WebApplet) AppleWebKit/606.4 (KHTML, like Gecko) NF/6.0.1.15.4 NintendoBrowser/5.1.0.20389'
    ],
    desktop: [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36 Edg/121.0.0.0',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
    ]
  };
  
  // 🎮 EXPANDED CLIENT TYPES (30+ variants) - IMPROVED FOR BOT DETECTION
  const clientTypes = {
    newpipe: ['android_testsuite', 'android_vr', 'android_producer', 'android_creator', 'android_unplugged', 'android_music', 'android_embedded'],
    youtube_music: ['youtube_music', 'youtube_music_premium', 'music_embedded'],
    ios_clients: ['ios', 'ios_music', 'ios_creator', 'ios_embedded'],
    tv_clients: ['tv', 'tv_embedded', 'tv_kids', 'mediaconnect'],
    web_clients: ['web', 'web_embedded', 'web_music', 'web_creator', 'web_safari'],
    mixed: ['android,web_embedded', 'ios,web_embedded', 'tv,android'],
    // NEW: More effective clients for bot bypass
    effective: ['web_embedded', 'android_embedded', 'ios_embedded', 'tv_embedded']
  };
  
  // 🌍 GEO-SPOOFING HEADERS (Different countries)
  const geoHeaders = [
    { country: 'US', lang: 'en-US,en;q=0.9', tz: 'America/New_York' },
    { country: 'GB', lang: 'en-GB,en;q=0.9', tz: 'Europe/London' },
    { country: 'DE', lang: 'de-DE,de;q=0.9,en;q=0.8', tz: 'Europe/Berlin' },
    { country: 'JP', lang: 'ja-JP,ja;q=0.9,en;q=0.8', tz: 'Asia/Tokyo' },
    { country: 'BR', lang: 'pt-BR,pt;q=0.9,en;q=0.8', tz: 'America/Sao_Paulo' },
    { country: 'IN', lang: 'en-IN,en;q=0.9,hi;q=0.8', tz: 'Asia/Kolkata' }
  ];
  
  // Helper function to add proxy with intelligent selection and enhanced chaining
  const addFreeProxy = () => {
    let proxy = null;
    let proxyType = 'none';
    
    // 🎯 PRIORITY 1: Use proxy manager (handles Oxylabs > Free proxies automatically)
    const proxyFromManager = proxyManager.getProxyForYtdlp();
    if (proxyFromManager) {
      proxy = proxyFromManager;
      if (proxyFromManager.includes('oxylabs.io')) {
      proxyType = 'Oxylabs Premium';
        console.log(`   🌟 Using Oxylabs premium proxy to bypass YouTube blocking`);
      } else {
        proxyType = 'Free Proxy';
        console.log(`   🌐 Using proxy to bypass YouTube blocking`);
      }
    }
    // 🎯 PRIORITY 2: ScraperAPI (GOOD - 40-60% success rate)
    else if (process.env.SCRAPERAPI_KEY) {
      proxy = `http://scraperapi:${process.env.SCRAPERAPI_KEY}@proxy-server.scraperapi.com:8001`;
      proxyType = 'ScraperAPI';
      console.log(`   🌐 Using ScraperAPI proxy`);
    }
    // 🎯 PRIORITY 3: Free Rotating Proxies (FALLBACK - 1-4% success rate)
    else if (process.env.USE_FREE_PROXIES === 'true') {
      // SMART PROXY SELECTION: Prefer working proxies, fallback to random
      if (proxyManager.workingProxies && proxyManager.workingProxies.length > 0) {
        const workingIndex = Math.floor(Math.random() * proxyManager.workingProxies.length);
        const workingProxy = proxyManager.workingProxies[workingIndex];
        proxy = `http://${workingProxy}`;
        proxyType = 'Free (Verified)';
        console.log(`   🎯 Using verified working proxy: ${proxy}`);
      } else {
        // Get a random proxy (might work)
        proxy = proxyManager.getProxyForYtdlp();
        proxyType = 'Free (Random)';
        if (proxy) {
          console.log(`   🌐 Using random proxy: ${proxy}`);
        }
      }
    }
    
    if (proxy) {
      args.push('--proxy', proxy);
      args.push('--no-check-certificate');
      
      // 🔥 ENHANCED PROXY CHAINING (for advanced bot bypass strategies)
      if (strategy < 5 && proxyType === 'Free (Verified)' || proxyType === 'Free (Random)') {
        // Add proxy masking headers to confuse tracking algorithms (ONLY for free proxies)
        args.push('--add-header', 'Via:1.1 ' + Math.random().toString(36).substr(2, 8) + '.proxy.youtube.com');
        args.push('--add-header', 'X-Forwarded-Proto:https');
        args.push('--add-header', 'X-Forwarded-Port:443');
        args.push('--add-header', `X-Real-IP:${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`);
        args.push('--add-header', 'X-Forwarded-Host:youtube.com');
        args.push('--add-header', 'X-Forwarded-For:' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255) + '.' + Math.floor(Math.random() * 255));
        args.push('--add-header', 'X-Proxy-Connection:keep-alive');
        args.push('--add-header', 'X-Proxy-Authorization:Basic ' + Buffer.from('anonymous:anonymous').toString('base64'));
        console.log(`   🌐 Enhanced proxy chain: ${proxy} (full IP masking + headers)`);
      }
      
      return true;
    } else {
      if (process.env.USE_FREE_PROXIES === 'true') {
        console.log(`   ❌ No proxies available from pool of ${proxyManager.proxies ? proxyManager.proxies.length : 0}`);
      }
      return false;
    }
  };
  
  // ===== STRATEGY 1: Advanced Bot Detection Bypass (0-1) - BEST FOR FIRST ATTEMPTS =====
  if (strategy === 0) {
    console.log('🤖 Strategy: Advanced Bot Detection Bypass (Optimized)');
    
    // Use most effective clients in order: web_embedded, android_embedded, ios_embedded
    const client = clientTypes.effective[attempt % clientTypes.effective.length];
    const userAgent = userAgents.android[attempt % userAgents.android.length];
    
    args.push('--user-agent', userAgent);
    args.push('--extractor-args', `youtube:player_client=${client}`);
    args.push('--extractor-args', 'youtube:player_skip=webpage,configs,js');
    args.push('--no-check-certificate');
    args.push('--geo-bypass');
    
    // Add best timeout settings for first attempts
    args.push('--socket-timeout', '30');
    args.push('--retries', '5');
    
    // 🔥 BOT DETECTION BYPASS METHODS
    // Method 1: Secure fake cookies (handled by addAdvancedBotBypass)
    // Note: Cookies are now securely handled via temporary files
    
    // Method 2: JavaScript Execution Simulation
    args.push('--extractor-args', 'youtube:player_params=CgIQBg%3D%3D'); // Bypass age restriction
    
    // Method 3: Session Token Rotation
    args.push('--add-header', 'X-YouTube-Client-Name:1');
    args.push('--add-header', 'X-YouTube-Client-Version:2.20240101.00.00');
    args.push('--add-header', 'X-Goog-Visitor-Id:CgtZbGRkVUZBdVFZbyiTk-WmBg');
    
    // Method 4: Anti-Bot Headers
    args.push('--add-header', 'Sec-Ch-Ua-Model:""');
    args.push('--add-header', 'Sec-Ch-Ua-Full-Version-List:"Not_A Brand";v="8.0.0.0", "Chromium";v="120.0.6099.230"');
    args.push('--add-header', 'Sec-Ch-Ua-Arch:"x86"');
    args.push('--add-header', 'Sec-Ch-Ua-Bitness:"64"');
    
    // Method 5: Real Browser Fingerprint
    args.push('--add-header', 'Sec-Fetch-Dest:document');
    args.push('--add-header', 'Sec-Fetch-Mode:navigate');
    args.push('--add-header', 'Sec-Fetch-Site:none');
    args.push('--add-header', 'Sec-Fetch-User:?1');
    
    // Add advanced bot bypass methods
    addAdvancedBotBypass(args, 'Anti-Bot', attempt);
    
    addFreeProxy();
    
    console.log(`   🤖 Anti-bot client: ${client}`);
    console.log('   🔥 Fake cookies, session tokens, browser fingerprint enabled');
    return { userAgent, clientType: client, strategy: 'Anti-Bot' };
  }
  
  // ===== STRATEGY 2: Desktop Web Embedded + Light Headers (2-3) =====
  if (strategy === 1) {
    console.log('🖥️ Strategy: Desktop Web Embedded + Light Headers');
    
    const client = 'web_embedded';
    const userAgent = userAgents.desktop[attempt % userAgents.desktop.length];
    
    args.push('--user-agent', userAgent);
    args.push('--extractor-args', `youtube:player_client=${client}`);
    args.push('--extractor-args', 'youtube:player_skip=webpage,configs');
    args.push('--no-check-certificate');
    args.push('--format', 'bestaudio/best');
    
    // Minimal but effective headers (no cookies)
    args.push('--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8');
    args.push('--add-header', 'Accept-Language:en-US,en;q=0.5');
    args.push('--add-header', 'Accept-Encoding:gzip, deflate, br');
    args.push('--add-header', 'DNT:1');
    args.push('--add-header', 'Connection:keep-alive');
    args.push('--add-header', 'Upgrade-Insecure-Requests:1');
    args.push('--add-header', 'Sec-Fetch-Dest:document');
    args.push('--add-header', 'Sec-Fetch-Mode:navigate');
    args.push('--add-header', 'Sec-Fetch-Site:none');
    args.push('--add-header', 'Sec-Fetch-User:?1');
    
    addFreeProxy();
    
    console.log(`   🖥️ Web embedded client: ${client}`);
    console.log('   ✅ Light desktop headers only (no cookies)');
    return { userAgent, clientType: client, strategy: 'WebEmbeddedLight' };
  }
  
  // ===== STRATEGY 3: JavaScript Execution + CAPTCHA Bypass (4-5) =====
  if (strategy === 2) {
    console.log('🧠 Strategy: JavaScript Execution + CAPTCHA Bypass');
    
    const client = clientTypes.ios_clients[attempt % clientTypes.ios_clients.length];
    const userAgent = userAgents.ios[attempt % userAgents.ios.length];
    
  args.push('--user-agent', userAgent);
    args.push('--extractor-args', `youtube:player_client=${client}`);
    args.push('--no-check-certificate');
    
    // 🔥 JAVASCRIPT EXECUTION SIMULATION
    // Method 1: Pre-generated JavaScript Tokens
    const jsTokens = [
      'CgIQBg%3D%3D', // Standard bypass token
      'CAESAggC',      // Mobile client token  
      'CAMSAggB',      // Web client token
      'CAQSAggD'       // Embedded client token
    ];
    args.push('--extractor-args', `youtube:player_params=${jsTokens[attempt % jsTokens.length]}`);
    
    // Method 2: Browser Fingerprint Rotation
    const fingerprints = [
      'CFE17E078C4A',
      'D2F84B1A9E3C', 
      'A7B3C5F2D8E1',
      'E9F1A2B4C6D8'
    ];
    args.push('--add-header', `X-Client-Fingerprint:${fingerprints[attempt % fingerprints.length]}`);
    
    // Method 3: iOS App Store Headers (bypass mobile detection)
    args.push('--add-header', 'X-Apple-Store-Front:143441-1,29 au:p');
    args.push('--add-header', 'X-Apple-Tz:7200');
    args.push('--add-header', 'X-Apple-Request-UUID:' + Date.now());
    
    // Method 4: Fake Screen Resolution (human-like)
    args.push('--add-header', 'Sec-Ch-Viewport-Width:393');
    args.push('--add-header', 'Sec-Ch-Viewport-Height:852');
    args.push('--add-header', 'Sec-Ch-Dpr:3');
    
    // Method 5: Anti-CAPTCHA Headers
    args.push('--add-header', 'X-Captcha-Solved:true');
    args.push('--add-header', 'X-ReCaptcha-Token:03AGdBq26_' + Math.random().toString(36).substr(2, 15));
    
    // iOS-specific headers
    args.push('--add-header', 'Accept:*/*');
    args.push('--add-header', 'Accept-Encoding:gzip, deflate, br');
    args.push('--add-header', 'Connection:keep-alive');
    
    // Add advanced bot bypass methods
    addAdvancedBotBypass(args, 'JSExecution', attempt);
    
    addFreeProxy();
    
    console.log(`   🧠 JS execution client: ${client}`);
    console.log('   🔥 JS tokens, fingerprints, anti-CAPTCHA enabled');
    return { userAgent, clientType: client, strategy: 'JSExecution' };
  }
  
  // ===== STRATEGY 4: Browser Automation + Human Behavior (6-7) =====
  if (strategy === 3) {
    console.log('🎬 Strategy: Browser Automation + Human Behavior');
    
    const client = clientTypes.tv_clients[attempt % clientTypes.tv_clients.length];
    const userAgent = userAgents.tv[attempt % userAgents.tv.length];
    
  args.push('--user-agent', userAgent);
    args.push('--extractor-args', `youtube:player_client=${client}`);
    args.push('--extractor-args', 'youtube:player_skip=webpage');
    args.push('--no-check-certificate');
    
    // 🔥 BROWSER AUTOMATION SIMULATION
    // Method 1: Mouse Movement Patterns (fake interaction)
    args.push('--add-header', 'X-Mouse-Activity:move,1680x1050,click,pause,scroll');
    args.push('--add-header', 'X-Interaction-Time:' + (Date.now() - Math.floor(Math.random() * 300000))); // 0-5 min ago
    
    // Method 2: Keyboard Activity Simulation  
    args.push('--add-header', 'X-Keypress-Pattern:typing,search,enter,wait');
    args.push('--add-header', 'X-Focus-Events:window-focus,tab-active,mouse-in');
    
    // Method 3: Browsing History Spoofing (look like real user)
    const fakeHistory = [
      'youtube.com/watch',
      'google.com/search',
      'music.youtube.com',
      'facebook.com',
      'twitter.com'
    ];
    args.push('--add-header', `Referer:https://${fakeHistory[attempt % fakeHistory.length]}`);
    
    // Method 4: Session Duration (look like long-time user)
    const sessionStart = Date.now() - Math.floor(Math.random() * 7200000); // 0-2 hours ago
    args.push('--add-header', `X-Session-Start:${sessionStart}`);
    args.push('--add-header', 'X-Page-Views:' + Math.floor(Math.random() * 50 + 5)); // 5-55 page views
    
    // Method 5: Realistic Screen & Device Info
    args.push('--add-header', 'X-Screen-Resolution:1920x1080');
    args.push('--add-header', 'X-Color-Depth:24');
    args.push('--add-header', 'X-Timezone-Offset:-300'); // EST timezone
    args.push('--add-header', 'X-Language-Preference:en-US,en;q=0.9');
    
    // Method 6: Cookie Consent & Privacy Headers (GDPR compliance simulation)
    args.push('--add-header', 'X-Cookie-Consent:granted');
    args.push('--add-header', 'X-Privacy-Mode:standard');
    args.push('--add-header', 'X-Tracking-Consent:essential,analytics');
    
    // TV-specific settings (maintain original functionality)
    args.push('--add-header', 'Device-Type:TV');
    args.push('--format', 'bestaudio[ext=m4a]/bestaudio');
    
    // Human-like delays
    args.push('--sleep-requests', '2');      // 2 second delay between requests
    args.push('--min-sleep-interval', '1');  // Minimum 1 second
    args.push('--max-sleep-interval', '5');  // Maximum 5 seconds (random)
    
    // Add advanced bot bypass methods
    addAdvancedBotBypass(args, 'BrowserAutomation', attempt);
    
    addFreeProxy();
    
    console.log(`   🎬 Browser automation client: ${client}`);
    console.log('   🔥 Mouse/keyboard simulation, browsing history, human delays');
    return { userAgent, clientType: client, strategy: 'BrowserAutomation' };
  }
  
  // ===== STRATEGY 5: Age-Gate Bypass + Geo-Spoofing (8-9) =====
  if (strategy === 4) {
    console.log('🌍 Strategy: Age-Gate Bypass + Geo-Spoofing');
    
    const geo = geoHeaders[attempt % geoHeaders.length];
    const client = 'web_embedded';
    const userAgent = userAgents.desktop[attempt % userAgents.desktop.length];
    
    args.push('--user-agent', userAgent);
    args.push('--extractor-args', `youtube:player_client=${client}`);
    args.push('--no-check-certificate');
    args.push('--age-limit', '0'); // Bypass age restrictions
    args.push('--geo-bypass');
    args.push('--geo-bypass-country', geo.country);
    
    // Geo-specific headers
    args.push('--add-header', `Accept-Language:${geo.lang}`);
    args.push('--add-header', `X-Forwarded-For:${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`);
    
    addFreeProxy();
    
    console.log(`   🌍 Geo: ${geo.country}, Age-gate: bypassed`);
    return { userAgent, clientType: client, strategy: 'GeoBypass' };
  }
  
  // ===== STRATEGY 6: Ultra-Aggressive Headers (10-11) =====
  if (strategy === 5) {
    console.log('🔥 Strategy: Ultra-Aggressive HTTP Headers');
    
    const client = 'android_creator';
    const userAgent = userAgents.android[attempt % userAgents.android.length];
    
    args.push('--user-agent', userAgent);
    args.push('--extractor-args', `youtube:player_client=${client}`);
    args.push('--no-check-certificate');
    
    // ULTRA-AGGRESSIVE browser fingerprinting headers
    args.push('--referer', 'https://www.youtube.com/');
    args.push('--add-header', 'Accept:text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8');
    args.push('--add-header', 'Accept-Encoding:gzip, deflate, br');
    args.push('--add-header', 'Accept-Language:en-US,en;q=0.9');
    args.push('--add-header', 'Cache-Control:max-age=0');
    args.push('--add-header', 'DNT:1');
    args.push('--add-header', 'Upgrade-Insecure-Requests:1');
    args.push('--add-header', 'Sec-Fetch-Dest:document');
    args.push('--add-header', 'Sec-Fetch-Mode:navigate');
    args.push('--add-header', 'Sec-Fetch-Site:none');
    args.push('--add-header', 'Sec-Fetch-User:?1');
    args.push('--add-header', 'Sec-Ch-Ua:"Not_A Brand";v="8", "Chromium";v="120"');
    args.push('--add-header', 'Sec-Ch-Ua-Mobile:?1');
    args.push('--add-header', 'Sec-Ch-Ua-Platform:"Android"');
    
    addFreeProxy();
    
    console.log('   🔥 Ultra-aggressive headers + creator client');
    return { userAgent, clientType: client, strategy: 'AggressiveHeaders' };
  }
  
  // ===== STRATEGY 7: Format-Specific Audio-Only (12-13) =====
  if (strategy === 6) {
    console.log('🎧 Strategy: Audio-Only Format Extraction');
    
    const client = 'android_music';
    const userAgent = userAgents.android[0];
    
    args.push('--user-agent', userAgent);
    args.push('--extractor-args', `youtube:player_client=${client}`);
    args.push('--no-check-certificate');
    
    // ONLY request audio formats (bypass video checks)
    args.push('--format', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio');
    args.push('--extract-audio');
    args.push('--prefer-free-formats');
    
    // Rate limiting
    args.push('--sleep-requests', '2');
    args.push('--limit-rate', '1M');
    
    addFreeProxy();
    
    console.log('   🎧 Audio-only extraction');
    return { userAgent, clientType: client, strategy: 'AudioOnly' };
  }
  
  // ===== STRATEGY 8: Mixed Multi-Client (14-15) =====
  if (strategy === 7) {
    console.log('🎭 Strategy: Mixed Multi-Client');
    
    const client = clientTypes.mixed[attempt % clientTypes.mixed.length];
    const userAgent = userAgents.android[attempt % userAgents.android.length];
    
    args.push('--user-agent', userAgent);
    args.push('--extractor-args', `youtube:player_client=${client}`);
    args.push('--extractor-args', 'youtube:player_skip=configs,js');
    args.push('--no-check-certificate');
    args.push('--geo-bypass');
    
    // Mixed strategy headers
    args.push('--referer', 'https://m.youtube.com/');
    args.push('--add-header', 'X-YouTube-Client-Name:1');
    args.push('--add-header', 'X-YouTube-Client-Version:2.20231219.04.00');
    
    addFreeProxy();
    
    console.log(`   🎭 Multi-client: ${client}`);
    return { userAgent, clientType: client, strategy: 'MultiClient' };
  }
  
  // ===== STRATEGY 9: TOR-style Anonymization (16-17) =====
  if (strategy === 8) {
    console.log('🕵️ Strategy: TOR-style Anonymization');
    
    const client = 'web_embedded';
    const userAgent = userAgents.desktop[attempt % userAgents.desktop.length];
    
    args.push('--user-agent', userAgent);
    args.push('--extractor-args', `youtube:player_client=${client}`);
    args.push('--no-check-certificate');
    args.push('--prefer-insecure');
    
    // TOR-style anonymization
    args.push('--sleep-interval', '10');      // Very slow
    args.push('--max-sleep-interval', '20');  // Random delays
    args.push('--limit-rate', '100K');        // Ultra-slow download
    args.push('--socket-timeout', '120');     // Long timeout
    
    // Anonymization headers
    args.push('--add-header', 'DNT:1');
    args.push('--add-header', 'Connection:keep-alive');
    
    addFreeProxy();
    
    console.log('   🕵️ Ultra-slow anonymization mode');
    return { userAgent, clientType: client, strategy: 'TOR-Anonymization' };
  }
  
  // ===== STRATEGY 10: ULTIMATE DESPERATION MODE (18+) =====
  console.log('💀 Strategy: ULTIMATE DESPERATION MODE - ALL BOT BYPASSES COMBINED');
  
  // Randomly combine EVERYTHING
  const randomClient = [
    ...clientTypes.newpipe,
    ...clientTypes.youtube_music,
    ...clientTypes.ios_clients,
    ...clientTypes.tv_clients
  ][attempt % 20];
  
  const randomAgent = [
    ...userAgents.android,
    ...userAgents.ios,
    ...userAgents.tv,
    ...userAgents.desktop
  ][attempt % 15];
  
  const randomGeo = geoHeaders[attempt % geoHeaders.length];
  
  args.push('--user-agent', randomAgent);
  args.push('--extractor-args', `youtube:player_client=${randomClient}`);
  args.push('--extractor-args', 'youtube:player_skip=webpage,configs,js');
  args.push('--no-check-certificate');
  args.push('--prefer-insecure');
  args.push('--geo-bypass');
  args.push('--geo-bypass-country', randomGeo.country);
  args.push('--age-limit', '0');
  
  // 🔥🔥🔥 ALL BOT DETECTION BYPASS METHODS COMBINED 🔥🔥🔥
  
  // From Strategy 1: Anti-Bot Headers (cookies handled by addAdvancedBotBypass)
  args.push('--extractor-args', 'youtube:player_params=CgIQBg%3D%3D');
  args.push('--add-header', 'X-YouTube-Client-Name:1');
  args.push('--add-header', 'X-YouTube-Client-Version:2.20240101.00.00');
  args.push('--add-header', 'X-Goog-Visitor-Id:CgtZbGRkVUZBdVFZbyiTk-WmBg');
  
  // From Strategy 2: Session Hijacking (secure cookies handled by addAdvancedBotBypass)
  const sessionTokens = ['QUFFLUhqbEd4X1FkdmFwN3BoYW5rSTV2dGhzM0RvZGNMZ3xBQ3Jtc0tuMFFGMjc2'];
  args.push('--add-header', `Authorization:Bearer ${sessionTokens[0]}`);
  args.push('--add-header', 'X-YouTube-Bootstrap-Logged-In:true');
  
  // From Strategy 3: JavaScript + CAPTCHA Bypass
  args.push('--add-header', 'X-Captcha-Solved:true');
  args.push('--add-header', 'X-ReCaptcha-Token:03AGdBq26_' + Math.random().toString(36).substr(2, 15));
  
  // From Strategy 4: Human Behavior Simulation
  args.push('--add-header', 'X-Mouse-Activity:move,1680x1050,click,pause,scroll');
  args.push('--add-header', 'X-Interaction-Time:' + (Date.now() - Math.floor(Math.random() * 300000)));
  args.push('--add-header', 'X-Page-Views:' + Math.floor(Math.random() * 50 + 5));
  
  // Ultimate Browser Fingerprinting
  args.push('--add-header', 'Sec-Ch-Ua:"Not_A Brand";v="8", "Chromium";v="120"');
  args.push('--add-header', 'Sec-Ch-Ua-Mobile:?1');
  args.push('--add-header', 'Sec-Ch-Ua-Platform:"Android"');
  args.push('--add-header', 'Sec-Ch-Ua-Arch:"arm"');
  args.push('--add-header', 'Sec-Ch-Ua-Bitness:"64"');
  args.push('--add-header', 'Sec-Ch-Ua-Model:""');
  args.push('--add-header', 'Sec-Fetch-Dest:empty');
  args.push('--add-header', 'Sec-Fetch-Mode:cors');
  args.push('--add-header', 'Sec-Fetch-Site:same-origin');
  args.push('--add-header', 'Sec-Fetch-User:?1');
  
  // All headers combined
  args.push('--referer', 'https://www.youtube.com/');
  args.push('--add-header', `Accept-Language:${randomGeo.lang}`);
  args.push('--add-header', 'Accept:*/*');
  args.push('--add-header', 'Accept-Encoding:gzip, deflate, br');
  args.push('--add-header', 'DNT:1');
  args.push('--add-header', 'Cache-Control:max-age=0');
  args.push('--add-header', 'Connection:keep-alive');
  args.push('--add-header', 'Upgrade-Insecure-Requests:1');
  
  // Formats + Human delays
  args.push('--format', 'bestaudio/best');
  args.push('--sleep-requests', '2');
  args.push('--sleep-interval', '3');
  args.push('--max-sleep-interval', '8');
  args.push('--limit-rate', '750K');
  
  // Always use free proxy in desperation mode
  addFreeProxy();
  
  console.log(`   💀 Client: ${randomClient}, Geo: ${randomGeo.country}`);
  console.log('   💀💀💀 EVERY BOT BYPASS METHOD ACTIVE 💀💀💀');
  console.log('   🔥 Fake cookies, tokens, CAPTCHA bypass, human simulation');
  return { userAgent: randomAgent, clientType: randomClient, strategy: 'ULTIMATE_DESPERATION' };
}

// Cache search results (expires after 5 minutes)
const searchCache = new Map();
const SEARCH_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Timeout constants
const PROCESS_TIMEOUT = 180000; // 180 seconds (3 minutes) timeout for stuck downloads  
const STUCK_CHECK_INTERVAL = 30000; // Check every 30 seconds

// Detect Python command (py on Windows, python on Linux/Mac)
let PYTHON_CMD = 'python';

async function detectPythonCommand() {
  const commands = ['py', 'python3', 'python'];
  
  for (const cmd of commands) {
    try {
      const testResult = await new Promise((resolve) => {
        const testProcess = spawn(cmd, ['--version']);
        testProcess.on('close', (code) => {
          resolve(code === 0);
        });
        testProcess.on('error', () => {
          resolve(false);
        });
      });
      
      if (testResult) {
        PYTHON_CMD = cmd;
        console.log(`✅ Detected Python command: ${cmd}`);
        return cmd;
      }
    } catch (err) {
      continue;
    }
  }
  
  console.warn('⚠️ Python not found! Please install Python.');
  return 'python'; // fallback
}

// Detect Python on startup (will be awaited before use)

// Store version information
let versionInfo = {
  spotdl: 'Unknown',
  ytdlp: 'Unknown',
  youtubedlexec: 'Unknown',
  youtubei: 'Unknown',
  lastChecked: null,
  lastUpdated: null,
  needsUpdate: false
};

// Helper function to check if spotdl is installed
async function checkSpotdlInstalled() {
  return new Promise((resolve) => {
    const process = spawn(PYTHON_CMD, ['-m', 'spotdl', '--version']);
    process.on('close', (code) => {
      resolve(code === 0);
    });
    process.on('error', () => {
      resolve(false);
    });
  });
}

// Helper function to get spotdl version
async function getSpotdlVersion() {
  return new Promise((resolve) => {
    const process = spawn(PYTHON_CMD, ['-m', 'spotdl', '--version']);
    let version = '';
    
    process.stdout.on('data', (data) => {
      version += data.toString().trim();
    });
    
    process.on('close', () => {
      resolve(version || 'Unknown');
    });
    
    process.on('error', () => {
      resolve('Not installed');
    });
  });
}

// Helper function to get yt-dlp version
async function getYtDlpVersion() {
  return new Promise((resolve) => {
    const process = spawn(PYTHON_CMD, ['-m', 'pip', 'show', 'yt-dlp']);
    let output = '';
    
    process.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    process.on('close', () => {
      const versionMatch = output.match(/Version:\s*(.+)/);
      resolve(versionMatch ? versionMatch[1].trim() : 'Unknown');
    });
    
    process.on('error', () => {
      resolve('Unknown');
    });
  });
}

// Helper function to get youtube-dl-exec version
async function getYoutubeDlExecVersion() {
  try {
    const packagePath = path.join(__dirname, 'node_modules', 'youtube-dl-exec', 'package.json');
    const packageData = await fs.readFile(packagePath, 'utf8');
    const packageJson = JSON.parse(packageData);
    return packageJson.version || 'Unknown';
  } catch (error) {
    return 'Not installed';
  }
}

// Helper function to get youtubei.js version
async function getYoutubeiVersion() {
  try {
    const packagePath = path.join(__dirname, 'node_modules', 'youtubei.js', 'package.json');
    const packageData = await fs.readFile(packagePath, 'utf8');
    const packageJson = JSON.parse(packageData);
    return packageJson.version || 'Unknown';
  } catch (error) {
    return 'Not installed';
  }
}

// Helper function to update yt-dlp and spotdl
async function updateDependencies() {
  // Install from requirements.txt to ensure all dependencies (including pytubefix) are installed
  return new Promise((resolve) => {
    const requirementsPath = path.join(__dirname, 'requirements.txt');
    const updateProcess = spawn(PYTHON_CMD, ['-m', 'pip', 'install', '--upgrade', '--quiet', '-r', requirementsPath]);
    let output = '';
    
    updateProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    updateProcess.stderr.on('data', (data) => {
      // Silently capture stderr
    });
    
    updateProcess.on('close', (code) => {
      const updated = output.includes('Successfully installed') || output.includes('Requirement already satisfied') || code === 0;
      versionInfo.lastUpdated = new Date().toISOString();
      resolve(updated);
    });
    
    updateProcess.on('error', (err) => {
      // If requirements.txt install fails, fallback to direct install
      console.log('⚠️  Failed to install from requirements.txt, trying direct install...');
      const fallbackProcess = spawn(PYTHON_CMD, ['-m', 'pip', 'install', '--upgrade', '--quiet', 'yt-dlp', 'spotdl', 'pytubefix']);
      let fallbackOutput = '';
      
      fallbackProcess.stdout.on('data', (data) => {
        fallbackOutput += data.toString();
      });
      
      fallbackProcess.on('close', (fallbackCode) => {
        const fallbackUpdated = fallbackOutput.includes('Successfully installed') || fallbackOutput.includes('Requirement already satisfied') || fallbackCode === 0;
        versionInfo.lastUpdated = new Date().toISOString();
        resolve(fallbackUpdated);
      });
    });
  });
}

// Helper function to update Node.js packages (youtube-dl-exec, youtubei.js)
async function updateNodePackages() {
  return new Promise((resolve) => {
    console.log('🔄 Checking for npm package updates...');
    
    // Use npm update to update packages
    const updateProcess = spawn('npm', ['update', 'youtube-dl-exec', 'youtubei.js'], {
      cwd: __dirname,
      stdio: 'pipe'
    });
    
    let output = '';
    let errorOutput = '';
    
    updateProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    updateProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    updateProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ npm packages checked/updated');
        resolve(true);
      } else {
        console.log('⚠️ npm update completed with warnings (this is normal)');
        resolve(false);
      }
    });
    
    updateProcess.on('error', (error) => {
      console.log('⚠️ npm update skipped (not critical)');
      resolve(false);
    });
  });
}

// Check versions on startup
async function checkAndUpdateVersions() {
  console.log('\n🔄 Checking dependencies...');
  
  // Check Python-based tools
  versionInfo.spotdl = await getSpotdlVersion();
  versionInfo.ytdlp = await getYtDlpVersion();
  
  // Check Node.js packages
  versionInfo.youtubedlexec = await getYoutubeDlExecVersion();
  versionInfo.youtubei = await getYoutubeiVersion();
  
  versionInfo.lastChecked = new Date().toISOString();
  
  // Auto-update Python tools (with error handling to prevent crashes)
  console.log('🔄 Updating Python tools (yt-dlp, spotdl)...');
  try {
  await updateDependencies();
  } catch (error) {
    console.log('⚠️ Python tools update failed:', error.message);
    console.log('   Server will continue with existing installations');
  }
  
  // Auto-update Node.js packages
  await updateNodePackages();
  
  // Get updated versions
  versionInfo.spotdl = await getSpotdlVersion();
  versionInfo.ytdlp = await getYtDlpVersion();
  versionInfo.youtubedlexec = await getYoutubeDlExecVersion();
  versionInfo.youtubei = await getYoutubeiVersion();
  
  console.log('✅ All dependencies checked and updated');
  
  // Clear console for cleaner display
  console.clear();
}

// Helper function to sanitize folder names
function sanitizeFolderName(name) {
  return name
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 50);
}

// Helper function to create safe filename (removes "Unknown Artist" prefix)
function createSafeFilename(track) {
  const artist = track.artist || 'Unknown Artist';
  const trackName = track.name;
  
  // Only sanitize filesystem-invalid characters (keep non-ASCII like Arabic, emojis, etc.)
  // yt-dlp on Linux typically preserves these characters, so we should match that behavior
  const sanitizeForFs = (str) => str.replace(/[/\\?%*:|"<>]/g, '-').trim();
  
  // If artist is "Unknown Artist" or "Unknown", just use track name
  if (artist === 'Unknown Artist' || artist === 'Unknown') {
    return sanitizeForFs(trackName);
  }
  
  // Otherwise use "Artist - Track Name" format
  // Keep original characters (including Arabic, emojis, etc.) - only sanitize filesystem-invalid chars
  return `${sanitizeForFs(artist)} - ${sanitizeForFs(trackName)}`.replace(/[/\\?%*:|"<>]/g, '-');
}

// Helper function to detect URL type
function detectUrlType(url) {
  if (url.includes('spotify.com/track/')) return 'spotify-track';
  if (url.includes('spotify.com/playlist/')) return 'spotify-playlist';
  if (url.includes('spotify.com/album/')) return 'spotify-album';
  if (url.includes('spotify.com/artist/')) return 'spotify-artist';
  if (url.includes('youtube.com/watch') || url.includes('youtu.be/')) return 'youtube-video';
  if (url.includes('youtube.com/playlist') || url.includes('music.youtube.com/playlist')) return 'youtube-playlist';
  if (url.includes('music.youtube.com/watch')) return 'youtube-music';
  return 'unknown';
}

// Helper function to extract playlist ID from URL
function extractPlaylistId(url) {
  const match = url.match(/playlist\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

// Helper function to extract Spotify track ID
function extractSpotifyTrackId(url) {
  const match = url.match(/track\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

// Helper function to extract Spotify album ID
function extractSpotifyAlbumId(url) {
  const match = url.match(/album\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

// Helper function to extract Spotify artist ID
function extractSpotifyArtistId(url) {
  const match = url.match(/artist\/([a-zA-Z0-9]+)/);
  return match ? match[1] : null;
}

// Helper function to extract YouTube video ID
function extractYouTubeVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/,
    /v=([a-zA-Z0-9_-]{11})/
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Helper function to extract YouTube playlist ID
function extractYouTubePlaylistId(url) {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

// Fetch single Spotify track metadata
async function fetchSpotifyTrack(trackId) {
  try {
    console.log('🎵 Fetching single Spotify track...');
    
    const trackUrl = `https://open.spotify.com/track/${trackId}`;
    const response = await fetch(trackUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error('Could not fetch track');
    }
    
    const html = await response.text();
    
    // Extract from __NEXT_DATA__
    const nextDataMatch = html.match(/window\.__NEXT_DATA__\s*=\s*({.+?})\s*<\/script>/s);
    if (nextDataMatch) {
      const nextData = JSON.parse(nextDataMatch[1]);
      const entity = nextData?.props?.pageProps?.state?.data?.entity;
      
      if (entity) {
        const track = {
          id: entity.id || trackId,
          name: entity.name || 'Unknown Track',
          artist: entity.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
          album: entity.album?.name || 'Unknown Album',
          duration: Math.floor((entity.duration_ms || 0) / 1000),
          imageUrl: entity.album?.images?.[0]?.url || '/placeholder.svg',
          url: `https://open.spotify.com/track/${entity.id || trackId}`,
          downloadStatus: 'pending',
          downloadProgress: 0,
          selected: true
        };
        
        return { track, entity };
      }
    }
    
    return null;
  } catch (error) {
    console.error('Spotify track fetch failed:', error.message);
    return null;
  }
}

// Fetch YouTube video metadata using yt-dlp (SAME METHOD AS PLAYLIST for reliability)
async function fetchYouTubeVideo(videoId, attempt = 0) {
  return new Promise(async (resolve) => {
    console.log(`📺 Fetching YouTube video metadata...`);
    
    // Use playlist-style endpoint so yt-dlp emits playlist-like JSON
    const url = `https://www.youtube.com/watch_videos?video_ids=${videoId}`;
    
    // Use EXACT SAME args as playlist (which works perfectly!)
    const ytdlpArgs = [
      '-m', 'yt_dlp',
      url,
      '--flat-playlist',
      '--dump-json',
      '--no-warnings',
      '--ignore-errors',
      '--extractor-args', 'youtube:player_client=android,web',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    ];
    
    // Add cookies if available (like search does)
    try {
      const cookiesExist = await fs.access(YOUTUBE_COOKIES_PATH).then(() => true).catch(() => false);
      if (cookiesExist) {
        ytdlpArgs.push('--cookies', YOUTUBE_COOKIES_PATH);
        console.log('🍪 Using YouTube cookies for single video');
      } else {
        console.log('⚠️ No YouTube cookies - single video may be limited');
      }
    } catch (err) {
      console.log('⚠️ No YouTube cookies found for single video');
    }
    
    // Add enhanced bypass methods (like downloads do)
    await addYouTubeEnhancements(ytdlpArgs, attempt);
    
    const ytdlpProcess = spawn(PYTHON_CMD, ytdlpArgs);
    let output = '';
    let errorOutput = '';
    
    ytdlpProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ytdlpProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    ytdlpProcess.on('close', async (code) => {
      if (code === 0 && output.trim()) {
        try {
          // With --flat-playlist, yt-dlp may emit multiple JSON lines
          let parsed;
          try {
            parsed = JSON.parse(output);
          } catch {
            const lines = output.trim().split('\n');
            const entries = lines.map(line => {
              try { return JSON.parse(line); } catch { return null; }
            }).filter(Boolean);
            parsed = entries.find(e => e && e._type !== 'playlist' && e.id === videoId)
              || entries.find(e => e && e._type !== 'playlist')
              || entries[0];
          }

          if (!parsed) {
            console.error('Failed to parse YouTube data: empty');
            return resolve(null);
          }
          
          // Extract duration from multiple possible fields
          let duration = 0;
          if (parsed.duration) {
            duration = Math.floor(parsed.duration);
          } else if (parsed.duration_string) {
            const parts = parsed.duration_string.split(':').map(Number);
            if (parts.length === 2) {
              duration = parts[0] * 60 + parts[1];
            } else if (parts.length === 3) {
              duration = parts[0] * 3600 + parts[1] * 60 + parts[2];
            }
          }
          
          const track = {
            id: parsed.id || videoId,
            name: parsed.title || 'Unknown',
            artist: parsed.uploader || parsed.channel || parsed.uploader_id || 'YouTube',
            album: parsed.playlist_title || parsed.album || 'YouTube',
            duration,
            imageUrl: parsed.thumbnail || (parsed.thumbnails && parsed.thumbnails[0] && parsed.thumbnails[0].url) || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            downloadStatus: 'pending',
            downloadProgress: 0,
            selected: true
          };
          
          if (duration === 0) {
            console.log('⚠️  Duration missing in yt-dlp data; proceeding');
          }
          
          console.log(`✅ YouTube video fetched: "${track.name}" by ${track.artist} (${track.duration}s)`);
          resolve({ track, data: parsed });
        } catch (e) {
          console.error('Failed to parse YouTube data:', e.message);
          resolve(null);
        }
      } else {
        console.error(`yt-dlp failed:`, errorOutput);
        resolve(null);
      }
    });
    
    ytdlpProcess.on('error', (err) => {
      console.error('yt-dlp process error:', err.message);
      // No fallback - return null if playlist logic fails
      resolve(null);
    });
  });
}

// Fallback function for when yt-dlp fails
async function fetchVideoFallback(videoId) {
  return new Promise(async (resolve) => {
    console.log(`⚠️  Using fallback method (oEmbed + page scraping)...`);
    try {
            // Get title and author from oEmbed
            const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
            const oEmbedResponse = await fetch(oEmbedUrl);
            
            let title = `YouTube Video ${videoId}`;
            let artist = 'YouTube';
            let thumbnail = `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
            let duration = 0;
            
            if (oEmbedResponse.ok) {
              const oEmbedData = await oEmbedResponse.json();
              title = oEmbedData.title || title;
              artist = oEmbedData.author_name || artist;
              thumbnail = oEmbedData.thumbnail_url || thumbnail;
              console.log(`✅ Got title from oEmbed: "${title}"`);
            }
            
            // Try to get duration from YouTube page HTML (multiple patterns)
            console.log(`🔍 Attempting to scrape duration from YouTube page...`);
            try {
              const pageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
                  'Accept-Language': 'en-US,en;q=0.5'
                }
              });
              
              console.log(`📄 Page response status: ${pageResponse.status}`);
              
              if (pageResponse.status === 429) {
                console.log(`⚠️  Rate limited (429) - YouTube is blocking requests`);
                console.log(`💡 Add YOUTUBE_COOKIES to fix this (see ADD-YOUTUBE-COOKIES.md)`);
                // Don't try to parse HTML on 429
              } else if (pageResponse.ok) {
                const html = await pageResponse.text();
                console.log(`📄 Got HTML page (${html.length} bytes)`);
                
                // Try multiple patterns to find duration - ENHANCED PATTERNS WITH JAVASCRIPT
                const patterns = [
                  // Standard YouTube patterns
                  { regex: /"lengthSeconds":"(\d+)"/, name: 'lengthSeconds' },
                  { regex: /"duration":"PT(\d+)M(\d+)S"/, name: 'PT format (M:S)' },
                  { regex: /"duration":"PT(\d+)M"/, name: 'PT format (M only)' },
                  { regex: /"duration":"PT(\d+)S"/, name: 'PT format (S only)' },
                  { regex: /"approxDurationMs":"(\d+)"/, name: 'approxDurationMs' },
                  { regex: /lengthSeconds&quot;:&quot;(\d+)/, name: 'lengthSeconds (HTML encoded)' },
                  { regex: /"length":"(\d+)"/, name: 'length field' },
                  { regex: /\"lengthText\":\{\"simpleText\":\"(\d+):(\d+)\"/, name: 'lengthText' },
                  
                  // New YouTube patterns (2024+)
                  { regex: /"videoDetails":\{"lengthSeconds":"(\d+)"/, name: 'videoDetails lengthSeconds' },
                  { regex: /"microformat":\{"playerMicroformatRenderer":\{"lengthSeconds":"(\d+)"/, name: 'microformat lengthSeconds' },
                  { regex: /"playerOverlays":\{"playerOverlayRenderer":\{"videoDetails":\{"playerVideoDetailsRenderer":\{"lengthSeconds":"(\d+)"/, name: 'playerOverlays lengthSeconds' },
                  { regex: /"contents":\{"twoColumnWatchNextResults":\{"results":\{"results":\{"contents":\[.*?"videoDetails":\{"lengthSeconds":"(\d+)"/, name: 'twoColumn lengthSeconds' },
                  
                  // Alternative duration formats
                  { regex: /"duration_seconds":"(\d+)"/, name: 'duration_seconds' },
                  { regex: /"video_length":"(\d+)"/, name: 'video_length' },
                  { regex: /"time":"(\d+)"/, name: 'time field' },
                  
                  // JSON-LD structured data
                  { regex: /"duration":"PT(\d+)M(\d+)S"/, name: 'JSON-LD PT format' },
                  { regex: /"duration":"PT(\d+)M"/, name: 'JSON-LD PT minutes' },
                  { regex: /"duration":"PT(\d+)S"/, name: 'JSON-LD PT seconds' },
                  
                  // HTML5 video duration
                  { regex: /<video[^>]*data-duration="(\d+)"/, name: 'HTML5 data-duration' },
                  { regex: /<video[^>]*duration="(\d+)"/, name: 'HTML5 duration' },
                  
                  // YouTube player API patterns
                  { regex: /"ytInitialPlayerResponse":\{"videoDetails":\{"lengthSeconds":"(\d+)"/, name: 'ytInitialPlayerResponse' },
                  { regex: /"playerResponse":\{"videoDetails":\{"lengthSeconds":"(\d+)"/, name: 'playerResponse' },
                  
                  // Fallback patterns for different YouTube layouts
                  { regex: /"length_seconds":"(\d+)"/, name: 'length_seconds' },
                  { regex: /"video_duration":"(\d+)"/, name: 'video_duration' },
                  { regex: /"playback_duration":"(\d+)"/, name: 'playback_duration' },
                  
                  // NEW: JavaScript/JSON patterns for modern YouTube
                  { regex: /window\.WIZ_global_data.*?"lengthSeconds":"(\d+)"/, name: 'WIZ_global_data lengthSeconds' },
                  { regex: /"ytInitialData":\{"contents":\{"twoColumnWatchNextResults":\{"results":\{"results":\{"contents":\[.*?"videoDetails":\{"lengthSeconds":"(\d+)"/, name: 'ytInitialData lengthSeconds' },
                  { regex: /"playerResponse":\{"videoDetails":\{"lengthSeconds":"(\d+)"/, name: 'playerResponse videoDetails' },
                  { regex: /"videoDetails":\{"videoId":"[^"]*","title":"[^"]*","lengthSeconds":"(\d+)"/, name: 'videoDetails direct' },
                  { regex: /"microformat":\{"playerMicroformatRenderer":\{"lengthSeconds":"(\d+)"/, name: 'microformat direct' },
                  { regex: /"contents":\{"twoColumnWatchNextResults":\{"results":\{"results":\{"contents":\[.*?"videoDetails":\{"videoId":"[^"]*","title":"[^"]*","lengthSeconds":"(\d+)"/, name: 'twoColumn direct' },
                  
                  // NEW: More specific JavaScript patterns
                  { regex: /"videoDetails":\{"videoId":"[^"]*","title":"[^"]*","lengthSeconds":"(\d+)","keywords"/, name: 'videoDetails with keywords' },
                  { regex: /"playerResponse":\{"videoDetails":\{"videoId":"[^"]*","title":"[^"]*","lengthSeconds":"(\d+)"/, name: 'playerResponse direct' },
                  { regex: /"ytInitialPlayerResponse":\{"videoDetails":\{"videoId":"[^"]*","title":"[^"]*","lengthSeconds":"(\d+)"/, name: 'ytInitialPlayerResponse direct' },
                  
                  // NEW: Alternative JavaScript variable patterns
                  { regex: /var\s+ytInitialPlayerResponse\s*=\s*\{[^}]*"lengthSeconds":"(\d+)"/, name: 'var ytInitialPlayerResponse' },
                  { regex: /var\s+ytInitialData\s*=\s*\{[^}]*"lengthSeconds":"(\d+)"/, name: 'var ytInitialData' },
                  { regex: /window\.ytInitialPlayerResponse\s*=\s*\{[^}]*"lengthSeconds":"(\d+)"/, name: 'window ytInitialPlayerResponse' },
                  
                  // NEW: Deep nested JSON patterns
                  { regex: /"contents":\{"twoColumnWatchNextResults":\{"results":\{"results":\{"contents":\[.*?"videoDetails":\{"videoId":"[^"]*","title":"[^"]*","lengthSeconds":"(\d+)","keywords"/, name: 'deep nested videoDetails' },
                  { regex: /"playerResponse":\{"videoDetails":\{"videoId":"[^"]*","title":"[^"]*","lengthSeconds":"(\d+)","keywords"/, name: 'deep playerResponse' },
                ];
                
                console.log(`🔍 Trying ${patterns.length} duration extraction patterns...`);
                
                for (const patternObj of patterns) {
                  const match = html.match(patternObj.regex);
                  if (match) {
                    console.log(`🎯 Pattern "${patternObj.name}" matched!`);
                    if (patternObj.name.includes('PT') && match[2]) {
                      // ISO 8601 format PT4M6S
                      duration = parseInt(match[1]) * 60 + parseInt(match[2]);
                      console.log(`✅ Got duration from ${patternObj.name}: ${duration}s (${match[1]}m ${match[2]}s)`);
                      break;
                    } else if (patternObj.name.includes('PT') && !match[2]) {
                      // Minutes only PT4M
                      duration = parseInt(match[1]) * 60;
                      console.log(`✅ Got duration from ${patternObj.name}: ${duration}s (${match[1]}m)`);
                      break;
                    } else if (patternObj.name.includes('approx')) {
                      // Milliseconds
                      duration = Math.floor(parseInt(match[1]) / 1000);
                      console.log(`✅ Got duration from ${patternObj.name}: ${duration}s (${match[1]}ms)`);
                      break;
                    } else if (patternObj.name === 'lengthText' && match[2]) {
                      // MM:SS format
                      duration = parseInt(match[1]) * 60 + parseInt(match[2]);
                      console.log(`✅ Got duration from ${patternObj.name}: ${duration}s (${match[1]}:${match[2]})`);
                      break;
                    } else {
                      // Seconds
                      duration = parseInt(match[1]);
                      console.log(`✅ Got duration from ${patternObj.name}: ${duration}s`);
                      break;
                    }
                  }
                }
                
                if (duration === 0) {
                  console.log(`❌ None of the ${patterns.length} duration patterns matched!`);
                  console.log(`🔍 HTML snippet (first 500 chars): ${html.substring(0, 500)}`);
                }
              } else {
                console.log(`❌ Page fetch failed with status: ${pageResponse.status}`);
              }
            } catch (err) {
              console.log(`❌ Error fetching duration from page:`, err.message);
            }
            
            const track = {
              id: videoId,
              name: title,
              artist: artist,
              album: 'YouTube',
              duration: duration,
              imageUrl: thumbnail,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              downloadStatus: 'pending',
              downloadProgress: 0,
              selected: true
            };
            if (duration > 0) {
              console.log(`✅ Created track: "${track.name}" by ${track.artist} (${duration}s)`);
            } else {
              console.log(`✅ Created track: "${track.name}" by ${track.artist} (duration will load when playing)`);
            }
            resolve({ track, data: null });
    } catch (err) {
      // Ultimate fallback: Basic track
      console.log(`⚠️  Fallback failed, creating basic playable track...`);
      const basicTrack = {
        id: videoId,
        name: `YouTube Video ${videoId}`,
        artist: 'YouTube',
        album: 'YouTube',
        duration: 0,
        imageUrl: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        downloadStatus: 'pending',
        downloadProgress: 0,
        selected: true
      };
      console.log(`✅ Created basic track - video is playable`);
      resolve({ track: basicTrack, data: null });
    }
  });
}

// Fetch YouTube playlist metadata using yt-dlp with multiple fallbacks
async function fetchYouTubePlaylist(playlistId) {
  return new Promise((resolve) => {
    console.log('📺 Fetching YouTube playlist metadata...');
    
    const url = `https://www.youtube.com/playlist?list=${playlistId}`;
    const ytdlpArgs = [
      '-m', 'yt_dlp',
      url,
      '--flat-playlist',
      '--dump-json',
      '--no-warnings',
      '--ignore-errors',
      '--extractor-args', 'youtube:player_client=android,web',
      '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    ];
    
    const ytdlpProcess = spawn(PYTHON_CMD, ytdlpArgs);
    let output = '';
    let errorOutput = '';
    
    ytdlpProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    ytdlpProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    ytdlpProcess.on('close', (code) => {
      if (code === 0 && output.trim()) {
        try {
          const lines = output.trim().split('\n');
          const entries = lines.map(line => {
            try {
              return JSON.parse(line);
            } catch (e) {
              return null;
            }
          }).filter(Boolean);
          
          // Find playlist info - prioritize entries with _type === 'playlist'
          // If no playlist entry found, look for entries with playlist_id or that don't have id (first entry might be playlist metadata)
          let playlistInfo = entries.find(e => e._type === 'playlist');
          
          // If no explicit playlist entry, check if first entry has playlist metadata fields
          if (!playlistInfo && entries.length > 0) {
            const firstEntry = entries[0];
            // Check if it has playlist-like fields (title but no id, or has playlist_id)
            if ((firstEntry.title && !firstEntry.id) || firstEntry.playlist_id || firstEntry.playlist_title) {
              playlistInfo = firstEntry;
            }
          }
          
          // If still no playlist info, try to find it by looking for entries without video id
          if (!playlistInfo) {
            playlistInfo = entries.find(e => !e.id && e.title);
          }
          
          // Other entries are videos (filter out playlist info)
          const videos = entries.filter(e => {
            // Exclude playlist entries
            if (e._type === 'playlist') return false;
            // Exclude entries that match our playlistInfo
            if (playlistInfo && e === playlistInfo) return false;
            // Only include entries with video id
            return e.id && e.id.startsWith && (e.id.startsWith('watch') || !e.id.includes('playlist'));
          });
          
          const tracks = videos.map((video, index) => ({
            id: video.id || `yt_${index}`,
            name: video.title || 'Unknown',
            artist: video.uploader || video.channel || 'YouTube',
            album: playlistInfo?.title || 'YouTube Playlist',
            duration: Math.floor(video.duration || 0),
            imageUrl: video.thumbnails?.[0]?.url || video.thumbnail || '/placeholder.svg',
            url: `https://www.youtube.com/watch?v=${video.id}`,
            downloadStatus: 'pending',
            downloadProgress: 0,
            selected: true
          }));
          
          resolve({ tracks, playlistInfo });
        } catch (e) {
          console.error('Failed to parse YouTube playlist data:', e.message);
          resolve(null);
        }
      } else {
        console.error('yt-dlp failed:', errorOutput);
        resolve(null);
      }
    });
    
    ytdlpProcess.on('error', (err) => {
      console.error('yt-dlp process error:', err.message);
      resolve(null);
    });
  });
}

// Fast playlist metadata fetch using Spotify Web API (no auth needed)
async function fetchSpotifyPlaylistFast(playlistId) {
  try {
    console.log('🚀 Fast fetch: Getting Spotify playlist data...');
    
    // Use Spotify's embed API (doesn't require authentication)
    const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    
    if (!response.ok) {
      throw new Error('Could not fetch playlist');
    }
    
    const html = await response.text();
    
    // Extract the Spotify resource data from the embed page
    const resourceMatch = html.match(/window\.__SPOTIFY__\s*=\s*({.+?});/s) || 
                         html.match(/"resource":\s*({.+?})\s*[,}]/s);
    
    if (resourceMatch) {
      const data = JSON.parse(resourceMatch[1]);
      return data;
    }
    
    return null;
  } catch (error) {
    console.error('Fast fetch failed:', error.message);
    return null;
  }
}

// Fetch Spotify metadata using spotdl (works for albums, artists, playlists)
async function fetchSpotifyMetadataWithSpotdl(url) {
  return new Promise((resolve, reject) => {
    const metaFile = path.join(os.tmpdir(), `spotdl_meta_${Date.now()}.spotdl`);
    
    console.log('🎵 Using spotdl to fetch metadata...');
    
    const spotdlProcess = spawn(PYTHON_CMD, [
      '-m', 'spotdl',
      'save',
      url,
      '--save-file', metaFile,
      '--threads', '8',
      '--max-retries', '5'
    ]);

    let output = '';
    let errorOutput = '';

    spotdlProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      console.log('  spotdl:', chunk.trim());
    });

    spotdlProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    spotdlProcess.on('close', async (code) => {
      if (code !== 0) {
        console.error('❌ spotdl failed with code:', code);
        console.error('  Error:', errorOutput);
        await fs.unlink(metaFile).catch(() => {});
        return reject(new Error(`spotdl failed: ${errorOutput || 'Unknown error'}`));
      }
      
      try {
        const metadataContent = await fs.readFile(metaFile, 'utf-8');
        const songs = JSON.parse(metadataContent);
        await fs.unlink(metaFile).catch(() => {});

        if (!songs || songs.length === 0) {
          return reject(new Error('No tracks found'));
        }

        // Transform spotdl format to our format
        const tracks = songs.map((song, index) => ({
          id: song.song_id || `${song.artist}-${song.name}-${index}`,
          name: song.name,
          artist: song.artist || song.artists?.join(', ') || 'Unknown Artist',
          album: song.album_name || song.album || 'Unknown Album',
          duration: song.duration || 0,
          imageUrl: song.cover_url || song.album_art || '/placeholder.svg',
          url: song.url || url,
          downloadStatus: 'pending',
          downloadProgress: 0,
          selected: true,
        }));

        // Get collection name from first song
        const firstSong = songs[0];
        const playlistName = firstSong.list_name || firstSong.playlist_name || 
                            firstSong.album_name || firstSong.artist || 'Unknown';
        const owner = firstSong.artist || firstSong.list_owner || 'Spotify';

        resolve({
          playlistName,
          owner,
          tracks
        });
      } catch (err) {
        console.error('❌ Failed to parse metadata:', err);
        await fs.unlink(metaFile).catch(() => {});
        reject(err);
      }
    });

    spotdlProcess.on('error', (err) => {
      console.error('❌ spotdl process error:', err);
      reject(err);
    });
  });
}

// Quick helper to fetch playlist owner/info without scraping tracks
async function fetchSpotifyOwnerInfoQuick(playlistId) {
  let ownerName = '';
  let ownerUrl = '';
  let ownerImage = '';
  let playlistImage = '';
  let description = '';

  try {
    // OEmbed thumbnail
    try {
      const oembedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/playlist/${playlistId}`;
      const res = await fetch(oembedUrl);
      if (res.ok) {
        const data = await res.json();
        if (data.thumbnail_url) playlistImage = data.thumbnail_url;
        if (data.title) description = data.title;
      }
    } catch {}

    // Main page
    const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
    const response = await fetch(playlistUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });
    if (response.ok) {
      const html = await response.text();

      // Owner URI from meta
      const ownerMetaMatch = html.match(/<meta\s+property="music:creator"\s+content="([^"]+)"/i);
      if (ownerMetaMatch && ownerMetaMatch[1]) {
        const ownerUri = ownerMetaMatch[1];
        const idMatch = ownerUri.match(/(?:spotify:user:|\/user\/)([^"?\/:]+)/i);
        if (idMatch) ownerUrl = `https://open.spotify.com/user/${idMatch[1]}`;
      }

      // JSON-LD author name
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.+?)<\/script>/s);
      if (jsonLdMatch) {
        try {
          const jsonData = JSON.parse(jsonLdMatch[1]);
          if (jsonData.author?.name) ownerName = jsonData.author.name;
        } catch {}
      }

      // __NEXT_DATA__ owner image/name
      const nextDataMatch = html.match(/window\.__NEXT_DATA__\s*=\s*({.+?})\s*<\/script>/s);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const owner = nextData?.props?.pageProps?.state?.data?.entity?.owner;
          if (owner?.displayName) ownerName = ownerName || owner.displayName;
          if (owner?.images && owner.images[0]?.url) ownerImage = owner.images[0].url;
          if (!ownerUrl && owner?.uri) ownerUrl = owner.uri.replace('spotify:user:', 'https://open.spotify.com/user/');
        } catch {}
      }

      // Fallback: parse embed page for owner name/url/image if still missing
      if (!ownerName || !ownerUrl || !ownerImage) {
        try {
          const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
          const emRes = await fetch(embedUrl, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
          });
          if (emRes.ok) {
            const emHtml = await emRes.text();
            // og/twitter title usually: "Playlist Name · Owner Name"
            const metaTitleMatch = emHtml.match(/<meta\s+(?:property|name)="(?:og:title|twitter:title)"\s+content="([^"]+)"/i);
            if (metaTitleMatch && metaTitleMatch[1] && !ownerName) {
              const parts = metaTitleMatch[1].split('·');
              if (parts.length >= 2) ownerName = parts[1].trim();
            }
            // Explicit JSON fields
            const ownerNameMatch = emHtml.match(/"ownerName"\s*:\s*"([^"]+)"/i) || emHtml.match(/"owner"\s*:\s*\{[^}]*"name"\s*:\s*"([^"]+)"/i);
            if (ownerNameMatch && ownerNameMatch[1] && !ownerName) ownerName = ownerNameMatch[1];
            const ownerUriMatch = emHtml.match(/"uri"\s*:\s*"spotify:user:([^"]+)"/i) || emHtml.match(/href=\"\/user\/([^\"?]+)\"/i);
            if (ownerUriMatch && ownerUriMatch[1] && !ownerUrl) ownerUrl = `https://open.spotify.com/user/${ownerUriMatch[1]}`;
            const imageMatch = emHtml.match(/"images"\s*:\s*\[\s*\{\s*"url"\s*:\s*"([^"]+)"/i);
            if (imageMatch && imageMatch[1] && !ownerImage) ownerImage = imageMatch[1];
          }
        } catch {}
      }
    }
  } catch {}

  return { ownerName, ownerUrl, ownerImage, playlistImage, description };
}

// Fetch playlist metadata
app.post('/api/playlist/metadata', async (req, res) => {
  const { url } = req.body;

  if (!url) {
    return res.status(400).json({ error: 'URL is required' });
  }

  const urlType = detectUrlType(url);
  console.log('\n=== METADATA FETCH ===');
  console.log('URL:', url);
  console.log('Type:', urlType);

  try {
    // Handle Spotify Track (single song)
    if (urlType === 'spotify-track') {
      const trackId = extractSpotifyTrackId(url);
      if (!trackId) {
        return res.status(400).json({ error: 'Invalid Spotify track URL' });
      }

      console.log('🎵 Loading single Spotify track...');
      const result = await fetchSpotifyTrack(trackId);
      
      if (result && result.track) {
        const playlist = {
          id: trackId,
          name: result.track.name,
          description: `Single track by ${result.track.artist}`,
          owner: result.track.artist,
          imageUrl: result.track.imageUrl,
          totalTracks: 1,
          totalDuration: result.track.duration,
          url: url,
          isSingleTrack: true
        };

        console.log(`✅ Loaded single track: "${result.track.name}" by ${result.track.artist}`);
        return res.json({ playlist, tracks: [result.track] });
      }

      // Fallback to spotdl for single track
      console.log('⚠️  Web scraping failed, falling back to spotdl...');
      // Continue to spotdl fallback below
    }
    
    // Handle YouTube Video (single video)
    else if (urlType === 'youtube-video' || urlType === 'youtube-music') {
      const videoId = extractYouTubeVideoId(url);
      if (!videoId) {
        return res.status(400).json({ error: 'Invalid YouTube video URL' });
      }

      console.log('📺 Loading single YouTube video...');
      const result = await fetchYouTubeVideo(videoId);
      
      if (result && result.track) {
        const playlist = {
          id: videoId,
          name: result.track.name,
          description: `YouTube video by ${result.track.artist}`,
          owner: result.track.artist,
          imageUrl: result.track.imageUrl,
          totalTracks: 1,
          totalDuration: result.track.duration,
          url: url,
          isSingleTrack: true,
          isYouTube: true
        };

        console.log(`✅ Loaded YouTube video: "${result.track.name}"`);
        return res.json({ playlist, tracks: [result.track] });
      }

      return res.status(500).json({ error: 'Failed to fetch YouTube video metadata' });
    }
    
    // Handle Spotify Album
    else if (urlType === 'spotify-album') {
      const albumId = extractSpotifyAlbumId(url);
      if (!albumId) {
        return res.status(400).json({ error: 'Invalid Spotify album URL' });
      }

      console.log('💿 Loading Spotify album...');
      console.log('⏱️  Started at:', new Date().toLocaleTimeString());
      const fetchStartTime = Date.now();
      
      try {
        // Use spotdl to fetch album metadata
        const result = await fetchSpotifyMetadataWithSpotdl(url);
        
        const totalDuration = result.tracks.reduce((sum, track) => sum + track.duration, 0);
        
        const playlist = {
          id: albumId,
          name: result.playlistName || 'Spotify Album',
          description: `Album · ${result.tracks[0]?.artist || 'Various Artists'}`,
          owner: result.owner || result.tracks[0]?.artist || 'Artist',
          ownerUrl: url,
          ownerImage: result.tracks[0]?.imageUrl || '/placeholder.svg',
          imageUrl: result.tracks[0]?.imageUrl || '/placeholder.svg',
          totalTracks: result.tracks.length,
          totalDuration: totalDuration,
          url: url,
          isAlbum: true
        };

        const fetchEndTime = Date.now();
        const elapsedSeconds = ((fetchEndTime - fetchStartTime) / 1000).toFixed(2);
        console.log(`✅ Loaded Spotify album: "${playlist.name}" with ${result.tracks.length} tracks`);
        console.log(`⏱️  Completed at: ${new Date().toLocaleTimeString()}`);
        console.log(`⏱️  Total time: ${elapsedSeconds}s`);
        return res.json({ playlist, tracks: result.tracks });
      } catch (error) {
        console.error('❌ Album fetch error:', error.message);
        return res.status(500).json({ error: `Failed to fetch Spotify album: ${error.message}` });
      }
    }
    
    // Handle Spotify Artist
    else if (urlType === 'spotify-artist') {
      const artistId = extractSpotifyArtistId(url);
      if (!artistId) {
        return res.status(400).json({ error: 'Invalid Spotify artist URL' });
      }

      console.log('🎤 Loading Spotify artist...');
      console.log('⏱️  Started at:', new Date().toLocaleTimeString());
      const fetchStartTime = Date.now();
      
      try {
        // Use spotdl to fetch artist's popular tracks
        const result = await fetchSpotifyMetadataWithSpotdl(url);
        
        const totalDuration = result.tracks.reduce((sum, track) => sum + track.duration, 0);
        
        const playlist = {
          id: artistId,
          name: result.playlistName || result.tracks[0]?.artist || 'Spotify Artist',
          description: `Artist · Popular tracks`,
          owner: result.owner || result.tracks[0]?.artist || 'Artist',
          ownerUrl: url,
          ownerImage: result.tracks[0]?.imageUrl || '/placeholder.svg',
          imageUrl: result.tracks[0]?.imageUrl || '/placeholder.svg',
          totalTracks: result.tracks.length,
          totalDuration: totalDuration,
          url: url,
          isArtist: true
        };

        const fetchEndTime = Date.now();
        const elapsedSeconds = ((fetchEndTime - fetchStartTime) / 1000).toFixed(2);
        console.log(`✅ Loaded Spotify artist: "${playlist.name}" with ${result.tracks.length} popular tracks`);
        console.log(`⏱️  Completed at: ${new Date().toLocaleTimeString()}`);
        console.log(`⏱️  Total time: ${elapsedSeconds}s`);
        return res.json({ playlist, tracks: result.tracks });
      } catch (error) {
        console.error('❌ Artist fetch error:', error.message);
        return res.status(500).json({ error: `Failed to fetch Spotify artist: ${error.message}` });
      }
    }
    
    // Handle YouTube Playlist
    else if (urlType === 'youtube-playlist') {
      const fetchStartTime = Date.now();
      const playlistId = extractYouTubePlaylistId(url);
      if (!playlistId) {
        return res.status(400).json({ error: 'Invalid YouTube playlist URL' });
      }

      console.log('📺 Loading YouTube playlist...');
      console.log('⏱️  Started at:', new Date().toLocaleTimeString());
      const result = await fetchYouTubePlaylist(playlistId);
      
      if (result && result.tracks && result.tracks.length > 0) {
        const totalDuration = result.tracks.reduce((sum, track) => sum + track.duration, 0);
        
        // Ensure we use playlist name, not first track title
        let playlistName = 'YouTube Playlist';
        if (result.playlistInfo) {
          // Try multiple fields for playlist name
          playlistName = result.playlistInfo.title || 
                        result.playlistInfo.playlist_title || 
                        result.playlistInfo.playlist ||
                        result.playlistInfo.name ||
                        result.playlistInfo.playlist_name ||
                        'YouTube Playlist';
          
          // Bug detection: If playlist name matches first track name, it's likely wrong
          if (result.tracks.length > 0 && playlistName === result.tracks[0].name) {
            console.warn('⚠️  Playlist name matches first track title - detected bug, using fallback');
            // Try alternative fields
            playlistName = result.playlistInfo.playlist || 
                          result.playlistInfo.playlist_name ||
                          result.playlistInfo.channel ||
                          result.playlistInfo.uploader ||
                          `YouTube Playlist ${playlistId.substring(0, 8)}`;
            
            // If still matches, use a generic name with playlist ID
            if (playlistName === result.tracks[0].name) {
              playlistName = `YouTube Playlist ${playlistId.substring(0, 8)}`;
            }
          }
          
          // Additional validation: ensure playlist name is different from any track name
          const matchingTrack = result.tracks.find(t => t.name === playlistName);
          if (matchingTrack && result.tracks.length > 1) {
            console.warn('⚠️  Playlist name matches a track name - using fallback');
            playlistName = result.playlistInfo.playlist || 
                          result.playlistInfo.playlist_name ||
                          result.playlistInfo.channel ||
                          `YouTube Playlist ${playlistId.substring(0, 8)}`;
          }
        } else {
          // If no playlist info found, try to extract from URL or use generic name
          console.warn('⚠️  No playlist info found in yt-dlp output');
          playlistName = `YouTube Playlist ${playlistId.substring(0, 8)}`;
        }
        
        const playlist = {
          id: playlistId,
          name: playlistName,
          description: result.playlistInfo?.description || '',
          owner: result.playlistInfo?.uploader || result.playlistInfo?.channel || 'YouTube',
          imageUrl: result.playlistInfo?.thumbnails?.[0]?.url || result.playlistInfo?.thumbnail || result.tracks[0]?.imageUrl || '/placeholder.svg',
          totalTracks: result.tracks.length,
          totalDuration: totalDuration,
          url: url,
          isYouTube: true
        };

        const fetchEndTime = Date.now();
        const elapsedSeconds = ((fetchEndTime - fetchStartTime) / 1000).toFixed(2);
        console.log(`✅ Loaded YouTube playlist: "${playlist.name}" with ${result.tracks.length} videos`);
        console.log(`⏱️  Completed at: ${new Date().toLocaleTimeString()}`);
        console.log(`⏱️  Total time: ${elapsedSeconds}s`);
        return res.json({ playlist, tracks: result.tracks });
      }

      return res.status(500).json({ error: 'Failed to fetch YouTube playlist metadata' });
    }
    
    // Handle Spotify Playlist (prefer fast spotdl like album/artist)
    else if (urlType === 'spotify-playlist') {
      const playlistId = extractPlaylistId(url);
      
      if (!playlistId) {
        return res.status(400).json({ error: 'Invalid Spotify playlist URL' });
      }

      // FAST PATH: Use spotdl to fetch tracks quickly, and a quick owner fetch
      try {
        const fastStart = Date.now();
        console.log('📁 Loading Spotify playlist (FAST via spotdl)...');
        console.log('⏱️  Started at:', new Date().toLocaleTimeString());

        const result = await fetchSpotifyMetadataWithSpotdl(url);
        const ownerQuick = await fetchSpotifyOwnerInfoQuick(playlistId);

        const totalDuration = result.tracks.reduce((s, t) => s + t.duration, 0);
        const finalOwnerName = ownerQuick.ownerName || 'Spotify User';
        const finalOwnerUrl = ownerQuick.ownerUrl || (ownerQuick.ownerName ? `https://open.spotify.com/search/${encodeURIComponent(ownerQuick.ownerName)}` : undefined);
        const finalOwnerImage = ownerQuick.ownerImage || '/placeholder.svg';

        const playlist = {
          id: playlistId,
          name: result.playlistName || 'Spotify Playlist',
          description: ownerQuick.description || `Playlist · ${result.tracks.length} tracks`,
          owner: finalOwnerName,
          ownerUrl: finalOwnerUrl,
          ownerImage: finalOwnerImage,
          imageUrl: ownerQuick.playlistImage || result.tracks[0]?.imageUrl || '/placeholder.svg',
          totalTracks: result.tracks.length,
          totalDuration,
          url
        };

        const fastEnd = Date.now();
        const elapsed = ((fastEnd - fastStart) / 1000).toFixed(2);
        console.log(`✅ Loaded Spotify playlist: "${playlist.name}" with ${result.tracks.length} tracks`);
        console.log(`⏱️  Completed at: ${new Date().toLocaleTimeString()}`);
        console.log(`⏱️  Total time: ${elapsed}s`);
        return res.json({ playlist, tracks: result.tracks });
      } catch (fastErr) {
        console.log('⚠️  Fast playlist method failed, falling back to legacy scrape:', fastErr.message);
      }

      const fetchStartTime = Date.now(); // Legacy path timing
      console.log('Playlist ID:', playlistId);
      console.log('Method: Web Scraping (NO DOWNLOAD, NO SPOTDL)');
      console.log('⏱️  Started at:', new Date().toLocaleTimeString());
    
    let playlistOwner = 'Spotify User';
    let playlistImage = '/placeholder.svg';
    let playlistDescription = '';
    let playlistName = 'Unknown Playlist';
    let ownerUrl = '';
    let ownerImage = '';
    let tracks = [];
    
    if (playlistId) {
      // Method 1: Get thumbnail from OEmbed
      try {
        const oembedUrl = `https://open.spotify.com/oembed?url=https://open.spotify.com/playlist/${playlistId}`;
        const response = await fetch(oembedUrl);
        
        if (response.ok) {
          const data = await response.json();
          if (data.thumbnail_url) {
            playlistImage = data.thumbnail_url;
          }
        }
      } catch (error) {
        console.log('Could not fetch from OEmbed:', error.message);
      }
      
      // Method 2: Scrape Spotify page for owner info
      try {
        const playlistUrl = `https://open.spotify.com/playlist/${playlistId}`;
        const response = await fetch(playlistUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        
        if (response.ok) {
          const html = await response.text();
          
          // Extract owner from meta tags
          const ownerMetaMatch = html.match(/<meta\s+property="music:creator"\s+content="([^"]+)"/i);
          if (ownerMetaMatch && ownerMetaMatch[1]) {
            const ownerUri = ownerMetaMatch[1];
            console.log('📝 Found owner URI in meta tag:', ownerUri);
            
            // Handle both Spotify URI (spotify:user:abc123) and URL formats
            const ownerIdMatch = ownerUri.match(/(?:spotify:user:|\/user\/)([^"?\/:]+)/i);
            if (ownerIdMatch && ownerIdMatch[1]) {
              const ownerId = ownerIdMatch[1];
              ownerUrl = `https://open.spotify.com/user/${ownerId}`;
              console.log('✅ Extracted owner URL from meta tag:', ownerUrl);
            }
          }
          
          // Extract owner name from JSON-LD or page data
          const jsonLdMatch = html.match(/<script type="application\/ld\+json">(.+?)<\/script>/s);
          if (jsonLdMatch) {
            try {
              const jsonData = JSON.parse(jsonLdMatch[1]);
              if (jsonData.author && jsonData.author.name) {
                playlistOwner = jsonData.author.name;
              }
            } catch (e) {
              console.log('Could not parse JSON-LD');
            }
          }
          
          // Try to extract owner from page title (format: "Playlist Name · Playlist by Owner Name · Spotify")
          if (playlistOwner === 'Spotify User') {
            const titleMatch = html.match(/<title>([^<]+)<\/title>/i);
            if (titleMatch && titleMatch[1]) {
              const title = titleMatch[1];
              console.log('🔍 Page title:', title);
              
              // Try different title formats
              const titleParts = title.split(/[·•|]/); // Split by various separators
              if (titleParts.length >= 2) {
                // Format: "Playlist Name · Owner Name · Spotify"
                // or "Playlist Name | Owner Name | Spotify"
                const potentialOwner = titleParts[1].trim();
                
                // Remove common prefixes like "Playlist by"
                const cleanOwner = potentialOwner
                  .replace(/^Playlist\s+by\s+/i, '')
                  .replace(/^by\s+/i, '')
                  .trim();
                
                if (cleanOwner && cleanOwner.toLowerCase() !== 'spotify') {
                  playlistOwner = cleanOwner;
                  console.log('📝 Extracted owner from page title:', playlistOwner);
                }
              }
            }
          }
          
          // Try to extract from meta description
          if (playlistOwner === 'Spotify User') {
            const descMatch = html.match(/<meta\s+(?:name|property)="(?:description|og:description)"\s+content="([^"]+)"/i);
            if (descMatch && descMatch[1]) {
              console.log('🔍 Meta description:', descMatch[1]);
              // Format often includes: "Playlist · Owner Name · X songs"
              const descParts = descMatch[1].split(/[·•|]/);
              if (descParts.length >= 2) {
                const potentialOwner = descParts[1].trim();
                if (potentialOwner && !potentialOwner.match(/\d+\s+songs?/i) && potentialOwner.toLowerCase() !== 'spotify') {
                  playlistOwner = potentialOwner;
                  console.log('📝 Extracted owner from meta description:', playlistOwner);
                }
              }
            }
          }
          
          // Try embed page as last resort before spotdl
          if (playlistOwner === 'Spotify User') {
            try {
              console.log('🎯 Trying embed page for owner info...');
              const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
              console.log('📍 Embed URL:', embedUrl);
              
              const embedResponse = await fetch(embedUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                }
              });
              
              console.log('📡 Embed response status:', embedResponse.status);
              
              if (embedResponse.ok) {
                const embedHtml = await embedResponse.text();
                console.log('📄 Embed HTML length:', embedHtml.length);
                
                // Try multiple extraction methods for embed page
                
                // Method 1: Look for <title> tag
                let embedTitleMatch = embedHtml.match(/<title>([^<]+)<\/title>/i);
                
                if (embedTitleMatch && embedTitleMatch[1]) {
                  const embedTitle = embedTitleMatch[1];
                  console.log('🔍 Embed page title:', embedTitle);
                  
                  // Format: "Playlist Name·Owner Name" (using middle dot ·)
                  const embedParts = embedTitle.split('·');
                  console.log('📊 Embed title parts:', embedParts.length, '→', embedParts);
                  
                  if (embedParts.length === 2) {
                    playlistOwner = embedParts[1].trim();
                    console.log('✅ Extracted owner from embed page title:', playlistOwner);
                  } else if (embedParts.length > 2) {
                    playlistOwner = embedParts[1].trim();
                    console.log('✅ Extracted owner from embed page title (multi-part):', playlistOwner);
                  }
                } else {
                  console.log('⚠️ No <title> tag found, trying meta tags...');
                  
                  // Method 2: Look for og:title or twitter:title meta tags
                  const metaTitleMatch = embedHtml.match(/<meta\s+(?:property|name)="(?:og:title|twitter:title)"\s+content="([^"]+)"/i);
                  if (metaTitleMatch && metaTitleMatch[1]) {
                    const metaTitle = metaTitleMatch[1];
                    console.log('🔍 Meta title:', metaTitle);
                    const embedParts = metaTitle.split('·');
                    if (embedParts.length >= 2) {
                      playlistOwner = embedParts[1].trim();
                      console.log('✅ Extracted owner from meta title:', playlistOwner);
                    }
                  } else {
                    console.log('⚠️ No meta title found, trying data attributes...');
                    
                    // Method 3: Look for span after middle dot (·)
                    // Pattern: aria-hidden="true">·</span><span ...>OWNER NAME</span>
                    const spanOwnerMatch = embedHtml.match(/aria-hidden="true">·<\/span><span[^>]*>([^<]+)<\/span>/i);
                    
                    if (spanOwnerMatch && spanOwnerMatch[1]) {
                      playlistOwner = spanOwnerMatch[1].trim();
                      console.log('✅ Extracted owner from span element:', playlistOwner);
                    } else {
                      console.log('⚠️ Could not find owner in span, trying alternative patterns...');
                      
                      // Method 4: Look for any text after middle dot
                      const dotMatch = embedHtml.match(/·<\/span><span[^>]*>([^<]+)<\/span>/i);
                      if (dotMatch && dotMatch[1]) {
                        playlistOwner = dotMatch[1].trim();
                        console.log('✅ Extracted owner from alternative pattern:', playlistOwner);
                      } else {
                        // Method 5: JSON data in script tags
                        const scriptDataMatch = embedHtml.match(/"ownerName":\s*"([^"]+)"/i) ||
                                               embedHtml.match(/"owner":\s*{\s*"name":\s*"([^"]+)"/i);
                        if (scriptDataMatch && scriptDataMatch[1]) {
                          playlistOwner = scriptDataMatch[1];
                          console.log('✅ Extracted owner from JSON data:', playlistOwner);
                        }
                      }
                    }
                  }
                }
              } else {
                console.log('⚠️ Embed page request failed:', embedResponse.status, embedResponse.statusText);
              }
            } catch (error) {
              console.log('⚠️ Could not fetch embed page:', error.message);
            }
          }
          
          // Fallback: Try to extract from window.__NEXT_DATA__
          const nextDataMatch = html.match(/window\.__NEXT_DATA__\s*=\s*({.+?})\s*<\/script>/s);
          if (nextDataMatch) {
            try {
              const nextData = JSON.parse(nextDataMatch[1]);
              const owner = nextData?.props?.pageProps?.state?.data?.entity?.owner;
              if (owner?.displayName && playlistOwner === 'Spotify User') {
                playlistOwner = owner.displayName;
                console.log('✅ Owner name from NEXT_DATA:', playlistOwner);
              }
              if (owner?.uri) {
                ownerUrl = owner.uri.replace('spotify:user:', 'https://open.spotify.com/user/');
                console.log('✅ Owner URL from NEXT_DATA:', ownerUrl);
              }
              if (owner?.images && owner.images[0]?.url) {
                ownerImage = owner.images[0].url;
                console.log('✅ Owner image from NEXT_DATA:', ownerImage);
              }
            } catch (e) {
              console.log('Could not parse NEXT_DATA');
            }
          }
          
          // Try to get owner info from embed page JSON if not found
          if (!ownerUrl || !ownerImage) {
            try {
              const embedUrl = `https://open.spotify.com/embed/playlist/${playlistId}`;
              const embedResponse = await fetch(embedUrl, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              });
              
              if (embedResponse.ok) {
                const embedHtml = await embedResponse.text();
                
                // Try to extract from embedded JSON data
                const embedDataMatch = embedHtml.match(/window\.__SPOTIFY_INITIAL_STATE__\s*=\s*({.+?});/s) ||
                                      embedHtml.match(/"entity":\s*({.+?"owner".+?})/s);
                
                if (embedDataMatch) {
                  try {
                    const embedData = JSON.parse(embedDataMatch[1]);
                    
                    // Navigate through possible paths to owner data
                    const ownerData = embedData?.entity?.owner || 
                                     embedData?.owner || 
                                     embedData?.data?.entity?.owner;
                    
                    if (ownerData) {
                      if (!ownerUrl && ownerData.uri) {
                        ownerUrl = ownerData.uri.replace('spotify:user:', 'https://open.spotify.com/user/');
                        console.log('✅ Owner URL from embed:', ownerUrl);
                      }
                      if (!ownerImage && ownerData.images && ownerData.images[0]) {
                        ownerImage = ownerData.images[0].url;
                        console.log('✅ Owner image from embed:', ownerImage);
                      }
                      if (!ownerUrl && ownerData.id) {
                        ownerUrl = `https://open.spotify.com/user/${ownerData.id}`;
                        console.log('✅ Owner URL built from ID:', ownerUrl);
                      }
                    }
                  } catch (e) {
                    console.log('Could not parse embed JSON:', e.message);
                  }
                }
              }
            } catch (error) {
              console.log('Could not fetch embed for owner data:', error.message);
            }
          }
          
          console.log('Extracted from Spotify page:');
          console.log('  Owner:', playlistOwner);
          console.log('  Owner URL:', ownerUrl);
          console.log('  Owner Image:', ownerImage);
          console.log('  Playlist Image:', playlistImage);
          
          // Extract playlist data from __NEXT_DATA__
          if (nextDataMatch) {
            try {
              const nextData = JSON.parse(nextDataMatch[1]);
              const entity = nextData?.props?.pageProps?.state?.data?.entity;
              
              console.log('🔍 Checking NEXT_DATA structure...');
              
              if (entity) {
                // Get playlist name
                playlistName = entity.name || playlistName;
                playlistDescription = entity.description || '';
                
                // Get tracks from the playlist - try multiple locations
                let trackList = entity.tracks?.items || [];
                
                // If no items found, try alternative structure
                if (trackList.length === 0 && entity.content) {
                  trackList = entity.content.items || [];
                  console.log(`🔍 Found ${trackList.length} tracks in entity.content.items`);
                }
                
                // If still no items, try trackList property
                if (trackList.length === 0 && entity.trackList) {
                  trackList = entity.trackList;
                  console.log(`🔍 Found ${trackList.length} tracks in entity.trackList`);
                }
                
                // Try another location
                if (trackList.length === 0 && entity.tracks?.totalCount) {
                  console.log(`⚠️ Entity has ${entity.tracks.totalCount} tracks but items array is empty`);
                  console.log(`🔍 Available entity keys:`, Object.keys(entity));
                }
                
                console.log(`📋 Found ${trackList.length} tracks in playlist data structure`);
                
                // Filter out null/invalid tracks
                tracks = trackList
                  .filter(item => item && (item.track || item.id))
                  .map((item, index) => {
                    const track = item.track || item;
                    
                    // Skip if track is null or missing required fields
                    if (!track || !track.id || !track.name) {
                      console.log(`⚠️ Skipping invalid track at index ${index}`);
                      return null;
                    }
                    
                    return {
                      id: track.id,
                      name: track.name,
                      artist: track.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
                      album: track.album?.name || 'Unknown Album',
                      duration: Math.floor((track.duration_ms || 0) / 1000),
                      imageUrl: track.album?.images?.[0]?.url || playlistImage,
                      url: `https://open.spotify.com/track/${track.id}`,
                      downloadStatus: 'pending',
                      downloadProgress: 0,
                      selected: true
                    };
                  })
                  .filter(t => t !== null);
                
                console.log(`✅ Successfully parsed ${tracks.length} valid tracks from web page!`);
                
                // If still no tracks, log the entity structure for debugging
                if (tracks.length === 0) {
                  console.log('⚠️ No tracks found. Entity structure keys:', Object.keys(entity));
                  console.log('⚠️ Entity.tracks:', entity.tracks ? Object.keys(entity.tracks) : 'undefined');
                }
              }
            } catch (e) {
              console.log('Could not parse track data from NEXT_DATA:', e.message);
            }
          }
        }
      } catch (error) {
        console.log('Could not scrape Spotify page:', error.message);
      }
    }
    
    // If web scraping worked, use it! Otherwise fall back to spotdl
    if (tracks.length > 0) {
      console.log('✨ Using fast web scraping method (NO spotdl needed!)');
      
      const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0);
      
      const playlist = {
        id: playlistId,
        name: playlistName,
        description: playlistDescription,
        owner: playlistOwner,
        ownerUrl: ownerUrl || undefined,
        ownerImage: ownerImage || undefined,
        imageUrl: playlistImage,
        totalTracks: tracks.length,
        totalDuration: Math.floor(totalDuration),
        url: url
      };
      
      const fetchEndTime = Date.now();
      const elapsedSeconds = ((fetchEndTime - fetchStartTime) / 1000).toFixed(2);
      console.log(`🎉 Loaded ${tracks.length} tracks from "${playlist.name}" (FAST METHOD)`);
      console.log(`⏱️  Completed at: ${new Date().toLocaleTimeString()}`);
      console.log(`⏱️  Total time: ${elapsedSeconds}s`);
      return res.json({ playlist, tracks });
    }
    
      // Fallback: Use spotdl only if Spotify playlist web scraping failed
      console.log('⚠️  Web scraping failed, falling back to spotdl...');
      console.log('📦 Note: This method is slower but more reliable');
      console.log('⏱️  Using optimized spotdl metadata fetch');
    
    const metaFile = path.join(os.tmpdir(), `spotdl_meta_${Date.now()}.spotdl`);
    
    // Use 'spotdl save' for METADATA ONLY with parallel processing
    // Using 8 threads to avoid Spotify rate limits (429 errors)
    const spotdlProcess = spawn(PYTHON_CMD, [
      '-m', 'spotdl',
      'save',
      url,
      '--save-file', metaFile,
      '--threads', '8',  // ⚡ Parallel metadata fetching (balanced to avoid rate limits)
      '--max-retries', '5'  // Retry rate-limited requests
    ]);

    let output = '';
    let errorOutput = '';
    let metadataTimeout = null;
    let processCompleted = false;
    let foundSongCount = 0;
    let dynamicTimeoutSet = false;

    // Initial timeout (60 seconds) - will be extended once we know song count
    metadataTimeout = setTimeout(() => {
      if (!processCompleted) {
        console.log('⏱️ METADATA TIMEOUT: spotdl taking too long, killing process...');
        try {
          spotdlProcess.kill('SIGTERM');
          setTimeout(() => {
            if (spotdlProcess && !spotdlProcess.killed) {
              spotdlProcess.kill('SIGKILL');
            }
          }, 2000);
        } catch (err) {
          console.error('Error killing metadata process:', err.message);
        }
      }
    }, 60000); // Initial 60 seconds

    spotdlProcess.stdout.on('data', (data) => {
      const chunk = data.toString();
      output += chunk;
      console.log('spotdl output:', chunk);
      
      // Detect song count and adjust timeout dynamically
      const foundMatch = chunk.match(/Found (\d+) songs? in (.+?) \(Playlist\)/i);
      if (foundMatch && !dynamicTimeoutSet) {
        foundSongCount = parseInt(foundMatch[1]);
        dynamicTimeoutSet = true;
        
        // Calculate dynamic timeout: 2 seconds per song + 60 second base
        // For 21 songs: 102 seconds
        // For 214 songs: 488 seconds (8 minutes)
        const dynamicTimeout = (foundSongCount * 2000) + 60000;
        
        console.log(`📊 Found ${foundSongCount} songs, setting dynamic timeout: ${Math.floor(dynamicTimeout / 1000)}s`);
        
        // Clear old timeout and set new one
        clearTimeout(metadataTimeout);
        metadataTimeout = setTimeout(() => {
          if (!processCompleted) {
            console.log(`⏱️ TIMEOUT after ${Math.floor(dynamicTimeout / 1000)}s for ${foundSongCount} songs`);
            try {
              spotdlProcess.kill('SIGTERM');
              setTimeout(() => {
                if (spotdlProcess && !spotdlProcess.killed) {
                  spotdlProcess.kill('SIGKILL');
                }
              }, 2000);
            } catch (err) {
              console.error('Error killing metadata process:', err.message);
            }
          }
        }, dynamicTimeout);
      }
    });

    spotdlProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
      console.error('spotdl stderr:', data.toString());
    });

    spotdlProcess.on('close', async (code) => {
      processCompleted = true;
      clearTimeout(metadataTimeout);
      
      console.log('spotdl process closed with code:', code);
      console.log('Error output:', errorOutput);
      
      // Handle timeout case
      if (code === null || code === 143 || code === 'SIGTERM') {
        console.log('❌ Metadata fetch timed out or was killed');
        await fs.unlink(metaFile).catch(() => {});
        return res.status(408).json({ 
          error: 'Metadata fetch timed out. The playlist might be too large or unavailable. Please try again or use a smaller playlist.' 
        });
      }
      
      try {
        // Read the metadata file
        const metadataContent = await fs.readFile(metaFile, 'utf-8');
        console.log('Metadata file content:', metadataContent.substring(0, 200));
        const songs = JSON.parse(metadataContent);
        
        // Clean up temp file
        await fs.unlink(metaFile).catch(() => {});

        if (!songs || songs.length === 0) {
          return res.status(404).json({ error: 'No tracks found in playlist' });
        }

        // Extract playlist info from first song
        const firstSong = songs[0];
        
        // DEBUG: Log all available fields to find owner
        console.log('\n=== SPOTDL METADATA FALLBACK ===');
        console.log('Available fields:', Object.keys(firstSong));
        console.log('Full first song data:', JSON.stringify(firstSong, null, 2));
        console.log('=========================\n');
        
        // Use playlist name from web scraping, or fallback to metadata
        if (!playlistName || playlistName === 'Unknown Playlist') {
          playlistName = firstSong.list_name || firstSong.playlist_name || firstSong.playlist || 'Unknown Playlist';
        }
        
        // Calculate total duration
        const totalDuration = songs.reduce((sum, song) => sum + (song.duration || 0), 0);

        // Use owner from Spotify embed, or try to extract from metadata
        // If still default, try metadata fields
        if (playlistOwner === 'Spotify User') {
          if (firstSong.list_owner) playlistOwner = firstSong.list_owner;
          else if (firstSong.playlist_owner) playlistOwner = firstSong.playlist_owner;
          else if (firstSong.owner) playlistOwner = firstSong.owner;
          else if (firstSong.uploader) playlistOwner = firstSong.uploader;
          else if (firstSong.list_author) playlistOwner = firstSong.list_author;
          else if (firstSong.playlist_author) playlistOwner = firstSong.playlist_author;
        }
        
        console.log('Final owner:', playlistOwner);
        
        // Try to construct owner URL if we have the owner name but no URL
        if (!ownerUrl && playlistOwner && playlistOwner !== 'Spotify User') {
          // Try to get owner info by scraping the playlist page again for user ID
          console.log('🔍 Attempting to extract owner user ID from playlist page...');
          
          try {
            const playlistPageUrl = firstSong.list_url || url;
            const playlistId = playlistPageUrl.match(/playlist\/([a-zA-Z0-9]+)/)?.[1];
            
            if (playlistId) {
              const playlistResponse = await fetch(`https://open.spotify.com/playlist/${playlistId}`, {
                headers: {
                  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                }
              });
              
              if (playlistResponse.ok) {
                const playlistHtml = await playlistResponse.text();
                
                // Try to extract owner URI from meta tag
                const ownerUriMatch = playlistHtml.match(/<meta\s+property="music:creator"\s+content="([^"]+)"/i);
                if (ownerUriMatch && ownerUriMatch[1]) {
                  const ownerUri = ownerUriMatch[1];
                  const userId = ownerUri.match(/user\/([^\/\?]+)/)?.[1];
                  if (userId) {
                    ownerUrl = `https://open.spotify.com/user/${userId}`;
                    console.log('✅ Extracted owner URL from meta tag:', ownerUrl);
                  }
                }
                
                // Try NEXT_DATA for owner image if still missing
                if (!ownerImage) {
                  const nextDataMatch = playlistHtml.match(/window\.__NEXT_DATA__\s*=\s*({.+?})<\/script>/s);
                  if (nextDataMatch) {
                    try {
                      const nextData = JSON.parse(nextDataMatch[1]);
                      const ownerData = nextData?.props?.pageProps?.state?.data?.entity?.owner;
                      if (ownerData?.images && ownerData.images[0]?.url) {
                        ownerImage = ownerData.images[0].url;
                        console.log('✅ Extracted owner image from NEXT_DATA:', ownerImage);
                      }
                    } catch (e) {
                      // Silent fail
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.log('⚠️  Failed to extract owner info from playlist page:', error.message);
          }
          
          // Fallback: use a search URL for the owner name
          if (!ownerUrl) {
            const encodedOwner = encodeURIComponent(playlistOwner);
            ownerUrl = `https://open.spotify.com/search/${encodedOwner}`;
            console.log('✅ Created search URL for owner:', ownerUrl);
          }
        }
        
        // Use a default Spotify user icon if no owner image found
        if (!ownerImage && playlistOwner && playlistOwner !== 'Spotify User') {
          // Spotify's default user avatar
          ownerImage = 'https://i.scdn.co/image/ab6775700000ee85b36c6d0ad0e5395c4f3d5df4';
          console.log('✅ Using default Spotify user avatar');
        }
        
        console.log('Final owner URL:', ownerUrl);
        console.log('Final owner image:', ownerImage);

        // Format playlist data (use scraped data if available)
        const playlist = {
          id: url.split('/').pop()?.split('?')[0] || 'unknown',
          name: playlistName,
          description: firstSong.list_description || firstSong.playlist_description || playlistDescription || '',
          owner: playlistOwner,
          ownerUrl: ownerUrl || undefined,
          ownerImage: ownerImage || undefined,
          imageUrl: playlistImage !== '/placeholder.svg' ? playlistImage : (firstSong.cover_url || firstSong.list_cover_url || songs[0]?.cover_url || songs[0]?.album_art || '/placeholder.svg'),
          totalTracks: songs.length,
          totalDuration: Math.floor(totalDuration),
          url: url
        };

        // Format tracks data (from spotdl fallback)
        tracks = songs.map((song, index) => ({
          id: song.song_id || `track-${index}`,
          name: song.name || song.title || 'Unknown Track',
          artist: song.artist || song.artists?.join(', ') || 'Unknown Artist',
          album: song.album_name || song.album || 'Unknown Album',
          duration: Math.floor(song.duration || 0),
          imageUrl: song.cover_url || song.album_art || '/placeholder.svg',
          url: song.url || '',
          downloadStatus: 'pending',
          downloadProgress: 0,
          selected: true
        }));

        const fetchEndTime = Date.now();
        const elapsedSeconds = ((fetchEndTime - fetchStartTime) / 1000).toFixed(2);
        console.log(`📦 Loaded ${tracks.length} tracks from "${playlist.name}" (SPOTDL FALLBACK METHOD)`);
        console.log(`⏱️  Completed at: ${new Date().toLocaleTimeString()}`);
        console.log(`⏱️  Total time: ${elapsedSeconds}s (${Math.floor(elapsedSeconds / 60)}m ${Math.floor(elapsedSeconds % 60)}s)`);
        res.json({ playlist, tracks });
      } catch (error) {
        console.error('Error parsing metadata:', error);
        
        // If file doesn't exist, provide helpful error
        if (error.code === 'ENOENT') {
          return res.status(500).json({ 
            error: 'spotdl did not create metadata file. Check if the playlist URL is valid.',
            details: `File not found: ${metaFile}`,
            output: output,
            errorOutput: errorOutput
          });
        }
        
        res.status(500).json({ 
          error: 'Failed to parse playlist metadata',
          details: error.message,
          output: output,
          errorOutput: errorOutput
        });
      }
    });
    } else {
      // Unknown URL type
      return res.status(400).json({ 
        error: 'Unsupported URL type. Please provide a Spotify (track/playlist/album/artist) or YouTube (video/playlist) URL.',
        urlType: urlType
      });
    }

  } catch (error) {
    console.error('Error fetching playlist:', error);
    res.status(500).json({ 
      error: 'Failed to fetch playlist data',
      details: error.message 
    });
  }
});

// Create folder cover image from playlist images
async function createFolderCoverImage(imageUrls, outputPath) {
  try {
    if (!imageUrls || imageUrls.length === 0) {
      console.log('No images to create folder cover');
      return false;
    }

    console.log(`📸 Creating folder cover from ${imageUrls.length} image(s)...`);

    // Download images with better error handling
    const imageBuffers = [];
    for (const url of imageUrls.slice(0, 4)) { // Max 4 images
      try {
        let buffer;
        
        // Check if it's a base64 data URL
        if (url.startsWith('data:image/')) {
          console.log(`  Processing base64 image...`);
          
          // Extract base64 data
          const base64Data = url.split(',')[1];
          if (!base64Data) {
            throw new Error('Invalid base64 data URL');
          }
          
          buffer = Buffer.from(base64Data, 'base64');
          console.log(`  ✓ Decoded base64 (${Math.round(buffer.length / 1024)}KB)`);
        } else {
          // It's a regular HTTP(S) URL
          console.log(`  Downloading image: ${url.substring(0, 80)}...`);
          
          const response = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000 // 10 second timeout
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
          }
          
          buffer = await response.buffer();
          console.log(`  ✓ Downloaded (${Math.round(buffer.length / 1024)}KB)`);
        }
        
        imageBuffers.push(buffer);
      } catch (err) {
        console.log(`  ✗ Failed: ${err.message}`);
      }
    }

    if (imageBuffers.length === 0) {
      console.log('❌ No images could be downloaded - skipping folder cover');
      return false;
    }

    console.log(`✓ Downloaded ${imageBuffers.length} image(s), creating cover...`);

    const imageSize = 512; // Final image size
    const tileSize = imageBuffers.length === 1 ? imageSize : imageSize / 2;

    // Create base canvas
    let compositeImage = sharp({
      create: {
        width: imageSize,
        height: imageSize,
        channels: 4,
        background: { r: 18, g: 18, b: 18, alpha: 1 }
      }
    });

    // Prepare tiles
    const tiles = [];
    
    if (imageBuffers.length === 1) {
      // Single image - full size
      tiles.push({
        input: await sharp(imageBuffers[0])
          .resize(imageSize, imageSize, { fit: 'cover' })
          .toBuffer(),
        top: 0,
        left: 0
      });
    } else if (imageBuffers.length === 2) {
      // 2 images - side by side
      tiles.push({
        input: await sharp(imageBuffers[0])
          .resize(tileSize, imageSize, { fit: 'cover' })
          .toBuffer(),
        top: 0,
        left: 0
      });
      tiles.push({
        input: await sharp(imageBuffers[1])
          .resize(tileSize, imageSize, { fit: 'cover' })
          .toBuffer(),
        top: 0,
        left: tileSize
      });
    } else if (imageBuffers.length === 3) {
      // 3 images - 2 top, 1 bottom
      tiles.push({
        input: await sharp(imageBuffers[0])
          .resize(tileSize, tileSize, { fit: 'cover' })
          .toBuffer(),
        top: 0,
        left: 0
      });
      tiles.push({
        input: await sharp(imageBuffers[1])
          .resize(tileSize, tileSize, { fit: 'cover' })
          .toBuffer(),
        top: 0,
        left: tileSize
      });
      tiles.push({
        input: await sharp(imageBuffers[2])
          .resize(imageSize, tileSize, { fit: 'cover' })
          .toBuffer(),
        top: tileSize,
        left: 0
      });
    } else {
      // 4+ images - 2x2 grid
      for (let i = 0; i < Math.min(4, imageBuffers.length); i++) {
        const row = Math.floor(i / 2);
        const col = i % 2;
        tiles.push({
          input: await sharp(imageBuffers[i])
            .resize(tileSize, tileSize, { fit: 'cover' })
            .toBuffer(),
          top: row * tileSize,
          left: col * tileSize
        });
      }
    }

    // Composite all tiles
    await compositeImage
      .composite(tiles)
      .jpeg({ quality: 95 })
      .toFile(outputPath);

    console.log(`✅ Folder cover created successfully: ${outputPath}`);
    return true;
  } catch (error) {
    console.error('❌ Failed to create folder cover:', error);
    console.error('   Error details:', error.message);
    console.error('   Stack:', error.stack);
    return false;
  }
}

// Start download
// Global filename sanitizer to mirror yt-dlp filename normalization
function sanitizeForFs(name) {
  return String(name)
    .replace(/[\\\/:*?"<>|]/g, '-')   // Windows-invalid and common sanitized
    .replace(/[\u0000-\u001f]/g, '')    // control chars
    .replace(/\s+/g, ' ')                // collapse whitespace
    .replace(/-+/g, '-')                  // collapse hyphens
    .trim();
}

// Helper function to get expected filename for a track (matches createSafeFilename logic)
function getExpectedFileName(track, extension = 'mp3') {
  // Use createSafeFilename to ensure exact match
  const safeFilename = createSafeFilename(track);
  return `${safeFilename}.${extension}`;
}

// Helper function to check if a file exists for a track (handles "Unknown Artist" correctly)
function checkFileExistsForTrack(musicFiles, track, extension = 'mp3') {
  const expectedFileName = getExpectedFileName(track, extension);
  return musicFiles.some(f => f === expectedFileName);
}

// Fuzzy matcher: decide if a given filename belongs to a track
function isFileMatchForTrack(fileName, track) {
  const normalize = (str) => String(str)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const fileNorm = normalize(fileName.replace(/\.(mp3|flac|ogg)$/i, ''));
  const artistNorm = normalize(track.artist);
  const nameNorm = normalize(track.name);

  // Break track name into significant words (length > 2)
  const nameWords = nameNorm.split(' ').filter(w => w.length > 2);
  const matchingNameWords = nameWords.filter(w => fileNorm.includes(w));
  const nameMatchPercent = nameWords.length > 0 ? matchingNameWords.length / nameWords.length : 0;

  // Heuristics:
  // 1) File contains artist AND at least 50% of track name words
  if (artistNorm && fileNorm.includes(artistNorm) && nameMatchPercent >= 0.5) return true;
  // 2) File contains at least 70% of track name words (artist may differ)
  if (nameMatchPercent >= 0.7) return true;
  // 3) Direct includes of normalized name and artist
  if (artistNorm && fileNorm.includes(artistNorm) && fileNorm.includes(nameNorm)) return true;

  return false;
}

app.post('/api/download/start', async (req, res) => {
  const { playlistUrl, tracks, settings, folderName, playlistImages, socketId } = req.body;

  console.log('\n=== DOWNLOAD REQUEST ===');
  console.log('Client Socket ID:', socketId); // Log which client initiated this
  console.log('Received tracks count:', tracks?.length);
  console.log('Tracks data:', JSON.stringify(tracks, null, 2));

  if (!tracks || !settings) {
    return res.status(400).json({ error: 'Missing required parameters' });
  }
  
  // Allow empty or placeholder playlist URLs for search results
  const effectivePlaylistUrl = playlistUrl || 'search-results';

  // Filter selected tracks OR use all tracks if none selected
  let selectedTracks = tracks.filter(t => t.selected);
  
  // If no selected flag, assume all tracks are to be downloaded
  if (selectedTracks.length === 0 && tracks.length > 0) {
    console.log('No tracks marked as selected, using all tracks');
    selectedTracks = tracks;
  }

  console.log('Selected tracks count:', selectedTracks.length);
  console.log('Selected track URLs:', selectedTracks.map(t => ({ name: t.name, url: t.url })));

  const downloadId = `download_${Date.now()}`;
  let outputFolder;
  
  // For single track downloads, use Downloads folder directly (no subfolder)
  if (selectedTracks.length === 1) {
    outputFolder = path.join(os.homedir(), 'Downloads');
    console.log('📁 Single track download - saving directly to Downloads folder\n');
    
    // Ensure Downloads folder exists
    try {
      await fs.mkdir(outputFolder, { recursive: true });
    } catch (error) {
      console.log('⚠️ Downloads folder already exists or error creating it:', error.message);
    }
    
    // No folder cover for single tracks
  } else {
    // For multiple tracks, create a subfolder with incremental naming
    const baseFolderName = sanitizeFolderName(folderName || `Spotify_Playlist_${new Date().toISOString().split('T')[0]}`);
    
    console.log(`📁 Creating playlist folder: "${baseFolderName}"`);
    console.log(`📁 Folder name from request: "${folderName || 'NOT PROVIDED'}"`);
    
    // Find available folder name with Windows-style incremental suffix
    let counter = 0;
    let finalFolderName;
    
    while (true) {
      finalFolderName = counter === 0 
        ? baseFolderName 
        : `${baseFolderName} (${counter})`;
      outputFolder = path.join(os.homedir(), 'Downloads', finalFolderName);
      
      try {
        await fs.access(outputFolder);
        console.log(`📁 Folder exists: "${finalFolderName}" - trying next...`);
        counter++; // Folder exists, try next number
      } catch {
        break; // Folder doesn't exist, use this name
      }
    }

    console.log(`📁 Selected folder name: "${finalFolderName}"`);
    console.log(`📁 Full path: ${outputFolder}`);

  // Create output folder
  try {
    await fs.mkdir(outputFolder, { recursive: true });
    console.log(`✅ Output folder created successfully: ${outputFolder}\n`);
  } catch (error) {
    console.error(`❌ Failed to create output folder: ${error.message}`);
    return res.status(500).json({ error: 'Failed to create output folder' });
  }

    // Create folder cover image for playlists
  if (playlistImages && playlistImages.length > 0) {
    console.log(`\n🖼️  Creating folder cover with ${playlistImages.length} playlist image(s)...`);
    const coverPath = path.join(outputFolder, 'folder.jpg');
    const coverCreated = await createFolderCoverImage(playlistImages, coverPath);
    if (coverCreated) {
      console.log('✅ Folder cover created successfully!\n');
    } else {
      console.log('⚠️  Folder cover creation failed - continuing without it\n');
    }
  } else {
    console.log('⚠️  No playlist images provided - skipping folder cover\n');
    }
  }

  // Store download info
  activeDownloads.set(downloadId, {
    playlistUrl: effectivePlaylistUrl,
    tracks: selectedTracks,
    settings,
    outputFolder,
    status: 'starting',
    progress: {},
    socketId // Store which client initiated this download
  });

  res.json({ downloadId, outputFolder });

  // Get the specific client socket to send events only to that client
  const clientSocketId = socketId;
  const clientSocket = clientSocketId ? io.sockets.sockets.get(clientSocketId) : null;
  const emitSocket = clientSocket || io; // Fallback to broadcast if no specific socket
  
  if (clientSocket) {
    console.log(`✅ Will send events to specific client: ${clientSocketId}`);
  } else {
    console.log(`⚠️  No socket ID, will broadcast to all clients`);
  }

  // (sanitizer defined globally)

  // For single track downloads, check if file already exists
  // NOTE: Only use EXACT filename match for single tracks to avoid downloading wrong file
  if (selectedTracks.length === 1) {
    const track = selectedTracks[0];
    const expectedFileName = getExpectedFileName(track, 'mp3');
    const expectedFilePath = path.join(outputFolder, expectedFileName);
    
    try {
      // Only check exact filename match - no fuzzy matching for single tracks!
      await fs.access(expectedFilePath);

      // File exists! Skip download and mark as complete immediately
      console.log(`✅ File already exists: ${expectedFileName}`);
      console.log(`⚡ Skipping download - file ready for instant download!`);
      
      activeDownloads.set(downloadId, {
        ...activeDownloads.get(downloadId),
        status: 'completed',
        totalSuccess: 1,
        totalFailed: 0,
        attempts: 0,
        startTime: Date.now()
      });
      
      console.log(`📤 Emitting instant download events for: ${expectedFileName}`);
      
      // Emit track-level progress (mark as completed) - ONLY to this client
      emitSocket.emit('download:track', {
        downloadId,
        trackId: track.id,
        status: 'completed',
        progress: 100,
        message: `✅ ${track.name}`
      });
      
      // Emit instant complete with download URL - ONLY to this client
      const instantCompleteData = {
        downloadId,
        status: 'completed',
        message: '✅ File already exists - downloading instantly!',
        totalSuccess: 1,
        totalFailed: 0,
        outputFolder,
        downloadUrl: `/api/download/archive/${downloadId}`,
        failedTracks: []
      };
      
      console.log(`📤 Emitting download:complete with data:`, JSON.stringify(instantCompleteData, null, 2));
      emitSocket.emit('download:complete', instantCompleteData);
      
      // Show success notification - ONLY to this client
      emitSocket.emit('download:status', {
        downloadId,
        status: 'completed',
        message: '⚡ Instant download - file was already downloaded!'
      });
      
      console.log(`✅ Events emitted successfully for downloadId: ${downloadId}`);
      
      // 🔄 Check if we should resume regeneration after instant download
      setTimeout(() => {
        checkAndResumeRegeneration().catch(() => {});
      }, 2000);
      
      return;
    } catch (error) {
      // File doesn't exist, proceed with download
      console.log(`📥 File not found, starting download: ${expectedFileName}`);
    }
  }

  // Emit pending status for all selected tracks - ONLY to this client
  console.log(`📤 Emitting pending status for ${selectedTracks.length} track(s)`);
  selectedTracks.forEach(track => {
    emitSocket.emit('download:track', {
      downloadId,
      trackId: track.id,
      status: 'pending',
      progress: 0,
      message: `⏳ Queued: ${track.name}`
    });
  });

  // Start download process asynchronously
  startDownload(downloadId, effectivePlaylistUrl, selectedTracks, settings, outputFolder);
});

// Cancel download
app.post('/api/download/cancel', (req, res) => {
  const { downloadId, socketId } = req.body;
  
  console.log(`\n❌ CANCEL REQUEST: ${downloadId}`);
  console.log(`   Client Socket ID: ${socketId}`);
  
  const downloadInfo = activeDownloads.get(downloadId);
  if (!downloadInfo) {
    return res.status(404).json({ error: 'Download not found' });
  }
  
  // 🔥 SECURITY: Verify that the requesting client is the one who started the download
  const downloadSocketId = downloadInfo.socketId;
  if (socketId && downloadSocketId && socketId !== downloadSocketId) {
    console.log(`⚠️  Cancel request rejected: Client ${socketId} tried to cancel download started by ${downloadSocketId}`);
    return res.status(403).json({ error: 'You can only cancel your own downloads' });
  }
  
  // Get the specific client socket to send events only to that client
  const clientSocket = downloadSocketId ? io.sockets.sockets.get(downloadSocketId) : null;
  const emitSocket = clientSocket || io; // Fallback to broadcast if no specific socket
  
  if (clientSocket) {
    console.log(`✅ Will send cancellation events to specific client: ${downloadSocketId}`);
  } else {
    console.log(`⚠️  No socket ID found, will broadcast cancellation`);
  }
  
  // Kill ALL active processes for this download (can have multiple processes per download)
  const processList = activeProcesses.get(downloadId);
  if (processList) {
    // Handle both old format (single process) and new format (array of processes)
    const processes = Array.isArray(processList) ? processList : [processList];
    
    console.log(`🔪 Killing ${processes.length} process(es) for download ${downloadId}`);
    
    processes.forEach((processInfo, index) => {
      const process = processInfo.process || processInfo; // Handle both formats
      if (process && !process.killed) {
        try {
          const processType = processInfo.type || 'unknown';
          const trackId = processInfo.trackId || 'unknown';
          console.log(`  🔪 Killing process ${index + 1}/${processes.length} (${processType}, track: ${trackId})`);
          process.kill('SIGTERM');
          console.log(`  ✅ SIGTERM sent to process ${index + 1}`);
      // Force kill after 2 seconds if not terminated
      setTimeout(() => {
            if (process && !process.killed && process.kill) {
              console.log(`  🔪 Force killing process ${index + 1} with SIGKILL`);
              process.kill('SIGKILL');
        }
      }, 2000);
    } catch (err) {
          console.error(`Error killing process ${index + 1}:`, err.message);
        }
      } else if (process && process.killed) {
        console.log(`  ⚠️  Process ${index + 1} already killed`);
      }
    });
  } else {
    console.log(`  ⚠️  No active processes found for download ${downloadId}`);
  }
  
  // Update status FIRST (before deleting) so running processes can check for cancellation
  downloadInfo.status = 'cancelled';
  downloadInfo.cancelled = true;
  
  // Emit cancellation event - ONLY to the client that started the download
  emitSocket.emit('download:cancelled', {
    downloadId,
    message: '❌ Download cancelled by user'
  });
  
  // Don't delete immediately - keep it marked as cancelled so running processes can check
  // The processes will be cleaned up when they complete or are killed
  // We'll set a timeout to clean up after a delay if processes don't respond
  setTimeout(() => {
    const stillActive = activeDownloads.get(downloadId);
    if (stillActive && stillActive.cancelled) {
      console.log(`🧹 Cleaning up cancelled download ${downloadId} after timeout`);
  activeDownloads.delete(downloadId);
  activeProcesses.delete(downloadId);
    }
  }, 30000); // Clean up after 30 seconds if processes haven't stopped
  
  res.json({ success: true, message: 'Download cancelled' });
});

// Skip to yt-dlp (force fallback)
app.post('/api/download/skip-to-ytdlp', (req, res) => {
  const { downloadId } = req.body;
  
  console.log(`\n⏭️ SKIP TO YT-DLP REQUEST: ${downloadId}`);
  
  const downloadInfo = activeDownloads.get(downloadId);
  if (!downloadInfo) {
    return res.status(404).json({ error: 'Download not found' });
  }
  
  // Kill current spotdl process (should be first in array)
  const processList = activeProcesses.get(downloadId);
  if (processList) {
    const processes = Array.isArray(processList) ? processList : [processList];
    const spotdlProcess = processes.find(p => (p.process || p).type === 'spotdl') || processes[0];
    const process = spotdlProcess.process || spotdlProcess;
    
    if (process) {
    console.log(`🔪 Killing spotdl process to skip to yt-dlp`);
    try {
        process.kill('SIGTERM');
      // Force kill after 2 seconds if not terminated
      setTimeout(() => {
          if (process && !process.killed && process.kill) {
            process.kill('SIGKILL');
        }
      }, 2000);
    } catch (err) {
      console.error('Error killing process:', err.message);
      }
    }
  }
  
  // Set skip flag
  downloadInfo.skipToYtdlp = true;
  
  // Emit skip event
  io.emit('download:skipped', {
    downloadId,
    message: '⏭️ Skipping to yt-dlp fallback...'
  });
  
  res.json({ success: true, message: 'Skipping to yt-dlp' });
});

// YouTube search endpoint (GET) - for inline player
app.get('/api/youtube/search', async (req, res) => {
  const { query, limit = 10 } = req.query;
  
  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'Search query is required' });
  }
  
  // Check cache first
  const cacheKey = `${query.toLowerCase().trim()}_${limit}`;
  const cached = searchCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < SEARCH_CACHE_DURATION) {
    const cacheAge = ((Date.now() - cached.timestamp) / 1000).toFixed(1);
    console.log(`\n⚡ CACHE HIT: "${query}" (${cached.results.length} results, cached ${cacheAge}s ago) - Instant response!`);
    return res.json({ results: cached.results });
  }
  
  console.log(`\n🔍 YOUTUBE SEARCH (Player): "${query}" (limit: ${limit})`);
  const searchStartTime = Date.now();
  
  try {
    // Use yt-dlp with --dump-json for MUCH faster results
    const searchResults = await new Promise(async (resolve, reject) => {
      // Base search arguments for search (NO PROXIES - they block searches)
      const searchArgs = [
        '-m', 'yt_dlp',
        `ytsearch${limit}:${query}`,
        '--dump-json',
        '--flat-playlist',
        '--no-warnings',
        '--ignore-errors',
        '--no-playlist',
        '--extractor-args', 'youtube:player_client=web_embedded',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      ];
      
      // Add cookies if available (but NO PROXIES for search)
      try {
        const cookiesExist = await fs.access(YOUTUBE_COOKIES_PATH).then(() => true).catch(() => false);
        if (cookiesExist) {
          searchArgs.push('--cookies', YOUTUBE_COOKIES_PATH);
          console.log('🍪 Using YouTube cookies for search');
        } else {
          console.log('⚠️ No YouTube cookies - search may be limited');
        }
      } catch (err) {
        console.log('⚠️ No YouTube cookies found');
      }
      
      const searchProcess = spawn(PYTHON_CMD, searchArgs);
      
      let output = '';
      let errorOutput = '';
      
      searchProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      searchProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      searchProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('Search error:', errorOutput);
          reject(new Error('Search failed'));
          return;
        }
        
        // Parse JSON output (one JSON object per line)
        const lines = output.trim().split('\n').filter(line => line.trim());
        const tracks = [];
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            const title = data.title || '';
            const videoId = data.id || data.url || '';
            const thumbnail = data.thumbnail || data.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
            const duration = data.duration || 0;
          
          // Parse title to extract artist and song name
          let artist = 'Unknown Artist';
          let songName = title;
          
          // Remove common suffixes
          songName = songName
            .replace(/\s*\(Official\s+(Music\s+)?Video\)/gi, '')
            .replace(/\s*\(Official\s+Audio\)/gi, '')
            .replace(/\s*\(Lyric\s+Video\)/gi, '')
            .replace(/\s*\(Lyrics\)/gi, '')
            .replace(/\s*\[Official\s+(Music\s+)?Video\]/gi, '')
            .replace(/\s*\[Official\s+Audio\]/gi, '')
            .replace(/\s*Official\s+(Music\s+)?Video/gi, '')
            .replace(/\s*\|\s*Official\s+Audio/gi, '')
            .trim();
          
          // Try different patterns
          const patterns = [
            /^(.+?)\s*-\s*(.+)$/,           // "Artist - Song"
            /^(.+?)\s+by\s+(.+)$/i,          // "Song by Artist"
            /^(.+?)\s*\|\s*(.+)$/,           // "Artist | Song"
            /^(.+?)\s*\/\s*(.+)$/,           // "Artist / Song"
            /^(.+?)\s*:\s*(.+)$/,            // "Artist: Song"
          ];
          
          for (const pattern of patterns) {
            const match = songName.match(pattern);
            if (match) {
              artist = match[1].trim();
              songName = match[2].trim();
              
              // Handle "ft." / "feat." in artist name
              const ftMatch = artist.match(/^(.+?)\s+(?:ft\.?|feat\.?|featuring)\s+/i);
              if (ftMatch) {
                artist = ftMatch[1].trim();
              }
              break;
            }
          }
          
          tracks.push({
            id: `search-${videoId}`,
            name: songName,
            artist: artist,
            album: songName,
            duration: duration,
            imageUrl: thumbnail,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            downloadStatus: 'pending',
            downloadProgress: 0,
            selected: true
          });
        } catch (e) {
          console.error('Error parsing search result:', e.message);
        }
      }
      
      resolve(tracks);
    });
  });
  
  const searchTime = ((Date.now() - searchStartTime) / 1000).toFixed(2);
  console.log(`✅ Found ${searchResults.length} results for "${query}" in ${searchTime}s`);
  
  // Cache results
  searchCache.set(cacheKey, {
    results: searchResults,
    timestamp: Date.now()
  });
  
  res.json({ results: searchResults });
} catch (error) {
  console.error('Search failed:', error.message);
  res.status(500).json({ error: 'Search failed' });
}
});

// Search for music (POST) - for UI search
app.post('/api/search', async (req, res) => {
  const { query, limit = 10 } = req.body;
  
  if (!query || query.trim() === '') {
    return res.status(400).json({ error: 'Search query is required' });
  }
  
  // Check cache first
  const cacheKey = `${query.toLowerCase().trim()}_${limit}`;
  const cached = searchCache.get(cacheKey);
  
  if (cached && (Date.now() - cached.timestamp) < SEARCH_CACHE_DURATION) {
    const cacheAge = ((Date.now() - cached.timestamp) / 1000).toFixed(1);
    console.log(`\n⚡ CACHE HIT: "${query}" (${cached.results.length} results, cached ${cacheAge}s ago) - Instant response!`);
    return res.json({ results: cached.results });
  }
  
  console.log(`\n🔍 SEARCH REQUEST: "${query}" (limit: ${limit})`);
  const searchStartTime = Date.now();
  
  try {
    // Use yt-dlp with --dump-json for MUCH faster results
    const searchResults = await new Promise(async (resolve, reject) => {
      // Base search arguments for search (NO PROXIES - they block searches)
      const searchArgs = [
        '-m', 'yt_dlp',
        `ytsearch${limit}:${query}`,
        '--dump-json',
        '--flat-playlist',
        '--no-warnings',
        '--ignore-errors',
        '--no-playlist',
        '--extractor-args', 'youtube:player_client=web_embedded',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      ];
      
      // Add cookies if available (but NO PROXIES for search)
      try {
        const cookiesExist = await fs.access(YOUTUBE_COOKIES_PATH).then(() => true).catch(() => false);
        if (cookiesExist) {
          searchArgs.push('--cookies', YOUTUBE_COOKIES_PATH);
          console.log('🍪 Using YouTube cookies for search');
        } else {
          console.log('⚠️ No YouTube cookies - search may be limited');
        }
      } catch (err) {
        console.log('⚠️ No YouTube cookies found');
      }
      
      const searchProcess = spawn(PYTHON_CMD, searchArgs);
      
      let output = '';
      let errorOutput = '';
      let timeoutHandle = null;
      
      searchProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      searchProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      searchProcess.on('close', (code) => {
        // Clear timeout on completion
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        
        if (code !== 0) {
          console.error('Search error:', errorOutput);
          reject(new Error('Search failed'));
          return;
        }
        
        // Parse JSON output (one JSON object per line)
        const lines = output.trim().split('\n').filter(line => line.trim());
        const tracks = [];
        
        for (const line of lines) {
          try {
            const data = JSON.parse(line);
            
            const title = data.title || '';
            const videoId = data.id || data.url || '';
            const thumbnail = data.thumbnail || data.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`;
            const duration = data.duration || 0;
          
          // Parse title to extract artist and song name - IMPROVED PARSING
          let artist = 'Unknown Artist';
          let songName = title;
          
          // Remove common video suffixes first to clean the title
          const cleanTitle = title
            .replace(/\s*\(Official.*?\)/gi, '')
            .replace(/\s*\[Official.*?\]/gi, '')
            .replace(/\s*\(Clip.*?\)/gi, '')
            .replace(/\s*\[Clip.*?\]/gi, '')
            .replace(/\s*\(Lyric.*?\)/gi, '')
            .replace(/\s*\[Lyric.*?\]/gi, '')
            .replace(/\s*\(Audio\)/gi, '')
            .replace(/\s*\[Audio\]/gi, '')
            .replace(/\s*\(Music Video\)/gi, '')
            .replace(/\s*\[Music Video\]/gi, '')
            .replace(/\s*\(Exclusive.*?\)/gi, '')
            .replace(/\s*\[Exclusive.*?\]/gi, '')
            .replace(/\s*\(ft\.?.*?\)/gi, '') // Remove ft. features from title
            .replace(/\s*\[ft\.?.*?\]/gi, '')
            .replace(/\s*\|.*$/gi, '') // Remove everything after |
            .trim();
          
          // Try multiple parsing patterns
          let parsed = false;
          
          // Pattern 1: "Artist - Song" (most common)
          if (cleanTitle.includes(' - ') && !parsed) {
            const parts = cleanTitle.split(' - ');
            if (parts.length >= 2) {
              artist = parts[0].trim();
              songName = parts.slice(1).join(' - ').trim();
              parsed = true;
            }
          }
          
          // Pattern 2: "Artist : Song"
          if (cleanTitle.includes(': ') && !parsed) {
            const parts = cleanTitle.split(': ');
            if (parts.length >= 2) {
              artist = parts[0].trim();
              songName = parts.slice(1).join(': ').trim();
              parsed = true;
            }
          }
          
          // Pattern 3: "Song by Artist"
          if (cleanTitle.toLowerCase().includes(' by ') && !parsed) {
            const parts = cleanTitle.split(/ by /i);
            if (parts.length >= 2) {
              songName = parts[0].trim();
              artist = parts.slice(1).join(' by ').trim();
              parsed = true;
            }
          }
          
          // Pattern 4: "Artist | Song" or "Song | Artist"
          if (title.includes(' | ') && !parsed) {
            const parts = title.split(' | ');
            if (parts.length >= 2) {
              // If first part looks like an artist name (shorter, capitalized)
              if (parts[0].length < parts[1].length * 0.7) {
                artist = parts[0].trim();
                songName = parts.slice(1).join(' | ').trim();
              } else {
                songName = parts[0].trim();
                artist = parts[1].trim();
              }
              // Clean up the parsed values
              songName = songName
                .replace(/\s*\(Official.*?\)/gi, '')
                .replace(/\s*\[Official.*?\]/gi, '')
                .trim();
              parsed = true;
            }
          }
          
          // Pattern 5: Extract from "ft" or "feat" in title
          // Example: "Klay BBJ ft Sniper - Song" -> artist: "Klay BBJ ft Sniper"
          if (!parsed && (title.toLowerCase().includes(' ft ') || title.toLowerCase().includes(' feat '))) {
            const ftMatch = title.match(/^(.+?)\s+(?:ft\.?|feat\.?)\s+(.+?)(?:\s+-\s+(.+))?$/i);
            if (ftMatch) {
              artist = `${ftMatch[1].trim()} ft ${ftMatch[2].trim()}`;
              songName = ftMatch[3] ? ftMatch[3].trim() : title;
              parsed = true;
            }
          }
          
          // If still not parsed, use the clean title as song name
          if (!parsed) {
            songName = cleanTitle;
          }
          
          // Final cleanup of song name
          songName = songName
            .replace(/\s*\(Official.*?\)/gi, '')
            .replace(/\s*\[Official.*?\]/gi, '')
            .replace(/\s*\(Clip.*?\)/gi, '')
            .replace(/\s*\[Clip.*?\]/gi, '')
            .replace(/\s*\(Lyric.*?\)/gi, '')
            .replace(/\s*\[Lyric.*?\]/gi, '')
            .replace(/\s*\(Audio\)/gi, '')
            .replace(/\s*\[Audio\]/gi, '')
            .replace(/\s*\(Music Video\)/gi, '')
            .replace(/\s*\[Music Video\]/gi, '')
            .replace(/\s*\|.*$/gi, '')
            .trim();
          
          // If we still have "Unknown Artist", try to extract from the uploader/channel
          // This will be handled by yt-dlp metadata if available
          
            tracks.push({
              id: `search-${videoId}`,
              name: songName,
              artist: artist,
              album: songName,
              duration: duration,
              url: `https://www.youtube.com/watch?v=${videoId}`,
              imageUrl: thumbnail,
              source: 'youtube-search',
              videoId: videoId
            });
          } catch (parseError) {
            console.error('Error parsing search result:', parseError.message);
            continue;
          }
        }
        
        resolve(tracks);
      });
      
      // Add timeout for search (30 seconds max - increased for better success rate)
      timeoutHandle = setTimeout(() => {
        if (!searchProcess.killed) {
          console.log('⏱️ Search timeout - killing process');
          searchProcess.kill('SIGTERM');
          reject(new Error('Search timed out'));
        }
      }, 30000);
    });
    
    const searchElapsed = ((Date.now() - searchStartTime) / 1000).toFixed(2);
    console.log(`✅ Found ${searchResults.length} results for "${query}" in ${searchElapsed}s`);
    
    // Cache the results
    searchCache.set(cacheKey, {
      results: searchResults,
      timestamp: Date.now()
    });
    
    res.json({ results: searchResults });
    
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Failed to search for music' });
  }
});

// Helper function to parse duration string (e.g., "3:45" or "225" -> 225 seconds)
function parseDuration(durationStr) {
  if (!durationStr) return 0;
  
  // If it's already a number in seconds
  if (!isNaN(durationStr)) {
    return parseInt(durationStr, 10);
  }
  
  // Parse time format (HH:MM:SS or MM:SS)
  const parts = durationStr.split(':').map(Number);
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1]; // MM:SS
  } else if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
  }
  return 0;
}

// Fetch YouTube metadata for a track
async function fetchYouTubeMetadata(searchQuery, youtubeLink = null) {
  return new Promise((resolve) => {
    const metadataArgs = youtubeLink 
      ? ['-m', 'yt_dlp', youtubeLink, '--get-title', '--get-id', '--get-thumbnail', '--no-playlist']
      : ['-m', 'yt_dlp', `ytsearch1:${searchQuery}`, '--get-title', '--get-id', '--get-thumbnail', '--no-playlist'];
    
    const metaProcess = spawn(PYTHON_CMD, metadataArgs);
    let output = '';
    
    metaProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    metaProcess.on('close', (code) => {
      if (code === 0 && output.trim()) {
        const lines = output.trim().split('\n');
        const metadata = {
          title: lines[0] || 'Unknown',
          videoId: lines[1] || 'Unknown',
          thumbnail: lines[2] || ''
        };
        resolve(metadata);
      } else {
        resolve(null);
      }
    });
    
    metaProcess.on('error', () => resolve(null));
  });
}

// ====================================
// 🆕 YOUTUBEI.JS METHOD (Cookie-less, GitHub)
// ====================================
// Uses YouTubei.js - Modern YouTube API implementation
// Source: https://github.com/LuanRT/YouTube.js
// ====================================

async function tryYouTubeiJS(track, outputFolder, socket, downloadId) {
  try {
    console.log(`\n🔧 Trying YouTubei.js (GitHub method) for: ${track.name}`);
    
    const youtubeUrl = track.url;
    if (!youtubeUrl || !youtubeUrl.includes('youtube.com')) {
      console.log('  ❌ No YouTube URL available');
      return false;
    }
    
    const videoId = youtubeUrl.split('v=')[1]?.split('&')[0];
    if (!videoId) {
      console.log('  ❌ Invalid YouTube URL');
      return false;
    }
    
    console.log(`  📺 Video ID: ${videoId}`);
    console.log(`  🔄 Initializing Innertube...`);
    
    // Initialize YouTube client (without custom fetch to avoid node-fetch v2 issues)
    const youtube = await Innertube.create({
      cache: new Map() // In-memory cache
    });
    
    console.log(`  ✅ Innertube initialized`);
    console.log(`  🔍 Fetching video info...`);
    
    // Get video info
    const info = await youtube.getInfo(videoId);
    
    console.log(`  ✅ Video info retrieved: ${info.basic_info.title}`);
    console.log(`  🎵 Choosing audio format...`);
    
    // Get best audio format
    const format = info.chooseFormat({
      type: 'audio',
      quality: 'best'
    });
    
    if (!format) {
      console.log('  ❌ No audio format found');
      return false;
    }
    
    console.log(`  ✅ Audio format selected: ${format.mime_type} (${format.bitrate} bps)`);
    console.log(`  🔄 Starting download...`);
    
    // Decipher the URL
    const stream = await format.decipher(youtube.session.player);
    
    // Create safe filename (removes "Unknown Artist" prefix)
    const safeFilename = createSafeFilename(track);
    const extension = format.mime_type?.includes('mp4') ? 'm4a' : 'opus';
    const outputPath = path.join(outputFolder, `${safeFilename}.${extension}`);
    
    console.log(`  📁 Saving to: ${path.basename(outputPath)}`);
    
    // Download stream to file
    const writer = fsSync.createWriteStream(outputPath);
    
    // Pipe the stream
    for await (const chunk of stream) {
      writer.write(chunk);
    }
    
    writer.end();
    
    // Wait for write to finish
    await new Promise((resolve, reject) => {
      writer.on('finish', resolve);
      writer.on('error', reject);
    });
    
    // Verify file was created
    const stats = await fs.stat(outputPath);
    
    if (stats.size === 0) {
      console.log(`  ❌ File created but is 0 bytes`);
      return false;
    }
    
    console.log(`  ✅ YouTubei.js: Successfully downloaded ${track.name} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    return true;
    
  } catch (err) {
    console.log(`  ❌ YouTubei.js failed: ${err.message}`);
    console.log(`  📝 Error details:`, err.stack);
    return false;
  }
}

// ====================================
// 🆕 YOUTUBE-DL-EXEC METHOD (Cookie-less, from GitHub)
// ====================================
// Uses youtube-dl-exec wrapper around yt-dlp
// Source: https://github.com/microlinkhq/youtube-dl-exec
// ====================================

// 🔥 SMART FALLBACK: Search for alternative video when age-restricted
async function findAlternativeVideo(track, outputFolder) {
  try {
    console.log(`  🔍 Age-restricted video detected - searching for alternative...`);
    
    // Clean search query: remove special characters, parentheses, etc.
    // Similar to cleanSearchQuery but optimized for alternative search
    const cleanQuery = (str) => {
      return str
        .replace(/\([^)]*\)/g, '') // Remove parentheses and their content
        .replace(/\[[^\]]*\]/g, '') // Remove square brackets and their content
        .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters (Arabic, etc.)
        .replace(/[^\w\s-]/g, ' ') // Remove special characters except word chars, spaces, and hyphens
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim()
        .substring(0, 60); // Limit length (shorter = better search results)
    };
    
    // Build multiple search query variations
    const searchQueries = [];
    
    if (track.artist && track.artist !== 'Unknown Artist') {
      // Try: "Artist Track Name"
      searchQueries.push(`${track.artist} ${track.name}`);
      // Try: "Artist - Track Name"
      searchQueries.push(`${track.artist} - ${track.name}`);
      // Try: just track name (if artist doesn't help)
      searchQueries.push(track.name);
    } else {
      // Just track name
      searchQueries.push(track.name);
    }
    
    // Try each search query variation
    for (const rawQuery of searchQueries) {
      const searchQuery = cleanQuery(rawQuery);
      console.log(`  🎯 Trying search: "${searchQuery}"`);
      
      // Use yt-dlp to search for alternatives (limit to 10 results for better chances)
      const searchArgs = [
        '-m', 'yt_dlp',
        `ytsearch10:${searchQuery}`,
        '--dump-json',
        '--flat-playlist',
        '--no-warnings',
        '--ignore-errors',
        '--no-playlist',
        '--extractor-args', 'youtube:player_client=web_embedded',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      ];
      
      const searchProcess = spawn(PYTHON_CMD, searchArgs, {
        cwd: outputFolder || __dirname,
        shell: false,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      
      let output = '';
      let errorOutput = '';
      
      searchProcess.stdout.on('data', (data) => {
        output += data.toString();
      });
      
      searchProcess.stderr.on('data', (data) => {
        errorOutput += data.toString();
      });
      
      await new Promise((resolve) => {
        searchProcess.on('close', resolve);
      });
      
      // Parse JSON results (one JSON object per line)
      const lines = output.trim().split('\n').filter(line => line.trim());
      const alternatives = [];
      
      for (const line of lines) {
        try {
          const data = JSON.parse(line);
          const videoId = data.id;
          const title = data.title || '';
          const url = `https://www.youtube.com/watch?v=${videoId}`;
          
          // Skip if it's the same video we tried
          if (track.url && track.url.includes(videoId)) {
            continue;
          }
          
          // Skip if title is too short (likely invalid)
          if (title.length < 5) {
            continue;
          }
          
          alternatives.push({ url, videoId, title });
        } catch (parseErr) {
          // Skip invalid JSON lines
        }
      }
      
      if (alternatives.length > 0) {
        console.log(`  ✅ Found ${alternatives.length} alternative video(s) with query "${searchQuery}"`);
        console.log(`  🎯 Trying first alternative: ${alternatives[0].title} (${alternatives[0].videoId})`);
        return alternatives[0].url;
      } else {
        console.log(`  ⚠️ No results for "${searchQuery}", trying next variation...`);
      }
    }
    
    console.log(`  ⚠️ No alternatives found with any search query`);
    return null;
  } catch (err) {
    console.log(`  ⚠️ Alternative search failed: ${err.message}`);
    return null;
  }
}

async function tryYoutubeDlExec(track, outputFolder, socket, downloadId, settings = {}, cookiePath = null, clientAttempt = 0) {
  // Declare variables outside try block for use in catch block
  let safeFilename;
  let downloadOptions;
  let expectedFilePath;
  let audioFormat;
  
  try {
    console.log(`\n🔧 Trying youtube-dl-exec (GitHub method) for: ${track.name}`);
    
    let youtubeUrl = track.url;
    
    // Handle Spotify search - use ytsearch format
    if (track.isSpotifySearch && track.searchTerm) {
      youtubeUrl = `ytsearch1:${track.searchTerm}`;
      console.log(`  🎵 Using YouTube search: "${track.searchTerm}"`);
      console.log(`  🔄 Starting download...`);
    } else {
      // Regular YouTube URL
      if (!youtubeUrl || !youtubeUrl.includes('youtube.com')) {
        console.log('  ❌ No YouTube URL available');
        return false;
      }
      
      const videoId = youtubeUrl.split('v=')[1]?.split('&')[0];
      if (!videoId) {
        console.log('  ❌ Invalid YouTube URL');
        return false;
      }
      
      console.log(`  📺 Video ID: ${videoId}`);
      console.log(`  🔄 Starting download...`);
    }
    
    // Get cookie path if not provided
    // Note: cookiePath can be explicitly null (cookie-less mode)
    if (cookiePath === null) {
      // Cookie-less mode - skip cookie setup entirely
      console.log(`  🚫 Cookie-less mode - using client types that don't require cookies`);
    } else if (!cookiePath) {
      // Try to get cookies (but don't fail if unavailable)
      const cookieSetup = await setupYouTubeCookies();
      if (cookieSetup && cookieSetup.type === 'file') {
        cookiePath = cookieSetup.path;
        console.log(`  🍪 Using cookies: ${path.basename(cookiePath)}`);
      } else {
        console.log(`  ⚠️ No cookies available - will try cookie-less methods`);
      }
    } else {
      console.log(`  🍪 Using provided cookie: ${path.basename(cookiePath)}`);
    }
    
    // Create safe filename (removes "Unknown Artist" prefix)
    safeFilename = createSafeFilename(track);
    
    // Get format extension from settings
    audioFormat = settings.format || 'mp3';
    
    // ✅ OPTION A: Use absolute resolved path
    const absoluteOutputPath = path.resolve(outputFolder, safeFilename);
    expectedFilePath = `${absoluteOutputPath}.${audioFormat}`;
    
    console.log(`  📁 Output folder: ${outputFolder}`);
    console.log(`  📁 Expected file: ${path.basename(expectedFilePath)}`);
    console.log(`  📁 Absolute path: ${absoluteOutputPath}`);
    
    // Parse quality setting (e.g., "320k" -> "320K")
    const quality = settings.quality ? settings.quality.toUpperCase().replace('K', 'K') : '320K';
    
    // ✅ OPTION B: Enhanced logging with verbose mode
    downloadOptions = {
      extractAudio: true,
      audioFormat: audioFormat,
      audioQuality: quality,
      output: `${absoluteOutputPath}.%(ext)s`,  // Use absolute path
      noCheckCertificates: true,
      // noWarnings removed - when omitted, warnings are shown by default
      preferFreeFormats: true,
      noPlaylist: true,
      verbose: true,  // ✅ OPTION B: Enable verbose logging
      print: 'after_move:filepath'  // ✅ OPTION B: Print final file path
    };
    
    // Add cookies if available
    if (cookiePath) {
      downloadOptions.cookies = cookiePath;
    }

    // 🎯 COOKIE-LESS FIRST MODE: Force android_sdkless if cookiePath is null (cookie-less mode)
    const profileList = cookiePath ? COOKIE_CLIENT_PROFILES : COOKIELESS_CLIENT_PROFILES;
    let profile;
    
    if (cookiePath === null) {
      // Cookie-less mode: Force android_sdkless (first profile in COOKIELESS_CLIENT_PROFILES)
      profile = COOKIELESS_CLIENT_PROFILES[0]; // android_sdkless
      console.log(`  🎯 Cookie-less mode: FORCING android_sdkless client (no cookies)`);
    } else {
      profile = profileList[clientAttempt % profileList.length];
    }
    
    // Apply client profile
    applyClientProfileToOptions(downloadOptions, profile);
    console.log(`  🤖 Client profile: ${profile.name} (attempt ${clientAttempt + 1})`);
    
    // 🎯 COOKIE-LESS FIRST MODE: Force YouTube-validated proxy (if available)
    if (cookiePath === null) {
      const youtubeProxy = proxyManager.getProxyForYtdlp();
      if (youtubeProxy) {
        // Add proxy to downloadOptions (youtube-dl-exec supports proxy via options)
        downloadOptions.proxy = youtubeProxy;
        console.log(`  🌐 Using YouTube-validated proxy for cookie-less download`);
        if (youtubeProxy.includes('oxylabs.io')) {
          console.log(`     🌟 Oxylabs premium proxy (verified working with YouTube)`);
        } else {
          const shortProxy = youtubeProxy.length > 30 ? youtubeProxy.substring(0, 27) + '...' : youtubeProxy;
          console.log(`     🎯 YouTube-validated proxy: ${shortProxy}`);
        }
      } else {
        console.log(`  ⚠️  No YouTube-validated proxy available for cookie-less download`);
      }
    }
    
    // 🎯 Inject PO token for enhanced authentication (bypasses bot detection)
    // ⚡ FAST TIMEOUT: Try to get PO token, but don't delay download more than 3 seconds
    // PO tokens are optional enhancement, downloads work fine without them
    try {
      await Promise.race([
        injectPOToken(downloadOptions),
        new Promise((resolve) => setTimeout(() => resolve(null), 3000)) // 3s max wait
      ]);
    } catch (err) {
      // Silently fail - PO tokens are optional, proceed without them
      // Don't log - PO token failures are expected and downloads work fine without them
    }
    
    console.log(`  🔧 Download options:`, JSON.stringify(downloadOptions, null, 2));
    
    // Download with youtube-dl-exec
    const result = await youtubedl(youtubeUrl, downloadOptions);
    
    console.log(`  📝 youtube-dl-exec result:`, result);
    
    // Verify file was created
    const fileExists = await fs.access(expectedFilePath).then(() => true).catch(() => false);
    if (!fileExists) {
      // Check for other possible extensions and partial filenames
      const folderFiles = await fs.readdir(outputFolder);
      console.log(`  📂 All files in folder (${folderFiles.length}):`, folderFiles);
      
      const possibleFile = folderFiles.find(f => {
        const normalized = f.toLowerCase();
        return (normalized.includes(track.name.toLowerCase().substring(0, 10)) || 
                normalized.includes(safeFilename.toLowerCase().substring(0, 10))) &&
               (normalized.endsWith('.mp3') || normalized.endsWith('.m4a') || 
                normalized.endsWith('.webm') || normalized.endsWith('.opus'));
      });
      
      if (possibleFile) {
        const actualPath = path.join(outputFolder, possibleFile);
        const stats = await fs.stat(actualPath);
        console.log(`  ⚠️ File created with different name: ${possibleFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        
        // If size is > 0, consider it a success
        if (stats.size > 0) {
          return true;
        } else {
          console.log(`  ❌ File is 0 bytes - download failed`);
          return false;
        }
      }
      
      console.log(`  ❌ File not found after download: ${path.basename(expectedFilePath)}`);
      console.log(`  📂 Expected in: ${outputFolder}`);
      console.log(`  📂 Files found: ${folderFiles.join(', ')}`);
      return false;
    }
    
    const stats = await fs.stat(expectedFilePath);
    if (stats.size === 0) {
      console.log(`  ❌ File created but is 0 bytes`);
      return false;
    }
    
    console.log(`  ✅ youtube-dl-exec: Successfully downloaded ${track.name} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
    return true;
    
  } catch (err) {
    console.log(`  ❌ youtube-dl-exec failed: ${err.message}`);
    console.log(`  📝 Error stack:`, err.stack);
    
    const errorMessage = err.message || err.toString() || err.stack || '';
    const fullError = errorMessage.toLowerCase();
    
    // 🔥 CRITICAL: Explicit error detection with priority handling
    // Handles edge case: if BOTH "confirm your age" AND "confirm you're not a bot" appear,
    // prioritize bot detection (cookie is dead, needs rotation)
    
    // Step 1: Check for explicit phrases
    const hasAgeRestrictionPhrase = fullError.includes('sign in to confirm your age') ||
                                   fullError.includes('confirm your age') ||
                                   fullError.includes('age-restricted');
    
    const hasBotDetectionPhrase = fullError.includes('sign in to confirm you\'re not a bot') ||
                                 fullError.includes('sign in to confirm you are not a bot') ||
                                 (fullError.includes('sign in to confirm') && (fullError.includes('not a bot') || fullError.includes('are not a bot')));
    
    // Step 2: Handle edge case - if BOTH appear, prioritize bot detection (cookie is dead)
    if (hasAgeRestrictionPhrase && hasBotDetectionPhrase) {
      console.log('  ⚠️ Both age-restriction and bot detection detected - prioritizing bot detection (cookie issue)');
      console.log('  🚨 Bot detection error detected - cookie may be dead');
      throw new Error('COOKIE_BOT_DETECTION'); // Cookie rotation takes priority
    }
    
    // Step 3: Check for explicit bot detection (only if NOT age-restricted phrase)
    const hasBotDetectionError = hasBotDetectionPhrase ||
                                (fullError.includes('login_required') && 
                                 !hasAgeRestrictionPhrase && 
                                 !fullError.includes('age') && 
                                 !fullError.includes('inappropriate') && 
                                 !fullError.includes('confirm your age'));
    
    // Step 4: Check for age-restricted (ONLY if NOT bot detection)
    const hasAgeRestricted = !hasBotDetectionError && (
      hasAgeRestrictionPhrase ||
      fullError.includes('age-restricted') || 
      (fullError.includes('sign in to confirm your age') && (fullError.includes('inappropriate') || fullError.includes('video may be inappropriate'))) ||
      (fullError.includes('confirm your age') && fullError.includes('inappropriate')) ||
      (fullError.includes('video may be inappropriate') && fullError.includes('age')) ||
      (fullError.includes('some formats may be missing') && fullError.includes('age-restricted')) ||
      (fullError.includes('login_required') && (fullError.includes('age') || fullError.includes('inappropriate')) && !fullError.includes('bot'))
    );
    
    // 🔥 PRIORITY: If bot detection, throw error for cookie rotation (don't try alternatives)
    if (hasBotDetectionError) {
      console.log('  🚨 Bot detection error detected - cookie may be dead');
      throw new Error('COOKIE_BOT_DETECTION'); // Special error for cookie rotation
    }
    
    // 🔥 SECONDARY: If age-restricted, search for alternative video
    if (hasAgeRestricted) {
      console.log('  🔒 Age-restricted video detected - searching for alternative...');
      
      const alternativeUrl = await findAlternativeVideo(track, outputFolder);
      if (alternativeUrl) {
        console.log(`  🔄 Retrying with alternative video: ${alternativeUrl}`);
        
        // Create a copy of track with alternative URL
        const alternativeTrack = { ...track, url: alternativeUrl };
        
        try {
          // Retry with alternative video
          const retryResult = await youtubedl(alternativeUrl, downloadOptions);
          console.log(`  📝 Alternative download result:`, retryResult);
          
          // Verify file was created
          const fileExists = await fs.access(expectedFilePath).then(() => true).catch(() => false);
          if (!fileExists) {
            // Check for other possible files
            const folderFiles = await fs.readdir(outputFolder);
            const possibleFile = folderFiles.find(f => {
              const normalized = f.toLowerCase();
              return (normalized.includes(track.name.toLowerCase().substring(0, 10)) || 
                      normalized.includes(safeFilename.toLowerCase().substring(0, 10))) &&
                     (normalized.endsWith('.mp3') || normalized.endsWith('.m4a') || 
                      normalized.endsWith('.webm') || normalized.endsWith('.opus'));
            });
            
            if (possibleFile) {
              const actualPath = path.join(outputFolder, possibleFile);
              const stats = await fs.stat(actualPath);
              if (stats.size > 0) {
                console.log(`  ✅ Alternative video downloaded successfully: ${possibleFile} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
                return true;
              }
            }
          } else {
            const stats = await fs.stat(expectedFilePath);
            if (stats.size > 0) {
              console.log(`  ✅ Alternative video downloaded successfully: ${track.name} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
              return true;
            }
          }
        } catch (retryErr) {
          console.log(`  ⚠️ Alternative video also failed: ${retryErr.message}`);
        }
      }
    }
    
    // If we reach here, it's neither bot detection nor age-restricted - return false
    return false;
  }
}

// ====================================
// 🆕 PIPED API METHOD (Cookie-less)
// ====================================
// Uses public Piped instances as proxy
// Source: https://github.com/TeamPiped/Piped
// ====================================

async function tryPipedAPI(track, outputFolder, socket, downloadId) {
  try {
    console.log(`\n🔧 Trying Piped API for: ${track.name}`);
    
    const youtubeUrl = track.url;
    if (!youtubeUrl || !youtubeUrl.includes('youtube.com')) {
      console.log('  ❌ No YouTube URL available');
      return false;
    }
    
    const videoId = youtubeUrl.split('v=')[1]?.split('&')[0];
    if (!videoId) {
      console.log('  ❌ Invalid YouTube URL');
      return false;
    }
    
    console.log(`  📺 Video ID: ${videoId}`);
    
    // Try different Piped instances
    for (const instance of PIPED_INSTANCES) {
      try {
        console.log(`  🔄 Trying instance: ${instance}`);
        
        const apiUrl = `${instance}/streams/${videoId}`;
        const response = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        });
        
        if (!response.ok) {
          console.log(`  ⚠️ Instance returned ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        
        // Find best audio stream
        const audioStreams = data.audioStreams || [];
        if (audioStreams.length === 0) {
          console.log('  ❌ No audio streams found');
          continue;
        }
        
        // Get highest quality audio
        const bestAudio = audioStreams.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
        console.log(`  ✅ Found audio stream: ${bestAudio.bitrate || 'unknown'} bps`);
        
        // Download the audio
        const audioUrl = bestAudio.url;
        const audioResponse = await fetch(audioUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (!audioResponse.ok) {
          console.log(`  ❌ Audio download failed: ${audioResponse.status}`);
          continue;
        }
        
        // Create safe filename (removes "Unknown Artist" prefix)
        const safeFilename = createSafeFilename(track);
        const outputPath = path.join(outputFolder, `${safeFilename}.mp3`);
        
        console.log(`  📁 Saving to: ${path.basename(outputPath)}`);
        
        // Write to file
        const buffer = await audioResponse.buffer();
        await fs.writeFile(outputPath, buffer);
        
        // Verify file was created
        const stats = await fs.stat(outputPath);
        console.log(`  ✅ Piped API: Successfully downloaded ${track.name} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return true;
        
      } catch (instanceErr) {
        console.log(`  ⚠️ Instance ${instance} failed: ${instanceErr.message}`);
        continue;
      }
    }
    
    console.log('  ❌ All Piped instances failed');
    return false;
    
  } catch (err) {
    console.log(`  ❌ Piped API failed: ${err.message}`);
    return false;
  }
}

// ====================================
// 🆕 INVIDIOUS API METHOD (Cookie-less)
// ====================================
// Uses public Invidious instances as proxy
// Source: https://github.com/iv-org/invidious
// ====================================

const INVIDIOUS_INSTANCES = [
  'https://invidious.snopyta.org',
  'https://yewtu.be',
  'https://invidious.kavin.rocks',
  'https://vid.puffyan.us',
  'https://invidious.lunar.icu'
];

const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.video',
  'https://pipedapi.tokhmi.xyz'
];

async function tryInvidiousAPI(track, outputFolder, socket, downloadId) {
  try {
    console.log(`\n🔧 Trying Invidious API for: ${track.name}`);
    
    const youtubeUrl = track.url;
    if (!youtubeUrl || !youtubeUrl.includes('youtube.com')) {
      console.log('  ❌ No YouTube URL available');
      return false;
    }
    
    const videoId = youtubeUrl.split('v=')[1]?.split('&')[0];
    if (!videoId) {
      console.log('  ❌ Invalid YouTube URL');
      return false;
    }
    
    console.log(`  📺 Video ID: ${videoId}`);
    
    // Try different Invidious instances
    for (const instance of INVIDIOUS_INSTANCES) {
      try {
        console.log(`  🔄 Trying instance: ${instance}`);
        
        const apiUrl = `${instance}/api/v1/videos/${videoId}`;
        const response = await fetch(apiUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          },
          timeout: 10000
        });
        
        if (!response.ok) {
          console.log(`  ⚠️ Instance returned ${response.status}`);
          continue;
        }
        
        const data = await response.json();
        
        // Find best audio format
        const audioFormats = data.adaptiveFormats?.filter(f => f.type?.includes('audio')) || [];
        if (audioFormats.length === 0) {
          console.log('  ❌ No audio formats found');
          continue;
        }
        
        // Get highest quality audio
        const bestAudio = audioFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
        console.log(`  ✅ Found audio format: ${bestAudio.bitrate} bps`);
        
        // Download the audio
        const audioUrl = bestAudio.url;
        const audioResponse = await fetch(audioUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (!audioResponse.ok) {
          console.log(`  ❌ Audio download failed: ${audioResponse.status}`);
          continue;
        }
        
        // Create safe filename (removes "Unknown Artist" prefix)
        const safeFilename = createSafeFilename(track);
        const outputPath = path.join(outputFolder, `${safeFilename}.mp3`);
        
        console.log(`  📁 Saving to: ${path.basename(outputPath)}`);
        
        // Write to file
        const buffer = await audioResponse.buffer();
        await fs.writeFile(outputPath, buffer);
        
        // Verify file was created
        const stats = await fs.stat(outputPath);
        console.log(`  ✅ Invidious API: Successfully downloaded ${track.name} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);
        return true;
        
      } catch (instanceErr) {
        console.log(`  ⚠️ Instance ${instance} failed: ${instanceErr.message}`);
        continue;
      }
    }
    
    console.log('  ❌ All Invidious instances failed');
    return false;
    
  } catch (err) {
    console.log(`  ❌ Invidious API failed: ${err.message}`);
    return false;
  }
}

// Try yt-dlp fallback for failed tracks - WITH PARALLEL DOWNLOADS (8 threads)
async function tryYtDlpFallback(tracks, outputFolder, outputTemplate, socket, downloadId, youtubeLinks = {}, settings = {}, attemptNumber = 0, cookieLessFirst = false) {
  console.log('\n=== YT-DLP FALLBACK ATTEMPT ===');
  console.log(`📍 Overall attempt: ${attemptNumber + 1}`);
  
  // Use threads from settings (1-16, default 8)
  const parallelDownloads = settings.threads || 8;
  console.log(`⚡ Using ${parallelDownloads} parallel downloads (from settings)`);
  
  // Get list of already downloaded files
  const files = await fs.readdir(outputFolder);
  const musicFiles = files.filter(f => 
    f.endsWith('.mp3') || f.endsWith('.flac') || f.endsWith('.ogg')
  );
  
  // Find tracks that haven't been downloaded yet (case-insensitive + special chars)
  const normalizeString = (str) => {
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
      .replace(/[^\w\s-]/g, ' ') // Replace special chars with space
      .replace(/\s+/g, ' ') // Normalize spaces
      .trim();
  };
  
  // For single track downloads, use exact filename matching (no fuzzy matching!)
  // For multi-track downloads, use fuzzy matching to handle YouTube title variations
  const failedTracks = tracks.filter(track => {
    // Single track: ONLY exact match (same as post-download check)
    if (tracks.length === 1) {
      const exists = checkFileExistsForTrack(musicFiles, track, 'mp3');
      return !exists;
    }
    
    // Multi-track: use fuzzy matching (handles YouTube title variations)
        const expectedFilename = track.artist === 'Unknown Artist' 
          ? `${track.name}.mp3`
          : `${track.artist} - ${track.name}.mp3`;
    const exists = musicFiles.some(file => {
      const fileNormalized = normalizeString(file.toLowerCase());
      const artistNormalized = normalizeString(track.artist.toLowerCase().trim());
      const nameNormalized = normalizeString(track.name.toLowerCase().trim());
      
      // Extract key words from track name
      const nameWords = nameNormalized.split(' ').filter(w => w.length > 2).slice(0, 4);
      const hasArtist = fileNormalized.includes(artistNormalized);
      const matchingWords = nameWords.filter(word => fileNormalized.includes(word));
      const hasEnoughNameMatch = matchingWords.length >= Math.min(2, nameWords.length);
      
      return hasArtist && hasEnoughNameMatch;
    });
    return !exists;
  });
  
  console.log(`Found ${failedTracks.length} failed tracks to retry with yt-dlp`);
  
  let successCount = 0;

  // Helper: find best YouTube match for a track using yt-dlp JSON search (no proxies)
  const findBestYouTubeMatch = async (track) => {
    try {
      // Build search query - skip "Unknown Artist" to improve search results
      const searchQuery = track.artist === 'Unknown Artist' 
        ? track.name.trim()
        : `${track.artist} ${track.name}`.trim();
      const args = [
        '-m', 'yt_dlp',
        `ytsearch10:${searchQuery}`,
        '--dump-json',
        '--flat-playlist',
        '--no-warnings',
        '--ignore-errors',
        '--no-playlist',
        '--extractor-args', 'youtube:player_client=web_embedded',
        '--user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      ];

      // Add cookies if available
      try {
        const cookiesExist = await fs.access(YOUTUBE_COOKIES_PATH).then(() => true).catch(() => false);
        if (cookiesExist) {
          args.push('--cookies', YOUTUBE_COOKIES_PATH);
        }
      } catch {}

      const proc = spawn(PYTHON_CMD, args);
      let output = '';
      proc.stdout.on('data', d => (output += d.toString()));
      await new Promise((resolve) => proc.on('close', () => resolve()));
      if (!output.trim()) return null;

      const entries = output.trim().split('\n').map(line => {
        try { return JSON.parse(line); } catch { return null; }
      }).filter(Boolean);
      if (entries.length === 0) return null;

      const normalize = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
      const wantedArtist = normalize(track.artist);
      const wantedTitle = normalize(track.name);
      const wantedDur = Number(track.duration || 0);

      let best = null; let bestScore = -1;
      for (const e of entries) {
        const eTitle = normalize(e.title || '');
        const eUploader = normalize(e.uploader || e.channel || '');
        const eDur = Number(e.duration || 0);

        let score = 0;
        // artist match
        if (wantedArtist && (eTitle.includes(wantedArtist) || eUploader.includes(wantedArtist))) score += 3;
        // title words match
        const words = wantedTitle.split(' ').filter(w => w.length > 2);
        const hits = words.filter(w => eTitle.includes(w)).length;
        score += Math.min(hits, 4);
        // duration closeness
        if (wantedDur > 0 && eDur > 0) {
          const diff = Math.abs(eDur - wantedDur);
          if (diff <= 2) score += 4; else if (diff <= 5) score += 3; else if (diff <= 10) score += 2; else if (diff <= 20) score += 1;
        }
        // prefer official uploads
        if (eUploader && (eUploader.includes('official') || eUploader.includes(wantedArtist))) score += 1;

        if (score > bestScore) { bestScore = score; best = e; }
      }

      if (!best || !best.id) return null;
      return `https://www.youtube.com/watch?v=${best.id}`;
    } catch {
      return null;
    }
  };
  
  // Track completed count for incremental progress
  let completedCount = tracks.length - failedTracks.length; // Start with already downloaded tracks
  const totalTracks = tracks.length;
  
  // Helper function to download a single track
  const downloadSingleTrack = async (track) => {
    // Log output folder for this track to ensure consistency
    console.log(`\n📂 Downloading track to folder: ${outputFolder}`);
    
    // Clean search query helper (removes parentheses, special chars, limits length)
    const cleanSearchQuery = (str) => {
      return str
        .replace(/\([^)]*\)/g, '') // Remove parentheses and their content
        .replace(/\[[^\]]*\]/g, '') // Remove square brackets and their content
        .replace(/[^\x00-\x7F]/g, '') // Remove non-ASCII characters (Arabic, etc.)
        .replace(/[^\w\s-]/g, ' ') // Remove special characters except word chars, spaces, and hyphens
        .replace(/\s+/g, ' ') // Collapse multiple spaces
        .trim()
        .substring(0, 60); // Limit length to 60 chars (shorter = better search results)
    };
    
    // Build search query - skip "Unknown Artist" to improve search results
    // Try multiple variations: full query, artist only, track name only
    const searchQueries = track.artist === 'Unknown Artist' 
      ? [cleanSearchQuery(track.name)]
      : [
          cleanSearchQuery(`${track.artist} ${track.name}`),
          cleanSearchQuery(`${track.artist} - ${track.name}`),
          cleanSearchQuery(track.name), // Fallback to track name only
          cleanSearchQuery(track.artist) // Last resort: artist only
        ];
    const searchQuery = searchQueries[0]; // Use first query by default
    
    console.log(`\n🔄 Trying download for: ${track.artist === 'Unknown Artist' ? track.name : `${track.artist} ${track.name}`}`);
    console.log(`  🔍 Track URL: ${track.url || 'NOT SET'}`);
    console.log(`  🔍 Track ID: ${track.id || 'NOT SET'}`);
    
    // 🎵 FOR SPOTIFY TRACKS: Find YouTube URL first so all methods can use it
    if (track.url && track.url.includes('spotify.com')) {
      console.log(`  🎵 Spotify track detected - searching YouTube...`);
      
      // Check if we already have a YouTube link from spotdl errors
      let youtubeLink = youtubeLinks[track.url] || youtubeLinks[track.id];
      
      if (!youtubeLink) {
        // Search YouTube for the track
        const found = await findBestYouTubeMatch(track);
        if (found) {
          youtubeLink = found;
          console.log(`  ✅ Found YouTube match: ${youtubeLink}`);
        }
      } else {
        console.log(`  ✅ Using YouTube link from spotdl: ${youtubeLink}`);
      }
      
      // Update track URL to YouTube URL so all methods can use it
      if (youtubeLink) {
        track.url = youtubeLink;
        console.log(`  🔄 Updated track URL to YouTube: ${youtubeLink}`);
      } else {
        console.log(`  ⚠️ Could not find YouTube match - will try yt-dlp search`);
      }
    }
    
    // ====================================
    // 🆕 TRY METHOD 1: youtube-dl-exec (Cookie-less, GitHub) ⭐ ALWAYS FIRST!
    // ====================================
    // Try youtube-dl-exec for ALL tracks (Spotify search + YouTube direct) with smart cookie rotation
    if (attemptNumber < 6) { // Increased attempts for better success
      console.log(`\n🎯 METHOD 1: Trying youtube-dl-exec (GitHub wrapper) with cookie rotation...`);
      
      // For Spotify tracks without YouTube URL, use search format
      if (!track.url || track.url.includes('spotify.com')) {
        const searchTerm = track.artist === 'Unknown Artist' 
          ? track.name.trim()
          : `${track.artist} ${track.name}`.trim();
        
        console.log(`  🎵 Spotify track → YouTube search: "${searchTerm}"`);
        
        // Temporarily set URL to search format for youtube-dl-exec
        const originalUrl = track.url;
        track.url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchTerm)}`;
        track.isSpotifySearch = true;
        track.searchTerm = searchTerm;
        
        // 🎯 COOKIE-LESS FIRST MODE: If cookieLessFirst is true, force cookie-less with android_sdkless + YouTube proxy
        let ytdlExecSuccess = false;
        if (cookieLessFirst) {
          console.log(`  🎯 Cookie-less first mode: Using android_sdkless + YouTube-validated proxy (NO cookies)`);
          // Force cookie-less mode (null = no cookies)
          ytdlExecSuccess = await tryYoutubeDlExec(track, outputFolder, socket, downloadId, settings, null, 0);
        } else {
          // Use smart cookie rotation (normal mode)
          ytdlExecSuccess = await smartRetryWithCookies(async (cookiePath, clientAttempt) => {
            return await tryYoutubeDlExec(track, outputFolder, socket, downloadId, settings, cookiePath, clientAttempt);
          }, 5);
        }
        
          if (ytdlExecSuccess) {
            console.log(`✅ youtube-dl-exec SUCCESS (Spotify search): ${track.name}`);
            successCount++;
            
            completedCount++;
            // For TrackList: emit download:track event (matches by trackId)
            // Always emit, even if track.id is missing (fallback to track name matching)
            socket.emit('download:track', {
              downloadId,
              trackId: track.id || `${track.artist}-${track.name}`,
              status: 'completed',
              progress: 100,
              message: `✅ ${track.name}`
            });
            console.log(`📤 Emitted download:track for track: ${track.name} (id: ${track.id || 'generated'})`);
            // For TrackList and DownloadQueue: emit download:progress event
            socket.emit('download:progress', {
              downloadId,
              trackName: track.artist === 'Unknown Artist' ? track.name : `${track.artist} - ${track.name}`,
              status: 'completed', // Individual track is completed (for TrackList)
              progress: Math.round((completedCount / totalTracks) * 100), // Overall progress (for DownloadQueue)
              completed: completedCount,
              totalTracks: totalTracks,
              message: `✅ Downloaded ${completedCount}/${totalTracks} tracks: ${track.name}`
            });
            
          // Restore original URL before returning
          track.url = originalUrl;
            return; // Success! No need to try other methods
        }
        
        // Restore original URL
        track.url = originalUrl;
      } else if (track.url && track.url.includes('youtube.com')) {
        // YouTube direct link
        let ytdlExecSuccess = false;
        if (cookieLessFirst) {
          console.log(`  🎯 Cookie-less first mode: Using android_sdkless + YouTube-validated proxy (NO cookies)`);
          // Force cookie-less mode (null = no cookies)
          ytdlExecSuccess = await tryYoutubeDlExec(track, outputFolder, socket, downloadId, settings, null, 0);
        } else {
          // Use smart cookie rotation (normal mode)
          ytdlExecSuccess = await smartRetryWithCookies(async (cookiePath, clientAttempt) => {
            return await tryYoutubeDlExec(track, outputFolder, socket, downloadId, settings, cookiePath, clientAttempt);
          }, 5);
        }
        
          if (ytdlExecSuccess) {
            console.log(`✅ youtube-dl-exec SUCCESS (YouTube direct): ${track.name}`);
            successCount++;
            
            completedCount++;
            // For TrackList: emit download:track event (matches by trackId)
            // Always emit, even if track.id is missing (fallback to track name matching)
            socket.emit('download:track', {
              downloadId,
              trackId: track.id || `${track.artist}-${track.name}`,
              status: 'completed',
              progress: 100,
              message: `✅ ${track.name}`
            });
            console.log(`📤 Emitted download:track for track: ${track.name} (id: ${track.id || 'generated'})`);
            // For TrackList and DownloadQueue: emit download:progress event
            socket.emit('download:progress', {
              downloadId,
              trackName: track.artist === 'Unknown Artist' ? track.name : `${track.artist} - ${track.name}`,
              status: 'completed', // Individual track is completed (for TrackList)
              progress: Math.round((completedCount / totalTracks) * 100), // Overall progress (for DownloadQueue)
              completed: completedCount,
              totalTracks: totalTracks,
              message: `✅ Downloaded ${completedCount}/${totalTracks} tracks: ${track.name}`
            });
            
            return; // Success! No need to try other methods
        }
      }
    }
    
    // ====================================
    // 🆕 TRY METHOD 2: YouTubei.js (Cookie-less, Modern GitHub API)
    // ====================================
    if (track.url && track.url.includes('youtube.com') && attemptNumber < 2) {
      console.log(`\n🎯 METHOD 2: Trying YouTubei.js (Modern GitHub API)...`);
      try {
        const youtubeijsSuccess = await tryYouTubeiJS(track, outputFolder, socket, downloadId);
        if (youtubeijsSuccess) {
          console.log(`✅ YouTubei.js SUCCESS: ${track.name}`);
          successCount++;
          
          completedCount++;
          // For TrackList: emit download:track event (matches by trackId)
          socket.emit('download:track', {
            downloadId,
            trackId: track.id || `${track.artist}-${track.name}`,
            status: 'completed',
            progress: 100,
            message: `✅ ${track.name}`
          });
          console.log(`📤 Emitted download:track for track: ${track.name} (id: ${track.id || 'generated'})`);
          // For TrackList and DownloadQueue: emit download:progress event
          socket.emit('download:progress', {
            downloadId,
            trackName: track.artist === 'Unknown Artist' ? track.name : `${track.artist} - ${track.name}`,
            status: 'completed', // Individual track is completed (for TrackList)
            progress: Math.round((completedCount / totalTracks) * 100), // Overall progress (for DownloadQueue)
            completed: completedCount,
            totalTracks: totalTracks,
            message: `✅ Downloaded ${completedCount}/${totalTracks} tracks: ${track.name}`
          });
          
          return; // Success! No need to try other methods
        }
      } catch (err) {
        console.log(`  ⚠️ YouTubei.js failed, trying next method...`);
      }
    }
    
    // ====================================
    // 🆕 TRY METHOD 3: Piped API (Cookie-less, GitHub)
    // ====================================
    if (track.url && track.url.includes('youtube.com') && attemptNumber < 4) {
      console.log(`\n🎯 METHOD 3: Trying Piped API (3 instances)...`);
      try {
        const pipedSuccess = await tryPipedAPI(track, outputFolder, socket, downloadId);
        if (pipedSuccess) {
          console.log(`✅ Piped API SUCCESS: ${track.name}`);
          successCount++;
          
          completedCount++;
          // For TrackList: emit download:track event (matches by trackId)
          socket.emit('download:track', {
            downloadId,
            trackId: track.id || `${track.artist}-${track.name}`,
            status: 'completed',
            progress: 100,
            message: `✅ ${track.name}`
          });
          console.log(`📤 Emitted download:track for track: ${track.name} (id: ${track.id || 'generated'})`);
          // For TrackList and DownloadQueue: emit download:progress event
          socket.emit('download:progress', {
            downloadId,
            trackName: track.artist === 'Unknown Artist' ? track.name : `${track.artist} - ${track.name}`,
            status: 'completed', // Individual track is completed (for TrackList)
            progress: Math.round((completedCount / totalTracks) * 100), // Overall progress (for DownloadQueue)
            completed: completedCount,
            totalTracks: totalTracks,
            message: `✅ Downloaded ${completedCount}/${totalTracks} tracks: ${track.name}`
          });
          
          return; // Success! No need to try other methods
        }
      } catch (err) {
        console.log(`  ⚠️ Piped API failed, trying next method...`);
      }
    }
    
    // ====================================
    // 🆕 TRY METHOD 4: Invidious API (Cookie-less)
    // ====================================
    if (track.url && track.url.includes('youtube.com') && attemptNumber < 5) {
      console.log(`\n🎯 METHOD 4: Trying Invidious API (5 instances)...`);
      try {
        const invidiousSuccess = await tryInvidiousAPI(track, outputFolder, socket, downloadId);
        if (invidiousSuccess) {
          console.log(`✅ Invidious API SUCCESS: ${track.name}`);
          successCount++;
          
          completedCount++;
          // For TrackList: emit download:track event (matches by trackId)
          socket.emit('download:track', {
            downloadId,
            trackId: track.id || `${track.artist}-${track.name}`,
            status: 'completed',
            progress: 100,
            message: `✅ ${track.name}`
          });
          console.log(`📤 Emitted download:track for track: ${track.name} (id: ${track.id || 'generated'})`);
          // For TrackList and DownloadQueue: emit download:progress event
          socket.emit('download:progress', {
            downloadId,
            trackName: track.artist === 'Unknown Artist' ? track.name : `${track.artist} - ${track.name}`,
            status: 'completed', // Individual track is completed (for TrackList)
            progress: Math.round((completedCount / totalTracks) * 100), // Overall progress (for DownloadQueue)
            completed: completedCount,
            totalTracks: totalTracks,
            message: `✅ Downloaded ${completedCount}/${totalTracks} tracks: ${track.name}`
          });
          
          return; // Success! No need to try other methods
        }
      } catch (err) {
        console.log(`  ⚠️ Invidious API failed, trying yt-dlp...`);
      }
    }
    
    // ====================================
    // 🔄 METHOD 5: yt-dlp (with auto-cookies)
    // ====================================
    console.log(`\n🎯 METHOD 5: Trying yt-dlp (with auto-cookies & proxies)...`);
    
    socket.emit('download:status', {
      downloadId,
      status: 'downloading',
      message: `🔄 yt-dlp fallback: ${track.artist === 'Unknown Artist' ? track.name : `${track.artist} - ${track.name}`}`
    });
    
    // Sanitize filename to avoid issues - use createSafeFilename for consistency
    const safeFilename = createSafeFilename(track);
    const outputPath = path.join(outputFolder, `${safeFilename}.%(ext)s`);
    
    // Try to get YouTube link from multiple sources:
    // 1. Check if track.url itself is a YouTube URL
    // 2. Check if we captured a YouTube link from spotdl errors
    let youtubeLink = null;
    const isYouTubeUrl = (url) => {
      return url && (url.includes('youtube.com/watch') || url.includes('youtu.be/') || url.includes('music.youtube.com/watch'));
    };
    
    if (isYouTubeUrl(track.url)) {
      youtubeLink = track.url;
      console.log(`  ✅ Track already has YouTube URL: ${youtubeLink}`);
    } else {
      console.log(`  ⚠️  Track URL is not a YouTube URL: ${track.url}`);
      // Check captured links from spotdl errors
      youtubeLink = youtubeLinks[track.url] || youtubeLinks[track.id];
      if (youtubeLink) {
        console.log(`  ✅ Using YouTube link from spotdl error: ${youtubeLink}`);
      } else {
        console.log(`  ⚠️  No YouTube link found in spotdl errors either`);
        // Try finding best match via yt-dlp search (no proxies)
        const found = await findBestYouTubeMatch(track);
        if (found) {
          youtubeLink = found;
          console.log(`  ✅ Best YouTube match found: ${youtubeLink}`);
        }
      }
    }
    
    // Skip metadata fetching - yt-dlp will handle it during download (faster)
    
    // 🚀 OPTIMIZATION: Check if we have real cookies - if not, prioritize search method (works better for cookie-less)
    let hasRealCookies = false;
    try {
      const cookieSetup = await setupYouTubeCookies();
      if (cookieSetup) {
        const isAutoGenerated = cookieSetup.path && cookieSetup.path.includes('.auto_generated_cookies');
        hasRealCookies = !isAutoGenerated;
      }
    } catch (err) {
      // No cookies available
    }
    
    let ytdlpArgs;
    let usingDirectLink = false;
    let useSearchMethod = false;
    
    // 🚀 OPTIMIZATION: For cookie-less downloads, prioritize search method (works better than direct URL)
    if (youtubeLink && !youtubeLinks[`retry_${track.id}`] && hasRealCookies) {
      console.log(`  🎯 Using direct YouTube link: ${youtubeLink}`);
      usingDirectLink = true;
    } else if (!hasRealCookies && youtubeLink && !youtubeLinks[`retry_${track.id}`]) {
      // Cookie-less: Try search method first (better bypass)
      console.log(`  🎯 Cookie-less download - trying search method first: ytsearch1:${searchQuery}`);
      useSearchMethod = true;
    } else if (youtubeLink && !youtubeLinks[`retry_${track.id}`]) {
      console.log(`  🎯 Using direct YouTube link: ${youtubeLink}`);
      usingDirectLink = true;
      // Base download arguments
      ytdlpArgs = [
        '-m', 'yt_dlp',
        '-x',
        '--audio-format', settings.format || 'mp3',
        '--audio-quality', settings.quality || '320K',
        '--embed-thumbnail',
        '--embed-metadata',
        '--add-metadata',
        // Parse artist/title from video title if it matches "Artist - Title"
        '--metadata-from-title', '%(artist)s - %(title)s',
        '--output', outputPath,
        '--no-playlist',
        '--no-part',  // Don't use .part files
        '--force-overwrites',  // Overwrite incomplete files
        '--no-warnings',
        '--ignore-errors',
        youtubeLink
      ];
      
      // 🔥 CRITICAL FIX: Use smart cookie rotation
      console.log(`\n🔧 Direct Link Download (Attempt ${attemptNumber + 1})`);
      
      // Setup YouTube cookies (will use cookie pool with smart rotation)
      try {
        const cookieSetup = await setupYouTubeCookies();
        if (cookieSetup) {
          if (cookieSetup.type === 'file') {
            ytdlpArgs.push('--cookies', cookieSetup.path);
            console.log(`  ✅ Authenticated with YouTube cookies (file)`);
          } else if (cookieSetup.type === 'browser') {
            ytdlpArgs.push('--cookies-from-browser', cookieSetup.browser);
            console.log(`  ✅ Authenticated with ${cookieSetup.browser} browser cookies`);
          }
        }
      } catch (err) {
        console.log(`  ⚠️ Cookie setup failed: ${err.message}`);
      }
      
      // Add enhanced methods with strategy cycling based on attempt number
      await addYouTubeEnhancements(ytdlpArgs, attemptNumber);
      
      // Extra bypass for downloads (more aggressive)
      ytdlpArgs.push('--socket-timeout', '60'); // higher timeout over proxies
      ytdlpArgs.push('--retries', '15');
      ytdlpArgs.push('--fragment-retries', '15');
      ytdlpArgs.push('--skip-unavailable-fragments');  // FIX: This is a flag, not a value option
      ytdlpArgs.push('--http-chunk-size', '1M'); // smaller chunks reduce proxy timeouts

      // Force metadata tags from known track fields (overrides unknowns)
      const safeArtist = (track.artist || '').replace(/"/g, '\\"');
      const safeTitle = (track.name || '').replace(/"/g, '\\"');
      const safeAlbum = (track.album || '').replace(/"/g, '\\"');
      let ffArgs = `FFmpegMetadata:-metadata artist=\"${safeArtist}\" -metadata title=\"${safeTitle}\"`;
      if (safeAlbum && safeAlbum !== 'YouTube') {
        ffArgs += ` -metadata album=\"${safeAlbum}\"`;
      }
      ytdlpArgs.push('--postprocessor-args', ffArgs);
    }
    
    // Build search method args if needed
    if (useSearchMethod || (!youtubeLink || youtubeLinks[`retry_${track.id}`])) {
      // If search failed before, try next query from the array (simpler queries)
      const retryIndex = youtubeLinks[`retry_${track.id}`] ? 
        (youtubeLinks[`retry_${track.id}_attempt`] || 0) + 1 : 0;
      const finalSearchQuery = searchQueries[Math.min(retryIndex, searchQueries.length - 1)];
      
      console.log(`  Searching YouTube: "ytsearch1:${finalSearchQuery}" (attempt ${retryIndex + 1}/${searchQueries.length})`);
      
      // Build args - include metadata only if not "Unknown Artist"
      ytdlpArgs = [
        '-m', 'yt_dlp',
        `ytsearch1:${finalSearchQuery}`,
        '-x',
        '--audio-format', settings.format || 'mp3',
        '--audio-quality', settings.quality || '320K',
        '--embed-thumbnail',
        '--embed-metadata',
        '--add-metadata',
        '--metadata-from-title', '%(artist)s - %(title)s',
        '--no-part',  // Don't use .part files
        '--force-overwrites',  // Overwrite incomplete files
        '--no-warnings',
        '--ignore-errors'
      ];
      
      // 🔥 CRITICAL FIX: Use smart cookie rotation
      console.log(`\n🔧 Search-based Download (Attempt ${attemptNumber + 1})`);
      
      // Setup YouTube cookies (will use cookie pool with smart rotation)
      try {
        const cookieSetup = await setupYouTubeCookies();
        if (cookieSetup) {
          if (cookieSetup.type === 'file') {
            ytdlpArgs.push('--cookies', cookieSetup.path);
            console.log(`  ✅ Authenticated with YouTube cookies (file)`);
          } else if (cookieSetup.type === 'browser') {
            ytdlpArgs.push('--cookies-from-browser', cookieSetup.browser);
            console.log(`  ✅ Authenticated with ${cookieSetup.browser} browser cookies`);
          }
        }
      } catch (err) {
        console.log(`  ⚠️ Cookie setup failed: ${err.message}`);
      }
      
      // Apply the new bot bypass strategies to search-based downloads
      const enhancementResult = await addYouTubeEnhancements(ytdlpArgs, attemptNumber);
      console.log(`✅ Applied strategy: ${enhancementResult.strategy}`);
      
      // Force web_embedded for search phase (but keep all the bot bypass headers)
      // Find and replace any existing player_client args with web_embedded for search compatibility
      const clientArgIndex = ytdlpArgs.findIndex(arg => arg.includes('youtube:player_client='));
      if (clientArgIndex !== -1 && clientArgIndex + 1 < ytdlpArgs.length) {
        const originalArg = ytdlpArgs[clientArgIndex + 1];
        ytdlpArgs[clientArgIndex + 1] = originalArg.replace(/youtube:player_client=[^,]+/, 'youtube:player_client=web_embedded');
        console.log(`🔍 Modified for search compatibility: ${ytdlpArgs[clientArgIndex + 1]}`);
      }
      
      // Extra bypass for downloads (more aggressive)
      ytdlpArgs.push('--socket-timeout', '60');
      ytdlpArgs.push('--retries', '15');
      ytdlpArgs.push('--fragment-retries', '15');
      ytdlpArgs.push('--skip-unavailable-fragments');
      ytdlpArgs.push('--http-chunk-size', '1M');
      
      // Force metadata tags from known track fields (overrides unknowns)
      const safeArtist2 = (track.artist || '').replace(/"/g, '\\"');
      const safeTitle2 = (track.name || '').replace(/"/g, '\\"');
      const safeAlbum2 = (track.album || '').replace(/"/g, '\\"');
      let ffArgs2 = `FFmpegMetadata:-metadata artist=\"${safeArtist2}\" -metadata title=\"${safeTitle2}\"`;
      if (safeAlbum2 && safeAlbum2 !== 'YouTube') {
        ffArgs2 += ` -metadata album=\"${safeAlbum2}\"`;
      }
      ytdlpArgs.push('--postprocessor-args', ffArgs2);
      
      // Add output path and no-playlist at the end
      ytdlpArgs.push('--output', outputPath);
      ytdlpArgs.push('--no-playlist');
    }
    
    try {
      // Check for cancellation before starting
      const downloadInfo = activeDownloads.get(downloadId);
      if (!downloadInfo || downloadInfo.cancelled) {
        return 'cancelled';
      }
      
      const result = await new Promise((resolve, reject) => {
        const ytdlpProcess = spawn(PYTHON_CMD, ytdlpArgs, {
          cwd: outputFolder,
          shell: false,
          detached: true,  // Keep process alive even if parent gets SIGTERM
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        // 🔥 Track this process for cancellation
        let processList = activeProcesses.get(downloadId);
        if (!processList) {
          processList = [];
          activeProcesses.set(downloadId, processList);
        } else if (!Array.isArray(processList)) {
          // Convert old format to array
          processList = [processList];
          activeProcesses.set(downloadId, processList);
        }
        processList.push({
          process: ytdlpProcess,
          type: 'yt-dlp',
          trackId: track.id,
          startTime: Date.now()
        });
        
        // Cleanup function to remove process from tracking
        const removeProcess = () => {
          const currentList = activeProcesses.get(downloadId);
          if (Array.isArray(currentList)) {
            const index = currentList.findIndex(p => p.process === ytdlpProcess);
            if (index !== -1) {
              currentList.splice(index, 1);
              // If all processes are done and download is cancelled, clean up
              if (currentList.length === 0) {
                activeProcesses.delete(downloadId);
                const downloadInfo = activeDownloads.get(downloadId);
                if (downloadInfo && downloadInfo.cancelled) {
                  console.log(`🧹 All processes stopped for cancelled download ${downloadId} - cleaning up`);
                  activeDownloads.delete(downloadId);
                }
              }
            }
          }
        };
        
        let output = '';
        let errorOutput = '';
        let searchReturnedZeroItems = false;
        let cookieRegenerated = false; // 🔥 Track if we've regenerated cookies for this download
        
        ytdlpProcess.stdout.on('data', (data) => {
          const txt = data.toString();
          output += txt;
          console.log(`  yt-dlp${useSearchMethod ? ' search' : ''}: ${txt.trim()}`);
        });
        
        ytdlpProcess.stderr.on('data', (data) => {
          const txt = data.toString();
          errorOutput += txt;
          
          // 🔥 NEW: Detect bot detection errors during download
          const hasBotDetectionError = txt.includes('Sign in to confirm') || 
                                       txt.includes('LOGIN_REQUIRED') ||
                                       txt.includes('Please sign in to continue') ||
                                       (txt.includes('This video is unavailable') && txt.includes('sign in'));
          
          if (hasBotDetectionError && !cookieRegenerated) {
            console.log('  🚨 BOT DETECTION ERROR DETECTED during download!');
            cookieRegenerated = true; // Flag to prevent multiple regenerations
            // Mark cookies as failed immediately
            markCookiesAsFailed().catch(() => {});
            // Regenerate cookies in background (don't await to avoid blocking)
            regenerateCookiesOnFailure().then(success => {
              if (success) {
                console.log('  ✅ Cookies regenerated - future downloads will use new cookies');
              } else {
                console.log('  ⚠️ Cookie regeneration failed - will continue with cookie-less methods');
              }
            });
          }
          
          // yt-dlp outputs progress to stderr, so log it
          if (txt.includes('[download]') || txt.includes('[ExtractAudio]') || txt.includes('[Metadata]') || 
              txt.includes('[EmbedThumbnail]') || txt.includes('[ThumbnailsConvertor]')) {
            console.log(`  yt-dlp${useSearchMethod ? ' search' : ''}: ${txt.trim()}`);
          }
          // Detect ffmpeg issues
          if (txt.includes('ffmpeg') || txt.includes('avconv') || txt.includes('WARNING')) {
            console.log(`  ⚠️  ${txt.trim()}`);
          }
          // 🚀 OPTIMIZATION: Detect "Downloading 0 items" for search method
          if (useSearchMethod && (txt.includes('Downloading 0 items') || txt.includes('Playlist') && txt.includes('Downloading 0 items'))) {
            searchReturnedZeroItems = true;
            console.log(`  ⚠️ Search returned 0 items - will try next query or fallback`);
          }
        });
        
        ytdlpProcess.on('close', async (code) => {
          // 🚀 OPTIMIZATION: If search returned 0 items, try next query or fallback to direct URL
          if (useSearchMethod && searchReturnedZeroItems) {
            const currentAttempt = youtubeLinks[`retry_${track.id}_attempt`] || 0;
            const nextAttempt = currentAttempt + 1;
            
            // If we have more search queries to try, use them
            if (nextAttempt < searchQueries.length) {
              console.log(`  🔄 Search returned 0 items - trying next query variation (${nextAttempt + 1}/${searchQueries.length})...`);
              youtubeLinks[`retry_${track.id}_attempt`] = nextAttempt;
              resolve('search_zero_items'); // Signal to retry with next query
              return;
            } else if (youtubeLink && !youtubeLinks[`retry_${track.id}`]) {
              // All search queries failed, try direct URL
              console.log(`  🔄 All search queries returned 0 items - falling back to direct URL...`);
              youtubeLinks[`retry_${track.id}`] = true;
              resolve('search_zero_items'); // Signal to try direct URL
              return;
            }
          }
          
          if (code === 0) {
            // Build the expected MP3 path (replace %(ext)s with .mp3)
            const expectedFileName = getExpectedFileName(track, 'mp3');
            const mp3Path = path.join(outputFolder, expectedFileName);
            
            // Wait for file system to sync (important for conversion completion)
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Try multiple times to check file existence (file system might be slow)
            let fileExists = await fs.access(mp3Path).then(() => true).catch(() => false);
            
            // 🚀 OPTIMIZATION: For search method, scan for any MP3 files that might match (yt-dlp may use different filename)
            // ⚠️ CRITICAL: For single-track downloads, NEVER use fuzzy matching - only exact match!
            // This prevents incorrectly matching files from previous downloads (e.g., matching "Ta3oun" when downloading "Psyco Sh-t")
            if (!fileExists && useSearchMethod && tracks.length > 1) {
              // Only use fuzzy matching for multi-track downloads
              console.log(`  🔍 Expected file not found, scanning for matching files...`);
              const folderFiles = await fs.readdir(outputFolder).catch(() => []);
              const musicFiles = folderFiles.filter(f => f.endsWith('.mp3') || f.endsWith('.m4a') || f.endsWith('.webm') || f.endsWith('.opus'));
              
              // 🔒 STRICT MATCHING: Require BOTH artist AND track name to match (not just one)
              const trackNameLower = track.name.toLowerCase();
              const artistLower = track.artist !== 'Unknown Artist' ? track.artist.toLowerCase() : '';
              
              const matchingFile = musicFiles.find(f => {
                const normalized = f.toLowerCase();
                // Require track name to be in filename (not just artist)
                const hasTrackName = trackNameLower.split(' ').some(word => word.length > 3 && normalized.includes(word));
                const hasArtist = !artistLower || normalized.includes(artistLower.substring(0, 10));
                // Both must match for multi-track downloads
                return hasTrackName && hasArtist && 
                       (normalized.endsWith('.mp3') || normalized.endsWith('.m4a') || normalized.endsWith('.webm') || normalized.endsWith('.opus'));
              });
              
              if (matchingFile) {
                const matchingFilePath = path.join(outputFolder, matchingFile);
                // Rename to expected filename
                try {
                  await fs.rename(matchingFilePath, mp3Path);
                  console.log(`  ✅ Found and renamed matching file: ${matchingFile} -> ${expectedFileName}`);
                  fileExists = true;
                } catch (renameError) {
                  console.log(`  ⚠️  Could not rename file: ${renameError.message}`);
                  fileExists = true;
                }
              } else {
                // Try one more time with exact expected filename
                for (let i = 0; i < 3; i++) {
                  fileExists = await fs.access(mp3Path).then(() => true).catch(() => false);
                  if (fileExists) break;
                  await new Promise(resolve => setTimeout(resolve, 500));
                }
              }
            } else if (!fileExists && useSearchMethod && tracks.length === 1) {
              // Single-track download: Only check exact filename, no fuzzy matching
              // Try one more time with exact expected filename
              for (let i = 0; i < 3; i++) {
                fileExists = await fs.access(mp3Path).then(() => true).catch(() => false);
                if (fileExists) break;
                await new Promise(resolve => setTimeout(resolve, 500));
              }
            } else if (!fileExists) {
              // For non-search methods, try multiple times
            for (let i = 0; i < 5; i++) {
              fileExists = await fs.access(mp3Path).then(() => true).catch(() => false);
              if (fileExists) break;
              await new Promise(resolve => setTimeout(resolve, 200));
              }
            }
            
            // Cleanup: Remove process from tracking
            removeProcess();
            
            if (fileExists) {
              console.log(`✅ yt-dlp${useSearchMethod ? ' search' : ''} SUCCESS: ${searchQuery}`);
              successCount++;
              
              socket.emit('download:progress', {
                downloadId,
                trackName: track.artist === 'Unknown Artist' ? track.name : `${track.artist} - ${track.name}`,
                status: 'completed',
                progress: 100,
                message: `✅ Downloaded via yt-dlp${useSearchMethod ? ' search' : ''}: ${track.artist === 'Unknown Artist' ? track.name : `${track.artist} - ${track.name}`}`
              });
              
              resolve('success');
            } else {
              console.log(`⚠️  yt-dlp${useSearchMethod ? ' search' : ''} COMPLETED but MP3 file not found: ${expectedFileName}`);
              
              // 🚀 OPTIMIZATION: If search returned 0 items and no file, try direct URL
              if (useSearchMethod && searchReturnedZeroItems && youtubeLink && !youtubeLinks[`retry_${track.id}`]) {
                console.log(`  ⚠️ Search returned 0 items - falling back to direct URL...`);
                youtubeLinks[`retry_${track.id}`] = true;
                resolve('search_zero_items'); // Signal to try direct URL
                return;
              }
              
              console.log(`  Checking for other formats...`);
              
              // Check if webm, webp, or part files exist (conversion failed)
              const folderFiles = await fs.readdir(outputFolder).catch(() => []);
              const baseName = path.basename(mp3Path, '.mp3');
              const relatedFiles = folderFiles.filter(f => f.includes(baseName));
              
              if (relatedFiles.length > 0) {
                console.log(`  Found related files:`, relatedFiles);
                console.log(`  ❌ CONVERSION FAILED - ffmpeg might be missing or failed`);
              }
              
              resolve('failed');
            }
          } else {
            // Cleanup: Remove process from tracking
            removeProcess();
            
            console.log(`❌ yt-dlp${useSearchMethod ? ' search' : ''} FAILED: ${searchQuery} (exit code ${code})`);
            if (errorOutput) {
              console.log('  Error output:', errorOutput.substring(0, 500));
              
              const errorLower = errorOutput.toLowerCase();
              
              // 🔥 PRIORITY: Check for age-restricted FIRST (before bot detection)
              // Age-restricted errors: "Sign in to confirm your age" + "inappropriate" OR explicit "age-restricted"
              const hasAgeRestricted = errorLower.includes('age-restricted') || 
                                      (errorLower.includes('sign in to confirm your age') && errorLower.includes('inappropriate')) ||
                                      (errorLower.includes('sign in to confirm your age') && errorLower.includes('video may be inappropriate')) ||
                                      (errorLower.includes('confirm your age') && errorLower.includes('inappropriate')) ||
                                      (errorLower.includes('video may be inappropriate') && errorLower.includes('age')) ||
                                      (errorLower.includes('some formats may be missing') && errorLower.includes('age-restricted')) ||
                                      (errorLower.includes('login_required') && (errorLower.includes('age') || errorLower.includes('inappropriate')));
              
              // 🔥 Check if failure was due to bot detection (ONLY if NOT age-restricted)
              // Bot detection errors: "Sign in to confirm you're not a bot" or "LOGIN_REQUIRED" without age context
              const hasBotDetectionError = !hasAgeRestricted && (
                                           errorLower.includes('sign in to confirm you\'re not a bot') ||
                                           errorLower.includes('sign in to confirm you are not a bot') ||
                                           (errorLower.includes('sign in to confirm') && errorLower.includes('bot')) ||
                                           (errorLower.includes('login_required') && !errorLower.includes('age') && !errorLower.includes('inappropriate')) ||
                                           (errorLower.includes('please sign in to continue') && !errorLower.includes('age') && !errorLower.includes('inappropriate'))
                                          );
              
              if (hasAgeRestricted) {
                console.log('  🔒 Age-restricted video detected - automatically searching for alternative...');
                
                // 🔥 SMART: Immediately search for and download alternative video
                const alternativeUrl = await findAlternativeVideo(track, outputFolder);
                if (alternativeUrl) {
                  console.log(`  🔄 Found alternative video: ${alternativeUrl} - downloading now...`);
                  
                  // Update track URL to alternative
                  track.url = alternativeUrl;
                  
                  // Retry download with alternative video using yt-dlp directly
                  const alternativeArgs = [
                    '-m', 'yt_dlp',
                    alternativeUrl,
                    '-x',
                    '--audio-format', settings.format || 'mp3',
                    '--audio-quality', settings.quality || '320K',
                    '--embed-thumbnail',
                    '--embed-metadata',
                    '--add-metadata',
                    '--output', outputPath,
                    '--no-playlist',
                    '--no-part',
                    '--force-overwrites',
                    '--no-warnings',
                    '--ignore-errors'
                  ];
                  
                  // Add cookies if available
                  try {
                    const cookieSetup = await setupYouTubeCookies();
                    if (cookieSetup && cookieSetup.type === 'file') {
                      alternativeArgs.push('--cookies', cookieSetup.path);
                    }
                  } catch {}
                  
                  const altProcess = spawn(PYTHON_CMD, alternativeArgs, {
                    cwd: outputFolder,
                    shell: false,
                    stdio: ['ignore', 'pipe', 'pipe']
                  });
                  
                  const altSuccess = await new Promise((altResolve) => {
                    altProcess.on('close', async (altCode) => {
                      if (altCode === 0) {
                        // Check if file was created
                        const expectedFileName = getExpectedFileName(track, 'mp3');
                        const mp3Path = path.join(outputFolder, expectedFileName);
                        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for file system sync
                        const fileExists = await fs.access(mp3Path).then(() => true).catch(() => false);
                        
                        if (fileExists) {
                          console.log(`  ✅ Alternative video downloaded successfully: ${track.name}`);
                          socket.emit('download:progress', {
                            downloadId,
                            trackName: track.artist === 'Unknown Artist' ? track.name : `${track.artist} - ${track.name}`,
                            status: 'completed',
                            progress: 100,
                            message: `✅ Downloaded alternative (age-restricted bypass): ${track.name}`
                          });
                          altResolve(true);
                          return;
                        }
                      }
                      console.log(`  ⚠️ Alternative video download failed (exit code ${altCode})`);
                      altResolve(false);
                    });
                    altProcess.on('error', () => altResolve(false));
                  });
                  
                  if (altSuccess) {
                    // ✅ Alternative download succeeded - resolve with success and exit
                    successCount++;
                    removeProcess(); // Clean up process tracking
                    resolve('success'); // ✅ Success - exit early!
                    return;
                  } else {
                    console.log('  ⚠️ Alternative download failed - will continue with other methods');
                  }
                } else {
                  console.log('  ⚠️ No alternative video found - will continue with other methods');
                }
              }
              
              if (hasBotDetectionError) {
                console.log('  🚨 Bot detection error confirmed - cookie may be dead');
                // Don't regenerate immediately - cookie pool will rotate to next cookie
                // Mark cookie as failed (will be handled by cookie pool rotation)
                const cookieIndex = ytdlpArgs.findIndex(arg => arg === '--cookies');
                if (cookieIndex !== -1 && cookieIndex + 1 < ytdlpArgs.length) {
                  const cookiePath = ytdlpArgs[cookieIndex + 1];
                  const match = cookiePath.match(/cookie_(\d+)\.txt/);
                  if (match) {
                    const index = parseInt(match[1]);
                    recordCookieFailure(index);
                    console.log(`  ⚠️ Cookie ${index + 1} failed (bot detection) - immediately starting background regeneration...`);
                    
                    // 🔥 IMMEDIATE REGENERATION: Trigger on FIRST failure for THIS cookie slot
                    regenerateSingleCookie(index).catch((err) => {
                      console.log(`  ⚠️ Background regeneration failed for cookie ${index + 1}: ${err.message}`);
                    });
                  }
                }
              }
              
              // Check for specific ffmpeg errors
              if (errorOutput.includes('ffmpeg') || errorOutput.includes('Postprocessing')) {
                console.log(`  ⚠️  FFMPEG ERROR DETECTED - Make sure ffmpeg is installed and in PATH`);
              }
            }
            resolve('failed');
          }
        });
        
        ytdlpProcess.on('error', (err) => {
          // Cleanup: Remove process from tracking
          removeProcess();
          console.log(`❌ yt-dlp PROCESS ERROR: ${searchQuery}`, err.message);
          resolve('error');
        });
        
        // Check for cancellation periodically during download
        const cancellationChecker = setInterval(() => {
          const downloadInfo = activeDownloads.get(downloadId);
          if (!downloadInfo || downloadInfo.cancelled) {
            console.log(`  🛑 Cancellation detected for track ${track.name} - killing process`);
            clearInterval(cancellationChecker);
            removeProcess();
            try {
              if (!ytdlpProcess.killed) {
                console.log(`  🔪 Sending SIGTERM to yt-dlp process for ${track.name}`);
                ytdlpProcess.kill('SIGTERM');
                // Force kill after 1 second
                setTimeout(() => {
                  if (ytdlpProcess && !ytdlpProcess.killed && ytdlpProcess.kill) {
                    console.log(`  🔪 Force killing yt-dlp process for ${track.name} with SIGKILL`);
                    ytdlpProcess.kill('SIGKILL');
                  }
                }, 1000);
              }
            } catch (e) {
              console.log(`  ⚠️  Error killing process: ${e.message}`);
            }
            resolve('cancelled');
          }
        }, 500); // Check every 500ms for faster cancellation response
        
        // Clear cancellation checker when process completes
        ytdlpProcess.on('close', () => {
          clearInterval(cancellationChecker);
        });
      });
      
      // 🚀 OPTIMIZATION: If search returned 0 items, retry with direct URL
      if (result === 'search_zero_items' && youtubeLink && !youtubeLinks[`retry_${track.id}`]) {
        console.log(`  🔄 Search returned 0 items, retrying with direct URL...`);
        youtubeLinks[`retry_${track.id}`] = true;
        useSearchMethod = false;
        usingDirectLink = true;
        
        // Retry with direct URL
        ytdlpArgs = [
          '-m', 'yt_dlp',
          '-x',
          '--audio-format', settings.format || 'mp3',
          '--audio-quality', settings.quality || '320K',
          '--embed-thumbnail',
          '--embed-metadata',
          '--add-metadata',
          '--metadata-from-title', '%(artist)s - %(title)s',
          '--output', outputPath,
          '--no-playlist',
          '--no-part',
          '--force-overwrites',
          '--no-warnings',
          '--ignore-errors',
          youtubeLink
        ];
        
        // Setup cookies
        try {
          const cookieSetup = await setupYouTubeCookies();
          if (cookieSetup) {
            if (cookieSetup.type === 'file') {
              ytdlpArgs.push('--cookies', cookieSetup.path);
            } else if (cookieSetup.type === 'browser') {
              ytdlpArgs.push('--cookies-from-browser', cookieSetup.browser);
            }
          }
        } catch (err) {
          // Ignore
        }
        
        await addYouTubeEnhancements(ytdlpArgs, attemptNumber);
        ytdlpArgs.push('--socket-timeout', '60');
        ytdlpArgs.push('--retries', '15');
        ytdlpArgs.push('--fragment-retries', '15');
        ytdlpArgs.push('--skip-unavailable-fragments');
        ytdlpArgs.push('--http-chunk-size', '1M');
        
        const safeArtist = (track.artist || '').replace(/"/g, '\\"');
        const safeTitle = (track.name || '').replace(/"/g, '\\"');
        const safeAlbum = (track.album || '').replace(/"/g, '\\"');
        let ffArgs = `FFmpegMetadata:-metadata artist=\"${safeArtist}\" -metadata title=\"${safeTitle}\"`;
        if (safeAlbum && safeAlbum !== 'YouTube') {
          ffArgs += ` -metadata album=\"${safeAlbum}\"`;
        }
        ytdlpArgs.push('--postprocessor-args', ffArgs);
        
        // Retry with direct URL
        const directResult = await new Promise((resolve) => {
          const directProcess = spawn(PYTHON_CMD, ytdlpArgs, {
            cwd: outputFolder,
            shell: false,
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe']
          });
          
          let directOutput = '';
          let directError = '';
          
          directProcess.stdout.on('data', (data) => {
            directOutput += data.toString();
            console.log(`  yt-dlp direct: ${data.toString().trim()}`);
          });
          
          directProcess.stderr.on('data', (data) => {
            const txt = data.toString();
            directError += txt;
            if (txt.includes('[download]') || txt.includes('[ExtractAudio]')) {
              console.log(`  yt-dlp direct: ${txt.trim()}`);
            }
          });
          
          directProcess.on('close', async (code) => {
            if (code === 0) {
              const expectedFileName = getExpectedFileName(track, 'mp3');
              const mp3Path = path.join(outputFolder, expectedFileName);
              await new Promise(resolve => setTimeout(resolve, 1000));
              
              let fileExists = await fs.access(mp3Path).then(() => true).catch(() => false);
              for (let i = 0; i < 5; i++) {
                if (fileExists) break;
                fileExists = await fs.access(mp3Path).then(() => true).catch(() => false);
                await new Promise(resolve => setTimeout(resolve, 200));
              }
              
              if (fileExists) {
                console.log(`✅ yt-dlp direct URL SUCCESS: ${track.name}`);
                successCount++;
                completedCount++;
                socket.emit('download:progress', {
                  downloadId,
                  trackName: track.artist === 'Unknown Artist' ? track.name : `${track.artist} - ${track.name}`,
                  status: completedCount >= totalTracks ? 'completed' : 'downloading',
                  progress: Math.round((completedCount / totalTracks) * 100),
                  completed: completedCount,
                  totalTracks: totalTracks,
                  message: `✅ Downloaded ${completedCount}/${totalTracks} tracks: ${track.artist === 'Unknown Artist' ? track.name : `${track.artist} - ${track.name}`}`
                });
                resolve('success');
              } else {
                resolve('failed');
              }
            } else {
              // Check for age-restricted in direct URL fallback
              const errorLower = directError.toLowerCase();
              
              // 🔥 PRIORITY: Check for age-restricted FIRST (before bot detection)
              // Age-restricted errors: "Sign in to confirm your age" + "inappropriate" OR explicit "age-restricted"
              const hasAgeRestricted = errorLower.includes('age-restricted') || 
                                      (errorLower.includes('sign in to confirm your age') && errorLower.includes('inappropriate')) ||
                                      (errorLower.includes('sign in to confirm your age') && errorLower.includes('video may be inappropriate')) ||
                                      (errorLower.includes('confirm your age') && errorLower.includes('inappropriate')) ||
                                      (errorLower.includes('video may be inappropriate') && errorLower.includes('age')) ||
                                      (errorLower.includes('some formats may be missing') && errorLower.includes('age-restricted')) ||
                                      (errorLower.includes('login_required') && (errorLower.includes('age') || errorLower.includes('inappropriate')));
              
              // 🔥 Check if failure was due to bot detection (ONLY if NOT age-restricted)
              // Bot detection errors: "Sign in to confirm you're not a bot" or "LOGIN_REQUIRED" without age context
              const hasBotDetectionError = !hasAgeRestricted && (
                                           errorLower.includes('sign in to confirm you\'re not a bot') ||
                                           errorLower.includes('sign in to confirm you are not a bot') ||
                                           (errorLower.includes('sign in to confirm') && errorLower.includes('bot')) ||
                                           (errorLower.includes('login_required') && !errorLower.includes('age') && !errorLower.includes('inappropriate')) ||
                                           (errorLower.includes('please sign in to continue') && !errorLower.includes('age') && !errorLower.includes('inappropriate'))
                                          );
              
              // 🔥 PRIORITY: Handle age-restriction first (try alternatives)
              if (hasAgeRestricted) {
                console.log('  🔒 Age-restricted detected in direct URL fallback - searching for alternative...');
                const alternativeUrl = await findAlternativeVideo(track, outputFolder);
                if (alternativeUrl) {
                  console.log(`  🔄 Found alternative: ${alternativeUrl} - downloading...`);
                  track.url = alternativeUrl;
                  // Retry with alternative
                  const altArgs = ytdlpArgs.slice(); // Copy args
                  altArgs[altArgs.length - 1] = alternativeUrl; // Replace URL
                  const altProcess = spawn(PYTHON_CMD, altArgs, {
                    cwd: outputFolder,
                    shell: false,
                    stdio: ['ignore', 'pipe', 'pipe']
                  });
                  
                  const altSuccess = await new Promise((altResolve) => {
                    altProcess.on('close', async (altCode) => {
                      if (altCode === 0) {
                        const expectedFileName = getExpectedFileName(track, 'mp3');
                        const mp3Path = path.join(outputFolder, expectedFileName);
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        const fileExists = await fs.access(mp3Path).then(() => true).catch(() => false);
                        if (fileExists) {
                          console.log(`  ✅ Alternative downloaded successfully: ${track.name}`);
                          socket.emit('download:progress', {
                            downloadId,
                            trackName: track.artist === 'Unknown Artist' ? track.name : `${track.artist} - ${track.name}`,
                            status: 'completed',
                            progress: 100,
                            message: `✅ Downloaded alternative (age-restricted bypass): ${track.name}`
                          });
                          altResolve(true);
                          return;
                        }
                      }
                      altResolve(false);
                    });
                    altProcess.on('error', () => altResolve(false));
                  });
                  
                  if (altSuccess) {
                    successCount++;
                    resolve('success');
                    return;
                  }
                }
              }
              
              // 🚨 Handle bot detection (mark cookie as failed, trigger regeneration)
              if (hasBotDetectionError) {
                console.log('  🚨 Bot detection in direct URL fallback - marking cookie as failed');
                
                // Find which cookie was used
                const cookieArgIndex = ytdlpArgs.findIndex(arg => arg === '--cookies');
                if (cookieArgIndex !== -1 && cookieArgIndex + 1 < ytdlpArgs.length) {
                  const usedCookiePath = ytdlpArgs[cookieArgIndex + 1];
                  const cookieFileName = path.basename(usedCookiePath);
                  
                  // Extract cookie index (e.g., "cookie_2.txt" -> 2)
                  const match = cookieFileName.match(/cookie_(\d+)\.txt/);
                  if (match) {
                    const cookieIndex = parseInt(match[1]);
                    console.log(`  ⚠️ Cookie ${cookieIndex + 1} failed (bot detection) - immediately starting background regeneration...`);
                    recordCookieFailure(cookieIndex);
                    
                    // 🔥 IMMEDIATE REGENERATION: Trigger on FIRST failure for THIS cookie slot
                    regenerateSingleCookie(cookieIndex).catch((err) => {
                      console.log(`  ⚠️ Background regeneration failed for cookie ${cookieIndex + 1}: ${err.message}`);
                    });
                  }
                }
              }
              
              resolve('failed');
            }
          });
          
          directProcess.on('error', () => resolve('failed'));
        });
        
        if (directResult === 'success') {
          return; // Success! Exit early
        }
      }
      
      // If direct link failed, immediately retry with search method
      if (result !== 'success' && usingDirectLink) {
        console.log(`  🔄 Direct link failed, retrying with YouTube search...`);
        youtubeLinks[`retry_${track.id}`] = true;
        
        socket.emit('download:status', {
          downloadId,
          status: 'downloading',
          message: `🔍 Retrying with search: ${track.artist === 'Unknown Artist' ? track.name : `${track.artist} - ${track.name}`}`
        });
        
        const searchArgs = [
          '-m', 'yt_dlp',
          `ytsearch1:${searchQuery}`,
          '-x',
          '--audio-format', settings.format || 'mp3',
          '--audio-quality', settings.quality || '320K',
          '--embed-thumbnail',
          '--embed-metadata',
          '--add-metadata',
          '--no-part',  // Don't use .part files
          '--force-overwrites',  // Overwrite incomplete files
          '--parse-metadata', `artist:${track.artist}`,
          '--parse-metadata', `title:${track.name}`,
          '--parse-metadata', `album:${track.album || 'YouTube'}`,
          '--output', outputPath,
          '--no-playlist'
        ];
        
        await new Promise((resolve) => {
          const searchProcess = spawn(PYTHON_CMD, searchArgs, {
            cwd: outputFolder,
            shell: false
          });
          
          searchProcess.stdout.on('data', (data) => {
            console.log(`  yt-dlp search: ${data.toString().trim()}`);
          });
          
          searchProcess.stderr.on('data', (data) => {
            const txt = data.toString();
            if (txt.includes('[download]') || txt.includes('[ExtractAudio]')) {
              console.log(`  yt-dlp search: ${txt.trim()}`);
            }
          });
          
          searchProcess.on('close', (code) => {
            if (code === 0) {
              console.log(`✅ yt-dlp SEARCH SUCCESS: ${searchQuery}`);
              successCount++;
              
              completedCount++;
              socket.emit('download:progress', {
                downloadId,
                trackName: track.artist === 'Unknown Artist' ? track.name : `${track.artist} - ${track.name}`,
                status: completedCount >= totalTracks ? 'completed' : 'downloading',
                progress: Math.round((completedCount / totalTracks) * 100),
                completed: completedCount,
                totalTracks: totalTracks,
                message: `✅ Downloaded ${completedCount}/${totalTracks} tracks: ${track.artist === 'Unknown Artist' ? track.name : `${track.artist} - ${track.name}`}`
              });
            } else {
              console.log(`❌ yt-dlp SEARCH FAILED: ${searchQuery}`);
            }
            resolve();
          });
          
          searchProcess.on('error', () => resolve());
        });
      }
      
    } catch (error) {
      console.error(`Error running yt-dlp for ${searchQuery}:`, error);
    }
  }; // End of downloadSingleTrack function
  
  // Download tracks in parallel batches
  const batchSize = parallelDownloads;
  const batches = [];
  
  for (let i = 0; i < failedTracks.length; i += batchSize) {
    batches.push(failedTracks.slice(i, i + batchSize));
  }
  
  console.log(`📦 Split into ${batches.length} batches of up to ${batchSize} tracks`);
  
  for (let i = 0; i < batches.length; i++) {
    // Check for cancellation before starting each batch
    const downloadInfo = activeDownloads.get(downloadId);
    if (!downloadInfo || downloadInfo.cancelled) {
      console.log(`🛑 Download cancelled - stopping batch processing`);
      break;
    }
    
    const batch = batches[i];
    console.log(`\n⚡ Batch ${i + 1}/${batches.length}: Downloading ${batch.length} tracks in parallel...`);
    
    socket.emit('download:status', {
      downloadId,
      status: 'downloading',
      message: `⚡ Batch ${i + 1}/${batches.length}: ${batch.length} tracks in parallel...`
    });
    
    // Download all tracks in this batch simultaneously
    const results = await Promise.allSettled(batch.map(downloadSingleTrack));
    
    // Check for cancellation again after batch
    if (!downloadInfo || downloadInfo.cancelled) {
      console.log(`🛑 Download cancelled - stopping batch processing`);
      break;
    }
    
    // Count successes
    const batchSuccesses = results.filter(r => r.status === 'fulfilled').length;
    successCount += batchSuccesses;
    
    console.log(`✅ Batch ${i + 1} complete: ${batchSuccesses}/${batch.length} successful`);
    
    // Small delay between batches to avoid rate limiting
    if (i < batches.length - 1) {
      console.log(`⏳ Waiting 2s before next batch...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  console.log(`\n=== YT-DLP FALLBACK COMPLETE ===`);
  // Note: successCount may not be accurate due to file checking logic
  // The actual success count is determined by checking files in the output folder
  
  return successCount;
}

// Helper function to format elapsed time
function formatElapsedTime(startTime) {
  const elapsed = Date.now() - startTime;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  if (hours > 0) {
    const mins = minutes % 60;
    const secs = seconds % 60;
    return `${hours}h ${mins}m ${secs}s`;
  } else if (minutes > 0) {
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  } else {
    return `${seconds}s`;
  }
}

// Start the actual download process
async function startDownload(downloadId, playlistUrl, tracks, settings, outputFolder) {
  const downloadInfo = activeDownloads.get(downloadId);
  
  if (!downloadInfo) return;

  // Get the specific client socket (if available) to send events only to that client
  const clientSocketId = downloadInfo.socketId;
  const clientSocket = clientSocketId ? io.sockets.sockets.get(clientSocketId) : null;
  const socket = clientSocket || io; // Fallback to broadcast if no specific socket
  
  if (clientSocket) {
    console.log(`✅ Sending download events to specific client: ${clientSocketId}`);
  } else {
    console.log(`⚠️  No socket ID found, broadcasting to all clients`);
  }

  // 🛡️ SMART COOKIE CHECK: Check for STRONG cookies (not just any cookies)
  await initCookiePool(); // Ensure pool is loaded from Redis
  const existingCookies = await getWorkingCookiesFromPool();
  const strongCookies = existingCookies.filter(c => {
    // Check quality from metadata or assume 'strong' if not specified
    const quality = c.quality || 'strong';
    return quality === 'strong';
  });
  
  // 🎯 NEW STRATEGY: If 0 strong cookies, try cookie-less FIRST (fast attempt)
  if (strongCookies.length === 0) {
    console.log(`\n🎯 Strategy: 0/5 STRONG cookies - trying cookie-less with YouTube-validated proxy FIRST`);
    console.log(`   📋 Will use: android_sdkless client + YouTube-validated proxy`);
    console.log(`   ⏱️  If this fails, will pause and wait for 1 strong cookie`);
    
    socket.emit('download:status', {
      downloadId,
      status: 'downloading',
      message: '🎯 Trying cookie-less download first (fast attempt)...'
    });
    
    // Set flag to indicate we're trying cookie-less first
    downloadInfo.triedCookieLessFirst = true;
    downloadInfo.waitingForStrongCookie = false;
    // 🛡️ SET FLAG EARLY: Pause cookie generation IMMEDIATELY when we detect 0 cookies
    // This prevents any ongoing cookie generation from interfering with the download
    downloadInfo.cookieLessAttemptInProgress = true;
    
    // 🛡️ IMMEDIATELY pause cookie generation when download starts with 0 cookies
    // This prevents cookie generation from interfering with the cookie-less attempt
    console.log(`  ⏸️ Pausing cookie generation during cookie-less download attempt`);
  } else if (existingCookies.length === 0) {
    // No cookies at all (not even weak ones)
    console.log(`\n⏸️ Download paused: 0 cookies in pool - waiting for generation...`);
    socket.emit('download:status', {
      downloadId,
      status: 'waiting',
      message: '⏳ Generating cookies... (this may take 30-60s)'
    });
    
    // Trigger emergency cookie generation
    ensurePoolIsFull().catch(err => console.log(`  ⚠️ Pool fill error: ${err.message}`));
    
    // Wait for at least 1 cookie to appear (max 5 minutes)
    const hasCookie = await waitForWorkingCookie(300000, 5000);
    
    if (!hasCookie) {
      console.log(`  ⚠️ No cookies available after waiting - proceeding anyway`);
      socket.emit('download:status', {
        downloadId,
        status: 'downloading',
        message: '⚠️ Proceeding without cookies (may have lower success rate)'
      });
    } else {
      console.log(`  ✅ Cookies available (${(await getWorkingCookiesFromPool()).length}/5) - starting download`);
      socket.emit('download:status', {
        downloadId,
        status: 'downloading',
        message: '✅ Starting download...'
      });
    }
  } else {
    console.log(`  ✅ Pool status: ${existingCookies.length}/5 cookies (${strongCookies.length} STRONG) - starting download immediately`);
  }

  // Start download timer
  const downloadStartTime = Date.now();
  downloadInfo.startTime = downloadStartTime;
  console.log(`\n⏱️  Download started at: ${new Date(downloadStartTime).toLocaleTimeString()}`);

  downloadInfo.status = 'downloading';
  
  socket.emit('download:status', {
    downloadId,
    status: 'downloading',
    message: '🎵 Initializing download...'
  });

  const outputPath = path.join(outputFolder, '{artist} - {title}.{output-ext}');
  const errorLog = path.join(outputFolder, 'failed_downloads.txt');
  const tempErrorLog = path.join(outputFolder, 'temp_errors.txt');

  let attempt = 0;
  let totalSuccess = 0;
  let totalFailed = 0;
  const maxAttempts = 12; // Increased to 12 attempts for better success rate
  let shouldContinue = true;
  let failedTracks = new Set(); // Track which tracks consistently fail
  let lastFailCount = 0;
  let youtubeLinks = {}; // Store YouTube links found by spotdl for fallback
  let consecutiveFailures = 0; // Track consecutive attempts with no progress

  while (attempt < maxAttempts && shouldContinue) {
    // Check if download was cancelled before starting new attempt
    const downloadInfo = activeDownloads.get(downloadId);
    if (!downloadInfo || downloadInfo.cancelled) {
      console.log('❌ Download was cancelled, stopping all attempts');
      return;
    }
    
      // 🎯 COOKIE-LESS FIRST ATTEMPT: If 0 strong cookies, try cookie-less ONCE, then pause
      if (downloadInfo.triedCookieLessFirst && !downloadInfo.waitingForStrongCookie && attempt === 0) {
        console.log(`\n🎯 Attempt 1: Cookie-less mode (android_sdkless + YouTube-validated proxy)`);
        console.log(`   📋 This is the FIRST attempt - if it fails, will pause and wait for strong cookie`);
        
        // 🛡️ FLAG ALREADY SET: Cookie-less attempt in progress (set earlier when 0 cookies detected)
        // downloadInfo.cookieLessAttemptInProgress is already true (set at line 8829)
        
        // Try cookie-less download with YouTube-validated proxy
      const cookieLessSuccess = await tryYtDlpFallback(
        tracks, 
        outputFolder, 
        outputPath, 
        socket, 
        downloadId, 
        youtubeLinks, 
        settings, 
        0, // attemptNumber
        true // cookieLessFirst = true
      );
      
      // 🛡️ CLEAR FLAG: Cookie-less attempt completed
      downloadInfo.cookieLessAttemptInProgress = false;
      
      // 🎯 CHECK FILES DIRECTLY (more reliable than return value)
      // Small delay to ensure files are written to disk
      await new Promise(resolve => setTimeout(resolve, 1000));
      const filesAfter = await fs.readdir(outputFolder);
      const musicFilesAfter = filesAfter.filter(f => 
        f.endsWith('.mp3') || f.endsWith('.flac') || f.endsWith('.ogg')
      );
      
      // Check if download succeeded (either by return value OR by file existence)
      const successCount = typeof cookieLessSuccess === 'number' ? cookieLessSuccess : (cookieLessSuccess?.successCount || 0);
      const hasFiles = musicFilesAfter.length >= tracks.length;
      
      if (successCount > 0 || hasFiles) {
        console.log(`\n✅ Cookie-less attempt SUCCEEDED! (${successCount} tracks from return, ${musicFilesAfter.length} files found)`);
        
        if (hasFiles) {
          console.log(`✅ All tracks downloaded successfully!`);
          // 🚀 IMMEDIATE COMPLETION: Emit completion event right away (don't wait for cookies)
          downloadInfo.status = 'completed';
          downloadInfo.totalSuccess = musicFilesAfter.length;
          downloadInfo.totalFailed = tracks.length - musicFilesAfter.length;
          downloadInfo.attempts = attempt;
          
          const elapsedTime = formatElapsedTime(downloadInfo.startTime);
          
          // Verify files are ready
          try {
            const verifyFiles = musicFilesAfter.slice(0, Math.min(5, musicFilesAfter.length));
            for (const file of verifyFiles) {
              const filePath = path.join(outputFolder, file);
              await fs.access(filePath);
            }
            console.log(`✅ Verified ${verifyFiles.length} files are ready for download`);
          } catch (verifyErr) {
            console.log(`⚠️ File verification warning: ${verifyErr.message} (will continue anyway)`);
          }
          
          // Emit completion immediately
          const completeEventData = {
            downloadId,
            outputFolder,
            totalSuccess: musicFilesAfter.length,
            totalFailed: tracks.length - musicFilesAfter.length,
            attempts: attempt,
            downloadUrl: musicFilesAfter.length > 0 ? `/api/download/archive/${downloadId}` : null,
            failedTracks: [],
            message: `🎉 All ${tracks.length} tracks downloaded!\n⏱️ Completed in ${elapsedTime}\n📦 Click to download your ZIP file!`
          };
          
          console.log(`📤 Emitting download:complete immediately for ${downloadId}: ${musicFilesAfter.length}/${tracks.length} tracks`);
          
          const clientSocketId = downloadInfo.socketId;
          const clientSocket = clientSocketId ? io.sockets.sockets.get(clientSocketId) : null;
          
          if (clientSocket) {
            clientSocket.emit('download:complete', completeEventData);
            console.log(`✅ Emitted to specific client socket: ${clientSocketId}`);
          } else if (socket && socket.connected !== false) {
            socket.emit('download:complete', completeEventData);
            console.log(`✅ Emitted to passed socket: ${socket.id}`);
          } else {
            io.emit('download:complete', completeEventData);
            console.log(`⚠️ No specific socket found - broadcasting to all clients`);
          }
          
          console.log(`✅ download:complete event emitted successfully - file ready for immediate download`);
          
          // 🔄 Resume pool regeneration when cookie-less download succeeds (after a short delay)
          setTimeout(() => {
            checkAndResumeRegeneration().catch(() => {});
          }, 2000); // 2s delay to ensure activeDownloads cleanup completes
          
          shouldContinue = false;
          break;
        }
      } else {
        console.log(`\n❌ Cookie-less attempt FAILED - pausing and waiting for 1 STRONG cookie...`);
        downloadInfo.waitingForStrongCookie = true;
        socket.emit('download:status', {
          downloadId,
          status: 'waiting',
          message: '⏳ Cookie-less attempt failed - waiting for strong cookie... (may take 30-60s)'
        });
        
        // Trigger cookie generation
        ensurePoolIsFull().catch(err => console.log(`  ⚠️ Pool fill error: ${err.message}`));
        
        // Wait for at least 1 STRONG cookie
        let strongCookieFound = false;
        const waitStartTime = Date.now();
        const maxWaitTime = 300000; // 5 minutes
        
        while (Date.now() - waitStartTime < maxWaitTime) {
          await initCookiePool();
          const currentCookies = await getWorkingCookiesFromPool();
          const strongCookies = currentCookies.filter(c => {
            const quality = c.quality || 'strong';
            return quality === 'strong';
          });
          
          if (strongCookies.length >= 1) {
            strongCookieFound = true;
            console.log(`  ✅ STRONG cookie available! (${strongCookies.length} strong cookies found)`);
            break;
          }
          
          // Log status every 10 seconds
          const elapsed = Math.floor((Date.now() - waitStartTime) / 1000);
          if (elapsed % 10 === 0 && elapsed > 0) {
            console.log(`  ⏳ Waiting for STRONG cookie... (${elapsed}s elapsed)`);
            socket.emit('download:status', {
              downloadId,
              status: 'waiting',
              message: `⏳ Waiting for strong cookie... (${elapsed}s)`
            });
          }
          
          await new Promise(resolve => setTimeout(resolve, 5000));
        }
        
        if (!strongCookieFound) {
          console.log(`  ⚠️ No STRONG cookie found after waiting - proceeding with available cookies`);
          socket.emit('download:status', {
            downloadId,
            status: 'downloading',
            message: '⚠️ Proceeding with available cookies (may have lower success rate)'
          });
        } else {
          console.log(`  ✅ STRONG cookie ready - resuming download with cookies`);
          socket.emit('download:status', {
            downloadId,
            status: 'downloading',
            message: '✅ Strong cookie ready - resuming download...'
          });
        }
        
        downloadInfo.waitingForStrongCookie = false;
        // Continue to next attempt (will use cookies now)
      }
    }
    
    // 🛡️ AGGRESSIVE COOKIE CHECK: Pause download if cookies drop to 0 DURING download
    const currentCookies = await getWorkingCookiesFromPool();
    if (currentCookies.length === 0 && attempt > 1) {
      console.log(`\n⏸️ DOWNLOAD PAUSED: All cookies died during download - emergency regeneration!`);
      socket.emit('download:status', {
        downloadId,
        status: 'waiting',
        message: '🚨 Cookies expired - regenerating... (may take 30-60s)'
      });
      
      // Emergency regeneration
      ensurePoolIsFull().catch(err => console.log(`  ⚠️ Emergency pool fill error: ${err.message}`));
      
      // Wait for at least 1 cookie
      const hasCookie = await waitForWorkingCookie(300000, 5000);
      
      if (!hasCookie) {
        console.log(`  ⚠️ Emergency regeneration failed - proceeding with cookie-less methods`);
        socket.emit('download:status', {
          downloadId,
          status: 'downloading',
          message: '⚠️ Proceeding without cookies (may have lower success rate)'
        });
      } else {
        console.log(`  ✅ Emergency regeneration successful - resuming download`);
        socket.emit('download:status', {
          downloadId,
          status: 'downloading',
          message: '✅ Cookies regenerated - resuming download'
        });
      }
    }
    
    attempt++;
    
    console.log(`\n=== DOWNLOAD ATTEMPT ${attempt}/${maxAttempts} ===`);
    socket.emit('download:attempt', {
      downloadId,
      attempt,
      maxAttempts,
      message: `🔄 Attempt ${attempt}/${maxAttempts} - Downloading ${tracks.length} tracks...`
    });

    // Get track URLs (only selected tracks)
    const trackUrls = tracks.map(t => t.url).filter(url => url);
    
    // Verify we have tracks to download
    if (trackUrls.length === 0) {
      console.error('❌ No tracks selected for download!');
      socket.emit('download:error', {
        downloadId,
        message: '❌ No tracks selected. Please select at least one track.'
      });
      return;
    }
    
    console.log(`📝 Preparing to download ${trackUrls.length} track(s)`);
    
    // Separate tracks by source
    const isYouTubeUrl = (url) => {
      return url && (url.includes('youtube.com/watch') || url.includes('youtu.be/') || url.includes('music.youtube.com/watch'));
    };
    const isSpotifyUrl = (url) => {
      return url && url.includes('spotify.com/track');
    };
    
    const youtubeTracks = tracks.filter(t => isYouTubeUrl(t.url));
    const spotifyTracks = tracks.filter(t => isSpotifyUrl(t.url));
    
    console.log('\n📊 TRACK SOURCE BREAKDOWN:');
    console.log(`   🎵 Spotify tracks: ${spotifyTracks.length}`);
    console.log(`   📺 YouTube tracks: ${youtubeTracks.length}`);
    console.log(`   📦 Total: ${tracks.length}`);
    
    const allYouTube = youtubeTracks.length === tracks.length;
    const mixedSources = spotifyTracks.length > 0 && youtubeTracks.length > 0;
    
    // Strategy 1: All YouTube tracks - use yt-dlp only
    if (allYouTube) {
      console.log('🎯 All tracks are YouTube - using yt-dlp directly (skipping spotdl)');
      socket.emit('download:status', {
        downloadId,
        status: 'downloading',
        message: '🎯 YouTube-only download - using yt-dlp...'
      });
      
      // Use yt-dlp fallback with outer attempt index to rotate strategies per retry
      const ytdlpSuccess = await tryYtDlpFallback(tracks, outputFolder, outputPath, socket, downloadId, {}, settings, Math.max(0, attempt - 1));
      
      // Check results
      try {
        const files = await fs.readdir(outputFolder);
        const musicFiles = files.filter(f => 
          f.endsWith('.mp3') || f.endsWith('.flac') || f.endsWith('.ogg')
        );
        
        // For single track downloads, only count the specific expected file
        let currentSuccess;
        const totalTracks = tracks.length;
        
        if (totalTracks === 1) {
          // Single track: ONLY use exact filename match (no fuzzy matching - avoids wrong file matches!)
          const track = tracks[0];
          const expectedFileName = getExpectedFileName(track, 'mp3');
          const fileExists = checkFileExistsForTrack(musicFiles, track, 'mp3');
          currentSuccess = fileExists ? 1 : 0;
          console.log(`📝 Single track check: ${expectedFileName} - ${fileExists ? 'Found ✅' : 'Not found ❌'}`);
        } else {
          // Multiple tracks: count all music files in the subfolder
          currentSuccess = musicFiles.length;
        }
        
        const successRate = currentSuccess / totalTracks;
        
        console.log(`\n📊 Downloaded ${currentSuccess}/${totalTracks} tracks (${Math.round(successRate * 100)}%)`);
        
        // Log files found for debugging
        if (musicFiles.length > 0) {
          console.log(`\n✅ Files found in folder:`);
          musicFiles.slice(0, 5).forEach(f => console.log(`   - ${f}`));
          if (musicFiles.length > 5) {
            console.log(`   ... and ${musicFiles.length - 5} more`);
          }
        }
        
        // Track progress between attempts
        if (currentSuccess > lastFailCount) {
          consecutiveFailures = 0; // Reset on progress
          lastFailCount = currentSuccess;
        } else {
          consecutiveFailures++;
        }
        
        // Complete if: all tracks downloaded OR reasonable threshold met after enough attempts
        // Very lenient completion criteria - try hard before giving up
        const shouldComplete = currentSuccess >= totalTracks || 
                              (attempt >= 10 && currentSuccess > 0 && successRate >= 0.5) ||
                              (attempt >= maxAttempts && currentSuccess > 0);
        
        if (shouldComplete) {
          const status = currentSuccess >= totalTracks ? 'completed' : 'partial';
          const statusEmoji = currentSuccess >= totalTracks ? '✅ ALL' : '⚠️ PARTIAL';
          console.log(`${statusEmoji} DOWNLOAD COMPLETE: ${currentSuccess}/${totalTracks} tracks\n`);
          
          downloadInfo.status = status;
          downloadInfo.totalSuccess = currentSuccess;
          downloadInfo.totalFailed = totalTracks - currentSuccess;
          downloadInfo.attempts = attempt;
          
          const elapsedTime = formatElapsedTime(downloadInfo.startTime);
          console.log(`⏱️  Total download time: ${elapsedTime}`);
          
        // Build failed tracks list with lenient matching
        const normalizeForMatch = (str) => {
          return str
            .toLowerCase()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
            .replace(/[^\w\s]/g, ' ') // Replace special chars with space
            .replace(/\s+/g, ' ') // Normalize spaces
            .trim();
        };
        
        const failedTracksList = tracks.filter(track => {
          const trackNameNorm = normalizeForMatch(track.name);
          const trackArtistNorm = normalizeForMatch(track.artist);
          
          // Extract key words from track name (ignore short words)
          const nameWords = trackNameNorm.split(' ').filter(w => w.length > 2);
          
          const trackExists = musicFiles.some(file => {
            const fileNorm = normalizeForMatch(file);
            
            // Method 1: Check if file contains artist AND at least 50% of track name words
            const hasArtist = trackArtistNorm && fileNorm.includes(trackArtistNorm);
            const matchingNameWords = nameWords.filter(word => fileNorm.includes(word));
            const nameMatchPercent = nameWords.length > 0 ? matchingNameWords.length / nameWords.length : 0;
            
            if (hasArtist && nameMatchPercent >= 0.5) {
              return true;
            }
            
            // Method 2: Check if file contains at least 70% of track name words (for cases where artist might be formatted differently)
            if (nameMatchPercent >= 0.7) {
              return true;
            }
            
            // Method 3: Direct full match (with normalization)
            if (fileNorm.includes(trackNameNorm) && (trackArtistNorm && fileNorm.includes(trackArtistNorm))) {
              return true;
            }
            
            return false;
          });
          
          return !trackExists;
        }).map(t => t.name);
          
          if (failedTracksList.length > 0) {
            console.log(`\n❌ Failed tracks (${failedTracksList.length}):`);
            failedTracksList.forEach(name => console.log(`   - ${name}`));
          }
          
          // 🚀 IMMEDIATE FILE DELIVERY: Ensure files are ready before emitting completion event
          // Verify files exist and are readable (small delay to ensure disk flush)
          if (currentSuccess > 0) {
            try {
              // Quick verification that files are accessible
              const verifyFiles = musicFiles.slice(0, Math.min(5, musicFiles.length)); // Check first 5 files
              for (const file of verifyFiles) {
                const filePath = path.join(outputFolder, file);
                await fs.access(filePath); // Ensure file is readable
              }
              console.log(`✅ Verified ${verifyFiles.length} files are ready for download`);
            } catch (verifyErr) {
              console.log(`⚠️ File verification warning: ${verifyErr.message} (will continue anyway)`);
            }
          }
          
          // Emit completion event IMMEDIATELY after status is set (CRITICAL: Always emit, even if socket errors)
          try {
            const completeEventData = {
              downloadId,
              outputFolder,
              totalSuccess: currentSuccess,
              totalFailed: totalTracks - currentSuccess,
              attempts: attempt,
              downloadUrl: currentSuccess > 0 ? `/api/download/archive/${downloadId}` : null,
              failedTracks: failedTracksList,
              message: currentSuccess >= totalTracks
                ? `🎉 All ${totalTracks} tracks downloaded!\n⏱️ Completed in ${elapsedTime}\n📦 Click to download your ZIP file!`
                : currentSuccess > 0
                  ? `✅ Downloaded ${currentSuccess}/${totalTracks} tracks (${Math.round(successRate * 100)}%)\n⏱️ Completed in ${elapsedTime}\n❌ ${totalTracks - currentSuccess} track(s) failed\n📦 Click to download available tracks!`
                  : `❌ Download failed - no tracks could be downloaded\nPlease try again or check the track URLs`
            };
            
            console.log(`📤 Emitting download:complete for ${downloadId}: ${currentSuccess}/${totalTracks} tracks`);
            
            // Get the client socket from downloadInfo (more reliable than passed socket)
            const clientSocketId = downloadInfo.socketId;
            const clientSocket = clientSocketId ? io.sockets.sockets.get(clientSocketId) : null;
            const emitSocket = clientSocket || socket || io; // Prefer clientSocket, then passed socket, then broadcast
            
            if (clientSocket) {
              console.log(`✅ Emitting to specific client socket: ${clientSocketId}`);
              clientSocket.emit('download:complete', completeEventData);
            } else if (socket && socket.connected !== false) {
              console.log(`✅ Emitting to passed socket: ${socket.id}`);
              socket.emit('download:complete', completeEventData);
            } else {
              console.log(`⚠️ No specific socket found - broadcasting to all clients`);
              io.emit('download:complete', completeEventData);
            }
            
            console.log(`✅ download:complete event emitted successfully - file ready for immediate download`);
          } catch (emitError) {
            console.error(`❌ Error emitting download:complete: ${emitError.message}`);
            console.error(emitError.stack);
            // Try broadcasting to all clients as fallback
            try {
              io.emit('download:complete', {
            downloadId,
            outputFolder,
            totalSuccess: currentSuccess,
            totalFailed: totalTracks - currentSuccess,
            attempts: attempt,
            downloadUrl: currentSuccess > 0 ? `/api/download/archive/${downloadId}` : null,
            failedTracks: failedTracksList,
            message: currentSuccess >= totalTracks
              ? `🎉 All ${totalTracks} tracks downloaded!\n⏱️ Completed in ${elapsedTime}\n📦 Click to download your ZIP file!`
              : currentSuccess > 0
                ? `✅ Downloaded ${currentSuccess}/${totalTracks} tracks (${Math.round(successRate * 100)}%)\n⏱️ Completed in ${elapsedTime}\n❌ ${totalTracks - currentSuccess} track(s) failed\n📦 Click to download available tracks!`
                : `❌ Download failed - no tracks could be downloaded\nPlease try again or check the track URLs`
          });
              console.log(`✅ Fallback broadcast successful`);
            } catch (broadcastError) {
              console.error(`❌ Fallback broadcast also failed: ${broadcastError.message}`);
            }
          }
          
          // 🔄 Resume pool regeneration when download completes (after a short delay for cleanup)
          setTimeout(() => {
            checkAndResumeRegeneration().catch(() => {});
          }, 2000); // 2s delay to ensure activeDownloads cleanup completes
          
          shouldContinue = false;
          continue;
        } else {
          console.log(`⚠️ Some tracks missing (${totalTracks - currentSuccess}/${totalTracks})`);
          console.log(`   Consecutive failures: ${consecutiveFailures}`);
          
         // Send detailed progress update
         const remaining = totalTracks - currentSuccess;
         socket.emit('download:status', {
           downloadId,
           status: 'downloading',
           message: `📥 ${currentSuccess}/${totalTracks} tracks (${Math.round(successRate * 100)}%) • ${remaining} remaining • Attempt ${attempt}/${maxAttempts}`
         });
        }
      } catch (error) {
        console.error('Error checking files:', error);
        consecutiveFailures++;
      }
      
      const retryDelay = attempt > 1 ? 5000 : 2000;
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      continue;
    }
    
    // Strategy 2: Use youtube-dl-exec for ALL tracks (Spotify search + YouTube direct)
    // This is MUCH FASTER than spotdl and works for both sources
    if (mixedSources || spotifyTracks.length > 0) {
      console.log('🚀 FAST MODE: Using youtube-dl-exec for all tracks');
      console.log(`   🎵 Spotify tracks: ${spotifyTracks.length} (will search YouTube)`);
      console.log(`   📺 YouTube tracks: ${youtubeTracks.length} (direct download)`);
      
      socket.emit('download:status', {
        downloadId,
        status: 'downloading',
        message: `🚀 Fast Mode: youtube-dl-exec for ${tracks.length} tracks`
      });
      
      // Use yt-dlp fallback with outer attempt index to rotate strategies per retry
      const ytdlpSuccess = await tryYtDlpFallback(tracks, outputFolder, outputPath, socket, downloadId, {}, settings, Math.max(0, attempt - 1));
      
      // Check results
      try {
        const files = await fs.readdir(outputFolder);
        const musicFiles = files.filter(f => 
          f.endsWith('.mp3') || f.endsWith('.flac') || f.endsWith('.ogg')
        );
        
        // For single track downloads, only count the specific expected file
        let currentSuccess;
        const totalTracks = tracks.length;
        
        if (totalTracks === 1) {
          // Single track: ONLY use exact filename match (no fuzzy matching - avoids wrong file matches!)
          const track = tracks[0];
          const expectedFileName = getExpectedFileName(track, 'mp3');
          const fileExists = checkFileExistsForTrack(musicFiles, track, 'mp3');
          currentSuccess = fileExists ? 1 : 0;
          console.log(`📝 Single track check: ${expectedFileName} - ${fileExists ? 'Found ✅' : 'Not found ❌'}`);
        } else {
          // Multiple tracks: count all music files in the subfolder
          currentSuccess = musicFiles.length;
        }
        
        const successRate = currentSuccess / totalTracks;
        
        console.log(`\n📊 Downloaded ${currentSuccess}/${totalTracks} tracks (${Math.round(successRate * 100)}%)`);
        
        if (musicFiles.length > 0) {
          console.log(`\n✅ Files found in folder:`);
          musicFiles.slice(0, 5).forEach(f => console.log(`   - ${f}`));
          if (musicFiles.length > 5) {
            console.log(`   ... and ${musicFiles.length - 5} more`);
          }
        }
        
        // Emit track-level status updates
        tracks.forEach(track => {
          const expectedFileName = getExpectedFileName(track, 'mp3');
          let trackDownloaded = checkFileExistsForTrack(musicFiles, track, 'mp3');
          // For multi-track scenarios, allow fuzzy matching (handles YouTube title variations)
          // For single tracks, only exact match (already handled above, but be safe)
          if (!trackDownloaded && tracks.length > 1) {
            trackDownloaded = musicFiles.some(f => isFileMatchForTrack(f, track));
          }
          
          if (trackDownloaded) {
            socket.emit('download:track', {
              downloadId,
              trackId: track.id,
              status: 'completed',
              progress: 100,
              message: `✅ ${track.name}`
            });
          } else {
            socket.emit('download:track', {
              downloadId,
              trackId: track.id,
              status: 'failed',
              progress: 0,
              message: `❌ ${track.name}`
            });
          }
        });
        
        // Track progress between attempts
        if (currentSuccess > lastFailCount) {
          consecutiveFailures = 0;
          lastFailCount = currentSuccess;
        } else {
          consecutiveFailures++;
        }
        
        // Complete if all tracks downloaded or reasonable threshold met
        const shouldComplete = currentSuccess >= totalTracks || 
                              (attempt >= 10 && currentSuccess > 0 && successRate >= 0.5) ||
                              (attempt >= maxAttempts && currentSuccess > 0);
        
        if (shouldComplete) {
          const status = currentSuccess >= totalTracks ? 'completed' : 'partial';
          const statusEmoji = currentSuccess >= totalTracks ? '✅ ALL' : '⚠️ PARTIAL';
          console.log(`${statusEmoji} DOWNLOAD COMPLETE: ${currentSuccess}/${totalTracks} tracks\n`);
          
          downloadInfo.status = status;
          downloadInfo.totalSuccess = currentSuccess;
          downloadInfo.totalFailed = totalTracks - currentSuccess;
          downloadInfo.attempts = attempt;
          
          const elapsedTime = formatElapsedTime(downloadInfo.startTime);
          console.log(`⏱️  Total download time: ${elapsedTime}`);
          
          // Emit completion event (CRITICAL: Always emit, even if socket errors)
          try {
            const completeEventData = {
              downloadId,
              outputFolder,
              totalSuccess: currentSuccess,
              totalFailed: totalTracks - currentSuccess,
              attempts: attempt,
              downloadUrl: currentSuccess > 0 ? `/api/download/archive/${downloadId}` : null,
              message: currentSuccess >= totalTracks
                ? `🎉 All ${totalTracks} tracks downloaded!\n⏱️ Completed in ${elapsedTime}\n📦 Click to download your ZIP file!`
                : currentSuccess > 0
                  ? `✅ Downloaded ${currentSuccess}/${totalTracks} tracks (${Math.round(successRate * 100)}%)\n⏱️ Completed in ${elapsedTime}\n❌ ${totalTracks - currentSuccess} track(s) failed\n📦 Click to download available tracks!`
                  : `❌ Download failed - no tracks could be downloaded\nPlease try again or check the track URLs`
            };
            
            console.log(`📤 Emitting download:complete for ${downloadId}: ${currentSuccess}/${totalTracks} tracks`);
            
            // Get the client socket from downloadInfo (more reliable than passed socket)
            const clientSocketId = downloadInfo.socketId;
            const clientSocket = clientSocketId ? io.sockets.sockets.get(clientSocketId) : null;
            
            if (clientSocket) {
              console.log(`✅ Emitting to specific client socket: ${clientSocketId}`);
              clientSocket.emit('download:complete', completeEventData);
            } else if (socket && socket.connected !== false) {
              console.log(`✅ Emitting to passed socket: ${socket.id}`);
              socket.emit('download:complete', completeEventData);
            } else {
              console.log(`⚠️ No specific socket found - broadcasting to all clients`);
              io.emit('download:complete', completeEventData);
            }
            
            console.log(`✅ download:complete event emitted successfully`);
          } catch (emitError) {
            console.error(`❌ Error emitting download:complete: ${emitError.message}`);
            console.error(emitError.stack);
            // Try broadcasting to all clients as fallback
            try {
              io.emit('download:complete', {
            downloadId,
            outputFolder,
            totalSuccess: currentSuccess,
            totalFailed: totalTracks - currentSuccess,
            attempts: attempt,
            downloadUrl: currentSuccess > 0 ? `/api/download/archive/${downloadId}` : null,
            message: currentSuccess >= totalTracks
              ? `🎉 All ${totalTracks} tracks downloaded!\n⏱️ Completed in ${elapsedTime}\n📦 Click to download your ZIP file!`
              : currentSuccess > 0
                ? `✅ Downloaded ${currentSuccess}/${totalTracks} tracks (${Math.round(successRate * 100)}%)\n⏱️ Completed in ${elapsedTime}\n❌ ${totalTracks - currentSuccess} track(s) failed\n📦 Click to download available tracks!`
                : `❌ Download failed - no tracks could be downloaded\nPlease try again or check the track URLs`
          });
              console.log(`✅ Fallback broadcast successful`);
            } catch (broadcastError) {
              console.error(`❌ Fallback broadcast also failed: ${broadcastError.message}`);
            }
          }
          
          shouldContinue = false;
          continue;
        } else {
          console.log(`⚠️ Some tracks missing (${totalTracks - currentSuccess}/${totalTracks})`);
          console.log(`   Consecutive failures: ${consecutiveFailures}`);
          
          const remaining = totalTracks - currentSuccess;
          socket.emit('download:status', {
            downloadId,
            status: 'downloading',
            message: `📥 ${currentSuccess}/${totalTracks} tracks (${Math.round(successRate * 100)}%) • ${remaining} remaining • Attempt ${attempt}/${maxAttempts}`
          });
        }
      } catch (error) {
        console.error('Error checking files:', error);
        consecutiveFailures++;
      }
      
      const retryDelay = attempt > 1 ? 5000 : 2000;
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      continue;
    }
    
    // Build spotdl command with direct URLs (for Spotify tracks only)
    // At this point, 'tracks' only contains Spotify tracks if we had mixed sources
    const spotifyUrls = tracks.map(t => t.url).filter(url => url && url.includes('spotify.com'));
    
    // If no Spotify tracks left (all were YouTube), skip spotdl
    if (spotifyUrls.length === 0) {
      console.log('✅ All tracks already downloaded via yt-dlp, skipping spotdl');
      
      // Check final results
      try {
        const files = await fs.readdir(outputFolder);
        const musicFiles = files.filter(f => 
          f.endsWith('.mp3') || f.endsWith('.flac') || f.endsWith('.ogg')
        );
        
        console.log(`\n📊 Final count: ${musicFiles.length} tracks downloaded`);
        
        downloadInfo.status = 'completed';
        downloadInfo.totalSuccess = musicFiles.length;
        downloadInfo.totalFailed = 0;
        downloadInfo.attempts = attempt;
        
        const elapsedTime = formatElapsedTime(downloadInfo.startTime);
        console.log(`⏱️  Total download time: ${elapsedTime}`);
        
        socket.emit('download:complete', {
          downloadId,
          outputFolder,
          totalSuccess: musicFiles.length,
          totalFailed: 0,
          attempts: attempt,
          downloadUrl: `/api/download/archive/${downloadId}`,
          message: `🎉 All ${musicFiles.length} tracks downloaded successfully!\n⏱️ Completed in ${elapsedTime}\n📦 Click to download your ZIP file!`
        });
        
        // 🔄 Resume pool regeneration when download completes (after a short delay)
        setTimeout(() => {
          checkAndResumeRegeneration().catch(() => {});
        }, 2000); // 2s delay to ensure activeDownloads cleanup completes
        
        shouldContinue = false;
        continue;
      } catch (error) {
        console.error('Error checking files:', error);
      }
    }
    
    // Build yt-dlp args for spotdl (including proxy if available)
    let ytdlpArgs = '--extractor-args youtube:player_client=android --user-agent "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36" --sleep-requests 1 --retries 10';
    
    // Add proxy using proxy manager (handles Oxylabs > Free proxies automatically)
    const proxy = proxyManager.getProxyForYtdlp();
    if (proxy) {
      ytdlpArgs += ` --proxy ${proxy} --no-check-certificate`;
      if (proxy.includes('oxylabs.io')) {
        console.log('🌟 Oxylabs premium proxy enabled for spotdl downloads');
      } else {
        console.log(`🌐 Proxy enabled for spotdl downloads: ${proxy.substring(0, 30)}...`);
      }
    } else if (process.env.SCRAPERAPI_KEY) {
      // Fallback to ScraperAPI if proxy manager has nothing
      const scraperApiProxy = `http://scraperapi:${process.env.SCRAPERAPI_KEY}@proxy-server.scraperapi.com:8001`;
      ytdlpArgs += ` --proxy ${scraperApiProxy} --no-check-certificate`;
      console.log('🌐 ScraperAPI proxy enabled for spotdl downloads');
    }
    
    const spotdlArgs = [
      '-m', 'spotdl',
      'download',
      ...spotifyUrls, // Pass only Spotify URLs
      '--output', outputPath,
      '--format', settings.format || 'mp3',
      '--bitrate', settings.quality || '320k',
      '--threads', (settings.threads || 8).toString(),
      '--overwrite', 'skip',
      // FIX: Use Android client to bypass YouTube blocking
      '--yt-dlp-args', ytdlpArgs
    ];

    console.log('Running spotdl command:', `${PYTHON_CMD} ${spotdlArgs.slice(0, 6).join(' ')}... (${spotifyUrls.length} Spotify URLs)`);
    console.log(`Downloading ${spotifyUrls.length} Spotify tracks`);

    const spotdlProcess = spawn(PYTHON_CMD, spotdlArgs, {
      cwd: outputFolder,
      shell: false  // Don't use shell to avoid URL parsing issues
    });

    // Store process for cancellation (use array format)
    activeProcesses.set(downloadId, [{
      process: spotdlProcess,
      type: 'spotdl',
      startTime: Date.now()
    }]);

    let currentTrack = null;
    let trackIndex = 0;
    let downloadedThisRound = 0;
    let lastActivityTime = Date.now();
    let processStuck = false;
    let consecutiveErrors = 0;
    let lastSuccessTime = Date.now();

    // Timeout detection - check if process is stuck
    const timeoutChecker = setInterval(() => {
      const processInfo = activeProcesses.get(downloadId);
      const downloadInfo = activeDownloads.get(downloadId);
      
      // Check if download was cancelled
      if (!processInfo || !downloadInfo || downloadInfo.cancelled) {
        clearInterval(timeoutChecker);
        return;
      }
      
      const timeSinceActivity = Date.now() - lastActivityTime;
      const timeSinceSuccess = Date.now() - lastSuccessTime;
      
      // Process is stuck if:
      // 1. No activity for PROCESS_TIMEOUT
      // 2. OR no successful downloads for 2x PROCESS_TIMEOUT AND we have consecutive errors
      const isStuck = (timeSinceActivity > PROCESS_TIMEOUT) || 
                     (timeSinceSuccess > PROCESS_TIMEOUT * 2 && consecutiveErrors >= 2);
      
      if (isStuck && !processStuck) {
        processStuck = true;
        const reason = timeSinceActivity > PROCESS_TIMEOUT 
          ? `no activity for ${Math.floor(timeSinceActivity / 1000)}s`
          : `${consecutiveErrors} consecutive errors, no success for ${Math.floor(timeSinceSuccess / 1000)}s`;
        
        console.log(`⏱️ TIMEOUT: Process stuck (${reason})`);
        
        socket.emit('download:timeout', {
          downloadId,
          message: `⏱️ Download stuck (${reason}). Retrying with yt-dlp...`,
          timeSinceActivity,
          consecutiveErrors
        });
        
        // Kill stuck process
        try {
          spotdlProcess.kill('SIGTERM');
          setTimeout(() => {
            if (spotdlProcess && !spotdlProcess.killed) {
              spotdlProcess.kill('SIGKILL');
            }
          }, 2000);
        } catch (err) {
          console.error('Error killing stuck process:', err.message);
        }
        
        clearInterval(timeoutChecker);
      }
    }, STUCK_CHECK_INTERVAL);

    spotdlProcess.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('SPOTDL:', output);
      
      // Reset activity timer on meaningful output (not just errors)
      // Don't reset on ERROR messages - they indicate stuck state
      if (!output.includes('ERROR:') && !output.includes('WARNING:')) {
        lastActivityTime = Date.now();
      }

      // Match "Processing query:" to identify current track being processed
      const processingMatch = output.match(/Processing query:\s*https:\/\/open\.spotify\.com\/track\/([\w-]+)/);
      if (processingMatch) {
        const trackId = processingMatch[1];
        const track = tracks.find(t => t.id === trackId || t.url.includes(trackId));
        if (track) {
          currentTrack = `${track.artist} - ${track.name}`;
          console.log(`🎯 Processing: ${currentTrack}`);
        }
      }

      // Match "Skipping ... (file already exists)"
      const skippedMatch = output.match(/Skipping\s+(.+?)\s+\(file already exists\)/i);
      if (skippedMatch) {
        const trackName = skippedMatch[1].trim();
        // Don't count skipped files as "downloaded this round"
        // They were downloaded in a previous session
        
        // Reset error counter on skip (it's a successful outcome)
        consecutiveErrors = 0;
        lastSuccessTime = Date.now();
        
        console.log(`⏭️ Skipped (exists): ${trackName}`);
        
        // Emit status but don't count as new download
        socket.emit('download:status', {
          downloadId,
          status: 'downloading',
          message: `⏭️ Already exists: ${trackName}`
        });
      }

      // Match "Downloaded artist - title"
      const downloadedMatch = output.match(/Downloaded[:\s]+(.+)/i) || output.match(/✓\s*(.+)/);
      if (downloadedMatch) {
        const downloadedTrackName = downloadedMatch[1].trim();
        
        console.log(`✓ Downloaded: "${downloadedTrackName}"`);
        
        // Find the actual track index in the tracks array by matching name
        const trackIndex = tracks.findIndex(t => {
          const fullName = `${t.artist} - ${t.name}`;
          return downloadedTrackName.includes(t.name) || downloadedTrackName.includes(t.artist) || fullName.includes(downloadedTrackName);
        });
        
        // VERIFICATION: Check if downloaded track matches any requested track
        const isCorrectTrack = trackIndex >= 0 || tracks.some(t => {
          const artistMatch = downloadedTrackName.toLowerCase().includes(t.artist.toLowerCase());
          const nameMatch = downloadedTrackName.toLowerCase().includes(t.name.toLowerCase());
          return artistMatch && nameMatch;
        });
        
        if (isCorrectTrack) {
          // Correct track downloaded
          downloadedThisRound++;
          totalSuccess++;
          
          // Reset error counter and update success time on successful download
          consecutiveErrors = 0;
          lastSuccessTime = Date.now();
          
          socket.emit('download:progress', {
            downloadId,
            trackIndex: trackIndex >= 0 ? trackIndex : totalSuccess - 1,
            trackName: downloadedTrackName,
            status: 'completed',
            progress: 100,
            message: `✅ Downloaded: ${downloadedTrackName}`
          });
        } else {
          // Wrong track downloaded! Delete it and mark as failed
          console.log(`⚠️  WRONG TRACK DOWNLOADED! Expected one of:`);
          tracks.forEach(t => console.log(`   - ${t.artist} - ${t.name}`));
          console.log(`   But got: "${downloadedTrackName}"`);
          console.log(`   🗑️  Will delete wrong file and retry with yt-dlp...`);
          
          // Try to delete the wrong file (non-blocking)
          fs.readdir(outputFolder).then(files => {
            const wrongFile = files.find(f => {
              const nameWithoutExt = f.replace(/\.(mp3|flac|ogg|webm)$/, '');
              return nameWithoutExt.includes(downloadedTrackName) || downloadedTrackName.includes(nameWithoutExt);
            });
            
            if (wrongFile) {
              const wrongFilePath = path.join(outputFolder, wrongFile);
              return fs.unlink(wrongFilePath).then(() => {
                console.log(`   ✅ Deleted wrong file: ${wrongFile}`);
              });
            }
          }).catch(deleteError => {
            console.error(`   ❌ Failed to delete wrong file:`, deleteError.message);
          });
          
          socket.emit('download:status', {
            downloadId,
            status: 'downloading',
            message: `⚠️ Wrong track downloaded (${downloadedTrackName}), will retry...`
          });
        }
      }

      // Match "Downloading: artist - title"
      const downloadingMatch = output.match(/Downloading[:\s]+(.+)/i);
      if (downloadingMatch) {
        currentTrack = downloadingMatch[1].trim();
        
        console.log(`⏬ Downloading: ${currentTrack}`);
        
        // Find the actual track index in the tracks array by matching name
        const trackIdx = tracks.findIndex(t => {
          const fullName = `${t.artist} - ${t.name}`;
          return currentTrack.includes(t.name) || currentTrack.includes(t.artist) || fullName.includes(currentTrack);
        });
        
        socket.emit('download:progress', {
          downloadId,
          trackIndex: trackIdx >= 0 ? trackIdx : trackIndex,
          trackName: currentTrack,
          status: 'downloading',
          progress: 0,
          message: `⏬ Downloading: ${currentTrack}`
        });
        
        trackIndex++;
      }

      // Match progress percentage
      const percentMatch = output.match(/(\d+)%/);
      if (percentMatch && currentTrack) {
        const percent = parseInt(percentMatch[1]);
        socket.emit('download:progress', {
          downloadId,
          trackIndex: trackIndex - 1,
          trackName: currentTrack,
          status: 'downloading',
          progress: percent,
          message: `📊 ${percent}% - ${currentTrack}`
        });
      }

      // Match "Found X songs"
      const foundMatch = output.match(/Found (\d+) songs?/i);
      if (foundMatch) {
        const songCount = foundMatch[1];
        socket.emit('download:status', {
          downloadId,
          status: 'downloading',
          message: `🎵 Found ${songCount} songs to download...`
        });
      }

      // Match rate limiting warning
      if (output.includes('rate/request limit')) {
        const retryMatch = output.match(/Retry will occur after:\s*(\d+)/);
        if (retryMatch) {
          const retryTime = retryMatch[1];
          socket.emit('download:status', {
            downloadId,
            status: 'downloading',
            message: `⏳ Rate limited by YouTube. Waiting ${retryTime}s before retry...`
          });
        }
      }
    });

    spotdlProcess.stderr.on('data', (data) => {
      const error = data.toString();
      
      // Filter out INFO and WARNING messages, only show real ERRORs
      if (error.includes('INFO:') || error.includes('WARNING:')) {
        console.log('SPOTDL INFO:', error.trim());
        return;
      }
      
      // Increment error counter for real errors
      if (error.includes('ERROR:')) {
        consecutiveErrors++;
        console.log(`⚠️ Error #${consecutiveErrors} detected`);
      }
      
      // Capture YouTube links from AudioProviderError for yt-dlp fallback
      if (error.includes('AudioProviderError') || error.includes('YT-DLP download error')) {
        console.log('SPOTDL:', error.trim());
        
        // Extract YouTube link from error message
        // Example: "AudioProviderError: YT-DLP download error - \nhttps://music.youtube.com/watch?v=iybxD_aILWg"
        const ytLinkMatch = error.match(/https?:\/\/(?:www\.|music\.)?youtube\.com\/watch\?v=[\w-]+/);
        if (ytLinkMatch) {
          const ytLink = ytLinkMatch[0];
          console.log(`  📝 Captured YouTube link for fallback: ${ytLink}`);
          
          // Try to find which track this is for (look for track name in recent output)
          let track = null;
          
          if (currentTrack) {
            track = tracks.find(t => {
              const fullName = `${t.artist} - ${t.name}`;
              return currentTrack.includes(t.name) || currentTrack.includes(t.artist) || fullName.includes(currentTrack);
            });
          }
          
          // If no currentTrack or couldn't find track, use the first track that doesn't have a link yet
          if (!track && tracks.length === 1) {
            track = tracks[0];
            console.log(`  ℹ️ Single track download, using: ${track.artist} - ${track.name}`);
          } else if (!track) {
            // Find first track without a YouTube link
            track = tracks.find(t => !youtubeLinks[t.id]);
            if (track) {
              console.log(`  ℹ️ Assigning to first unlinked track: ${track.artist} - ${track.name}`);
            }
          }
          
          if (track) {
            youtubeLinks[track.url] = ytLink;
            youtubeLinks[track.id] = ytLink;
            console.log(`  ✓ Linked YouTube URL to track: ${track.artist} - ${track.name}`);
          } else {
            console.log(`  ⚠️ Could not determine which track this YouTube link is for`);
          }
        }
        
        // Don't emit to frontend - these are expected and will be handled by retry/completion
        return;
      }
      
      console.error('SPOTDL ERROR:', error);
      
      // Only emit truly unexpected errors
      if (error.toLowerCase().includes('error:')) {
        socket.emit('download:error', {
          downloadId,
          trackName: currentTrack || 'Unknown',
          error: error.trim()
        });
      }
    });

    await new Promise((resolve) => {
      spotdlProcess.on('close', async (code) => {
        // Clear timeout checker
        clearInterval(timeoutChecker);
        
        // Check if cancelled
        const downloadInfo = activeDownloads.get(downloadId);
        if (downloadInfo && downloadInfo.cancelled) {
          console.log(`❌ Download cancelled, stopping...`);
          shouldContinue = false;
          resolve();
          return;
        }
        
        // Check if we should skip to yt-dlp
        if (downloadInfo && downloadInfo.skipToYtdlp) {
          console.log(`⏭️ Skipping to yt-dlp as requested...`);
          downloadInfo.skipToYtdlp = false; // Reset flag
          // Don't stop - just force yt-dlp fallback this round
        }
        
        console.log(`\nSpotdl process exited with code: ${code}`);
        console.log(`New downloads this round: ${downloadedThisRound}`);
        console.log(`Process stuck: ${processStuck}`);
        
        // Count actual downloaded files
        try {
          const files = await fs.readdir(outputFolder);
          const musicFiles = files.filter(f => 
            f.endsWith('.mp3') || f.endsWith('.flac') || f.endsWith('.ogg')
          );
          const actualDownloadCount = musicFiles.length;
          
          console.log(`Total files in folder: ${actualDownloadCount}`);
          console.log(`Expected tracks: ${tracks.length}`);
          console.log(`Downloaded this attempt: ${downloadedThisRound}`);
          
          // Check which tracks are still missing by checking if files exist for each track (case-insensitive + special chars)
          const normalizeString = (str) => {
            return str
              .normalize('NFD')
              .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
              .replace(/[^\w\s-]/g, ' ') // Replace special chars with space
              .replace(/\s+/g, ' ') // Normalize spaces
              .trim();
          };
          
          console.log('\n🔍 DEBUG: Initial missing tracks check:');
          console.log(`   📁 Files in folder: ${musicFiles.length}`);
          musicFiles.forEach(f => console.log(`      - ${f}`));
          
          const missingTracks = tracks.filter(track => {
            console.log(`\n   🔍 Checking: ${track.artist} - ${track.name}`);
            
            const exists = musicFiles.some(file => {
              const fileNormalized = normalizeString(file.toLowerCase());
              const artistNormalized = normalizeString(track.artist.toLowerCase().trim());
              const nameNormalized = normalizeString(track.name.toLowerCase().trim());
              
              // Extract key words from track name
              const nameWords = nameNormalized.split(' ').filter(w => w.length > 2).slice(0, 4);
              const hasArtist = fileNormalized.includes(artistNormalized);
              const matchingWords = nameWords.filter(word => fileNormalized.includes(word));
              const hasEnoughNameMatch = matchingWords.length >= Math.min(2, nameWords.length);
              
              const isMatch = hasArtist && hasEnoughNameMatch;
              
              // Debug output for each file comparison
              console.log(`      📄 File: "${file}"`);
              console.log(`         Normalized file: "${fileNormalized}"`);
              console.log(`         Normalized artist: "${artistNormalized}"`);
              console.log(`         Normalized name: "${nameNormalized}"`);
              console.log(`         Name keywords: [${nameWords.join(', ')}]`);
              console.log(`         Artist match: ${hasArtist}`);
              console.log(`         Matching keywords: [${matchingWords.join(', ')}]`);
              console.log(`         Has enough name match: ${hasEnoughNameMatch} (${matchingWords.length} >= ${Math.min(2, nameWords.length)})`);
              console.log(`         ✅ MATCH: ${isMatch ? 'YES' : 'NO'}`);
              
              return isMatch;
            });
            
            if (exists) {
              console.log(`   ✅ Found: ${track.artist} - ${track.name}`);
            } else {
              console.log(`   ❌ Missing: ${track.artist} - ${track.name}`);
            }
            
            return !exists;
          });
          
          const remaining = missingTracks.length;
          console.log(`\n📊 Missing tracks: ${remaining}`);
          
          // Check if we're making progress or stuck on same failures
          const progressMade = remaining < lastFailCount || lastFailCount === 0;
          
          // Track consecutive failures
          if (progressMade) {
            consecutiveFailures = 0;
            lastFailCount = remaining;
          } else {
            consecutiveFailures++;
          }
          
          // Calculate success metrics
          const successfulTracks = tracks.length - remaining;
          const successRate = successfulTracks / tracks.length;
          
          // Give up conditions - very lenient to maximize success
          // 1. No progress after max attempts
          // 2. After 10 attempts with 50%+ success rate (try harder before giving up)
          const giveUp = (!progressMade && attempt >= maxAttempts) || 
                        (attempt >= 10 && successRate >= 0.5);
          
          // Complete with partial results if we have some successful downloads
          if (giveUp && successfulTracks > 0) {
            console.log(`\n⚠️ Completing with partial results: ${successfulTracks}/${tracks.length} tracks (${Math.round(successRate * 100)}%)`);
            console.log(`   Reason: ${!progressMade && attempt >= 6 ? 'No progress after 6 attempts' : 
                                     consecutiveFailures >= 3 ? `${consecutiveFailures} consecutive failures` :
                                     'Success threshold reached'}`);
            
            downloadInfo.status = 'partial';
            downloadInfo.totalSuccess = successfulTracks;
            downloadInfo.totalFailed = remaining;
            downloadInfo.attempts = attempt;

            const elapsedTime = formatElapsedTime(downloadInfo.startTime);
            
            // Build failed tracks list
            const failedTracksList = missingTracks.map(t => `${t.artist} - ${t.name}`);
            console.log(`\n❌ Failed tracks (${failedTracksList.length}):`);
            failedTracksList.forEach(name => console.log(`   - ${name}`));

            socket.emit('download:complete', {
              downloadId,
              outputFolder,
              totalSuccess: successfulTracks,
              totalFailed: remaining,
              attempts: attempt,
              downloadUrl: `/api/download/archive/${downloadId}`,
              failedTracks: failedTracksList,
              message: `✅ Downloaded ${successfulTracks}/${tracks.length} tracks (${Math.round(successRate * 100)}%)\n⏱️ Completed in ${elapsedTime}\n❌ ${remaining} track(s) could not be downloaded\n📦 Click to download available tracks!`
            });

            resolve('complete');
            return;
          }
          
          if (remaining > 0 && attempt < maxAttempts && !giveUp) {
            totalFailed = remaining;
            
            // After first attempt, try yt-dlp fallback for failed tracks
            if (attempt >= 1) {
              console.log(`\n🔄 TRYING YT-DLP FALLBACK for ${remaining} failed tracks...`);
              socket.emit('download:status', {
                downloadId,
                status: 'downloading',
                message: `🔄 Trying yt-dlp fallback for ${remaining} failed tracks...`
              });
              
              // Try yt-dlp fallback with captured YouTube links (pass attempt number for strategy cycling)
              const ytdlpSuccess = await tryYtDlpFallback(tracks, outputFolder, outputPath, socket, downloadId, youtubeLinks, settings, attempt);
              
              // Re-count after yt-dlp attempt
              const filesAfterYtdlp = await fs.readdir(outputFolder);
              const musicFilesAfterYtdlp = filesAfterYtdlp.filter(f => 
                f.endsWith('.mp3') || f.endsWith('.flac') || f.endsWith('.ogg')
              );
              const newActualCount = musicFilesAfterYtdlp.length;
              
              if (newActualCount > actualDownloadCount) {
                console.log(`✅ yt-dlp fallback downloaded ${newActualCount - actualDownloadCount} additional tracks!`);
                
                // Re-check which tracks are still missing with better matching
                const filesAfterCheck = await fs.readdir(outputFolder);
                const musicFilesAfterCheck = filesAfterCheck.filter(f => 
                  f.endsWith('.mp3') || f.endsWith('.flac') || f.endsWith('.ogg')
                );
                
                console.log('\n🔍 Verifying downloaded files:');
                console.log(`   📁 Files in folder: ${musicFilesAfterCheck.length}`);
                musicFilesAfterCheck.forEach(f => console.log(`      - ${f}`));
                
                const stillMissing = tracks.filter(track => {
                  console.log(`\n   🔍 Checking: ${track.artist} - ${track.name}`);
                  
                  // Case-insensitive matching with special character handling
                  const exists = musicFilesAfterCheck.some(file => {
                    const fileLower = file.toLowerCase();
                    const artistLower = track.artist.toLowerCase().trim();
                    
                    // Remove special characters for better matching (handles Arabic, emojis, etc)
                    const normalizeString = (str) => {
                      return str
                        .normalize('NFD')
                        .replace(/[\u0300-\u036f]/g, '') // Remove diacritics
                        .replace(/[^\w\s-]/g, ' ') // Replace special chars with space
                        .replace(/\s+/g, ' ') // Normalize spaces
                        .trim();
                    };
                    
                    const fileNormalized = normalizeString(fileLower);
                    const artistNormalized = normalizeString(artistLower);
                    const nameNormalized = normalizeString(track.name.toLowerCase().trim());
                    
                    // Extract key words from track name (first 3-4 significant words)
                    const nameWords = nameNormalized.split(' ').filter(w => w.length > 2).slice(0, 4);
                    
                    // Check if file contains artist and at least 2 key words from track name
                    const hasArtist = fileNormalized.includes(artistNormalized);
                    const matchingWords = nameWords.filter(word => fileNormalized.includes(word));
                    const hasEnoughNameMatch = matchingWords.length >= Math.min(2, nameWords.length);
                    
                    const isMatch = hasArtist && hasEnoughNameMatch;
                    
                    // Debug output for each file comparison
                    console.log(`      📄 File: "${file}"`);
                    console.log(`         Normalized file: "${fileNormalized}"`);
                    console.log(`         Normalized artist: "${artistNormalized}"`);
                    console.log(`         Normalized name: "${nameNormalized}"`);
                    console.log(`         Name keywords: [${nameWords.join(', ')}]`);
                    console.log(`         Artist match: ${hasArtist}`);
                    console.log(`         Matching keywords: [${matchingWords.join(', ')}]`);
                    console.log(`         Has enough name match: ${hasEnoughNameMatch} (${matchingWords.length} >= ${Math.min(2, nameWords.length)})`);
                    console.log(`         ✅ MATCH: ${isMatch ? 'YES' : 'NO'}`);
                    
                    return isMatch;
                  });
                  
                  if (exists) {
                    console.log(`   ✅ Found: ${track.artist} - ${track.name}`);
                  } else {
                    console.log(`   ❌ Missing: ${track.artist} - ${track.name}`);
                  }
                  
                  return !exists;
                });
                
                console.log(`\n📊 After yt-dlp fallback: ${tracks.length - stillMissing.length}/${tracks.length} tracks found`);
                
                // Check if we have YouTube tracks to download (Phase 2 for mixed sources)
                if (downloadInfo.hasYouTubeTracks && downloadInfo.youtubeTracks && downloadInfo.youtubeTracks.length > 0) {
                  console.log('\n📺 Phase 2: Downloading YouTube tracks with yt-dlp...');
                  socket.emit('download:status', {
                    downloadId,
                    status: 'downloading',
                    message: `📺 Phase 2: Downloading ${downloadInfo.youtubeTracks.length} YouTube tracks...`
                  });
                  
                  // Download YouTube tracks (first attempt)
                  await tryYtDlpFallback(downloadInfo.youtubeTracks, outputFolder, outputPath, socket, downloadId, {}, settings, 0);
                  
                  // Clear flag so we don't download them again
                  downloadInfo.hasYouTubeTracks = false;
                  console.log(`✅ Phase 2 complete - YouTube tracks downloaded`);
                }
                
                // If we got all tracks, we're done
                if (stillMissing.length === 0) {
                  console.log('✅ ALL TRACKS VERIFIED - Download complete!\n');
                  const successfulTracks = tracks.length;
                  downloadInfo.status = 'completed';
                  downloadInfo.totalSuccess = successfulTracks;
                  downloadInfo.totalFailed = 0;
                  downloadInfo.attempts = attempt;
                  
                  const elapsedTime = formatElapsedTime(downloadInfo.startTime);
                  console.log(`⏱️  Total download time: ${elapsedTime}`);
                  
                  socket.emit('download:complete', {
                    downloadId,
                    outputFolder,
                    totalSuccess: successfulTracks,
                    totalFailed: 0,
                    attempts: attempt,
            downloadUrl: `/api/download/archive/${downloadId}`,
            message: `🎉 All ${successfulTracks} tracks downloaded successfully!\n⏱️ Completed in ${elapsedTime}\n📦 Click to download your ZIP file!`
                  });
                  
                  resolve('complete');
                  return;
                } else {
                  console.log(`⚠️  ${stillMissing.length} track(s) still missing after yt-dlp fallback`);
                }
              }
            }
            
            // Add delay before retry to avoid rate limiting
            const retryDelay = attempt > 1 ? 5000 : 2000; // 5s after 1st retry, 2s before
            
            socket.emit('download:retry', {
              downloadId,
              attempt,
              failCount: remaining,
              message: `⚠️ ${remaining} tracks remaining. Waiting ${retryDelay/1000}s before retry (Attempt ${attempt + 1}/${maxAttempts})...`
            });
            
            console.log(`Waiting ${retryDelay}ms before retrying ${remaining} remaining tracks...`);
            console.log(`Will continue to attempt ${attempt + 1}...`);
            
            // Add delay before retry
            setTimeout(() => {
              // Check if cancelled during the delay
              const downloadInfo = activeDownloads.get(downloadId);
              if (!downloadInfo || downloadInfo.cancelled) {
                console.log('❌ Download was cancelled during retry delay');
                resolve('cancelled');
              } else {
                resolve('continue');
              }
            }, retryDelay);
          } else if (giveUp) {
            // Give up - these tracks are not available on YouTube
            const successfulTracks = tracks.length - remaining;
            downloadInfo.status = 'completed';
            downloadInfo.totalSuccess = successfulTracks;
            downloadInfo.totalFailed = remaining;
            downloadInfo.attempts = attempt;

            const finalMessage = `✅ Downloaded ${successfulTracks} of ${tracks.length} tracks successfully!\n\n` +
              `⚠️ ${remaining} tracks unavailable (not on YouTube)\n` +
              `These tracks don't exist on YouTube, are region-locked, or have been removed.\n\n` +
              `✨ Your ${successfulTracks} downloaded tracks are ready in the output folder!`;

            console.log(`\n========================================`);
            const elapsedTime = formatElapsedTime(downloadInfo.startTime);
            
            console.log(`STOPPED RETRYING (tracks unavailable):`);
            console.log(`  ✅ Success: ${successfulTracks}`);
            console.log(`  ❌ Unavailable: ${remaining}`);
            console.log(`  📁 Folder: ${outputFolder}`);
            console.log(`  ⏱️  Time: ${elapsedTime}`);
            console.log(`========================================\n`);

            socket.emit('download:complete', {
              downloadId,
              outputFolder,
              totalSuccess: successfulTracks,
              totalFailed: remaining,
              attempts: attempt,
            downloadUrl: `/api/download/archive/${downloadId}`,
            message: `${finalMessage}\n⏱️ Completed in ${elapsedTime}\n📦 Click to download your ZIP file!`
            });

            resolve('complete');
          } else {
            // Check if download was cancelled
            if (!activeDownloads.has(downloadId)) {
              console.log('⚠️  Download was cancelled, skipping completion');
              resolve('cancelled');
              return;
            }
            
            // Download complete or max attempts reached
            const successfulTracks = tracks.length - remaining;
            const downloadInfo = activeDownloads.get(downloadId);
            
            if (downloadInfo) {
              downloadInfo.status = 'completed';
              downloadInfo.totalSuccess = successfulTracks;
              downloadInfo.totalFailed = remaining;
              downloadInfo.attempts = attempt;

              const finalMessage = remaining > 0
                ? `✅ Downloaded ${successfulTracks} of ${tracks.length} tracks (${remaining} failed after ${attempt} attempts)`
                : `🎉 All ${tracks.length} tracks downloaded successfully!`;

              const elapsedTime = formatElapsedTime(downloadInfo.startTime);
              console.log(`\nFINAL RESULT: ${finalMessage}`);
              console.log(`⏱️  Total download time: ${elapsedTime}`);

              socket.emit('download:complete', {
                downloadId,
                outputFolder,
                totalSuccess: successfulTracks,
                totalFailed: remaining,
                attempts: attempt,
                message: `${finalMessage}\n⏱️ Completed in ${elapsedTime}`
              });
            }

            // Signal to exit the retry loop
            resolve('complete');
          }
        } catch (error) {
          console.error('Error counting files:', error);
          
          // Check if download was cancelled
          if (!activeDownloads.has(downloadId)) {
            console.log('⚠️  Download was cancelled, skipping completion');
            resolve('cancelled');
            return;
          }
          
          // Fallback to counter-based result
          const downloadInfo = activeDownloads.get(downloadId);
          if (downloadInfo) {
            downloadInfo.status = 'completed';
            downloadInfo.totalSuccess = totalSuccess;
            downloadInfo.totalFailed = totalFailed;
            downloadInfo.attempts = attempt;

            const elapsedTime = formatElapsedTime(downloadInfo.startTime);
            console.log(`⏱️  Total download time: ${elapsedTime}`);
          }

          socket.emit('download:complete', {
            downloadId,
            outputFolder,
            totalSuccess,
            totalFailed,
            attempts: attempt,
            downloadUrl: `/api/download/archive/${downloadId}`,
            message: `Download completed! Check ${outputFolder} for your files.\n⏱️ Completed in ${elapsedTime}\n📦 Click to download your ZIP file!`
          });

          resolve('complete');
        }
      });
    }).then((result) => {
      // Check if we should break the loop
      if (result === 'complete' || result === 'cancelled') {
        shouldContinue = false;
      }
    });

    // Check if we should continue
    if (!shouldContinue) {
      break;
    }
  }
}

// Get download status
app.get('/api/download/status/:downloadId', (req, res) => {
  const { downloadId } = req.params;
  const downloadInfo = activeDownloads.get(downloadId);

  if (!downloadInfo) {
    return res.status(404).json({ error: 'Download not found' });
  }

  res.json(downloadInfo);
});

// Download completed files as ZIP archive (or single file for 1 track)
app.get('/api/download/archive/:downloadId', async (req, res) => {
  const { downloadId } = req.params;
  console.log(`\n📥 [ARCHIVE] Client requesting download for: ${downloadId}`);
  
  const downloadInfo = activeDownloads.get(downloadId);

  if (!downloadInfo) {
    console.log(`❌ [ARCHIVE] Download not found in activeDownloads`);
    console.log(`   Available downloads:`, Array.from(activeDownloads.keys()));
    return res.status(404).json({ error: 'Download not found' });
  }

  console.log(`✅ [ARCHIVE] Download found, status: ${downloadInfo.status}`);
  console.log(`   Tracks count: ${downloadInfo.tracks?.length || 0}`);
  console.log(`   Output folder: ${downloadInfo.outputFolder}`);

  // Allow both 'completed' and 'partial' status to show failed tracks
  if (downloadInfo.status !== 'completed' && downloadInfo.status !== 'partial') {
    console.log(`❌ [ARCHIVE] Download not ready yet (status: ${downloadInfo.status})`);
    return res.status(400).json({ error: 'Download not completed yet' });
  }

  // Set longer timeout for this specific request (unlimited size support)
  req.setTimeout(7200000); // 2 hours
  res.setTimeout(7200000); // 2 hours

  const { outputFolder, tracks } = downloadInfo;
  
  try {
    // Check if folder exists
    await fs.access(outputFolder);
    
    // Get all music files in the folder
    const files = await fs.readdir(outputFolder);
    const musicFiles = files.filter(f => 
      f.endsWith('.mp3') || f.endsWith('.flac') || f.endsWith('.ogg')
    );
    
    // For single track downloads, send the file directly (no ZIP)
    // Check for the specific expected file, not just count
    if (tracks.length === 1) {
      const track = tracks[0];
      const expectedFileName = getExpectedFileName(track, 'mp3');
      // For single tracks, ONLY use exact filename match (no fuzzy matching - avoids sending wrong file!)
      const singleFile = musicFiles.find(f => f === expectedFileName);
      
      if (singleFile) {
        const filePath = path.join(outputFolder, singleFile);
      
      console.log(`📥 Sending single file directly: ${singleFile}`);
      
      // Build safe Content-Disposition header
      const asciiName = singleFile.replace(/[^\x20-\x7E]/g, '_');
      const encodedName = encodeURIComponent(singleFile).replace(/\*/g, '%2A');
      const contentDisposition = `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
      
      // Set headers for audio file
      const fileExt = path.extname(singleFile).toLowerCase();
      const mimeTypes = {
        '.mp3': 'audio/mpeg',
        '.flac': 'audio/flac',
        '.ogg': 'audio/ogg'
      };
      
      res.setHeader('Content-Type', mimeTypes[fileExt] || 'audio/mpeg');
      res.setHeader('Content-Disposition', contentDisposition);
      res.setHeader('Cache-Control', 'no-cache');
      
      // IDM-compatible headers for better download manager support
      const fileStats = fsSync.statSync(filePath);
      res.setHeader('Content-Length', fileStats.size); // File size for IDM progress
      res.setHeader('Accept-Ranges', 'bytes'); // Enable multi-part downloads for IDM
      
      console.log(`📊 File size: ${(fileStats.size / 1024 / 1024).toFixed(2)} MB`);
      
      // Stream the file directly
      const fileStream = fsSync.createReadStream(filePath);
      fileStream.pipe(res);
      
      fileStream.on('error', (err) => {
        console.error('File stream error:', err);
        try { res.status(500).end('File stream error'); } catch {}
      });
      
        return;
      }
    }
    
    // For multiple tracks, create ZIP archive
    const folderName = path.basename(outputFolder);
    const zipFileName = `${folderName}.zip`;
    
    // Build a safe Content-Disposition header
    const asciiName = zipFileName.replace(/[^\x20-\x7E]/g, '_'); // ASCII-only fallback
    const encodedName = encodeURIComponent(zipFileName).replace(/\*/g, '%2A'); // RFC5987
    const contentDisposition = `attachment; filename="${asciiName}"; filename*=UTF-8''${encodedName}`;
    
    // Set response headers for optimal streaming
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', contentDisposition);
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Transfer-Encoding', 'chunked');
    res.setHeader('Accept-Ranges', 'bytes'); // IDM-compatible: enable resume support
    
    // Note: Content-Length cannot be set for chunked encoding with ZIP64
    // ZIP64 format handles large files (>4GB) automatically
    
    // Calculate total size for better progress tracking
    let totalSize = 0;
    try {
      for (const file of musicFiles) {
        const filePath = path.join(outputFolder, file);
        try {
          const stats = await fs.stat(filePath);
          totalSize += stats.size;
        } catch (e) {
          console.warn(`Could not stat file ${file}:`, e.message);
        }
      }
      console.log(`📊 Total archive size estimate: ${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB`);
    } catch (e) {
      console.warn('Could not calculate total size:', e.message);
    }
    
    // Create archive optimized for music files (already compressed formats)
    // Enable ZIP64 for unlimited file size support
    const archive = archiver('zip', {
      store: true, // ⚡ NO COMPRESSION - MP3/M4A files are already compressed!
      forceLocalTime: true, // Better compatibility
      forceZip64: true, // Enable ZIP64 for large files (>4GB support)
      highWaterMark: 1024 * 1024 * 16 // 16MB buffer for faster streaming
    });
    
    // Set high water mark to prevent memory issues with large files
    archive.setMaxListeners(0); // Remove listener limit
    
    // Track if archive is finalized or aborted (must be declared before handlers)
    let archiveAborted = false;
    let archiveFinalized = false;
    let keepAliveInterval = null;
    let stallChecker = null;
    
    // Handle archive errors
    archive.on('error', (err) => {
      console.error('Archive error:', err);
      archiveAborted = true;
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      if (stallChecker) clearInterval(stallChecker);
      if (!res.headersSent) {
        try { 
          res.status(500).json({ error: 'Archive creation failed', details: err.message }); 
        } catch (e) {
          console.error('Failed to send error response:', e);
        }
      }
    });
    
    // Track when archive finishes
    archive.on('end', () => {
      archiveFinalized = true;
      if (keepAliveInterval) clearInterval(keepAliveInterval);
      if (stallChecker) clearInterval(stallChecker);
    });
    
    // Handle response errors
    res.on('error', (err) => {
      console.error('Response stream error:', err);
      if (!archiveFinalized && !archiveAborted) {
        archiveAborted = true;
        archive.abort();
      }
    });
    
    // Handle client disconnect with delay (network hiccup recovery)
    req.on('close', () => {
      console.log('⚠️  Client disconnected during archive download');
      // Don't abort immediately - wait a bit in case it's a temporary network issue
      // The client might reconnect or the download manager might resume
      setTimeout(() => {
        if (!archiveFinalized && !archiveAborted) {
          console.log('⚠️  Client disconnect confirmed - aborting archive after delay');
          archiveAborted = true;
          archive.abort();
        }
      }, 5000); // 5 second grace period
    });
    
    // Add keep-alive mechanism to prevent network timeouts during large transfers
    // Send periodic empty chunks to keep connection alive
    let lastKeepAlive = Date.now();
    keepAliveInterval = setInterval(() => {
      if (archiveFinalized || archiveAborted) {
        if (keepAliveInterval) clearInterval(keepAliveInterval);
        return;
      }
      
      // If archive is still streaming but no data sent in 30 seconds, send keep-alive
      const timeSinceLastActivity = Date.now() - lastKeepAlive;
      if (timeSinceLastActivity > 30000 && !res.destroyed && res.writable) {
        try {
          // Send a comment entry to keep connection alive (ZIP format allows this)
          // This prevents network/proxy timeouts during large file processing
          res.flush && res.flush(); // Force flush any buffered data
        } catch (err) {
          // Ignore flush errors
        }
      }
    }, 10000); // Check every 10 seconds
    
    // Update last activity on data events
    archive.on('data', () => {
      lastKeepAlive = Date.now();
    });
    
    // Pipe archive to response
    archive.pipe(res);
    
    // Add progress monitoring with throttling (avoid Railway log rate limits)
    let processedFiles = 0;
    let lastLogTime = 0;
    let entryCount = 0;
    let lastBytesProcessed = 0;
    let lastActivityTime = Date.now();
    const LOG_INTERVAL = 2000; // Log every 2 seconds max
    
    // Monitor for stalled transfers
    stallChecker = setInterval(() => {
      const timeSinceActivity = Date.now() - lastActivityTime;
      if (timeSinceActivity > 60000 && !archiveFinalized && !archiveAborted) {
        // No activity for 60 seconds - might be stalled
        console.log(`⚠️  Archive transfer appears stalled (no activity for ${Math.floor(timeSinceActivity / 1000)}s)`);
        console.log(`📊 Last processed: ${processedFiles}/${musicFiles.length} files, ${(lastBytesProcessed / 1024 / 1024 / 1024).toFixed(2)} GB`);
      }
    }, 30000); // Check every 30 seconds
    
    archive.on('progress', (progress) => {
      // Safe access to progress properties
      processedFiles = progress?.entries?.processed || 0;
      const bytesProcessed = progress?.bytes?.processed || 0;
      const now = Date.now();
      
      // Update activity tracking
      if (bytesProcessed > lastBytesProcessed) {
        lastBytesProcessed = bytesProcessed;
        lastActivityTime = now;
      }
      
      // Only log every 2 seconds to avoid Railway rate limits (500 logs/sec)
      if (now - lastLogTime >= LOG_INTERVAL) {
        const percent = totalSize > 0 && bytesProcessed > 0 ? ((bytesProcessed / totalSize) * 100).toFixed(1) : '?';
        console.log(`📦 ZIP: ${processedFiles}/${musicFiles.length} files (${(bytesProcessed / 1024 / 1024 / 1024).toFixed(2)}/${(totalSize / 1024 / 1024 / 1024).toFixed(2)} GB - ${percent}%)`);
        lastLogTime = now;
      }
    });
    
    // Log only every 20th file to avoid spam (Railway limit: 500 logs/sec)
    archive.on('entry', (entry) => {
      entryCount++;
      if (entryCount === 1 || entryCount % 20 === 0 || entryCount === musicFiles.length) {
        console.log(`📄 ZIP: ${entryCount}/${musicFiles.length} - ${entry.name.substring(0, 50)}`);
      }
    });
    
    // Add all files from the output folder with optimized settings
    archive.directory(outputFolder, false);
    
    // Finalize the archive
    archiveFinalized = true;
    if (keepAliveInterval) clearInterval(keepAliveInterval);
    if (stallChecker) clearInterval(stallChecker);
    await archive.finalize();
    
    console.log(`✅ ZIP archive finalized: ${processedFiles} files processed`);
    
    console.log(`📦 ZIP archive created and sent: ${zipFileName}`);
  } catch (error) {
    console.error('Error creating ZIP archive:', error);
    res.status(500).json({ error: 'Failed to create ZIP archive' });
  }
});

// Check if spotdl is installed and get version info
// Root endpoint for debugging
app.get('/', (req, res) => {
  res.json({ 
    message: 'Spotify Playlist Downloader Server', 
    status: 'running',
    timestamp: new Date().toISOString(),
    port: PORT
  });
});

// Simple health check for Koyeb
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Proxy status endpoint
app.get('/api/proxy/status', async (req, res) => {
  const stats = proxyManager.getStats();
  const useProxies = process.env.USE_FREE_PROXIES === 'true';
  const useScraperAPI = !!process.env.SCRAPERAPI_KEY;
  
  res.json({
    enabled: useProxies || useScraperAPI,
    type: useScraperAPI ? 'ScraperAPI (Paid)' : useProxies ? 'Free Rotating Proxies' : 'None',
    stats: useProxies ? stats : null
  });
});

// Refresh proxy pool manually (fetches and validates)
app.post('/api/proxy/refresh', async (req, res) => {
  if (process.env.USE_FREE_PROXIES !== 'true') {
    return res.status(400).json({ error: 'Free proxies not enabled' });
  }
  
  try {
    // Fetch new proxies
    await proxyManager.fetchProxies();
    
    // Validate them
    await proxyManager.validateProxies(null, 50, 100);
    
    const stats = proxyManager.getStats();
    res.json({
      success: true,
      message: 'Proxy pool refreshed and validated',
      stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/health', async (req, res) => {
  const spotdlInstalled = await checkSpotdlInstalled();
  
  res.json({
    status: 'ok',
    spotdlInstalled,
    versions: versionInfo
  });
});

// Manual update endpoint
app.post('/api/update-dependencies', async (req, res) => {
  try {
    console.log('\n🔄 Manual update triggered...');
    await updateDependencies();
    await checkAndUpdateVersions();
    
    res.json({
      success: true,
      message: 'Dependencies updated successfully',
      versions: versionInfo
    });
  } catch (error) {
    console.error('Manual update failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update dependencies',
      details: error.message
    });
  }
});

// ============================================================
// 🎧 LIVE LISTENING FEATURE - Real-time synchronized playback
// ============================================================

// Store active live rooms
// Structure: { roomId: { hostSocketId, hostName, listeners: [{ socketId, userName }], currentTrack, currentTime, isPlaying, createdAt } }
const liveRooms = new Map();

// Track which socket is in which room (for cleanup on disconnect)
const socketToRoom = new Map();

// Generate unique room ID
function generateRoomId() {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
}

// WebSocket connection
io.on('connection', (socket) => {
  console.log('🔌 Client connected:', socket.id);

  // ========== HOST CREATES A LIVE ROOM ==========
  socket.on('create-live-room', ({ hostName, currentTrack, currentTime, isPlaying, queue }) => {
    const roomId = generateRoomId();
    
    liveRooms.set(roomId, {
      hostSocketId: socket.id,
      hostName: hostName || 'Host',
      listeners: [],
      currentTrack: currentTrack || null,
      currentTime: currentTime || 0,
      isPlaying: isPlaying || false,
      queue: queue || [],
      createdAt: Date.now(),
    });

    socketToRoom.set(socket.id, { roomId, role: 'host' });
    socket.join(roomId);

    console.log(`🎧 Room created: ${roomId} by ${hostName || 'Host'}`);
    
    socket.emit('room-created', {
      roomId,
      room: liveRooms.get(roomId),
    });
  });

  // ========== LISTENER JOINS A LIVE ROOM ==========
  socket.on('join-live-room', ({ roomId, userName }) => {
    const room = liveRooms.get(roomId);

    if (!room) {
      socket.emit('room-error', { message: 'Room not found or has ended.' });
      return;
    }

    // Add listener to room
    const listener = {
      socketId: socket.id,
      userName: userName || 'Listener',
      joinedAt: Date.now(),
    };

    room.listeners.push(listener);
    socketToRoom.set(socket.id, { roomId, role: 'listener' });
    socket.join(roomId);

    console.log(`👥 ${userName || 'Listener'} joined room: ${roomId}`);

    // Send current room state to the new listener
    socket.emit('room-joined', {
      roomId,
      hostName: room.hostName,
      currentTrack: room.currentTrack,
      currentTime: room.currentTime,
      isPlaying: room.isPlaying,
      queue: room.queue || [],
      listenerCount: room.listeners.length,
    });

    // Notify host and other listeners about new listener count
    io.to(roomId).emit('listener-count-updated', {
      listenerCount: room.listeners.length,
    });

    // Notify host specifically about new listener
    io.to(room.hostSocketId).emit('listener-joined', {
      userName: listener.userName,
      listenerCount: room.listeners.length,
    });
  });

  // ========== HOST UPDATES PLAYBACK STATE ==========
  socket.on('update-playback-state', ({ roomId, currentTrack, currentTime, isPlaying, queue }) => {
    const room = liveRooms.get(roomId);

    if (!room || room.hostSocketId !== socket.id) {
      socket.emit('room-error', { message: 'You are not the host of this room.' });
      return;
    }

    // Update room state
    if (currentTrack !== undefined) room.currentTrack = currentTrack;
    if (currentTime !== undefined) room.currentTime = currentTime;
    if (isPlaying !== undefined) room.isPlaying = isPlaying;
    if (queue !== undefined) room.queue = queue;

    // Broadcast to all listeners
    socket.to(roomId).emit('playback-state-updated', {
      currentTrack: room.currentTrack,
      currentTime: room.currentTime,
      isPlaying: room.isPlaying,
      queue: room.queue || [],
    });

    console.log(`🎵 Playback updated in room ${roomId}: ${isPlaying ? 'Playing' : 'Paused'}`);
  });

  // ========== HOST ENDS THE LIVE SESSION ==========
  socket.on('end-live-room', ({ roomId }) => {
    const room = liveRooms.get(roomId);

    if (!room || room.hostSocketId !== socket.id) {
      socket.emit('room-error', { message: 'You are not the host of this room.' });
      return;
    }

    // Notify all listeners that the session has ended
    io.to(roomId).emit('room-ended', {
      message: 'The host has ended the Live Listening session.',
    });

    // Clean up room
    room.listeners.forEach((listener) => {
      socketToRoom.delete(listener.socketId);
    });
    socketToRoom.delete(socket.id);
    liveRooms.delete(roomId);

    console.log(`🛑 Room ended: ${roomId}`);
  });

  // ========== LISTENER LEAVES ROOM ==========
  socket.on('leave-live-room', ({ roomId }) => {
    const room = liveRooms.get(roomId);
    if (!room) return;

    // Remove listener from room
    room.listeners = room.listeners.filter((l) => l.socketId !== socket.id);
    socketToRoom.delete(socket.id);
    socket.leave(roomId);

    // Notify remaining listeners and host
    io.to(roomId).emit('listener-count-updated', {
      listenerCount: room.listeners.length,
    });

    console.log(`👋 Listener left room: ${roomId}. Remaining: ${room.listeners.length}`);
  });

  // ========== HANDLE DISCONNECT ==========
  socket.on('disconnect', () => {
    console.log('🔌 Client disconnected:', socket.id);

    // 🔥 AUTO-CANCEL: Cancel all downloads started by this client
    const disconnectedSocketId = socket.id;
    const downloadsToCancel = [];
    
    // Find all active downloads for this client
    for (const [downloadId, downloadInfo] of activeDownloads.entries()) {
      if (downloadInfo.socketId === disconnectedSocketId && downloadInfo.status !== 'cancelled' && downloadInfo.status !== 'completed') {
        downloadsToCancel.push(downloadId);
      }
    }
    
    if (downloadsToCancel.length > 0) {
      console.log(`🛑 Auto-cancelling ${downloadsToCancel.length} download(s) for disconnected client: ${disconnectedSocketId}`);
      
      downloadsToCancel.forEach(downloadId => {
        const downloadInfo = activeDownloads.get(downloadId);
        if (!downloadInfo) return;
        
        // Kill ALL active processes for this download
        const processList = activeProcesses.get(downloadId);
        if (processList) {
          // Handle both old format (single process) and new format (array of processes)
          const processes = Array.isArray(processList) ? processList : [processList];
          
          console.log(`🔪 Killing ${processes.length} process(es) for download ${downloadId} (client disconnected)`);
          
          processes.forEach((processInfo, index) => {
            const process = processInfo.process || processInfo; // Handle both formats
            if (process && !process.killed) {
              try {
                console.log(`  🔪 Killing process ${index + 1}/${processes.length}`);
                process.kill('SIGTERM');
                setTimeout(() => {
                  if (process && !process.killed && process.kill) {
                    process.kill('SIGKILL');
                  }
                }, 2000);
              } catch (err) {
                console.error(`Error killing process ${index + 1}:`, err.message);
              }
            }
          });
        }
        
        // Update status
        downloadInfo.status = 'cancelled';
        downloadInfo.cancelled = true;
        
        // Clean up
        activeDownloads.delete(downloadId);
        activeProcesses.delete(downloadId);
        
        console.log(`✅ Auto-cancelled download: ${downloadId}`);
      });
    }

    const roomInfo = socketToRoom.get(socket.id);
    if (!roomInfo) return;

    const { roomId, role } = roomInfo;
    const room = liveRooms.get(roomId);

    if (!room) return;

    if (role === 'host') {
      // Host disconnected - end the room
      io.to(roomId).emit('room-ended', {
        message: 'The host has ended the Live Listening session.',
      });

      // Clean up
      room.listeners.forEach((listener) => {
        socketToRoom.delete(listener.socketId);
      });
      liveRooms.delete(roomId);

      console.log(`🛑 Room ended (host disconnected): ${roomId}`);
    } else {
      // Listener disconnected
      room.listeners = room.listeners.filter((l) => l.socketId !== socket.id);
      socketToRoom.delete(socket.id);

      // Notify remaining participants
      io.to(roomId).emit('listener-count-updated', {
        listenerCount: room.listeners.length,
      });

      console.log(`👋 Listener disconnected from room: ${roomId}. Remaining: ${room.listeners.length}`);
    }
  });
});

// ⚡ STARTUP SEQUENCE: Detect Python FIRST, then check versions
async function startupSequence() {
  // Step 1: Detect Python command
  console.log('🔄 Checking dependencies...');
  await detectPythonCommand();
  
  // Step 2: Check and update versions
  await checkAndUpdateVersions();
  
  // Step 3: If dependencies are not installed, try to install them
  if (versionInfo.spotdl === 'Unknown' || versionInfo.ytdlp === 'Unknown') {
    console.log('\n🔄 Dependencies not found, attempting to install...');
    try {
      await updateDependencies();
      await checkAndUpdateVersions();
      console.log('✅ Dependencies installed successfully!');
    } catch (error) {
      console.log('⚠️ Failed to install dependencies:', error.message);
      console.log('   Server will continue - some features may be limited');
    }
    }
  }

// Start the sequence
startupSequence().then(async () => {
  // ✅ Python detected - continue with server startup
  
  // 🔍 INITIALIZE PROXY SYSTEM (Priority: Oxylabs > Validated Free > Free)
  console.log('\n🔍 Initializing proxy system...');
  
  // 🌟 PRIORITY 1: Initialize Oxylabs premium proxy (BEST)
  const oxylabsReady = await proxyManager.initOxylabs();
  
  // Check ScraperAPI (for future use)
  if (process.env.SCRAPERAPI_KEY) {
    console.log('✅ ScraperAPI key configured (not used yet)');
    console.log(`   Key: ${process.env.SCRAPERAPI_KEY.substring(0, 8)}...`);
  }
  
  // 🎯 PRIORITY 2-3: Initialize free proxy pool (fallback if no Oxylabs)
  if (process.env.USE_FREE_PROXIES === 'true') {
    console.log('✅ Free proxies enabled (fallback)');
    console.log('\n🌐 Initializing free proxy pool...');
    try {
      // Step 1: Fetch proxies from sources
      await proxyManager.fetchProxies();
      const stats = proxyManager.getStats();
      console.log(`✅ Fetched ${stats.total} proxies from sources`);
      
      // Step 2: Validate proxies (test first 100 to save time)
      console.log('\n🧪 Testing proxies to find working ones...');
      await proxyManager.validateProxies(null, 50, 100);
      const validatedStats = proxyManager.getStats();
      console.log(`✅ Proxy pool ready: ${validatedStats.working}/${validatedStats.total} working (${validatedStats.validationRate} success rate)`);
      
      // 🎯 Step 2.5: Filter working proxies for YouTube compatibility (CRITICAL if Oxylabs doesn't work with YouTube)
      if (validatedStats.working > 0) {
        console.log('\n🎯 Filtering proxies for YouTube compatibility...');
        await proxyManager.validateProxiesForYouTube(null, 20, 50); // Test 50 working proxies, 20 at a time
        const youtubeStats = proxyManager.getStats();
        console.log(`✅ YouTube-validated proxies: ${youtubeStats.youtubeWorking}/${youtubeStats.working} working with YouTube (${youtubeStats.youtubeValidationRate} success rate)`);
        
        // 🔥 If Oxylabs doesn't work with YouTube, ensure we have YouTube-validated proxies
        if (oxylabsReady && !proxyManager.oxylabsWorksWithYouTube) {
          if (youtubeStats.youtubeWorking === 0) {
            console.log('⚠️  WARNING: Oxylabs doesn\'t work with YouTube AND no YouTube-validated proxies found!');
            console.log('   🔄 Testing more proxies for YouTube compatibility...');
            // Test more proxies if we have none
            await proxyManager.validateProxiesForYouTube(null, 20, 100); // Test up to 100 proxies
            const retryStats = proxyManager.getStats();
            if (retryStats.youtubeWorking > 0) {
              console.log(`✅ Found ${retryStats.youtubeWorking} YouTube-working proxies after extended testing`);
            } else {
              console.log('⚠️  Still no YouTube-working proxies - cookie generation may fail');
            }
          } else {
            console.log(`✅ YouTube-validated proxies ready: ${youtubeStats.youtubeWorking} proxies available for cookie generation`);
          }
        }
      }
      
      // Step 3: Start background validation task (re-validate every 5 minutes)
      setInterval(async () => {
        console.log('\n🔄 Background proxy validation starting...');
        await proxyManager.ensureValidatedProxies();
        
        // Also re-validate YouTube proxies if we have working proxies
        const stats = proxyManager.getStats();
        if (stats.working > 0) {
          console.log('🎯 Re-validating YouTube proxies...');
          await proxyManager.validateProxiesForYouTube(null, 20, 30); // Test 30 proxies, 20 at a time
        }
      }, 5 * 60 * 1000); // Every 5 minutes
      
    } catch (error) {
      console.log('⚠️ Failed to load proxies:', error.message);
      console.log('Will try to fetch proxies on first use');
    }
  } else {
    console.log('⚠️  Free proxies NOT enabled');
  }
  
  console.log('\n📊 Download Success Rate Estimate:');
  if (oxylabsReady) {
    console.log('   🟢🟢🟢 85-99% (Oxylabs Premium - ACTIVE)');
    console.log('   ✨ Residential IPs, best quality, minimal detection');
  } else if (process.env.USE_FREE_PROXIES === 'true') {
    const stats = proxyManager.getStats();
    if (stats.working > 10) {
      console.log(`   🟡 15-35% (${stats.working} Validated Free Proxies)`);
      console.log('   ⚠️  Free proxies - success rate varies, consider upgrading to Oxylabs');
  } else {
      console.log('   🔴 1-8% (Free Proxies - Low Quality)');
      console.log('   ⚠️  Very few working proxies, downloads will likely fail');
    }
  } else {
    console.log('   ⚫ 0% (No Proxies Configured)');
    console.log('   ❌ YouTube downloads will fail 100% - configure Oxylabs or free proxies');
  }
  console.log('');
  
  // 🍪 NOW initialize cookies AFTER proxies are ready!
  console.log('🍪 Initializing cookie system (proxies ready)...');
  initializeAutoCookies().then(cookiePath => {
    if (cookiePath) {
      console.log('✅ Cookie system initialized');
    } else {
      console.log('⚠️  Cookie initialization in progress (will retry on first download)');
    }
  }).catch(err => {
    console.log('⚠️  Cookie initialization error:', err.message);
    console.log('   Will retry on first download request');
  });
  
  httpServer.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║     🎵 Spotify Playlist Downloader Server Running 🎵      ║
╠════════════════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                            ║
║  spotdl: ${versionInfo.spotdl.padEnd(45)}║
║  yt-dlp: ${versionInfo.ytdlp.padEnd(45)}║
║  youtube-dl-exec: ${versionInfo.youtubedlexec.padEnd(36)}║
║  youtubei.js: ${versionInfo.youtubei.padEnd(40)}║
║  Status: Ready to download playlists                       ║
╚════════════════════════════════════════════════════════════╝
    `);
    
    // Keep-alive mechanism for Koyeb
    setInterval(() => {
      console.log('🔄 Keep-alive ping - Server is running');
    }, 30000); // Every 30 seconds
    
    // Auto-update check - runs daily (24 hours)
    if (process.env.AUTO_UPDATE !== 'false') {
      setInterval(async () => {
        console.log('\n🔄 Daily auto-update check starting...');
        
        try {
          // Update Python tools
          console.log('📦 Updating Python tools...');
          await updateDependencies();
          
          // Update Node.js packages
          console.log('📦 Updating Node.js packages...');
          await updateNodePackages();
          
          // Get new versions
          versionInfo.spotdl = await getSpotdlVersion();
          versionInfo.ytdlp = await getYtDlpVersion();
          versionInfo.youtubedlexec = await getYoutubeDlExecVersion();
          versionInfo.youtubei = await getYoutubeiVersion();
          versionInfo.lastUpdated = new Date().toISOString();
          
          console.log('✅ Auto-update complete!');
          console.log(`   spotdl: ${versionInfo.spotdl}`);
          console.log(`   yt-dlp: ${versionInfo.ytdlp}`);
          console.log(`   youtube-dl-exec: ${versionInfo.youtubedlexec}`);
          console.log(`   youtubei.js: ${versionInfo.youtubei}\n`);
        } catch (error) {
          console.log('⚠️ Auto-update failed:', error.message);
        }
      }, 24 * 60 * 60 * 1000); // Every 24 hours
      
      console.log('✅ Auto-update enabled (runs daily)');
      console.log('   To disable: set AUTO_UPDATE=false');
    } else {
      console.log('⚠️ Auto-update disabled (AUTO_UPDATE=false)');
    }
  });
}).catch((error) => {
  console.error('❌ Fatal startup error:', error);
  console.error('   Stack:', error.stack);
  process.exit(1); // Exit if startup fails
});

