import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Loader2, Plus, Music, CheckSquare, Square, Play, Clock, History, Sparkles, Zap, X, Trash2, Mic, CheckCircle2, ExternalLink } from 'lucide-react';
import { searchMusic, SearchResult } from '@/services/api';
import { Track } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

interface MusicSearchProps {
  onAddTracks: (tracks: Track[]) => void;
  onAddTracksAndPlay?: (track: Track) => void;
  onCheckPlayingState?: () => { isPlaying: boolean; isPlayerReady: boolean };
  onUrlDetected?: (url: string) => void;
  initialSearchText?: string;
  currentTracks?: Track[]; // To check for duplicates
}

export function MusicSearch({ onAddTracks, onAddTracksAndPlay, onCheckPlayingState, onUrlDetected, initialSearchText, currentTracks = [] }: MusicSearchProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearchText || '');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [isInvalidUrl, setIsInvalidUrl] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentLimit, setCurrentLimit] = useState(15);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [previewTrackId, setPreviewTrackId] = useState<string | null>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [isListening, setIsListening] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Update search query when initialSearchText prop changes
  useEffect(() => {
    if (initialSearchText) {
      setSearchQuery(initialSearchText);
    }
  }, [initialSearchText]);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('music-search-history');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch {}
    }
  }, []);

  // Save recent searches
  const saveSearchToHistory = useCallback((query: string) => {
    if (!query.trim()) return;
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem('music-search-history', JSON.stringify(updated));
  }, [recentSearches]);

  // Remove a search from history
  const removeSearchFromHistory = useCallback((search: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const updated = recentSearches.filter(s => s !== search);
    setRecentSearches(updated);
    localStorage.setItem('music-search-history', JSON.stringify(updated));
    toast.success('Removed from history');
  }, [recentSearches]);

  // Clear all recent searches
  const clearRecentSearches = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches([]);
    localStorage.setItem('music-search-history', JSON.stringify([]));
    toast.success('Recent searches cleared');
  }, []);

  // Check if track already exists in playlist
  const isTrackInPlaylist = useCallback((trackId: string): boolean => {
    return currentTracks.some(t => t.id === trackId);
  }, [currentTracks]);

  // Filter duplicates from tracks
  const filterDuplicates = useCallback((tracks: Track[]): Track[] => {
    const existingIds = new Set(currentTracks.map(t => t.id));
    return tracks.filter(t => !existingIds.has(t.id));
  }, [currentTracks]);

  // Open track in new tab (Spotify or YouTube)
  const handleOpenTrack = useCallback((result: SearchResult) => {
    if (result.url) {
      window.open(result.url, '_blank', 'noopener,noreferrer');
      toast.info(`Opening "${result.name}" in new tab`, { duration: 1500 });
    } else {
      // Fallback: try to construct YouTube URL from ID
      const youtubeId = result.id.replace('search-', '');
      if (youtubeId) {
        const youtubeUrl = `https://www.youtube.com/watch?v=${youtubeId}`;
        window.open(youtubeUrl, '_blank', 'noopener,noreferrer');
        toast.info(`Opening "${result.name}" on YouTube`, { duration: 1500 });
      } else {
        toast.error('No URL available for this track');
      }
    }
  }, []);

  // Voice search functionality
  const startVoiceSearch = useCallback(async () => {
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      toast.error('Voice search not supported in your browser');
      return;
    }

    const SpeechRecognition = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      toast.info('Listening... Speak now', { duration: 2000 });
    };

    recognition.onresult = async (event: any) => {
      const transcript = event.results[0][0].transcript;
      setSearchQuery(transcript);
      setIsListening(false);
      recognitionRef.current = null;
      toast.success('Search query set', { duration: 1000 });
      
      // Auto-search after voice input
      const query = transcript.trim();
      if (!query) return;
      
      setIsSearching(true);
      try {
        const initialLimit = 15;
        const response = await searchMusic(query, initialLimit);
        setSearchResults(response.results);
        setCurrentQuery(query);
        setCurrentLimit(initialLimit);
        setSelectedResults(new Set(response.results.map(r => r.id)));
        setIsResultsOpen(true);
        saveSearchToHistory(query);
        
        if (response.results.length === 0) {
          toast.info('No results found');
        } else {
          toast.success(`Found ${response.results.length} results`);
        }
      } catch (error) {
        console.error('Search error:', error);
        toast.error('Failed to search. Please try again.');
      } finally {
        setIsSearching(false);
      }
    };

    recognition.onerror = (event: any) => {
      console.error('Speech recognition error:', event.error);
      setIsListening(false);
      recognitionRef.current = null;
      if (event.error === 'no-speech') {
        toast.error('No speech detected. Try again.');
      } else {
        toast.error('Voice search error. Please try again.');
      }
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [saveSearchToHistory]);

  const stopVoiceSearch = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      setIsListening(false);
    }
  }, []);

  // Auto-focus and select the search input when entering search mode
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      try { inputRef.current.select(); } catch {}
    }
  }, [initialSearchText]);

  // Keyboard shortcuts - needs to be after handleAddSelected and handleSelectAll are defined
  // So we'll define it after those functions

  // Check if input is a URL
  const isValidMusicUrl = (text: string): boolean => {
    const urlPatterns = [
      /^https?:\/\/open\.spotify\.com\/(track|playlist|album|artist)\/[a-zA-Z0-9]+/,
      /^spotify:(track|playlist|album|artist):[a-zA-Z0-9]+/,
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/,
      /^https?:\/\/youtu\.be\/[a-zA-Z0-9_-]+/,
      /^https?:\/\/music\.youtube\.com\/watch\?v=[a-zA-Z0-9_-]+/,
      /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=[a-zA-Z0-9_-]+/,
      /^https?:\/\/music\.youtube\.com\/playlist\?list=[a-zA-Z0-9_-]+/,
    ];
    return urlPatterns.some(pattern => pattern.test(text.trim()));
  };

  // Check if text looks like a URL but isn't supported
  const isUnsupportedUrl = (text: string): boolean => {
    const trimmed = text.trim();
    // Check if it looks like a URL
    const urlPattern = /^https?:\/\//i;
    if (!urlPattern.test(trimmed)) return false;
    
    // If it's a URL but not a valid music URL, it's unsupported
    return !isValidMusicUrl(trimmed);
  };

  // Update validation when search query changes
  const handleQueryChange = (value: string) => {
    setSearchQuery(value);
    setIsInvalidUrl(isUnsupportedUrl(value));
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    // Block unsupported URLs
    if (isInvalidUrl) {
      toast.error('Unsupported URL', {
        description: 'Only Spotify (track/playlist/album/artist) and YouTube (video/playlist) URLs are supported'
      });
      return;
    }

    // Check if user pasted a URL
    if (isValidMusicUrl(searchQuery)) {
      if (onUrlDetected) {
        onUrlDetected(searchQuery.trim());
        setSearchQuery('');
        setIsInvalidUrl(false);
      }
      return;
    }

    setIsSearching(true);
    try {
      const initialLimit = 15;
      const response = await searchMusic(searchQuery.trim(), initialLimit);
      setSearchResults(response.results);
      setCurrentQuery(searchQuery.trim());
      setCurrentLimit(initialLimit);
      // Select all results by default
      setSelectedResults(new Set(response.results.map(r => r.id)));
      setIsResultsOpen(true);
      saveSearchToHistory(searchQuery.trim());
      
      if (response.results.length === 0) {
        toast.info('No results found');
      } else {
        toast.success(`Found ${response.results.length} results`);
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Failed to search. Please try again.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleLoadMore = async () => {
    if (!currentQuery) return;
    
    setIsLoadingMore(true);
    try {
      // Increase limit by 15 each time
      const newLimit = currentLimit + 15;
      const response = await searchMusic(currentQuery, newLimit);
      
      // Since we're fetching with a higher limit, we get all results including previous ones
      // Just replace the entire results array
      if (response.results.length > searchResults.length) {
        setSearchResults(response.results);
        setCurrentLimit(newLimit);
        
        // Auto-select new results
        const newSelected = new Set(selectedResults);
        response.results.forEach(result => {
          if (!newSelected.has(result.id)) {
            newSelected.add(result.id);
          }
        });
        setSelectedResults(newSelected);
        
        const newCount = response.results.length - searchResults.length;
        toast.success(`Added ${newCount} more results (Total: ${response.results.length})`);
      } else {
        toast.info('No more results available');
      }
    } catch (error) {
      console.error('Load more error:', error);
      toast.error('Failed to load more results');
    } finally {
      setIsLoadingMore(false);
    }
  };

  const handleAddTrack = (result: SearchResult, playNext = false) => {
    // Check if track already exists
    if (isTrackInPlaylist(result.id)) {
      toast.warning(`"${result.name}" is already in your playlist`, {
        description: 'Duplicate track not added'
      });
      return;
    }

    const track: Track = {
      id: result.id,
      name: result.name,
      artist: result.artist,
      album: result.album,
      duration: result.duration,
      imageUrl: result.imageUrl,
      url: result.url,
      downloadStatus: undefined,
      downloadProgress: undefined,
      selected: false,
    };

    if (playNext && onAddTracksAndPlay) {
      // Add track and play it immediately (Play button)
      onAddTracks([track]);
      // Small delay to ensure track is added to list first
      setTimeout(() => {
        onAddTracksAndPlay(track);
      }, 100);
      toast.success(`Added "${result.name}" and playing now`, {
        description: 'Track added and started playing'
      });
    } else {
      // Just add track - NEVER auto-play (Add button only)
    onAddTracks([track]);
    toast.success(`Added "${result.name}" to track list`);
    }
    
    // Remove from selection
    const newSelected = new Set(selectedResults);
    newSelected.delete(result.id);
    setSelectedResults(newSelected);
  };

  const handleToggleSelect = (resultId: string, shiftKey = false) => {
    const newSelected = new Set(selectedResults);
    
    if (shiftKey && selectedResults.size > 0) {
      // Multi-select range
      const resultIds = searchResults.map(r => r.id);
      const lastSelectedIndex = resultIds.findIndex(id => selectedResults.has(id));
      const currentIndex = resultIds.indexOf(resultId);
      
      if (lastSelectedIndex !== -1 && currentIndex !== -1) {
        const start = Math.min(lastSelectedIndex, currentIndex);
        const end = Math.max(lastSelectedIndex, currentIndex);
        for (let i = start; i <= end; i++) {
          newSelected.add(resultIds[i]);
        }
      } else {
        if (newSelected.has(resultId)) {
          newSelected.delete(resultId);
        } else {
          newSelected.add(resultId);
        }
      }
    } else {
    if (newSelected.has(resultId)) {
      newSelected.delete(resultId);
    } else {
      newSelected.add(resultId);
    }
    }
    
    setSelectedResults(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedResults.size === searchResults.length) {
      // Deselect all
      setSelectedResults(new Set());
    } else {
      // Select all
      setSelectedResults(new Set(searchResults.map(r => r.id)));
    }
  };

  const handleAddSelected = () => {
    if (selectedResults.size === 0) {
      toast.error('Please select at least one track');
      return;
    }

    const selectedTracks = searchResults
      .filter(result => selectedResults.has(result.id))
      .map((result) => ({
        id: result.id,
        name: result.name,
        artist: result.artist,
        album: result.album,
        duration: result.duration,
        imageUrl: result.imageUrl,
        url: result.url,
        downloadStatus: undefined,
        downloadProgress: undefined,
        selected: false,
      }));

    onAddTracks(selectedTracks);
    toast.success(`Added ${selectedTracks.length} tracks to list`, {
      description: `${selectedTracks.length} track${selectedTracks.length > 1 ? 's' : ''} added successfully`
    });
    setSelectedResults(new Set());
    setIsResultsOpen(false);
  };

  const handleAddAll = () => {
    const tracks: Track[] = searchResults.map((result) => ({
      id: result.id,
      name: result.name,
      artist: result.artist,
      album: result.album,
      duration: result.duration,
      imageUrl: result.imageUrl,
      url: result.url,
      downloadStatus: undefined,
      downloadProgress: undefined,
      selected: false,
    }));

    // Filter out duplicates
    const uniqueTracks = filterDuplicates(tracks);
    const duplicateCount = tracks.length - uniqueTracks.length;

    if (uniqueTracks.length === 0) {
      toast.warning('All tracks are already in your playlist', {
        description: 'No new tracks to add'
      });
      return;
    }

    onAddTracks(uniqueTracks);
    
    if (duplicateCount > 0) {
      toast.success(`Added ${uniqueTracks.length} tracks to list`, {
        description: `${duplicateCount} duplicate${duplicateCount !== 1 ? 's' : ''} skipped`
      });
    } else {
      toast.success(`Added ${uniqueTracks.length} tracks to list`);
    }
    setIsResultsOpen(false);
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (isValidMusicUrl(pastedText) && onUrlDetected) {
      e.preventDefault();
      onUrlDetected(pastedText.trim());
      setSearchQuery('');
      setIsInvalidUrl(false);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    if (!isResultsOpen) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter to add selected tracks
      if (e.key === 'Enter' && e.ctrlKey) {
        e.preventDefault();
        handleAddSelected();
      }
      // Escape to close
      if (e.key === 'Escape') {
        setIsResultsOpen(false);
      }
      // 'a' to select all
      if (e.key === 'a' && e.ctrlKey) {
        e.preventDefault();
        handleSelectAll();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isResultsOpen, selectedResults, searchResults, handleAddSelected, handleSelectAll]);

  return (
    <>
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <div className="relative flex-1">
            <Search className="absolute left-2 sm:left-3 top-1/2 h-3.5 w-3.5 sm:h-4 sm:w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for songs, artists, albums..."
            value={searchQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyPress={handleKeyPress}
            onPaste={handlePaste}
              className={`pl-8 sm:pl-9 pr-10 sm:pr-12 text-sm sm:text-base h-10 sm:h-11 ${isInvalidUrl ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
              disabled={isSearching || isListening}
              autoFocus
              ref={inputRef}
            />
            {/* Voice Search Button */}
            <button
              onClick={isListening ? stopVoiceSearch : startVoiceSearch}
              className={`absolute right-2 sm:right-3 top-1/2 -translate-y-1/2 p-1.5 rounded-md transition-all ${
                isListening 
                  ? 'bg-red-500/20 text-red-500 animate-pulse' 
                  : 'text-muted-foreground hover:text-primary hover:bg-primary/10'
              }`}
              title={isListening ? 'Stop voice search' : 'Voice search'}
            disabled={isSearching}
            >
              <Mic className={`h-3.5 w-3.5 sm:h-4 sm:w-4 ${isListening ? 'animate-pulse' : ''}`} />
            </button>
        </div>
          <Button 
            onClick={handleSearch} 
            disabled={isSearching || !searchQuery.trim() || isInvalidUrl}
            className="h-10 sm:h-11 w-full sm:w-auto px-4 sm:px-6"
          >
          {isSearching ? (
            <>
                <Loader2 className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                <span className="hidden sm:inline">Searching...</span>
                <span className="sm:hidden">Searching</span>
            </>
          ) : (
            <>
                <Search className="mr-2 h-3.5 w-3.5 sm:h-4 sm:w-4" />
              Search
            </>
          )}
        </Button>
        </div>

        {/* Recent Searches - Always Visible as Pill Tags */}
        {recentSearches.length > 0 && (
          <div className="w-full space-y-4 animate-in fade-in slide-in-from-top-2 duration-300">
            {/* Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Recent Searches</span>
                <span className="text-xs text-muted-foreground/70 bg-muted/50 px-2 py-0.5 rounded-full">
                  {recentSearches.length}
                </span>
              </div>
              <button
                onClick={clearRecentSearches}
                className="text-xs text-muted-foreground hover:text-destructive transition-colors px-2 py-1 rounded-md hover:bg-destructive/10 flex items-center gap-1.5"
                title="Clear all"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Clear All</span>
              </button>
            </div>
            
            {/* Pill Tags - Flex wrap layout, size adapts to keyword length */}
            <div className="flex flex-wrap gap-2.5 max-w-full">
              {recentSearches.map((search, idx) => {
                // Calculate pill size based on keyword length - more adaptive sizing
                const searchLength = search.length;
                let textSize, paddingX, paddingY;
                
                if (searchLength <= 10) {
                  textSize = 'text-sm';
                  paddingX = 'px-4';
                  paddingY = 'py-2.5';
                } else if (searchLength <= 20) {
                  textSize = 'text-sm';
                  paddingX = 'px-3.5';
                  paddingY = 'py-2.5';
                } else if (searchLength <= 30) {
                  textSize = 'text-xs';
                  paddingX = 'px-3.5';
                  paddingY = 'py-2';
                } else {
                  textSize = 'text-xs';
                  paddingX = 'px-3';
                  paddingY = 'py-2';
                }
                
                return (
                  <div
                    key={idx}
                    className={`group relative inline-flex items-center gap-2 ${paddingX} ${paddingY} ${textSize} bg-gradient-to-br from-muted/50 via-muted/40 to-muted/30 border border-border/50 rounded-full hover:border-primary/40 hover:bg-gradient-to-br hover:from-primary/10 hover:via-primary/5 hover:to-accent/5 transition-all duration-200 hover:shadow-md hover:shadow-primary/10 hover:scale-105 cursor-pointer min-w-fit max-w-full`}
                    onClick={() => {
                      setSearchQuery(search);
                      // Auto-search immediately - no delay
                      handleSearch();
                    }}
                  >
                    <Search className="h-3.5 w-3.5 text-primary/70 group-hover:text-primary transition-colors flex-shrink-0" />
                    <span className="font-medium text-foreground group-hover:text-primary transition-colors whitespace-nowrap">
                      {search}
                    </span>
                    <button
                      onClick={(e) => removeSearchFromHistory(search, e)}
                      className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 rounded-full hover:bg-destructive/20 text-muted-foreground hover:text-destructive flex-shrink-0"
                      title="Remove"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Invalid URL Warning */}
      {isInvalidUrl && searchQuery.trim() && (
        <div className="mt-2 text-sm text-red-500 flex items-center gap-2">
          <span className="font-semibold">⚠️ Unsupported URL</span>
          <span className="text-muted-foreground">
            Only Spotify & YouTube URLs are supported
          </span>
        </div>
      )}

      <Dialog open={isResultsOpen} onOpenChange={setIsResultsOpen}>
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] h-[90vh] p-0 gap-0">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-r from-primary/5 to-accent/5">
            <DialogTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <Search className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold">Search Results</h3>
                  <p className="text-sm text-muted-foreground font-normal">"{currentQuery}"</p>
                </div>
              </div>
              {searchResults.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <Button 
                    onClick={handleSelectAll} 
                    size="sm" 
                    variant="outline"
                    className="border-primary/30 hover:bg-primary/10"
                  >
                    {selectedResults.size === searchResults.length ? (
                      <><CheckSquare className="mr-2 h-4 w-4" /> Deselect All</>
                    ) : (
                      <><Square className="mr-2 h-4 w-4" /> Select All</>
                    )}
                  </Button>
                  <Button 
                    onClick={handleAddSelected} 
                    size="sm" 
                    className="bg-primary hover:bg-primary/90 shadow-glow"
                    disabled={selectedResults.size === 0}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Selected ({selectedResults.size})
                  </Button>
                  <Button 
                    onClick={handleAddAll} 
                    size="sm" 
                    variant="outline"
                    className="border-accent/30 hover:bg-accent/10"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Add All
                  </Button>
                </div>
              )}
            </DialogTitle>
            <DialogDescription className="text-base font-medium flex items-center justify-between">
              <span>
              {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} found
              {selectedResults.size > 0 && ` • ${selectedResults.size} selected`}
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                Ctrl+Enter: Add Selected • Ctrl+A: Select All • Shift+Click: Multi-select
              </span>
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            {searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <div className="p-6 bg-muted/30 rounded-full mb-6">
                  <Music className="h-16 w-16" />
                </div>
                <p className="text-lg font-medium">No results found</p>
                <p className="text-sm mt-2">Try a different search query</p>
              </div>
            ) : (
              <div className="space-y-3">
                {searchResults.map((result, index) => {
                  const isSelected = selectedResults.has(result.id);
                  const isPreviewing = previewTrackId === result.id;
                  const isInPlaylist = isTrackInPlaylist(result.id);
                  return (
                    <div
                      key={result.id}
                      className={`group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border transition-all duration-300 animate-fade-in ${
                        isSelected 
                          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20 scale-[1.02]' 
                          : isInPlaylist
                          ? 'border-amber-500/30 bg-amber-500/5'
                          : 'border-border/50 bg-card hover:bg-accent/50 hover:border-primary/30 hover:shadow-lg hover:scale-[1.01]'
                      }`}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      {/* Already in Playlist Badge */}
                      {isInPlaylist && (
                        <div className="absolute top-2 left-2 z-20 flex items-center gap-1 bg-amber-500/90 text-amber-50 px-2 py-1 rounded-full text-xs font-semibold shadow-md">
                          <CheckCircle2 className="h-3 w-3" />
                          <span className="hidden sm:inline">In Playlist</span>
                        </div>
                      )}
                      {/* Checkbox */}
                      <div className="absolute top-3 right-3 sm:relative sm:top-0 sm:right-0 z-10">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => {
                            handleToggleSelect(result.id);
                          }}
                          className="h-5 w-5 border-2"
                        />
                      </div>

                      {/* Thumbnail with Play Preview */}
                      <div 
                        className="relative flex-shrink-0 cursor-pointer group/thumb"
                        onClick={() => handleToggleSelect(result.id)}
                        onMouseEnter={() => setPreviewTrackId(result.id)}
                        onMouseLeave={() => setPreviewTrackId(null)}
                      >
                        {result.imageUrl ? (
                          <img
                            src={result.imageUrl}
                            alt={result.name}
                            className="w-20 h-20 sm:w-16 sm:h-16 rounded-lg object-cover shadow-md group-hover/thumb:shadow-xl transition-all duration-300"
                          />
                        ) : (
                          <div className="w-20 h-20 sm:w-16 sm:h-16 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                            <Music className="h-10 w-10 sm:h-8 sm:w-8 text-primary" />
                          </div>
                        )}
                        {isPreviewing && (
                          <div className="absolute inset-0 bg-black/50 rounded-lg flex items-center justify-center transition-opacity duration-300">
                            <Play className="h-6 w-6 text-white fill-white" />
                          </div>
                        )}
                        <div className="absolute -top-1 -left-1 w-6 h-6 bg-primary/90 text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold shadow-md">
                          {index + 1}
                        </div>
                      </div>

                      {/* Track Info */}
                      <div 
                        className="flex-1 min-w-0 space-y-1 cursor-pointer"
                        onClick={(e) => {
                          if (e.shiftKey) {
                            handleToggleSelect(result.id, true);
                          } else {
                            handleToggleSelect(result.id);
                          }
                        }}
                      >
                        <h4 className={`font-semibold text-base leading-tight line-clamp-1 transition-colors ${
                          isSelected ? 'text-primary' : 'group-hover:text-primary'
                        }`}>
                          {result.name}
                        </h4>
                        <p className="text-sm text-muted-foreground line-clamp-1 flex items-center gap-2">
                          <span className="font-medium">{result.artist}</span>
                        </p>
                        {result.album && result.album !== result.name && (
                          <p className="text-xs text-muted-foreground/80 line-clamp-1 flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-muted-foreground/50"></span>
                            {result.album}
                          </p>
                        )}
                      </div>

                      {/* Duration & Actions */}
                      <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                        <span className="text-sm text-muted-foreground font-mono bg-muted/50 px-3 py-1 rounded-full flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {formatDuration(result.duration)}
                        </span>
                        <div className="flex gap-2">
                          {/* Open in New Tab Button */}
                          <Button 
                            size="sm" 
                            onClick={() => handleOpenTrack(result)}
                            variant="outline"
                            className="border-primary/30 hover:bg-primary/10 hover:border-primary/50"
                            title="Open in new tab (Spotify/YouTube)"
                          >
                            <ExternalLink className="mr-1 h-4 w-4" />
                            <span className="hidden sm:inline text-xs">Open</span>
                          </Button>
                        <Button 
                          size="sm" 
                            onClick={() => handleAddTrack(result, false)}
                          className="bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                            title={isInPlaylist ? 'Already in playlist' : 'Add to list'}
                            disabled={isInPlaylist}
                        >
                          <Plus className="mr-1 h-4 w-4" />
                            <span className="hidden sm:inline">Add</span>
                          </Button>
                          <Button 
                            size="sm" 
                            onClick={() => handleAddTrack(result, true)}
                            variant="outline"
                            className="border-accent/30 hover:bg-accent/10 hover:border-accent/50"
                            title={isInPlaylist ? 'Already in playlist' : 'Add and play now'}
                            disabled={isInPlaylist}
                          >
                            <Zap className="mr-1 h-4 w-4" />
                            <span className="hidden sm:inline text-xs">Play</span>
                        </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
                
                {/* Load More Button */}
                {searchResults.length > 0 && (
                  <div className="flex justify-center pt-6 pb-2">
                    <Button 
                      onClick={handleLoadMore} 
                      disabled={isLoadingMore}
                      variant="outline"
                      size="lg"
                      className="w-full sm:w-auto min-w-[250px] border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300"
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Loading More Results...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-5 w-5" />
                          Load More Results
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
          
          {/* Footer with stats */}
          {searchResults.length > 0 && (
            <div className="px-6 py-3 border-t bg-muted/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-sm text-muted-foreground">
              <span className="font-medium">
                Showing {searchResults.length} results
                {selectedResults.size > 0 && (
                  <span className="ml-2 text-primary">• {selectedResults.size} selected</span>
                )}
              </span>
              <span className="text-xs">Click tracks to select • Use checkboxes</span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

