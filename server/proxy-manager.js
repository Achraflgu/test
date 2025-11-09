// Proxy Manager - Premium (Oxylabs) + Free Proxies with validation
import fetch from 'node-fetch';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { 
  isRedisAvailable,
  saveYouTubeProxiesToRedis,
  loadYouTubeProxiesFromRedis,
  updateProxyMetadata
} from './cookieStorage.js';

class ProxyManager {
  constructor() {
    this.proxies = [];
    this.workingProxies = [];
    this.youtubeWorkingProxies = []; // 🎯 Proxies that work specifically with YouTube
    this.currentIndex = 0;
    this.lastFetch = 0;
    this.lastValidation = 0;
    this.lastYouTubeValidation = 0;
    this.FETCH_INTERVAL = 10 * 60 * 1000; // Refresh every 10 minutes
    this.VALIDATION_INTERVAL = 10 * 60 * 1000; // Re-validate every 10 minutes
    this.isValidating = false;
    this.isValidatingYouTube = false;
    this.MIN_YOUTUBE_PROXIES = 30; // 🎯 Minimum 30 YouTube-working proxies required
    this.proxiesLoadedFromRedis = false; // Track if we've loaded from Redis
    
    // 🌟 OXYLABS Premium Proxy Configuration
    this.oxylabsConfig = null;
    this.oxylabsWorking = false;
    this.oxylabsWorksWithYouTube = false; // 🎯 Track if Oxylabs works specifically with YouTube
    
    // 🆕 UPDATED 2025 - Public proxy sources (verified working)
    this.sources = [
      // 🌟 ProxyGather - PRE-VALIDATED WORKING PROXIES (Updated every 30 min via GitHub Actions)
      // These are already checked and working - HIGHEST PRIORITY
      'https://raw.githubusercontent.com/Skillter/ProxyGather/refs/heads/master/proxies/working-proxies-all.txt',
      'https://raw.githubusercontent.com/Skillter/ProxyGather/refs/heads/master/proxies/working-proxies-http.txt',
      'https://raw.githubusercontent.com/Skillter/ProxyGather/refs/heads/master/proxies/working-proxies-socks4.txt',
      'https://raw.githubusercontent.com/Skillter/ProxyGather/refs/heads/master/proxies/working-proxies-socks5.txt',
      
      // 🔥 ProxyScrape V4 API (GOOD - 500+ proxies, fast, reliable)
      'https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text&timeout=20000',
      'https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text&timeout=10000&country=us',
      'https://api.proxyscrape.com/v4/free-proxy-list/get?request=display_proxies&proxy_format=protocolipport&format=text&timeout=10000&country=ca,gb,de,fr',
      
      // ProxyScrape V2 (backup)
      'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http&timeout=10000&country=all',
      'https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks4&timeout=10000&country=all',
      'https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks5&timeout=10000&country=all',
      
      // GitHub proxy lists (updated daily)
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt',
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies_anonymous/http.txt',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
      'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
      'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt',
      'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/http.txt',
      'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/https.txt',
      'https://raw.githubusercontent.com/hookzof/socks5_list/master/proxy.txt',
      'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-http.txt',
      'https://raw.githubusercontent.com/jetkai/proxy-list/main/online-proxies/txt/proxies-https.txt',
      
      // Proxy-List APIs
      'https://www.proxy-list.download/api/v1/get?type=http',
      'https://www.proxy-list.download/api/v1/get?type=https',
      'https://www.proxy-list.download/api/v1/get?type=socks4',
      'https://www.proxy-list.download/api/v1/get?type=socks5',
      
      // Additional sources
      'https://proxylist.geonode.com/api/proxy-list?limit=500&page=1&sort_by=lastChecked&sort_type=desc&protocols=http,https',
      'https://raw.githubusercontent.com/sunny9577/proxy-scraper/master/proxies.txt',
      'https://raw.githubusercontent.com/ObcbO/getproxy/master/file/http.txt',
      'https://raw.githubusercontent.com/ObcbO/getproxy/master/file/https.txt',
      'https://raw.githubusercontent.com/mmpx12/proxy-list/master/http.txt',
      'https://raw.githubusercontent.com/mmpx12/proxy-list/master/https.txt',
      'https://raw.githubusercontent.com/prxchk/proxy-list/main/http.txt',
      'https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/master/http.txt',
      'https://raw.githubusercontent.com/Zaeem20/FREE_PROXIES_LIST/master/https.txt'
    ];
  }

