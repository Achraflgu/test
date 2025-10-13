import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Music2, Users, Radio, LogOut, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Loader2, List, ChevronDown, ChevronUp, Music } from 'lucide-react';
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
  const [showQueue, setShowQueue] = useState(false);

  const playerRef = useRef<any>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const isSyncingRef = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPlayerReady, setIsPlayerReady] = useState(false);

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

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Initialize YouTube player
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
          },
          events: {
            onReady: (event: any) => {
              console.log('✅ YouTube player ready');
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
              toast.error('Error loading track. Host may have changed songs.');
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

  // Sync player with state
  useEffect(() => {
    if (!playerRef.current || !isPlayerReady || isSyncingRef.current) return;

    try {
      const player = playerRef.current;
      
      // Sync play/pause
      const playerState = player.getPlayerState();
      if (isPlaying && (playerState === 2 || playerState === -1 || playerState === 5)) {
        // Should be playing but is paused/unstarted/cued
        player.playVideo();
      } else if (!isPlaying && playerState === 1) {
        // Should be paused but is playing
        player.pauseVideo();
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
        
        // Show sync indicator
        setIsSyncing(true);
        isSyncingRef.current = true;
        
        const isTrackChange = data.currentTrack && data.currentTrack.id !== currentTrack?.id;
        
        if (isTrackChange) {
          // Track changed
          setCurrentTrack(data.currentTrack);
          setDuration(data.currentTrack.duration || 0);
        }
        
        setIsPlaying(data.isPlaying);
        
        // Sync time if player is ready
        if (playerRef.current && isPlayerReady && !isTrackChange) {
          try {
            const currentPlayerTime = playerRef.current.getCurrentTime() || 0;
            const timeDiff = Math.abs(currentPlayerTime - data.currentTime);
            
            // Only seek if difference is significant (>2 seconds)
            if (timeDiff > 2) {
              playerRef.current.seekTo(data.currentTime, true);
            }
          } catch (err) {
            console.error('Seek error:', err);
          }
        }
        
        setCurrentTime(data.currentTime);

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
    };
  }, [roomId]);

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
    <div className="fixed inset-0 bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20 text-white overflow-hidden">
      {/* Hidden YouTube Player */}
      <div style={{ position: 'absolute', top: '-9999px', left: '-9999px' }}>
        <div id="live-youtube-player"></div>
      </div>

      {/* Header */}
      <div className="relative z-10 p-6 pb-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/20 rounded-xl backdrop-blur-sm">
              <Radio className="w-6 h-6 text-purple-400 animate-pulse" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                🎧 Listening Live with {hostName}
              </h1>
              <p className="text-sm text-gray-400">Synchronized playback - Host controls the music</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 backdrop-blur-sm rounded-lg">
              <Users className="w-5 h-5 text-purple-400" />
              <span className="font-semibold">{listenerCount}</span>
              <span className="text-sm text-gray-400">listener{listenerCount !== 1 ? 's' : ''}</span>
            </div>

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
          <div className="max-w-7xl mx-auto mt-3">
            <div className="bg-blue-500/20 border border-blue-500/50 backdrop-blur-sm rounded-lg px-4 py-2 flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
              <span className="text-sm text-blue-400">🔄 Syncing with {hostName}...</span>
            </div>
          </div>
        )}
      </div>

      {/* Main Content */}
      <div className="flex-1 relative flex items-center justify-center p-6 pt-2">
        <div className="max-w-7xl w-full grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Player */}
          <div className="lg:col-span-2">
            {currentTrack ? (
              <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-2xl rounded-3xl p-8 border border-purple-500/20">
                {/* Album Art */}
                <div className="flex flex-col items-center mb-6">
                  <div className="relative mb-6 group">
                    <img
                      src={currentTrack.imageUrl}
                      alt={currentTrack.name}
                      className="w-96 h-96 rounded-2xl shadow-2xl object-cover ring-4 ring-purple-500/30"
                    />
                    {isPlaying && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity">
                        <div className="w-20 h-20 bg-purple-500/30 rounded-full flex items-center justify-center animate-pulse">
                          <Music2 className="w-10 h-10 text-purple-400" />
                        </div>
                      </div>
                    )}
                  </div>

                  <h2 className="text-4xl font-bold text-center mb-2">{currentTrack.name}</h2>
                  <p className="text-2xl text-gray-400 text-center">{currentTrack.artist}</p>
                  <p className="text-sm text-gray-500">{currentTrack.album}</p>
                </div>

                {/* Progress Bar */}
                <div className="mb-6">
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-gray-400 w-14 text-right">{formatTime(currentTime)}</span>
                    <div className="flex-1">
                      <Progress 
                        value={(currentTime / duration) * 100} 
                        className="h-2 cursor-not-allowed"
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
                    }}
                    max={100}
                    step={1}
                    className="w-64"
                  />
                  <span className="text-sm text-gray-400 w-12">{isMuted ? 0 : volume}%</span>
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

          {/* Queue Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-gradient-to-br from-purple-900/40 to-blue-900/40 backdrop-blur-2xl rounded-3xl border border-purple-500/20 h-full flex flex-col">
              <div className="p-6 border-b border-purple-500/20 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <List className="w-5 h-5 text-purple-400" />
                  <h3 className="font-bold text-lg">Queue</h3>
                  {queue.length > 0 && (
                    <span className="text-sm text-gray-400">({queue.length} tracks)</span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowQueue(!showQueue)}
                  className="lg:hidden"
                >
                  {showQueue ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </div>

              <ScrollArea className={`flex-1 ${showQueue || 'hidden lg:block'}`}>
                <div className="p-4 space-y-2">
                  {queue.length > 0 ? (
                    queue.map((track, index) => (
                      <div
                        key={`${track.id}-${index}`}
                        className={`flex items-center gap-3 p-3 rounded-lg transition-all ${
                          track.id === currentTrack?.id
                            ? 'bg-purple-500/30 border border-purple-500/50'
                            : 'bg-black/20 hover:bg-black/40'
                        }`}
                      >
                        <div className="relative flex-shrink-0">
                          <img
                            src={track.imageUrl}
                            alt={track.name}
                            className="w-12 h-12 rounded-md object-cover"
                          />
                          {track.id === currentTrack?.id && isPlaying && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-md">
                              <Music className="w-5 h-5 text-purple-400 animate-pulse" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
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
                    ))
                  ) : (
                    <div className="text-center py-12">
                      <Music2 className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                      <p className="text-gray-500 text-sm">No queue yet</p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="relative z-10 p-6 pt-2">
        <div className="max-w-7xl mx-auto text-center">
          <p className="text-sm text-gray-500">
            💡 You're listening in sync with {hostName}. Only {hostName} can control playback.
            <br />
            You can adjust your volume independently.
          </p>
        </div>
      </div>
    </div>
  );
};
