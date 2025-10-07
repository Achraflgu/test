import { useState } from "react";
import { Music2, Download, ListMusic, Play } from "lucide-react";
import { PlaylistInput } from "@/components/PlaylistInput";
import { PlaylistHeader } from "@/components/PlaylistHeader";
import { TrackList } from "@/components/TrackList";
import { DownloadSettings } from "@/components/DownloadSettings";
import { Playlist, Track, DownloadSettings as DownloadSettingsType } from "@/types";

const Index = () => {
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [settings, setSettings] = useState<DownloadSettingsType>({
    format: "mp3",
    quality: "320k",
    threads: 8,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-spotify border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(141_76%_48%/0.15),transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(141_76%_36%/0.1),transparent_50%)]" />
        
        <div className="container mx-auto px-4 py-12 relative z-10">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-3 bg-primary rounded-xl shadow-glow">
              <Music2 className="w-8 h-8 text-primary-foreground" />
            </div>
            <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Spotify Playlist Downloader
            </h1>
          </div>
          <p className="text-muted-foreground text-lg max-w-2xl">
            Download your favorite Spotify playlists with high-quality audio. 
            Unlimited retries, detailed progress tracking, and beautiful organization.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        {/* Input Section */}
        <PlaylistInput 
          onPlaylistLoaded={(playlistData, tracksData) => {
            setPlaylist(playlistData);
            setTracks(tracksData);
          }} 
        />

        {/* Settings */}
        {playlist && (
          <div className="mt-8">
            <DownloadSettings settings={settings} onSettingsChange={setSettings} />
          </div>
        )}

        {/* Playlist Display */}
        {playlist && (
          <div className="mt-8 space-y-6">
            <PlaylistHeader playlist={playlist} />
            <TrackList tracks={tracks} settings={settings} />
          </div>
        )}

        {/* Empty State */}
        {!playlist && (
          <div className="mt-16 text-center">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-secondary rounded-full mb-6">
              <ListMusic className="w-12 h-12 text-muted-foreground" />
            </div>
            <h3 className="text-2xl font-semibold mb-2">No Playlist Loaded</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Paste a Spotify playlist URL above to get started. 
              We'll fetch all the tracks and prepare them for download.
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-16 py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p className="flex items-center justify-center gap-2">
            <Download className="w-4 h-4" />
            Powered by spotdl • High-quality music downloads
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
