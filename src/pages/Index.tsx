import { useState } from "react";
import { Music2, Download, ListMusic, Sparkles, Zap, Shield } from "lucide-react";
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
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Animated Background Elements */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-bounce-slow" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-bounce-slow" style={{ animationDelay: '1s' }} />
      </div>

      {/* Hero Section */}
      <div className="relative overflow-hidden bg-gradient-spotify border-b border-border">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(141_76%_48%/0.2),transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(141_76%_36%/0.15),transparent_60%)]" />
        <div className="absolute inset-0 bg-[linear-gradient(to_bottom,transparent_0%,hsl(0_0%_7%)_100%)]" />
        
        <div className="container mx-auto px-4 py-16 md:py-20 relative z-10">
          <div className="flex flex-col items-center text-center space-y-6 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full backdrop-blur-sm">
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-primary">Unlimited Downloads</span>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="p-4 bg-primary rounded-2xl shadow-glow animate-glow-pulse">
                <Music2 className="w-10 h-10 text-primary-foreground" />
              </div>
              <h1 className="text-5xl md:text-7xl font-bold">
                <span className="text-gradient">Spotify</span>
                <br />
                <span className="text-foreground">Playlist Downloader</span>
              </h1>
            </div>
            
            <p className="text-muted-foreground text-lg md:text-xl max-w-3xl leading-relaxed">
              Download your favorite Spotify playlists with <span className="text-primary font-semibold">high-quality audio</span>. 
              Unlimited retries, detailed progress tracking, and beautiful organization.
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap justify-center gap-3 pt-4">
              <div className="flex items-center gap-2 px-4 py-2 bg-secondary/50 backdrop-blur-sm rounded-full border border-border">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">Lightning Fast</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-secondary/50 backdrop-blur-sm rounded-full border border-border">
                <Shield className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">100% Safe</span>
              </div>
              <div className="flex items-center gap-2 px-4 py-2 bg-secondary/50 backdrop-blur-sm rounded-full border border-border">
                <Music2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium">320kbps Quality</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-12 relative z-10">
        {/* Input Section */}
        <div className="animate-fade-in" style={{ animationDelay: '0.2s' }}>
          <PlaylistInput 
            onPlaylistLoaded={(playlistData, tracksData) => {
              setPlaylist(playlistData);
              setTracks(tracksData);
            }} 
          />
        </div>

        {/* Settings */}
        {playlist && (
          <div className="mt-8 animate-scale-in">
            <DownloadSettings settings={settings} onSettingsChange={setSettings} />
          </div>
        )}

        {/* Playlist Display */}
        {playlist && (
          <div className="mt-8 space-y-6 animate-fade-in-up">
            <PlaylistHeader playlist={playlist} />
            <TrackList tracks={tracks} settings={settings} />
          </div>
        )}

        {/* Empty State */}
        {!playlist && (
          <div className="mt-24 text-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <div className="inline-flex items-center justify-center w-32 h-32 bg-gradient-to-br from-secondary to-secondary/50 rounded-3xl mb-8 shadow-card hover-scale">
              <ListMusic className="w-16 h-16 text-primary" />
            </div>
            <h3 className="text-3xl font-bold mb-3 text-gradient">Ready to Download?</h3>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
              Paste a Spotify playlist URL above to get started. 
              <br />
              We'll fetch all the tracks and prepare them for download in seconds.
            </p>
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-12 max-w-3xl mx-auto">
              <div className="p-6 bg-card border border-border rounded-xl hover-scale hover-glow">
                <div className="text-4xl font-bold text-primary mb-2">∞</div>
                <div className="text-sm text-muted-foreground">Unlimited Downloads</div>
              </div>
              <div className="p-6 bg-card border border-border rounded-xl hover-scale hover-glow">
                <div className="text-4xl font-bold text-primary mb-2">320k</div>
                <div className="text-sm text-muted-foreground">Maximum Quality</div>
              </div>
              <div className="p-6 bg-card border border-border rounded-xl hover-scale hover-glow">
                <div className="text-4xl font-bold text-primary mb-2">100%</div>
                <div className="text-sm text-muted-foreground">Success Rate</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-24 py-8 relative z-10">
        <div className="container mx-auto px-4 text-center">
          <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
            <Download className="w-4 h-4 text-primary" />
            <span className="font-medium">Powered by spotdl</span>
          </div>
          <p className="text-sm text-muted-foreground/70">
            High-quality music downloads • Built with passion
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
