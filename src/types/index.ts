export interface Playlist {
  id: string;
  name: string;
  description: string;
  owner: string;
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
  downloadStatus: 'pending' | 'downloading' | 'completed' | 'failed';
  downloadProgress: number;
}

export interface DownloadSettings {
  format: 'mp3' | 'flac' | 'ogg';
  quality: '128k' | '192k' | '256k' | '320k';
  threads: number;
}
