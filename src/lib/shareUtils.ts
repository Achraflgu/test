export interface ShareLinkOptions {
  playlistId: string;
  playlistName: string;
  playlistData?: any;
  expiry?: '1h' | '1d' | '1w';
}

export interface SharedPlaylistData {
  id: string;
  shareId: string;
  playlistId: string;
  playlistName: string;
  playlistData: any;
  createdAt: number;
  expiresAt?: number;
}

const SHARE_STORAGE_KEY = 'shared-playlists';

// Generate a simple unique ID (fallback if uuid is not available)
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Calculate expiry timestamp
const getExpiryTimestamp = (expiry?: '1h' | '1d' | '1w'): number | undefined => {
  if (!expiry) return undefined;
  
  const now = Date.now();
  const durations = {
    '1h': 60 * 60 * 1000,      // 1 hour
    '1d': 24 * 60 * 60 * 1000, // 1 day
    '1w': 7 * 24 * 60 * 60 * 1000 // 1 week
  };
  
  return now + durations[expiry];
};

// Generate a shareable link
export const generateShareableLink = async (options: ShareLinkOptions): Promise<string> => {
  const { playlistId, playlistName, playlistData, expiry } = options;
  
  // Generate unique share ID
  const shareId = generateId();
  
  // Create shared playlist data
  const sharedData: SharedPlaylistData = {
    id: generateId(),
    shareId,
    playlistId,
    playlistName,
    playlistData,
    createdAt: Date.now(),
    expiresAt: getExpiryTimestamp(expiry)
  };
  
  // Store in localStorage
  try {
    const stored = localStorage.getItem(SHARE_STORAGE_KEY);
    const shares: SharedPlaylistData[] = stored ? JSON.parse(stored) : [];
    
    // Clean up expired shares
    const activeShares = shares.filter(share => {
      if (!share.expiresAt) return true;
      return share.expiresAt > Date.now();
    });
    
    // Add new share
    activeShares.push(sharedData);
    
    localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(activeShares));
  } catch (error) {
    console.error('Failed to store share data:', error);
  }
  
  // Generate shareable URL
  const baseUrl = window.location.origin;
  return `${baseUrl}/share/${shareId}`;
};

// Get shared playlist by share ID
export const getSharedPlaylist = (shareId: string): SharedPlaylistData | null => {
  try {
    const stored = localStorage.getItem(SHARE_STORAGE_KEY);
    if (!stored) return null;
    
    const shares: SharedPlaylistData[] = JSON.parse(stored);
    const share = shares.find(s => s.shareId === shareId);
    
    if (!share) return null;
    
    // Check if expired
    if (share.expiresAt && share.expiresAt < Date.now()) {
      return null; // Expired
    }
    
    return share;
  } catch (error) {
    console.error('Failed to get shared playlist:', error);
    return null;
  }
};

// Clean up expired shares
export const cleanupExpiredShares = () => {
  try {
    const stored = localStorage.getItem(SHARE_STORAGE_KEY);
    if (!stored) return;
    
    const shares: SharedPlaylistData[] = JSON.parse(stored);
    const activeShares = shares.filter(share => {
      if (!share.expiresAt) return true;
      return share.expiresAt > Date.now();
    });
    
    localStorage.setItem(SHARE_STORAGE_KEY, JSON.stringify(activeShares));
  } catch (error) {
    console.error('Failed to cleanup expired shares:', error);
  }
};

