import { useState } from "react";
import { Search, Loader2, AlertCircle } from "lucide-react";
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
      // Simulate API call - In production, this would call Spotify API or backend
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Mock playlist data
      const mockPlaylist: Playlist = {
        id: "mock-playlist-1",
        name: "Summer Vibes 2024",
        description: "The hottest tracks to keep your summer going strong",
        owner: "Spotify",
        imageUrl: "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
        totalTracks: 50,
        totalDuration: 10800, // 3 hours in seconds
        url: url,
      };

      // Mock tracks data
      const mockTracks: Track[] = Array.from({ length: 50 }, (_, i) => ({
        id: `track-${i + 1}`,
        name: `Track ${i + 1}`,
        artist: `Artist ${Math.floor(i / 5) + 1}`,
        album: `Album ${Math.floor(i / 10) + 1}`,
        duration: 180 + Math.floor(Math.random() * 120), // 3-5 minutes
        imageUrl: `https://images.unsplash.com/photo-${1493225457124 + i}?w=64&h=64&fit=crop`,
        url: `https://open.spotify.com/track/mock-${i + 1}`,
        downloadStatus: 'pending',
        downloadProgress: 0,
      }));

      onPlaylistLoaded(mockPlaylist, mockTracks);
      toast.success("Playlist loaded successfully!");
    } catch (err) {
      setError("Failed to fetch playlist. Please try again.");
      toast.error("Failed to load playlist");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-card rounded-xl border border-border p-6 shadow-card">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="Paste Spotify playlist URL (e.g., https://open.spotify.com/playlist/...)"
            value={url}
            onChange={(e) => {
              setUrl(e.target.value);
              setError("");
            }}
            className="h-12 bg-secondary border-border text-foreground placeholder:text-muted-foreground"
            disabled={loading}
          />
        </div>
        <Button
          onClick={fetchPlaylistData}
          disabled={loading || !url.trim()}
          size="lg"
          className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Loading...
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
        <Alert variant="destructive" className="mt-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="mt-4 text-sm text-muted-foreground">
        <p>💡 Tip: You can paste playlist links from Spotify web or desktop app</p>
      </div>
    </div>
  );
};
