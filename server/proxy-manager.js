// Free Proxy Manager - Fetches and rotates free proxies automatically
import fetch from 'node-fetch';

class ProxyManager {
  constructor() {
    this.proxies = [];
    this.workingProxies = [];
    this.currentIndex = 0;
    this.lastFetch = 0;
    this.FETCH_INTERVAL = 10 * 60 * 1000; // Refresh every 10 minutes
    
    // Public proxy sources (regularly updated)
    this.sources = [
      'https://api.proxyscrape.com/v2/?request=getproxies&protocol=http',
      'https://api.proxyscrape.com/v2/?request=getproxies&protocol=https',
      'https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks4',
      'https://api.proxyscrape.com/v2/?request=getproxies&protocol=socks5',
      'https://www.proxy-list.download/api/v1/get?type=http',
      'https://www.proxy-list.download/api/v1/get?type=https',
      'https://www.proxy-list.download/api/v1/get?type=socks4',
      'https://www.proxy-list.download/api/v1/get?type=socks5',
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/http.txt',
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks4.txt',
      'https://raw.githubusercontent.com/TheSpeedX/PROXY-List/master/socks5.txt',
      'https://raw.githubusercontent.com/clarketm/proxy-list/master/proxy-list-raw.txt',
      'https://raw.githubusercontent.com/roosterkid/openproxylist/main/HTTPS_RAW.txt',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/http.txt',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks4.txt',
      'https://raw.githubusercontent.com/monosans/proxy-list/main/proxies/socks5.txt',
      'https://raw.githubusercontent.com/ShiftyTR/Proxy-List/master/proxy.txt'
    ];
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
            timeout: 10000,
            headers: { 'User-Agent': 'Mozilla/5.0' }
          });
          
          if (!response.ok) return [];
          
          const text = await response.text();
          
          // Extract IP:PORT patterns
          const proxyRegex = /\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}:\d{2,5}/g;
          const matches = text.match(proxyRegex) || [];
          
          matches.forEach(proxy => allProxies.add(proxy.trim()));
          
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
    
    console.log(`✅ Total proxies collected: ${this.proxies.length} from ${successCount} sources`);
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
  }

  // Get proxy formatted for yt-dlp
  getProxyForYtdlp() {
    const proxy = this.getRandomProxy();
    if (!proxy) return null;
    
    // yt-dlp accepts: http://IP:PORT or socks5://IP:PORT
    // Most free proxies are HTTP, some are SOCKS
    return `http://${proxy}`;
  }

  // Get stats
  getStats() {
    return {
      total: this.proxies.length,
      working: this.workingProxies.length,
      lastFetch: this.lastFetch ? new Date(this.lastFetch).toLocaleString() : 'Never'
    };
  }
}

// Export singleton instance
export const proxyManager = new ProxyManager();

