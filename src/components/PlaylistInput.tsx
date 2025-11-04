import { useState, useEffect, useRef, useCallback } from "react";
import { Search, Loader2, AlertCircle, Link2, Plus, RefreshCw, Music2, Clipboard, CheckCircle2, X, History, ExternalLink, Clock, Music, CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
  currentTracks?: Track[]; // To check for duplicates
}

export const PlaylistInput = ({ onPlaylistLoaded, hasExistingData, existingPlaylistName, initialUrl, onSearchTextDetected, currentTracks = [] }: PlaylistInputProps) => {
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
  
  // NEW: Track selection for enhanced dialog
  const [selectedTracks, setSelectedTracks] = useState<Set<string>>(new Set());
  const [showDuplicateOnly, setShowDuplicateOnly] = useState(false);

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

  // Initialize track selection when dialog opens
  useEffect(() => {
    if (showConfirmDialog && pendingData) {
      // Auto-select only non-duplicate tracks by default
      const nonDuplicateTracks = pendingData.tracks.filter(t => !isTrackDuplicate(t.id));
      setSelectedTracks(new Set(nonDuplicateTracks.map(t => t.id)));
      setShowDuplicateOnly(false);
    }
  }, [showConfirmDialog, pendingData]);

  const handleSelectAll = () => {
    if (pendingData) {
      // Get all non-duplicate tracks
      const nonDuplicateTracks = pendingData.tracks.filter(t => !isTrackDuplicate(t.id));
      const nonDuplicateIds = new Set(nonDuplicateTracks.map(t => t.id));
      
      // Check if all non-duplicates are selected
      const allNonDuplicatesSelected = nonDuplicateTracks.length > 0 && 
        nonDuplicateTracks.every(t => selectedTracks.has(t.id));
      
      if (allNonDuplicatesSelected) {
        // Deselect all
        setSelectedTracks(new Set());
      } else {
        // Select all non-duplicates
        setSelectedTracks(nonDuplicateIds);
      }
    }
  };

  const handleToggleTrack = (trackId: string) => {
    const newSelected = new Set(selectedTracks);
    if (newSelected.has(trackId)) {
      newSelected.delete(trackId);
    } else {
      newSelected.add(trackId);
    }
    setSelectedTracks(newSelected);
  };

  const handleAddSelected = () => {
    if (pendingData && selectedTracks.size > 0) {
      // Filter out duplicates from selected tracks
      const selectedTracksList = pendingData.tracks.filter(t => 
        selectedTracks.has(t.id) && !isTrackDuplicate(t.id)
      );
      
      const duplicateCount = selectedTracks.size - selectedTracksList.length;
      
      if (selectedTracksList.length === 0) {
        toast.warning('All selected tracks are duplicates and were not added', {
          description: `${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''} skipped`
        });
        return;
      }
      
      onPlaylistLoaded(
        { ...pendingData.playlist, totalTracks: selectedTracksList.length },
        selectedTracksList,
        'append'
      );
      
      if (duplicateCount > 0) {
        toast.success(`✨ Added ${selectedTracksList.length} tracks!`, {
          description: `${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''} skipped`
        });
      } else {
        toast.success(`✨ Added ${selectedTracksList.length} selected tracks!`);
      }
      
      setShowConfirmDialog(false);
      setPendingData(null);
      setSelectedTracks(new Set());
      setUrl("");
    }
  };

  const handleAppendToExisting = () => {
    if (pendingData) {
      // Filter out duplicates from all tracks
      const nonDuplicateTracks = pendingData.tracks.filter(t => !isTrackDuplicate(t.id));
      const duplicateCount = pendingData.tracks.length - nonDuplicateTracks.length;
      
      if (nonDuplicateTracks.length === 0) {
        toast.warning('All tracks are duplicates and were not added', {
          description: `${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''} skipped`
        });
        return;
      }
      
      onPlaylistLoaded(
        { ...pendingData.playlist, totalTracks: nonDuplicateTracks.length },
        nonDuplicateTracks,
        'append'
      );
      
      if (duplicateCount > 0) {
        toast.success(`✨ Added ${nonDuplicateTracks.length} tracks!`, {
          description: `${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''} skipped`
        });
      } else {
        toast.success(`✨ Added ${nonDuplicateTracks.length} tracks to existing list!`);
      }
      
      setShowConfirmDialog(false);
      setPendingData(null);
      setSelectedTracks(new Set());
      setUrl("");
    }
  };

  const handleReplaceExisting = () => {
    if (pendingData) {
      onPlaylistLoaded(pendingData.playlist, pendingData.tracks, 'replace');
      toast.success("🎉 Music loaded successfully!");
      setShowConfirmDialog(false);
      setPendingData(null);
      setSelectedTracks(new Set());
      setUrl("");
    }
  };

  const handleCancelLoad = () => {
    setShowConfirmDialog(false);
    setPendingData(null);
    setSelectedTracks(new Set());
  };

  // Check if track is duplicate
  const isTrackDuplicate = (trackId: string): boolean => {
    return currentTracks.some(t => t.id === trackId);
  };

  // Format track duration
  const formatTrackDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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

      {/* Enhanced Confirmation Dialog with Track Selection */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent className="sm:max-w-4xl w-[95vw] max-h-[90vh] h-[90vh] p-0 gap-0 flex flex-col">
          {/* Header */}
          <AlertDialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-accent/5">
            <AlertDialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Music2 className="w-6 h-6 text-primary" />
              Add or Replace Music?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-base text-muted-foreground pt-2">
              You already have <span className="font-semibold text-foreground">"{existingPlaylistName}"</span> loaded.
              {pendingData && (
                <span className="block mt-2">
                  New playlist: <span className="font-semibold text-foreground">"{pendingData.playlist.name}"</span>
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {/* Playlist Preview Section */}
          {pendingData && (
            <div className="px-6 py-4 border-b bg-muted/30">
              <div className="flex items-start gap-4">
                {/* Playlist Image */}
                <div className="relative flex-shrink-0">
                  {pendingData.playlist.imageUrl ? (
                    <img
                      src={pendingData.playlist.imageUrl}
                      alt={pendingData.playlist.name}
                      className="w-24 h-24 rounded-lg object-cover shadow-lg"
                    />
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                      <Music2 className="w-12 h-12 text-primary" />
                    </div>
                  )}
                </div>

                {/* Playlist Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-bold line-clamp-2">{pendingData.playlist.name}</h3>
                      <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Music className="h-4 w-4" />
                          {pendingData.tracks.length} tracks
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {formatDuration(pendingData.playlist.totalDuration)}
                        </span>
                      </div>
                      {/* Playlist URL */}
                      <div className="mt-3 flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => window.open(pendingData.playlist.url, '_blank', 'noopener,noreferrer')}
                          className="text-xs text-primary hover:underline flex items-center gap-1 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View Source
                        </button>
                        <span className="text-xs text-muted-foreground">•</span>
                        <span className="text-xs text-muted-foreground truncate max-w-md" title={pendingData.playlist.url}>
                          {pendingData.playlist.url}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Track Selection Controls */}
          {pendingData && (() => {
            const nonDuplicateTracks = pendingData.tracks.filter(t => !isTrackDuplicate(t.id));
            const duplicateCount = pendingData.tracks.length - nonDuplicateTracks.length;
            const allNonDuplicatesSelected = nonDuplicateTracks.length > 0 && 
              nonDuplicateTracks.every(t => selectedTracks.has(t.id));
            
            return (
              <div className="px-6 py-3 border-b bg-card flex items-center justify-between gap-4 flex-wrap">
                <div className="flex items-center gap-4">
                  <Button
                    onClick={handleSelectAll}
                    size="sm"
                    variant="outline"
                    className="border-primary/30 hover:bg-primary/10"
                  >
                    {allNonDuplicatesSelected ? (
                      <>
                        <CheckSquare className="mr-2 h-4 w-4" />
                        Deselect All
                      </>
                    ) : (
                      <>
                        <Square className="mr-2 h-4 w-4" />
                        Select All
                      </>
                    )}
                  </Button>
                  
                  <span className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{selectedTracks.size}</span> of {nonDuplicateTracks.length} selectable
                    {duplicateCount > 0 && (
                      <span className="ml-2 text-amber-600 dark:text-amber-400">
                        • {duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''} (auto-skipped)
                      </span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={showDuplicateOnly}
                      onCheckedChange={(checked) => setShowDuplicateOnly(checked === true)}
                    />
                    <span>Show duplicates only</span>
                  </label>
                </div>
              </div>
            );
          })()}

          {/* Track List */}
          {pendingData && (
            <ScrollArea className="flex-1 px-6 py-4">
              <div className="space-y-2">
                {pendingData.tracks
                  .filter(track => {
                    if (showDuplicateOnly) {
                      return isTrackDuplicate(track.id);
                    }
                    return true;
                  })
                  .map((track, index) => {
                    const isDuplicate = isTrackDuplicate(track.id);
                    const isSelected = selectedTracks.has(track.id);
                    
                    return (
                      <div
                        key={track.id}
                        className={`group relative flex items-center gap-4 p-3 rounded-lg border transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-md'
                            : isDuplicate
                            ? 'border-amber-500/30 bg-amber-500/5'
                            : 'border-border/50 hover:bg-accent/50 hover:border-primary/30'
                        }`}
                      >
                        {/* Checkbox - Disabled for duplicates */}
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => !isDuplicate && handleToggleTrack(track.id)}
                          disabled={isDuplicate}
                          className="h-5 w-5"
                        />

                        {/* Track Thumbnail */}
                        <div className="flex-shrink-0">
                          {track.imageUrl ? (
                            <img
                              src={track.imageUrl}
                              alt={track.name}
                              className="w-12 h-12 rounded-md object-cover shadow-sm"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-md bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                              <Music className="h-6 w-6 text-primary" />
                            </div>
                          )}
                        </div>

                        {/* Track Info */}
                        <div className="flex-1 min-w-0">
                          <h4 className="font-semibold text-sm line-clamp-1">{track.name}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-1">{track.artist}</p>
                          {track.album && (
                            <p className="text-xs text-muted-foreground/70 line-clamp-1">{track.album}</p>
                          )}
                        </div>

                        {/* Duration & Badges */}
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground font-mono">
                            {formatTrackDuration(track.duration)}
                          </span>
                          {isDuplicate && (
                            <span className="text-xs bg-amber-500/20 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full flex items-center gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              <span className="hidden sm:inline">Duplicate</span>
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </ScrollArea>
          )}

          {/* Footer Stats & Actions */}
          {pendingData && (() => {
            // Filter out duplicates from selected/all tracks
            const tracksToAdd = selectedTracks.size > 0 
              ? pendingData.tracks.filter(t => selectedTracks.has(t.id) && !isTrackDuplicate(t.id))
              : pendingData.tracks.filter(t => !isTrackDuplicate(t.id));
            const duplicateCount = (selectedTracks.size > 0 
              ? pendingData.tracks.filter(t => selectedTracks.has(t.id))
              : pendingData.tracks
            ).length - tracksToAdd.length;
            
            return (
              <div className="px-6 py-4 border-t bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {tracksToAdd.length} tracks
                  </span>
                  {' '}will be added
                  {duplicateCount > 0 && (
                    <span className="ml-2 text-amber-600 dark:text-amber-400">
                      ({duplicateCount} duplicate{duplicateCount !== 1 ? 's' : ''} skipped)
                    </span>
                  )}
                  {currentTracks && currentTracks.length > 0 && (
                    <span className="block mt-1 text-xs">
                      Total: <span className="font-medium text-foreground">
                        {currentTracks.length + tracksToAdd.length}
                      </span> tracks after merge
                    </span>
                  )}
                </div>

                <AlertDialogFooter className="gap-2 p-0">
                  <AlertDialogCancel onClick={handleCancelLoad} className="rounded-xl">
                    Cancel
                  </AlertDialogCancel>
                  
                  <AlertDialogAction
                    onClick={handleReplaceExisting}
                    className="bg-destructive/20 text-destructive hover:bg-destructive/30 border border-destructive/30 rounded-xl"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Replace All
                  </AlertDialogAction>

                  {selectedTracks.size > 0 && selectedTracks.size < pendingData.tracks.filter(t => !isTrackDuplicate(t.id)).length ? (
                    <AlertDialogAction
                      onClick={handleAddSelected}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add Selected ({selectedTracks.size})
                    </AlertDialogAction>
                  ) : (
                    <AlertDialogAction
                      onClick={handleAppendToExisting}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add All ({pendingData.tracks.filter(t => !isTrackDuplicate(t.id)).length})
                    </AlertDialogAction>
                  )}
                </AlertDialogFooter>
              </div>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
