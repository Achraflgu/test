import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, AlertCircle, Link2, Plus, RefreshCw, Music2, Clipboard, CheckCircle2, X, History, ExternalLink } from "lucide-react";
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
  
  // NEW: Recent URLs history
  const [recentUrls, setRecentUrls] = useState<string[]>([]);
  const [showRecentUrls, setShowRecentUrls] = useState(false);
  
  // NEW: Loading progress details
  const [loadingProgress, setLoadingProgress] = useState({
    tracksLoaded: 0,
    totalTracks: 0,
    status: '' as 'fetching' | 'processing' | 'complete'
  });
  
  // NEW: URL preview/metadata
  const [previewMetadata, setPreviewMetadata] = useState<{
    name: string;
    type: string;
    trackCount: number;
    imageUrl?: string;
  } | null>(null);
  
  // NEW: Cancel loading
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // NEW: URL validation feedback
  const [isValidUrl, setIsValidUrl] = useState(false);

  // Load recent URLs from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('music-url-history');
    if (saved) {
      try {
        setRecentUrls(JSON.parse(saved));
      } catch {}
    }
  }, []);

  // NEW: URL Normalization function
  const normalizeUrl = useCallback((url: string): string => {
    let normalized = url.trim();
    
    // Convert spotify: URI to https://
    if (normalized.startsWith('spotify:')) {
      normalized = normalized.replace('spotify:', 'https://open.spotify.com/');
      normalized = normalized.replace(/:/g, '/');
    }
    
    // Normalize YouTube URLs
    if (normalized.includes('youtu.be/')) {
      const videoId = normalized.split('youtu.be/')[1]?.split('?')[0]?.split('&')[0];
      if (videoId) {
        normalized = `https://www.youtube.com/watch?v=${videoId}`;
      }
    }
    
    // Remove tracking parameters
    normalized = normalized.split('?si=')[0];
    normalized = normalized.split('&si=')[0];
    
    return normalized;
  }, []);

  // Update URL when initialUrl prop changes
  useEffect(() => {
    if (initialUrl) {
      const normalized = normalizeUrl(initialUrl);
      setUrl(normalized);
      setIsInvalidUrl(isUnsupportedUrl(normalized));
      setIsValidUrl(validateUrl(normalized));
    }
  }, [initialUrl, normalizeUrl]);

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

  // NEW: Save URL to history
  const saveUrlToHistory = useCallback((url: string) => {
    const normalized = normalizeUrl(url);
    const updated = [normalized, ...recentUrls.filter(u => u !== normalized)].slice(0, 15);
    setRecentUrls(updated);
    localStorage.setItem('music-url-history', JSON.stringify(updated));
  }, [recentUrls, normalizeUrl]);

  // NEW: Remove URL from history
  const removeUrlFromHistory = useCallback((urlToRemove: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = recentUrls.filter(u => u !== urlToRemove);
    setRecentUrls(updated);
    localStorage.setItem('music-url-history', JSON.stringify(updated));
    toast.success('Removed from history');
  }, [recentUrls]);

  // NEW: Clear all recent URLs
  const clearRecentUrls = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentUrls([]);
    localStorage.setItem('music-url-history', JSON.stringify([]));
    toast.success('Recent URLs cleared');
  }, []);

  // NEW: Fetch preview metadata (lightweight - using existing endpoint)
  // Must be declared before handlePasteFromClipboard to avoid circular dependency
  const fetchPreviewMetadata = useCallback(async (urlToPreview: string) => {
    const normalized = normalizeUrl(urlToPreview);
    if (!validateUrl(normalized)) {
      setPreviewMetadata(null);
      return;
    }
    
    // Try to get basic info from URL pattern
    try {
      let type = 'playlist';
      let name = 'Loading...';
      
      if (normalized.includes('spotify.com/track/')) {
        type = 'track';
        name = 'Spotify Track';
      } else if (normalized.includes('spotify.com/playlist/')) {
        type = 'playlist';
        name = 'Spotify Playlist';
      } else if (normalized.includes('spotify.com/album/')) {
        type = 'album';
        name = 'Spotify Album';
      } else if (normalized.includes('spotify.com/artist/')) {
        type = 'artist';
        name = 'Spotify Artist';
      } else if (normalized.includes('youtube.com/watch') || normalized.includes('youtu.be/')) {
        type = 'video';
        name = 'YouTube Video';
      } else if (normalized.includes('youtube.com/playlist')) {
        type = 'playlist';
        name = 'YouTube Playlist';
      }
      
      setPreviewMetadata({
        name,
        type,
        trackCount: 0, // Will be updated when loaded
      });
    } catch (err) {
      // Preview failed, but continue
      console.log('Preview fetch failed:', err);
    }
  }, [normalizeUrl]);

  // NEW: Paste from clipboard
  const handlePasteFromClipboard = useCallback(async () => {
    try {
      const text = await navigator.clipboard.readText();
      const normalized = normalizeUrl(text);
      setUrl(normalized);
      // Trigger validation manually
      const isValid = validateUrl(normalized);
      const isInvalid = isUnsupportedUrl(normalized);
      const isSearch = isSearchTextInput(normalized);
      
      setIsInvalidUrl(isInvalid);
      setIsSearchText(isSearch);
      setIsValidUrl(isValid && !isInvalid);
      
      if (isValid && !isInvalid && normalized.length > 10) {
        fetchPreviewMetadata(normalized);
      } else {
        setPreviewMetadata(null);
      }
      
      toast.success('Pasted from clipboard');
    } catch (err) {
      toast.error('Could not read from clipboard');
    }
  }, [normalizeUrl, fetchPreviewMetadata]);

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
    const normalized = normalizeUrl(value);
    setUrl(normalized);
    const isValid = validateUrl(normalized);
    const isInvalid = isUnsupportedUrl(normalized);
    const isSearch = isSearchTextInput(normalized);
    
    setIsInvalidUrl(isInvalid);
    setIsSearchText(isSearch);
    setIsValidUrl(isValid && !isInvalid);
    
    // Show preview for valid URLs
    if (isValid && !isInvalid && normalized.length > 10) {
      fetchPreviewMetadata(normalized);
    } else {
      setPreviewMetadata(null);
    }
    
    if (error) setError(""); // Clear error when user types
  };

  // Handle Enter key press
  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !loading && url.trim()) {
      fetchPlaylistData();
    }
  };

  // NEW: Cancel loading
  const handleCancelLoading = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setLoading(false);
    setLoadingProgress({ tracksLoaded: 0, totalTracks: 0, status: 'complete' });
    toast.info('Loading cancelled');
  }, []);

  // Helper to format duration
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
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

    const normalized = normalizeUrl(url);
    if (!validateUrl(normalized)) {
      setError("Invalid URL format. Supported: Spotify (track/playlist/album/artist) or YouTube (video/playlist)");
      return;
    }

    // Create abort controller for cancellation
    abortControllerRef.current = new AbortController();
    setLoading(true);
    setError("");
    setLoadingProgress({ tracksLoaded: 0, totalTracks: 0, status: 'fetching' });

    try {
      // Fetch real playlist data from backend
      const { playlist, tracks } = await fetchPlaylistMetadata(normalized);
      
      // Save to history
      saveUrlToHistory(normalized);
      
      setLoadingProgress({ tracksLoaded: tracks.length, totalTracks: tracks.length, status: 'complete' });
      
      // If there's already data loaded, show confirmation dialog
      if (hasExistingData) {
        setPendingData({ playlist, tracks });
        setShowConfirmDialog(true);
        setLoading(false);
      } else {
        // No existing data, load directly
        onPlaylistLoaded(playlist, tracks, 'replace');
        
        // NEW: Enhanced success toast with post-load UX
        toast.success(
          <div className="flex flex-col gap-2">
            <div className="font-semibold">🎉 Music loaded successfully!</div>
            <div className="text-sm text-muted-foreground">
              {tracks.length} tracks • {formatDuration(playlist.totalDuration)}
            </div>
            <div className="flex gap-2 mt-1">
              <button 
                onClick={() => window.open(playlist.url, '_blank', 'noopener,noreferrer')}
                className="text-xs px-2 py-1 bg-primary/10 hover:bg-primary/20 rounded text-primary transition-colors flex items-center gap-1"
              >
                <ExternalLink className="h-3 w-3" />
                Open Source
              </button>
            </div>
          </div>,
          { duration: 5000 }
        );
        setLoading(false);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') {
        toast.info('Loading cancelled');
      } else {
        const errorMessage = err.message || "Failed to fetch music. Please try again.";
        setError(errorMessage);
        toast.error(`❌ ${errorMessage}`);
      }
      setLoading(false);
      setLoadingProgress({ tracksLoaded: 0, totalTracks: 0, status: 'complete' });
    } finally {
      abortControllerRef.current = null;
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
      <div className="relative bg-card rounded-xl sm:rounded-2xl border border-border p-4 sm:p-6 md:p-8 shadow-card backdrop-blur-sm">
        <div className="flex items-center gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="p-1.5 sm:p-2 bg-primary/10 rounded-lg">
            <Link2 className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
          </div>
          <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Enter Music URL</h2>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 relative">
            <Input
              type="text"
              placeholder="Spotify or YouTube URL..."
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              onKeyPress={handleKeyPress}
              onFocus={() => setShowRecentUrls(recentUrls.length > 0 && !url)}
              onBlur={() => setTimeout(() => setShowRecentUrls(false), 200)}
              className={`h-12 sm:h-14 bg-secondary/50 border-border text-foreground placeholder:text-muted-foreground rounded-lg sm:rounded-xl px-4 sm:px-5 pr-20 sm:pr-24 text-sm sm:text-base md:text-lg focus-visible:ring-2 transition-all ${
                isInvalidUrl 
                  ? 'border-red-500 focus-visible:ring-red-500' 
                  : isValidUrl 
                  ? 'border-green-500 focus-visible:ring-green-500' 
                  : isSearchText 
                  ? 'border-blue-500 focus-visible:ring-blue-500' 
                  : 'focus-visible:ring-primary'
              }`}
              disabled={loading}
            />
            
            {/* NEW: Valid URL indicator */}
            {isValidUrl && !loading && (
              <CheckCircle2 className="absolute right-12 sm:right-14 top-1/2 -translate-y-1/2 h-5 w-5 text-green-500" />
            )}
            
            {/* NEW: Paste button */}
            <button
              onClick={handlePasteFromClipboard}
              className="absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all"
              title="Paste from clipboard"
              disabled={loading}
            >
              <Clipboard className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
            
            {/* NEW: Recent URLs dropdown */}
            {showRecentUrls && recentUrls.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-card border rounded-xl shadow-lg z-50 max-h-60 overflow-y-auto">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <History className="h-4 w-4 text-primary" />
                    <span className="text-sm font-semibold">Recent URLs</span>
                    <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                      {recentUrls.length}
                    </span>
                  </div>
                  <button
                    onClick={clearRecentUrls}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    title="Clear all"
                  >
                    Clear
                  </button>
                </div>
                <div className="p-2">
                  {recentUrls.slice(0, 8).map((recentUrl, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        setUrl(recentUrl);
                        handleUrlChange(recentUrl);
                        setShowRecentUrls(false);
                      }}
                      className="w-full text-left px-3 py-2 hover:bg-accent rounded-md flex items-center justify-between group transition-colors"
                    >
                      <span className="text-sm truncate flex-1">{recentUrl}</span>
                      <button
                        onClick={(e) => removeUrlFromHistory(recentUrl, e)}
                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded transition-opacity"
                        title="Remove"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          
          <div className="flex gap-2">
            {/* NEW: Cancel button (when loading) */}
            {loading && (
              <Button
                onClick={handleCancelLoading}
                variant="outline"
                size="lg"
                className="h-12 sm:h-14 px-4 border-destructive/30 hover:bg-destructive/10 text-destructive"
                title="Cancel loading"
              >
                <X className="w-4 h-4 sm:w-5 sm:h-5" />
              </Button>
            )}
          <Button
            onClick={fetchPlaylistData}
            disabled={loading || !url.trim() || isInvalidUrl}
            size="lg"
            data-load-button
            className={`h-12 sm:h-14 px-6 sm:px-8 text-primary-foreground shadow-glow transition-all duration-300 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base md:text-lg w-full sm:w-auto ${
              isSearchText ? 'bg-blue-600 hover:bg-blue-700 hover:shadow-[0_0_50px_hsl(217_91%_60%/0.5)]' : 'bg-primary hover:bg-primary/90 hover:shadow-[0_0_50px_hsl(141_76%_48%/0.5)]'
            }`}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 mr-2 animate-spin" />
                <span className="flex flex-col items-start">
                  <span className="text-sm sm:text-base">
                    {loadingProgress.status === 'fetching' ? 'Fetching' : 
                     loadingProgress.status === 'processing' ? 'Processing' : 'Loading'}
                    {loadingDots}
                  </span>
                  {/* NEW: Loading progress details */}
                  {loadingProgress.totalTracks > 0 ? (
                    <span className="text-xs opacity-70 mt-0.5">
                      {loadingProgress.tracksLoaded} / {loadingProgress.totalTracks} tracks
                      {loadingTime >= 5 && ` • ${loadingTime}s`}
                    </span>
                  ) : loadingTime >= 10 ? (
                    <span className="text-xs opacity-70 mt-0.5">
                      {loadingTime}s {loadingTime >= 60 && <span className="hidden sm:inline">(Large playlist, please wait)</span>}
                    </span>
                  ) : null}
                </span>
              </>
            ) : (
              <>
                <Search className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
                <span className="hidden sm:inline">{isSearchText ? 'Search Music' : 'Load Music'}</span>
                <span className="sm:hidden">{isSearchText ? 'Search' : 'Load'}</span>
              </>
            )}
          </Button>
          </div>
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

        {/* NEW: URL Preview/Metadata */}
        {previewMetadata && !loading && !isInvalidUrl && !isSearchText && url.trim() && (
          <div className="mt-4 p-4 bg-gradient-to-br from-primary/10 via-primary/5 to-accent/5 border border-primary/20 rounded-xl">
            <div className="flex items-start gap-4">
              {previewMetadata.imageUrl && (
                <img 
                  src={previewMetadata.imageUrl} 
                  alt={previewMetadata.name}
                  className="w-16 h-16 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-semibold text-lg">{previewMetadata.name}</h3>
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full capitalize">
                    {previewMetadata.type}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">
                  {previewMetadata.trackCount > 0 
                    ? `~${previewMetadata.trackCount} tracks`
                    : 'Click Load Music to see details'}
                </p>
              </div>
            </div>
          </div>
        )}

        <div className="mt-4 sm:mt-6 flex items-start gap-2 text-xs sm:text-sm text-muted-foreground bg-secondary/30 p-3 sm:p-4 rounded-lg sm:rounded-xl border border-border/50">
          <div className="text-primary mt-0.5 flex-shrink-0">💡</div>
          <div className="min-w-0">
            <span className="font-medium text-foreground">Supported URLs:</span> 
            <ul className="mt-1 space-y-0.5 sm:space-y-1">
              <li className="truncate">🎵 Spotify tracks, 📁 playlists, 💿 albums, 🎤 artists</li>
              <li className="truncate">📺 YouTube videos/music, 📂 playlists</li>
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
