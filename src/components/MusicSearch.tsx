import { useState, useEffect } from 'react';
import { Search, Loader2, Plus, Music, CheckSquare, Square } from 'lucide-react';
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

  // Update search query when initialSearchText prop changes
  useEffect(() => {
    if (initialSearchText) {
      setSearchQuery(initialSearchText);
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
      downloadStatus: 'pending',
      downloadProgress: 0,
      selected: true,
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
        downloadStatus: 'pending' as const,
        downloadProgress: 0,
        selected: true,
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
      downloadStatus: 'pending',
      downloadProgress: 0,
      selected: true,
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
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search for songs, artists, albums..."
            value={searchQuery}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyPress={handleKeyPress}
            onPaste={handlePaste}
            className={`pl-9 ${isInvalidUrl ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
            disabled={isSearching}
          />
        </div>
        <Button onClick={handleSearch} disabled={isSearching || !searchQuery.trim() || isInvalidUrl}>
          {isSearching ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <Search className="mr-2 h-4 w-4" />
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
                <div className="flex gap-2">
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
                </div>
              )}
            </DialogTitle>
            <DialogDescription className="text-base font-medium">
              {searchResults.length} {searchResults.length === 1 ? 'result' : 'results'} found
              {selectedResults.size > 0 && ` • ${selectedResults.size} selected`}
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
                  return (
                    <div
                      key={result.id}
                      className={`group relative flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border transition-all duration-300 animate-fade-in ${
                        isSelected 
                          ? 'border-primary bg-primary/10 shadow-lg shadow-primary/20' 
                          : 'border-border/50 bg-card hover:bg-accent/50 hover:border-primary/30 hover:shadow-lg'
                      }`}
                      style={{ animationDelay: `${index * 30}ms` }}
                    >
                      {/* Checkbox */}
                      <div className="absolute top-3 right-3 sm:relative sm:top-0 sm:right-0 z-10">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => handleToggleSelect(result.id)}
                          className="h-5 w-5 border-2"
                        />
                      </div>

                      {/* Thumbnail */}
                      <div 
                        className="relative flex-shrink-0 cursor-pointer"
                        onClick={() => handleToggleSelect(result.id)}
                      >
                        {result.imageUrl ? (
                          <img
                            src={result.imageUrl}
                            alt={result.name}
                            className="w-20 h-20 sm:w-16 sm:h-16 rounded-lg object-cover shadow-md group-hover:shadow-xl transition-shadow"
                          />
                        ) : (
                          <div className="w-20 h-20 sm:w-16 sm:h-16 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                            <Music className="h-10 w-10 sm:h-8 sm:w-8 text-primary" />
                          </div>
                        )}
                        <div className="absolute -top-1 -left-1 w-6 h-6 bg-primary/90 text-primary-foreground rounded-full flex items-center justify-center text-xs font-bold shadow-md">
                          {index + 1}
                        </div>
                      </div>

                      {/* Track Info */}
                      <div 
                        className="flex-1 min-w-0 space-y-1 cursor-pointer"
                        onClick={() => handleToggleSelect(result.id)}
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
                        <span className="text-sm text-muted-foreground font-mono bg-muted/50 px-3 py-1 rounded-full">
                          {formatDuration(result.duration)}
                        </span>
                        <Button 
                          size="sm" 
                          onClick={() => handleAddTrack(result)}
                          className="bg-primary hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
                        >
                          <Plus className="mr-1 h-4 w-4" />
                          Add
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

