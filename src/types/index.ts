export interface Playlist {
  id: string;
  name: string;
  description: string;
  owner: string;
  ownerUrl?: string;
  ownerImage?: string;
  imageUrl: string;
  totalTracks: number;
  totalDuration: number;
  url: string;
}

export interface Track {
  id: string;
  name: string;
  artist: string;
  album: string;
  duration: number;
  imageUrl: string;
  url: string;
  youtubeId?: string; // Optional YouTube video ID
  downloadStatus?: 'pending' | 'downloading' | 'completed' | 'failed';
  downloadProgress?: number;
  selected?: boolean;
}

export interface DownloadSettings {
  format: 'mp3' | 'flac' | 'ogg';
  quality: '128k' | '192k' | '256k' | '320k';
  threads: number;
}

// ============================================================
// 🎧 LIVE LISTENING TYPES
// ============================================================

export interface LiveRoom {
  roomId: string;
  hostName: string;
  hostSocketId: string;
  listeners: LiveListener[];
  currentTrack: Track | null;
  currentTime: number;
  isPlaying: boolean;
  createdAt: number;
}

export interface LiveListener {
  socketId: string;
  userName: string;
  joinedAt: number;
}

export interface LiveSessionState {
  isHost: boolean;
  isListener: boolean;
  roomId: string | null;
  hostName?: string;
  listenerCount: number;
}