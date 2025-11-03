import { useState, useEffect, useRef } from 'react';
import { Search, Loader2, Plus, Music, CheckSquare, Square, Play, Clock, User, Sparkles } from 'lucide-react';
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
  onUrlDetected?: (url: string) => void;
  initialSearchText?: string;
}

export function MusicSearch({ onAddTracks, onUrlDetected, initialSearchText }: MusicSearchProps) {
  const [searchQuery, setSearchQuery] = useState(initialSearchText || '');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isResultsOpen, setIsResultsOpen] = useState(false);
  const [isInvalidUrl, setIsInvalidUrl] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [currentQuery, setCurrentQuery] = useState('');
  const [currentLimit, setCurrentLimit] = useState(15);
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Update search query when initialSearchText prop changes
  useEffect(() => {
    if (initialSearchText) {
      setSearchQuery(initialSearchText);
    }
  }, [initialSearchText]);

  // Auto-focus and select the search input when entering search mode
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      try { inputRef.current.select(); } catch {}
    }
  }, [initialSearchText]);

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

  const handleAddTrack = (result: SearchResult) => {
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

    onAddTracks([track]);
    toast.success(`Added "${result.name}" to track list`);
  };

  const handleToggleSelect = (resultId: string) => {
    const newSelected = new Set(selectedResults);
    if (newSelected.has(resultId)) {
      newSelected.delete(resultId);
    } else {
      newSelected.add(resultId);
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
    toast.success(`Added ${selectedTracks.length} tracks to list`);
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

    onAddTracks(tracks);
    toast.success(`Added ${tracks.length} tracks to list`);
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

  return (
    <>
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
            className={`pl-8 sm:pl-9 text-sm sm:text-base h-10 sm:h-11 ${isInvalidUrl ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            disabled={isSearching}
            autoFocus
            ref={inputRef}
          />
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
        <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] h-[90vh] p-0 gap-0 overflow-hidden">
          <DialogHeader className="px-6 pt-6 pb-4 border-b bg-gradient-to-br from-primary/10 via-primary/5 to-accent/5 backdrop-blur-sm relative overflow-hidden">
            {/* Decorative background elements */}
            <div className="absolute inset-0 opacity-5">
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary rounded-full blur-3xl"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent rounded-full blur-3xl"></div>
            </div>
            
            <DialogTitle className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10">
              <div className="flex items-center gap-3">
                <div className="relative p-3 bg-gradient-to-br from-primary/20 to-primary/10 rounded-xl border border-primary/20 shadow-lg">
                  <Search className="w-6 h-6 text-primary" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse"></div>
                </div>
                <div>
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                    Search Results
                  </h3>
                  <p className="text-sm text-muted-foreground font-medium mt-0.5 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    "{currentQuery}"
                  </p>
                </div>
              </div>
              {searchResults.length > 0 && (
                <div className="flex gap-2 flex-wrap">
                  <Button 
                    onClick={handleSelectAll} 
                    size="sm" 
                    variant="outline"
                    className="border-primary/30 hover:bg-primary/10 hover:border-primary/50 transition-all shadow-sm hover:shadow-md"
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
                    className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={selectedResults.size === 0}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Selected ({selectedResults.size})
                  </Button>
                </div>
              )}
            </DialogTitle>
            <DialogDescription className="text-base font-medium relative z-10 flex items-center gap-2">
              <span className="px-3 py-1 bg-primary/10 rounded-full text-primary font-semibold">
                {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
              </span>
              {selectedResults.size > 0 && (
                <span className="px-3 py-1 bg-accent/20 rounded-full text-accent-foreground font-semibold">
                  {selectedResults.size} selected
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          <ScrollArea className="flex-1 px-6 py-4">
            {searchResults.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                <div className="relative p-8 bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl mb-6 border border-primary/20">
                  <Music className="h-20 w-20 text-primary/60" />
                  <div className="absolute -top-2 -right-2 w-6 h-6 bg-primary rounded-full animate-pulse"></div>
                </div>
                <p className="text-xl font-semibold mb-1">No results found</p>
                <p className="text-sm text-muted-foreground/80">Try a different search query or check your spelling</p>
              </div>
            ) : (
              <div className="space-y-3 pb-4">
                {searchResults.map((result, index) => {
                  const isSelected = selectedResults.has(result.id);
                  return (
                    <div
                      key={result.id}
                      className={`group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 sm:p-5 rounded-2xl border-2 transition-all duration-300 animate-fade-in backdrop-blur-sm ${
                        isSelected 
                          ? 'border-primary bg-gradient-to-br from-primary/15 via-primary/10 to-primary/5 shadow-xl shadow-primary/25 scale-[1.02]' 
                          : 'border-border/50 bg-card/80 hover:border-primary/40 hover:bg-accent/30 hover:shadow-xl hover:scale-[1.01]'
                      }`}
                      style={{ animationDelay: `${index * 20}ms` }}
                    >
                      {/* Selection Indicator Badge */}
                      {isSelected && (
                        <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary rounded-full flex items-center justify-center shadow-lg z-20 animate-bounce">
                          <CheckSquare className="w-5 h-5 text-primary-foreground" />
                        </div>
                      )}

                      {/* Thumbnail with Play Overlay */}
                      <div 
                        className="relative flex-shrink-0 cursor-pointer group/thumb"
                        onClick={() => handleToggleSelect(result.id)}
                      >
                        {result.imageUrl ? (
                          <div className="relative overflow-hidden rounded-xl shadow-lg group-hover/thumb:shadow-2xl transition-all duration-300">
                            <img
                              src={result.imageUrl}
                              alt={result.name}
                              className="w-24 h-24 sm:w-20 sm:h-20 object-cover group-hover/thumb:scale-110 transition-transform duration-300"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                              <div className="w-12 h-12 bg-primary/90 rounded-full flex items-center justify-center shadow-xl transform translate-y-2 group-hover/thumb:translate-y-0 transition-transform duration-300">
                                <Play className="w-6 h-6 text-primary-foreground ml-0.5" fill="currentColor" />
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="w-24 h-24 sm:w-20 sm:h-20 rounded-xl bg-gradient-to-br from-primary/30 via-primary/20 to-accent/20 flex items-center justify-center border-2 border-primary/20 shadow-lg">
                            <Music className="h-12 w-12 sm:h-10 sm:w-10 text-primary" />
                          </div>
                        )}
                        {/* Rank Badge */}
                        <div className="absolute -top-2 -left-2 w-7 h-7 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold shadow-lg border-2 border-background z-10">
                          {index + 1}
                        </div>
                      </div>

                      {/* Track Info */}
                      <div 
                        className="flex-1 min-w-0 space-y-2 cursor-pointer"
                        onClick={() => handleToggleSelect(result.id)}
                      >
                        <div>
                          <h4 className={`font-bold text-lg sm:text-base leading-tight line-clamp-2 transition-all duration-300 ${
                            isSelected ? 'text-primary' : 'text-foreground group-hover:text-primary'
                          }`}>
                            {result.name}
                          </h4>
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <User className="w-3.5 h-3.5" />
                              <span className="font-semibold">{result.artist}</span>
                            </div>
                          </div>
                          {result.album && result.album !== result.name && (
                            <p className="text-xs text-muted-foreground/70 line-clamp-1 flex items-center gap-1.5 mt-1.5">
                              <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                              {result.album}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Duration & Actions */}
                      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/50 rounded-full border border-border/50">
                          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm text-muted-foreground font-mono font-semibold">
                            {formatDuration(result.duration)}
                          </span>
                        </div>
                        <Button 
                          size="sm" 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAddTrack(result);
                          }}
                          className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-md hover:shadow-lg transition-all hover:scale-105 w-full sm:w-auto"
                        >
                          <Plus className="mr-1.5 h-4 w-4" />
                          <span className="font-semibold">Add</span>
                        </Button>
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
                      className="w-full sm:w-auto min-w-[280px] border-2 border-primary/30 hover:border-primary/50 hover:bg-gradient-to-r hover:from-primary/10 hover:to-accent/10 transition-all duration-300 shadow-md hover:shadow-lg hover:scale-105"
                    >
                      {isLoadingMore ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          <span className="font-semibold">Loading More Results...</span>
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-5 w-5" />
                          <span className="font-semibold">Load More Results</span>
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
            <div className="px-6 py-4 border-t bg-gradient-to-r from-muted/40 to-muted/20 backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-sm">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="font-semibold text-foreground flex items-center gap-2">
                  <Music className="w-4 h-4 text-primary" />
                  Showing {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'}
                </span>
                {selectedResults.size > 0 && (
                  <span className="px-3 py-1 bg-primary/20 text-primary rounded-full font-semibold flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5" />
                    {selectedResults.size} selected
                  </span>
                )}
              </div>
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
                Click tracks to select • Use checkboxes
              </span>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

