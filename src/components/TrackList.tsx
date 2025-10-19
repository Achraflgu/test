import { useState, useEffect, useRef, DragEvent } from "react";
import { Download, Play, Check, X, Loader2, ChevronDown, ChevronUp, Music2, FolderOpen, ExternalLink, Youtube, Music, Copy, Terminal, CheckCircle2, Pause, Volume2, VolumeX, SkipForward, SkipBack, Minimize2, Maximize2, List, Repeat, Repeat1, Shuffle, GripVertical, Info, Save, GripHorizontal, Trash2, AlertCircle, RotateCcw, Maximize, Radio, Users } from "lucide-react";
import { FullScreenPlayer } from "@/components/FullScreenPlayer";
import { PictureInPicturePlayer } from "@/components/PictureInPicturePlayer";
import { LiveListeningDialog, ShareLiveRoomDialog } from "@/components/LiveListeningDialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Track, DownloadSettings } from "@/types";
import { toast } from "sonner";
import { startDownload, initWebSocket, getSocket, cancelDownload, skipToYtdlp } from "@/services/api";
import {
  showDownloadProgress,
  showCompleteNotification,
  showErrorNotification,
  resetTabTitle,
} from "@/lib/tabNotifications";
import { savePlaylistToHistory } from "@/components/SavedPlaylists";
import { savePlayerSession, loadPlayerSession, savePlayerSettings, loadPlayerSettings, resetPlayerSession, saveCurrentTrackList, loadCurrentTrackList } from "@/lib/playlistStorage";
import { liveListeningService } from "@/services/liveListening";

interface TrackListProps {
  tracks: Track[];
  settings: DownloadSettings;
  playlistUrl?: string;
  playlistName?: string;
  playlistImages?: string[];
  isPrivateMode?: boolean;
  onTracksUpdate?: (tracks: Track[]) => void;
  onDownloadingChange?: (isDownloading: boolean, downloadId?: string) => void;
}

