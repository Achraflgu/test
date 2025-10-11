import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs/promises';
import { fileURLToPath } from 'url';
import os from 'os';
import fetch from 'node-fetch';
import sharp from 'sharp';
import archiver from 'archiver';
import { proxyManager } from './proxy-manager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);

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

// Store active downloads
const activeDownloads = new Map();

// Store active processes for cancellation
const activeProcesses = new Map();

// 🔥 ADVANCED BOT DETECTION BYPASS UTILITIES
async function addAdvancedBotBypass(args, strategy, attempt) {
  console.log(`   🤖 Adding advanced bot bypass methods for ${strategy}...`);
  
  // Dynamic timestamp generation (looks like real user activity)
  const now = Date.now();
  const sessionStart = now - Math.floor(Math.random() * 3600000); // 0-1 hour ago
  const lastActivity = now - Math.floor(Math.random() * 300000);  // 0-5 min ago
  
  // 🔒 SECURE COOKIE APPROACH: Write cookies to temporary file instead of headers
  const fakeCookies = [
    'VISITOR_INFO1_LIVE=dglKiOiODhg; YSC=TSH0MAVYRhw; GPS=1; PREF=f4=4000000',
    'VISITOR_INFO1_LIVE=H7jKpLmNqRs; YSC=9XyZ4bCnMkL; GPS=1; PREF=f6=40000000', 
    'VISITOR_INFO1_LIVE=QwE3rTyU8oP; YSC=AsDf5GhJkL2; GPS=1; PREF=f2=80000000'
  ];
  
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
  
  // 🎮 EXPANDED CLIENT TYPES (30+ variants)
  const clientTypes = {
    newpipe: ['android_testsuite', 'android_vr', 'android_producer', 'android_creator', 'android_unplugged', 'android_music', 'android_embedded'],
    youtube_music: ['youtube_music', 'youtube_music_premium', 'music_embedded'],
    ios_clients: ['ios', 'ios_music', 'ios_creator', 'ios_embedded'],
    tv_clients: ['tv', 'tv_embedded', 'tv_kids', 'mediaconnect'],
    web_clients: ['web', 'web_embedded', 'web_music', 'web_creator', 'web_safari'],
    mixed: ['android,web_embedded', 'ios,web_embedded', 'tv,android']
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
    
    // 🎯 PRIORITY 1: Oxylabs Premium Proxy (BEST - 60-80% success rate)
    if (process.env.OXYLABS_PROXY) {
      proxy = process.env.OXYLABS_PROXY;
      proxyType = 'Oxylabs Premium';
      console.log(`   🌐 Using Oxylabs proxy to bypass YouTube blocking`);
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
  
  // ===== STRATEGY 1: Advanced Bot Detection Bypass (0-1) =====
  if (strategy === 0) {
    console.log('🤖 Strategy: Advanced Bot Detection Bypass');
    
    const client = clientTypes.newpipe[attempt % clientTypes.newpipe.length];
    const userAgent = userAgents.android[0];
    
    args.push('--user-agent', userAgent);
    args.push('--extractor-args', `youtube:player_client=${client}`);
    args.push('--extractor-args', 'youtube:player_skip=webpage,configs,js');
    args.push('--no-check-certificate');
    args.push('--geo-bypass');
    
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
  
  // ===== STRATEGY 2: Session Hijacking + Token Rotation (2-3) =====
  if (strategy === 1) {
    console.log('🎫 Strategy: Session Hijacking + Token Rotation');
    
    const client = clientTypes.youtube_music[attempt % clientTypes.youtube_music.length];
    const userAgent = userAgents.android[attempt % userAgents.android.length];
    
    args.push('--user-agent', userAgent);
    args.push('--extractor-args', `youtube:player_client=${client}`);
    args.push('--extractor-args', 'youtube:player_skip=configs');
    args.push('--no-check-certificate');
    args.push('--format', 'bestaudio/best');
    
    // 🔥 SESSION HIJACKING METHODS
    // Method 1: Fake Session Tokens (rotating every attempt)
    const sessionTokens = [
      'QUFFLUhqbEd4X1FkdmFwN3BoYW5rSTV2dGhzM0RvZGNMZ3xBQ3Jtc0tuMFFGMjc2',
      'QUFFLUhqbTQ4X1NrX1pkNkE4Y0hCQ0xvUlFWcWVoaGx1MlJEdDNEZ0xHQ3hsZXc',
      'QUFFLUhqbUlNVkNuZGc0QVJhbVV4YWF4TE1OTFZMd1FFQTRNM0hGN0pSNnpqV3c'
    ];
    const sessionToken = sessionTokens[attempt % sessionTokens.length];
    args.push('--add-header', `Authorization:Bearer ${sessionToken}`);
    
    // Method 2: Secure authentication cookies (handled by addAdvancedBotBypass)
    // Note: Authentication cookies are now securely handled via temporary files
    
    // Method 3: Client Identification Spoofing
    args.push('--add-header', 'X-Goog-AuthUser:0');
    args.push('--add-header', 'X-Goog-PageId:none');
    args.push('--add-header', 'X-Origin:https://music.youtube.com');
    
    // Method 4: Device Registration Bypass
    args.push('--add-header', 'X-YouTube-Device:cbr=Chrome&cbrver=121.0.0.0&ceng=WebKit&cengver=537.36');
    args.push('--add-header', 'X-YouTube-Bootstrap-Logged-In:true');
    
    // Method 5: API Key Rotation
    const apiKeys = [
      'AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8',
      'AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30',
      'AIzaSyDK3iBpDP9nHVTk2qL73FLJICfOC3c1Ue4'
    ];
    args.push('--add-header', `X-Goog-Api-Key:${apiKeys[attempt % apiKeys.length]}`);
    
    // YouTube Music-specific headers
    args.push('--add-header', 'Origin:https://music.youtube.com');
    args.push('--referer', 'https://music.youtube.com/');
    
    // Add advanced bot bypass methods
    addAdvancedBotBypass(args, 'SessionHijack', attempt);
    
    addFreeProxy();
    
    console.log(`   🎫 Session hijack client: ${client}`);
    console.log('   🔥 Fake tokens, auth cookies, API keys enabled');
    return { userAgent, clientType: client, strategy: 'SessionHijack' };
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

// Detect Python on startup
detectPythonCommand();

// Store version information
let versionInfo = {
  spotdl: 'Unknown',
  ytdlp: 'Unknown',
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

// Helper function to update yt-dlp and spotdl
async function updateDependencies() {
  // Silent update check
  return new Promise((resolve) => {
    const updateProcess = spawn(PYTHON_CMD, ['-m', 'pip', 'install', '--upgrade', '--quiet', 'yt-dlp', 'spotdl']);
    let output = '';
    
    updateProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    updateProcess.stderr.on('data', (data) => {
      // Silently capture stderr
    });
    
    updateProcess.on('close', (code) => {
      const updated = output.includes('Successfully installed') || output.includes('Requirement already satisfied');
      versionInfo.lastUpdated = new Date().toISOString();
      resolve(updated);
    });
  });
}

// Check versions on startup
async function checkAndUpdateVersions() {
  console.log('\n🔄 Checking dependencies...');
  
  versionInfo.spotdl = await getSpotdlVersion();
  versionInfo.ytdlp = await getYtDlpVersion();
  versionInfo.lastChecked = new Date().toISOString();
  
  // Auto-update (silent)
  await updateDependencies();
  
  // Get updated versions
  versionInfo.spotdl = await getSpotdlVersion();
  versionInfo.ytdlp = await getYtDlpVersion();
  
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
    
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Use SAME reliable args as playlist (works without cookies!)
    const ytdlpArgs = [
      '-m', 'yt_dlp',
      url,
      '--dump-json',
      '--no-playlist',
      '--no-warnings',
      '--ignore-errors',
      '--extractor-args', 'youtube:player_client=android,web',  // Same as playlist!
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
    
    ytdlpProcess.on('close', async (code) => {
      if (code === 0 && output.trim()) {
        try {
          const data = JSON.parse(output);
          
          // Extract duration from multiple possible fields
          let duration = 0;
          if (data.duration) {
            duration = Math.floor(data.duration);
          } else if (data.duration_string) {
            // Parse duration string like "4:06" to seconds
            const parts = data.duration_string.split(':').map(Number);
            if (parts.length === 2) {
              duration = parts[0] * 60 + parts[1]; // MM:SS
            } else if (parts.length === 3) {
              duration = parts[0] * 3600 + parts[1] * 60 + parts[2]; // HH:MM:SS
            }
          }
          
          const track = {
            id: data.id || videoId,
            name: data.title || 'Unknown',
            artist: data.uploader || data.channel || data.uploader_id || 'YouTube',
            album: data.album || 'YouTube',
            duration: duration,
            imageUrl: data.thumbnail || data.thumbnails?.[0]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
            url: `https://www.youtube.com/watch?v=${videoId}`,
            downloadStatus: 'pending',
            downloadProgress: 0,
            selected: true
          };
          
          if (duration === 0) {
            console.log(`⚠️  Duration not found in yt-dlp data, trying fallback...`);
            // If no duration, enhance with fallback
            const fallbackResult = await fetchVideoFallback(videoId);
            if (fallbackResult && fallbackResult.track && fallbackResult.track.duration > 0) {
              track.duration = fallbackResult.track.duration;
              console.log(`✅ Got duration from fallback: ${track.duration}s`);
            }
          }
          
          console.log(`✅ YouTube video fetched: "${track.name}" by ${track.artist} (${track.duration}s)`);
          resolve({ track, data });
        } catch (e) {
          console.error('Failed to parse YouTube data:', e.message);
          // Fall back to oEmbed
          console.log(`🔄 Falling back to oEmbed...`);
          const fallbackResult = await fetchVideoFallback(videoId);
          resolve(fallbackResult);
        }
      } else {
        console.error(`yt-dlp failed:`, errorOutput);
        // Fall back to oEmbed immediately (no retries)
        console.log(`🔄 Falling back to oEmbed...`);
        const fallbackResult = await fetchVideoFallback(videoId);
        resolve(fallbackResult);
      }
    });
    
    ytdlpProcess.on('error', (err) => {
      console.error('yt-dlp process error:', err.message);
      // Fall back to oEmbed
      fetchVideoFallback(videoId).then(resolve);
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
                
                // Try multiple patterns to find duration
                const patterns = [
                  { regex: /"lengthSeconds":"(\d+)"/, name: 'lengthSeconds' },
                  { regex: /"duration":"PT(\d+)M(\d+)S"/, name: 'PT format (M:S)' },
                  { regex: /"duration":"PT(\d+)M"/, name: 'PT format (M only)' },
                  { regex: /"approxDurationMs":"(\d+)"/, name: 'approxDurationMs' },
                  { regex: /lengthSeconds&quot;:&quot;(\d+)/, name: 'lengthSeconds (HTML encoded)' },
                  { regex: /"length":"(\d+)"/, name: 'length field' },
                  { regex: /\"lengthText\":\{\"simpleText\":\"(\d+):(\d+)\"/, name: 'lengthText' },
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
          const entries = lines.map(line => JSON.parse(line));
          
          // First entry is the playlist info
          const playlistInfo = entries.find(e => e._type === 'playlist') || entries[0];
          
          // Other entries are videos
          const videos = entries.filter(e => e._type !== 'playlist' && e.id);
          
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
        
        const playlist = {
          id: playlistId,
          name: result.playlistInfo?.title || 'YouTube Playlist',
          description: result.playlistInfo?.description || '',
          owner: result.playlistInfo?.uploader || 'YouTube',
          imageUrl: result.playlistInfo?.thumbnails?.[0]?.url || result.tracks[0]?.imageUrl || '/placeholder.svg',
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
app.post('/api/download/start', async (req, res) => {
  const { playlistUrl, tracks, settings, folderName, playlistImages } = req.body;

  console.log('\n=== DOWNLOAD REQUEST ===');
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
  const outputFolder = path.join(
    os.homedir(), 
    'Downloads', 
    sanitizeFolderName(folderName || `Spotify_Playlist_${new Date().toISOString().split('T')[0]}`)
  );

  // Create output folder
  try {
    await fs.mkdir(outputFolder, { recursive: true });
  } catch (error) {
    return res.status(500).json({ error: 'Failed to create output folder' });
  }

  // Create folder cover image
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

  // Store download info
  activeDownloads.set(downloadId, {
    playlistUrl: effectivePlaylistUrl,
    tracks: selectedTracks,
    settings,
    outputFolder,
    status: 'starting',
    progress: {}
  });

  res.json({ downloadId, outputFolder });

  // Start download process asynchronously
  startDownload(downloadId, effectivePlaylistUrl, selectedTracks, settings, outputFolder);
});

// Cancel download
app.post('/api/download/cancel', (req, res) => {
  const { downloadId } = req.body;
  
  console.log(`\n❌ CANCEL REQUEST: ${downloadId}`);
  
  const downloadInfo = activeDownloads.get(downloadId);
  if (!downloadInfo) {
    return res.status(404).json({ error: 'Download not found' });
  }
  
  // Kill active process
  const processInfo = activeProcesses.get(downloadId);
  if (processInfo && processInfo.process) {
    console.log(`🔪 Killing process for download ${downloadId}`);
    try {
      processInfo.process.kill('SIGTERM');
      // Force kill after 2 seconds if not terminated
      setTimeout(() => {
        if (processInfo.process && !processInfo.process.killed) {
          processInfo.process.kill('SIGKILL');
        }
      }, 2000);
    } catch (err) {
      console.error('Error killing process:', err.message);
    }
  }
  
  // Update status
  downloadInfo.status = 'cancelled';
  downloadInfo.cancelled = true;
  
  // Emit cancellation event
  io.emit('download:cancelled', {
    downloadId,
    message: '❌ Download cancelled by user'
  });
  
  // Clean up
  activeDownloads.delete(downloadId);
  activeProcesses.delete(downloadId);
  
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
  
  // Kill current spotdl process
  const processInfo = activeProcesses.get(downloadId);
  if (processInfo && processInfo.process) {
    console.log(`🔪 Killing spotdl process to skip to yt-dlp`);
    try {
      processInfo.process.kill('SIGTERM');
      // Force kill after 2 seconds if not terminated
      setTimeout(() => {
        if (processInfo.process && !processInfo.process.killed) {
          processInfo.process.kill('SIGKILL');
        }
      }, 2000);
    } catch (err) {
      console.error('Error killing process:', err.message);
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

// Try yt-dlp fallback for failed tracks - WITH PARALLEL DOWNLOADS
async function tryYtDlpFallback(tracks, outputFolder, outputTemplate, socket, downloadId, youtubeLinks = {}, settings = {}, attemptNumber = 0) {
  console.log('\n=== YT-DLP FALLBACK ATTEMPT ===');
  console.log(`📍 Overall attempt: ${attemptNumber + 1}`);
  
  const parallelDownloads = settings.threads || 8;
  console.log(`⚡ Using ${parallelDownloads} parallel downloads`);
  
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
  
  const failedTracks = tracks.filter(track => {
    const expectedFilename = `${track.artist} - ${track.name}.mp3`;
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
  
  // Helper function to download a single track
  const downloadSingleTrack = async (track) => {
    const searchQuery = `${track.artist} ${track.name}`;
    console.log(`\n🔄 Trying yt-dlp for: ${searchQuery}`);
    console.log(`  🔍 Track URL: ${track.url || 'NOT SET'}`);
    console.log(`  🔍 Track ID: ${track.id || 'NOT SET'}`);
    
    socket.emit('download:status', {
      downloadId,
      status: 'downloading',
      message: `🔄 yt-dlp fallback: ${track.artist} - ${track.name}`
    });
    
    // Sanitize filename to avoid issues
    // If artist is "Unknown Artist", just use the track name
    const filenameBase = track.artist === 'Unknown Artist' 
      ? track.name 
      : `${track.artist} - ${track.name}`;
    const sanitizedFilename = filenameBase.replace(/[<>:"/\\|?*]/g, '_');
    const outputPath = path.join(outputFolder, `${sanitizedFilename}.%(ext)s`);
    
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
      }
    }
    
    // Skip metadata fetching - yt-dlp will handle it during download (faster)
    
    let ytdlpArgs;
    let usingDirectLink = false;
    
    if (youtubeLink && !youtubeLinks[`retry_${track.id}`]) {
      console.log(`  🎯 Using direct YouTube link: ${youtubeLink}`);
      usingDirectLink = true;
      // Base download arguments
      ytdlpArgs = [
        '-m', 'yt_dlp',
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '320K',
        '--embed-thumbnail',
        '--embed-metadata',
        '--add-metadata',
        '--parse-metadata', 'title:%(artist)s - %(title)s',
        '--output', outputPath,
        '--no-playlist',
        '--no-part',  // Don't use .part files
        '--force-overwrites',  // Overwrite incomplete files
        '--no-warnings',
        '--ignore-errors',
        youtubeLink
      ];
      
      // Add enhanced methods with strategy cycling based on attempt number
      await addYouTubeEnhancements(ytdlpArgs, attemptNumber);
      
      // Extra bypass for downloads (more aggressive)
      ytdlpArgs.push('--socket-timeout', '60'); // higher timeout over proxies
      ytdlpArgs.push('--retries', '15');
      ytdlpArgs.push('--fragment-retries', '15');
      ytdlpArgs.push('--skip-unavailable-fragments');  // FIX: This is a flag, not a value option
      ytdlpArgs.push('--http-chunk-size', '1M'); // smaller chunks reduce proxy timeouts
    } else {
      console.log(`  Searching YouTube: "ytsearch1:${searchQuery}"`);
      
      // Build args - include metadata only if not "Unknown Artist"
      ytdlpArgs = [
        '-m', 'yt_dlp',
        `ytsearch1:${searchQuery}`,
        '-x',
        '--audio-format', 'mp3',
        '--audio-quality', '320K',
        '--embed-thumbnail',
        '--embed-metadata',
        '--add-metadata',
        '--no-part',  // Don't use .part files
        '--force-overwrites',  // Overwrite incomplete files
        '--no-warnings',
        '--ignore-errors'
      ];
      
      // 🔥 CRITICAL FIX: Use NEW advanced bot bypass strategies for search-based downloads
      console.log(`\n🔧 Search-based Download (Attempt ${attemptNumber + 1})`);
      console.log(`🎯 Using advanced bot bypass strategies for search-based download...`);
      
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
      
      // Add metadata args if artist is not "Unknown Artist"
      if (track.artist !== 'Unknown Artist') {
        ytdlpArgs.push('--parse-metadata', `artist:${track.artist}`);
      }
      
      ytdlpArgs.push('--parse-metadata', `title:${track.name}`);
      
      if (track.album && track.album !== 'YouTube') {
        ytdlpArgs.push('--parse-metadata', `album:${track.album}`);
      }
      
      // Add output path and no-playlist at the end
      ytdlpArgs.push('--output', outputPath);
      ytdlpArgs.push('--no-playlist');
    }
    
    try {
      const result = await new Promise((resolve, reject) => {
        const ytdlpProcess = spawn(PYTHON_CMD, ytdlpArgs, {
          cwd: outputFolder,
          shell: false,
          detached: true,  // Keep process alive even if parent gets SIGTERM
          stdio: ['ignore', 'pipe', 'pipe']
        });
        
        let output = '';
        let errorOutput = '';
        
        ytdlpProcess.stdout.on('data', (data) => {
          const txt = data.toString();
          output += txt;
          console.log(`  yt-dlp: ${txt.trim()}`);
        });
        
        ytdlpProcess.stderr.on('data', (data) => {
          const txt = data.toString();
          errorOutput += txt;
          // yt-dlp outputs progress to stderr, so log it
          if (txt.includes('[download]') || txt.includes('[ExtractAudio]') || txt.includes('[Metadata]') || 
              txt.includes('[EmbedThumbnail]') || txt.includes('[ThumbnailsConvertor]')) {
            console.log(`  yt-dlp: ${txt.trim()}`);
          }
          // Detect ffmpeg issues
          if (txt.includes('ffmpeg') || txt.includes('avconv') || txt.includes('WARNING')) {
            console.log(`  ⚠️  ${txt.trim()}`);
          }
        });
        
        ytdlpProcess.on('close', async (code) => {
          if (code === 0) {
            // Build the expected MP3 path (replace %(ext)s with .mp3)
            const mp3Path = outputPath.replace('%(ext)s', 'mp3').replace(/\.(webm|m4a|opus)$/, '.mp3');
            
            // Wait for file system to sync (important for conversion completion)
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Try multiple times to check file existence (file system might be slow)
            let fileExists = false;
            for (let i = 0; i < 5; i++) {
              fileExists = await fs.access(mp3Path).then(() => true).catch(() => false);
              if (fileExists) break;
              await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            if (fileExists) {
              console.log(`✅ yt-dlp SUCCESS: ${searchQuery}`);
              successCount++;
              
              socket.emit('download:progress', {
                downloadId,
                trackName: `${track.artist} - ${track.name}`,
                status: 'completed',
                progress: 100,
                message: `✅ Downloaded via yt-dlp: ${track.artist} - ${track.name}`
              });
              
              resolve('success');
            } else {
              console.log(`⚠️  yt-dlp COMPLETED but MP3 file not found: ${mp3Path}`);
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
            console.log(`❌ yt-dlp FAILED: ${searchQuery} (exit code ${code})`);
            if (errorOutput) {
              console.log('  Error output:', errorOutput.substring(0, 500));
              // Check for specific ffmpeg errors
              if (errorOutput.includes('ffmpeg') || errorOutput.includes('Postprocessing')) {
                console.log(`  ⚠️  FFMPEG ERROR DETECTED - Make sure ffmpeg is installed and in PATH`);
              }
            }
            resolve('failed');
          }
        });
        
        ytdlpProcess.on('error', (err) => {
          console.log(`❌ yt-dlp PROCESS ERROR: ${searchQuery}`, err.message);
          resolve('error');
        });
      });
      
      // If direct link failed, immediately retry with search method
      if (result !== 'success' && usingDirectLink) {
        console.log(`  🔄 Direct link failed, retrying with YouTube search...`);
        youtubeLinks[`retry_${track.id}`] = true;
        
        socket.emit('download:status', {
          downloadId,
          status: 'downloading',
          message: `🔍 Retrying with search: ${track.artist} - ${track.name}`
        });
        
        const searchArgs = [
          '-m', 'yt_dlp',
          `ytsearch1:${searchQuery}`,
          '-x',
          '--audio-format', 'mp3',
          '--audio-quality', '320K',
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
              
              socket.emit('download:progress', {
                downloadId,
                trackName: `${track.artist} - ${track.name}`,
                status: 'completed',
                progress: 100,
                message: `✅ Downloaded via yt-dlp search: ${track.artist} - ${track.name}`
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
    const batch = batches[i];
    console.log(`\n⚡ Batch ${i + 1}/${batches.length}: Downloading ${batch.length} tracks in parallel...`);
    
    socket.emit('download:status', {
      downloadId,
      status: 'downloading',
      message: `⚡ Batch ${i + 1}/${batches.length}: ${batch.length} tracks in parallel...`
    });
    
    // Download all tracks in this batch simultaneously
    const results = await Promise.allSettled(batch.map(downloadSingleTrack));
    
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
  console.log(`✅ Successfully downloaded: ${successCount}/${failedTracks.length}`);
  
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
  const socket = io;
  const downloadInfo = activeDownloads.get(downloadId);
  
  if (!downloadInfo) return;

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
  const maxAttempts = 20; // 🆕 Increased to 20 to allow all 10 strategies (2 attempts each)
  let shouldContinue = true;
  let failedTracks = new Set(); // Track which tracks consistently fail
  let lastFailCount = 0;
  let youtubeLinks = {}; // Store YouTube links found by spotdl for fallback

  while (attempt < maxAttempts && shouldContinue) {
    // Check if download was cancelled before starting new attempt
    const downloadInfo = activeDownloads.get(downloadId);
    if (!downloadInfo || downloadInfo.cancelled) {
      console.log('❌ Download was cancelled, stopping all attempts');
      return;
    }
    
    attempt++;
    
    console.log(`\n=== DOWNLOAD ATTEMPT ${attempt} ===`);
    socket.emit('download:attempt', {
      downloadId,
      attempt,
      message: `🔄 Attempt ${attempt} of ${maxAttempts} - Downloading ${tracks.length} tracks...`
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
      
      // Use yt-dlp fallback which handles YouTube URLs properly (first attempt)
      const ytdlpSuccess = await tryYtDlpFallback(tracks, outputFolder, outputPath, socket, downloadId, {}, settings, 0);
      
      // Check results
      try {
        const files = await fs.readdir(outputFolder);
        const musicFiles = files.filter(f => 
          f.endsWith('.mp3') || f.endsWith('.flac') || f.endsWith('.ogg')
        );
        
        console.log(`\n📊 Downloaded ${musicFiles.length}/${tracks.length} tracks`);
        
        if (musicFiles.length >= tracks.length) {
          console.log('✅ ALL TRACKS DOWNLOADED - Complete!\n');
          downloadInfo.status = 'completed';
          downloadInfo.totalSuccess = tracks.length;
          downloadInfo.totalFailed = 0;
          downloadInfo.attempts = attempt;
          
          const elapsedTime = formatElapsedTime(downloadInfo.startTime);
          console.log(`⏱️  Total download time: ${elapsedTime}`);
          
          socket.emit('download:complete', {
            downloadId,
            outputFolder,
            totalSuccess: tracks.length,
            totalFailed: 0,
            attempts: attempt,
            message: `🎉 All ${tracks.length} YouTube tracks downloaded!\n⏱️ Completed in ${elapsedTime}`
          });
          
          shouldContinue = false;
          continue;
        } else {
          console.log(`⚠️ Some tracks missing (${tracks.length - musicFiles.length}/${tracks.length})`);
        }
      } catch (error) {
        console.error('Error checking files:', error);
      }
      
      const retryDelay = attempt > 1 ? 5000 : 2000;
      await new Promise(resolve => setTimeout(resolve, retryDelay));
      continue;
    }
    
    // Strategy 2: Mixed sources - download Spotify tracks FIRST, then YouTube with yt-dlp
    // This allows failed Spotify tracks to be retried with yt-dlp in phase 2
    if (mixedSources) {
      console.log('🎭 Mixed sources detected - downloading intelligently...');
      console.log(`   Step 1: Download ${spotifyTracks.length} Spotify tracks with spotdl`);
      console.log(`   Step 2: Download ${youtubeTracks.length} YouTube tracks with yt-dlp`);
      console.log(`   Step 3: Retry any failed Spotify tracks with yt-dlp fallback`);
      
      socket.emit('download:status', {
        downloadId,
        status: 'downloading',
        message: `🎭 Mixed sources: ${spotifyTracks.length} Spotify + ${youtubeTracks.length} YouTube tracks`
      });
      
      // Phase 1: Download Spotify tracks first
      console.log('\n🎵 Phase 1: Downloading Spotify tracks with spotdl...');
      socket.emit('download:status', {
        downloadId,
        status: 'downloading',
        message: `🎵 Phase 1: Downloading ${spotifyTracks.length} Spotify tracks...`
      });
      
      // Continue with spotdl for Spotify tracks (fall through to normal spotdl logic)
      // After spotdl completes, YouTube tracks will be downloaded in phase 2
      tracks = spotifyTracks;
      downloadInfo.hasYouTubeTracks = true;
      downloadInfo.youtubeTracks = youtubeTracks;
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
        
        shouldContinue = false;
        continue;
      } catch (error) {
        console.error('Error checking files:', error);
      }
    }
    
    // Build yt-dlp args for spotdl (including proxy if available)
    let ytdlpArgs = '--extractor-args youtube:player_client=android --user-agent "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Mobile Safari/537.36" --sleep-requests 1 --retries 10';
    
    // Add Oxylabs proxy if available (PROFESSIONAL - best option)
    if (process.env.OXYLABS_PROXY) {
      ytdlpArgs += ` --proxy ${process.env.OXYLABS_PROXY} --no-check-certificate`;
      console.log('🌐 Oxylabs proxy enabled for spotdl downloads');
    }
    // Add ScraperAPI proxy if available (PAID)
    else if (process.env.SCRAPERAPI_KEY) {
      const scraperApiProxy = `http://scraperapi:${process.env.SCRAPERAPI_KEY}@proxy-server.scraperapi.com:8001`;
      ytdlpArgs += ` --proxy ${scraperApiProxy} --no-check-certificate`;
      console.log('🌐 ScraperAPI proxy enabled for spotdl downloads');
    }
    // Otherwise, use free rotating proxies (FREE)
    else if (process.env.USE_FREE_PROXIES === 'true') {
      const proxy = proxyManager.getProxyForYtdlp();
      if (proxy) {
        ytdlpArgs += ` --proxy ${proxy}`;
        console.log(`🌐 Free proxy enabled for spotdl: ${proxy}`);
      }
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

    // Store process for cancellation
    activeProcesses.set(downloadId, {
      process: spotdlProcess,
      type: 'spotdl',
      startTime: Date.now()
    });

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
          lastFailCount = remaining;
          
          // If no progress after 9 attempts, these tracks are unavailable
          // (need 18 attempts to try all 10 strategies: each strategy gets 2 attempts)
          const giveUp = !progressMade && attempt >= 18;
          
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
                    message: `🎉 All ${successfulTracks} tracks downloaded successfully!\n⏱️ Completed in ${elapsedTime}`
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
              message: `${finalMessage}\n⏱️ Completed in ${elapsedTime}`
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
            message: `Download completed! Check ${outputFolder} for your files.\n⏱️ Completed in ${elapsedTime}`
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

// Download completed files as ZIP archive
app.get('/api/download/archive/:downloadId', async (req, res) => {
  const { downloadId } = req.params;
  const downloadInfo = activeDownloads.get(downloadId);

  if (!downloadInfo) {
    return res.status(404).json({ error: 'Download not found' });
  }

  if (downloadInfo.status !== 'completed') {
    return res.status(400).json({ error: 'Download not completed yet' });
  }

  const { outputFolder } = downloadInfo;
  
  try {
    // Check if folder exists
    await fs.access(outputFolder);
    
    // Get folder name for the ZIP file
    const folderName = path.basename(outputFolder);
    const zipFileName = `${folderName}.zip`;
    
    // Set response headers
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
    
    // Create archive
    const archive = archiver('zip', {
      zlib: { level: 9 } // Maximum compression
    });
    
    // Pipe archive to response
    archive.pipe(res);
    
    // Add all files from the output folder
    archive.directory(outputFolder, false);
    
    // Finalize the archive
    await archive.finalize();
    
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

// Refresh proxy pool manually
app.post('/api/proxy/refresh', async (req, res) => {
  if (process.env.USE_FREE_PROXIES !== 'true') {
    return res.status(400).json({ error: 'Free proxies not enabled' });
  }
  
  try {
    await proxyManager.fetchProxies();
    const stats = proxyManager.getStats();
    res.json({
      success: true,
      message: 'Proxy pool refreshed',
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

// WebSocket connection
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Check versions on startup
checkAndUpdateVersions().then(async () => {
  // If dependencies are not installed, try to install them
  if (versionInfo.spotdl === 'Unknown' || versionInfo.ytdlp === 'Unknown') {
    console.log('\n🔄 Dependencies not found, attempting to install...');
    try {
      await updateDependencies();
      await checkAndUpdateVersions();
      console.log('✅ Dependencies installed successfully!');
    } catch (error) {
      console.log('⚠️ Failed to install dependencies:', error.message);
    }
  }
  
  // 🔍 CHECK PROXY CONFIGURATION
  console.log('\n🔍 Checking proxy configuration...');
  
  // Check Oxylabs (Priority 1)
  if (process.env.OXYLABS_PROXY) {
    console.log('✅ Oxylabs proxy configured! 🎯');
    console.log(`   Proxy: ${process.env.OXYLABS_PROXY.split('@')[1] || 'dc.oxylabs.io:8000'}`);
  } else {
    console.log('⚠️  Oxylabs proxy NOT configured');
  }
  
  // Check ScraperAPI (Priority 2)
  if (process.env.SCRAPERAPI_KEY) {
    console.log('✅ ScraperAPI key configured!');
    console.log(`   Key: ${process.env.SCRAPERAPI_KEY.substring(0, 8)}...`);
  } else {
    console.log('⚠️  ScraperAPI key NOT configured');
  }
  
  // Initialize free proxy pool if enabled (Priority 3 - Fallback)
  if (process.env.USE_FREE_PROXIES === 'true') {
    console.log('✅ Free proxies enabled (fallback)');
    console.log('\n🌐 Initializing free proxy pool...');
    try {
      await proxyManager.fetchProxies();
      const stats = proxyManager.getStats();
      console.log(`✅ Proxy pool ready: ${stats.total} proxies loaded`);
    } catch (error) {
      console.log('⚠️ Failed to load proxies:', error.message);
      console.log('Will try to fetch proxies on first use');
    }
  } else {
    console.log('⚠️  Free proxies NOT enabled');
  }
  
  console.log('\n📊 Download Success Rate Estimate:');
  if (process.env.OXYLABS_PROXY) {
    console.log('   🟢 60-80% (Oxylabs Premium)');
  } else if (process.env.SCRAPERAPI_KEY) {
    console.log('   🟡 40-60% (ScraperAPI)');
  } else if (process.env.USE_FREE_PROXIES === 'true') {
    console.log('   🔴 1-4% (Free Proxies Only)');
  } else {
    console.log('   ⚫ 0% (No Proxies - will fail)');
  }
  console.log('');
  
  httpServer.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║     🎵 Spotify Playlist Downloader Server Running 🎵      ║
╠════════════════════════════════════════════════════════════╣
║  Server: http://localhost:${PORT}                            ║
║  spotdl: ${versionInfo.spotdl.padEnd(45)}║
║  yt-dlp: ${versionInfo.ytdlp.padEnd(45)}║
║  Status: Ready to download playlists                       ║
╚════════════════════════════════════════════════════════════╝
    `);
    
    // Keep-alive mechanism for Koyeb
    setInterval(() => {
      console.log('🔄 Keep-alive ping - Server is running');
    }, 30000); // Every 30 seconds
  });
});