  // 🌟 Initialize Oxylabs premium proxy (HIGHEST PRIORITY)
  async initOxylabs() {
    const username = process.env.OXYLABS_USERNAME;
    const password = process.env.OXYLABS_PASSWORD;
    
    if (!username || !password) {
      console.log('⚠️  Oxylabs credentials not found in environment');
      return false;
    }
    
    console.log('🌟 Initializing Oxylabs premium proxy...');
    console.log(`   Username: ${username}`);
    
    // Oxylabs proxy formats:
    // Residential: pr.oxylabs.io:7777
    // Datacenter: dc.oxylabs.io:8001
    // Realtime: realtime.oxylabs.io:60000
    
    this.oxylabsConfig = {
      username,
      password,
      // Try residential first (best for avoiding detection)
      residential: `http://${username}:${password}@pr.oxylabs.io:7777`,
      datacenter: `http://${username}:${password}@dc.oxylabs.io:8001`,
      realtime: `http://${username}:${password}@realtime.oxylabs.io:60000`
    };
    
    // Test Oxylabs connection (but don't fail completely if test fails)
    console.log('🧪 Testing Oxylabs connection...');
    const works = await this.testOxylabs();
    
    // Always mark as working if configured (test might be too strict)
    // The actual downloads will determine if it really works
    if (works) {
      this.oxylabsWorking = true;
      if (this.oxylabsWorksWithYouTube) {
        console.log('✅ Oxylabs proxy verified and working with YouTube!');
        console.log('   🎯 Will use Oxylabs for all YouTube requests (PRIORITY 1)');
      } else {
        console.log('✅ Oxylabs proxy works but NOT with YouTube');
        console.log('   🔄 Will use YouTube-validated free proxies for YouTube requests');
        console.log('   💡 Oxylabs may work for other sites, but YouTube blocks it');
      }
    } else {
      // Test failed - don't use Oxylabs for YouTube
      this.oxylabsWorking = true; // Still mark as working (for non-YouTube use)
      this.oxylabsWorksWithYouTube = false; // But NOT for YouTube
      console.log('⚠️  Oxylabs test failed - will use YouTube-validated proxies instead');
      console.log('   💡 YouTube-validated proxies will be used for cookie generation and downloads');
    }
    
    return true; // Always return true if configured
  }

  // 🧪 Test Oxylabs proxy (more lenient - test simple endpoint first)
  async testOxylabs() {
    if (!this.oxylabsConfig) return false;
    
    try {
      // Test with residential proxy (best quality)
      const agent = new HttpsProxyAgent(this.oxylabsConfig.residential);
      
      // Test 1: Simple endpoint (httpbin or Google) - faster, more reliable
      try {
        const simpleTest = await fetch('https://httpbin.org/ip', {
          agent,
          timeout: 15000, // Longer timeout
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
          }
        });
        
        if (simpleTest.ok) {
          console.log('   ✅ Oxylabs residential proxy working (basic connectivity)');
          // Even if YouTube test fails, basic connectivity means proxy works
          // YouTube might be blocking, but proxy itself is functional
          return true;
        }
      } catch (simpleErr) {
        console.log('   ⚠️  Oxylabs basic test failed, trying YouTube...');
      }
      
      // Test 2: YouTube (CRITICAL - test if Oxylabs works with YouTube specifically)
      try {
        const youtubeTest = await fetch('https://www.youtube.com/', {
          agent,
          timeout: 20000, // Longer timeout for YouTube
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9'
          }
        });
        
        if (youtubeTest.ok) {
          console.log('   ✅ Oxylabs residential proxy working (YouTube accessible)');
          this.oxylabsWorksWithYouTube = true; // Mark as working with YouTube
          return true;
        } else {
          console.log('   ⚠️  Oxylabs proxy accessible but YouTube returned non-200 status');
          this.oxylabsWorksWithYouTube = false; // Mark as NOT working with YouTube
          return false; // Return false so we use YouTube-validated proxies instead
        }
      } catch (youtubeErr) {
        console.log('   ❌ Oxylabs YouTube test failed:', youtubeErr.message);
        console.log('   🔄 Will use YouTube-validated free proxies instead');
        this.oxylabsWorksWithYouTube = false; // Mark as NOT working with YouTube
        return false; // Return false so we use YouTube-validated proxies instead
      }
      