export const TrackList = ({ tracks: initialTracks, settings, playlistUrl = "", playlistName = "", playlistImages = [], isPrivateMode = false, onTracksUpdate, onDownloadingChange }: TrackListProps) => {
  const [tracks, setTracks] = useState(initialTracks);
  const [downloading, setDownloading] = useState(false);
  const [showDuplicatesDialog, setShowDuplicatesDialog] = useState(false);
  const [duplicateGroups, setDuplicateGroups] = useState<Array<{ key: string; tracks: Track[] }>>([]);
  const [expanded, setExpanded] = useState(true);
  const [showFolderDialog, setShowFolderDialog] = useState(false);
  const [folderName, setFolderName] = useState(playlistName || `Spotify_Playlist_${new Date().toISOString().split('T')[0]}`);
  const [outputFolder, setOutputFolder] = useState("");
  const [downloadId, setDownloadId] = useState("");
  const [attemptCount, setAttemptCount] = useState(0);
  const [showPlayDialog, setShowPlayDialog] = useState(false);
  const [selectedTrack, setSelectedTrack] = useState<Track | null>(null);
  const [listenMode, setListenMode] = useState<'choose' | 'embed'>('choose');
  const [showFailedTracksDialog, setShowFailedTracksDialog] = useState(false);
  const [failedTracks, setFailedTracks] = useState<Track[]>([]);
  
  // Download tray state
  const [recentDownloads, setRecentDownloads] = useState<Array<{ id: string; name: string; url: string; time: number }>>([]);
  const [showDownloadTray, setShowDownloadTray] = useState(true);

  const getFolderName = (folderPath: string) => {
    const parts = (folderPath || '').split(/[\\\/]/);
    return parts[parts.length - 1] || 'Download';
  };
  
  // Audio player state
  const [currentPlayingTrack, setCurrentPlayingTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [youtubeIdCache, setYoutubeIdCache] = useState<Map<string, string>>(new Map()); // Cache Spotify ID -> YouTube ID
  const blockedYoutubeIdCacheRef = useRef<Map<string, Set<string>>>(new Map()); // track.id -> Set of blocked YT IDs
  const currentYoutubeIdRef = useRef<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(100);
  const [isMuted, setIsMuted] = useState(false);
  const [isPlayerMinimized, setIsPlayerMinimized] = useState(false);
  const [isPlayingAll, setIsPlayingAll] = useState(false);
  const [playlistQueue, setPlaylistQueue] = useState<Track[]>([]);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('all');
  const [isShuffled, setIsShuffled] = useState(false);
  const [playerPosition, setPlayerPosition] = useState<'bottom' | 'bottom-left' | 'bottom-right'>('bottom');
  const [showTrackDetails, setShowTrackDetails] = useState(false);
  const [selectedTrackForDetails, setSelectedTrackForDetails] = useState<Track | null>(null);
  const [showFullScreenPlayer, setShowFullScreenPlayer] = useState(false);
  
  // 🎵 Player Loading States
  const [isPlayerLoading, setIsPlayerLoading] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isRestoringPlayer, setIsRestoringPlayer] = useState(false);
  const [playerLoadProgress, setPlayerLoadProgress] = useState(0);
  
  // 🎧 Live Listening state
  const [showLiveDialog, setShowLiveDialog] = useState(false);
  const [showShareLiveDialog, setShowShareLiveDialog] = useState(false);
  const [isLiveHost, setIsLiveHost] = useState(false);
  const [liveRoomId, setLiveRoomId] = useState<string | null>(null);
  const [liveListenerCount, setLiveListenerCount] = useState(0);
  
  // 🔄 Reorder state
  const [showReorderDialog, setShowReorderDialog] = useState(false);
  const [reorderPosition, setReorderPosition] = useState<number>(1);
  
  // 🔍 Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // 🖼️ PiP support check
  const [isPipSupported, setIsPipSupported] = useState(false);
  
  // Check PiP support
  useEffect(() => {
    const isSupported = 'documentPictureInPicture' in window;
    setIsPipSupported(isSupported);
  }, []);
  
  // Keyboard shortcuts will be added after function declarations
  
  // Drag and drop state
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  
  // Manual save state
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [savePlaylistName, setSavePlaylistName] = useState(playlistName || "My Playlist");
  
  // Duplicate confirmation state
  const [showDuplicateConfirmDialog, setShowDuplicateConfirmDialog] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<{
    existingPlaylist: any;
    newTrackCount: number;
    resolve: (action: 'replace' | 'new' | 'cancel') => void;
  } | null>(null);
  
  // Remove selected confirmation state
  const [showRemoveConfirmDialog, setShowRemoveConfirmDialog] = useState(false);
  const [tracksToRemove, setTracksToRemove] = useState<Track[]>([]);
  
  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const repeatModeRef = useRef(repeatMode);
  const isPlayingAllRef = useRef(isPlayingAll);
  const playlistQueueRef = useRef(playlistQueue);
  const tracksRef = useRef(tracks);
  const currentPlayingTrackRef = useRef(currentPlayingTrack);
  const isShuffledRef = useRef(isShuffled);
  const volumeRef = useRef(volume);
  const isMutedRef = useRef(isMuted);
  const playTrackRef = useRef<((track: Track) => Promise<void>) | null>(null);
  const pendingSeekTimeRef = useRef<number | null>(null); // 🔥 For restoring Spotify track position
  
  // Keep refs in sync
  useEffect(() => {
    repeatModeRef.current = repeatMode;
  }, [repeatMode]);
  
  useEffect(() => {
    isPlayingAllRef.current = isPlayingAll;
  }, [isPlayingAll]);
  
  useEffect(() => {
    playlistQueueRef.current = playlistQueue;
  }, [playlistQueue]);
  
  useEffect(() => {
    tracksRef.current = tracks;
  }, [tracks]);
  
  useEffect(() => {
    currentPlayingTrackRef.current = currentPlayingTrack;
  }, [currentPlayingTrack]);
  
  useEffect(() => {
    isShuffledRef.current = isShuffled;
  }, [isShuffled]);
  
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  
  useEffect(() => {
    isMutedRef.current = isMuted;
  }, [isMuted]);

  // Notify parent about downloading status changes
  useEffect(() => {
    if (onDownloadingChange) {
      onDownloadingChange(downloading, downloadId);
    }
  }, [downloading, downloadId, onDownloadingChange]);

  // ============ PERSISTENCE: RESTORE STATE ON MOUNT ============
  useEffect(() => {
    // Note: Track list restoration is now handled by parent component (Index.tsx)
    // This ensures the playlist header also gets restored with the correct info
    
    // Set up global YouTube API ready handler
    const handleYouTubeAPIReady = () => {
      console.log('🎬 YouTube IFrame API Ready - Global handler');
      // This will be called when the YouTube API is loaded
    };
    
    // Set the global handler
    (window as any).onYouTubeIframeAPIReady = handleYouTubeAPIReady;
    
    // Restore player session (queue, current track, position)
    const savedSession = loadPlayerSession();
    if (savedSession) {
      console.log('📥 Restoring player session...', savedSession);
      
      if (savedSession.currentQueue && savedSession.currentQueue.length > 0) {
        setPlaylistQueue(savedSession.currentQueue);
        setIsPlayingAll(true);
      }
      
      if (savedSession.currentTrack) {
        setCurrentPlayingTrack(savedSession.currentTrack);
        const savedTime = savedSession.currentTime || 0;
        setCurrentTime(savedTime);
        // Keep player paused (do NOT auto-play)
        setIsPlaying(false);
        
        // 🔥 CRITICAL FIX: Set duration from saved track data immediately
        if (savedSession.currentTrack.duration && savedSession.currentTrack.duration > 0) {
          setDuration(savedSession.currentTrack.duration);
          console.log('📊 Duration set from saved track data:', savedSession.currentTrack.duration + 's');
        }
        
        // Professional player restoration with enhanced stability
        const restorePlayer = async () => {
          try {
            setIsRestoringPlayer(true);
            setIsPlayerLoading(true);
            setPlayerLoadProgress(10);
            console.log('🎬 [1/6] Starting enhanced player restoration...');
            
            const restoredTrack = savedSession.currentTrack;
            
            // Extract YouTube ID using the same logic as playTrack
            let youtubeId = getYouTubeId(restoredTrack.url);
            setPlayerLoadProgress(20);
            
            // If no URL, try using the track's youtubeId or id directly
            if (!youtubeId) {
              youtubeId = restoredTrack.youtubeId || restoredTrack.id;
            
              // Remove "search-" prefix if present (from YouTube search results)
              if (youtubeId && youtubeId.startsWith('search-')) {
                youtubeId = youtubeId.replace('search-', '');
                console.log('🔧 [2/6] Cleaned search ID:', youtubeId);
              }
            }
            
            // 🔥 FIX: Check YouTube ID cache for Spotify tracks
            if (!youtubeId && youtubeIdCache.has(restoredTrack.id)) {
              youtubeId = youtubeIdCache.get(restoredTrack.id) || null;
              console.log('⚡ [2/6] YouTube ID from cache:', youtubeId);
            }
            
            setPlayerLoadProgress(30);
            
            // Validate the YouTube ID
            if (!youtubeId || !isValidYouTubeId(youtubeId)) {
              throw new Error('Invalid video id: ' + (youtubeId || 'none') + ' (Spotify tracks need YouTube ID - click play to search)');
            }
            
            console.log('✅ [2/6] YouTube ID extracted:', youtubeId);
            
            // 🔥 CRITICAL FIX: Wait for YouTube API to be loaded
            setPlayerLoadProgress(40);
            console.log('⏳ [3/6] Waiting for YouTube API...');
            
            const waitForYouTubeAPI = () => {
              return new Promise<void>((resolve, reject) => {
                let attempts = 0;
                const maxAttempts = 50; // 10 seconds max wait
                
                const checkAPI = () => {
                  attempts++;
                  
                  if ((window as any).YT && (window as any).YT.Player) {
                    console.log('✅ [3/6] YouTube API verified after', attempts, 'attempts');
                    resolve();
                  } else if (attempts >= maxAttempts) {
                    reject(new Error('YouTube API failed to load after 10 seconds'));
                  } else {
                    setTimeout(checkAPI, 200);
                  }
                };
                
                checkAPI();
              });
            };
            
            await waitForYouTubeAPI();
            setPlayerLoadProgress(40);
            
            // Clean up old player
            if (playerRef.current) {
              try {
                playerRef.current.destroy();
                console.log('🗑️ [4/6] Old player destroyed');
              } catch (err) {
                console.log('⚠️ Old player cleanup skipped');
              }
              playerRef.current = null;
            }
            
            setPlayerLoadProgress(50);
            await new Promise(resolve => setTimeout(resolve, 800));
            
            // Create new player with enhanced error handling
            console.log('✨ [5/6] Creating player with video:', youtubeId);
            setPlayerLoadProgress(60);
            
            playerRef.current = new (window as any).YT.Player('youtube-player', {
              videoId: youtubeId,
              playerVars: {
                autoplay: 0,
                controls: 0,
                modestbranding: 1,
                rel: 0,
                showinfo: 0,
                enablejsapi: 1,
                origin: window.location.origin
              },
              events: {
                onReady: (event: any) => {
                  console.log('🎬 [5/6] Player ready! Setting up...');
                  setPlayerLoadProgress(70);
                  
                  // Apply volume settings
                  event.target.setVolume(volumeRef.current);
                  if (isMutedRef.current) {
                    event.target.mute();
                  }
                  
                  // Load video
                  event.target.loadVideoById(youtubeId);
                  setPlayerLoadProgress(80);
                  
                  // Enhanced restoration with better timing and stability
                  const setupPlayer = () => {
                    try {
                      const duration = event.target.getDuration();
                      
                      if (duration && duration > 0) {
                        setDuration(duration);
                        console.log('⏱️ Duration loaded:', duration + 's');
                        setPlayerLoadProgress(90);
                        
                        // 🔥 CRITICAL FIX: Also update the track duration in the current track
                        if (currentPlayingTrack) {
                          const updatedTrack = { ...currentPlayingTrack, duration: duration };
                          setCurrentPlayingTrack(updatedTrack);
                          console.log('📊 Updated track duration from YouTube API:', duration + 's');
                        }
                      }
                      
                      // Seek to saved position with stability check
                      if (savedTime > 0 && savedTime < duration) {
                        event.target.seekTo(savedTime, true);
                        console.log('⏩ Seeking to:', savedTime + 's');
                      }
                      
                      // CRITICAL: Ensure player is paused and stable
                      event.target.pauseVideo();
                      
                      // Wait a bit more to ensure stability
                      setTimeout(() => {
                        // Double-check player is paused
                        if (event.target.getPlayerState() !== (window as any).YT.PlayerState.PAUSED) {
                          event.target.pauseVideo();
                        }
                        
                        setPlayerLoadProgress(100);
                        setIsPlayerLoading(false);
                        setIsPlayerReady(true);
                        setIsRestoringPlayer(false);
                        
                        console.log('✅ Enhanced player restoration complete!', {
                          track: restoredTrack.name,
                          time: savedTime + 's',
                          duration: duration + 's',
                          state: 'PAUSED',
                          loadingStatesCleared: true
                        });
                        
                        toast.success('🎵 Player Ready!', {
                          description: `${restoredTrack.name.substring(0, 30)}...`,
                          duration: 2000
                        });
                      }, 500);
                      
                    } catch (err) {
                      console.error('❌ Error in final setup:', err);
                      setIsPlayerLoading(false);
                      setIsPlayerReady(false);
                      setIsRestoringPlayer(false);
                      toast.error('Player loaded but position reset');
                    }
                  };
                  
                  // Wait for video metadata with retry logic
                  const waitForMetadata = (attempts = 0) => {
                    if (attempts > 15) { // Increased attempts for better reliability
                      console.warn('⚠️ Metadata timeout, proceeding anyway');
                      setupPlayer();
                      return;
                    }
                    
                    const duration = event.target.getDuration();
                    if (duration && duration > 0 && duration !== Infinity) {
                      console.log('✅ Metadata ready, duration:', duration + 's');
                      setupPlayer();
                    } else {
                      console.log(`⏳ Waiting for metadata... attempt ${attempts + 1}/15`);
                      setTimeout(() => waitForMetadata(attempts + 1), 300); // Slightly longer wait
                    }
                  };
                  
                  setTimeout(() => waitForMetadata(), 500); // Start checking sooner
                },
                onStateChange: (event: any) => {
                  const playerState = event.data;
                  
                  // Handle track end
                  if (playerState === (window as any).YT.PlayerState.ENDED) {
                    console.log('🔚 Track ended! Repeat mode:', repeatModeRef.current);
                    const mode = repeatModeRef.current;
                    
                    if (mode === 'one') {
                      console.log('🔁 Repeating same track...');
                      // Repeat current track - DO NOT go to next
                      if (playerRef.current) {
                        playerRef.current.seekTo(0, true);
                        playerRef.current.playVideo();
                      }
                      return; // Exit early - don't process any other mode
                    }
                    
                    if (mode === 'all') {
                      console.log('🔁 Repeat All - finding next track...');
                      // Auto-play next track (will loop)
                      const queue = isPlayingAllRef.current ? playlistQueueRef.current : tracksRef.current;
                      const currentTrack = currentPlayingTrackRef.current;
                      const shuffled = isShuffledRef.current;
                      
                      console.log('📋 Queue length:', queue.length, 'Current track:', currentTrack?.name, 'playTrackRef:', !!playTrackRef.current);
                      
                      if (currentTrack && queue.length > 0) {
                        const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
                        let nextIndex;
                        
                        if (shuffled) {
                          const availableIndices = queue.map((_, i) => i).filter(i => i !== currentIndex);
                          nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                        } else {
                          nextIndex = currentIndex + 1;
                        }
                        
                        console.log('⏭️ Current index:', currentIndex, 'Next index:', nextIndex, 'Queue length:', queue.length);
                        
                        if (nextIndex < queue.length && playTrackRef.current) {
                          console.log('▶️ Playing next track:', queue[nextIndex].name);
                          playTrackRef.current(queue[nextIndex]);
                        } else {
                          console.log('🔄 Looping back to start...');
                          if (shuffled && queue.length > 1 && playTrackRef.current) {
                            const randomIndex = Math.floor(Math.random() * queue.length);
                            console.log('🎲 Random track:', queue[randomIndex].name);
                            playTrackRef.current(queue[randomIndex]);
                          } else if (playTrackRef.current) {
                            console.log('🔙 Playing first track:', queue[0].name);
                            playTrackRef.current(queue[0]);
                          }
                        }
                      } else {
                        console.log('❌ Cannot find next track - no current track or empty queue');
                      }
                    } else {
                      // mode === 'off' - play next but don't loop
                      const queue = isPlayingAllRef.current ? playlistQueueRef.current : tracksRef.current;
                      const currentTrack = currentPlayingTrackRef.current;
                      const shuffled = isShuffledRef.current;
                      
                      if (currentTrack && queue.length > 0) {
                        const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
                        
                        if (shuffled) {
                          const availableIndices = queue.map((_, i) => i).filter(i => i !== currentIndex);
                          if (availableIndices.length > 0 && playTrackRef.current) {
                            const nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                            playTrackRef.current(queue[nextIndex]);
                          } else {
                            setIsPlaying(false);
                            setCurrentPlayingTrack(null);
                            toast.info('🎵 Playlist finished');
                          }
                        } else {
                          if (currentIndex < queue.length - 1 && playTrackRef.current) {
                            playTrackRef.current(queue[currentIndex + 1]);
                          } else {
                            setIsPlaying(false);
                            setCurrentPlayingTrack(null);
                            toast.info('🎵 Playlist finished');
                          }
                        }
                      }
                    }
                  }
                  
                  // Update playing state
                  if (playerState === (window as any).YT.PlayerState.PLAYING) {
                    setIsPlaying(true);
                    // 🔥 CRITICAL FIX: Clear loading states when music starts playing
                    setIsPlayerLoading(false);
                    setIsPlayerReady(true);
                    setIsRestoringPlayer(false);
                    setPlayerLoadProgress(100);
                    
                    const duration = event.target.getDuration();
                    if (duration && duration > 0 && duration !== Infinity) {
                      setDuration(duration);
                    }
                    event.target.setVolume(volumeRef.current);
                    if (isMutedRef.current) {
                      event.target.mute();
                    } else {
                      event.target.unMute();
                    }
                  } else if (playerState === (window as any).YT.PlayerState.PAUSED) {
                    setIsPlaying(false);
                  }
                  
                  // Get duration when state changes
                  if (playerState === (window as any).YT.PlayerState.PLAYING || 
                      playerState === (window as any).YT.PlayerState.PAUSED) {
                    const duration = event.target.getDuration();
                    if (duration && duration > 0 && duration !== Infinity) {
                      setDuration(duration);
                    }
                  }
                },
                onError: async (event: any) => {
                  console.error('❌ YouTube Player Error:', event.data);
                  console.log('📍 Track in error handler:', currentPlayingTrackRef.current ? currentPlayingTrackRef.current.name : 'undefined');
                  
                  let errorMessage = 'Player error';
                  
                  // YouTube error codes:
                  // 2 - Invalid video ID
                  // 5 - HTML5 player error
                  // 100 - Video not found
                  // 101, 150 - Video not allowed to be played in embedded players
                  
                  if (event.data === 2) {
                    errorMessage = 'Invalid video ID - cannot play this track';
                  } else if (event.data === 100) {
                    errorMessage = 'Video not found or removed';
                  } else if (event.data === 101 || event.data === 150) {
                    errorMessage = 'Video embedding restricted';
                    
                    // Get the track from ref
                    const currentTrack = currentPlayingTrackRef.current;
                    
                    // Try to find alternative version
                    if (currentTrack) {
                      // Mark current id as blocked for this track
                      const blockedForTrack = blockedYoutubeIdCacheRef.current.get(currentTrack.id) || new Set<string>();
                      if (currentYoutubeIdRef.current) blockedForTrack.add(currentYoutubeIdRef.current);
                      blockedYoutubeIdCacheRef.current.set(currentTrack.id, blockedForTrack);
                      console.log('⛔ Marked blocked YT id for', currentTrack.name, currentYoutubeIdRef.current);
                      // Remove blocked id from cache so it is not reused
                      if (youtubeIdCache.has(currentTrack.id)) {
                        const newCache = new Map<string, string>(youtubeIdCache);
                        newCache.delete(currentTrack.id);
                        setYoutubeIdCache(newCache);
                        saveYoutubeCache(newCache);
                        console.log('🗑️ Removed blocked YT id from cache for', currentTrack.name);
                      }

                      console.log('🔄 Attempting auto-search for alternative version...');
                      toast.info('🔄 Searching for alternative playable version...');
                      try {
                        const searchQuery = `${currentTrack.artist} ${currentTrack.name} audio`;
                        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                        console.log('🔍 Searching:', searchQuery);
                        const response = await fetch(`${apiUrl}/api/youtube/search?query=${encodeURIComponent(searchQuery)}&limit=3`);
                        
                        if (response.ok) {
                          const data = await response.json();
                          console.log('📦 Search results:', data.results?.length || 0);
                          
                          // Try each result until we find one that works
                          const blockedForTrack = blockedYoutubeIdCacheRef.current.get(currentTrack.id) || new Set<string>();
                          for (const result of data.results || []) {
                            const altYoutubeId = getYouTubeId(result.url);
                            console.log('🧪 Testing alternative:', altYoutubeId);
                            if (altYoutubeId && isValidYouTubeId(altYoutubeId) && !blockedForTrack.has(altYoutubeId)) {
                              console.log('✅ Found valid alternative:', altYoutubeId);
                              
                              // Update cache with new ID
                              const newCache = new Map<string, string>(youtubeIdCache);
                              newCache.set(currentTrack.id, altYoutubeId);
                              setYoutubeIdCache(newCache);
                              saveYoutubeCache(newCache);
                              
                              // Retry with new ID
                              playTrack({ ...currentTrack, youtubeId: altYoutubeId });
                              toast.success('✅ Found alternative version!');
                              return;
                            }
                          }
                        } else {
                          console.error('❌ Search API failed:', response.status);
                        }
                      } catch (err) {
                        console.error('❌ Alternative search failed:', err);
                      }
                      toast.error('No playable version available for this track');
                    } else {
                      console.error('❌ No track info available for alternative search');
                    }
                  }
                  
                  toast.error(errorMessage);
                  setIsPlaying(false);
                }
              }
            });
          } catch (err: any) {
            console.error('❌ Player restoration failed:', err.message);
            
            // Reset loading states on error
            setIsPlayerLoading(false);
            setIsPlayerReady(false);
            setIsRestoringPlayer(false);
            setPlayerLoadProgress(0);
            
            // Check if it's a YouTube API loading issue
            if (err.message.includes('YouTube API')) {
              console.log('🔄 YouTube API not ready, will retry when available...');
              
              // Set up a retry mechanism when YouTube API becomes available
              const retryRestoration = () => {
                if ((window as any).YT && (window as any).YT.Player) {
                  console.log('🔄 YouTube API now available, retrying restoration...');
                  restorePlayer();
                } else {
                  // Check again in 500ms
                  setTimeout(retryRestoration, 500);
                }
              };
              
              // Start retry mechanism
              setTimeout(retryRestoration, 1000);
              
              toast.info('⏳ Loading YouTube Player...', {
                description: 'Please wait while the player initializes',
                duration: 3000
              });
              
              return; // Exit early, retry will handle restoration
            }
            
            // Check if it's a Spotify track
            const isSpotifyTrack = savedSession.currentTrack.url && 
                                   (savedSession.currentTrack.url.includes('spotify.com') || 
                                    savedSession.currentTrack.url.startsWith('https://open.spotify.com'));
            
            if (isSpotifyTrack) {
              // 🔥 FIX: Clear current playing state so clicking play triggers fresh search
              setCurrentPlayingTrack(savedSession.currentTrack); // Keep track visible
              setIsPlaying(false); // But mark as not playing
              
              // 🔥 FIX: Store saved time so we can seek to it after fresh playback
              pendingSeekTimeRef.current = savedTime;
              console.log('⏱️ Saved time for later seek:', savedTime + 's');
              
              // Destroy any broken player
              if (playerRef.current) {
                try {
                  playerRef.current.destroy();
                } catch (e) {
                  // Ignore
                }
                playerRef.current = null;
              }
              
              toast.info('🎵 Spotify Track Loaded', {
                description: 'Click ▶️ Play to start listening',
                duration: 4000
              });
            } else {
            toast.error('Could not restore player', {
                description: 'Track info saved, click ▶️ Play to start'
            });
            }
          }
        };
        
        restorePlayer();
      }
    }
    
    // Restore player settings (volume, repeat, shuffle, minimized, position)
    const savedSettings = loadPlayerSettings();
    if (savedSettings) {
      console.log('📥 Restoring player settings...', savedSettings);
      setVolume(savedSettings.volume);
      setIsMuted(savedSettings.isMuted);
      setIsShuffled(savedSettings.isShuffled);
      setRepeatMode(savedSettings.repeatMode);
      setIsPlayerMinimized(savedSettings.isMinimized);
    }
  }, []); // Only run on mount

  // ============ PERSISTENCE: SAVE STATE ON CHANGES ============
  // Save player session (queue, current track, position)
  useEffect(() => {
    if (currentPlayingTrack || playlistQueue.length > 0) {
      const session = {
        currentTrack: currentPlayingTrack,
        currentQueue: playlistQueue,
        currentTime: currentTime,
        isPlaying: false, // Always save as paused
        timestamp: Date.now()
      };
      savePlayerSession(session);
    }
  }, [currentPlayingTrack, playlistQueue, currentTime]);

  // Save player settings
  useEffect(() => {
    const settings = {
      volume,
      isMuted,
      isShuffled,
      repeatMode,
      isMinimized: isPlayerMinimized
    };
    savePlayerSettings(settings);
  }, [volume, isMuted, isShuffled, repeatMode, isPlayerMinimized]);

  // Save track list whenever it changes (skip if in private mode)
  useEffect(() => {
    if (tracks.length > 0 && !isPrivateMode) {
      // Clean tracks: remove download status/progress before saving
      const cleanTracks = tracks.map(track => ({
        ...track,
        downloadStatus: 'pending' as const, // Reset to pending
        downloadProgress: 0,                 // Reset progress
      }));
      
      const trackList = {
        tracks: cleanTracks,
        playlistUrl,
        playlistName,
        playlistImages,
        timestamp: Date.now()
      };
      saveCurrentTrackList(trackList);
      console.log('💾 Auto-saved tracklist to localStorage (without download states)');
    } else if (isPrivateMode) {
      console.log('🔒 Private mode: Skipping auto-save to localStorage');
    }
  }, [tracks, playlistUrl, playlistName, playlistImages, isPrivateMode]);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Load YouTube IFrame API
  useEffect(() => {
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    const firstScriptTag = document.getElementsByTagName('script')[0];
    firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);

    (window as any).onYouTubeIframeAPIReady = () => {
      console.log('YouTube IFrame API Ready');
    };
  }, []);

  // 🔥 PREVENT AUTO-PAUSE: Keep music playing when tab loses focus or Alt+Tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      // When tab becomes hidden, ensure player keeps playing
      if (document.hidden && isPlaying && playerRef.current) {
        try {
          // Force continue playing even when tab is hidden
          const playerState = playerRef.current.getPlayerState?.();
          if (playerState !== (window as any).YT?.PlayerState?.PLAYING && playerState !== undefined) {
            console.log('🎵 Tab hidden - forcing music to continue playing');
            playerRef.current.playVideo?.();
          }
        } catch (err) {
          console.log('⚠️ Could not resume playback on tab switch');
        }
      }
    };

    const handleFocus = () => {
      // When tab regains focus, sync player state AND ensure player is loaded
      console.log('🎵 Tab focused, checking player state');
      
      if (isPlaying && playerRef.current) {
        try {
          const playerState = playerRef.current.getPlayerState?.();
          if (playerState !== (window as any).YT?.PlayerState?.PLAYING && playerState !== undefined) {
            console.log('🎵 Tab focused - resuming music');
            playerRef.current.playVideo?.();
          }
        } catch (err) {
          // Ignore
        }
      }
      
      // 🔥 CRITICAL: If we have a current track but no player, force reinitialize
      if (currentPlayingTrack && !playerRef.current) {
        console.log('🔥 Tab focused - Player missing, forcing reinitialize for:', currentPlayingTrack.name);
        // Trigger reinitialize by calling playTrack again
        setTimeout(() => {
          if (currentPlayingTrack) {
            console.log('🔄 Reinitializing player for track:', currentPlayingTrack.name);
            playTrack(currentPlayingTrack);
          }
        }, 100);
      }
    };

    // Listen for visibility changes (tab switches, minimize window, etc.)
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('blur', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('blur', handleVisibilityChange);
    };
  }, [isPlaying, currentPlayingTrack]); // Added currentPlayingTrack to dependencies

  // Audio player functions
  const getYouTubeId = (url: string): string | null => {
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
      /youtube\.com\/watch\?.*v=([^&\n?#]+)/
    ];
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) return match[1];
    }
    return null;
  };
  
  // Validate YouTube ID (11 characters, alphanumeric + _ and -)
  const isValidYouTubeId = (id: string | null | undefined): boolean => {
    if (!id) return false;
    // YouTube IDs are typically 11 characters: letters, numbers, - and _
    const youtubeIdPattern = /^[a-zA-Z0-9_-]{11}$/;
    return youtubeIdPattern.test(id);
  };
  
  // Load YouTube ID cache from localStorage
  const loadYoutubeCache = (): Map<string, string> => {
    try {
      const cached = localStorage.getItem('youtube-id-cache');
      if (cached) {
        const parsed = JSON.parse(cached);
        return new Map(Object.entries(parsed));
      }
    } catch (e) {
      console.log('⚠️ Failed to load YouTube cache:', e);
    }
    return new Map();
  };
  
  // Save YouTube ID cache to localStorage
  const saveYoutubeCache = (cache: Map<string, string>) => {
    try {
      const obj = Object.fromEntries(cache);
      localStorage.setItem('youtube-id-cache', JSON.stringify(obj));
    } catch (e) {
      console.log('⚠️ Failed to save YouTube cache:', e);
    }
  };
  
  // Background prefetch YouTube IDs for Spotify tracks
  const prefetchYoutubeIds = async (tracks: Track[]) => {
    const cache = loadYoutubeCache();
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    
    // Find tracks that need YouTube IDs
    const tracksToFetch = tracks.filter(track => {
      // Skip if already has valid YouTube ID
      if (track.youtubeId && isValidYouTubeId(track.youtubeId)) return false;
      
      // Skip if in cache
      if (cache.has(track.id)) return false;
      
      // Skip if already has YouTube URL
      const youtubeId = getYouTubeId(track.url);
      if (youtubeId && isValidYouTubeId(youtubeId)) {
        cache.set(track.id, youtubeId);
        return false;
      }
      
      return true; // Needs fetching
    });
    
    if (tracksToFetch.length === 0) {
      console.log('✅ All tracks already have YouTube IDs cached');
      setYoutubeIdCache(cache);
      return;
    }
    
    console.log(`🔄 Prefetching YouTube IDs for ${tracksToFetch.length} tracks...`);
    
    // Fetch in batches to avoid overwhelming the server
    const batchSize = 3;
    for (let i = 0; i < tracksToFetch.length; i += batchSize) {
      const batch = tracksToFetch.slice(i, i + batchSize);
      
      await Promise.all(batch.map(async (track) => {
        try {
          const searchQuery = `${track.artist} ${track.name}`;
          const response = await fetch(`${apiUrl}/api/youtube/search?query=${encodeURIComponent(searchQuery)}&limit=1`);
          
          if (response.ok) {
            const data = await response.json();
            if (data.results && data.results.length > 0) {
              const youtubeId = getYouTubeId(data.results[0].url);
              if (youtubeId && isValidYouTubeId(youtubeId)) {
                cache.set(track.id, youtubeId);
                console.log(`✅ Cached: ${track.name} -> ${youtubeId}`);
              }
            }
          }
        } catch (error) {
          console.log(`⚠️ Prefetch failed for ${track.name}`);
        }
      }));
      
      // Small delay between batches
      if (i + batchSize < tracksToFetch.length) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    saveYoutubeCache(cache);
    setYoutubeIdCache(cache);
    console.log(`✅ Prefetch complete! Cached ${cache.size} YouTube IDs`);
  };

  const playTrack = async (track: Track) => {
    console.log('🎵 playTrack called for:', track.name);
    
    // If same track, toggle play/pause
    if (currentPlayingTrack?.id === track.id && playerRef.current && isPlayerReady) {
      if (isPlaying) {
        playerRef.current.pauseVideo();
        setIsPlaying(false);
      } else {
        playerRef.current.playVideo();
        setIsPlaying(true);
      }
      return;
    }
    
    // Set loading state
    setIsPlayerLoading(true);
    setIsPlayerReady(false);
    setPlayerLoadProgress(10);

    let youtubeId = getYouTubeId(track.url);
    
    // If no URL, try using the track's youtubeId or id directly
    if (!youtubeId) {
      youtubeId = track.youtubeId || track.id;
      
      // Remove "search-" prefix if present (from YouTube search results)
      if (youtubeId && youtubeId.startsWith('search-')) {
        youtubeId = youtubeId.replace('search-', '');
      }
    }
    
    // Validate the YouTube ID before using it
    if (youtubeId && !isValidYouTubeId(youtubeId)) {
      console.log('⚠️ Invalid YouTube ID detected:', youtubeId, '- will check cache');
      youtubeId = null; // Force a search or cache lookup
    }
    
    // Check cache first for Spotify tracks (instant playback!)
    if (!youtubeId && youtubeIdCache.has(track.id)) {
      youtubeId = youtubeIdCache.get(track.id) || null;
      console.log('⚡ CACHE HIT! Instant playback for:', track.name);
      toast.success('🎵 Ready to play!', { duration: 1000 });
    }
    
    // If not a YouTube URL and not in cache, search for it on YouTube
    if (!youtubeId) {
      toast.info(`Searching YouTube for: ${track.artist} - ${track.name}`);
      
      try {
        const searchQuery = `${track.artist} ${track.name}`;
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
        const response = await fetch(`${apiUrl}/api/youtube/search?query=${encodeURIComponent(searchQuery)}&limit=1`);
        
        if (!response.ok) {
          throw new Error('Search failed');
        }
        
        const data = await response.json();
        
        if (data.results && data.results.length > 0) {
          youtubeId = getYouTubeId(data.results[0].url);
          if (!youtubeId) {
            toast.error('Could not find a playable version on YouTube');
            return;
          }
          
          // Cache the result for next time
          const newCache = new Map<string, string>(youtubeIdCache);
          newCache.set(track.id, youtubeId);
          setYoutubeIdCache(newCache);
          saveYoutubeCache(newCache);
          console.log('💾 Cached YouTube ID for:', track.name);
          
          toast.success('Found on YouTube!');
        } else {
          toast.error('Could not find this track on YouTube');
          return;
        }
      } catch (error) {
        console.error('Search error:', error);
        toast.error('Failed to search for track on YouTube');
        return;
      }
    }

    // Final validation before playing
    if (!isValidYouTubeId(youtubeId)) {
      console.error('❌ Cannot play - invalid YouTube ID:', youtubeId);
      toast.error('Invalid video ID. Cannot play this track.');
      return;
    }
    
    console.log('✅ Valid YouTube ID confirmed:', youtubeId);
    currentYoutubeIdRef.current = youtubeId || null;

    // Play new track - Update track object with youtubeId for FullScreenPlayer
    const trackWithYoutubeId = { ...track, youtubeId };
    setCurrentPlayingTrack(trackWithYoutubeId);
    setIsPlaying(true);
    setPlayerLoadProgress(90);
    
    // 🔥 FIX: Don't reset time if we have a pending seek (Spotify restoration)
    if (pendingSeekTimeRef.current === null) {
    setCurrentTime(0);
    } else {
      console.log('⏱️ Keeping current time for pending seek:', pendingSeekTimeRef.current + 's');
    }
    
    setDuration(track.duration);

    // Create YouTube player
    if (!(window as any).YT) {
      toast.error('YouTube player not loaded yet. Please try again.');
      return;
    }

    // Check if player exists AND has valid YouTube methods
    if (playerRef.current && playerRef.current.loadVideoById && typeof playerRef.current.loadVideoById === 'function') {
      try {
        console.log('📺 Using existing player, loading video:', youtubeId);
        
        // 🔥 CRITICAL: Re-attach error handler with fresh references for loadVideoById
        if (playerRef.current.addEventListener) {
          // Remove old listener first (if possible)
          try {
            playerRef.current.removeEventListener('onError');
          } catch (e) {
            // Ignore if not supported
          }
          
          // Add fresh error handler with current refs
          playerRef.current.addEventListener('onError', async (event: any) => {
            console.error('❌ YouTube Player Error (loadVideoById):', event.data);
            console.log('📍 Track in error handler:', currentPlayingTrackRef.current ? currentPlayingTrackRef.current.name : 'undefined');
            
            if (event.data === 101 || event.data === 150) {
              const currentTrack = currentPlayingTrackRef.current;
              const currentYoutubeId = currentYoutubeIdRef.current;

              if (currentTrack && currentYoutubeId) {
                // Mark current id as blocked for this track
                const blockedForTrack = blockedYoutubeIdCacheRef.current.get(currentTrack.id) || new Set<string>();
                blockedForTrack.add(currentYoutubeId);
                blockedYoutubeIdCacheRef.current.set(currentTrack.id, blockedForTrack);
                console.log('⛔ Marked blocked YT id for', currentTrack.name, currentYoutubeId);
                
                // Remove blocked id from cache so it is not reused
                if (youtubeIdCache.has(currentTrack.id)) {
                  const newCache = new Map<string, string>(youtubeIdCache);
                  newCache.delete(currentTrack.id);
                  setYoutubeIdCache(newCache);
                  saveYoutubeCache(newCache);
                  console.log('🗑️ Removed blocked YT id from cache for', currentTrack.name);
                }

                console.log('🔄 Attempting auto-search for alternative version...');
                toast.info('🔄 Searching for alternative playable version...');
                try {
                  const searchQuery = `${currentTrack.artist} ${currentTrack.name} audio`;
                  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                  console.log('🔍 Searching:', searchQuery);
                  const response = await fetch(`${apiUrl}/api/youtube/search?query=${encodeURIComponent(searchQuery)}&limit=3`);
                  
                  if (response.ok) {
                    const data = await response.json();
                    console.log('📦 Search results:', data.results?.length || 0);
                    
                    let foundAlternative = false;
                    for (const result of data.results || []) {
                      const altYoutubeId = getYouTubeId(result.url);
                      console.log('🧪 Testing alternative:', altYoutubeId);
                      if (altYoutubeId && isValidYouTubeId(altYoutubeId) && !blockedForTrack.has(altYoutubeId)) {
                        console.log('✅ Found valid alternative:', altYoutubeId);
                        
                        const newCache = new Map<string, string>(youtubeIdCache);
                        newCache.set(currentTrack.id, altYoutubeId);
                        setYoutubeIdCache(newCache);
                        saveYoutubeCache(newCache);
                        
                        playTrack({ ...currentTrack, youtubeId: altYoutubeId });
                        toast.success('✅ Found alternative version!');
                        foundAlternative = true;
                        return;
                      }
                    }
                    if (!foundAlternative) {
                      console.log('❌ No unblocked alternative found after search.');
                      toast.error('No playable version available. Skipping to next track.');
                      playNext(); // Skip to next track
                    }
                  } else {
                    console.error('❌ Search API failed:', response.status);
                    toast.error('Search for alternatives failed. Skipping to next track.');
                    playNext(); // Skip to next track
                  }
                } catch (err) {
                  console.error('❌ Alternative search failed:', err);
                  toast.error('Alternative search failed. Skipping to next track.');
                  playNext(); // Skip to next track
                }
              } else {
                console.error('❌ No track info available for alternative search');
                toast.error('Cannot find track info for alternative search. Skipping to next track.');
                playNext(); // Skip to next track
              }
            }
          });
        }
        
      playerRef.current.loadVideoById(youtubeId);
      // Set volume after a short delay to ensure it's applied after video loads
      setTimeout(() => {
          if (playerRef.current && playerRef.current.setVolume) {
          playerRef.current.setVolume(volumeRef.current);
          if (isMutedRef.current) {
            playerRef.current.mute();
          } else {
            playerRef.current.unMute();
          }
        }
      }, 100);
        return; // Successfully loaded, exit early
      } catch (error) {
        console.error('❌ Error loading video, recreating player:', error);
        // Player is corrupt, destroy and recreate
        try {
          if (playerRef.current.destroy && typeof playerRef.current.destroy === 'function') {
            playerRef.current.destroy();
          }
        } catch (e) {
          console.log('⚠️ Destroy failed (ignored):', e);
        }
        playerRef.current = null;
        // Wait a bit before recreating
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    if (!playerRef.current) {
      // Ensure the player container exists in the DOM
      const playerElement = document.getElementById('youtube-player');
      if (!playerElement) {
        console.error('YouTube player container not found in DOM');
        toast.error('Player initialization failed. Please refresh the page.');
        return;
      }
      
      console.log('🎬 Creating new YouTube player...');
      playerRef.current = new (window as any).YT.Player('youtube-player', {
        height: '0',
        width: '0',
        videoId: youtubeId,
        playerVars: {
          autoplay: 1,
          controls: 0,
        },
        events: {
          onReady: (event: any) => {
            setPlayerLoadProgress(70);
            event.target.setVolume(volumeRef.current);
            if (isMutedRef.current) {
              event.target.mute();
            } else {
              event.target.unMute();
            }
            
            // 🔥 FIX: Check if we need to seek to a saved position (for Spotify restoration)
            if (pendingSeekTimeRef.current !== null && pendingSeekTimeRef.current > 0) {
              const seekTime = pendingSeekTimeRef.current;
              console.log('⏩ Seeking to saved position:', seekTime + 's');
              
              // Wait for player to be fully ready, then seek
              setTimeout(() => {
                try {
                  event.target.seekTo(seekTime, true);
                  setCurrentTime(seekTime);
                  console.log('✅ Restored position:', seekTime + 's');
                  toast.success('🎵 Position Restored!', { 
                    description: `Resumed at ${Math.floor(seekTime / 60)}:${String(Math.floor(seekTime % 60)).padStart(2, '0')}`,
                    duration: 2000 
                  });
                } catch (err) {
                  console.error('❌ Failed to seek:', err);
                }
                // Clear the pending seek time
                pendingSeekTimeRef.current = null;
              }, 1000);
            } else {
            event.target.playVideo();
            }
          },
          onStateChange: (event: any) => {
            if (event.data === (window as any).YT.PlayerState.ENDED) {
              console.log('🔚 Track ended (playTrack player)! Repeat mode:', repeatModeRef.current);
              // Handle track end based on repeat mode using refs
              const mode = repeatModeRef.current;
              
              if (mode === 'one') {
                console.log('🔁 Repeating same track...');
                // Repeat current track - DO NOT go to next
                if (playerRef.current) {
                  playerRef.current.seekTo(0, true);
                  playerRef.current.playVideo();
                }
                return; // Exit early - don't process any other mode
              }
              
              if (mode === 'all') {
                console.log('🔁 Repeat All - finding next track...');
                // Auto-play next track (will loop)
                const queue = isPlayingAllRef.current ? playlistQueueRef.current : tracksRef.current;
                const currentTrack = currentPlayingTrackRef.current;
                const shuffled = isShuffledRef.current;
                
                console.log('📋 Queue length:', queue.length, 'Current track:', currentTrack?.name, 'playTrackRef:', !!playTrackRef.current);
                
                if (currentTrack && queue.length > 0) {
                  const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
                  let nextIndex;
                  
                  if (shuffled) {
                    // Random next track (exclude current)
                    const availableIndices = queue.map((_, i) => i).filter(i => i !== currentIndex);
                    nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                  } else {
                    nextIndex = currentIndex + 1;
                  }
                  
                  console.log('⏭️ Current index:', currentIndex, 'Next index:', nextIndex, 'Queue length:', queue.length);
                  
                  if (nextIndex < queue.length && playTrackRef.current) {
                    console.log('▶️ Playing next track:', queue[nextIndex].name);
                    playTrackRef.current(queue[nextIndex]);
                  } else {
                    console.log('🔄 Looping back to start...');
                    // Loop back to start (or random if shuffled)
                    if (shuffled && queue.length > 1 && playTrackRef.current) {
                      const randomIndex = Math.floor(Math.random() * queue.length);
                      console.log('🎲 Random track:', queue[randomIndex].name);
                      playTrackRef.current(queue[randomIndex]);
                    } else if (playTrackRef.current) {
                      console.log('🔙 Playing first track:', queue[0].name);
                      playTrackRef.current(queue[0]);
                    }
                  }
                } else {
                  console.log('❌ Cannot find next track - no current track or empty queue');
                }
              } else {
                // mode === 'off' - play next but don't loop
                const queue = isPlayingAllRef.current ? playlistQueueRef.current : tracksRef.current;
                const currentTrack = currentPlayingTrackRef.current;
                const shuffled = isShuffledRef.current;
                
                if (currentTrack && queue.length > 0) {
                  const currentIndex = queue.findIndex(t => t.id === currentTrack.id);
                  
                  if (shuffled) {
                    // Random next track (exclude current and already played)
                    const availableIndices = queue.map((_, i) => i).filter(i => i !== currentIndex);
                    if (availableIndices.length > 0 && playTrackRef.current) {
                      const nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
                      playTrackRef.current(queue[nextIndex]);
                    } else {
                      // No more tracks
                      setIsPlaying(false);
                      setCurrentPlayingTrack(null);
                      toast.info('🎵 Playlist finished');
                    }
                  } else {
                    if (currentIndex < queue.length - 1 && playTrackRef.current) {
                      playTrackRef.current(queue[currentIndex + 1]);
                    } else {
                      // End of playlist
                      setIsPlaying(false);
                      setCurrentPlayingTrack(null);
                      toast.info('🎵 Playlist finished');
                    }
                  }
                }
              }
            } else if (event.data === (window as any).YT.PlayerState.PLAYING) {
              setIsPlaying(true);
              // 🔥 CRITICAL FIX: Clear loading states when music starts playing
              setIsPlayerLoading(false);
              setIsPlayerReady(true);
              setIsRestoringPlayer(false);
              setPlayerLoadProgress(100);
              
              setDuration(event.target.getDuration());
              // Ensure volume is correctly set when playback starts
              event.target.setVolume(volumeRef.current);
              if (isMutedRef.current) {
                event.target.mute();
              } else {
                event.target.unMute();
              }
            } else if (event.data === (window as any).YT.PlayerState.PAUSED) {
              setIsPlaying(false);
            }
          },
          onError: async (event: any) => {
            console.error('❌ YouTube Player Error:', event.data);
            console.log('📍 Track in new player error handler:', track ? track.name : 'undefined');
            
            let errorMessage = 'Player error';
            
            // YouTube error codes:
            // 2 - Invalid video ID
            // 5 - HTML5 player error
            // 100 - Video not found
            // 101, 150 - Video not allowed to be played in embedded players
            
            if (event.data === 2) {
              errorMessage = 'Invalid video ID - cannot play this track';
            } else if (event.data === 100) {
              errorMessage = 'Video not found or removed';
            } else if (event.data === 101 || event.data === 150) {
              errorMessage = 'Video embedding restricted';
              
              // Try to find alternative version - use track from closure
              if (track) {
                // Mark current id as blocked and remove from cache so it is not reused
                const blockedForTrack = blockedYoutubeIdCacheRef.current.get(track.id) || new Set<string>();
                if (currentYoutubeIdRef.current) blockedForTrack.add(currentYoutubeIdRef.current);
                blockedYoutubeIdCacheRef.current.set(track.id, blockedForTrack);
                if (youtubeIdCache.has(track.id)) {
                  const newCache = new Map<string, string>(youtubeIdCache);
                  newCache.delete(track.id);
                  setYoutubeIdCache(newCache);
                  saveYoutubeCache(newCache);
                  console.log('🗑️ Removed blocked YT id from cache for', track.name);
                }
                console.log('🔄 Attempting auto-search for alternative version...');
                toast.info('🔄 Searching for alternative playable version...');
                try {
                  const searchQuery = `${track.artist} ${track.name} audio`;
                  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
                  console.log('🔍 Searching:', searchQuery);
                  const response = await fetch(`${apiUrl}/api/youtube/search?query=${encodeURIComponent(searchQuery)}&limit=3`);
                  
                  if (response.ok) {
                    const data = await response.json();
                    console.log('📦 Search results:', data.results?.length || 0);
                    
                      // Try each result until we find one that works (skip blocked IDs)
                      const blockedForTrack = blockedYoutubeIdCacheRef.current.get(track.id) || new Set<string>();
                    for (const result of data.results || []) {
                      const altYoutubeId = getYouTubeId(result.url);
                      console.log('🧪 Testing alternative:', altYoutubeId);
                      if (altYoutubeId && isValidYouTubeId(altYoutubeId) && !blockedForTrack.has(altYoutubeId)) {
                        console.log('✅ Found valid alternative:', altYoutubeId);
                        
                        // Update cache with new ID
                        const newCache = new Map<string, string>(youtubeIdCache);
                        newCache.set(track.id, altYoutubeId);
                        setYoutubeIdCache(newCache);
                        saveYoutubeCache(newCache);
                        
                        // Retry with new ID
                        playTrack({ ...track, youtubeId: altYoutubeId });
                        toast.success('✅ Found alternative version!');
                        return;
                      }
                    }
                  } else {
                    console.error('❌ Search API failed:', response.status);
                  }
                } catch (err) {
                  console.error('❌ Alternative search failed:', err);
                }
                toast.error('No playable version available for this track');
              } else {
                console.error('❌ No track info available for alternative search');
              }
            }
            
            toast.error(errorMessage);
            setIsPlaying(false);
            setCurrentPlayingTrack(null);
            setIsPlayerLoading(false);
            setIsPlayerReady(false);
            setPlayerLoadProgress(0);
          },
        },
      });
      
      // Set player as ready after successful creation with fallback timeout
      setTimeout(() => {
        setPlayerLoadProgress(100);
        setIsPlayerLoading(false);
        setIsPlayerReady(true);
        setIsRestoringPlayer(false);
        console.log('✅ Player ready - loading states cleared (timeout fallback)');
      }, 1000);
      
      // Additional fallback to clear loading states after 3 seconds
      setTimeout(() => {
        if (isPlayerLoading) {
          console.log('⚠️ Clearing loading states after 3s timeout');
          setIsPlayerLoading(false);
          setIsPlayerReady(true);
          setIsRestoringPlayer(false);
          setPlayerLoadProgress(100);
        }
      }, 3000);
    }
  };

  // Keep playTrack ref updated
  useEffect(() => {
    playTrackRef.current = playTrack;
  }, [playTrack]);

  // Update current time
  useEffect(() => {
    if (!isPlaying || !playerRef.current) return;

    const interval = setInterval(() => {
      if (playerRef.current && playerRef.current.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 100);

    return () => clearInterval(interval);
  }, [isPlaying]);

  // Update browser tab title when playing music
  useEffect(() => {
    const originalTitle = document.title;
    
    if (currentPlayingTrack && isPlaying) {
      document.title = `▶ ${currentPlayingTrack.name} - ${currentPlayingTrack.artist}`;
    } else if (currentPlayingTrack && !isPlaying) {
      document.title = `⏸ ${currentPlayingTrack.name} - ${currentPlayingTrack.artist}`;
    } else {
      document.title = originalTitle;
    }

    return () => {
      document.title = originalTitle;
    };
  }, [currentPlayingTrack, isPlaying]);

  const togglePlayPause = () => {
    if (!currentPlayingTrack) return;
    
    // 🔥 FIX: If no player exists (e.g., Spotify track failed restoration), start fresh
    if (!playerRef.current) {
      console.log('⚠️ No player exists, starting fresh playback...');
      playTrack(currentPlayingTrack);
      return;
    }
    
    // Verify player has required methods
    if (typeof playerRef.current.pauseVideo !== 'function' || 
        typeof playerRef.current.playVideo !== 'function') {
      console.log('⚠️ Player methods not ready, attempting to replay track...');
      // Player exists but not ready - try to play the current track again
      playTrack(currentPlayingTrack);
      return;
    }
    
    try {
    if (isPlaying) {
      playerRef.current.pauseVideo();
      setIsPlaying(false);
    } else {
      playerRef.current.playVideo();
      setIsPlaying(true);
      }
    } catch (error) {
      console.error('❌ togglePlayPause error:', error);
      // If there's an error, recreate the player
      playTrack(currentPlayingTrack);
    }
  };

  const playNext = () => {
    const queue = isPlayingAll ? playlistQueue : tracks;
    if (!currentPlayingTrack || queue.length === 0) return;
    
    let nextIndex;
    const currentIndex = queue.findIndex(t => t.id === currentPlayingTrack.id);
    
    if (isShuffled) {
      // Random next track
      const availableIndices = queue.map((_, i) => i).filter(i => i !== currentIndex);
      nextIndex = availableIndices[Math.floor(Math.random() * availableIndices.length)];
    } else {
      nextIndex = currentIndex + 1;
    }
    
    if (nextIndex < queue.length) {
      playTrack(queue[nextIndex]);
    } else if (repeatMode === 'all') {
      // Loop back to start when repeat all is enabled
      playTrack(queue[0]);
    } else {
      // End of playlist
      setIsPlaying(false);
      setCurrentPlayingTrack(null);
    }
  };

  const playPrevious = () => {
    const queue = isPlayingAll ? playlistQueue : tracks;
    if (!currentPlayingTrack || queue.length === 0) return;
    
    const currentIndex = queue.findIndex(t => t.id === currentPlayingTrack.id);
    if (currentIndex > 0) {
      playTrack(queue[currentIndex - 1]);
    }
  };

  const seekTo = (time: number) => {
    if (playerRef.current && playerRef.current.seekTo && typeof playerRef.current.seekTo === 'function') {
      try {
      playerRef.current.seekTo(time, true);
      setCurrentTime(time);
        // If hosting a live session, immediately propagate seek (even when paused)
        if (isLiveHost && liveRoomId) {
          try {
            liveListeningService.updatePlaybackState(
              currentPlayingTrack,
              time,
              isPlaying,
              playlistQueue
            );
          } catch {}
        }
      } catch (error) {
        console.error('Error seeking:', error);
      }
    }
  };

  const toggleMute = () => {
    if (!playerRef.current) return;
    
    if (typeof playerRef.current.mute !== 'function' || 
        typeof playerRef.current.unMute !== 'function') {
      return;
    }
    
    try {
      if (isMuted) {
        playerRef.current.unMute();
        setIsMuted(false);
      } else {
        playerRef.current.mute();
        setIsMuted(true);
      }
    } catch (error) {
      console.error('❌ toggleMute error:', error);
    }
  };

  const changeVolume = (newVolume: number) => {
    if (playerRef.current && playerRef.current.setVolume && typeof playerRef.current.setVolume === 'function') {
      try {
      playerRef.current.setVolume(newVolume);
      setVolume(newVolume);
      if (newVolume > 0 && isMuted) {
        setIsMuted(false);
          if (playerRef.current.unMute) {
        playerRef.current.unMute();
          }
        }
      } catch (error) {
        console.error('Error changing volume:', error);
      }
    }
  };

  const playAllTracks = () => {
    if (tracks.length === 0) {
      toast.error('No tracks available to play');
      return;
    }
    
    // Play all tracks (both YouTube and Spotify - will auto-search for Spotify tracks)
    setPlaylistQueue(tracks);
    setIsPlayingAll(true);
    playTrack(tracks[0]);
    toast.success(`Playing all ${tracks.length} tracks`);
  };

  const toggleRepeatMode = () => {
    const modes: Array<'off' | 'all' | 'one'> = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setRepeatMode(nextMode);
    
    const messages = {
      'off': 'Repeat off',
      'all': 'Repeat all tracks',
      'one': 'Repeat current track'
    };
    toast.success(messages[nextMode]);
  };

  const toggleShuffle = () => {
    setIsShuffled(!isShuffled);
    toast.success(isShuffled ? 'Shuffle off' : 'Shuffle on');
  };

  // PiP toggle function
  const togglePiP = () => {
    if (isPipSupported) {
      // Send message to PiP component to toggle
      window.dispatchEvent(new CustomEvent('togglePiP'));
    }
  };

  // Comprehensive keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only trigger if not typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Only handle if we have a current track
      if (!currentPlayingTrack) return;
      
      switch (e.code) {
        case 'Space':
          e.preventDefault();
          togglePlayPause();
          break;
        
        case 'ArrowRight':
          e.preventDefault();
          // Seek forward 10 seconds
          if (playerRef.current && playerRef.current.getCurrentTime && typeof playerRef.current.getCurrentTime === 'function') {
            try {
              const currentTime = playerRef.current.getCurrentTime();
              const newTime = Math.min(currentTime + 10, duration);
              seekTo(newTime);
            } catch (error) {
              console.error('Error seeking forward:', error);
            }
          }
          break;
        
        case 'ArrowLeft':
          e.preventDefault();
          // Seek backward 10 seconds
          if (playerRef.current && playerRef.current.getCurrentTime && typeof playerRef.current.getCurrentTime === 'function') {
            try {
              const currentTime = playerRef.current.getCurrentTime();
              const newTime = Math.max(currentTime - 10, 0);
              seekTo(newTime);
            } catch (error) {
              console.error('Error seeking backward:', error);
            }
          }
          break;
        
        case 'ArrowUp':
          e.preventDefault();
          changeVolume(Math.min(100, volume + 5));
          break;
        
        case 'ArrowDown':
          e.preventDefault();
          changeVolume(Math.max(0, volume - 5));
          break;
        
        case 'KeyM':
        case 'm':
          e.preventDefault();
          toggleMute();
          break;
        
        case 'KeyS':
          e.preventDefault();
          toggleShuffle();
          break;
        
        case 'KeyR':
          e.preventDefault();
          toggleRepeatMode();
          break;
        
        case 'KeyF':
          e.preventDefault();
          setShowFullScreenPlayer(prev => !prev);
          break;
        
        case 'KeyP':
          if (e.ctrlKey) {
            e.preventDefault();
            togglePiP();
          }
          break;
        
        case 'KeyN':
          e.preventDefault();
          playNext();
          break;
        
        case 'KeyB':
          e.preventDefault();
          playPrevious();
          break;
        
        case 'Comma':
          e.preventDefault();
          playPrevious();
          break;
        
        case 'Period':
          e.preventDefault();
          playNext();
          break;
        
        case 'Digit0':
          e.preventDefault();
          seekTo(0);
          break;
        
        case 'Digit1':
        case 'Digit2':
        case 'Digit3':
        case 'Digit4':
        case 'Digit5':
        case 'Digit6':
        case 'Digit7':
        case 'Digit8':
        case 'Digit9':
          e.preventDefault();
          const percentage = parseInt(e.code.replace('Digit', '')) * 10;
          if (duration > 0) {
            seekTo((percentage / 100) * duration);
          }
          break;
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [currentPlayingTrack, volume, duration, isPipSupported, togglePlayPause, playNext, playPrevious, changeVolume, toggleMute, toggleShuffle, toggleRepeatMode, seekTo, togglePiP]);

  const cyclePlayerPosition = () => {
    const positions: Array<'bottom' | 'bottom-left' | 'bottom-right'> = ['bottom', 'bottom-left', 'bottom-right'];
    const currentIndex = positions.indexOf(playerPosition);
    const nextPosition = positions[(currentIndex + 1) % positions.length];
    setPlayerPosition(nextPosition);
  };

  const openTrackDetails = (track: Track) => {
    setSelectedTrackForDetails(track);
    setShowTrackDetails(true);
  };

  // ========== 🎧 LIVE LISTENING FUNCTIONS ==========

  const handleStartLiveSession = (hostName: string) => {
    // Create live room with current queue
    liveListeningService.createRoom(
      hostName,
      currentPlayingTrack,
      currentTime,
      isPlaying,
      playlistQueue
    );

    // Setup event listeners
    liveListeningService.onRoomCreated((data) => {
      setIsLiveHost(true);
      setLiveRoomId(data.roomId);
      setLiveListenerCount(0);
      setShowShareLiveDialog(true);
      toast.success('🎧 Live session started!');
    });

    liveListeningService.onListenerCountUpdated((data) => {
      setLiveListenerCount(data.listenerCount);
    });

    liveListeningService.onListenerJoined((data) => {
      toast.success(`${data.userName} joined your session! 👋`);
    });

    liveListeningService.onRoomError((data) => {
      toast.error(data.message);
      setIsLiveHost(false);
      setLiveRoomId(null);
    });
  };

  const handleEndLiveSession = () => {
    if (liveRoomId) {
      liveListeningService.endRoom();
      setIsLiveHost(false);
      setLiveRoomId(null);
      setLiveListenerCount(0);
      setShowShareLiveDialog(false);
      toast.success('Live session ended');
    }
  };

  // Sync playback state with listeners when host makes changes
  useEffect(() => {
    if (isLiveHost && liveRoomId) {
      liveListeningService.updatePlaybackState(
        currentPlayingTrack,
        currentTime,
        isPlaying,
        playlistQueue
      );
    }
  }, [currentPlayingTrack?.id, isPlaying, isLiveHost, liveRoomId]);

  // Periodic sync for time updates (every 5 seconds)
  useEffect(() => {
    if (!isLiveHost || !liveRoomId || !isPlaying) return;

    const syncInterval = setInterval(() => {
      liveListeningService.updatePlaybackState(
        currentPlayingTrack,
        currentTime,
        isPlaying,
        playlistQueue
      );
    }, 5000);

    return () => clearInterval(syncInterval);
  }, [isLiveHost, liveRoomId, isPlaying, currentPlayingTrack, currentTime]);

  // Prevent host from closing/reloading during live session
  useEffect(() => {
    if (!isLiveHost || !liveRoomId) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = ''; // Chrome requires returnValue to be set
      return 'You have an active Live Listening session. If you leave, the session will end for all listeners. Are you sure you want to leave?';
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isLiveHost, liveRoomId]);

  // Drag and drop handlers
  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const newTracks = [...tracks];
      const [draggedTrack] = newTracks.splice(draggedIndex, 1);
      newTracks.splice(dragOverIndex, 0, draggedTrack);
      
      setTracks(newTracks);
      if (onTracksUpdate) {
        onTracksUpdate(newTracks);
      }
      
      toast.success('Track reordered');
    }
    
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  // Manual save function
  const handleSavePlaylist = async () => {
    if (!savePlaylistName.trim()) {
      toast.error('Please enter a playlist name');
      return;
    }

    const success = await savePlaylistToHistory(
      savePlaylistName,
      playlistUrl || `custom-${Date.now()}`,
      playlistImages[0] || '/placeholder.svg',
      tracks.length,
      'You',
      `Custom playlist with ${tracks.length} tracks`,
      tracks,  // Save the actual tracks array
      // Duplicate confirmation callback
      async (existingPlaylist) => {
        return new Promise((resolve) => {
          setDuplicateInfo({
            existingPlaylist,
            newTrackCount: tracks.length,
            resolve
          });
          setShowDuplicateConfirmDialog(true);
        });
      }
    );

    if (success) {
      toast.success('Playlist saved successfully!', {
        description: `${savePlaylistName} (${tracks.length} tracks)`
      });
      setShowSaveDialog(false);
    } else if (success === false) {
      // Only show error if it's not a cancellation
      toast.error('Operation cancelled');
    }
  };

  // Handle duplicate confirmation actions
  const handleDuplicateAction = (action: 'replace' | 'new' | 'cancel') => {
    if (duplicateInfo) {
      duplicateInfo.resolve(action);
      setShowDuplicateConfirmDialog(false);
      setDuplicateInfo(null);
    }
  };

  // Note: Reset session handler moved to PlaylistHeader component

  const getStatusIcon = (status: Track['downloadStatus'], progress: number, track?: Track) => {
    switch (status) {
      case 'completed':
        return (
          <div className="p-2 bg-success/20 rounded-lg">
            <Check className="w-4 h-4 text-success" />
          </div>
        );
      case 'failed':
        return (
          <div className="p-2 bg-destructive/20 rounded-lg">
            <X className="w-4 h-4 text-destructive" />
          </div>
        );
      case 'downloading':
        return (
          <div className="p-2 bg-downloading/20 rounded-lg">
            <Loader2 className="w-4 h-4 text-downloading animate-spin" />
          </div>
        );
      default:
        return null; // No icon for pending status
    }
  };

  const getStatusColor = (status: Track['downloadStatus']) => {
    switch (status) {
      case 'completed': return 'text-success';
      case 'failed': return 'text-destructive';
      case 'downloading': return 'text-downloading';
      default: return 'text-muted-foreground';
    }
  };

  const toggleSelectAll = () => {
    const allSelected = tracks.every(t => t.selected);
    setTracks(prev => prev.map(track => ({ ...track, selected: !allSelected })));
  };

  const toggleTrackSelection = (trackId: string) => {
    setTracks(prev => prev.map(track => 
      track.id === trackId ? { ...track, selected: !track.selected } : track
    ));
  };

  // Remove selected tracks from list
  const removeSelected = () => {
    const selectedTracks = tracks.filter(t => t.selected);
    if (selectedTracks.length === 0) {
      toast.error('No tracks selected');
      return;
    }

    setTracksToRemove(selectedTracks);
    setShowRemoveConfirmDialog(true);
  };

  // Confirm remove selected
  const confirmRemoveSelected = () => {
    const remainingTracks = tracks.filter(t => !t.selected);
    setTracks(remainingTracks);
    
    // Update parent if callback exists
    if (onTracksUpdate) {
      onTracksUpdate(remainingTracks);
    }
    
    toast.success(`Removed ${tracksToRemove.length} track${tracksToRemove.length > 1 ? 's' : ''}`, {
      description: `${remainingTracks.length} track${remainingTracks.length !== 1 ? 's' : ''} remaining`
    });
    
    setShowRemoveConfirmDialog(false);
    setTracksToRemove([]);
  };

  const findDuplicates = () => {
    const groupedByKey = new Map<string, Track[]>();
    
    tracks.forEach(track => {
      // Create unique key: lowercase artist + name for better matching
      const key = `${track.artist.toLowerCase().trim()}-${track.name.toLowerCase().trim()}`;
      
      if (!groupedByKey.has(key)) {
        groupedByKey.set(key, []);
      }
      groupedByKey.get(key)!.push(track);
    });
    
    // Filter to only groups with duplicates (more than 1 track)
    const duplicates = Array.from(groupedByKey.entries())
      .filter(([_, tracks]) => tracks.length > 1)
      .map(([key, tracks]) => ({ key, tracks }));
    
    if (duplicates.length > 0) {
      setDuplicateGroups(duplicates);
      setShowDuplicatesDialog(true);
    } else {
      toast.info("No duplicate tracks found ✨", {
        description: "Your playlist is already clean!"
      });
    }
  };

  const confirmRemoveDuplicates = () => {
    const seen = new Map<string, Track>();
    const uniqueTracks: Track[] = [];
    
    tracks.forEach(track => {
      const key = `${track.artist.toLowerCase().trim()}-${track.name.toLowerCase().trim()}`;
      
      if (!seen.has(key)) {
        seen.set(key, track);
        uniqueTracks.push(track);
      }
    });
    
    const removedCount = tracks.length - uniqueTracks.length;
    
    setTracks(uniqueTracks);
    if (onTracksUpdate) {
      onTracksUpdate(uniqueTracks);
    }
    setShowDuplicatesDialog(false);
    toast.success(`Removed ${removedCount} duplicate track${removedCount > 1 ? 's' : ''} 🎉`, {
      description: `Kept ${uniqueTracks.length} unique tracks`
    });
  };

  const handlePlayTrack = (track: Track) => {
    setSelectedTrack(track);
    setShowPlayDialog(true);
  };

  const copyToClipboard = async (text: string, commandType: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`✅ ${commandType} command copied to clipboard!`);
    } catch (error) {
      toast.error('Failed to copy to clipboard');
    }
  };

  const generateYtDlpCommand = (track: Track) => {
    // Search YouTube for the track
    const searchQuery = `${track.artist} ${track.name}`;
    return `yt-dlp "ytsearch:${searchQuery}" --extract-audio --audio-format mp3 --audio-quality 320K`;
  };

  const generateSpotdlCommand = (track: Track) => {
    return `spotdl download "${track.url}" --output "${outputFolder || 'downloads'}" --format mp3 --bitrate 320k`;
  };

  // Helper function to extract YouTube video ID from various URL formats
  const extractYouTubeVideoId = (url: string): string | null => {
    // Match patterns: youtube.com/watch?v=ID, youtu.be/ID, youtube.com/embed/ID
    const patterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
      /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match && match[1]) return match[1];
    }
    return null;
  };

  const openTrackUrl = (service: 'spotify' | 'youtube', mode: 'newTab' | 'embed' = 'newTab') => {
    if (!selectedTrack) return;
    
    if (service === 'spotify') {
      // Convert to embed URL for no-login access
      const embedUrl = selectedTrack.url.replace('open.spotify.com/', 'open.spotify.com/embed/');
      
      if (mode === 'newTab') {
        window.open(embedUrl, '_blank', 'noopener,noreferrer');
        toast.success(`🎵 Opening "${selectedTrack.name}" on Spotify (No login required!)...`);
        setShowPlayDialog(false);
      } else {
        setListenMode('embed');
        toast.success(`🎵 Loading player for "${selectedTrack.name}"...`);
      }
    } else {
      // Search on YouTube Music
      const searchQuery = encodeURIComponent(`${selectedTrack.artist} ${selectedTrack.name}`);
      window.open(`https://music.youtube.com/search?q=${searchQuery}`, '_blank', 'noopener,noreferrer');
      toast.success(`🎵 Searching "${selectedTrack.name}" on YouTube Music...`);
      setShowPlayDialog(false);
    }
  };

  const downloadSingleTrack = async (track: Track) => {
    // Select only this track
    setTracks(prev => prev.map(t => ({
      ...t,
      selected: t.id === track.id,
      downloadStatus: t.id === track.id ? 'pending' : t.downloadStatus,
      downloadProgress: t.id === track.id ? 0 : t.downloadProgress
    })));

    setDownloading(true);
    setAttemptCount(0);
    
    toast.success(`🚀 Downloading "${track.name}"...`);

    try {
      // Ensure the track has the selected flag
      const trackToDownload = {
        ...track,
        selected: true
      };
      
      console.log('Downloading single track:', trackToDownload);

      const response = await startDownload({
        playlistUrl,
        tracks: [trackToDownload], // Only download this one track with selected flag
        settings,
        folderName: folderName || playlistName,
        playlistImages
      });

      setDownloadId(response.downloadId);
      setOutputFolder(response.outputFolder);
      
      toast.info(`📁 Saving to: ${response.outputFolder}`);
    } catch (error: any) {
      setDownloading(false);
      toast.error(`❌ Failed to download: ${error.message}`);
    }
  };

  // Update tracks when parent tracks change (for add/replace feature)
  useEffect(() => {
    setTracks(initialTracks);
    
    // If tracks change significantly (new playlist), clean up player to avoid corruption
    if (initialTracks.length > 0 && tracks.length > 0) {
      const tracksAreDifferent = initialTracks[0]?.id !== tracks[0]?.id;
      if (tracksAreDifferent && playerRef.current) {
        console.log('🔄 New playlist detected, cleaning up player...');
        try {
          if (playerRef.current.destroy && typeof playerRef.current.destroy === 'function') {
            playerRef.current.destroy();
          }
        } catch (e) {
          console.log('⚠️ Player cleanup error (ignored):', e);
        }
        playerRef.current = null;
        setCurrentPlayingTrack(null);
        setIsPlaying(false);
        setIsPlayingAll(false);
      }
    }
    
    // Prefetch YouTube IDs in background for faster playback
    if (initialTracks.length > 0) {
      // Delay prefetching slightly to not interfere with initial page load
      setTimeout(() => {
        prefetchYoutubeIds(initialTracks);
      }, 1000);
    }
  }, [initialTracks]);

  // Update folder name when playlist name changes
  useEffect(() => {
    if (playlistName) {
      setFolderName(playlistName);
    }
  }, [playlistName]);
  
  // Load YouTube ID cache on mount
  useEffect(() => {
    const cache = loadYoutubeCache();
    setYoutubeIdCache(cache);
    console.log(`💾 Loaded ${cache.size} cached YouTube IDs from storage`);
  }, []);

  // Initialize WebSocket connection
  useEffect(() => {
    const socket = initWebSocket();
    
    // Initialize Live Listening service
    liveListeningService.init(socket);

    socket.on('download:status', (data: any) => {
      console.log('Download status:', data);
      if (data.downloadId === downloadId) {
        toast.info(data.message);
      }
    });

    socket.on('download:attempt', (data: any) => {
      console.log('Download attempt:', data);
      if (data.downloadId === downloadId) {
        setAttemptCount(data.attempt);
        toast.info(data.message);
      }
    });

    socket.on('download:progress', (data: any) => {
      console.log('Download progress:', data);
      if (data.downloadId === downloadId) {
        // Show user-friendly message if provided
        if (data.message) {
          console.log(data.message);
          
          // Show toast for important updates
          if (data.message.includes('✅') && data.message.includes('Downloaded')) {
            toast.success(data.message.substring(0, 100));
          }
        }
        
        setTracks(prev => {
          const updatedTracks = prev.map((track) => {
            // Match by track name - more reliable than index
            const trackFullName = `${track.artist} - ${track.name}`;
            const isMatch = data.trackName && (
              data.trackName.includes(track.name) || 
              data.trackName.includes(track.artist) ||
              trackFullName.includes(data.trackName) ||
              data.trackName.toLowerCase().includes(track.name.toLowerCase())
            );
            
            if (isMatch && track.selected) {
              return {
                ...track,
                downloadStatus: data.status,
                downloadProgress: data.progress || 0
              };
            }
            return track;
          });
          
          // Update tab title with progress
          const completedInProgress = updatedTracks.filter(t => t.selected && t.downloadStatus === 'completed').length;
          const totalSelected = updatedTracks.filter(t => t.selected).length;
          if (totalSelected > 0) {
            showDownloadProgress(completedInProgress, totalSelected);
          }
          
          return updatedTracks;
        });
      }
    });

    socket.on('download:error', (data: any) => {
      console.error('Download error:', data);
      if (data.downloadId === downloadId && data.trackName) {
        toast.error(`❌ Failed: ${data.trackName}`);
        // Don't show tab notification for individual errors, only on complete
      }
    });

    socket.on('download:retry', (data: any) => {
      console.log('Download retry:', data);
      if (data.downloadId === downloadId) {
        toast.warning(data.message);
      }
    });

    socket.on('download:complete', (data: any) => {
      console.log('Download complete:', data);
      if (data.downloadId === downloadId) {
        setDownloading(false);
        setOutputFolder(data.outputFolder);
        
        // Collect failed tracks after 4 retries
        const currentFailedTracks = tracks.filter(t => t.selected && t.downloadStatus === 'failed');
        if (currentFailedTracks.length > 0) {
          setFailedTracks(currentFailedTracks);
        }
        
        if (data.totalFailed > 0) {
          // Show error notification for failed downloads
          showErrorNotification(`${data.totalFailed} track${data.totalFailed > 1 ? 's' : ''} failed`);
          toast.warning(data.message, {
            duration: 10000,
            action: {
              label: 'Show Fallback',
              onClick: () => setShowFailedTracksDialog(true),
            },
          });
        } else {
          // Show success notification with blinking and sound
          const successCount = data.totalDownloaded || tracks.filter(t => t.selected && t.downloadStatus === 'completed').length;
          showCompleteNotification(successCount, playlistName);
          
          // Show toast with download button if downloadUrl is provided
          if (data.downloadUrl) {
            const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
            const fullDownloadUrl = `${apiUrl}${data.downloadUrl}`;
            
            // Auto-start download in a new tab immediately
                  window.open(fullDownloadUrl, '_blank');
            
            // Add to tray
            setRecentDownloads(prev => [{ id: data.downloadId, name: getFolderName(data.outputFolder), url: fullDownloadUrl, time: Date.now() }, ...prev].slice(0, 5));
            
            // Persistent richer toast with retry/open actions
            toast.success(`${getFolderName(data.outputFolder)} is ready`, {
              description: 'Your ZIP is prepared. You can re-download anytime from the tray.',
              duration: 60000,
              action: {
                label: 'Open ZIP',
                onClick: () => window.open(fullDownloadUrl, '_blank'),
              },
            });
          } else {
            toast.success(data.message, {
              duration: 5000,
            });
          }
        }
      }
    });

    socket.on('download:timeout', (data: any) => {
      console.log('Download timeout:', data);
      if (data.downloadId === downloadId) {
        toast.warning(data.message, {
          duration: 8000,
          icon: '⏱️',
        });
      }
    });

    socket.on('download:cancelled', (data: any) => {
      console.log('Download cancelled:', data);
      if (data.downloadId === downloadId) {
        setDownloading(false);
        toast.error(data.message, {
          duration: 5000,
        });
        resetTabTitle();
      }
    });

    socket.on('download:skipped', (data: any) => {
      console.log('Download skipped:', data);
      if (data.downloadId === downloadId) {
        toast.info(data.message, {
          duration: 5000,
        });
      }
    });

    return () => {
      socket.off('download:status');
      socket.off('download:attempt');
      socket.off('download:progress');
      socket.off('download:error');
      socket.off('download:retry');
      socket.off('download:complete');
      socket.off('download:timeout');
      socket.off('download:cancelled');
      socket.off('download:skipped');
    };
  }, [downloadId]);

  const openFolderDialog = () => {
    const selectedTracks = tracks.filter(t => t.selected);
    
    if (selectedTracks.length === 0) {
      toast.error("⚠️ Please select at least one track to download");
      return;
    }

    setShowFolderDialog(true);
  };

  const downloadSelected = async () => {
    const selectedTracks = tracks.filter(t => t.selected);
    
    if (selectedTracks.length === 0) {
      toast.error("⚠️ Please select at least one track to download");
      return;
    }

    setShowFolderDialog(false);
    setDownloading(true);
    setAttemptCount(0);
    
    // Reset download status for selected tracks
    setTracks(prev => prev.map(track => ({
      ...track,
      downloadStatus: track.selected ? 'pending' : track.downloadStatus,
      downloadProgress: track.selected ? 0 : track.downloadProgress
    })));
    
    toast.success(`🚀 Starting download of ${selectedTracks.length} track${selectedTracks.length > 1 ? 's' : ''}...`);

    try {
      const response = await startDownload({
        playlistUrl,
        tracks: selectedTracks, // FIXED: Only send selected tracks
        settings,
        folderName,
        playlistImages
      });

      setDownloadId(response.downloadId);
      setOutputFolder(response.outputFolder);
      
      toast.info(`📁 Files will be saved to: ${response.outputFolder}`);
    } catch (error: any) {
      setDownloading(false);
      toast.error(`❌ Failed to start download: ${error.message}`);
    }
  };

  const handleCancelDownload = async () => {
    if (!downloadId) {
      toast.error('No active download to cancel');
      return;
    }

    try {
      toast.info('⏳ Cancelling download...');
      
      await cancelDownload(downloadId);
      
      // Reset all download states
      setDownloading(false);
      setDownloadId(null);
      setAttemptCount(0);
      
      // Reset all track statuses
      setTracks(prev => prev.map(track => ({
        ...track,
        downloadStatus: 'pending',
        downloadProgress: 0
      })));
      
      toast.success('✅ Download cancelled successfully');
    } catch (error: any) {
      console.error('Failed to cancel download:', error);
      toast.error(`❌ Failed to cancel: ${error.message}`);
      
      // Force reset even if cancel fails
      setDownloading(false);
      setDownloadId(null);
    }
  };

  const handleSkipToYtdlp = async () => {
    if (!downloadId) {
      toast.error('No active download');
      return;
    }

    try {
      await skipToYtdlp(downloadId);
      toast.info('⏭️ Skipping to yt-dlp fallback...');
    } catch (error: any) {
      console.error('Failed to skip to yt-dlp:', error);
      toast.error(`❌ Failed to skip: ${error.message}`);
    }
  };

  const selectedCount = tracks.filter(t => t.selected).length;
  const allSelected = tracks.length > 0 && tracks.every(t => t.selected);
  const someSelected = tracks.some(t => t.selected) && !allSelected;
  const completedCount = tracks.filter(t => t.downloadStatus === 'completed').length;
  const failedCount = tracks.filter(t => t.downloadStatus === 'failed').length;
  const overallProgress = (completedCount / tracks.length) * 100;
  
  // 🔄 Reorder selected tracks
  const handleReorderTracks = () => {
    if (selectedCount === 0) {
      toast.error('Please select tracks to reorder');
      return;
    }
    
    // Set initial position to 1
    setReorderPosition(1);
    setShowReorderDialog(true);
  };
  
  const confirmReorder = () => {
    const selectedTracks = tracks.filter(t => t.selected);
    const unselectedTracks = tracks.filter(t => !t.selected);
    
    // Validate position
    const targetPosition = Math.max(1, Math.min(reorderPosition, tracks.length));
    
    // Calculate actual index (0-based)
    const targetIndex = targetPosition - 1;
    
    // Create new array with reordered tracks
    const newTracks = [...unselectedTracks];
    
    // Insert selected tracks at target position
    newTracks.splice(targetIndex, 0, ...selectedTracks);
    
    setTracks(newTracks);
    
    // Update parent component if callback exists
    if (onTracksUpdate) {
      onTracksUpdate(newTracks);
    }
    
    // Save to storage
    saveCurrentTrackList({
      tracks: newTracks,
      playlistUrl,
      playlistName,
      playlistImages,
      timestamp: Date.now()
    });
    
    toast.success(`✅ Moved ${selectedCount} track${selectedCount > 1 ? 's' : ''} to position ${targetPosition}`);
    setShowReorderDialog(false);
  };

  // 🔍 Filter tracks by search query
  const filteredTracks = tracks.filter(track => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      track.name.toLowerCase().includes(query) ||
      track.artist.toLowerCase().includes(query) ||
      track.album?.toLowerCase().includes(query)
    );
  });

  // Sort tracks: completed first, then downloading, then pending, then failed
  const sortedTracks = [...filteredTracks].sort((a, b) => {
    const statusOrder = { completed: 0, downloading: 1, pending: 2, failed: 3 };
    const aOrder = statusOrder[a.downloadStatus || 'pending'];
    const bOrder = statusOrder[b.downloadStatus || 'pending'];
    return aOrder - bOrder;
  });

  return (
    <div className="relative group" data-track-list>
      <div className="absolute -inset-1 bg-gradient-to-r from-primary/5 to-accent/5 rounded-2xl blur-xl opacity-50" />
      <div className="relative bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        {/* Preview Mode Banner */}
        {isPrivateMode && (
          <div className="relative bg-gradient-to-r from-amber-500/20 via-orange-500/20 to-amber-500/20 backdrop-blur-sm border-b border-amber-500/30">
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMC41IiBvcGFjaXR5PSIwLjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-20"></div>
            <div className="relative flex items-center justify-center gap-3 px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="absolute inset-0 bg-amber-400 blur-md opacity-50 animate-pulse"></div>
                  <div className="relative bg-gradient-to-br from-amber-400 to-orange-500 p-1.5 rounded-lg">
                    <Info className="w-4 h-4 text-white" />
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold bg-gradient-to-r from-amber-200 to-orange-200 bg-clip-text text-transparent">
                    🔒 Preview Mode
                  </p>
                  <p className="text-xs text-amber-200/80">
                    Read-only • Play & Download available • Reorder & Remove disabled
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* Clean Compact Header */}
        <div className="border-b border-border bg-card">
          <div className="flex items-center justify-between px-4 py-3">
            {/* Left: Title & Stats */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Music2 className="w-5 h-5 text-primary" />
                <h3 className="text-lg font-semibold">Track List</h3>
              </div>
              
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="font-medium">
                  {selectedCount > 0 ? `${selectedCount} selected` : `${filteredTracks.length} tracks`}
                </span>
                {completedCount > 0 && (
                  <span className="text-green-600">• {completedCount} done</span>
                )}
                {failedCount > 0 && (
                  <span className="text-red-600">• {failedCount} failed</span>
                )}
                <span className="text-blue-600">• {settings.format.toUpperCase()}</span>
              </div>
            </div>

            {/* Right: Search & Actions */}
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Music className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-9 h-8 w-64"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              
              {/* Results count */}
              {searchQuery && (
                <span className="text-sm text-muted-foreground">
                  {filteredTracks.length} result{filteredTracks.length !== 1 ? 's' : ''}
                </span>
              )}

              {/* Select All */}
              <div className="flex items-center gap-2">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={toggleSelectAll}
                  className="h-4 w-4"
                />
                <span className="text-sm text-muted-foreground">
                  {allSelected ? 'All' : 'None'}
                </span>
              </div>

              {/* Expand/Collapse */}
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="h-8 w-8 p-0 lg:hidden"
              >
                {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Action Buttons - Clean & Compact */}
        {expanded && (
          <div className="border-b border-border bg-secondary/30">
            <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-3">
              {/* Play All */}
              <Button
                onClick={playAllTracks}
                disabled={tracks.length === 0}
                variant="outline"
                size="sm"
                className="h-8"
              >
                <Play className="w-4 h-4 mr-1" />
                Play All
              </Button>

              {/* Save Playlist */}
              <Button
                onClick={() => setShowSaveDialog(true)}
                disabled={tracks.length === 0}
                variant="outline"
                size="sm"
                className="h-8"
              >
                <Save className="w-4 h-4 mr-1" />
                Save
              </Button>

              {/* Remove Duplicates - Hidden in Preview Mode */}
              {!isPrivateMode && (
              <Button
                onClick={findDuplicates}
                disabled={downloading || tracks.length < 2}
                variant="outline"
                size="sm"
                className="h-8"
              >
                <CheckCircle2 className="w-4 h-4 mr-1" />
                Clean
              </Button>
              )}

              {/* Reorder Selected */}
              <Button
                onClick={handleReorderTracks}
                disabled={downloading || selectedCount === 0}
                variant="outline"
                size="sm"
                className="h-8"
              >
                <GripVertical className="w-4 h-4 mr-1" />
                Reorder
              </Button>

              {/* Remove Selected - Hidden in Preview Mode */}
              {!isPrivateMode && (
              <Button
                onClick={removeSelected}
                disabled={downloading || selectedCount === 0}
                variant="outline"
                size="sm"
                className="h-8"
              >
                <X className="w-4 h-4 mr-1" />
                Remove
              </Button>
              )}

              {/* Download Button */}
              <Button
                onClick={openFolderDialog}
                disabled={downloading || selectedCount === 0}
                size="sm"
                className="h-8 bg-primary hover:bg-primary/90"
              >
                {downloading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                    Downloading{attemptCount > 0 ? ` (${attemptCount})` : '...'}
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4 mr-1" />
                    Download {selectedCount > 0 ? `(${selectedCount})` : ''}
                  </>
                )}
              </Button>
              
              {/* Cancel and Skip buttons - only visible during download */}
              {downloading && (
                <>
                  <Button
                    onClick={handleSkipToYtdlp}
                    variant="outline"
                    size="sm"
                    className="h-8"
                    title="Skip to yt-dlp (YouTube direct download)"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="m5 3 14 9-14 9V3z"/>
                      <path d="m19 3 0 18"/>
                    </svg>
                    Skip
                  </Button>
                  
                  <Button
                    onClick={handleCancelDownload}
                    variant="outline"
                    size="sm"
                    className="h-8"
                    title="Cancel download"
                  >
                    <X className="w-4 h-4 mr-1" />
                    Cancel
                  </Button>
                </>
              )}
            </div>

            {/* Overall Progress - Compact */}
            {(completedCount > 0 || failedCount > 0) && (
              <div className="px-4 py-2 border-t border-border">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 text-sm">
                    <Progress value={overallProgress} className="h-1.5 w-20" />
                    <span className="text-muted-foreground font-mono">
                      {Math.round(overallProgress)}%
                    </span>
                    {completedCount > 0 && (
                      <span className="text-green-600 text-xs">
                        {completedCount} done
                      </span>
                    )}
                    {failedCount > 0 && (
                      <span className="text-red-600 text-xs">
                        {failedCount} failed
                      </span>
                    )}
                  </div>
                  {failedCount > 0 && !downloading && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setShowFailedTracksDialog(true)}
                      className="h-6 px-2 text-xs"
                    >
                      <Terminal className="w-3 h-3 mr-1" />
                      Commands
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Track List */}
        {expanded && (
          <div className="p-4 space-y-2.5 max-h-[700px] overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent scroll-smooth">
            {sortedTracks.length === 0 ? (
              /* Empty State */
              <div className="flex flex-col items-center justify-center py-16 px-4">
                <div className="relative mb-6">
                  <div className="w-24 h-24 bg-gradient-to-br from-primary/20 to-accent/20 rounded-full flex items-center justify-center">
                    <Music2 className="w-12 h-12 text-primary" />
                  </div>
                  <div className="absolute -inset-2 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur-xl animate-pulse"></div>
                </div>
                <h3 className="text-xl font-semibold text-foreground mb-2">No Tracks Yet</h3>
                <p className="text-sm text-muted-foreground text-center max-w-md">
                  Load a playlist or search for music to get started. Your tracks will appear here.
                </p>
              </div>
            ) : (
              sortedTracks.map((track, index) => (
              <div
                key={track.id}
                draggable={!downloading && !isPrivateMode}
                onDragStart={() => !isPrivateMode && handleDragStart(index)}
                onDragOver={(e) => !isPrivateMode && handleDragOver(e, index)}
                onDragEnd={!isPrivateMode ? handleDragEnd : undefined}
                onDragLeave={!isPrivateMode ? handleDragLeave : undefined}
                className={`relative group/track rounded-xl border-2 backdrop-blur-sm transition-all duration-300 ${
                  track.selected 
                    ? 'bg-gradient-to-r from-primary/10 via-primary/5 to-primary/10 border-primary/60 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/35' 
                    : 'bg-gradient-to-r from-card/80 via-card/50 to-card/80 border-border/40 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10'
                } ${
                  draggedIndex === index && !isPrivateMode ? 'opacity-50 scale-95 rotate-1' : ''
                } ${
                  dragOverIndex === index && !isPrivateMode ? 'border-t-4 border-t-primary scale-[1.02]' : ''
                } ${
                  currentPlayingTrack?.id === track.id 
                    ? 'ring-2 ring-primary ring-offset-2 ring-offset-background shadow-2xl shadow-primary/40 border-primary/70' 
                    : ''
                } ${!downloading && !isPrivateMode ? 'cursor-move hover:scale-[1.01]' : 'cursor-default'}`}
              >
                {/* Animated Border Gradient on Hover */}
                <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-primary/0 via-primary/30 to-primary/0 opacity-0 group-hover/track:opacity-100 transition-opacity duration-500 blur-sm -z-10"></div>
                
                {/* Drag Indicator */}
                {dragOverIndex === index && (
                  <div className="absolute -top-2 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-primary to-transparent rounded-full animate-pulse shadow-lg shadow-primary/50"></div>
                )}
                
                {/* Selection Indicator Strip */}
                {track.selected && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-primary via-accent to-primary rounded-l-xl"></div>
                )}

                <div className="flex items-center gap-4 px-4 py-3">
                  {/* Left Section: Controls (Fixed Width) */}
                  <div className="flex items-center gap-2.5 flex-shrink-0 w-[140px]">
                    {/* Drag Handle - Hidden in Preview Mode */}
                    {!downloading && !isPrivateMode && (
                      <div className="cursor-grab active:cursor-grabbing opacity-0 group-hover/track:opacity-100 transition-opacity">
                        <GripHorizontal className="w-4 h-4 text-muted-foreground hover:text-primary" />
                      </div>
                    )}
                    
                    {/* Checkbox */}
                    <Checkbox
                      checked={track.selected}
                      onCheckedChange={() => toggleTrackSelection(track.id)}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary transition-all"
                    />

                    {/* Track Number with Badge */}
                    <div className={`flex items-center justify-center w-9 h-9 rounded-lg font-bold text-sm transition-all ${
                      currentPlayingTrack?.id === track.id 
                        ? 'bg-primary/20 text-primary ring-1 ring-primary/50' 
                        : 'text-muted-foreground group-hover/track:bg-primary/10 group-hover/track:text-primary'
                    }`}>
                      {tracks.findIndex(t => t.id === track.id) + 1}
                    </div>
                  </div>

                  {/* Album Art with Enhanced Play Button */}
                  <button
                    onClick={() => playTrack(track)}
                    className="relative group/art cursor-pointer flex-shrink-0"
                    title={currentPlayingTrack?.id === track.id ? (isPlaying ? "Pause" : "Resume") : "Play"}
                  >
                    <div className="relative w-16 h-16 rounded-xl overflow-hidden shadow-lg ring-1 ring-border/30 group-hover/art:ring-primary/50 transition-all">
                      <img
                        src={track.imageUrl}
                        alt={track.album}
                        className="w-full h-full object-cover transition-all group-hover/art:scale-110"
                      />
                      <div className={`absolute inset-0 flex items-center justify-center transition-all ${
                        currentPlayingTrack?.id === track.id && isPlaying
                          ? 'bg-black/40'
                          : 'bg-gradient-to-br from-black/0 to-black/0 group-hover/art:from-black/60 group-hover/art:to-black/40'
                      }`}>
                        <div className={`w-10 h-10 rounded-full bg-primary/95 backdrop-blur-sm flex items-center justify-center transition-all ${
                          currentPlayingTrack?.id === track.id && isPlaying
                            ? 'scale-100 opacity-100'
                            : 'scale-75 opacity-0 group-hover/art:scale-100 group-hover/art:opacity-100'
                        }`}>
                          {currentPlayingTrack?.id === track.id && isPlaying ? (
                            <Pause className="w-5 h-5 text-white" />
                          ) : (
                            <Play className="w-5 h-5 text-white ml-0.5" />
                          )}
                        </div>
                      </div>
                    </div>
                    {/* Now Playing Indicator */}
                    {currentPlayingTrack?.id === track.id && (
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-primary rounded-full animate-pulse shadow-lg shadow-primary/50 ring-2 ring-background"></div>
                    )}
                  </button>

                  {/* Track Info Section */}
                  <div className="flex-1 min-w-0 flex items-center gap-4">
                    {/* Track Name & Artist */}
                    <div className="flex-1 min-w-0 max-w-[400px]">
                      <h4 className="font-semibold text-base text-foreground truncate group-hover/track:text-primary transition-colors leading-tight mb-1">
                        {track.name}
                      </h4>
                      <p className="text-sm text-muted-foreground truncate">
                        {track.artist}
                      </p>
                    </div>

                    {/* Album - Desktop */}
                    <div className="hidden xl:block flex-1 min-w-0 max-w-[300px]">
                      <p className="text-sm text-muted-foreground truncate">{track.album}</p>
                    </div>

                    {/* Platform Badge - Fixed Position */}
                    <div className="hidden md:flex items-center justify-center flex-shrink-0 w-[110px]">
                      {track.url.includes('youtube.com') || track.url.includes('youtu.be') ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-br from-red-500/15 to-red-600/10 border border-red-500/30 rounded-lg shadow-sm hover:shadow-md hover:shadow-red-500/20 transition-all">
                          <Youtube className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                          <span className="text-xs font-semibold text-red-500 tracking-wide">YouTube</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gradient-to-br from-green-500/15 to-green-600/10 border border-green-500/30 rounded-lg shadow-sm hover:shadow-md hover:shadow-green-500/20 transition-all">
                          <Music className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                          <span className="text-xs font-semibold text-green-500 tracking-wide">Spotify</span>
                        </div>
                      )}
                    </div>

                    {/* Duration Badge - Fixed Width */}
                    <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-secondary/50 border border-border/50 rounded-lg flex-shrink-0 w-[80px] justify-center">
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/50 animate-pulse"></div>
                      <span className="text-sm text-muted-foreground font-mono tabular-nums font-semibold">
                        {formatDuration(track.duration)}
                      </span>
                    </div>

                    {/* Status Indicator - Fixed Width */}
                    <div className="hidden xl:flex items-center gap-2 flex-shrink-0 w-[120px]">
                      {getStatusIcon(track.downloadStatus, track.downloadProgress, track)}
                      {(() => {
                        const shouldShowStatus = 
                          track.downloadStatus === 'downloading' || 
                          track.downloadStatus === 'completed' || 
                          track.downloadStatus === 'failed' ||
                          (track.downloadStatus === 'pending' && downloading && track.selected);
                        
                        return shouldShowStatus && (
                          <span className={`text-xs font-bold uppercase tracking-wider truncate ${getStatusColor(track.downloadStatus)}`}>
                            {track.downloadStatus === 'downloading' ? `${track.downloadProgress}%` : track.downloadStatus}
                          </span>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Right Section: Action Buttons (Fixed Width) */}
                  <div className="flex items-center gap-2 flex-shrink-0 w-[220px] justify-end">
                    {/* Download Single Track Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        // Download single track logic
                        if (track.downloadStatus === 'completed') {
                          toast.info('This track has already been downloaded');
                          return;
                        }
                        if (downloading) {
                          toast.warning('Please wait for current download to complete');
                          return;
                        }
                        // Select only this track and start download
                        const updatedTracks = tracks.map(t => ({
                          ...t,
                          selected: t.id === track.id
                        }));
                        setTracks(updatedTracks);
                        setTimeout(() => openFolderDialog(), 100);
                      }}
                      disabled={downloading || track.downloadStatus === 'downloading'}
                      className="h-9 w-9 p-0 border-2 border-border/50 hover:border-primary/50 hover:bg-primary/10 hover:text-primary rounded-lg hover:scale-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      title={track.downloadStatus === 'completed' ? 'Already downloaded' : 'Download this track'}
                    >
                      <Download className="w-4 h-4" />
                    </Button>

                    {/* Open in New Tab Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(track.url, '_blank')}
                      className="h-9 w-9 p-0 border-2 border-border/50 hover:border-primary/50 hover:bg-primary/10 hover:text-primary rounded-lg hover:scale-110 transition-all"
                      title="Open in new tab"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </Button>

                    {/* Details Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openTrackDetails(track)}
                      className="h-9 px-4 border-2 border-border/50 hover:border-primary/50 hover:bg-primary/10 hover:text-primary transition-all rounded-lg hover:scale-105 shadow-sm font-semibold"
                      title="View details"
                    >
                      <Info className="w-4 h-4 mr-1.5" />
                      <span className="text-xs">Details</span>
                    </Button>
                  </div>
                </div>

                {/* Progress Bar - Enhanced */}
                {track.downloadStatus === 'downloading' && (
                  <div className="px-4 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <Progress value={track.downloadProgress} className="h-2 bg-secondary/50">
                          <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all shadow-sm shadow-primary/30" 
                               style={{ width: `${track.downloadProgress}%` }} />
                        </Progress>
                      </div>
                      <span className="text-xs font-mono text-primary font-semibold min-w-[45px] text-right">
                        {track.downloadProgress}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
              ))
            )}
          </div>
        )}

        {/* Collapsed state */}
        {!expanded && tracks.length > 0 && (
          <div className="p-8">
            <div className="flex items-center justify-center gap-3 text-muted-foreground">
              <ChevronDown className="w-5 h-5 animate-bounce" />
              <p className="text-sm font-medium">Click expand to view {tracks.length} track{tracks.length !== 1 ? 's' : ''}</p>
              <ChevronDown className="w-5 h-5 animate-bounce" />
            </div>
          </div>
        )}

        {/* Output folder info */}
        {outputFolder && (
          <div className="px-8 pb-8">
            <div className="flex items-center gap-3 p-4 bg-primary/5 border border-primary/20 rounded-xl">
              <FolderOpen className="w-5 h-5 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Output Folder:</p>
                <p className="text-sm text-muted-foreground font-mono break-all">{outputFolder}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Play Track Dialog */}
      <Dialog open={showPlayDialog} onOpenChange={(open) => {
        setShowPlayDialog(open);
        if (!open) setListenMode('choose');
      }}>
        <DialogContent className={`bg-card border-border rounded-2xl ${listenMode === 'embed' ? 'sm:max-w-[600px]' : 'sm:max-w-[500px]'}`}>
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Music2 className="w-6 h-6 text-primary" />
              {listenMode === 'choose' ? 'Listen to Track' : selectedTrack?.name || 'Now Playing'}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {listenMode === 'choose' 
                ? 'Choose where you\'d like to listen' 
                : `${selectedTrack?.artist} • ${selectedTrack?.album}`
              }
            </DialogDescription>
          </DialogHeader>
          
          {selectedTrack && (
            <>
              {listenMode === 'choose' ? (
                <div className="space-y-6 py-4">
                  {/* Track Info */}
                  <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
                    <img 
                      src={selectedTrack.imageUrl} 
                      alt={selectedTrack.album}
                      className="w-16 h-16 rounded-lg shadow-md"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-lg text-foreground truncate">{selectedTrack.name}</p>
                      <p className="text-sm text-muted-foreground truncate">{selectedTrack.artist}</p>
                      <p className="text-xs text-muted-foreground/70 truncate">{selectedTrack.album}</p>
                    </div>
                  </div>

                  {/* Listen Options */}
                  <div className="space-y-3">
                    <Button
                      onClick={() => openTrackUrl('spotify', 'embed')}
                      className="w-full h-auto flex items-center justify-start gap-4 p-4 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-white shadow-lg hover:shadow-xl hover:shadow-primary/50 transition-all rounded-xl"
                    >
                      <Play className="w-8 h-8" />
                      <div className="text-left">
                        <div className="font-bold text-base">
                          {selectedTrack.url.includes('youtube.com') || selectedTrack.url.includes('youtu.be') 
                            ? 'Watch Here' 
                            : 'Listen Here'}
                        </div>
                        <div className="text-xs opacity-90">
                          {selectedTrack.url.includes('youtube.com') || selectedTrack.url.includes('youtu.be') 
                            ? 'In-website YouTube player' 
                            : 'In-website Spotify player'}
                        </div>
                      </div>
                    </Button>

                    <Button
                      onClick={() => openTrackUrl('spotify', 'newTab')}
                      className={`w-full h-auto flex items-center justify-start gap-4 p-4 ${
                        selectedTrack.url.includes('youtube.com') || selectedTrack.url.includes('youtu.be')
                          ? 'bg-gradient-to-r from-[#FF0000] to-[#CC0000] hover:from-[#CC0000] hover:to-[#FF0000]'
                          : 'bg-gradient-to-r from-[#1DB954] to-[#1ed760] hover:from-[#1ed760] hover:to-[#1DB954]'
                      } text-white shadow-lg hover:shadow-xl transition-all rounded-xl`}
                      style={{
                        boxShadow: selectedTrack.url.includes('youtube.com') || selectedTrack.url.includes('youtu.be')
                          ? '0 10px 25px -5px rgba(255, 0, 0, 0.5)'
                          : '0 10px 25px -5px rgba(29, 185, 84, 0.5)'
                      }}
                    >
                      <ExternalLink className="w-8 h-8" />
                      <div className="text-left">
                        <div className="font-bold text-base">
                          {selectedTrack.url.includes('youtube.com') || selectedTrack.url.includes('youtu.be')
                            ? 'Open in YouTube'
                            : 'Open in Spotify'}
                        </div>
                        <div className="text-xs opacity-90">
                          {selectedTrack.url.includes('youtube.com') || selectedTrack.url.includes('youtu.be')
                            ? 'New tab - Watch on YouTube!'
                            : 'New tab - No login required!'}
                        </div>
                      </div>
                    </Button>

                    <Button
                      onClick={() => openTrackUrl('youtube')}
                      variant="outline"
                      className="w-full h-auto flex items-center justify-start gap-4 p-4 border-2 border-red-500/50 hover:bg-red-500/10 rounded-xl"
                    >
                      <Youtube className="w-8 h-8 text-red-500" />
                      <div className="text-left">
                        <div className="font-bold text-base text-foreground">YouTube Music</div>
                        <div className="text-xs text-muted-foreground">Search & play</div>
                      </div>
                    </Button>
                  </div>

                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-xs text-muted-foreground text-center">
                      <span className="font-semibold text-primary">🎉 Free Access:</span> {
                        selectedTrack.url.includes('youtube.com') || selectedTrack.url.includes('youtu.be')
                          ? 'Watch the full video on YouTube!'
                          : 'Listen on Spotify without creating an account!'
                      }
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4 py-4">
                  {/* Embedded Player (Spotify or YouTube) */}
                  <div className="relative rounded-xl overflow-hidden shadow-2xl border border-border/50 animate-fade-in">
                    {(() => {
                      // Check if it's a YouTube URL
                      const isYouTube = selectedTrack.url.includes('youtube.com') || selectedTrack.url.includes('youtu.be');
                      
                      if (isYouTube) {
                        const videoId = extractYouTubeVideoId(selectedTrack.url);
                        if (videoId) {
                          return (
                            <iframe
                              src={`https://www.youtube.com/embed/${videoId}`}
                              width="100%"
                              height="315"
                              frameBorder="0"
                              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                              allowFullScreen
                              loading="lazy"
                              className="rounded-xl"
                              title={`YouTube Player - ${selectedTrack.name}`}
                            />
                          );
                        }
                      }
                      
                      // Default to Spotify embed
                      return (
                        <iframe
                          src={selectedTrack.url.replace('open.spotify.com/', 'open.spotify.com/embed/')}
                          width="100%"
                          height="152"
                          frameBorder="0"
                          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                          loading="lazy"
                          className="rounded-xl"
                          title={`Spotify Player - ${selectedTrack.name}`}
                        />
                      );
                    })()}
                  </div>

                  <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-xs text-muted-foreground text-center">
                      <span className="font-semibold text-primary">💡 Tip:</span> Press play to start listening. {selectedTrack.url.includes('youtube.com') || selectedTrack.url.includes('youtu.be') ? 'Watch the video!' : 'No account needed!'}
                    </p>
                  </div>
                </div>
              )}
            </>
          )}

          <DialogFooter>
            {listenMode === 'embed' && (
              <Button
                variant="outline"
                onClick={() => setListenMode('choose')}
                className="rounded-xl border-border/50"
              >
                Back
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setShowPlayDialog(false);
                setListenMode('choose');
              }}
              className="rounded-xl border-border/50"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Folder Name Dialog */}
      <Dialog open={showFolderDialog} onOpenChange={setShowFolderDialog}>
        <DialogContent className="sm:max-w-[500px] bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <FolderOpen className="w-6 h-6 text-primary" />
              Choose Download Folder
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              Enter a name for the folder where your music will be saved. Files will be saved to your Downloads directory.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="folder-name" className="text-sm font-semibold">
                Folder Name
              </Label>
              <Input
                id="folder-name"
                value={folderName}
                onChange={(e) => setFolderName(e.target.value)}
                placeholder="My Awesome Playlist"
                className="h-12 bg-secondary/50 border-border rounded-xl"
              />
              <p className="text-xs text-muted-foreground">
                Full path: <span className="font-mono">~/Downloads/{folderName}</span>
              </p>
            </div>

            <div className="p-4 bg-secondary/30 rounded-xl border border-border/50">
              <p className="text-sm text-muted-foreground">
                <span className="font-semibold text-foreground">💡 Tip:</span> Choose a descriptive name to easily find your music later. 
                Special characters will be automatically removed.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFolderDialog(false)}
              className="rounded-xl border-border/50"
            >
              Cancel
            </Button>
            <Button
              onClick={downloadSelected}
              className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-xl shadow-glow"
            >
              <Download className="w-4 h-4 mr-2" />
              Start Download
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Failed Tracks Fallback Dialog */}
      <Dialog open={showFailedTracksDialog} onOpenChange={setShowFailedTracksDialog}>
        <DialogContent className="sm:max-w-[900px] max-h-[85vh] bg-card border-border rounded-2xl overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Terminal className="w-6 h-6 text-destructive" />
              Failed Tracks - Alternative Download Methods
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {failedTracks.length} track{failedTracks.length !== 1 ? 's' : ''} failed after 4 retries. Use these commands to download manually.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4 overflow-y-auto max-h-[60vh]">
            {failedTracks.map((track, index) => (
              <div key={track.id} className="p-4 bg-secondary/30 rounded-xl border border-border/50 space-y-3">
                {/* Track Info */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-8 h-8 bg-destructive/20 rounded-lg text-sm font-bold text-destructive">
                    {index + 1}
                  </div>
                  <img 
                    src={track.imageUrl} 
                    alt={track.album}
                    className="w-12 h-12 rounded-lg shadow-md"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground truncate">{track.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                  </div>
                </div>

                {/* Command Options */}
                <div className="space-y-2">
                  {/* Spotdl Command */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-primary flex items-center gap-1">
                        <Music className="w-3 h-3" />
                        Spotdl (Spotify Link)
                      </Label>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(generateSpotdlCommand(track), 'Spotdl')}
                        className="h-7 px-2 hover:bg-primary/10 rounded-lg"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <div className="p-2 bg-secondary/50 rounded-lg border border-border/30">
                      <code className="text-xs font-mono text-foreground break-all">
                        {generateSpotdlCommand(track)}
                      </code>
                    </div>
                  </div>

                  {/* yt-dlp Command */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-semibold text-red-500 flex items-center gap-1">
                        <Youtube className="w-3 h-3" />
                        yt-dlp (YouTube Search)
                      </Label>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => copyToClipboard(generateYtDlpCommand(track), 'yt-dlp')}
                        className="h-7 px-2 hover:bg-red-500/10 rounded-lg"
                      >
                        <Copy className="w-3 h-3 mr-1" />
                        Copy
                      </Button>
                    </div>
                    <div className="p-2 bg-secondary/50 rounded-lg border border-border/30">
                      <code className="text-xs font-mono text-foreground break-all">
                        {generateYtDlpCommand(track)}
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {/* Instructions */}
            <div className="p-4 bg-primary/5 rounded-lg border border-primary/20 space-y-2">
              <p className="text-sm font-semibold text-primary flex items-center gap-2">
                <Terminal className="w-4 h-4" />
                How to Use:
              </p>
              <ol className="text-xs text-muted-foreground space-y-1 pl-6 list-decimal">
                <li>Click "Copy" on a command above</li>
                <li>Open Terminal (Command Prompt on Windows)</li>
                <li>Paste and run the command</li>
                <li>The track will download to your specified folder</li>
              </ol>
              <p className="text-xs text-muted-foreground mt-2">
                <span className="font-semibold text-primary">💡 Tip:</span> yt-dlp searches YouTube automatically and downloads the best match!
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowFailedTracksDialog(false)}
              className="rounded-xl border-border/50"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicates Dialog */}
      <Dialog open={showDuplicatesDialog} onOpenChange={setShowDuplicatesDialog}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <CheckCircle2 className="w-6 h-6 text-yellow-500" />
              Duplicate Tracks Found
            </DialogTitle>
            <DialogDescription>
              Found {duplicateGroups.reduce((sum, group) => sum + (group.tracks.length - 1), 0)} duplicate track{duplicateGroups.reduce((sum, group) => sum + (group.tracks.length - 1), 0) > 1 ? 's' : ''} in {duplicateGroups.length} group{duplicateGroups.length > 1 ? 's' : ''}. 
              The first track of each group will be kept, duplicates will be removed.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto pr-4 space-y-4">
            {duplicateGroups.map((group, groupIndex) => (
              <div key={group.key} className="border border-border rounded-lg p-4 bg-secondary/10">
                <div className="flex items-center gap-2 mb-3">
                  <Music2 className="w-4 h-4 text-primary" />
                  <span className="font-semibold text-sm">Group {groupIndex + 1}: {group.tracks.length} copies</span>
                </div>
                
                <div className="space-y-2">
                  {group.tracks.map((track, trackIndex) => (
                    <div 
                      key={track.id} 
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        trackIndex === 0 
                          ? 'bg-primary/10 border-primary/30' 
                          : 'bg-destructive/10 border-destructive/30'
                      }`}
                    >
                      {trackIndex === 0 ? (
                        <Check className="w-5 h-5 text-primary flex-shrink-0" />
                      ) : (
                        <X className="w-5 h-5 text-destructive flex-shrink-0" />
                      )}
                      
                      {track.imageUrl && (
                        <img 
                          src={track.imageUrl} 
                          alt={track.name}
                          className="w-12 h-12 rounded object-cover flex-shrink-0"
                        />
                      )}
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{track.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                        <p className="text-xs text-muted-foreground/70 truncate">{track.album}</p>
                      </div>
                      
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        {trackIndex === 0 ? (
                          <span className="text-xs font-semibold text-primary bg-primary/10 px-2 py-1 rounded">
                            ✓ Keep
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-destructive bg-destructive/10 px-2 py-1 rounded">
                            ✗ Remove
                          </span>
                        )}
                        {track.url.includes('youtube') && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Youtube className="w-3 h-3" />
                            YouTube
                          </span>
                        )}
                        {track.url.includes('spotify') && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Music className="w-3 h-3" />
                            Spotify
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <DialogFooter className="flex-shrink-0 gap-2">
            <Button
              onClick={() => setShowDuplicatesDialog(false)}
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmRemoveDuplicates}
              className="bg-primary hover:bg-primary/90"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Remove {duplicateGroups.reduce((sum, group) => sum + (group.tracks.length - 1), 0)} Duplicate{duplicateGroups.reduce((sum, group) => sum + (group.tracks.length - 1), 0) > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duplicate Name Confirmation Dialog */}
      <Dialog open={showDuplicateConfirmDialog} onOpenChange={(open) => {
        if (!open && duplicateInfo) {
          handleDuplicateAction('cancel');
        }
      }}>
        <DialogContent className="max-w-2xl border-2 border-primary/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="p-3 bg-yellow-500/10 rounded-full">
                <Music2 className="w-6 h-6 text-yellow-500" />
              </div>
              Playlist Already Exists
            </DialogTitle>
            <DialogDescription className="text-base mt-4">
              A playlist named <span className="font-semibold text-foreground">"{duplicateInfo?.existingPlaylist?.name}"</span> already exists in your saved playlists.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Comparison Cards */}
            <div className="grid grid-cols-2 gap-4">
              {/* Existing Playlist */}
              <div className="p-4 rounded-lg border-2 border-border bg-secondary/50">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Existing Playlist
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Music2 className="w-4 h-4 text-muted-foreground" />
                    <span className="text-2xl font-bold">{duplicateInfo?.existingPlaylist?.trackCount || 0}</span>
                    <span className="text-sm text-muted-foreground">tracks</span>
                  </div>
                  {duplicateInfo?.existingPlaylist?.owner && (
                    <p className="text-xs text-muted-foreground">
                      By {duplicateInfo.existingPlaylist.owner}
                    </p>
                  )}
                </div>
              </div>

              {/* New Playlist */}
              <div className="p-4 rounded-lg border-2 border-primary bg-primary/5">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                    Your Current Playlist
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Music2 className="w-4 h-4 text-primary" />
                    <span className="text-2xl font-bold text-primary">{duplicateInfo?.newTrackCount || 0}</span>
                    <span className="text-sm text-muted-foreground">tracks</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    New changes to save
                  </p>
                </div>
              </div>
            </div>

            {/* Info Message */}
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-sm text-muted-foreground leading-relaxed">
                <span className="font-semibold text-foreground">What would you like to do?</span><br/>
                Choose to replace the existing playlist with your current changes, or save them as a separate new playlist.
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              onClick={() => handleDuplicateAction('cancel')}
              variant="outline"
              className="flex-1"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={() => handleDuplicateAction('new')}
              variant="outline"
              className="flex-1 border-primary text-primary hover:bg-primary/10"
            >
              <Copy className="w-4 h-4 mr-2" />
              Save as New
            </Button>
            <Button
              onClick={() => handleDuplicateAction('replace')}
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Replace Existing
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Selected Confirmation Dialog */}
      <Dialog open={showRemoveConfirmDialog} onOpenChange={setShowRemoveConfirmDialog}>
        <DialogContent className="max-w-3xl border-2 border-destructive/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3 text-2xl">
              <div className="p-3 bg-destructive/10 rounded-full">
                <X className="w-6 h-6 text-destructive" />
              </div>
              Remove Selected Tracks
            </DialogTitle>
            <DialogDescription className="text-base mt-4">
              You're about to remove <span className="font-bold text-destructive">{tracksToRemove.length}</span> track{tracksToRemove.length > 1 ? 's' : ''} from your list. 
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Stats Cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="p-4 rounded-lg border-2 border-destructive/20 bg-destructive/5">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <X className="w-4 h-4 text-destructive" />
                  <span className="text-xs font-semibold text-destructive uppercase tracking-wide">
                    To Remove
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-3xl font-bold text-destructive">{tracksToRemove.length}</span>
                  <p className="text-xs text-muted-foreground mt-1">tracks</p>
                </div>
              </div>

              <div className="p-4 rounded-lg border-2 border-primary/20 bg-primary/5">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <CheckCircle2 className="w-4 h-4 text-primary" />
                  <span className="text-xs font-semibold text-primary uppercase tracking-wide">
                    Remaining
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-3xl font-bold text-primary">{tracks.length - tracksToRemove.length}</span>
                  <p className="text-xs text-muted-foreground mt-1">tracks</p>
                </div>
              </div>

              <div className="p-4 rounded-lg border-2 border-border bg-secondary/50">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <Music2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    Current Total
                  </span>
                </div>
                <div className="text-center">
                  <span className="text-3xl font-bold">{tracks.length}</span>
                  <p className="text-xs text-muted-foreground mt-1">tracks</p>
                </div>
              </div>
            </div>

            {/* Tracks to Remove Preview */}
            <div className="p-4 rounded-lg border border-destructive/20 bg-destructive/5">
              <div className="flex items-center gap-2 mb-3">
                <Music2 className="w-4 h-4 text-destructive" />
                <span className="text-sm font-semibold text-destructive">Tracks to be removed:</span>
              </div>
              <div className="max-h-[200px] overflow-y-auto space-y-2 scrollbar-thin scrollbar-thumb-destructive/20 hover:scrollbar-thumb-destructive/40 scrollbar-track-transparent">
                {tracksToRemove.map((track, index) => (
                  <div 
                    key={track.id} 
                    className="flex items-center gap-3 p-2 rounded-lg bg-background/50 border border-border/50 hover:border-destructive/30 transition-colors"
                  >
                    <div className="flex items-center justify-center w-6 h-6 rounded-full bg-destructive/10 text-destructive text-xs font-bold">
                      {index + 1}
                    </div>
                    {track.imageUrl && (
                      <img 
                        src={track.imageUrl} 
                        alt={track.name}
                        className="w-10 h-10 rounded object-cover"
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{track.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {track.url.includes('youtube.com') ? (
                        <span className="text-xs px-2 py-1 rounded-full bg-red-500/10 text-red-500 font-medium">
                          YouTube
                        </span>
                      ) : (
                        <span className="text-xs px-2 py-1 rounded-full bg-green-500/10 text-green-500 font-medium">
                          Spotify
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Warning Message */}
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <div className="flex items-start gap-3">
                <div className="p-1 bg-destructive/20 rounded-full mt-0.5">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-destructive mb-1">Warning</p>
                  <p className="text-xs text-destructive/80 leading-relaxed">
                    These tracks will be permanently removed from your current list. You'll need to reload the playlist or search again to add them back.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button
              onClick={() => {
                setShowRemoveConfirmDialog(false);
                setTracksToRemove([]);
              }}
              variant="outline"
              className="flex-1 border-border hover:bg-secondary"
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={confirmRemoveSelected}
              variant="destructive"
              className="flex-1 bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove {tracksToRemove.length} Track{tracksToRemove.length > 1 ? 's' : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Hidden YouTube Player */}
      <div id="youtube-player" style={{ display: 'none' }}></div>

      {/* Spotify-Style Audio Player Bar */}
      {currentPlayingTrack && (
        <div 
          data-music-player
          className={`fixed z-[100] bg-gradient-to-r from-card/98 to-secondary/98 backdrop-blur-xl border transition-all duration-300 ${
            isLiveHost ? 'border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.3)]' : 'border-border shadow-2xl'
          } ${
            playerPosition === 'bottom' ? 'bottom-0 left-0 right-0 rounded-t-xl' :
            playerPosition === 'bottom-left' ? 'bottom-4 left-4 w-96 rounded-xl' :
            'bottom-4 right-4 w-96 rounded-xl'
          }`}>
          
          {/* Live Broadcasting Banner */}
          {isLiveHost && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gradient-to-r from-green-600 to-green-500 text-white px-4 py-1 rounded-t-lg flex items-center gap-2 shadow-lg animate-pulse">
              <Radio className="w-3 h-3" />
              <span className="text-xs font-bold uppercase tracking-wider">LIVE · {liveListenerCount} Listening</span>
            </div>
          )}
          
          {/* Player Loading Indicator */}
          {isRestoringPlayer && (
            <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gradient-to-r from-blue-600 to-blue-500 text-white px-4 py-1 rounded-t-lg flex items-center gap-2 shadow-lg">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span className="text-xs font-bold uppercase tracking-wider">RESTORING PLAYER · {playerLoadProgress}%</span>
            </div>
          )}
          <div className="container mx-auto px-4 py-3">
            {/* Minimized View */}
            {isPlayerMinimized ? (
              <div className="flex items-center gap-3 w-full">
                {/* Album Art with Play Overlay */}
                <div className="relative group/mini cursor-pointer flex-shrink-0" onClick={togglePlayPause}>
                  <img
                    src={currentPlayingTrack.imageUrl}
                    alt={currentPlayingTrack.name}
                    className="w-12 h-12 rounded-lg object-cover shadow-lg"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/mini:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                    {isPlaying ? (
                      <Pause className="w-5 h-5 text-white" />
                    ) : (
                      <Play className="w-5 h-5 text-white ml-0.5" />
                    )}
                  </div>
                  {isPlaying && (
                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-secondary rounded-b-lg overflow-hidden">
                      <div 
                        className="h-full bg-primary transition-all duration-100"
                        style={{ width: `${(currentTime / duration) * 100}%` }}
                      ></div>
                    </div>
                  )}
                </div>

                {/* Track Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground truncate">
                    {currentPlayingTrack.name}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {currentPlayingTrack.artist}
                  </p>
                </div>

                {/* Playback Controls */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Shuffle indicator */}
                  {isShuffled && (
                    <Shuffle className="w-3 h-3 text-primary" />
                  )}
                  
                  {/* Repeat indicator */}
                  {repeatMode !== 'off' && (
                    repeatMode === 'one' ? (
                      <Repeat1 className="w-3 h-3 text-primary" />
                    ) : (
                      <Repeat className="w-3 h-3 text-primary" />
                    )
                  )}

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={playPrevious}
                    disabled={isPlayerLoading || !isPlayerReady}
                    className="hover:bg-primary/20 h-8 w-8 p-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <SkipBack className="w-4 h-4" />
                  </Button>

                  <Button
                    size="sm"
                    onClick={togglePlayPause}
                    disabled={isPlayerLoading || !isPlayerReady}
                    className="h-10 w-10 rounded-full bg-primary hover:bg-primary/90 hover:scale-110 transition-all p-0 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                  >
                    {isPlayerLoading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : isPlaying ? (
                      <Pause className="w-5 h-5" />
                    ) : (
                      <Play className="w-5 h-5 ml-0.5" />
                    )}
                  </Button>

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={playNext}
                    disabled={isPlayerLoading || !isPlayerReady}
                    className="hover:bg-primary/20 h-8 w-8 p-0 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <SkipForward className="w-4 h-4" />
                  </Button>
                </div>

                {/* Volume Control with Hover Popover */}
                <div className="relative group/volume flex-shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={toggleMute}
                    className="hover:bg-primary/20 h-8 w-8 p-0"
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </Button>
                  
                  {/* Volume Slider - Shows on Hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 invisible group-hover/volume:opacity-100 group-hover/volume:visible transition-all duration-200">
                    <div className="bg-card/98 backdrop-blur-xl border border-border rounded-lg shadow-2xl p-3 min-w-[200px]">
                      <div className="flex items-center gap-3">
                        <VolumeX className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                        <input
                          type="range"
                          min="0"
                          max="100"
                          step="1"
                          value={isMuted ? 0 : volume}
                          onChange={(e) => changeVolume(Number(e.target.value))}
                          className="flex-1 h-2 bg-secondary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-background hover:[&::-webkit-slider-thumb]:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                        />
                        <Volume2 className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                      </div>
                      <div className="text-center mt-2">
                        <span className="text-xs font-mono text-primary font-bold">
                          {isMuted ? '0%' : `${volume}%`}
                        </span>
                      </div>
                    </div>
                    {/* Arrow pointer */}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px">
                      <div className="w-3 h-3 bg-card border-r border-b border-border rotate-45"></div>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-1 flex-shrink-0">
                  {/* Live Listening Button */}
                  {isLiveHost ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowShareLiveDialog(true)}
                      className="hover:bg-primary/20 h-8 w-8 p-0 relative"
                      title={`Live Session Active - ${liveListenerCount} listeners`}
                    >
                      <Radio className="w-4 h-4 text-green-500 animate-pulse" />
                      {liveListenerCount > 0 && (
                        <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                          {liveListenerCount}
                        </span>
                      )}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowLiveDialog(true)}
                      className="hover:bg-primary/20 h-8 w-8 p-0"
                      title="Start Live Listening"
                    >
                      <Radio className="w-4 h-4" />
                    </Button>
                  )}

                  {/* Picture-in-Picture Toggle */}
                  <PictureInPicturePlayer
                    track={currentPlayingTrack}
                    isPlaying={isPlaying}
                    currentTime={currentTime}
                    duration={duration}
                    volume={volume}
                    isShuffled={isShuffled}
                    repeatMode={repeatMode}
                    onPlayPause={togglePlayPause}
                    onNext={playNext}
                    onPrevious={playPrevious}
                    onSeek={seekTo}
                    onVolumeChange={changeVolume}
                  />

                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowFullScreenPlayer(true)}
                    className="hover:bg-primary/20 h-8 w-8 p-0"
                    title="Open fullscreen player"
                  >
                    <Maximize className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={cyclePlayerPosition}
                    className="hover:bg-primary/20 h-8 w-8 p-0"
                    title="Move player"
                  >
                    <GripVertical className="w-4 h-4" />
                  </Button>
                  
                  <Button
                    onClick={() => setIsPlayerMinimized(false)}
                    className="h-8 w-8 p-0 bg-primary hover:bg-primary/90 hover:scale-110 transition-all shadow-lg"
                    title="Restore player"
                  >
                    <Maximize2 className="w-4 h-4" />
                  </Button>

                  {/* Close button - only show in bottom position */}
                  {playerPosition === 'bottom' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setCurrentPlayingTrack(null);
                        setIsPlaying(false);
                        setIsPlayingAll(false);
                        if (playerRef.current) {
                          playerRef.current.stopVideo();
                        }
                      }}
                      className="hover:bg-destructive/20 hover:text-destructive h-8 w-8 p-0"
                      title="Close player"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              /* Full View */
              <div className={`space-y-3 ${playerPosition !== 'bottom' ? 'max-w-full' : ''}`}>
                <div className={`flex gap-4 ${playerPosition !== 'bottom' ? 'flex-col' : 'items-center'}`}>
                  {/* Track Info */}
                  <div className={`flex items-center gap-3 ${playerPosition === 'bottom' ? 'flex-1 min-w-0' : 'w-full'}`}>
                    <img
                      src={currentPlayingTrack.imageUrl}
                      alt={currentPlayingTrack.name}
                      className={`rounded-lg object-cover shadow-lg ring-2 ring-primary/30 ${
                        playerPosition === 'bottom' ? 'w-16 h-16' : 'w-20 h-20'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className={`font-bold text-foreground truncate ${
                        playerPosition === 'bottom' ? 'text-lg' : 'text-base'
                      }`}>
                        {currentPlayingTrack.name}
                      </p>
                      <p className="text-sm text-muted-foreground truncate">
                        {currentPlayingTrack.artist}
                      </p>
                      {isPlayingAll && (
                        <div className="flex items-center gap-1 mt-1">
                          <Repeat className="w-3 h-3 text-primary" />
                          <span className="text-xs text-primary font-medium">
                            Playing {playlistQueue.findIndex(t => t.id === currentPlayingTrack.id) + 1} of {playlistQueue.length}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Player Controls */}
                  <div className={`flex flex-col items-center gap-2 ${playerPosition === 'bottom' ? 'flex-1' : 'w-full'}`}>
                    <div className="flex items-center gap-4">
                      {/* Shuffle */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={toggleShuffle}
                        className={`hover:bg-primary/20 transition-all ${isShuffled ? 'text-primary' : 'text-muted-foreground'}`}
                        title={isShuffled ? 'Shuffle on' : 'Shuffle off'}
                      >
                        <Shuffle className="w-4 h-4" />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={playPrevious}
                        disabled={isPlayerLoading || !isPlayerReady}
                        className="hover:bg-primary/20 hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        <SkipBack className="w-5 h-5" />
                      </Button>
                      
                      <Button
                        size="lg"
                        onClick={togglePlayPause}
                        disabled={isPlayerLoading || !isPlayerReady}
                        className="w-14 h-14 rounded-full bg-primary hover:bg-primary/90 shadow-lg hover:shadow-xl hover:shadow-primary/50 hover:scale-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        {isPlayerLoading ? (
                          <Loader2 className="w-7 h-7 animate-spin" />
                        ) : isPlaying ? (
                          <Pause className="w-7 h-7" />
                        ) : (
                          <Play className="w-7 h-7 ml-0.5" />
                        )}
                      </Button>
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={playNext}
                        disabled={isPlayerLoading || !isPlayerReady}
                        className="hover:bg-primary/20 hover:scale-110 transition-transform disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                      >
                        <SkipForward className="w-5 h-5" />
                      </Button>

                      {/* Repeat */}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={toggleRepeatMode}
                        className={`hover:bg-primary/20 transition-all ${repeatMode !== 'off' ? 'text-primary' : 'text-muted-foreground'}`}
                        title={repeatMode === 'off' ? 'Repeat off' : repeatMode === 'all' ? 'Repeat all' : 'Repeat one'}
                      >
                        {repeatMode === 'one' ? (
                          <Repeat1 className="w-4 h-4" />
                        ) : (
                          <Repeat className="w-4 h-4" />
                        )}
                      </Button>
                    </div>

                    {/* Progress Bar */}
                    <div className="flex items-center gap-2 w-full max-w-lg">
                      <span className="text-xs text-muted-foreground font-mono w-12 text-right">
                        {formatDuration(Math.floor(currentTime))}
                      </span>
                      <div className="flex-1 group">
                        <input
                          type="range"
                          min="0"
                          max={duration || 100}
                          value={currentTime}
                          onChange={(e) => seekTo(Number(e.target.value))}
                          className="w-full h-1.5 bg-secondary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg group-hover:[&::-webkit-slider-thumb]:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                        />
                      </div>
                      <span className="text-xs text-muted-foreground font-mono w-12">
                        {formatDuration(Math.floor(duration))}
                      </span>
                    </div>
                  </div>

                  {/* Volume & Actions */}
                  <div className={`flex items-center gap-3 justify-end ${playerPosition === 'bottom' ? 'flex-1' : 'w-full'}`}>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={toggleMute}
                      className="hover:bg-primary/20"
                    >
                      {isMuted || volume === 0 ? (
                        <VolumeX className="w-5 h-5" />
                      ) : (
                        <Volume2 className="w-5 h-5" />
                      )}
                    </Button>
                    <div className="group">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        value={isMuted ? 0 : volume}
                        onChange={(e) => changeVolume(Number(e.target.value))}
                        className="w-24 h-1.5 bg-secondary rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg group-hover:[&::-webkit-slider-thumb]:scale-110 [&::-webkit-slider-thumb]:transition-transform"
                      />
                    </div>
                    
                    <div className="w-px h-6 bg-border mx-2"></div>
                    
                    {/* Live Listening Button */}
                    {isLiveHost ? (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowShareLiveDialog(true)}
                        className="hover:bg-primary/20 relative"
                        title={`Live Session Active - ${liveListenerCount} listeners`}
                      >
                        <Radio className="w-4 h-4 text-green-500 animate-pulse" />
                        {liveListenerCount > 0 && (
                          <span className="absolute -top-1 -right-1 bg-green-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">
                            {liveListenerCount}
                          </span>
                        )}
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setShowLiveDialog(true)}
                        className="hover:bg-primary/20"
                        title="Start Live Listening"
                      >
                        <Radio className="w-4 h-4" />
                      </Button>
                    )}
                    
                    {/* Picture-in-Picture Toggle */}
                    <PictureInPicturePlayer
                      track={currentPlayingTrack}
                      isPlaying={isPlaying}
                      currentTime={currentTime}
                      duration={duration}
                      volume={volume}
                      isShuffled={isShuffled}
                      repeatMode={repeatMode}
                      onPlayPause={togglePlayPause}
                      onNext={playNext}
                      onPrevious={playPrevious}
                      onSeek={seekTo}
                      onVolumeChange={changeVolume}
                    />

                    {/* Fullscreen Toggle */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowFullScreenPlayer(true)}
                      className="hover:bg-primary/20"
                      title="Open fullscreen player"
                    >
                      <Maximize className="w-4 h-4" />
                    </Button>
                    
                    {/* Position Toggle */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={cyclePlayerPosition}
                      className="hover:bg-primary/20"
                      title={`Move player (${playerPosition})`}
                    >
                      <GripVertical className="w-4 h-4" />
                    </Button>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setIsPlayerMinimized(true)}
                      className="hover:bg-primary/20"
                      title="Minimize player"
                    >
                      <Minimize2 className="w-4 h-4" />
                    </Button>
                    
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setCurrentPlayingTrack(null);
                        setIsPlaying(false);
                        setIsPlayingAll(false);
                        if (playerRef.current) {
                          playerRef.current.stopVideo();
                        }
                      }}
                      className="hover:bg-destructive/20 hover:text-destructive"
                      title="Close player"
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Track Details Dialog */}
      <Dialog open={showTrackDetails} onOpenChange={setShowTrackDetails}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Music2 className="w-6 h-6 text-primary" />
              Track Details
            </DialogTitle>
          </DialogHeader>

          {selectedTrackForDetails && (
            <div className="space-y-6">
              {/* Album Art & Basic Info */}
              <div className="flex items-start gap-6">
                <img
                  src={selectedTrackForDetails.imageUrl}
                  alt={selectedTrackForDetails.name}
                  className="w-32 h-32 rounded-lg object-cover shadow-lg"
                />
                <div className="flex-1 space-y-2">
                  <h3 className="text-2xl font-bold">{selectedTrackForDetails.name}</h3>
                  <p className="text-lg text-muted-foreground">{selectedTrackForDetails.artist}</p>
                  <p className="text-sm text-muted-foreground">{selectedTrackForDetails.album}</p>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="font-mono bg-secondary px-3 py-1 rounded-full">
                      {formatDuration(selectedTrackForDetails.duration)}
                    </span>
                    {getYouTubeId(selectedTrackForDetails.url) && (
                      <span className="flex items-center gap-1 text-red-500">
                        <Youtube className="w-4 h-4" />
                        YouTube
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <Button
                  onClick={() => {
                    playTrack(selectedTrackForDetails);
                    setShowTrackDetails(false);
                  }}
                  className="flex-1 bg-primary hover:bg-primary/90"
                >
                  <Play className="w-4 h-4 mr-2" />
                  Play Now
                </Button>
                
                {selectedTrackForDetails.url && (
                  <Button
                    onClick={() => {
                      window.open(selectedTrackForDetails.url, '_blank');
                    }}
                    variant="outline"
                    className="flex-1"
                  >
                    <ExternalLink className="w-4 h-4 mr-2" />
                    Open Link
                  </Button>
                )}
              </div>

              {/* Download Status */}
              <div className="p-4 bg-secondary/30 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Download Status:</span>
                  <span className={`text-sm font-bold uppercase ${getStatusColor(selectedTrackForDetails.downloadStatus)}`}>
                    {selectedTrackForDetails.downloadStatus}
                  </span>
                </div>
                {selectedTrackForDetails.downloadStatus === 'downloading' && (
                  <Progress value={selectedTrackForDetails.downloadProgress} className="mt-2" />
                )}
              </div>

              {/* Track Info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Track ID:</span>
                    <span className="font-mono text-xs">{selectedTrackForDetails.id.slice(0, 12)}...</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Selected:</span>
                    <span>{selectedTrackForDetails.selected ? '✓ Yes' : '✗ No'}</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Duration:</span>
                    <span className="font-mono">{formatDuration(selectedTrackForDetails.duration)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Progress:</span>
                    <span>{selectedTrackForDetails.downloadProgress}%</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Save Playlist Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <Save className="w-6 h-6 text-primary" />
              Save Playlist
            </DialogTitle>
            <DialogDescription>
              Save your current playlist to quickly access it later
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="playlist-name">Playlist Name</Label>
              <Input
                id="playlist-name"
                value={savePlaylistName}
                onChange={(e) => setSavePlaylistName(e.target.value)}
                placeholder="My Awesome Playlist"
                className="h-12 text-base"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleSavePlaylist();
                  }
                }}
              />
            </div>

            <div className="p-4 bg-secondary/30 rounded-lg space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Tracks:</span>
                <span className="font-semibold">{tracks.length}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Source:</span>
                <span className="font-semibold">{playlistName || "Custom"}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Owner:</span>
                <span className="font-semibold">You</span>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              💡 Tip: You can reorder tracks by dragging them before saving
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePlaylist}
              disabled={!savePlaylistName.trim()}
              className="bg-primary hover:bg-primary/90"
            >
              <Save className="w-4 h-4 mr-2" />
              Save Playlist
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Full Screen Player */}
      {showFullScreenPlayer && currentPlayingTrack && (
        <FullScreenPlayer
          key={`fullscreen-${playlistQueue.length}`}
          track={currentPlayingTrack}
          isPlaying={isPlaying}
          currentTime={currentTime}
          duration={duration}
          volume={volume}
          isMuted={isMuted}
          isShuffled={isShuffled}
          repeatMode={repeatMode}
          queue={playlistQueue}
          onClose={() => setShowFullScreenPlayer(false)}
          onPlayPause={togglePlayPause}
          onNext={playNext}
          onPrevious={playPrevious}
          onSeek={seekTo}
          onVolumeChange={changeVolume}
          onToggleMute={toggleMute}
          onToggleShuffle={toggleShuffle}
          onCycleRepeat={toggleRepeatMode}
          onPlayTrack={(track) => {
            playTrack(track);
            // Keep fullscreen open when changing tracks from queue
          }}
        />
      )}

      {/* Live Listening Dialogs */}
      <LiveListeningDialog
        open={showLiveDialog}
        onOpenChange={setShowLiveDialog}
        onStartLive={handleStartLiveSession}
      />

      {liveRoomId && (
        <ShareLiveRoomDialog
          open={showShareLiveDialog}
          onOpenChange={setShowShareLiveDialog}
          roomId={liveRoomId}
          listenerCount={liveListenerCount}
          onEndSession={handleEndLiveSession}
        />
      )}

      {/* Reorder Tracks Dialog */}
      <Dialog open={showReorderDialog} onOpenChange={setShowReorderDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GripVertical className="w-5 h-5 text-blue-500" />
              Reorder Selected Tracks
            </DialogTitle>
            <DialogDescription>
              Move {selectedCount} selected track{selectedCount > 1 ? 's' : ''} to a specific position in the playlist.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {/* Selected Tracks Preview */}
            <div className="bg-muted/50 rounded-lg p-3 border border-border">
              <p className="text-sm font-medium mb-2 text-muted-foreground">Selected Tracks:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {tracks.filter(t => t.selected).map((track, index) => (
                  <div key={track.id} className="text-sm flex items-center gap-2 py-1">
                    <span className="text-primary font-semibold">{index + 1}.</span>
                    <span className="truncate">{track.name}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Position Input */}
            <div className="space-y-2">
              <Label htmlFor="reorder-position" className="text-sm font-medium">
                Move to position:
              </Label>
              <div className="flex items-center gap-3">
                <Input
                  id="reorder-position"
                  type="number"
                  min={1}
                  max={tracks.length}
                  value={reorderPosition}
                  onChange={(e) => setReorderPosition(parseInt(e.target.value) || 1)}
                  className="flex-1 text-center text-lg font-semibold"
                />
                <span className="text-sm text-muted-foreground">
                  of {tracks.length}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                💡 Tip: Enter the position number where you want these tracks to appear
              </p>
            </div>

            {/* Visual Preview */}
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <p className="text-sm text-blue-400 flex items-center gap-2">
                <Info className="w-4 h-4" />
                <span>
                  Selected tracks will be moved to position <strong>#{reorderPosition}</strong>
                </span>
              </p>
            </div>
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowReorderDialog(false)}
              className="flex-1 sm:flex-none"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmReorder}
              className="flex-1 sm:flex-none bg-blue-600 hover:bg-blue-700 text-white"
            >
              <GripVertical className="w-4 h-4 mr-2" />
              Reorder Tracks
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
};
