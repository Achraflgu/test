import { useState } from "react";
import { Search, Loader2, AlertCircle, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Playlist, Track } from "@/types";
import { toast } from "sonner";

interface PlaylistInputProps {
  onPlaylistLoaded: (playlist: Playlist, tracks: Track[]) => void;
}

export const PlaylistInput = ({ onPlaylistLoaded }: PlaylistInputProps) => {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const validateSpotifyUrl = (url: string): boolean => {
    const patterns = [
      /^https?:\/\/open\.spotify\.com\/playlist\/[a-zA-Z0-9]+/,
      /^spotify:playlist:[a-zA-Z0-9]+/,
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  const fetchPlaylistData = async () => {
    if (!url.trim()) {
      setError("Please enter a Spotify playlist URL");
      return;
    }

    if (!validateSpotifyUrl(url)) {
      setError("Invalid Spotify playlist URL. Please check and try again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock playlist data
      const mockPlaylist: Playlist = {
        id: "mock-playlist-1",
        name: "Summer Vibes 2024",
        description: "The hottest tracks to keep your summer going strong 🔥",
        owner: "Spotify",
        imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
        totalTracks: 50,
        totalDuration: 10800,
        url: url,
      };

      const mockTracks: Track[] = Array.from({ length: 50 }, (_, i) => ({
        id: `track-${i + 1}`,
        name: `Amazing Track ${i + 1}`,
        artist: `Popular Artist ${Math.floor(i / 5) + 1}`,
        album: `Great Album ${Math.floor(i / 10) + 1}`,
        duration: 180 + Math.floor(Math.random() * 120),
        imageUrl: `https://images.unsplash.com/photo-${1493225457124 + i}?w=64&h=64&fit=crop`,
        url: `https://open.spotify.com/track/mock-${i + 1}`,
        downloadStatus: 'pending',
        downloadProgress: 0,
        selected: true,
      }));

      onPlaylistLoaded(mockPlaylist, mockTracks);
      toast.success("🎉 Playlist loaded successfully!");
    } catch (err) {
      setError("Failed to fetch playlist. Please try again.");
      toast.error("❌ Failed to load playlist");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative bg-card rounded-2xl border border-border p-8 shadow-card backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Link2 className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Enter Playlist URL</h2>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder="https://open.spotify.com/playlist/..."
              value={url}
              onChange={(e) => {
                setUrl(e.target.value);
                setError("");
              }}
              className="h-14 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl px-5 text-lg focus-visible:ring-2 focus-visible:ring-primary transition-all"
              disabled={loading}
            />
          </div>
          <Button
            onClick={fetchPlaylistData}
            disabled={loading || !url.trim()}
            size="lg"
            className="h-14 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow hover:shadow-[0_0_50px_hsl(141_76%_48%/0.5)] transition-all duration-300 rounded-xl font-semibold text-lg"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                Loading
              </>
            ) : (
              <>
                <Search className="w-5 h-5 mr-2" />
                Load Playlist
              </>
            )}
          </Button>
        </div>

        {error && (
          <Alert variant="destructive" className="mt-4 rounded-xl border-destructive/50 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="font-medium">{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-6 flex items-start gap-2 text-sm text-muted-foreground bg-secondary/30 p-4 rounded-xl border border-border/50">
          <div className="text-primary mt-0.5">💡</div>
          <div>
            <span className="font-medium text-foreground">Pro Tip:</span> You can paste playlist links from Spotify web or desktop app. 
            Right-click on any playlist and select "Copy Playlist Link"
          </div>
        </div>
      </div>
    </div>
  );
};
