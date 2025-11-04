import { useState, useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { Music2, Download, ListMusic, Sparkles, Zap, Shield, CheckCircle2, Link2, Search, History } from "lucide-react";
import { PlaylistInput } from "@/components/PlaylistInput";
import { PlaylistHeader } from "@/components/PlaylistHeader";
import { TrackList } from "@/components/TrackList";
import { DownloadSettings } from "@/components/DownloadSettings";
import { MusicSearch } from "@/components/MusicSearch";
import SavedPlaylists, { savePlaylistToHistory } from "@/components/SavedPlaylists";
import { Playlist, Track, DownloadSettings as DownloadSettingsType } from "@/types";
import { checkHealth, getSocket } from "@/services/api";
import {
  resetTabTitle,
  showDownloadProgress,
  showCompleteNotification,
  showErrorNotification,
  requestNotificationPermission,
} from "@/lib/tabNotifications";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { loadCurrentTrackList, resetPlayerSession } from "@/lib/playlistStorage";
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

const Index = () => {
  const location = useLocation();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [settings, setSettings] = useState<DownloadSettingsType>({
    format: "mp3",
    quality: "320k",
    threads: 8,
  });
  const [versionInfo, setVersionInfo] = useState<any>(null);
  // Track playlist names and images for smart combining (only playlists, not single tracks)
  const [playlistNames, setPlaylistNames] = useState<string[]>([]);
  const [playlistImages, setPlaylistImages] = useState<string[]>([]);
  const [playlistUrls, setPlaylistUrls] = useState<string[]>([]);
  // Input mode: 'url' (default) or 'search'
  const [inputMode, setInputMode] = useState<'url' | 'search'>('url');
  // Ref for scrolling to input section
  const inputSectionRef = useRef<HTMLDivElement>(null);
  // Ref for playTrack function from TrackList
  const playTrackRef = useRef<((track: Track) => Promise<void>) | null>(null);
  // Ref for playing state getter from TrackList
  const getPlayingStateRef = useRef<(() => { isPlaying: boolean; isPlayerReady: boolean }) | null>(null);
  // Detected URL from search mode
  const [detectedUrl, setDetectedUrl] = useState<string>('');
  // Detected search text from URL mode
  const [detectedSearchText, setDetectedSearchText] = useState<string>('');
  // Saved playlists dialog
  const [showSavedPlaylists, setShowSavedPlaylists] = useState(false);
  // Cookie helper removed – we operate cookie-less
  // Saved playlists count for live updates
  const [savedPlaylistsCount, setSavedPlaylistsCount] = useState(0);
  // Track active downloads
  const [isDownloading, setIsDownloading] = useState(false);
  const [activeDownloadId, setActiveDownloadId] = useState<string>('');
  // Private mode flag (for shared playlists opened in new tab - no auto-save)
  const [isPrivateMode, setIsPrivateMode] = useState(false);
  
  // Restore track list and playlist info on mount
  useEffect(() => {
    const savedTrackList = loadCurrentTrackList();
    if (savedTrackList && savedTrackList.tracks.length > 0) {
      console.log('📥 Restoring playlist from localStorage...', savedTrackList);
      // Deselect all tracks on load
      const deselectedTracks = savedTrackList.tracks.map(track => ({
        ...track,
        selected: false
      }));
      setTracks(deselectedTracks);
      
      // Restore playlist info if available
      if (savedTrackList.playlistName) {
        const restoredPlaylist: Playlist = {
          id: 'restored',
          name: savedTrackList.playlistName,
          description: `Restored playlist with ${savedTrackList.tracks.length} tracks`,
          owner: 'You',
          totalTracks: savedTrackList.tracks.length,
          totalDuration: savedTrackList.tracks.reduce((sum, t) => sum + (t.duration || 0), 0),
          imageUrl: savedTrackList.playlistImages?.[0] || '/placeholder.svg',
          url: savedTrackList.playlistUrl || ''
        };
        setPlaylist(restoredPlaylist);
        
        if (savedTrackList.playlistName) {
          setPlaylistNames([savedTrackList.playlistName]);
        }
        if (savedTrackList.playlistImages && savedTrackList.playlistImages.length > 0) {
          setPlaylistImages(savedTrackList.playlistImages);
        }
        if (savedTrackList.playlistUrl) {
          setPlaylistUrls([savedTrackList.playlistUrl]);
        }
      }
      
      toast.success('Playlist restored', {
        description: `${savedTrackList.tracks.length} tracks loaded from previous session`
      });
      
      // Scroll to track list section after a longer delay to ensure it's rendered
      setTimeout(() => {
        const trackListSection = document.querySelector('[data-track-list]');
        console.log('🔍 Looking for track list section:', trackListSection);
        if (trackListSection) {
          console.log('✅ Found track list, scrolling...');
          trackListSection.scrollIntoView({ behavior: 'smooth', block: 'center' });
        } else {
          console.log('⚠️ Track list section not found yet, trying again...');
          // Try again after another delay
          setTimeout(() => {
            const retry = document.querySelector('[data-track-list]');
            if (retry) {
              console.log('✅ Found track list on retry, scrolling...');
              retry.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }, 500);
        }
      }, 800);
    }
  }, []); // Only run on mount

  // Handle shared playlist from navigation state
  useEffect(() => {
    const state = location.state as any;
    if (state?.fromShare && state?.loadedPlaylist) {
      const sharedPlaylist = state.loadedPlaylist;
      console.log('📥 Loading shared playlist...', sharedPlaylist);
      
      // Set playlist data with all deselected
      if (sharedPlaylist.tracks && sharedPlaylist.tracks.length > 0) {
        const deselectedTracks = sharedPlaylist.tracks.map((track: any) => ({
          ...track,
          selected: false
        }));
        setTracks(deselectedTracks);
      }
      
      const loadedPlaylist: Playlist = {
        id: sharedPlaylist.id || 'shared',
        name: sharedPlaylist.name || 'Shared Playlist',
        description: sharedPlaylist.description || `Shared playlist with ${sharedPlaylist.tracks?.length || 0} tracks`,
        owner: sharedPlaylist.owner || 'Shared',
        totalTracks: sharedPlaylist.tracks?.length || 0,
        totalDuration: sharedPlaylist.tracks?.reduce((sum: number, t: any) => sum + (t.duration || 0), 0) || 0,
        imageUrl: sharedPlaylist.imageUrl || '/placeholder.svg',
        url: sharedPlaylist.url || ''
      };
      setPlaylist(loadedPlaylist);
      
      if (sharedPlaylist.name) {
        setPlaylistNames([sharedPlaylist.name]);
      }
      if (sharedPlaylist.imageUrl) {
        setPlaylistImages([sharedPlaylist.imageUrl]);
      }
      if (sharedPlaylist.url) {
        setPlaylistUrls([sharedPlaylist.url]);
      }
      
      // Clear navigation state
      window.history.replaceState({}, document.title);
      
      // Scroll to track list
      setTimeout(() => {
        const trackListSection = document.querySelector('[data-track-list]');
        if (trackListSection) {
          trackListSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 500);
    }
  }, [location]);

  // Handle shared playlist from new tab (via sessionStorage) - loads without saving
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const loadSharedKey = params.get('loadShared');
    
    if (loadSharedKey) {
      try {
        const sharedData = sessionStorage.getItem(loadSharedKey);
        if (sharedData) {
          const playlistData = JSON.parse(sharedData);
          console.log('📥 Loading shared playlist in new tab (no auto-save)...', playlistData);
          
          // Enable private mode (no auto-save to localStorage)
          setIsPrivateMode(true);
          
          // Set playlist data with all deselected
          if (playlistData.tracks && playlistData.tracks.length > 0) {
            const deselectedTracks = playlistData.tracks.map((track: any) => ({
              ...track,
              selected: false
            }));
            setTracks(deselectedTracks);
          }
          
          const loadedPlaylist: Playlist = {
            id: playlistData.id || 'shared',
            name: playlistData.name || 'Shared Playlist',
            description: playlistData.description || `Shared playlist with ${playlistData.tracks?.length || 0} tracks`,
            owner: playlistData.owner || 'Shared',
            totalTracks: playlistData.tracks?.length || 0,
            totalDuration: playlistData.tracks?.reduce((sum: number, t: any) => sum + (t.duration || 0), 0) || 0,
            imageUrl: playlistData.imageUrl || '/placeholder.svg',
            url: playlistData.url || ''
          };
          setPlaylist(loadedPlaylist);
          
          if (playlistData.name) {
            setPlaylistNames([playlistData.name]);
          }
          if (playlistData.imageUrl) {
            setPlaylistImages([playlistData.imageUrl]);
          }
          if (playlistData.url) {
            setPlaylistUrls([playlistData.url]);
          }
          
          // Clean up sessionStorage and URL
          sessionStorage.removeItem(loadSharedKey);
          window.history.replaceState({}, document.title, window.location.pathname);
          
          toast.success('🔒 Private Mode: Playlist loaded (not saved)', {
            description: 'Click "Save Playlist" to keep it permanently'
          });
          
          // Scroll to track list
          setTimeout(() => {
            const trackListSection = document.querySelector('[data-track-list]');
            if (trackListSection) {
              trackListSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 500);
        }
      } catch (error) {
        console.error('Failed to load shared playlist from new tab:', error);
        toast.error('Failed to load shared playlist');
      }
    }
  }, []);

  // Update saved playlists count
  useEffect(() => {
    const updateCount = () => {
      try {
        const stored = localStorage.getItem('saved-playlists');
        const playlists = stored ? JSON.parse(stored) : [];
        setSavedPlaylistsCount(playlists.length);
      } catch {
        setSavedPlaylistsCount(0);
      }
    };
    
    updateCount();
    
    // Listen for storage changes (from SavedPlaylists component)
    window.addEventListener('storage', updateCount);
    // Custom event for same-tab updates
    window.addEventListener('playlistsSaved', updateCount);
    
    return () => {
      window.removeEventListener('storage', updateCount);
      window.removeEventListener('playlistsSaved', updateCount);
    };
  }, []);

  // Download confirmation on tab close/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (isDownloading) {
        // Show browser's built-in confirmation dialog
        e.preventDefault();
        e.returnValue = ''; // Modern browsers require this
        
        // Cancel download on backend (fire and forget)
        if (activeDownloadId) {
          const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
          const currentSocket = getSocket();
          const socketId = currentSocket?.id || null;
          
          fetch(`${API_URL}/api/download/cancel`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ downloadId: activeDownloadId, socketId }),
            keepalive: true // Ensures request completes even if page is closing
          }).catch(err => console.error('Failed to cancel download:', err));
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDownloading, activeDownloadId]);

  // Callback from TrackList when download status changes
  const handleDownloadingChange = (downloading: boolean, downloadId?: string) => {
    setIsDownloading(downloading);
    setActiveDownloadId(downloadId || '');
    
    // Show notification when download starts
    if (downloading && !isDownloading) {
      toast.info('⚠️ Download in progress', {
        description: "You'll be asked to confirm if you try to close this tab",
        duration: 5000,
      });
    }
  };

  // Cookie helper removed – no user cookie collection

  // Helper to detect if text is a supported music URL
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

  // Handler when URL is detected in search mode
  const handleUrlDetected = (url: string) => {
    setDetectedUrl(url);
    setInputMode('url');
    toast.info('URL detected! Switched to URL mode', {
      description: 'Paste the URL in the input below'
    });
  };

  // Handler when search text is detected in URL mode
  const handleSearchTextDetected = (searchText: string) => {
    setDetectedSearchText(searchText);
    setInputMode('search');
    toast.info('Search text detected! Switched to Search mode', {
      description: 'Click Search to find music'
    });
  };

  // Handle reset session
  const handleResetSession = () => {
    // Clear all localStorage data except saved playlists
    resetPlayerSession();
    
    toast.success('Session reset', {
      description: 'Page will reload...'
    });
    
    // Reload page after short delay
    setTimeout(() => {
      window.location.reload();
    }, 500);
  };

  // Fetch version info and request notification permission on mount
  useEffect(() => {
    checkHealth().then((data) => {
      setVersionInfo(data.versions);
    }).catch((error) => {
      console.error('Failed to fetch version info:', error);
    });
    
    // Request notification permission
    requestNotificationPermission();
    
    // Cookie status removed
    
    // Auto-scroll to input section on page load (smooth scroll to middle)
    setTimeout(() => {
      if (inputSectionRef.current) {
        inputSectionRef.current.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'center' 
        });
      }
    }, 300);
    
    // Cleanup on unmount
    return () => {
      resetTabTitle();
    };
  }, []);

  // Add padding to body when player is visible to prevent footer overlap
  useEffect(() => {
    const checkPlayer = () => {
      const player = document.querySelector('[data-music-player]');
      if (player) {
        document.body.style.paddingBottom = '120px';
      } else {
        document.body.style.paddingBottom = '0px';
      }
    };

    // Check initially and on interval
    checkPlayer();
    const interval = setInterval(checkPlayer, 500);

    return () => {
      clearInterval(interval);
      document.body.style.paddingBottom = '0px';
    };
  }, [tracks]);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Cookie helper removed */}

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
        
        <div className="container mx-auto px-4 py-12 md:py-16 lg:py-20 relative z-10" style={{ maxWidth: 'var(--container-max-width)' }}>
          <div className="flex flex-col items-center text-center space-y-4 md:space-y-6 animate-fade-in-up">
            <div className="inline-flex items-center gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-gradient-to-r from-[#1DB954]/10 to-red-500/10 border border-primary/20 rounded-full backdrop-blur-sm">
              <Sparkles className="w-3.5 md:w-4 h-3.5 md:h-4 text-primary" />
              <span className="text-xs md:text-sm font-medium bg-gradient-to-r from-[#1DB954] to-red-500 bg-clip-text text-transparent">Spotify & YouTube Support</span>
            </div>
            
            <div className="flex items-center gap-3 md:gap-4">
              <div className="p-3 md:p-4 bg-gradient-to-br from-[#1DB954] to-[#1ed760] rounded-xl md:rounded-2xl shadow-glow animate-glow-pulse">
                <Music2 className="w-8 md:w-10 h-8 md:h-10 text-white" />
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold">
                <span className="bg-gradient-to-r from-[#1DB954] via-[#1ed760] to-red-500 bg-clip-text text-transparent">TrackMiner</span>
                <br />
                <span className="text-foreground">Multi-Source Downloader</span>
              </h1>
            </div>
            
            <p className="text-muted-foreground text-sm md:text-base lg:text-lg xl:text-xl max-w-3xl leading-relaxed px-4">
              Download music from <span className="text-[#1DB954] font-semibold">Spotify</span> & <span className="text-red-500 font-semibold">YouTube</span> with <span className="text-primary font-semibold">high-quality audio</span>. 
              Playlists, tracks, and videos - all in 320kbps MP3!
            </p>

            {/* Feature Pills */}
            <div className="flex flex-wrap justify-center gap-2 md:gap-3 pt-3 md:pt-4">
              <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-[#1DB954]/10 backdrop-blur-sm rounded-full border border-[#1DB954]/30">
                <Music2 className="w-3.5 md:w-4 h-3.5 md:h-4 text-[#1DB954]" />
                <span className="text-xs md:text-sm font-medium">Spotify Tracks & Playlists</span>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-red-500/10 backdrop-blur-sm rounded-full border border-red-500/30">
                <Download className="w-3.5 md:w-4 h-3.5 md:h-4 text-red-500" />
                <span className="text-xs md:text-sm font-medium">YouTube Videos & Playlists</span>
              </div>
              <div className="flex items-center gap-1.5 md:gap-2 px-3 md:px-4 py-1.5 md:py-2 bg-primary/10 backdrop-blur-sm rounded-full border border-primary/30">
                <Zap className="w-3.5 md:w-4 h-3.5 md:h-4 text-primary" />
                <span className="text-xs md:text-sm font-medium">320kbps Quality</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 md:py-10 lg:py-12 relative z-10" style={{ maxWidth: 'var(--container-max-width)' }}>
        {/* Input Section */}
        <div ref={inputSectionRef} className="animate-fade-in space-y-6" style={{ animationDelay: '0.2s' }}>
          {/* Mode Toggle Switch */}
          <div className="flex justify-center">
            <div className="relative inline-flex items-center gap-1.5 sm:gap-2 p-1 sm:p-1.5 bg-secondary/50 backdrop-blur-sm rounded-lg sm:rounded-xl border border-border shadow-lg w-full sm:w-auto">
              <Button
                onClick={() => setInputMode('url')}
                variant={inputMode === 'url' ? 'default' : 'ghost'}
                className={`relative flex-1 sm:flex-none px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-lg font-semibold transition-all duration-300 text-xs sm:text-sm md:text-base ${
                  inputMode === 'url' 
                    ? 'bg-primary text-primary-foreground shadow-glow' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <Link2 className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Enter Music URL</span>
                <span className="sm:hidden">URL</span>
              </Button>
              <Button
                onClick={() => setInputMode('search')}
                variant={inputMode === 'search' ? 'default' : 'ghost'}
                className={`relative flex-1 sm:flex-none px-3 sm:px-4 md:px-6 py-2 sm:py-2.5 md:py-3 rounded-lg font-semibold transition-all duration-300 text-xs sm:text-sm md:text-base ${
                  inputMode === 'search' 
                    ? 'bg-primary text-primary-foreground shadow-glow' 
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                }`}
              >
                <Search className="w-4 h-4 sm:w-5 sm:h-5 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Search Music</span>
                <span className="sm:hidden">Search</span>
              </Button>
            </div>
          </div>

          {/* URL Input Mode */}
          {inputMode === 'url' && (
            <div className="animate-fade-in">
              <PlaylistInput 
                hasExistingData={tracks.length > 0}
                existingPlaylistName={playlist?.name}
                initialUrl={detectedUrl}
                currentTracks={tracks}
                onAddTracksAndPlay={(track) => {
                  if (playTrackRef.current) {
                    playTrackRef.current(track);
                  }
                }}
                onCheckPlayingState={() => {
                  if (getPlayingStateRef.current) {
                    return getPlayingStateRef.current();
                  }
                  return { isPlaying: false, isPlayerReady: false };
                }}
                onSearchTextDetected={handleSearchTextDetected}
                onPlaylistLoaded={(playlistData, tracksData, mode) => {
                  // Clear detected URL after it's been used
                  setDetectedUrl('');
                  
                  // NEW: Enhanced post-load experience
                  if (mode === 'replace') {
                    // Scroll to track list after a short delay
                    setTimeout(() => {
                      const trackListElement = document.querySelector('[data-track-list]');
                      if (trackListElement) {
                        trackListElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }
                    }, 300);
                  }
                  
                  if (mode === 'append' && playlist && tracks.length > 0) {
                    // Append mode: merge tracks and update playlist name
                    // Check if adding all tracks vs partial selection
                    // Single track (1 track) = individual track addition (position 1)
                    // Multiple tracks = could be partial or all
                    const isSingleTrack = tracksData.length === 1;
                    const isAddingAllTracks = !isSingleTrack && tracksData.length === playlistData.totalTracks;
                    
                    // Determine insertion position: 
                    // - Position 1 (beginning) for single tracks or partial selection
                    // - End for all tracks from a playlist
                    const insertionPosition = (isSingleTrack || !isAddingAllTracks) ? 1 : tracks.length;
                    const mergedTracks = [
                      ...tracks.slice(0, insertionPosition),
                      ...tracksData,
                      ...tracks.slice(insertionPosition)
                    ];
                    
                    // Smart naming: 
                    // - If adding ALL tracks from a playlist (2+ tracks), use the new playlist name
                    // - If adding partial tracks, combine playlist names
                    const isNewItemPlaylist = playlistData.totalTracks > 1;
                    let updatedPlaylistNames = [...playlistNames];
                    let updatedPlaylistImages = [...playlistImages];
                    let updatedPlaylistUrls = [...playlistUrls];
                    
                    if (isNewItemPlaylist) {
                      if (isAddingAllTracks) {
                        // Adding all tracks: replace with new playlist name
                        setPlaylist({
                          ...playlist,
                          name: playlistData.name,
                          totalTracks: mergedTracks.length,
                          totalDuration: playlist.totalDuration + playlistData.totalDuration,
                        });
                        // Update playlist info arrays
                        setPlaylistNames([playlistData.name]);
                        setPlaylistImages([playlistData.imageUrl]);
                        setPlaylistUrls([playlistData.url]);
                      } else {
                        // Adding partial tracks: combine names
                        updatedPlaylistNames.push(playlistData.name);
                        updatedPlaylistImages.push(playlistData.imageUrl);
                        updatedPlaylistUrls.push(playlistData.url);
                        
                        const combinedName = updatedPlaylistNames.length > 0 
                          ? updatedPlaylistNames.join(' + ')
                          : playlist.name;
                        
                        setPlaylistNames(updatedPlaylistNames);
                        setPlaylistImages(updatedPlaylistImages);
                        setPlaylistUrls(updatedPlaylistUrls);
                        setPlaylist({
                          ...playlist,
                          name: combinedName,
                          totalTracks: mergedTracks.length,
                          totalDuration: playlist.totalDuration + playlistData.totalDuration,
                        });
                      }
                    } else {
                      // Single track: keep existing name, just add tracks
                      setPlaylist({
                        ...playlist,
                        totalTracks: mergedTracks.length,
                        totalDuration: playlist.totalDuration + playlistData.totalDuration,
                      });
                    }
                    
                    setTracks(mergedTracks);
                  } else {
                    // Replace mode: clear and load new
                    setPlaylist(playlistData);
                    setTracks(tracksData);
                    // Reset playlist tracking
                    const isPlaylist = playlistData.totalTracks > 1;
                    setPlaylistNames(isPlaylist ? [playlistData.name] : []);
                    setPlaylistImages(isPlaylist ? [playlistData.imageUrl] : []);
                    setPlaylistUrls(isPlaylist ? [playlistData.url] : []);
                  }
                }} 
              />
            </div>
          )}
          
          {/* Search Music Mode */}
          {inputMode === 'search' && (
            <div className="relative group animate-fade-in">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative bg-card rounded-2xl border border-border p-8 sm:p-10 shadow-card backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Search className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold">Search Music on YouTube</h2>
                </div>
                <MusicSearch 
                  onUrlDetected={handleUrlDetected}
                  initialSearchText={detectedSearchText}
                  currentTracks={tracks}
                  onCheckPlayingState={() => {
                    // Get current playing state from TrackList
                    if (getPlayingStateRef.current) {
                      return getPlayingStateRef.current();
                    }
                    return { isPlaying: false, isPlayerReady: false };
                  }}
                  onAddTracksAndPlay={(track) => {
                    // Play the track if playTrack function is available
                    if (playTrackRef.current) {
                      playTrackRef.current(track).catch(err => {
                        console.error('Error playing track:', err);
                        toast.error('Failed to play track');
                      });
                    } else {
                      toast.warning('Player not ready yet. Track added to list.');
                    }
                  }}
                  onAddTracks={(newTracks) => {
                    // Clear detected search text after it's been used
                    setDetectedSearchText('');
                    
                    if (playlist && tracks.length > 0) {
                      // Add to existing tracks - filter out duplicates by ID
                      const existingIds = new Set(tracks.map(t => t.id));
                      const uniqueNewTracks = newTracks.filter(t => !existingIds.has(t.id));
                      
                      if (uniqueNewTracks.length === 0) {
                        toast.info('All selected tracks are already in the list');
                        return;
                      }
                      
                      if (uniqueNewTracks.length < newTracks.length) {
                        toast.info(`${newTracks.length - uniqueNewTracks.length} duplicate track(s) skipped`);
                      }
                      
                      // Insert new tracks at the top; ensure clean download state
                      const cleanedNew = uniqueNewTracks.map(t => ({
                        ...t,
                        downloadStatus: undefined,
                        downloadProgress: undefined,
                        selected: false,
                      }));
                      setTracks([...cleanedNew, ...tracks]);
                      setPlaylist({
                        ...playlist,
                        totalTracks: playlist.totalTracks + uniqueNewTracks.length,
                      });
                    } else {
                      // Create a new "Search Results" playlist
                      const searchPlaylist: Playlist = {
                        id: `search-${Date.now()}`,
                        name: "Search Results",
                        description: "Tracks added from search",
                        totalTracks: newTracks.length,
                        totalDuration: newTracks.reduce((sum, t) => sum + t.duration, 0),
                        imageUrl: newTracks[0]?.imageUrl || "",
                        url: "search-results", // Use placeholder URL for search results
                        owner: "User",
                        ownerUrl: "",
                        ownerImage: "",
                      };
                      setPlaylist(searchPlaylist);
                      // Ensure clean download state for new list
                      const cleaned = newTracks.map(t => ({
                        ...t,
                        downloadStatus: undefined,
                        downloadProgress: undefined,
                        selected: false,
                      }));
                      setTracks(cleaned);
                      setPlaylistNames([]);
                      setPlaylistImages([]);
                      setPlaylistUrls([]);
                    }
                  }}
                />
              </div>
            </div>
          )}
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
            {/* Show header only if we have actual playlists (not just single tracks) */}
            {playlistNames.length > 0 && (
              <PlaylistHeader 
                playlist={playlist} 
                tracks={tracks}
                combinedPlaylists={playlistNames.length > 1 ? {
                  names: playlistNames,
                  images: playlistImages,
                  urls: playlistUrls
                } : undefined}
                onReset={handleResetSession}
                hasActiveTracks={tracks.length > 0}
              />
            )}
            <TrackList 
              tracks={tracks} 
              settings={settings}
              playlistUrl={playlist.url}
              playlistName={playlist.name}
              playlistImages={playlistImages.length > 0 ? playlistImages : [playlist.imageUrl]}
              isPrivateMode={isPrivateMode}
              onTracksUpdate={(updatedTracks) => {
                setTracks(updatedTracks);
                // Update playlist metadata
                if (playlist) {
                  const totalDuration = updatedTracks.reduce((sum, track) => sum + track.duration, 0);
                  setPlaylist({
                    ...playlist,
                    totalTracks: updatedTracks.length,
                    totalDuration,
                  });
                }
              }}
              onDownloadingChange={handleDownloadingChange}
              onPlayTrackReady={(playTrack) => {
                playTrackRef.current = playTrack;
              }}
              onPlayingStateReady={(getState) => {
                getPlayingStateRef.current = getState;
              }}
            />
          </div>
        )}

        {/* Empty State */}
        {!playlist && (
          <div className="mt-16 md:mt-20 lg:mt-24 text-center animate-fade-in" style={{ animationDelay: '0.4s' }}>
            <div className="inline-flex items-center justify-center w-24 h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 bg-gradient-to-br from-secondary to-secondary/50 rounded-2xl md:rounded-3xl mb-6 md:mb-8 shadow-card hover-scale">
              <ListMusic className="w-12 h-12 md:w-14 md:h-14 lg:w-16 lg:h-16 text-primary" />
            </div>
            <h3 className="text-2xl md:text-3xl font-bold mb-3 text-gradient">Ready to Mine Some Tracks?</h3>
            <p className="text-muted-foreground text-sm md:text-base lg:text-lg max-w-2xl mx-auto leading-relaxed px-4">
              Paste a Spotify or YouTube URL above to get started. 
              <br />
              We support playlists, tracks, videos - everything you need!
            </p>
            
            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 mt-8 md:mt-10 lg:mt-12 max-w-3xl mx-auto px-4">
              <div className="p-4 md:p-5 lg:p-6 bg-card border border-border rounded-xl hover-scale hover-glow">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">∞</div>
                <div className="text-xs md:text-sm text-muted-foreground">Unlimited Downloads</div>
              </div>
              <div className="p-4 md:p-5 lg:p-6 bg-card border border-border rounded-xl hover-scale hover-glow">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">320k</div>
                <div className="text-xs md:text-sm text-muted-foreground">Maximum Quality</div>
              </div>
              <div className="p-4 md:p-5 lg:p-6 bg-card border border-border rounded-xl hover-scale hover-glow">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">100%</div>
                <div className="text-xs md:text-sm text-muted-foreground">Success Rate</div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-border mt-16 md:mt-20 lg:mt-24 py-6 md:py-8 relative">
        <div className="container mx-auto px-4" style={{ maxWidth: 'var(--container-max-width)' }}>
          <div className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              {/* Left: Branding */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Download className="w-4 h-4 text-primary" />
                <span className="font-medium">Powered by spotdl & yt-dlp</span>
              </div>

              {/* Center: Tagline */}
              <p className="text-sm text-muted-foreground/70">
                High-quality music downloads • Built with passion
              </p>

              {/* Right: Version Info */}
              {versionInfo && (
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-center gap-2 text-xs">
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded-md">
                      <Music2 className="w-3 h-3 text-primary" />
                      <span className="text-muted-foreground">spotdl:</span>
                      <span className="text-foreground font-mono font-semibold">{versionInfo.spotdl}</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 rounded-md">
                      <Download className="w-3 h-3 text-primary" />
                      <span className="text-muted-foreground">yt-dlp:</span>
                      <span className="text-foreground font-mono font-semibold">{versionInfo.ytdlp}</span>
                    </div>
                  </div>
                  {versionInfo.lastUpdated && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <CheckCircle2 className="w-3 h-3 text-green-500" />
                      <span>Updated: {new Date(versionInfo.lastUpdated).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </footer>

      {/* Floating Saved Playlists Button - Minimized with Hover Expand */}
      <div className="fixed left-0 top-1/2 -translate-y-1/2 z-50">
        <div className="relative group">
          {/* Glow effect */}
          <div className="absolute -inset-2 bg-gradient-to-r from-primary/30 to-primary/10 rounded-r-2xl blur-xl opacity-0 group-hover:opacity-100 transition-all duration-500"></div>
          
          {/* Button Container - Expands on hover */}
          <div 
            onClick={() => setShowSavedPlaylists(true)}
            className="relative flex items-center gap-3 py-4 pl-3 pr-3 group-hover:pr-6 bg-gradient-to-r from-card/98 to-secondary/95 backdrop-blur-xl border-2 border-l-0 border-primary/30 hover:border-primary rounded-r-2xl shadow-2xl hover:shadow-primary/30 cursor-pointer transition-all duration-500 overflow-hidden w-14 group-hover:w-64"
          >
            {/* Icon with badge */}
            <div className="relative flex-shrink-0">
              <div className="p-2 bg-primary/10 rounded-xl group-hover:bg-primary/20 transition-colors duration-300">
                <History className="w-6 h-6 text-primary group-hover:scale-110 transition-transform duration-300" />
              </div>
              
              {/* Count Badge */}
              <div className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-gradient-to-r from-primary to-primary/80 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-lg border border-background">
                {savedPlaylistsCount}
              </div>
            </div>
            
            {/* Expanded Text - Slides in on hover */}
            <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-100 whitespace-nowrap">
              <span className="text-sm font-bold text-foreground">Saved Playlists</span>
              <span className="text-xs text-muted-foreground">Your collection</span>
            </div>
            
            {/* Animated border accent */}
            <div className="absolute right-0 top-0 bottom-0 w-1 bg-gradient-to-b from-transparent via-primary to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          </div>
        </div>
      </div>

      {/* Saved Playlists Dialog */}
      <SavedPlaylists
        open={showSavedPlaylists}
        onOpenChange={setShowSavedPlaylists}
        onLoadPlaylist={(savedPlaylist) => {
          // Close the dialog first
          setShowSavedPlaylists(false);
          
          // Restore the complete playlist state
          if (savedPlaylist.tracks && savedPlaylist.tracks.length > 0) {
            // Restore playlist metadata
            setPlaylist({
              id: savedPlaylist.id,
              name: savedPlaylist.name,
              url: savedPlaylist.url,
              imageUrl: savedPlaylist.imageUrl,
              owner: savedPlaylist.owner || 'You',
              description: savedPlaylist.description || '',
              totalTracks: savedPlaylist.trackCount,
              totalDuration: savedPlaylist.tracks.reduce((sum, t) => sum + (t.duration || 0), 0)
            });
            
            // Restore tracks with all deselected
            const deselectedTracks = savedPlaylist.tracks.map(track => ({
              ...track,
              selected: false
            }));
            setTracks(deselectedTracks);
            
            // Reset playlist tracking
            setPlaylistNames([savedPlaylist.name]);
            setPlaylistImages([savedPlaylist.imageUrl]);
            setPlaylistUrls([savedPlaylist.url]);
            
            // Scroll to track list
            setTimeout(() => {
              const trackList = document.querySelector('[data-track-list]');
              if (trackList) {
                trackList.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }, 100);
            
            toast.success('Playlist restored!', {
              description: `${savedPlaylist.name} - ${savedPlaylist.trackCount} tracks`
            });
          } else {
            // Fallback: Load from URL if no tracks saved
            setInputMode('url');
            setDetectedUrl(savedPlaylist.url);
            
            setTimeout(() => {
              inputSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
              
              setTimeout(() => {
                const loadButton = document.querySelector('[data-load-button]') as HTMLButtonElement;
                if (loadButton) {
                  loadButton.click();
                }
              }, 300);
            }, 100);
          }
        }}
      />
    </div>
  );
};

export default Index;
