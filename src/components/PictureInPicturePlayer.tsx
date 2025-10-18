import { useEffect, useState, useRef } from 'react';
import { PictureInPicture2, X } from 'lucide-react';
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

  // Check if Document Picture-in-Picture is supported
  useEffect(() => {
    const isSupported = 'documentPictureInPicture' in window;
    setIsPipSupported(isSupported);
    if (!isSupported) {
      console.log('Document Picture-in-Picture is not supported in this browser');
    }
  }, []);

  // Format time helper
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Create PiP window content
  const createPipContent = () => {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
              background: #121212;
              color: #ffffff;
              overflow: hidden;
              display: flex;
              align-items: center;
              justify-content: center;
              width: 100vw;
              height: 100vh;
            }
            
            .player-container {
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              padding: 30px;
              background: linear-gradient(135deg, #1a1a1a 0%, #121212 100%);
              position: relative;
            }
            
            .close-btn {
              position: absolute;
              top: 15px;
              right: 15px;
              background: rgba(255, 255, 255, 0.1);
              border: none;
              color: white;
              width: 32px;
              height: 32px;
              border-radius: 50%;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 18px;
              transition: all 0.2s;
            }
            
            .close-btn:hover {
              background: rgba(255, 255, 255, 0.2);
              transform: scale(1.1);
            }
            
            .album-art-container {
              position: relative;
              margin-bottom: 25px;
            }
            
            .album-art {
              width: 240px;
              height: 240px;
              border-radius: 16px;
              object-fit: cover;
              box-shadow: 0 20px 60px rgba(0, 0, 0, 0.6);
              border: 3px solid ${isPlaying ? '#1DB954' : 'rgba(255, 255, 255, 0.1)'};
              transition: border-color 0.3s;
            }
            
            ${isPlaying ? `
            .album-art {
              animation: pulse 2s ease-in-out infinite;
            }
            
            @keyframes pulse {
              0%, 100% { border-color: #1DB954; }
              50% { border-color: #1ed760; }
            }
            ` : ''}
            
            .now-playing {
              position: absolute;
              top: -10px;
              left: 50%;
              transform: translateX(-50%);
              background: #1DB954;
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: 600;
              letter-spacing: 0.5px;
              text-transform: uppercase;
              display: ${isPlaying ? 'flex' : 'none'};
              align-items: center;
              gap: 6px;
            }
            
            .playing-indicator {
              width: 4px;
              height: 4px;
              background: white;
              border-radius: 50%;
              animation: blink 1.5s ease-in-out infinite;
            }
            
            @keyframes blink {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.3; }
            }
            
            .track-info {
              text-align: center;
              margin-bottom: 20px;
              max-width: 350px;
            }
            
            .track-name {
              font-size: 22px;
              font-weight: 700;
              margin-bottom: 8px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
              color: #ffffff;
            }
            
            .artist-name {
              font-size: 16px;
              color: #b3b3b3;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            
            .progress-section {
              width: 100%;
              max-width: 350px;
              margin-bottom: 20px;
            }
            
            .progress-bar {
              width: 100%;
              height: 6px;
              background: #4d4d4d;
              border-radius: 3px;
              overflow: hidden;
              margin-bottom: 8px;
            }
            
            .progress-fill {
              height: 100%;
              background: #1DB954;
              border-radius: 3px;
              transition: width 0.3s;
              width: ${((currentTime / duration) * 100) || 0}%;
            }
            
            .time-display {
              display: flex;
              justify-content: space-between;
              font-size: 12px;
              color: #b3b3b3;
              font-family: 'SF Mono', Monaco, monospace;
            }
            
            .controls {
              display: flex;
              align-items: center;
              gap: 20px;
            }
            
            .control-btn {
              background: none;
              border: none;
              color: #b3b3b3;
              cursor: pointer;
              font-size: 20px;
              transition: all 0.2s;
              padding: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            
            .control-btn:hover {
              color: #ffffff;
              transform: scale(1.1);
            }
            
            .control-btn.active {
              color: #1DB954;
            }
            
            .play-btn {
              width: 56px;
              height: 56px;
              background: #ffffff;
              border-radius: 50%;
              color: #000000;
              font-size: 24px;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
            }
            
            .play-btn:hover {
              transform: scale(1.05);
              box-shadow: 0 6px 16px rgba(0, 0, 0, 0.4);
            }
            
            .branding {
              position: absolute;
              bottom: 15px;
              left: 50%;
              transform: translateX(-50%);
              font-size: 11px;
              color: #1DB954;
              font-weight: 600;
              letter-spacing: 0.5px;
            }
          </style>
        </head>
        <body>
          <div class="player-container">
            <button class="close-btn" onclick="window.close()">×</button>
            
            <div class="album-art-container">
              <div class="now-playing">
                <span class="playing-indicator"></span>
                Now Playing
              </div>
              <img src="${track.imageUrl}" alt="${track.name}" class="album-art" 
                   onerror="this.src='/placeholder.svg'">
            </div>
            
            <div class="track-info">
              <div class="track-name" title="${track.name}">${track.name}</div>
              <div class="artist-name" title="${track.artist}">${track.artist}</div>
            </div>
            
            <div class="progress-section">
              <div class="progress-bar">
                <div class="progress-fill"></div>
              </div>
              <div class="time-display">
                <span>${formatTime(currentTime)}</span>
                <span>${formatTime(duration)}</span>
              </div>
            </div>
            
            <div class="controls">
              <button class="control-btn ${isShuffled ? 'active' : ''}" title="Shuffle">
                ⤮
              </button>
              
              <button class="control-btn" onclick="window.opener.postMessage({action: 'previous'}, '*')" title="Previous">
                ⏮
              </button>
              
              <button class="play-btn" onclick="window.opener.postMessage({action: 'playPause'}, '*')" title="${isPlaying ? 'Pause' : 'Play'}">
                ${isPlaying ? '⏸' : '▶'}
              </button>
              
              <button class="control-btn" onclick="window.opener.postMessage({action: 'next'}, '*')" title="Next">
                ⏭
              </button>
              
              <button class="control-btn ${repeatMode !== 'off' ? 'active' : ''}" title="Repeat">
                ${repeatMode === 'one' ? '🔂' : '🔁'}
              </button>
            </div>
            
            <div class="branding">♫ TrackMiner</div>
          </div>
        </body>
      </html>
    `;
  };

  // Open PiP window
  const openPip = async () => {
    try {
      // @ts-ignore - DocumentPictureInPicture is experimental
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 500,
        height: 600,
      });

      pipWindowRef.current = pipWindow;

      // Write content to PiP window
      pipWindow.document.write(createPipContent());
      pipWindow.document.close();

      // Handle window close
      pipWindow.addEventListener('pagehide', () => {
        setIsPipActive(false);
        pipWindowRef.current = null;
      });

      setIsPipActive(true);
      toast.success('Picture-in-Picture activated! 🎵', {
        description: 'Floating player is now active',
      });
    } catch (err: any) {
      console.error('PiP error:', err);
      toast.error('Failed to open Picture-in-Picture', {
        description: 'This feature requires Chrome 116+ or Edge 116+',
      });
    }
  };

  // Close PiP window
  const closePip = () => {
    if (pipWindowRef.current) {
      pipWindowRef.current.close();
      pipWindowRef.current = null;
      setIsPipActive(false);
    }
  };

  // Toggle PiP
  const togglePip = () => {
    if (isPipActive) {
      closePip();
    } else {
      openPip();
    }
  };

  // Listen for messages from PiP window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== pipWindowRef.current) return;

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

  // Update PiP window when track or state changes
  useEffect(() => {
    if (isPipActive && pipWindowRef.current) {
      // Rewrite content with updated state
      pipWindowRef.current.document.open();
      pipWindowRef.current.document.write(createPipContent());
      pipWindowRef.current.document.close();
    }
  }, [track, isPlaying, currentTime, duration, isShuffled, repeatMode, isPipActive]);

  // Setup MediaSession API
  useEffect(() => {
    if ('mediaSession' in navigator) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: track.name,
        artist: track.artist,
        album: track.album || 'Unknown Album',
        artwork: [
          { src: track.imageUrl, sizes: '512x512', type: 'image/jpeg' }
        ]
      });

      navigator.mediaSession.setActionHandler('play', onPlayPause);
      navigator.mediaSession.setActionHandler('pause', onPlayPause);
      navigator.mediaSession.setActionHandler('previoustrack', onPrevious);
      navigator.mediaSession.setActionHandler('nexttrack', onNext);
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
      }
    };
  }, [track, isPlaying, onPlayPause, onNext, onPrevious]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (pipWindowRef.current) {
        pipWindowRef.current.close();
      }
    };
  }, []);

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
