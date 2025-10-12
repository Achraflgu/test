import { io, Socket } from 'socket.io-client';
import { Playlist, Track, DownloadSettings } from '@/types';

// API Configuration - supports both local and production
// Trim to remove any accidental spaces in environment variables
const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3001').trim();
const WS_URL = ((import.meta.env as any).VITE_WS_URL || import.meta.env.VITE_API_URL || 'http://localhost:3001').trim();

console.log('🌐 API Configuration:', {
  API_URL,
  WS_URL,
  mode: (import.meta.env as any).MODE
});

let socket: Socket | null = null;

export const initWebSocket = (): Socket => {
  if (!socket) {
    socket = io(WS_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });

    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
  }

  return socket;
};

export const getSocket = (): Socket | null => {
  return socket;
};

export const disconnectWebSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

interface HealthResponse {
  status: string;
  spotdlInstalled: boolean;
  versions: {
    spotdl: string;
    ytdlp: string;
    lastChecked: string;
    lastUpdated: string;
  };
}

export const checkHealth = async (): Promise<HealthResponse> => {
  const response = await fetch(`${API_URL}/api/health`);
  if (!response.ok) {
    throw new Error('Failed to check server health');
  }
  return response.json();
};

interface PlaylistMetadataResponse {
  playlist: Playlist;
  tracks: Track[];
}

export const fetchPlaylistMetadata = async (url: string): Promise<PlaylistMetadataResponse> => {
  const response = await fetch(`${API_URL}/api/playlist/metadata`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to fetch playlist metadata');
  }

  return response.json();
};

interface StartDownloadRequest {
  playlistUrl: string;
  tracks: Track[];
  settings: DownloadSettings;
  folderName: string;
  playlistImages?: string[];
}

interface StartDownloadResponse {
  downloadId: string;
  outputFolder: string;
}

export const startDownload = async (request: StartDownloadRequest): Promise<StartDownloadResponse> => {
  const response = await fetch(`${API_URL}/api/download/start`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to start download');
  }

  return response.json();
};

interface DownloadStatusResponse {
  playlistUrl: string;
  tracks: Track[];
  settings: DownloadSettings;
  outputFolder: string;
  status: string;
  progress: Record<string, any>;
  totalSuccess?: number;
  totalFailed?: number;
  attempts?: number;
}

export const getDownloadStatus = async (downloadId: string): Promise<DownloadStatusResponse> => {
  const response = await fetch(`${API_URL}/api/download/status/${downloadId}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get download status');
  }

  return response.json();
};

interface CancelDownloadResponse {
  success: boolean;
  message: string;
}

export const cancelDownload = async (downloadId: string): Promise<CancelDownloadResponse> => {
  const response = await fetch(`${API_URL}/api/download/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ downloadId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to cancel download');
  }

  return response.json();
};

export const skipToYtdlp = async (downloadId: string): Promise<CancelDownloadResponse> => {
  const response = await fetch(`${API_URL}/api/download/skip-to-ytdlp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ downloadId }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to skip to yt-dlp');
  }

  return response.json();
};

export interface SearchResult {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  url: string;
  imageUrl: string;
  source: string;
  videoId?: string;
}

interface SearchResponse {
  results: SearchResult[];
}

export const searchMusic = async (query: string, limit: number = 10): Promise<SearchResponse> => {
  const response = await fetch(`${API_URL}/api/search`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query, limit }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to search for music');
  }

  return response.json();
};

// Create short share on server
export const createShare = async (payload: { playlistId?: string; playlistName: string; playlistData: any; expiry?: '1h'|'1d'|'1w' }): Promise<{ shareId: string; expiresAt: number }> => {
  const response = await fetch(`${API_URL}/api/share`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create share');
  }
  return response.json();
};

// Fetch share payload from server
export const fetchShare = async (shareId: string): Promise<any> => {
  const response = await fetch(`${API_URL}/api/share/${shareId}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to fetch share');
  }
  return response.json();
};

// Cookie helpers removed – operating cookie-less

