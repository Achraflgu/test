import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Music2, Users, Radio, LogOut, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Loader2, List, ChevronDown, ChevronUp, Music, Settings, Video, Image as ImageIcon, Activity, X } from 'lucide-react';
import { Track } from '@/types';
import { initWebSocket } from '@/services/api';
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

  const videoId = currentTrack ? extractYouTubeVideoId(currentTrack.url) : null;
  const isSpotifyTrack = currentTrack?.url.includes('spotify.com') || false;
  const isYouTubeTrack = !!videoId;

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
    if (!videoId || !isListener) return;

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
              event.target.setVolume(isMuted ? 0 : volume);
              
              // Sync with current state
              if (currentTime > 0) {
                event.target.seekTo(currentTime, true);
              }
              
              if (isPlaying) {
                event.target.playVideo();
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

  // Sync background video with playback
  useEffect(() => {
    if (!videoPlayerRef.current || !isVideoReady) return;

    try {
      if (isPlaying) {
        videoPlayerRef.current.playVideo();
      } else {
        videoPlayerRef.current.pauseVideo();
      }
    } catch (err) {
      // Ignore
    }
  }, [isPlaying, isVideoReady]);

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
        
        if (data.currentTrack) {
          setCurrentTrack(data.currentTrack);
          setIsPlaying(data.isPlaying);
          setCurrentTime(data.currentTime || 0);
          setDuration(data.currentTrack.duration || 0);
        }

        if (data.queue) {
          setQueue(data.queue);
        }

        setIsLoading(false);
        toast.success(`🎧 Joined ${data.hostName}'s Live Session!`);
      });

      // Playback updated
      liveListeningService.onPlaybackUpdated((data) => {
        console.log('🔄 Playback updated:', data);
        
        setIsSyncing(true);
        isSyncingRef.current = true;
        
        const isTrackChange = data.currentTrack && data.currentTrack.id !== currentTrack?.id;
        
        if (isTrackChange) {
          console.log('🎵 Track changed to:', data.currentTrack?.name);
          setCurrentTrack(data.currentTrack);
          setDuration(data.currentTrack.duration || 0);
          setCurrentTime(data.currentTime || 0);
        }
        
        // Update play/pause state
        console.log('🎮 Playback state:', data.isPlaying ? 'Playing' : 'Paused');
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
    <div className="fixed inset-0 bg-black text-white overflow-hidden">
      {/* Hidden Audio Player */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px', width: '1px', height: '1px' }}>
        <div id="live-youtube-player"></div>
      </div>

      {/* Background Layer */}
      <div className="absolute inset-0 overflow-hidden">
        {backgroundMode === 'video' && videoId && (
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
        )}

        {backgroundMode === 'artwork' && currentTrack && (
          <div className="absolute inset-0">
            <img
              src={currentTrack.imageUrl}
              alt={currentTrack.name}
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-30"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/40 to-black/80" />
          </div>
        )}

        {backgroundMode === 'visualizer' && (
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/30 via-black to-blue-900/30">
            {showVisualizer && isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center">
                {[...Array(50)].map((_, i) => (
                  <div
                    key={i}
                    className="w-2 mx-0.5 bg-gradient-to-t from-purple-500 to-blue-500 rounded-t-full animate-pulse"
                    style={{
                      height: `${20 + Math.random() * 60}%`,
                      animationDelay: `${i * 0.05}s`,
                      animationDuration: `${0.5 + Math.random() * 0.5}s`,
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-radial from-purple-500/02 via-transparent to-blue-500/01" />
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* Header */}
        <div className="p-6 pb-4 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-3 bg-purple-500/20 rounded-xl backdrop-blur-sm">
                <Radio className="w-6 h-6 text-purple-400 animate-pulse" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">
                  🎧 Listening Live with {hostName}
                </h1>
                <p className="text-sm text-gray-400">Synchronized playback</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 backdrop-blur-sm rounded-lg">
                <Users className="w-5 h-5 text-purple-400" />
                <span className="font-semibold">{listenerCount}</span>
              </div>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowQueue(!showQueue)}
                className={`hover:bg-purple-500/20 ${showQueue ? 'bg-purple-500/20' : ''}`}
                title="Toggle queue"
              >
                <List className="w-5 h-5" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowSettings(!showSettings)}
                className="hover:bg-purple-500/20"
                title="Display settings"
                data-settings-button
              >
                <Settings className="w-5 h-5" />
              </Button>

              <Button
                variant="outline"
                onClick={handleLeaveRoom}
                className="gap-2 bg-black/20 backdrop-blur-sm border-gray-700 hover:bg-black/40"
              >
                <LogOut className="w-4 h-4" />
                Leave
              </Button>
            </div>
          </div>

          {/* Syncing indicator */}
          {isSyncing && (
            <div className="mt-3">
              <div className="bg-blue-500/20 border border-blue-500/50 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
                <span className="text-sm text-blue-400">🔄 Syncing with {hostName}...</span>
              </div>
            </div>
          )}
        </div>

        {/* Main Content - Flex Container */}
        <div className="flex-1 flex gap-6 px-6 pb-6 min-h-0 overflow-hidden">
          {/* Main Player - Scrollable */}
          <div className={`flex-1 overflow-y-auto overflow-x-hidden ${showQueue ? '' : 'mx-auto max-w-4xl'}`}>
            {currentTrack ? (
              <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-2xl rounded-3xl p-8 border border-purple-500/20">
                {/* Spotify Warning */}
                {isSpotifyTrack && (
                  <div className="mb-6 bg-yellow-500/20 border border-yellow-500/50 rounded-xl p-4 flex items-start gap-3">
                    <div className="text-yellow-500 mt-0.5">⚠️</div>
                    <div className="flex-1">
                      <p className="font-semibold text-yellow-300 mb-1">Spotify Track Limitation</p>
                      <p className="text-sm text-yellow-200/80">
                        This is a Spotify track. Audio playback is not available for Spotify URLs in Live Listening.
                        Only the host can hear this track. YouTube tracks work perfectly for all listeners!
                      </p>
                    </div>
                  </div>
                )}
                
                {/* YouTube Error Info */}
                {!isYouTubeTrack && !isSpotifyTrack && (
                  <div className="mb-6 bg-red-500/20 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
                    <div className="text-red-500 mt-0.5">❌</div>
                    <div className="flex-1">
                      <p className="font-semibold text-red-300 mb-1">Playback Not Available</p>
                      <p className="text-sm text-red-200/80">
                        This track cannot be played in Live Listening. Only YouTube tracks are supported for synchronized playback.
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Album Art */}
                <div className="flex flex-col items-center mb-6">
                  <div className="relative mb-6 group">
                    <img
                      src={currentTrack.imageUrl}
                      alt={currentTrack.name}
                      className="w-80 h-80 rounded-2xl shadow-2xl object-cover ring-4 ring-purple-500/30"
                    />
                    {isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-20 h-20 bg-purple-500/30 rounded-full flex items-center justify-center animate-pulse">
                          <Music2 className="w-10 h-10 text-purple-400" />
                        </div>
                      </div>
                    )}
                  </div>

                  <h2 className="text-3xl font-bold text-center mb-2">{currentTrack.name}</h2>
                  <p className="text-xl text-gray-400 text-center">{currentTrack.artist}</p>
                  <p className="text-sm text-gray-500">{currentTrack.album}</p>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex items-center gap-4">
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
                <div className="flex items-center justify-center gap-6 mb-6">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-14 h-14 opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <SkipBack className="w-6 h-6" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-20 h-20 bg-purple-500/20 hover:bg-purple-500/30 opacity-50 cursor-not-allowed"
                    disabled
                  >
                    {isPlaying ? (
                      <Pause className="w-10 h-10" />
                    ) : (
                      <Play className="w-10 h-10 ml-1" />
                    )}
                  </Button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="w-14 h-14 opacity-50 cursor-not-allowed"
                    disabled
                  >
                    <SkipForward className="w-6 h-6" />
                  </Button>
                </div>

                {/* Volume Control */}
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsMuted(!isMuted)}
                    className="hover:bg-purple-500/20"
                  >
                    {isMuted ? (
                      <VolumeX className="w-5 h-5" />
                    ) : (
                      <Volume2 className="w-5 h-5" />
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
                    className="w-64"
                  />
                  <span className="text-sm text-gray-400 w-12">{isMuted ? 0 : volume}%</span>
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

          {/* Queue Sidebar - Scrollable */}
          {showQueue && (
            <div className="w-96 flex-shrink-0 flex flex-col bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-2xl rounded-3xl border border-purple-500/20 overflow-hidden">
              <div className="p-6 border-b border-purple-500/20 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-2">
                  <List className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-lg">Up Next</h3>
                  {queue.length > 0 && (
                    <span className="text-sm text-gray-400">({queue.length})</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowQueue(false)}
                  className="hover:bg-purple-500/20 h-8 w-8"
                >
                  <ChevronDown className="w-4 h-4" />
                </Button>
              </div>

              <ScrollArea className="flex-1 overflow-y-auto" ref={queueContainerRef}>
                <div className="p-4 space-y-2">
                  {queue.length > 0 ? (
                    queue.map((track, index) => {
                      const isCurrentTrack = track.id === currentTrack?.id;
                      return (
                        <div
                          key={`${track.id}-${index}`}
                          ref={isCurrentTrack ? currentTrackRef : null}
                          className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                            isCurrentTrack
                              ? 'bg-purple-500/30 border border-purple-500/50 scale-105'
                              : 'bg-black/20 hover:bg-black/40'
                          }`}
                        >
                          <div className="relative flex-shrink-0">
                            <img
                              src={track.imageUrl}
                              alt={track.name}
                              className="w-12 h-12 rounded-md object-cover"
                            />
                            {isCurrentTrack && isPlaying && (
                              <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-md">
                                <Music className="w-5 h-5 text-purple-400 animate-pulse" />
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`font-medium text-sm truncate ${isCurrentTrack ? 'text-purple-300' : ''}`}>
                              {track.name}
                            </p>
                            <p className="text-xs text-gray-400 truncate">
                              {track.artist}
                            </p>
                          </div>
                          <span className="text-xs text-gray-500 flex-shrink-0">
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
