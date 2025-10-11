/**
 * Playlist Storage & Session Management Utilities
 * 
 * Handles:
 * - Export/Import playlists as JSON
 * - Persist player session state
 * - Reset session without deleting saved playlists
 */

// Storage keys
export const STORAGE_KEYS = {
  SAVED_PLAYLISTS: 'saved-playlists',
  PLAYER_SESSION: 'player-session',
  PLAYER_SETTINGS: 'player-settings',
  CURRENT_TRACKLIST: 'current-tracklist'  // Main track list on page
};

// Types
export interface SavedPlaylist {
  id: string;
  name: string;
  url: string;
  imageUrl: string;
  trackCount: number;
  owner?: string;
  savedAt: number;
  lastLoaded?: number;
  isFavorite?: boolean;
  description?: string;
  tracks?: any[];
}

export interface PlayerSession {
  currentTrack: any | null;
  currentQueue: any[];
  currentTime: number;
  isPlaying: boolean;
  timestamp: number;
}

export interface CurrentTrackList {
  tracks: any[];
  playlistUrl?: string;
  playlistName?: string;
  playlistImages?: string[];
  timestamp: number;
}

export interface PlayerSettings {
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: 'off' | 'all' | 'one';
  isMinimized: boolean;
}

// ============ EXPORT/IMPORT ============

/**
 * Export saved playlists to JSON file
 */
export const exportPlaylists = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SAVED_PLAYLISTS);
    const playlists = stored ? JSON.parse(stored) : [];
    
    if (playlists.length === 0) {
      throw new Error('No playlists to export');
    }
    
    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      playlistCount: playlists.length,
      playlists: playlists
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `track-miner-playlists-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    return { success: true, count: playlists.length };
  } catch (error) {
    console.error('Export failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Export failed' };
  }
};

/**
 * Import playlists from JSON file
 */
export const importPlaylists = async (
  file: File, 
  mode: 'merge' | 'replace' = 'merge'
): Promise<{ success: boolean; count?: number; error?: string }> => {
  try {
    const text = await file.text();
    const importData = JSON.parse(text);
    
    // Validate import data
    if (!importData.playlists || !Array.isArray(importData.playlists)) {
      throw new Error('Invalid playlist file format');
    }
    
    const importedPlaylists = importData.playlists;
    
    if (mode === 'replace') {
      // Replace all playlists
      localStorage.setItem(
        STORAGE_KEYS.SAVED_PLAYLISTS, 
        JSON.stringify(importedPlaylists)
      );
      window.dispatchEvent(new Event('playlistsSaved'));
      return { success: true, count: importedPlaylists.length };
    } else {
      // Merge with existing (avoid duplicates by URL)
      const stored = localStorage.getItem(STORAGE_KEYS.SAVED_PLAYLISTS);
      const existingPlaylists: SavedPlaylist[] = stored ? JSON.parse(stored) : [];
      
      const existingUrls = new Set(existingPlaylists.map(p => p.url));
      const newPlaylists = importedPlaylists.filter(
        (p: SavedPlaylist) => !existingUrls.has(p.url)
      );
      
      const mergedPlaylists = [...existingPlaylists, ...newPlaylists];
      
      localStorage.setItem(
        STORAGE_KEYS.SAVED_PLAYLISTS, 
        JSON.stringify(mergedPlaylists)
      );
      window.dispatchEvent(new Event('playlistsSaved'));
      return { success: true, count: newPlaylists.length };
    }
  } catch (error) {
    console.error('Import failed:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Import failed' 
    };
  }
};

// ============ SESSION PERSISTENCE ============

/**
 * Save current player session
 */
export const savePlayerSession = (session: PlayerSession) => {
  try {
    localStorage.setItem(STORAGE_KEYS.PLAYER_SESSION, JSON.stringify(session));
  } catch (error) {
    console.error('Failed to save session:', error);
  }
};

/**
 * Load player session
 */
export const loadPlayerSession = (): PlayerSession | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PLAYER_SESSION);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to load session:', error);
    return null;
  }
};

/**
 * Save player settings
 */
export const savePlayerSettings = (settings: PlayerSettings) => {
  try {
    localStorage.setItem(STORAGE_KEYS.PLAYER_SETTINGS, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
};

/**
 * Load player settings
 */
export const loadPlayerSettings = (): PlayerSettings | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.PLAYER_SETTINGS);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to load settings:', error);
    return null;
  }
};

// ============ TRACK LIST PERSISTENCE ============

/**
 * Save current track list (main list on page)
 */
export const saveCurrentTrackList = (trackList: CurrentTrackList) => {
  try {
    localStorage.setItem(STORAGE_KEYS.CURRENT_TRACKLIST, JSON.stringify(trackList));
  } catch (error) {
    console.error('Failed to save track list:', error);
  }
};

/**
 * Load current track list
 */
export const loadCurrentTrackList = (): CurrentTrackList | null => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.CURRENT_TRACKLIST);
    return stored ? JSON.parse(stored) : null;
  } catch (error) {
    console.error('Failed to load track list:', error);
    return null;
  }
};

// ============ RESET SESSION ============

/**
 * Reset current session (clear queue, player state, track list)
 * Keep saved playlists intact
 */
export const resetPlayerSession = () => {
  try {
    // Remove session, settings, and current track list - keep only saved playlists
    localStorage.removeItem(STORAGE_KEYS.PLAYER_SESSION);
    localStorage.removeItem(STORAGE_KEYS.PLAYER_SETTINGS);
    localStorage.removeItem(STORAGE_KEYS.CURRENT_TRACKLIST);
    
    return { success: true };
  } catch (error) {
    console.error('Failed to reset session:', error);
    return { success: false };
  }
};

/**
 * Get saved playlists count
 */
export const getSavedPlaylistsCount = (): number => {
  try {
    const stored = localStorage.getItem(STORAGE_KEYS.SAVED_PLAYLISTS);
    const playlists = stored ? JSON.parse(stored) : [];
    return playlists.length;
  } catch (error) {
    return 0;
  }
};

