import { useEffect, useState, useRef, useCallback } from 'react';
import { PictureInPicture2 } from 'lucide-react';
import { Track } from '@/types';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

interface PictureInPicturePlayerProps {
  track: Track;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  isShuffled: boolean;
  repeatMode: 'off' | 'all' | 'one';
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
}

export const PictureInPicturePlayer = ({
  track,
  isPlaying,
  currentTime,
  duration,
  isShuffled,
  repeatMode,
  onPlayPause,
  onNext,
  onPrevious,
}: PictureInPicturePlayerProps) => {
  const [isPipActive, setIsPipActive] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(false);
  const pipWindowRef = useRef<Window | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualCloseRef = useRef(false);

  // Check if Document Picture-in-Picture is supported
  useEffect(() => {
    const isSupported = 'documentPictureInPicture' in window;
    setIsPipSupported(isSupported);
  }, []);

  // Format time helper
  const formatTime = useCallback((seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }, []);

  // Create optimized PiP window content (smaller, compact)
  const createPipContent = useCallback(() => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              background: #121212;
              color: #fff;
              overflow: hidden;
              width: 100vw;
              height: 100vh;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              width: 100%;
              padding: 20px;
              display: flex;
              flex-direction: column;
              align-items: center;
              gap: 15px;
            }
            .album-art {
              width: 160px;
              height: 160px;
              border-radius: 12px;
              object-fit: cover;
              box-shadow: 0 8px 24px rgba(0,0,0,0.5);
              border: 2px solid ${isPlaying ? '#1DB954' : 'rgba(255,255,255,0.1)'};
            }
            .now-playing {
              font-size: 10px;
              color: #1DB954;
              font-weight: 600;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              display: ${isPlaying ? 'flex' : 'none'};
              align-items: center;
              gap: 5px;
            }
            .dot {
              width: 4px;
              height: 4px;
              background: #1DB954;
              border-radius: 50%;
              animation: pulse 1.5s infinite;
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.3; }
            }
            .info {
              text-align: center;
              max-width: 220px;
            }
            .title {
              font-size: 16px;
              font-weight: 700;
              margin-bottom: 4px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .artist {
              font-size: 13px;
              color: #b3b3b3;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            .progress {
              width: 220px;
            }
            .bar {
              width: 100%;
              height: 4px;
              background: #4d4d4d;
              border-radius: 2px;
              overflow: hidden;
              margin-bottom: 5px;
            }
            .fill {
              height: 100%;
              background: #1DB954;
              width: ${((currentTime / duration) * 100) || 0}%;
              transition: width 0.3s;
            }
            .time {
              display: flex;
              justify-content: space-between;
              font-size: 10px;
              color: #888;
              font-family: monospace;
            }
            .controls {
              display: flex;
              align-items: center;
              gap: 12px;
            }
            .btn {
              background: none;
              border: none;
              color: #b3b3b3;
              cursor: pointer;
              font-size: 16px;
              padding: 6px;
              transition: all 0.2s;
              display: flex;
              align-items: center;
            }
            .btn:hover { color: #fff; transform: scale(1.1); }
            .btn.active { color: #1DB954; }
            .play-btn {
              width: 42px;
              height: 42px;
              background: #fff;
              border-radius: 50%;
              color: #000;
              font-size: 18px;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            .play-btn:hover {
              transform: scale(1.05);
              color: #000;
            }
            .brand {
              font-size: 9px;
              color: #1DB954;
              font-weight: 600;
              letter-spacing: 0.5px;
              margin-top: 5px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="now-playing">
              <span class="dot"></span>
              Now Playing
            </div>
            
            <img src="${track.imageUrl}" alt="${track.name}" class="album-art" 
                 onerror="this.src='/placeholder.svg'">
            
            <div class="info">
              <div class="title">${track.name}</div>
              <div class="artist">${track.artist}</div>
            </div>
            
            <div class="progress">
              <div class="bar">
                <div class="fill"></div>
              </div>
              <div class="time">
                <span>${formatTime(currentTime)}</span>
                <span>${formatTime(duration)}</span>
              </div>
            </div>
            
            <div class="controls">
              <button class="btn ${isShuffled ? 'active' : ''}" title="Shuffle">⤮</button>
              <button class="btn" onclick="window.opener.postMessage({action:'previous'},'*')" title="Previous">⏮</button>
              <button class="play-btn" onclick="window.opener.postMessage({action:'playPause'},'*')" title="${isPlaying ? 'Pause' : 'Play'}">
                ${isPlaying ? '⏸' : '▶'}
              </button>
              <button class="btn" onclick="window.opener.postMessage({action:'next'},'*')" title="Next">⏭</button>
              <button class="btn ${repeatMode !== 'off' ? 'active' : ''}" title="Repeat">${repeatMode === 'one' ? '🔂' : '🔁'}</button>
            </div>
            
            <div class="brand">♫ TrackMiner</div>
          </div>
        </body>
      </html>
    `;
  }, [track, isPlaying, currentTime, duration, isShuffled, repeatMode, formatTime]);

  // Open PiP window
  const openPip = useCallback(async () => {
    if (isPipActive || !isPipSupported) return;

    try {
      // @ts-ignore
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 320,
        height: 480,
      });

      pipWindowRef.current = pipWindow;

      // Write content
      pipWindow.document.write(createPipContent());
      pipWindow.document.close();

      // Handle window close
      pipWindow.addEventListener('pagehide', () => {
        setIsPipActive(false);
        pipWindowRef.current = null;
        if (updateTimeoutRef.current) {
          clearTimeout(updateTimeoutRef.current);
        }
      });

      setIsPipActive(true);
      isManualCloseRef.current = false;
    } catch (err: any) {
      console.error('PiP error:', err);
      // Silently fail - don't show error toast for auto-open
    }
  }, [isPipActive, isPipSupported, createPipContent]);

  // Close PiP window
  const closePip = useCallback(() => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
    }
    pipWindowRef.current = null;
    setIsPipActive(false);
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }
  }, []);

  // Manual toggle (from button)
  const togglePip = () => {
    if (isPipActive) {
      isManualCloseRef.current = true;
      closePip();
      toast.info('Picture-in-Picture closed');
    } else {
      isManualCloseRef.current = false;
      openPip();
      toast.success('Picture-in-Picture activated! 🎵');
    }
  };

  // Auto open/close on window blur/focus
  useEffect(() => {
    const handleBlur = () => {
      // Only auto-open if not manually closed and playing
      if (!isManualCloseRef.current && isPlaying && !isPipActive) {
        console.log('🎵 Window blurred - Auto-opening PiP');
        openPip();
      }
    };

    const handleFocus = () => {
      // Only auto-close if not manually opened
      if (!isManualCloseRef.current && isPipActive) {
        console.log('👁️ Window focused - Auto-closing PiP');
        closePip();
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [isPlaying, isPipActive, openPip, closePip]);

  // Listen for messages from PiP window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!pipWindowRef.current || event.source !== pipWindowRef.current) return;

      switch (event.data.action) {
        case 'playPause':
          onPlayPause();
          break;
        case 'next':
          onNext();
          break;
        case 'previous':
          onPrevious();
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onPlayPause, onNext, onPrevious]);

  // Optimized update: Only update when PiP is active and values actually changed
  useEffect(() => {
    if (!isPipActive || !pipWindowRef.current || pipWindowRef.current.closed) return;

    // Debounce updates to avoid too frequent redraws
    if (updateTimeoutRef.current) {
      clearTimeout(updateTimeoutRef.current);
    }

    updateTimeoutRef.current = setTimeout(() => {
      if (pipWindowRef.current && !pipWindowRef.current.closed) {
        try {
          pipWindowRef.current.document.open();
          pipWindowRef.current.document.write(createPipContent());
          pipWindowRef.current.document.close();
        } catch (err) {
          console.error('Failed to update PiP:', err);
          setIsPipActive(false);
          pipWindowRef.current = null;
        }
      }
    }, 100); // Debounce by 100ms

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [track.id, isPlaying, Math.floor(currentTime), isShuffled, repeatMode, isPipActive, createPipContent]);

  // Setup MediaSession API for system media controls
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.name,
        artist: track.artist,
        album: track.album || 'Unknown Album',
        artwork: [{ src: track.imageUrl, sizes: '512x512', type: 'image/jpeg' }]
      });

      navigator.mediaSession.setActionHandler('play', onPlayPause);
      navigator.mediaSession.setActionHandler('pause', onPlayPause);
      navigator.mediaSession.setActionHandler('previoustrack', onPrevious);
      navigator.mediaSession.setActionHandler('nexttrack', onNext);
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }
  }, [track, isPlaying, onPlayPause, onNext, onPrevious]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closePip();
    };
  }, [closePip]);

  if (!isPipSupported) {
    return null;
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={togglePip}
      className={`hover:bg-primary/20 ${isPipActive ? 'text-primary' : ''}`}
      title={isPipActive ? 'Close Picture-in-Picture' : 'Open Picture-in-Picture'}
    >
      <PictureInPicture2 className={`w-4 h-4 ${isPipActive ? 'animate-pulse' : ''}`} />
    </Button>
  );
};
