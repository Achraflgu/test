import { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Repeat, Repeat1, Shuffle, Heart, ChevronDown, List, FileText, Info as InfoIcon, Settings, Maximize2, Video, Image as ImageIcon, Activity, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Track } from '@/types';
import { toast } from 'sonner';

interface FullScreenPlayerProps {
  track: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  isShuffled: boolean;
  repeatMode: 'off' | 'all' | 'one';
  queue: Track[];
  onClose: () => void;
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (volume: number) => void;
  onToggleMute: () => void;
  onToggleShuffle: () => void;
  onCycleRepeat: () => void;
  onToggleLike?: () => void;
  onPlayTrack?: (track: Track) => void;
  isLiked?: boolean;
}

type SidebarTab = 'queue' | 'lyrics' | 'info' | null;
type BackgroundMode = 'video' | 'artwork' | 'visualizer';
type QueueState = 'open' | 'minimized' | 'closed';

export const FullScreenPlayer = ({
  track,
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isShuffled,
  repeatMode,
  queue,
  onClose,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onCycleRepeat,
  onToggleLike,
  onPlayTrack,
  isLiked = false,
}: FullScreenPlayerProps) => {
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [backgroundMode, setBackgroundMode] = useState<BackgroundMode>(() => {
    // Load saved background mode from localStorage
    const saved = localStorage.getItem('fullscreen-background-mode');
    return (saved as BackgroundMode) || 'artwork';
  });
  const [showVisualizer, setShowVisualizer] = useState(() => {
    const saved = localStorage.getItem('fullscreen-show-visualizer');
    return saved !== null ? saved === 'true' : true;
  });
  const [dominantColor, setDominantColor] = useState('#6366f1');
  const progressBarRef = useRef<HTMLDivElement>(null);
  const [queueState, setQueueState] = useState<QueueState>('open');
  const settingsRef = useRef<HTMLDivElement>(null);
  const videoPlayerRef = useRef<any>(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
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

  const isYouTubeTrack = track.url.includes('youtube.com') || track.url.includes('youtu.be');
  const videoId = isYouTubeTrack ? extractYouTubeVideoId(track.url) : null;

  // Save background mode preference
  useEffect(() => {
    localStorage.setItem('fullscreen-background-mode', backgroundMode);
  }, [backgroundMode]);

  // Save visualizer preference
  useEffect(() => {
    localStorage.setItem('fullscreen-show-visualizer', String(showVisualizer));
  }, [showVisualizer]);

  // Load YouTube IFrame API
  useEffect(() => {
    if (!window.YT) {
      const tag = document.createElement('script');
      tag.src = 'https://www.youtube.com/iframe_api';
      const firstScriptTag = document.getElementsByTagName('script')[0];
      firstScriptTag.parentNode?.insertBefore(tag, firstScriptTag);
    }
  }, []);

  // Initialize YouTube player for background video
  useEffect(() => {
    // If not in video mode or no videoId, cleanup and return
    if (backgroundMode !== 'video' || !videoId) {
      if (videoPlayerRef.current?.destroy) {
        try {
          videoPlayerRef.current.destroy();
          videoPlayerRef.current = null;
        } catch (err) {
          // Ignore cleanup errors
        }
      }
      setIsVideoReady(false);
      return;
    }

    // Mark video as not ready during transition
    setIsVideoReady(false);

    // Clean up old player before creating new one
    if (videoPlayerRef.current?.destroy) {
      try {
        videoPlayerRef.current.destroy();
        videoPlayerRef.current = null;
      } catch (err) {
        // Ignore cleanup errors
      }
    }

    // Wait for cleanup to complete and iframe to be ready
    const initPlayer = () => {
      if (!window.YT || !window.YT.Player) return;

      try {
        videoPlayerRef.current = new window.YT.Player('bg-video-player', {
          events: {
            onReady: (event: any) => {
              console.log('✅ Background video ready:', videoId);
              setIsVideoReady(true);
              event.target.mute();
              if (isPlaying) {
                event.target.playVideo();
              } else {
                event.target.pauseVideo();
              }
            },
            onError: (event: any) => {
              console.log('❌ Background video error:', event.data);
            }
          },
        });
      } catch (err) {
        console.log('❌ YouTube player init error:', err);
      }
    };

    // Delay to ensure DOM is updated with new videoId
    const timeoutId = setTimeout(() => {
      if (window.YT && window.YT.Player) {
        initPlayer();
      } else {
        window.onYouTubeIframeAPIReady = initPlayer;
      }
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      if (videoPlayerRef.current?.destroy) {
        try {
          videoPlayerRef.current.destroy();
          videoPlayerRef.current = null;
        } catch (err) {
          // Ignore cleanup errors
        }
      }
    };
  }, [backgroundMode, videoId]);

  // Sync video play/pause with music
  useEffect(() => {
    if (!isVideoReady || !videoPlayerRef.current) return;

    try {
      if (isPlaying) {
        videoPlayerRef.current.playVideo?.();
      } else {
        videoPlayerRef.current.pauseVideo?.();
      }
    } catch (err) {
      console.log('Video sync error:', err);
    }
  }, [isPlaying, isVideoReady]);

  // Format time
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressBarRef.current || !duration) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percentage = x / rect.width;
    const newTime = percentage * duration;
    onSeek(newTime);
  };

  // Handle keyboard shortcuts (ESC and F)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // ESC key - Close settings or fullscreen
      if (e.key === 'Escape') {
        if (showSettings) {
          setShowSettings(false);
        } else {
          onClose();
        }
      }
      
      // F key - Toggle fullscreen
      if (e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        onClose();
      }
    };
    
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [onClose, showSettings]);

  // Handle click outside settings to close
  useEffect(() => {
    if (!showSettings) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      const settingsButton = document.querySelector('[data-settings-button]');
      
      // Don't close if clicking the settings button itself (let button handle it)
      if (settingsButton && settingsButton.contains(target)) {
        return;
      }
      
      // Close if clicking outside the settings panel
      if (settingsRef.current && !settingsRef.current.contains(target)) {
        setShowSettings(false);
      }
    };
    
    // Add slight delay to prevent immediate closing after opening
    const timeoutId = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    
    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSettings]);

  // Extract dominant color from album art (simplified)
  useEffect(() => {
    const colors = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4'];
    setDominantColor(colors[Math.floor(Math.random() * colors.length)]);
  }, [track.id]);

  // Auto-scroll to current track in queue
  useEffect(() => {
    if (queueState === 'open' && currentTrackRef.current && queueContainerRef.current) {
      // Smooth scroll to current track with center alignment
      currentTrackRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'center',
        inline: 'nearest'
      });
    }
  }, [track.id, queueState]);

  // Prevent body scroll and hide toasts when fullscreen is open
  useEffect(() => {
    // Save original overflow style
    const originalOverflow = document.body.style.overflow;
    
    // Disable scrolling
    document.body.style.overflow = 'hidden';
    
    // Add class to body to hide toasts
    document.body.classList.add('fullscreen-active');
    
    // Restore on unmount
    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.classList.remove('fullscreen-active');
    };
  }, []);

  // Handle swipe gestures for mobile
  useEffect(() => {
    let startY = 0;
    let startX = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      const endY = e.changedTouches[0].clientY;
      const endX = e.changedTouches[0].clientX;
      const diffY = startY - endY;
      const diffX = Math.abs(startX - endX);

      // Swipe down to close
      if (diffY < -100 && diffX < 50) {
        onClose();
      }
    };

    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onClose]);

  return (
    <div 
      className="fixed inset-0 z-[100] animate-in fade-in duration-500 bg-black"
      style={{
        background: `radial-gradient(ellipse at top, ${dominantColor}02 0%, #000000 50%, ${dominantColor}01 100%)`
      }}
    >
      {/* Vignette Effect for Focus */}
      <div className="absolute inset-0 pointer-events-none bg-gradient-radial from-transparent via-transparent to-black/40" />
      
      {/* Background Layer */}
      <div className="absolute inset-0 overflow-hidden">
        {backgroundMode === 'video' && videoId ? (
          /* YouTube Video Background - Enhanced Visibility with Sync */
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
        ) : backgroundMode === 'artwork' ? (
          /* Album Artwork Background - Enhanced */
          <div className="absolute inset-0">
            <img
              src={track.imageUrl}
              alt={track.name}
              className="absolute inset-0 w-full h-full object-cover scale-110 blur-3xl opacity-20 animate-pulse"
              style={{ animationDuration: '8s' }}
            />
            <div className="absolute inset-0 bg-gradient-radial from-black/60 via-black/80 to-black/95" />
            {/* Floating particles effect */}
            <div className="absolute inset-0 opacity-30">
              <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-white/20 rounded-full animate-ping" style={{ animationDuration: '3s' }} />
              <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-white/20 rounded-full animate-ping" style={{ animationDuration: '4s', animationDelay: '1s' }} />
              <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 bg-white/20 rounded-full animate-ping" style={{ animationDuration: '5s', animationDelay: '2s' }} />
            </div>
          </div>
        ) : (
          /* Visualizer Background - Enhanced */
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/15 via-blue-900/15 to-pink-900/15">
            {/* Animated gradient orbs */}
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
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-10 w-10 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 text-white"
          >
            <ChevronDown className="w-6 h-6" />
          </Button>

          <div className="flex items-center gap-2">
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
              onClick={onClose}
              className="h-10 w-10 rounded-full bg-black/20 backdrop-blur-sm hover:bg-black/40 text-white"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>
        </div>

        {/* Center Content */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 md:px-8 pb-8">
          {/* Album Art */}
          <div className="relative mb-8 md:mb-12 animate-in zoom-in duration-700">
            <div 
              className="absolute inset-0 blur-3xl opacity-50 animate-pulse"
              style={{ background: dominantColor }}
            />
            <div className="relative">
              <img
                src={track.imageUrl}
                alt={track.name}
                className="w-64 h-64 md:w-96 md:h-96 rounded-3xl shadow-2xl ring-4 ring-white/10 object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
              {showVisualizer && isPlaying && (
                <div className="absolute inset-0 rounded-3xl border-4 border-primary/30 animate-pulse" />
              )}
            </div>
          </div>

          {/* Track Info */}
          <div className="text-center mb-8 md:mb-12 max-w-2xl animate-in slide-in-from-bottom duration-700">
            <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-3 line-clamp-2">
              {track.name}
            </h1>
            <p className="text-lg md:text-2xl text-muted-foreground mb-2">
              {track.artist}
            </p>
            {track.album && (
              <p className="text-sm md:text-base text-muted-foreground/70">
                {track.album}
              </p>
            )}
          </div>

          {/* Progress Bar */}
          <div className="w-full max-w-3xl mb-6 animate-in slide-in-from-bottom duration-700 delay-100">
            <div
              ref={progressBarRef}
              onClick={handleProgressClick}
              className="relative h-2 bg-white/10 rounded-full cursor-pointer group mb-2"
            >
              <div
                className="absolute h-full bg-primary rounded-full transition-all"
                style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ left: `${(currentTime / duration) * 100 || 0}%`, marginLeft: '-8px' }}
              />
            </div>
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Main Controls */}
          <div className="flex items-center gap-4 md:gap-8 mb-6 animate-in slide-in-from-bottom duration-700 delay-200">
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleShuffle}
              className={`h-10 w-10 rounded-full ${isShuffled ? 'text-primary bg-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Shuffle className="w-5 h-5" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevious}
              className="h-12 w-12 text-foreground hover:text-primary hover:scale-110 transition-all"
            >
              <SkipBack className="w-7 h-7" />
            </Button>

            <Button
              onClick={onPlayPause}
              className="h-20 w-20 rounded-full bg-white hover:bg-white/90 text-black shadow-2xl hover:scale-105 transition-all"
            >
              {isPlaying ? (
                <Pause className="w-10 h-10" fill="currentColor" />
              ) : (
                <Play className="w-10 h-10 ml-1" fill="currentColor" />
              )}
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
              className="h-12 w-12 text-foreground hover:text-primary hover:scale-110 transition-all"
            >
              <SkipForward className="w-7 h-7" />
            </Button>

            <Button
              variant="ghost"
              size="icon"
              onClick={onCycleRepeat}
              className={`h-10 w-10 rounded-full ${repeatMode !== 'off' ? 'text-primary bg-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
            >
              {repeatMode === 'one' ? <Repeat1 className="w-5 h-5" /> : <Repeat className="w-5 h-5" />}
            </Button>
          </div>

          {/* Secondary Controls */}
          <div className="flex items-center gap-6 animate-in slide-in-from-bottom duration-700 delay-300">
            {/* Volume */}
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleMute}
                className="h-9 w-9 text-muted-foreground hover:text-foreground"
              >
                {isMuted || volume === 0 ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
              </Button>
              <input
                type="range"
                min="0"
                max="100"
                value={isMuted ? 0 : volume}
                onChange={(e) => onVolumeChange(Number(e.target.value))}
                className="w-24 h-1 bg-white/20 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:shadow-lg hover:[&::-webkit-slider-thumb]:scale-110 [&::-webkit-slider-thumb]:transition-transform"
              />
            </div>

            {/* Like */}
            {onToggleLike && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleLike}
                className={`h-9 w-9 ${isLiked ? 'text-red-500' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <Heart className="w-5 h-5" fill={isLiked ? 'currentColor' : 'none'} />
              </Button>
            )}

            {/* Queue Toggle (3 states) */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (queueState === 'open') {
                  setQueueState('minimized');
                } else if (queueState === 'minimized') {
                  setQueueState('closed');
                } else {
                  setQueueState('open');
                }
              }}
              className={`h-9 w-9 ${queueState !== 'closed' ? 'text-primary bg-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
              title="Toggle queue (3 states)"
            >
              <List className="w-5 h-5" />
            </Button>

            {/* Info */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarTab(sidebarTab === 'info' ? null : 'info')}
              className={`h-9 w-9 ${sidebarTab === 'info' ? 'text-primary bg-primary/20' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <InfoIcon className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Sidebar */}
      {sidebarTab && (
        <div className="absolute right-0 top-0 bottom-0 w-full md:w-96 bg-background/95 backdrop-blur-xl border-l border-border animate-in slide-in-from-right duration-300 overflow-y-auto">
          <div className="p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold">
                {sidebarTab === 'queue' && 'Up Next'}
                {sidebarTab === 'lyrics' && 'Lyrics'}
                {sidebarTab === 'info' && 'Track Info'}
              </h2>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarTab(null)}
              >
                <X className="w-5 h-5" />
              </Button>
            </div>

            {sidebarTab === 'queue' && (
              <div className="space-y-2">
                {queue.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">Queue is empty</p>
                ) : (
                  queue.map((queueTrack, index) => (
                    <div
                      key={`${queueTrack.id}-${index}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        onPlayTrack?.(queueTrack);
                      }}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        queueTrack.id === track.id
                          ? 'bg-primary/20 border border-primary/30'
                          : 'hover:bg-secondary/50'
                      }`}
                    >
                      <div className="text-sm text-muted-foreground w-6">{index + 1}</div>
                      <img
                        src={queueTrack.imageUrl}
                        alt={queueTrack.name}
                        className="w-12 h-12 rounded object-cover"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{queueTrack.name}</p>
                        <p className="text-sm text-muted-foreground truncate">{queueTrack.artist}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {sidebarTab === 'info' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <img
                    src={track.imageUrl}
                    alt={track.name}
                    className="w-24 h-24 rounded-lg object-cover"
                  />
                  <div>
                    <p className="font-semibold text-lg">{track.name}</p>
                    <p className="text-muted-foreground">{track.artist}</p>
                  </div>
                </div>
                <div className="space-y-2 pt-4 border-t border-border">
                  {track.album && (
                    <div>
                      <p className="text-sm text-muted-foreground">Album</p>
                      <p className="font-medium">{track.album}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Duration</p>
                    <p className="font-medium">{formatTime(track.duration)}</p>
                  </div>
                  {track.url && (
                    <div>
                      <p className="text-sm text-muted-foreground">Source</p>
                      <p className="font-medium text-sm truncate">
                        {track.url.includes('spotify') ? 'Spotify' : track.url.includes('youtube') ? 'YouTube' : 'External'}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div 
          ref={settingsRef}
          className="absolute top-20 right-4 w-72 bg-card/95 backdrop-blur-xl border border-border rounded-xl shadow-2xl animate-in slide-in-from-top duration-300 p-4 z-[60]"
          onClick={(e) => e.stopPropagation()}
        >
          <h3 className="text-lg font-bold mb-4">Display Settings</h3>
          <div className="space-y-3">
            <button
              onClick={() => {
                setBackgroundMode('video');
                setShowSettings(false);
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                backgroundMode === 'video' ? 'bg-primary/20 border border-primary/30' : 'hover:bg-secondary'
              }`}
            >
              <Video className="w-5 h-5" />
              <div className="flex-1 text-left">
                <p className="font-medium">Video Background</p>
                <p className="text-xs text-muted-foreground">YouTube video as background</p>
              </div>
            </button>

            <button
              onClick={() => {
                setBackgroundMode('artwork');
                setShowSettings(false);
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                backgroundMode === 'artwork' ? 'bg-primary/20 border border-primary/30' : 'hover:bg-secondary'
              }`}
            >
              <ImageIcon className="w-5 h-5" />
              <div className="flex-1 text-left">
                <p className="font-medium">Album Artwork</p>
                <p className="text-xs text-muted-foreground">Blurred album cover</p>
              </div>
            </button>

            <button
              onClick={() => {
                setBackgroundMode('visualizer');
                setShowSettings(false);
              }}
              className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                backgroundMode === 'visualizer' ? 'bg-primary/20 border border-primary/30' : 'hover:bg-secondary'
              }`}
            >
              <Activity className="w-5 h-5" />
              <div className="flex-1 text-left">
                <p className="font-medium">Visualizer</p>
                <p className="text-xs text-muted-foreground">Animated patterns</p>
              </div>
            </button>

            <div className="pt-3 border-t border-border">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium">Show Visualizer</span>
                <input
                  type="checkbox"
                  checked={showVisualizer}
                  onChange={(e) => setShowVisualizer(e.target.checked)}
                  className="w-4 h-4 rounded accent-primary"
                />
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Auto-Display Minimizable Queue (Right Side) */}
      {queue.length > 0 && queueState !== 'closed' && (
        <div 
          className={`fixed top-20 right-4 transition-all duration-300 ${
            queueState === 'minimized' ? 'w-12' : 'w-80 md:w-96'
          } max-h-[calc(100vh-10rem)] bg-background/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl overflow-hidden z-50`}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border bg-gradient-to-r from-primary/10 to-accent/10">
            {queueState === 'open' && (
              <>
                <div className="flex items-center gap-2">
                  <List className="w-5 h-5 text-primary" />
                  <h3 className="font-bold text-lg">Up Next</h3>
                  <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                    {queue.length}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setQueueState('minimized')}
                  className="h-8 w-8 hover:bg-primary/20"
                  title="Minimize"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </>
            )}
            {queueState === 'minimized' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setQueueState('open')}
                className="h-8 w-8 hover:bg-primary/20 mx-auto"
                title="Show queue"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Queue Content */}
          {queueState === 'open' && (
            <div 
              ref={queueContainerRef}
              className="overflow-y-auto max-h-[calc(100vh-16rem)] p-3 space-y-2 scrollbar-thin scrollbar-thumb-primary/20 hover:scrollbar-thumb-primary/40 scrollbar-track-transparent"
            >
              {queue.map((queueTrack, index) => (
                 <div
                   key={`${queueTrack.id}-${index}`}
                   ref={queueTrack.id === track.id ? currentTrackRef : null}
                   onClick={(e) => {
                     e.stopPropagation();
                     onPlayTrack?.(queueTrack);
                   }}
                  className={`group flex items-center gap-3 p-2.5 rounded-xl cursor-pointer transition-all hover:scale-[1.02] ${
                    queueTrack.id === track.id
                      ? 'bg-primary/20 border-2 border-primary/40 shadow-lg shadow-primary/20'
                      : 'bg-secondary/30 hover:bg-secondary/60 border-2 border-transparent hover:border-primary/20'
                  }`}
                >
                  {/* Track Number */}
                  <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    queueTrack.id === track.id 
                      ? 'bg-primary text-primary-foreground' 
                      : 'bg-muted text-muted-foreground group-hover:bg-primary/20 group-hover:text-primary'
                  }`}>
                    {index + 1}
                  </div>

                  {/* Album Art */}
                  <div className="relative flex-shrink-0">
                    <img
                      src={queueTrack.imageUrl}
                      alt={queueTrack.name}
                      className="w-12 h-12 rounded-lg object-cover shadow-md"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.svg';
                      }}
                    />
                    {queueTrack.id === track.id && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg">
                        <div className="w-3 h-3 bg-primary rounded-full animate-pulse" />
                      </div>
                    )}
                  </div>

                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`font-semibold text-sm truncate ${
                      queueTrack.id === track.id ? 'text-primary' : 'text-foreground'
                    }`}>
                      {queueTrack.name}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {queueTrack.artist}
                    </p>
                  </div>

                  {/* Duration */}
                  <div className="flex-shrink-0 text-xs text-muted-foreground font-mono">
                    {formatTime(queueTrack.duration)}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Minimized Queue Indicator - Show: Current Playing + Next 2 */}
          {queueState === 'minimized' && queue.length > 0 && (
            <div className="p-2">
              <div className="flex flex-col gap-1">
                {/* Current Playing Track (First) */}
                <div className="w-8 h-8 rounded-lg overflow-hidden ring-2 ring-primary shadow-lg relative group cursor-pointer" title={track.name}>
                  <img
                    src={track.imageUrl}
                    alt=""
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                  </div>
                </div>
                
                {/* Next 2 Tracks */}
                {queue.slice(0, 2).map((queueTrack, index) => (
                   <div
                     key={`mini-${queueTrack.id}-${index}`}
                     className="w-8 h-8 rounded-lg overflow-hidden opacity-70 hover:opacity-100 transition-opacity cursor-pointer"
                     title={queueTrack.name}
                     onClick={(e) => {
                       e.stopPropagation();
                       onPlayTrack?.(queueTrack);
                     }}
                   >
                    <img
                      src={queueTrack.imageUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ))}
                
                {/* Remaining Count */}
                {queue.length > 2 && (
                  <div className="w-8 h-6 flex items-center justify-center text-[10px] font-bold text-muted-foreground bg-secondary/70 rounded mt-1">
                    +{queue.length - 2}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

