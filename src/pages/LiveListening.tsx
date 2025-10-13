import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Music2, Users, Radio, LogOut, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Loader2, List, ChevronDown, ChevronUp, Music, Settings, Video, Image as ImageIcon, Activity, X } from 'lucide-react';
import { Track } from '@/types';
import { initWebSocket, youtubeSearchForPlayer } from '@/services/api';
import { liveListeningService } from '@/services/liveListening';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from 'sonner';

// Declare YouTube API types
declare global {
  interface Window {
    YT: any;
    onYouTubeIframeAPIReady: () => void;
  }
}

type BackgroundMode = 'video' | 'artwork' | 'visualizer';

export const LiveListening = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();

  const [isHost, setIsHost] = useState(false);
  const [isListener, setIsListener] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [hostName, setHostName] = useState('Host');
  const [listenerCount, setListenerCount] = useState(0);

  // Playback state
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [queue, setQueue] = useState<Track[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);
  const [showQueue, setShowQueue] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  
  // Display settings
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>('video');
  const [showVisualizer, setShowVisualizer] = useState(true);

  const playerRef = useRef<any>(null);
  const videoPlayerRef = useRef<any>(null);
  const isSyncingRef = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);
  const queueContainerRef = useRef<HTMLDivElement>(null);
  const currentTrackRef = useRef<HTMLDivElement>(null);

  // Extract YouTube video ID
  const extractYouTubeVideoId = (url: string): string | null => {
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

  const [youtubeSearchId, setYoutubeSearchId] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [dominantColor, setDominantColor] = useState('#6366f1');
  
  const directVideoId = currentTrack ? extractYouTubeVideoId(currentTrack.url) : null;
  const isSpotifyTrack = currentTrack?.url.includes('spotify.com') || false;
  const videoId = directVideoId || youtubeSearchId;
  const isYouTubeTrack = !!videoId;

  // Extract dominant color from album art
  useEffect(() => {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];
    setDominantColor(colors[Math.floor(Math.random() * colors.length)]);
  }, [currentTrack?.id]);

  // Debug: Log queue updates
  useEffect(() => {
    console.log('📋 Live Listening Queue updated:', queue.length, 'tracks');
  }, [queue.length]);

  // Search YouTube for Spotify tracks - WITH PROPER RESET & BACKEND FALLBACK
  useEffect(() => {
    // Reset youtubeSearchId when track changes or is not Spotify
    if (!currentTrack) {
      setYoutubeSearchId(null);
      setIsSearching(false);
      return;
    }

    // If it's a YouTube track, clear search ID
    if (directVideoId || !isSpotifyTrack) {
      setYoutubeSearchId(null);
      setIsSearching(false);
      return;
    }

    // For Spotify tracks, check for cached youtubeId or search backend
    const checkYouTubeId = async () => {
      setIsSearching(true);
      
      try {
        if (currentTrack.youtubeId) {
          console.log('✅ Found cached YouTube ID:', currentTrack.youtubeId);
          setYoutubeSearchId(currentTrack.youtubeId);
        } else {
          console.log('⚠️ No cached YouTube ID for Spotify track:', currentTrack.name);
          // Smart backend search using yt-dlp (no API key)
          const queries = [
            `${currentTrack.name} ${currentTrack.artist} audio`,
            `${currentTrack.artist} ${currentTrack.name}`,
            `${currentTrack.name} official audio`,
            `${currentTrack.name}`,
          ];
          let foundVideoId: string | null = null;
          for (const q of queries) {
            try {
              const res = await youtubeSearchForPlayer(q, 5);
              const first = res.results?.find(r => r.id?.startsWith('search-') || r.url?.includes('youtube.com'));
              if (first) {
                const vid = first.url?.match(/v=([a-zA-Z0-9_-]{11})/)?.[1] || first.videoId;
                if (vid) {
                  foundVideoId = vid;
                  break;
                }
              }
            } catch (e) {
              // ignore and try next query
            }
          }

          if (foundVideoId) {
            console.log('✅ Backend search found YouTube ID:', foundVideoId);
            setYoutubeSearchId(foundVideoId);
          } else {
            console.log('⚠️ Backend search failed; no YouTube version found for:', currentTrack.name);
            setYoutubeSearchId(null);
          }
        }
      } catch (err) {
        console.error('❌ Error checking YouTube ID:', err);
        setYoutubeSearchId(null);
      } finally {
        setIsSearching(false);
      }
    };

    checkYouTubeId();
  }, [currentTrack?.id, isSpotifyTrack, directVideoId, currentTrack?.youtubeId]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Initialize main YouTube player (for audio)
  useEffect(() => {
    if (!videoId || !isListener) {
      // Cleanup player if no videoId (e.g., Spotify without youtubeId)
      if (playerRef.current?.destroy) {
        try {
          console.log('🗑️ Destroying player - no valid videoId');
          playerRef.current.destroy();
          playerRef.current = null;
          setIsPlayerReady(false);
        } catch (err) {
          console.error('Cleanup error:', err);
        }
      }
      return;
    }

    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return;

      // Cleanup old player
      if (playerRef.current?.destroy) {
        try {
          playerRef.current.destroy();
          playerRef.current = null;
        } catch (err) {
          console.error('Cleanup error:', err);
        }
      }

      setIsPlayerReady(false);

      try {
        playerRef.current = new window.YT.Player('live-youtube-player', {
          videoId: videoId,
          playerVars: {
            autoplay: 0,
            controls: 0,
            disablekb: 1,
            modestbranding: 1,
            rel: 0,
            showinfo: 0,
            fs: 0,
          },
          events: {
            onReady: (event: any) => {
              console.log('✅ YouTube player ready:', videoId);
              setIsPlayerReady(true);
              try {
                // Improve autoplay reliability: start muted, play, then unmute if needed
                event.target.mute?.();
                event.target.setVolume?.(isMuted ? 0 : volume);
              } catch {}
              
              // Sync with current state
              if (currentTime > 0) {
                event.target.seekTo(currentTime, true);
              }
              
              if (isPlaying) {
                console.log('▶️ Starting playback');
                try {
                  event.target.playVideo();
                } catch {}
                // Always try to unmute after a short delay if not muted
                setTimeout(() => {
                  try {
                    if (!isMuted) {
                      event.target.unMute?.();
                      event.target.setVolume?.(volume);
                    }
                  } catch {}
                }, 300);
              }
            },
            onStateChange: (event: any) => {
              // Update duration when video loads
              if (event.target.getDuration) {
                const dur = event.target.getDuration();
                if (dur > 0) setDuration(dur);
              }
            },
            onError: (event: any) => {
              console.error('❌ YouTube player error:', event.data);
              toast.error('Error loading track');
            }
          },
        });
      } catch (err) {
        console.error('❌ YouTube player init error:', err);
      }
    };

    // Delay to ensure DOM is updated
    const timeoutId = setTimeout(() => {
      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        window.onYouTubeIframeAPIReady = initPlayer;
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [videoId, isListener]);

  // Force play/pause sync and volume after player is ready (handles adblock/autoplay edge cases)
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady) return;
    try {
      const player = playerRef.current;
      // Sync play/pause
      if (isPlaying) {
        player.playVideo?.();
      } else {
        player.pauseVideo?.();
      }
      // Sync volume/mute
      if (isMuted) {
        player.mute?.();
      } else {
        player.unMute?.();
        player.setVolume?.(volume);
      }
    } catch (err) {
      console.log('Playback/volume sync error:', err);
    }
  }, [isPlaying, isMuted, volume, isPlayerReady]);

  // Initialize background video player
  useEffect(() => {
    if (backgroundMode !== 'video' || !videoId || !isListener) {
      if (videoPlayerRef.current?.destroy) {
        try {
          videoPlayerRef.current.destroy();
          videoPlayerRef.current = null;
        } catch (err) {
          // Ignore
        }
      }
      setIsVideoReady(false);
      return;
    }

    setIsVideoReady(false);

    if (videoPlayerRef.current?.destroy) {
      try {
        videoPlayerRef.current.destroy();
        videoPlayerRef.current = null;
      } catch (err) {
        // Ignore
      }
    }

    const initBgPlayer = () => {
      if (!window.YT || !window.YT.Player) return;

      try {
        videoPlayerRef.current = new window.YT.Player('bg-video-player', {
          events: {
            onReady: (event: any) => {
              console.log('✅ Background video ready');
              setIsVideoReady(true);
              event.target.mute();
              if (isPlaying) {
                event.target.playVideo();
              }
            },
            onError: (event: any) => {
              console.error('❌ Background video error:', event.data);
            }
          },
        });
      } catch (err) {
        console.error('❌ Background player init error:', err);
      }
    };

    const timeoutId = setTimeout(() => {
      if (window.YT && window.YT.Player) {
        initBgPlayer();
      } else {
        window.onYouTubeIframeAPIReady = initBgPlayer;
      }
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      if (videoPlayerRef.current?.destroy) {
        try {
          videoPlayerRef.current.destroy();
          videoPlayerRef.current = null;
        } catch (err) {
          // Ignore
        }
      }
    };
  }, [backgroundMode, videoId, currentTrack?.id, isListener]);

  // Sync background video with playback AND time
  useEffect(() => {
    if (!videoPlayerRef.current || !isVideoReady) return;

    try {
      // Sync time first
      const bgCurrentTime = videoPlayerRef.current.getCurrentTime?.() || 0;
      const timeDiff = Math.abs(bgCurrentTime - currentTime);
      if (timeDiff > 2 && currentTime > 0) {
        videoPlayerRef.current.seekTo?.(currentTime, true);
      }
      
      // Then sync play/pause
      if (isPlaying) {
        videoPlayerRef.current.playVideo();
      } else {
        videoPlayerRef.current.pauseVideo();
      }
    } catch (err) {
      // Ignore
    }
  }, [isPlaying, currentTime, isVideoReady]);

  // Sync main player with state (immediate)
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady) return;

    try {
      const player = playerRef.current;
      
      // Sync play/pause immediately
      const playerState = player.getPlayerState();
      
      if (isPlaying) {
        // Should be playing
        if (playerState !== 1) { // Not playing
          console.log('▶️ Starting playback');
          player.playVideo();
        }
      } else {
        // Should be paused
        if (playerState === 1) { // Currently playing
          console.log('⏸️ Pausing playback');
          player.pauseVideo();
        }
      }

      // Sync volume
      player.setVolume(isMuted ? 0 : volume);
    } catch (err) {
      console.error('Sync error:', err);
    }
  }, [isPlaying, volume, isMuted, isPlayerReady]);

  // Update current time from player
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady) return;

    const interval = setInterval(() => {
      try {
        if (!isSyncingRef.current) {
          const time = playerRef.current.getCurrentTime();
          if (time !== undefined && !isNaN(time)) {
            setCurrentTime(time);
          }
        }
      } catch (err) {
        // Ignore errors
      }
    }, 500);

    return () => clearInterval(interval);
  }, [isPlayerReady]);

  // Initialize WebSocket and join room
  useEffect(() => {
    const socket = initWebSocket();
    liveListeningService.init(socket);

    if (roomId) {
      const userName = localStorage.getItem('userName') || `Listener_${Math.random().toString(36).substring(7)}`;
      liveListeningService.joinRoom(roomId, userName);

      // Room joined
      liveListeningService.onRoomJoined((data) => {
        console.log('✅ Successfully joined room:', data);
        setIsListener(true);
        setIsHost(false);
        setHostName(data.hostName || 'Host');
        setListenerCount(data.listenerCount || 0);
        
        // Sync initial state from host
        if (data.currentTrack) {
          console.log('🎵 Initial track:', data.currentTrack.name);
          console.log('🎮 Initial play state:', data.isPlaying ? 'Playing' : 'Paused');
          console.log('⏱️ Initial time:', data.currentTime);
          console.log('📏 Initial duration:', data.currentTrack.duration);
          
          setCurrentTrack(data.currentTrack);
          setIsPlaying(data.isPlaying); // Match host's play/pause state
          setCurrentTime(data.currentTime || 0);
          setDuration(data.currentTrack.duration || 0);
        }

        if (data.queue) {
          console.log('📋 Initial queue:', data.queue.length, 'tracks');
          setQueue(data.queue);
        }

        setIsLoading(false);
        toast.success(`🎧 Joined ${data.hostName}'s Live Session!`);
      });

      // Playback updated
      liveListeningService.onPlaybackUpdated((data: { currentTrack: Track; currentTime: number; isPlaying: boolean; queue?: Track[] }) => {
        console.log('🔄 Playback updated:', data);
        
        setIsSyncing(true);
        isSyncingRef.current = true;
        
        const isTrackChange = data.currentTrack && data.currentTrack.id !== currentTrack?.id;
        
        if (isTrackChange) {
          console.log('🎵 Track changed to:', data.currentTrack?.name);
          setCurrentTrack(data.currentTrack);
          setDuration(data.currentTrack?.duration || 0);
          setCurrentTime(data.currentTime || 0);
        } else if (data.currentTrack) {
          // Same track, prefer player's known duration when ready to avoid flicker
          let newDuration = data.currentTrack.duration || duration;
          try {
            if (playerRef.current?.getDuration && isPlayerReady) {
              const playerDur = playerRef.current.getDuration();
              if (playerDur && playerDur > 0) newDuration = playerDur;
            }
          } catch {}
          if (Math.abs(newDuration - duration) > 1) {
            console.log('📏 Duration updated:', newDuration);
            setDuration(newDuration);
          }
        }
        
        // Update play/pause state - CRITICAL for sync
        const playStateChanged = data.isPlaying !== isPlaying;
        if (playStateChanged) {
          console.log('🎮 Playback state CHANGED:', data.isPlaying ? 'Playing' : 'Paused');
        }
        setIsPlaying(data.isPlaying);
        
        // Sync time only if not track change and player is ready
        if (playerRef.current && isPlayerReady && !isTrackChange) {
          try {
            const currentPlayerTime = playerRef.current.getCurrentTime() || 0;
            const timeDiff = Math.abs(currentPlayerTime - data.currentTime);
            
            console.log(`⏱️ Time sync - Player: ${currentPlayerTime.toFixed(1)}s, Host: ${data.currentTime.toFixed(1)}s, Diff: ${timeDiff.toFixed(1)}s`);
            
            // Sync if difference is significant
            if (timeDiff > 2) {
              console.log('🔄 Seeking to', data.currentTime);
              playerRef.current.seekTo(data.currentTime, true);
            }
            setCurrentTime(data.currentTime);
          } catch (err) {
            console.error('Seek error:', err);
            setCurrentTime(data.currentTime);
          }
        } else if (!isTrackChange) {
          setCurrentTime(data.currentTime);
        }

        if (data.queue) {
          console.log('📋 Queue updated:', data.queue.length, 'tracks');
          setQueue(data.queue);
        }

        setTimeout(() => {
          setIsSyncing(false);
          isSyncingRef.current = false;
        }, 1000);
      });

      liveListeningService.onListenerCountUpdated((data) => {
        setListenerCount(data.listenerCount);
      });

      liveListeningService.onRoomEnded((data) => {
        toast.error(data.message || 'Live session ended');
        setTimeout(() => navigate('/'), 2000);
      });

      liveListeningService.onRoomError((data) => {
        toast.error(data.message || 'Room error');
        setIsLoading(false);
        setTimeout(() => navigate('/'), 2000);
      });
    } else {
      toast.error('No room ID provided');
      navigate('/');
    }

    return () => {
      if (isListener) {
        liveListeningService.leaveRoom();
      }
      liveListeningService.cleanup();
      
      if (playerRef.current?.destroy) {
        try {
          playerRef.current.destroy();
        } catch (err) {
          // Ignore
        }
      }
      
      if (videoPlayerRef.current?.destroy) {
        try {
          videoPlayerRef.current.destroy();
        } catch (err) {
          // Ignore
        }
      }
    };
  }, [roomId]);

  // Auto-scroll to current track in queue
  useEffect(() => {
    if (showQueue && currentTrackRef.current && queueContainerRef.current) {
      currentTrackRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  }, [currentTrack?.id, showQueue]);

  // Click outside to close settings
  useEffect(() => {
    if (!showSettings) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (settingsRef.current && !settingsRef.current.contains(target) && !target.closest('[data-settings-button]')) {
        setTimeout(() => setShowSettings(false), 100);
      }
    };

    setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleLeaveRoom = () => {
    if (isListener) {
      liveListeningService.leaveRoom();
    }
    toast.success('Left live session');
    navigate('/');
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-500" />
          <p className="text-gray-400">Joining live session...</p>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="fixed inset-0 z-[100] animate-in fade-in duration-500 bg-black text-white"
      style={{
        background: `radial-gradient(ellipse at top, ${dominantColor}02 0%, #000000 50%, ${dominantColor}01 100%)`
      }}
    >
      {/* Hidden Audio Player */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '1px', height: '1px' }}>
        <div id="live-youtube-player"></div>
      </div>

      {/* Vignette Effect */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-radial from-transparent via-transparent to-black/40" />

      {/* Background Layer - Like FullScreenPlayer */}
      <div className="absolute inset-0 overflow-hidden">
        {backgroundMode === 'video' && videoId ? (
          <div className="absolute inset-0" key={`video-${videoId}`}>
            <iframe
              id="bg-video-player"
              key={videoId}
              src={`https://www.youtube.com/embed/${videoId}?autoplay=${isPlaying ? 1 : 0}&mute=1&controls=0&loop=1&playlist=${videoId}&enablejsapi=1&modestbranding=1&rel=0`}
              className="absolute inset-0 w-full h-full object-cover scale-125 blur-sm opacity-40"
              allow="autoplay"
              title="Background Video"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/30 to-black/70" />
          </div>
        ) : backgroundMode === 'artwork' && currentTrack ? (
          <div className="absolute inset-0">
            <img
              src={currentTrack.imageUrl}
              alt={currentTrack.name}
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-20 animate-pulse"
              style={{ animationDuration: '8s' }}
            />
            <div className="absolute inset-0 bg-gradient-radial from-black/60 via-black/80 to-black/95" />
            {/* Floating particles */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-white/20 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
              <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-white/20 rounded-full animate-ping" style={{ animationDuration: '4s', animationDelay: '1s' }} />
              <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 bg-white/20 rounded-full animate-ping" style={{ animationDuration: '5s', animationDelay: '2s' }} />
            </div>
          </div>
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/15 via-blue-900/15 to-pink-900/15">
            <div className="absolute top-0 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '6s' }} />
            <div className="absolute bottom-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s', animationDelay: '2s' }} />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '7s', animationDelay: '1s' }} />
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAxMCAwIEwgMCAwIDAgMTAiIGZpbGw9Im5vbmUiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMC41IiBvcGFjaXR5PSIwLjEiLz48L3BhdHRlcm4+PC9kZWZzPjxyZWN0IHdpZHRoPSIxMDAlIiBoZWlnaHQ9IjEwMCUiIGZpbGw9InVybCgjZ3JpZCkiLz48L3N2Zz4=')] opacity-10" />
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="relative h-full flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 md:p-6">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/20 rounded-xl backdrop-blur-sm">
              <Radio className="w-6 h-6 text-purple-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold">
                🎧 Listening Live with {hostName}
              </h1>
              <p className="text-xs md:text-sm text-gray-400 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span>{listenerCount} listening</span>
                {isSyncing && (
                  <>
                    <span>•</span>
                    <Loader2 className="w-3 h-3 animate-spin text-blue-400 inline" />
                    <span className="text-blue-400">Syncing...</span>
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Right side buttons */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowQueue(!showQueue)}
              className={`h-10 w-10 rounded-full backdrop-blur-sm text-white transition-all ${
                showQueue 
                  ? 'bg-primary/40 hover:bg-primary/50 ring-2 ring-primary/30' 
                  : 'bg-black/20 hover:bg-black/40'
              }`}
              title="Toggle queue"
            >
              <List className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              data-settings-button
              onClick={(e) => {
                e.stopPropagation();
                setShowSettings(prev => !prev);
              }}
              className={`h-10 w-10 rounded-full backdrop-blur-sm text-white transition-all ${
                showSettings 
                  ? 'bg-primary/40 hover:bg-primary/50 ring-2 ring-primary/30' 
                  : 'bg-black/20 hover:bg-black/40'
              }`}
            >
              <Settings className={`w-5 h-5 transition-transform ${showSettings ? 'rotate-90' : ''}`} />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={handleLeaveRoom}
              className="h-10 w-10 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 text-white"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Main Content - Flex Container - FULLSCREEN NO SCROLL */}
        <div className="flex-1 flex gap-2 md:gap-4 px-2 md:px-4 pb-2 md:pb-4 min-h-0 overflow-hidden">
          {/* Main Player - NO SCROLL - FULLY RESPONSIVE */}
          <div className={`flex-1 overflow-hidden flex items-center justify-center ${showQueue ? '' : 'mx-auto'}`}>
            {currentTrack ? (
              <div className="w-full max-w-5xl bg-gradient-to-br from-purple-900/30 to-blue-900/30 backdrop-blur-2xl rounded-2xl md:rounded-3xl p-3 md:p-6 lg:p-10 xl:p-12 border border-purple-500/20 flex flex-col justify-center h-full">
                {/* Playing YouTube Version - Green status */}
                {(isYouTubeTrack || (isSpotifyTrack && youtubeSearchId)) && !isSearching && (
                  <div className="mb-4 bg-green-500/10 border border-green-500/30 rounded-xl p-3 flex items-center gap-3">
                    <div className="text-green-400">✅</div>
                    <p className="text-sm text-green-300">
                      Synced playback active • Audio playing from {isSpotifyTrack ? 'YouTube (converted)' : 'YouTube'}
                    </p>
                  </div>
                )}
                
                {/* Album Art - RESPONSIVE NO SCROLL */}
                <div className="flex flex-col items-center mb-3 md:mb-4 lg:mb-6 flex-shrink-0">
                  <div className="relative mb-2 md:mb-4 lg:mb-6 group">
                    <img
                      src={currentTrack.imageUrl}
                      alt={currentTrack.name}
                      className="w-40 h-40 sm:w-52 sm:h-52 md:w-64 md:h-64 lg:w-80 lg:h-80 xl:w-96 xl:h-96 rounded-xl md:rounded-2xl lg:rounded-3xl shadow-2xl object-cover ring-2 md:ring-4 ring-purple-500/30 transition-transform group-hover:scale-[1.02]"
                    />
                    {isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl md:rounded-3xl opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-16 h-16 md:w-24 md:h-24 bg-purple-500/30 rounded-full flex items-center justify-center animate-pulse">
                          <Music2 className="w-8 h-8 md:w-12 md:h-12 text-purple-400" />
                        </div>
                      </div>
                    )}
                  </div>

                  <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-bold text-center mb-1 md:mb-2 px-4 line-clamp-2">{currentTrack.name}</h2>
                  <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl text-gray-400 text-center mb-1 truncate max-w-full px-4">{currentTrack.artist}</p>
                  <p className="text-xs md:text-sm lg:text-base text-gray-500 truncate max-w-full px-4">{currentTrack.album}</p>
                </div>

                {/* Progress Bar */}
                <div className="mb-3 md:mb-4 lg:mb-6">
                  <div className="flex items-center gap-2 md:gap-4">
                    <span className="text-sm text-gray-400 w-14 text-right">{formatTime(currentTime)}</span>
                    <div className="flex-1 group">
                      <input
                        type="range"
                        min="0"
                        max={duration || 100}
                        value={currentTime}
                        readOnly
                        className="w-full h-2 bg-secondary rounded-full appearance-none cursor-default [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition-transform"
                        style={{
                          background: `linear-gradient(to right, hsl(var(--primary)) 0%, hsl(var(--primary)) ${(currentTime / duration) * 100}%, hsl(var(--secondary)) ${(currentTime / duration) * 100}%, hsl(var(--secondary)) 100%)`
                        }}
                      />
                    </div>
                    <span className="text-sm text-gray-400 w-14">{formatTime(duration)}</span>
                  </div>
                  <p className="text-xs text-center text-gray-500 mt-2">
                    Controlled by {hostName}
                  </p>
                </div>

                {/* Controls (Display only) */}
                <div className="flex items-center justify-center gap-4 md:gap-6 mb-3 md:mb-4 lg:mb-6">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-12 h-12 md:w-14 md:h-14 opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <SkipBack className="w-5 h-5 md:w-6 md:h-6" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-16 h-16 md:w-20 md:h-20 bg-purple-500/20 hover:bg-purple-500/30 opacity-50 cursor-not-allowed"
                    disabled
                  >
                    {isPlaying ? (
                      <Pause className="w-8 h-8 md:w-10 md:h-10" />
                    ) : (
                      <Play className="w-8 h-8 md:w-10 md:h-10 ml-1" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-12 h-12 md:w-14 md:h-14 opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <SkipForward className="w-5 h-5 md:w-6 md:h-6" />
                  </Button>
                </div>

                {/* Volume Control */}
                <div className="flex items-center justify-center gap-2 md:gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsMuted(!isMuted)}
                    className="hover:bg-purple-500/20 flex-shrink-0"
                  >
                    {isMuted ? (
                      <VolumeX className="w-4 h-4 md:w-5 md:h-5" />
                    ) : (
                      <Volume2 className="w-4 h-4 md:w-5 md:h-5" />
                    )}
                  </Button>
                  <Slider
                    value={[isMuted ? 0 : volume]}
                    onValueChange={(values) => {
                      setVolume(values[0]);
                      if (values[0] > 0) setIsMuted(false);
                      if (playerRef.current && isPlayerReady) {
                        try {
                          playerRef.current.setVolume(values[0]);
                        } catch (err) {
                          // Ignore
                        }
                      }
                    }}
                    max={100}
                    step={1}
                    className="w-32 sm:w-48 md:w-64"
                  />
                  <span className="text-xs md:text-sm text-gray-400 w-10 md:w-12 flex-shrink-0">{isMuted ? 0 : volume}%</span>
                </div>

                {/* Info */}
                <div className="mt-6 text-center">
                  <p className="text-sm text-gray-500">
                    💡 Only {hostName} can control playback • You can adjust your volume
                  </p>
                  {isYouTubeTrack && (
                    <p className="text-xs text-green-400 mt-2">
                      ✅ YouTube playback active - Audio synced with {hostName}
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-2xl rounded-3xl p-16 border border-purple-500/20 text-center">
                <Music2 className="w-20 h-20 mx-auto mb-6 text-gray-500" />
                <p className="text-2xl text-gray-400 mb-2">Waiting for music...</p>
                <p className="text-gray-500">{hostName} will play a track soon</p>
              </div>
            )}
          </div>

          {/* Queue Sidebar - FULLSCREEN STYLE - Always Prominent */}
          {showQueue && (
            <div className="w-72 md:w-80 lg:w-96 xl:w-[26rem] flex-shrink-0 flex flex-col bg-gradient-to-br from-purple-900/50 to-blue-900/50 backdrop-blur-3xl rounded-2xl md:rounded-3xl border-2 border-purple-500/30 overflow-hidden shadow-2xl">
              <div className="p-6 border-b border-purple-500/30 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-500/20 rounded-lg">
                    <List className="w-5 h-5 text-purple-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xl">Up Next</h3>
                    {queue.length > 0 && (
                      <p className="text-xs text-purple-400">
                        {queue.length} track{queue.length !== 1 ? 's' : ''} in queue
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowQueue(false)}
                  className="hover:bg-purple-500/20 h-10 w-10"
                >
                  <ChevronDown className="w-5 h-5" />
                </Button>
              </div>

              <ScrollArea className="flex-1 overflow-y-auto" ref={queueContainerRef} key={`queue-${queue.length}`}>
                <div className="p-4 space-y-2">
                  {queue.length > 0 ? (
                    queue.map((track, index) => {
                      const isCurrentTrack = track.id === currentTrack?.id;
                      return (
                        <div
                          key={`${track.id}-${index}-${queue.length}`}
                          ref={isCurrentTrack ? currentTrackRef : null}
                          className={`flex items-center gap-4 p-4 rounded-xl transition-all cursor-default ${
                            isCurrentTrack
                              ? 'bg-gradient-to-r from-purple-500/40 to-blue-500/40 border-2 border-purple-500/60 scale-[1.02] shadow-lg'
                              : 'bg-black/30 hover:bg-black/50 border border-transparent'
                          }`}
                        >
                          <div className="relative flex-shrink-0">
                            <img
                              src={track.imageUrl}
                              alt={track.name}
                              className="w-16 h-16 rounded-lg object-cover shadow-md"
                            />
                            {isCurrentTrack && isPlaying && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                                <Music className="w-6 h-6 text-purple-400 animate-pulse" />
                              </div>
                            )}
                            {isCurrentTrack && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-purple-500 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-semibold text-base truncate mb-1 ${isCurrentTrack ? 'text-purple-200' : 'text-white'}`}>
                              {track.name}
                            </p>
                            <p className="text-sm text-gray-400 truncate">
                              {track.artist}
                            </p>
                          </div>
                          <span className="text-sm text-gray-500 flex-shrink-0 font-medium">
                            {formatTime(track.duration)}
                          </span>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-12">
                      <Music2 className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                      <p className="text-gray-500 text-sm">No tracks in queue</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          )}
        </div>

        {/* Settings Panel */}
        {showSettings && (
          <div 
            ref={settingsRef}
            className="absolute top-20 right-6 bg-gradient-to-br from-purple-900/95 to-blue-900/95 backdrop-blur-2xl rounded-2xl border border-purple-500/30 p-6 shadow-2xl z-20 w-80"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-lg">Display Settings</h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(false)}
                className="hover:bg-purple-500/20 h-8 w-8"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-3">Background Mode</p>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setBackgroundMode('video')}
                    className={`flex flex-col items-center gap-2 h-auto py-3 ${
                      backgroundMode === 'video' ? 'bg-purple-500/30 border-purple-500' : ''
                    }`}
                  >
                    <Video className="w-5 h-5" />
                    <span className="text-xs">Video</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setBackgroundMode('artwork')}
                    className={`flex flex-col items-center gap-2 h-auto py-3 ${
                      backgroundMode === 'artwork' ? 'bg-purple-500/30 border-purple-500' : ''
                    }`}
                  >
                    <ImageIcon className="w-5 h-5" />
                    <span className="text-xs">Artwork</span>
                  </Button>

                  <Button
                    variant="outline"
                    onClick={() => setBackgroundMode('visualizer')}
                    className={`flex flex-col items-center gap-2 h-auto py-3 ${
                      backgroundMode === 'visualizer' ? 'bg-purple-500/30 border-purple-500' : ''
                    }`}
                  >
                    <Activity className="w-5 h-5" />
                    <span className="text-xs">Visualizer</span>
                  </Button>
                </div>
              </div>

              {backgroundMode === 'visualizer' && (
                <div className="flex items-center justify-between">
                  <span className="text-sm">Show Visualizer</span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowVisualizer(!showVisualizer)}
                    className={showVisualizer ? 'bg-purple-500/30' : ''}
                  >
                    {showVisualizer ? 'On' : 'Off'}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
