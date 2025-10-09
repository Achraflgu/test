import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  History, 
  Music2, 
  Trash2, 
  Clock, 
  Play,
  Search,
  FolderOpen,
  Star,
  StarOff,
  Edit2,
  Check,
  X,
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';

interface SavedPlaylist {
  id: string;
  name: string;
  url: string;
  imageUrl: string;
  trackCount: number;
  owner?: string;
  savedAt: number;
  lastLoaded?: number;
  isFavorite?: boolean;
  description?: string;
  tracks?: any[];  // Store the actual tracks
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onLoadPlaylist: (playlist: SavedPlaylist) => void;
}

const STORAGE_KEY = 'saved-playlists';
const MAX_PLAYLISTS = 50; // Limit to prevent localStorage overflow

// Helper to load playlists from localStorage
const loadPlaylists = (): SavedPlaylist[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch (error) {
    console.error('Failed to load saved playlists:', error);
    return [];
  }
};

export default function SavedPlaylists({ open, onOpenChange, onLoadPlaylist }: Props) {
  const [savedPlaylists, setSavedPlaylists] = useState<SavedPlaylist[]>(loadPlaylists);

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'recent' | 'name' | 'tracks'>('recent');
  
  // Edit mode state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);

  // Refresh playlists when dialog opens
  useEffect(() => {
    if (open) {
      const refreshedPlaylists = loadPlaylists();
      setSavedPlaylists(refreshedPlaylists);
    }
  }, [open]);

  // Save playlists to localStorage
  const savePlaylists = (playlists: SavedPlaylist[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
      setSavedPlaylists(playlists);
      // Dispatch custom event for live count updates
      window.dispatchEvent(new Event('playlistsSaved'));
    } catch (error) {
      console.error('Failed to save playlists:', error);
      toast.error('Failed to save playlists');
    }
  };

  // Delete a playlist
  const deletePlaylist = (id: string) => {
    const updated = savedPlaylists.filter(p => p.id !== id);
    savePlaylists(updated);
    toast.success('Playlist removed from history');
  };

  // Toggle favorite
  const toggleFavorite = (id: string) => {
    const updated = savedPlaylists.map(p => 
      p.id === id ? { ...p, isFavorite: !p.isFavorite } : p
    );
    savePlaylists(updated);
  };

  // Load a playlist
  const handleLoadPlaylist = (playlist: SavedPlaylist) => {
    // Update last loaded time
    const updated = savedPlaylists.map(p => 
      p.id === playlist.id ? { ...p, lastLoaded: Date.now() } : p
    );
    savePlaylists(updated);
    
    onLoadPlaylist(playlist);
    onOpenChange(false);
    toast.success(`Loaded: ${playlist.name}`, {
      description: `${playlist.trackCount} tracks restored`
    });
  };

  // Clear all playlists
  const clearAll = () => {
    if (confirm('Are you sure you want to clear all saved playlists?')) {
      savePlaylists([]);
      toast.success('All playlists cleared');
    }
  };

  // Start editing a playlist
  const startEditing = (playlist: SavedPlaylist) => {
    setEditingId(playlist.id);
    setEditName(playlist.name);
    setEditImageUrl(playlist.imageUrl);
    setImageFile(null);
  };

  // Cancel editing
  const cancelEditing = () => {
    setEditingId(null);
    setEditName('');
    setEditImageUrl('');
    setImageFile(null);
  };

  // Handle image file upload
  const handleImageFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Please select an image file');
        return;
      }
      
      // Convert to base64 for storage
      const reader = new FileReader();
      reader.onloadend = () => {
        setEditImageUrl(reader.result as string);
        setImageFile(file);
      };
      reader.readAsDataURL(file);
    }
  };

  // Save edits
  const saveEdits = () => {
    if (!editingId || !editName.trim()) {
      toast.error('Playlist name cannot be empty');
      return;
    }

    const updated = savedPlaylists.map(p => 
      p.id === editingId 
        ? { ...p, name: editName.trim(), imageUrl: editImageUrl.trim() || p.imageUrl }
        : p
    );
    savePlaylists(updated);
    cancelEditing();
    toast.success('Playlist updated!');
  };

  // Filter and sort playlists
  const filteredPlaylists = savedPlaylists
    .filter(p => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        p.name.toLowerCase().includes(query) ||
        p.owner?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      );
    })
    .sort((a, b) => {
      if (a.isFavorite !== b.isFavorite) {
        return a.isFavorite ? -1 : 1;
      }
      
      switch (sortBy) {
        case 'recent':
          return (b.lastLoaded || b.savedAt) - (a.lastLoaded || a.savedAt);
        case 'name':
          return a.name.localeCompare(b.name);
        case 'tracks':
          return b.trackCount - a.trackCount;
        default:
          return 0;
      }
    });

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    
    return date.toLocaleDateString();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[85vh] p-0 gap-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 rounded-lg">
                <History className="w-6 h-6 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-2xl font-bold">Saved Playlists</DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {savedPlaylists.length} saved • {filteredPlaylists.length} shown
                </p>
              </div>
            </div>
            
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAll}
              disabled={savedPlaylists.length === 0}
              className="text-destructive hover:text-destructive hover:bg-destructive/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Clear All
            </Button>
          </div>
        </DialogHeader>

        {/* Search & Sort Bar */}
        <div className="px-6 py-3 border-b bg-secondary/30 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search playlists..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Button
              variant={sortBy === 'recent' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('recent')}
            >
              <Clock className="w-4 h-4 mr-2" />
              Recent
            </Button>
            <Button
              variant={sortBy === 'name' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('name')}
            >
              A-Z
            </Button>
            <Button
              variant={sortBy === 'tracks' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSortBy('tracks')}
            >
              <Music2 className="w-4 h-4 mr-2" />
              Tracks
            </Button>
          </div>
        </div>

        {/* Playlist List */}
        <ScrollArea className="flex-1 p-6">
          {filteredPlaylists.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12 text-center">
              <div className="p-4 bg-secondary/50 rounded-full mb-4">
                <FolderOpen className="w-12 h-12 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold mb-2">
                {savedPlaylists.length === 0 ? 'No Saved Playlists' : 'No Results'}
              </h3>
              <p className="text-sm text-muted-foreground max-w-md">
                {savedPlaylists.length === 0 
                  ? 'Load a playlist to automatically save it to your history'
                  : 'Try a different search term'
                }
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPlaylists.map((playlist) => {
                const isEditing = editingId === playlist.id;
                
                return (
                  <Card
                    key={playlist.id}
                    className={`group relative overflow-hidden transition-all duration-300 ${
                      isEditing 
                        ? 'shadow-2xl shadow-primary/30 scale-105 ring-2 ring-primary' 
                        : 'hover:shadow-xl hover:shadow-primary/20 hover:scale-[1.02] cursor-pointer'
                    }`}
                  >
                    {/* Playlist Image */}
                    <div className="relative aspect-square overflow-hidden bg-secondary">
                      <img
                        src={isEditing ? (editImageUrl || playlist.imageUrl) : playlist.imageUrl}
                        alt={playlist.name}
                        className={`w-full h-full object-cover transition-transform duration-300 ${
                          isEditing ? '' : 'group-hover:scale-110'
                        }`}
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = '/placeholder.svg';
                        }}
                      />
                      
                      {/* Edit Image Overlay */}
                      {isEditing && (
                        <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
                          <div className="w-full space-y-2">
                            <label className="text-xs text-white/80 flex items-center gap-1 mb-1">
                              <ImageIcon className="w-3 h-3" />
                              Image URL or File
                            </label>
                            <Input
                              value={editImageUrl}
                              onChange={(e) => setEditImageUrl(e.target.value)}
                              placeholder="Enter image URL or upload below..."
                              className="text-xs h-8 bg-background/90"
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div className="relative">
                              <Input
                                type="file"
                                accept="image/*"
                                onChange={handleImageFileChange}
                                className="text-xs h-8 bg-background/90 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 cursor-pointer"
                                onClick={(e) => e.stopPropagation()}
                              />
                              {imageFile && (
                                <span className="text-[10px] text-green-400 mt-1 block">
                                  ✓ {imageFile.name} uploaded
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Overlay with Play Button */}
                      {!isEditing && (
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Button
                            size="lg"
                            onClick={() => handleLoadPlaylist(playlist)}
                            className="rounded-full w-14 h-14 shadow-lg"
                          >
                            <Play className="w-6 h-6 ml-0.5" />
                          </Button>
                        </div>
                      )}

                      {/* Favorite Badge */}
                      {playlist.isFavorite && !isEditing && (
                        <div className="absolute top-2 right-2 bg-yellow-500/90 backdrop-blur-sm rounded-full p-1.5">
                          <Star className="w-4 h-4 text-white fill-white" />
                        </div>
                      )}
                    </div>

                    {/* Playlist Info */}
                    <div className="p-4">
                      {isEditing ? (
                        <div className="space-y-3 mb-3">
                          <div>
                            <label className="text-xs text-muted-foreground mb-1 block">
                              Playlist Name
                            </label>
                            <Input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Enter playlist name..."
                              className="text-sm font-semibold"
                              onClick={(e) => e.stopPropagation()}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveEdits();
                                if (e.key === 'Escape') cancelEditing();
                              }}
                              autoFocus
                            />
                          </div>
                        </div>
                      ) : (
                        <>
                          <h3 className="font-bold text-base truncate mb-1 group-hover:text-primary transition-colors">
                            {playlist.name}
                          </h3>
                          
                          {playlist.owner && (
                            <p className="text-xs text-muted-foreground truncate mb-2">
                              By {playlist.owner}
                            </p>
                          )}
                        </>
                      )}

                      <div className="flex items-center justify-between text-xs text-muted-foreground mb-3">
                        <span className="flex items-center gap-1">
                          <Music2 className="w-3 h-3" />
                          {playlist.trackCount} tracks
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {formatDate(playlist.lastLoaded || playlist.savedAt)}
                        </span>
                      </div>

                      {/* Actions */}
                      {isEditing ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={saveEdits}
                            className="flex-1 bg-green-600 hover:bg-green-700"
                          >
                            <Check className="w-3 h-3 mr-1" />
                            Save
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={cancelEditing}
                            className="flex-1"
                          >
                            <X className="w-3 h-3 mr-1" />
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => handleLoadPlaylist(playlist)}
                            className="flex-1"
                          >
                            <Play className="w-3 h-3 mr-1" />
                            Load
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              startEditing(playlist);
                            }}
                            className="text-blue-500 hover:text-blue-600 hover:bg-blue-500/10"
                          >
                            <Edit2 className="w-3 h-3" />
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavorite(playlist.id);
                            }}
                            className={playlist.isFavorite ? 'text-yellow-500 border-yellow-500' : ''}
                          >
                            {playlist.isFavorite ? (
                              <Star className="w-3 h-3 fill-current" />
                            ) : (
                              <StarOff className="w-3 h-3" />
                            )}
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              deletePlaylist(playlist.id);
                            }}
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                          >
                            <Trash2 className="w-3 h-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </ScrollArea>

        {/* Footer Stats */}
        <div className="px-6 py-3 border-t bg-secondary/30 text-xs text-muted-foreground">
          <div className="flex items-center justify-between">
            <span>
              💾 Using {Math.round((JSON.stringify(savedPlaylists).length / 1024))} KB of storage
            </span>
            <span>
              Maximum {MAX_PLAYLISTS} playlists
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Export function to save a playlist from outside
export const savePlaylistToHistory = async (
  name: string,
  url: string,
  imageUrl: string,
  trackCount: number,
  owner?: string,
  description?: string,
  tracks?: any[],
  onDuplicateFound?: (existingPlaylist: SavedPlaylist) => Promise<'replace' | 'new' | 'cancel'>
) => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    const playlists: SavedPlaylist[] = stored ? JSON.parse(stored) : [];
    
    // Check for duplicate name (case-insensitive)
    const existingPlaylist = playlists.find(p => p.name.toLowerCase() === name.toLowerCase());
    
    if (existingPlaylist && onDuplicateFound) {
      const action = await onDuplicateFound(existingPlaylist);
      
      if (action === 'cancel') {
        return false; // User cancelled
      }
      
      if (action === 'replace') {
        // Replace the existing playlist
        const updatedPlaylists = playlists.map(p => 
          p.id === existingPlaylist.id 
            ? {
                ...p,
                name,
                url,
                imageUrl,
                trackCount,
                owner,
                description,
                tracks,
                lastLoaded: Date.now()
              }
            : p
        );
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedPlaylists));
        window.dispatchEvent(new Event('playlistsSaved'));
        return true;
      }
      
      // action === 'new' - continue to add as new
    }
    
    // Add as new playlist
    const newPlaylist: SavedPlaylist = {
      id: `playlist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      url,
      imageUrl,
      trackCount,
      owner,
      description,
      tracks,
      savedAt: Date.now(),
      lastLoaded: Date.now(),
      isFavorite: false
    };
    
    playlists.unshift(newPlaylist);
    
    // Limit to MAX_PLAYLISTS
    if (playlists.length > MAX_PLAYLISTS) {
      // Remove oldest non-favorite playlists
      const favorites = playlists.filter(p => p.isFavorite);
      const nonFavorites = playlists.filter(p => !p.isFavorite).slice(0, MAX_PLAYLISTS - favorites.length);
      playlists.splice(0, playlists.length, ...favorites, ...nonFavorites);
    }
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(playlists));
    // Dispatch custom event for live count updates
    window.dispatchEvent(new Event('playlistsSaved'));
    return true;
  } catch (error) {
    console.error('Failed to save playlist:', error);
    return false;
  }
};

