import { useState, useEffect } from "react";
import { Search, Loader2, AlertCircle, Link2, Plus, RefreshCw, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Playlist, Track } from "@/types";
import { toast } from "sonner";
import { fetchPlaylistMetadata } from "@/services/api";

interface PlaylistInputProps {
  onPlaylistLoaded: (playlist: Playlist, tracks: Track[], mode: 'replace' | 'append') => void;
  hasExistingData?: boolean;
  existingPlaylistName?: string;
  initialUrl?: string;
  onSearchTextDetected?: (searchText: string) => void;
}

export const PlaylistInput = ({ onPlaylistLoaded, hasExistingData, existingPlaylistName, initialUrl, onSearchTextDetected }: PlaylistInputProps) => {
  const [url, setUrl] = useState(initialUrl || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [pendingData, setPendingData] = useState<{ playlist: Playlist; tracks: Track[] } | null>(null);
  const [loadingDots, setLoadingDots] = useState(".");
  const [loadingTime, setLoadingTime] = useState(0);
  const [isInvalidUrl, setIsInvalidUrl] = useState(false);
  const [isSearchText, setIsSearchText] = useState(false);

  // Update URL when initialUrl prop changes
  useEffect(() => {
    if (initialUrl) {
      setUrl(initialUrl);
      setIsInvalidUrl(isUnsupportedUrl(initialUrl));
    }
  }, [initialUrl]);

  // Animated loading dots
  useEffect(() => {
    if (loading) {
      const dotsInterval = setInterval(() => {
        setLoadingDots(prev => prev.length >= 3 ? "." : prev + ".");
      }, 500);
      
      const timeInterval = setInterval(() => {
        setLoadingTime(prev => prev + 1);
      }, 1000);
      
      return () => {
        clearInterval(dotsInterval);
        clearInterval(timeInterval);
      };
    } else {
      setLoadingDots(".");
      setLoadingTime(0);
    }
  }, [loading]);

  const validateUrl = (url: string): boolean => {
    const patterns = [
      // Spotify playlists
      /^https?:\/\/open\.spotify\.com\/playlist\/[a-zA-Z0-9]+/,
      /^spotify:playlist:[a-zA-Z0-9]+/,
      // Spotify tracks
      /^https?:\/\/open\.spotify\.com\/track\/[a-zA-Z0-9]+/,
      /^spotify:track:[a-zA-Z0-9]+/,
      // Spotify albums
      /^https?:\/\/open\.spotify\.com\/album\/[a-zA-Z0-9]+/,
      /^spotify:album:[a-zA-Z0-9]+/,
      // Spotify artists
      /^https?:\/\/open\.spotify\.com\/artist\/[a-zA-Z0-9]+/,
      /^spotify:artist:[a-zA-Z0-9]+/,
      // YouTube videos
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/,
      /^https?:\/\/youtu\.be\/[a-zA-Z0-9_-]+/,
      /^https?:\/\/music\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/,
      // YouTube playlists
      /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=[a-zA-Z0-9_-]+/,
      /^https?:\/\/music\.youtube\.com\/playlist\?list=[a-zA-Z0-9_-]+/,
    ];
    return patterns.some(pattern => pattern.test(url));
  };

  // Check if text looks like a URL but isn't supported
  const isUnsupportedUrl = (text: string): boolean => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    
    // Check if it looks like a URL
    const urlPattern = /^https?:\/\//i;
    if (!urlPattern.test(trimmed)) return false;
    
    // If it's a URL but not a valid music URL, it's unsupported
    return !validateUrl(trimmed);
  };

  // Check if text looks like search text (not a URL)
  const isSearchTextInput = (text: string): boolean => {
    const trimmed = text.trim();
    if (!trimmed) return false;
    
    // If it doesn't start with http:// or https:// or spotify:, it's likely search text
    const urlPattern = /^(https?:\/\/|spotify:)/i;
    return !urlPattern.test(trimmed);
  };

  // Update validation when URL changes
  const handleUrlChange = (value: string) => {
    setUrl(value);
    setIsInvalidUrl(isUnsupportedUrl(value));
    setIsSearchText(isSearchTextInput(value));
    if (error) setError(""); // Clear error when user types
  };

  const fetchPlaylistData = async () => {
    if (!url.trim()) {
      setError("Please enter a music URL");
      return;
    }

    // If it's search text, switch to search mode
    if (isSearchText && onSearchTextDetected) {
      onSearchTextDetected(url.trim());
      setUrl('');
      setIsSearchText(false);
      return;
    }

    if (!validateUrl(url)) {
      setError("Invalid URL format. Supported: Spotify (track/playlist/album/artist) or YouTube (video/playlist)");
      return;
    }

    setLoading(true);
    setError("");

    try {
      // Fetch real playlist data from backend
      const { playlist, tracks } = await fetchPlaylistMetadata(url);
      
      // If there's already data loaded, show confirmation dialog
      if (hasExistingData) {
        setPendingData({ playlist, tracks });
        setShowConfirmDialog(true);
        setLoading(false);
      } else {
        // No existing data, load directly
        onPlaylistLoaded(playlist, tracks, 'replace');
        toast.success("🎉 Music loaded successfully!");
        setLoading(false);
      }
    } catch (err: any) {
      const errorMessage = err.message || "Failed to fetch music. Please try again.";
      setError(errorMessage);
      toast.error(`❌ ${errorMessage}`);
      setLoading(false);
    }
  };

  const handleAppendToExisting = () => {
    if (pendingData) {
      onPlaylistLoaded(pendingData.playlist, pendingData.tracks, 'append');
      toast.success(`✨ Added ${pendingData.tracks.length} tracks to existing list!`);
      setShowConfirmDialog(false);
      setPendingData(null);
      setUrl("");
    }
  };

  const handleReplaceExisting = () => {
    if (pendingData) {
      onPlaylistLoaded(pendingData.playlist, pendingData.tracks, 'replace');
      toast.success("🎉 Music loaded successfully!");
      setShowConfirmDialog(false);
      setPendingData(null);
      setUrl("");
    }
  };

  const handleCancelLoad = () => {
    setShowConfirmDialog(false);
    setPendingData(null);
  };

  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative bg-card rounded-2xl border border-border p-8 shadow-card backdrop-blur-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 bg-primary/10 rounded-lg">
            <Link2 className="w-5 h-5 text-primary" />
          </div>
          <h2 className="text-2xl font-bold">Enter Music URL</h2>
        </div>

        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder="Spotify (track/playlist/album/artist) or YouTube (video/playlist) URL..."
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              className={`h-14 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground rounded-xl px-5 text-lg focus-visible:ring-2 transition-all ${
                isInvalidUrl ? 'border-red-500 focus-visible:ring-red-500' : isSearchText ? 'border-blue-500 focus-visible:ring-blue-500' : 'focus-visible:ring-primary'
              }`}
              disabled={loading}
            />
          </div>
          <Button
            onClick={fetchPlaylistData}
            disabled={loading || !url.trim() || isInvalidUrl}
            size="lg"
            data-load-button
            className={`h-14 px-8 text-primary-foreground shadow-glow transition-all duration-300 rounded-xl font-semibold text-lg ${
              isSearchText ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-[0_0_50px_hsl(217_91%_60%/0.5)]' : 'bg-primary hover:bg-primary/90 hover:shadow-[0_0_50px_hsl(141_76%_48%/0.5)]'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                <span className="flex flex-col items-start">
                  <span>Fetching{loadingDots}</span>
                  {loadingTime >= 10 && (
                    <span className="text-xs opacity-70 mt-0.5">
                      {loadingTime}s {loadingTime >= 60 && '(Large playlist, please wait)'}
                    </span>
                  )}
                </span>
              </>
            ) : (
              <>
                <Search className="w-5 h-5 mr-2" />
                {isSearchText ? 'Search Music' : 'Load Music'}
              </>
            )}
          </Button>
        </div>

        {/* Search Text Detected */}
        {isSearchText && url.trim() && !isInvalidUrl && (
          <Alert className="mt-4 rounded-xl border-blue-500/50 bg-blue-500/10">
            <AlertCircle className="h-4 w-4 text-blue-500" />
            <AlertDescription className="font-medium text-blue-500">
              🔍 Search text detected - Click to switch to Search Music mode
            </AlertDescription>
          </Alert>
        )}

        {/* Invalid URL Warning */}
        {isInvalidUrl && url.trim() && (
          <Alert variant="destructive" className="mt-4 rounded-xl border-red-500/50 bg-red-500/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="font-medium">
              ⚠️ Unsupported URL - Only Spotify & YouTube URLs are supported
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive" className="mt-4 rounded-xl border-destructive/50 bg-destructive/10">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="font-medium">{error}</AlertDescription>
          </Alert>
        )}

        <div className="mt-6 flex items-start gap-2 text-sm text-muted-foreground bg-secondary/30 p-4 rounded-xl border border-border/50">
          <div className="text-primary mt-0.5">💡</div>
          <div>
            <span className="font-medium text-foreground">Supported URLs:</span> 
            <ul className="mt-1 space-y-1">
              <li>🎵 Spotify tracks (single songs)</li>
              <li>📁 Spotify playlists</li>
              <li>💿 Spotify albums</li>
              <li>🎤 Spotify artists (popular tracks)</li>
              <li>📺 YouTube videos/music</li>
              <li>📂 YouTube playlists</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="sm:max-w-[500px] bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Music2 className="w-6 h-6 text-primary" />
              Add or Replace Music?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground pt-2">
              You already have <span className="font-semibold text-foreground">"{existingPlaylistName}"</span> loaded.
              <br />
              <br />
              What would you like to do with the new music ({pendingData?.tracks.length} tracks)?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-2">
            <AlertDialogCancel onClick={handleCancelLoad} className="rounded-xl">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReplaceExisting}
              className="bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30 rounded-xl"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Clear & Load New
            </AlertDialogAction>
            <AlertDialogAction
              onClick={handleAppendToExisting}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add to Existing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