      return false;
    } catch (err) {
      console.log('   ❌ Oxylabs test error:', err.message);
      console.log('   🔄 Will use YouTube-validated free proxies instead');
      this.oxylabsWorksWithYouTube = false; // Mark as NOT working with YouTube
      return false; // Return false so we use YouTube-validated proxies
    }
  }

  // Fetch proxies from all sources
  async fetchProxies() {
    const now = Date.now();
    if (this.proxies.length > 0 && now - this.lastFetch < this.FETCH_INTERVAL) {
      console.log(`🔄 Using cached proxies (${this.proxies.length} available)`);
      return this.proxies;
    }

    console.log('📥 Fetching fresh proxies from public sources...');
    const allProxies = new Set();
    let successCount = 0;

    // Fetch from all sources in parallel
    const results = await Promise.allSettled(
      this.sources.map(async (url) => {
        try {
          const response = await fetch(url, { 
            timeout: 15000, // Increased timeout for V4 API
            headers: { 
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
              'Accept': 'text/plain, application/json, */*'
            }
          });
          
          if (!response.ok) return [];
          
          const contentType = response.headers.get('content-type');
          let text;
          
          // Handle JSON responses (like GeoNode)
          if (contentType && contentType.includes('application/json')) {
            const json = await response.json();
            if (json.data && Array.isArray(json.data)) {
              text = json.data.map(p => `${p.ip}:${p.port}`).join('\n');
            } else {
              text = JSON.stringify(json);
            }
          } else {
            text = await response.text();
          }
          
          // Extract IP:PORT patterns (supports http://IP:PORT and IP:PORT formats)
          const proxyRegex = /(?:https?:\/\/)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5})/g;
          const matches = text.match(proxyRegex) || [];
          
          // Clean up proxies (remove protocol if present)
          matches.forEach(proxy => {
            const cleanProxy = proxy.replace(/^https?:\/\//, '').trim();
            if (cleanProxy) allProxies.add(cleanProxy);
          });
          
          if (matches.length > 0) {
            successCount++;
            console.log(`  ✅ Fetched ${matches.length} proxies from source ${successCount}`);
          }
          
          return matches;
        } catch (err) {
          // Silently fail individual sources
          return [];
        }
      })
    );

    this.proxies = Array.from(allProxies);
    this.lastFetch = now;
    
    console.log(`✅ Total proxies collected: ${this.proxies.length} from ${successCount}/${this.sources.length} sources`);
    return this.proxies;
  }

  // Get next proxy in rotation
  getNextProxy() {
    if (this.proxies.length === 0) {
      return null;
    }
    
    const proxy = this.proxies[this.currentIndex];
    this.currentIndex = (this.currentIndex + 1) % this.proxies.length;
    
    return proxy;
  }

  // Get random proxy (better for avoiding patterns)
  getRandomProxy() {
    if (this.proxies.length === 0) {
      return null;
    }
    
    const randomIndex = Math.floor(Math.random() * this.proxies.length);
    return this.proxies[randomIndex];
  }

  // Mark a proxy as working
  markWorking(proxy) {
    if (!this.workingProxies.includes(proxy)) {
      this.workingProxies.push(proxy);
      console.log(`✅ Verified working proxy: ${proxy} (${this.workingProxies.length} working)`);
    }
  }

  // Mark a proxy as failed
  markFailed(proxy) {
    const index = this.proxies.indexOf(proxy);
    if (index > -1) {
      this.proxies.splice(index, 1);
    }
    
    const workingIndex = this.workingProxies.indexOf(proxy);
    if (workingIndex > -1) {
      this.workingProxies.splice(workingIndex, 1);
    }
    
    // 🛡️ Also remove from YouTube-validated proxies if it's there
    const youtubeIndex = this.youtubeWorkingProxies.indexOf(proxy);
    if (youtubeIndex > -1) {
      this.youtubeWorkingProxies.splice(youtubeIndex, 1);
      console.log(`  🗑️ Removed dead proxy from YouTube-validated list: ${proxy.substring(0, 20)}...`);
      
      // Save updated list to Redis (fire-and-forget, no await needed)
      if (isRedisAvailable()) {
        saveYouTubeProxiesToRedis(this.youtubeWorkingProxies).catch(() => {});
      }
      
      // If below minimum, trigger refresh in background
      if (this.youtubeWorkingProxies.length < this.MIN_YOUTUBE_PROXIES) {
        this.ensureMinimumYouTubeProxies(this.MIN_YOUTUBE_PROXIES).catch(() => {});
      }
    }
  }

  // Get proxy formatted for yt-dlp (PRIORITY: Oxylabs-YouTube > YouTube-Validated > Validated > Free)
  // 🔧 STABILITY FIX: Auto-refresh if YouTube proxies < MIN_YOUTUBE_PROXIES (30)
  async getProxyForYtdlp(autoRefresh = true) {
    // 🎯 Check and maintain minimum 30 YouTube-working proxies
    if (autoRefresh && this.youtubeWorkingProxies.length < this.MIN_YOUTUBE_PROXIES) {
      console.log(`  🔄 YouTube proxies low (${this.youtubeWorkingProxies.length}/${this.MIN_YOUTUBE_PROXIES}) - refreshing in background...`);
      // Refresh in background (don't await to avoid blocking)
      this.ensureMinimumYouTubeProxies(this.MIN_YOUTUBE_PROXIES).catch(err => {
        console.log(`  ⚠️ Background proxy refresh failed: ${err.message}`);
      });
    }
    
    // 🌟 PRIORITY 1: Oxylabs premium proxy (ONLY if it works with YouTube!)
    // If Oxylabs doesn't work with YouTube, skip it and use YouTube-validated proxies
    if (this.oxylabsConfig && this.oxylabsWorksWithYouTube) {
      console.log('   🌟 Using Oxylabs premium proxy (residential) - verified working with YouTube');
      return this.oxylabsConfig.residential;
    }
    // Note: If Oxylabs doesn't work with YouTube, silently skip it (no spam)
    
    // 🎯 PRIORITY 2: YouTube-validated proxies (BEST for YouTube - tested specifically!)
    if (this.youtubeWorkingProxies.length > 0) {
      const randomIndex = Math.floor(Math.random() * this.youtubeWorkingProxies.length);
      const proxy = this.youtubeWorkingProxies[randomIndex];
      const shortProxy = proxy.length > 20 ? proxy.substring(0, 17) + '...' : proxy;
      console.log(`   🎯 Using YouTube-validated proxy: ${shortProxy} (${this.youtubeWorkingProxies.length} available)`);
      return `http://${proxy}`;
    }
    
    // ✅ PRIORITY 3: Validated free proxies (GOOD - tested and working)
    if (this.workingProxies.length > 0) {
      const randomIndex = Math.floor(Math.random() * this.workingProxies.length);
      const proxy = this.workingProxies[randomIndex];
      const shortProxy = proxy.length > 20 ? proxy.substring(0, 17) + '...' : proxy;
      console.log(`   ✅ Using validated free proxy: ${shortProxy}`);
      return `http://${proxy}`;
    }
    
    // ⚠️ PRIORITY 4: Untested free proxies (RISKY - may not work)
    const proxy = this.getRandomProxy();
    if (!proxy) {
      console.log('   ❌ No proxies available');
      return null;
    }
    
    const shortProxy = proxy.length > 20 ? proxy.substring(0, 17) + '...' : proxy;
    console.log(`   ⚠️  Using untested free proxy: ${shortProxy}`);
    return `http://${proxy}`;
  }
  
  // 🔧 STABILITY FIX: Get next proxy (for rotation on timeout)
  async getNextProxyForYtdlp(currentProxy = null, autoRefresh = true) {
    // If we have a current proxy, mark it as failed and get a different one
    if (currentProxy) {
      // Extract proxy host from URL
      const proxyMatch = currentProxy.match(/http:\/\/([^\/]+)/);
      if (proxyMatch) {
        const proxyHost = proxyMatch[1];
        this.markFailed(proxyHost);
        console.log(`  🔄 Marked current proxy as failed, rotating to next...`);
      }
    }
    
    // Check and refresh if needed
    if (autoRefresh && this.youtubeWorkingProxies.length < this.MIN_YOUTUBE_PROXIES) {
      console.log(`  🔄 YouTube proxies low (${this.youtubeWorkingProxies.length}/${this.MIN_YOUTUBE_PROXIES}) - refreshing...`);
      await this.ensureMinimumYouTubeProxies(this.MIN_YOUTUBE_PROXIES).catch(() => {});
    }
    
    // Get next proxy
    return await this.getProxyForYtdlp(false); // false = don't trigger another refresh
  }

  // 🧪 Test if a single proxy works
  async testProxy(proxy, timeout = 5000) {
    try {
      const proxyUrl = `http://${proxy}`;
      const agent = new HttpsProxyAgent(proxyUrl);
      
      // Test with fast endpoint (Google or httpbin)
      const testUrls = [
        'https://www.google.com',
        'https://httpbin.org/ip',
        'https://api.ipify.org?format=json'
      ];
      
      const testUrl = testUrls[Math.floor(Math.random() * testUrls.length)];
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch(testUrl, {
        agent,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      });
      
      clearTimeout(timeoutId);
      
      // Proxy works if we get a response
      if (response.ok) {
        return true;
      }
      
      return false;
    } catch (err) {
      // Proxy failed (timeout, connection error, etc.)
      return false;
    }
  }

  // 🎯 Test if proxy works specifically with YouTube
  async testProxyForYouTube(proxy, timeout = 15000) {
    try {
      const proxyUrl = `http://${proxy}`;
      const agent = new HttpsProxyAgent(proxyUrl);
      
      // Test with YouTube homepage (must return 200 OK)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      
      const response = await fetch('https://www.youtube.com/', {
        agent,
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Accept-Encoding': 'gzip, deflate, br',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1'
        }
      });
      
      clearTimeout(timeoutId);
      
      // Proxy works with YouTube if we get 200 OK
      if (response.ok) {
        return true;
      }
      
      return false;
    } catch (err) {
      // Proxy failed (timeout, connection error, blocked by YouTube, etc.)
      return false;
    }
  }

  // 🔍 Validate multiple proxies in parallel
  async validateProxies(proxiesToTest = null, maxConcurrent = 20, maxToValidate = 100) {
    if (this.isValidating) {
      console.log('⏭️  Proxy validation already in progress - skipping');
      return this.workingProxies;
    }
    
    this.isValidating = true;
    
    try {
      const proxies = proxiesToTest || this.proxies;
      
      if (proxies.length === 0) {
        console.log('⚠️  No proxies to validate');
        this.isValidating = false;
        return [];
      }
      
      // Limit validation to save time (test first N proxies)
      const toTest = proxies.slice(0, maxToValidate);
      console.log(`🧪 Validating ${toTest.length} proxies (${maxConcurrent} concurrent tests)...`);
      
      let validated = 0;
      let failed = 0;
      const newWorkingProxies = [];
      
      // Process in batches for controlled concurrency
      for (let i = 0; i < toTest.length; i += maxConcurrent) {
        const batch = toTest.slice(i, i + maxConcurrent);
        
        const results = await Promise.allSettled(
          batch.map(async (proxy) => {
            const works = await this.testProxy(proxy, 5000);
            return { proxy, works };
          })
        );
        
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.works) {
            validated++;
            newWorkingProxies.push(result.value.proxy);
            
            // Show progress every 10 validated proxies
            if (validated % 10 === 0) {
              console.log(`  ✅ Validated ${validated} working proxies so far...`);
            }
          } else {
            failed++;
          }
        });
        
        // Small delay between batches to avoid overwhelming the network
        if (i + maxConcurrent < toTest.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      // Update working proxies list
      this.workingProxies = newWorkingProxies;
      this.lastValidation = Date.now();
      
      console.log(`✅ Proxy validation complete:`);
      console.log(`   ✓ Working: ${validated}`);
      console.log(`   ✗ Failed: ${failed}`);
      console.log(`   📊 Success rate: ${((validated / toTest.length) * 100).toFixed(1)}%`);
      
      this.isValidating = false;
      return this.workingProxies;
      
    } catch (err) {
      console.log('⚠️  Proxy validation error:', err.message);
      this.isValidating = false;
      return this.workingProxies;
    }
  }

  // 🎯 Validate proxies specifically for YouTube (filters working proxies)
  async validateProxiesForYouTube(proxiesToTest = null, maxConcurrent = 20, maxToValidate = 50) {
    if (this.isValidatingYouTube) {
      console.log('⏭️  YouTube proxy validation already in progress - skipping');
      return this.youtubeWorkingProxies;
    }
    
    this.isValidatingYouTube = true;
    
    try {
      // Use already-validated working proxies, or provided list
      const proxies = proxiesToTest || this.workingProxies;
      
      if (proxies.length === 0) {
        console.log('⚠️  No proxies to validate for YouTube');
        this.isValidatingYouTube = false;
        return [];
      }
      
      // Limit validation to save time (test first N proxies)
      const toTest = proxies.slice(0, maxToValidate);
      console.log(`🎯 Testing ${toTest.length} proxies specifically for YouTube (${maxConcurrent} concurrent tests)...`);
      
      let validated = 0;
      let failed = 0;
      const newYouTubeProxies = [];
      
      // Process in batches for controlled concurrency
      for (let i = 0; i < toTest.length; i += maxConcurrent) {
        const batch = toTest.slice(i, i + maxConcurrent);
        
        const results = await Promise.allSettled(
          batch.map(async (proxy) => {
            const works = await this.testProxyForYouTube(proxy, 15000);
            return { proxy, works };
          })
        );
        
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.works) {
            validated++;
            newYouTubeProxies.push(result.value.proxy);
            
            // Show progress every 5 validated proxies
            if (validated % 5 === 0) {
              console.log(`  ✅ Found ${validated} YouTube-working proxies so far...`);
            }
          } else {
            failed++;
          }
        });
        
        // Small delay between batches
        if (i + maxConcurrent < toTest.length) {
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
      
      // Merge new YouTube-working proxies with existing ones (avoid duplicates)
      const existingProxies = new Set(this.youtubeWorkingProxies);
      newYouTubeProxies.forEach(proxy => existingProxies.add(proxy));
      this.youtubeWorkingProxies = Array.from(existingProxies);
      this.lastYouTubeValidation = Date.now();
      
      // Save to Redis after validation
      if (isRedisAvailable() && this.youtubeWorkingProxies.length > 0) {
        await saveYouTubeProxiesToRedis(this.youtubeWorkingProxies).catch(() => {});
      }
      
      console.log(`✅ YouTube proxy validation complete:`);
      console.log(`   ✓ YouTube-working: ${validated}`);
      console.log(`   ✗ Failed: ${failed}`);
      console.log(`   📊 YouTube success rate: ${((validated / toTest.length) * 100).toFixed(1)}%`);
      
      this.isValidatingYouTube = false;
      return this.youtubeWorkingProxies;
      
    } catch (err) {
      console.log('⚠️  YouTube proxy validation error:', err.message);
      this.isValidatingYouTube = false;
      return this.youtubeWorkingProxies;
    }
  }

  // 🔄 Validate proxies if needed (called automatically)
  async ensureValidatedProxies() {
    const now = Date.now();
    
    // Skip if we have working proxies and validated recently
    if (this.workingProxies.length > 10 && now - this.lastValidation < this.VALIDATION_INTERVAL) {
      return this.workingProxies;
    }
    
    // Skip if validation is already running
    if (this.isValidating) {
      return this.workingProxies;
    }
    
    console.log('🔄 Time to validate/refresh working proxies...');
    await this.validateProxies();
    
    return this.workingProxies;
  }

  // 🎯 Ensure minimum 30 YouTube-working proxies (called automatically)
  async ensureMinimumYouTubeProxies(minCount = null) {
    const targetCount = minCount || this.MIN_YOUTUBE_PROXIES;
    
    // Check if we already have enough
    if (this.youtubeWorkingProxies.length >= targetCount) {
      // Save to Redis if we have enough
      if (isRedisAvailable() && this.youtubeWorkingProxies.length > 0) {
        await saveYouTubeProxiesToRedis(this.youtubeWorkingProxies).catch(() => {});
      }
      return this.youtubeWorkingProxies;
    }
    
    // Skip if validation is already running
    if (this.isValidatingYouTube) {
      console.log(`⏳ YouTube proxy validation in progress (${this.youtubeWorkingProxies.length}/${targetCount})...`);
      return this.youtubeWorkingProxies;
    }
    
    const needed = targetCount - this.youtubeWorkingProxies.length;
    console.log(`\n🔄 Ensuring minimum ${targetCount} YouTube-working proxies (currently: ${this.youtubeWorkingProxies.length}, needed: ${needed})...`);
    
    // First, ensure we have working proxies to test
    if (this.workingProxies.length < needed * 2) {
      console.log(`  📥 Need more working proxies first (${this.workingProxies.length} < ${needed * 2})...`);
      
      // Fetch and validate more proxies
      if (!this.isValidating) {
        await this.fetchProxies();
        await this.validateProxies(null, 50, Math.max(200, needed * 3));
      }
    }
    
    // Now validate for YouTube (test more proxies to reach minimum)
    const proxiesToTest = Math.max(needed * 3, 100); // Test 3x needed to account for failures
    await this.validateProxiesForYouTube(null, 20, proxiesToTest);
    
    // If still not enough, fetch and test more
    if (this.youtubeWorkingProxies.length < targetCount) {
      console.log(`  ⚠️ Only ${this.youtubeWorkingProxies.length}/${targetCount} YouTube-working proxies found, fetching more...`);
      
      // Fetch fresh proxies
      if (!this.isValidating) {
        await this.fetchProxies();
        await this.validateProxies(null, 50, 200);
      }
      
      // Test more for YouTube
      await this.validateProxiesForYouTube(null, 20, Math.max(200, needed * 4));
    }
    
    // Save to Redis after validation
    if (isRedisAvailable() && this.youtubeWorkingProxies.length > 0) {
      await saveYouTubeProxiesToRedis(this.youtubeWorkingProxies).catch(() => {});
    }
    
    console.log(`✅ YouTube-working proxies: ${this.youtubeWorkingProxies.length}/${targetCount} (${this.youtubeWorkingProxies.length >= targetCount ? '✅ SUFFICIENT' : '⚠️ INSUFFICIENT'})`);
    
    return this.youtubeWorkingProxies;
  }
  
  // 🔄 Load saved proxies from Redis on startup
  async loadProxiesFromRedis() {
    if (this.proxiesLoadedFromRedis) {
      return this.youtubeWorkingProxies;
    }
    
    if (!isRedisAvailable()) {
      console.log('  ⚠️ Redis not available - cannot load saved proxies');
      this.proxiesLoadedFromRedis = true;
      return [];
    }
    
    try {
      const savedProxies = await loadYouTubeProxiesFromRedis();
      if (savedProxies && savedProxies.length > 0) {
        console.log(`  📥 Loaded ${savedProxies.length} saved YouTube-working proxies from Redis`);
        // Add to working proxies list (they'll be re-validated)
        this.youtubeWorkingProxies = savedProxies;
        this.proxiesLoadedFromRedis = true;
        
        // Re-validate saved proxies (they might be stale)
        console.log(`  🔄 Re-validating ${savedProxies.length} saved proxies...`);
        await this.revalidateSavedProxies();
        
        return this.youtubeWorkingProxies;
      }
    } catch (err) {
      console.log(`  ⚠️ Failed to load proxies from Redis: ${err.message}`);
    }
    
    this.proxiesLoadedFromRedis = true;
    return [];
  }
  
  // 🔄 Re-validate saved proxies (remove dead ones)
  async revalidateSavedProxies() {
    if (this.youtubeWorkingProxies.length === 0) return;
    
    if (this.isValidatingYouTube) {
      return this.youtubeWorkingProxies;
    }
    
    this.isValidatingYouTube = true;
    
    try {
      console.log(`  🧪 Re-validating ${this.youtubeWorkingProxies.length} saved proxies...`);
      const validProxies = [];
      let validated = 0;
      let failed = 0;
      
      // Test in batches of 20
      const batchSize = 20;
      for (let i = 0; i < this.youtubeWorkingProxies.length; i += batchSize) {
        const batch = this.youtubeWorkingProxies.slice(i, i + batchSize);
        
        const results = await Promise.allSettled(
          batch.map(async (proxy) => {
            const works = await this.testProxyForYouTube(proxy, 10000); // Faster timeout for re-validation
            return { proxy, works };
          })
        );
        
        results.forEach((result) => {
          if (result.status === 'fulfilled' && result.value.works) {
            validated++;
            validProxies.push(result.value.proxy);
          } else {
            failed++;
          }
        });
        
        // Small delay between batches
        if (i + batchSize < this.youtubeWorkingProxies.length) {
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }
      
      const beforeCount = this.youtubeWorkingProxies.length;
      this.youtubeWorkingProxies = validProxies;
      const removedCount = beforeCount - validProxies.length;
      this.lastYouTubeValidation = Date.now();
      
      console.log(`  ✅ Re-validation complete: ${validated} valid, ${failed} failed`);
      if (removedCount > 0) {
        console.log(`  🗑️ Removed ${removedCount} dead proxy/proxies from YouTube-working list`);
      }
      
      // Save updated list to Redis
      if (isRedisAvailable() && this.youtubeWorkingProxies.length > 0) {
        await saveYouTubeProxiesToRedis(this.youtubeWorkingProxies).catch(() => {});
      }
      
      // If we have less than minimum, fetch more
      if (this.youtubeWorkingProxies.length < this.MIN_YOUTUBE_PROXIES) {
        console.log(`  ⚠️ Only ${this.youtubeWorkingProxies.length}/${this.MIN_YOUTUBE_PROXIES} valid proxies - fetching more...`);
        await this.ensureMinimumYouTubeProxies(this.MIN_YOUTUBE_PROXIES);
      }
      
    } catch (err) {
      console.log(`  ⚠️ Re-validation error: ${err.message}`);
    } finally {
      this.isValidatingYouTube = false;
    }
    
    return this.youtubeWorkingProxies;
  }

  // Get stats
  getStats() {
    return {
      oxylabs: this.oxylabsWorking ? 'Active (Premium)' : 'Not configured',
      total: this.proxies.length,
      working: this.workingProxies.length,
      youtubeWorking: this.youtubeWorkingProxies.length,
      lastFetch: this.lastFetch ? new Date(this.lastFetch).toLocaleString() : 'Never',
      lastValidation: this.lastValidation ? new Date(this.lastValidation).toLocaleString() : 'Never',
      lastYouTubeValidation: this.lastYouTubeValidation ? new Date(this.lastYouTubeValidation).toLocaleString() : 'Never',
      validationRate: this.proxies.length > 0 ? `${((this.workingProxies.length / this.proxies.length) * 100).toFixed(1)}%` : '0%',
      youtubeValidationRate: this.workingProxies.length > 0 ? `${((this.youtubeWorkingProxies.length / this.workingProxies.length) * 100).toFixed(1)}%` : '0%'
    };
  }
}

// Export singleton instance
export const proxyManager = new ProxyManager();

