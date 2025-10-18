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
  volume: number;
  isShuffled: boolean;
  repeatMode: 'off' | 'all' | 'one';
  onPlayPause: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onSeek?: (time: number) => void;
  onVolumeChange?: (volume: number) => void;
}

export const PictureInPicturePlayer = ({
  track,
  isPlaying,
  currentTime,
  duration,
  volume,
  isShuffled,
  repeatMode,
  onPlayPause,
  onNext,
  onPrevious,
  onSeek,
  onVolumeChange,
}: PictureInPicturePlayerProps) => {
  const [isPipActive, setIsPipActive] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(false);
  const pipWindowRef = useRef<Window | null>(null);
  const updateTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isManualControlRef = useRef(false);
  const blurTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const focusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

  // Create Spotify-style PiP content with responsive design
  const createPipContent = useCallback(() => {
    const progressPercent = ((currentTime / duration) * 100) || 0;
    
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
              user-select: none;
            }
            
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              overflow: hidden;
              width: 100vw;
              height: 100vh;
              position: relative;
              cursor: default;
            }
            
            /* Album art background */
            .bg-image {
              position: absolute;
              inset: 0;
              width: 100%;
              height: 100%;
              object-fit: cover;
              filter: brightness(0.4) blur(20px);
              transform: scale(1.1);
            }
            
            /* Gradient overlay */
            .overlay {
              position: absolute;
              inset: 0;
              background: linear-gradient(
                to bottom,
                rgba(0,0,0,0.3) 0%,
                rgba(0,0,0,0.5) 60%,
                rgba(0,0,0,0.8) 100%
              );
            }
            
            /* Main container */
            .container {
              position: relative;
              width: 100%;
              height: 100%;
              display: flex;
              flex-direction: column;
              justify-content: flex-end;
              z-index: 1;
            }
            
            /* Content area - always visible */
            .content {
              padding: max(12px, 3vw);
              padding-bottom: max(8px, 2vw);
            }
            
            /* Track info */
            .info {
              margin-bottom: max(8px, 2vh);
              opacity: 0.95;
            }
            
            .title {
              font-size: clamp(14px, 4vw, 18px);
              font-weight: 700;
              color: #fff;
              margin-bottom: 4px;
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            
            .artist {
              font-size: clamp(12px, 3vw, 14px);
              color: rgba(255,255,255,0.7);
              overflow: hidden;
              text-overflow: ellipsis;
              white-space: nowrap;
            }
            
            /* Progress bar */
            .progress-container {
              margin-bottom: max(8px, 2vh);
              cursor: pointer;
              padding: 4px 0;
            }
            
            .progress-bar {
              width: 100%;
              height: 4px;
              background: rgba(255,255,255,0.3);
              border-radius: 2px;
              position: relative;
              overflow: visible;
              transition: height 0.2s;
            }
            
            .container:hover .progress-bar {
              height: 6px;
            }
            
            .progress-fill {
              position: absolute;
              left: 0;
              top: 0;
              height: 100%;
              background: #1DB954;
              border-radius: 2px;
              width: ${progressPercent}%;
              transition: width 0.1s linear;
            }
            
            .progress-thumb {
              position: absolute;
              right: -6px;
              top: 50%;
              transform: translateY(-50%);
              width: 12px;
              height: 12px;
              background: #fff;
              border-radius: 50%;
              opacity: 0;
              transition: opacity 0.2s;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            }
            
            .container:hover .progress-thumb {
              opacity: 1;
            }
            
            /* Time display - shown on hover */
            .time-display {
              display: flex;
              justify-content: space-between;
              font-size: clamp(10px, 2.5vw, 12px);
              color: rgba(255,255,255,0.7);
              margin-top: 6px;
              opacity: 0;
              transition: opacity 0.2s;
            }
            
            .container:hover .time-display {
              opacity: 1;
            }
            
            /* Controls */
            .controls {
              display: flex;
              align-items: center;
              justify-content: space-between;
              gap: max(8px, 2vw);
            }
            
            /* Left controls */
            .controls-left {
              display: flex;
              align-items: center;
              gap: clamp(8px, 2vw, 12px);
              flex: 1;
            }
            
            /* Center controls */
            .controls-center {
              display: flex;
              align-items: center;
              gap: clamp(12px, 3vw, 16px);
            }
            
            /* Right controls */
            .controls-right {
              display: flex;
              align-items: center;
              gap: clamp(8px, 2vw, 12px);
              flex: 1;
              justify-content: flex-end;
            }
            
            /* Button base styles */
            .btn {
              background: none;
              border: none;
              color: rgba(255,255,255,0.7);
              cursor: pointer;
              padding: clamp(4px, 1vw, 6px);
              transition: all 0.2s;
              display: flex;
              align-items: center;
              justify-content: center;
              border-radius: 50%;
            }
            
            .btn:hover {
              color: #fff;
              background: rgba(255,255,255,0.1);
              transform: scale(1.05);
            }
            
            .btn.active {
              color: #1DB954;
            }
            
            .btn svg {
              width: clamp(16px, 4vw, 20px);
              height: clamp(16px, 4vw, 20px);
            }
            
            /* Play button */
            .play-btn {
              width: clamp(32px, 8vw, 40px);
              height: clamp(32px, 8vw, 40px);
              background: #fff;
              color: #000;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            
            .play-btn:hover {
              transform: scale(1.08);
              background: #fff;
              color: #000;
            }
            
            .play-btn svg {
              width: clamp(16px, 4vw, 20px);
              height: clamp(16px, 4vw, 20px);
            }
            
            /* Volume control - shown on hover */
            .volume-container {
              display: flex;
              align-items: center;
              gap: 8px;
              opacity: 0;
              transition: opacity 0.2s;
              pointer-events: none;
            }
            
            .container:hover .volume-container {
              opacity: 1;
              pointer-events: auto;
            }
            
            .volume-slider {
              width: clamp(50px, 15vw, 80px);
              height: 4px;
              background: rgba(255,255,255,0.3);
              border-radius: 2px;
              position: relative;
              cursor: pointer;
            }
            
            .volume-fill {
              position: absolute;
              left: 0;
              top: 0;
              height: 100%;
              background: #fff;
              border-radius: 2px;
              width: ${volume}%;
            }
            
            /* Icons */
            .icon {
              width: 100%;
              height: 100%;
            }
            
            /* Responsive breakpoints */
            @media (max-width: 400px) {
              .controls-right .volume-container {
                display: none;
              }
            }
            
            @media (max-height: 300px) {
              .info {
                margin-bottom: 6px;
              }
              .progress-container {
                margin-bottom: 6px;
              }
            }
            
            /* Mini mode for very small sizes */
            @container (max-width: 250px) {
              .controls-left .btn:not(:first-child),
              .controls-right {
                display: none;
              }
            }
          </style>
        </head>
        <body>
          <!-- Background -->
          <img src="${track.imageUrl}" class="bg-image" alt="" onerror="this.style.display='none'">
          <div class="overlay"></div>
          
          <!-- Content -->
          <div class="container">
            <div class="content">
              <!-- Track Info -->
              <div class="info">
                <div class="title">${track.name}</div>
                <div class="artist">${track.artist}</div>
              </div>
              
              <!-- Progress Bar -->
              <div class="progress-container" onclick="handleProgressClick(event)">
                <div class="progress-bar">
                  <div class="progress-fill">
                    <div class="progress-thumb"></div>
                  </div>
                </div>
                <div class="time-display">
                  <span>${formatTime(currentTime)}</span>
                  <span>${formatTime(duration)}</span>
                </div>
              </div>
              
              <!-- Controls -->
              <div class="controls">
                <!-- Left -->
                <div class="controls-left">
                  <button class="btn ${isShuffled ? 'active' : ''}" onclick="sendMessage('shuffle')" title="Shuffle">
                    <svg viewBox="0 0 16 16" class="icon">
                      <path fill="currentColor" d="M13.151.922a.75.75 0 10-1.06 1.06L13.109 3H11.16a3.75 3.75 0 00-2.873 1.34l-6.173 7.356A2.25 2.25 0 01.39 12.5H0V14h.391a3.75 3.75 0 002.873-1.34l6.173-7.356a2.25 2.25 0 011.724-.804h1.947l-1.017 1.018a.75.75 0 001.06 1.06L15.98 3.75 13.15.922zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 00.39 3.5z"/>
                      <path fill="currentColor" d="M7.5 10.723l.98-1.167.957 1.14a2.25 2.25 0 001.724.804h1.947l-1.017-1.018a.75.75 0 111.06-1.06l2.829 2.828-2.829 2.828a.75.75 0 11-1.06-1.06L13.109 13H11.16a3.75 3.75 0 01-2.873-1.34l-.787-.938z"/>
                    </svg>
                  </button>
                  
                  <button class="btn ${repeatMode !== 'off' ? 'active' : ''}" onclick="sendMessage('repeat')" title="Repeat">
                    <svg viewBox="0 0 16 16" class="icon">
                      ${repeatMode === 'one' 
                        ? '<path fill="currentColor" d="M0 4.75A3.75 3.75 0 013.75 1h8.5A3.75 3.75 0 0116 4.75v5a3.75 3.75 0 01-3.75 3.75H9.81l1.018 1.018a.75.75 0 11-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 111.06 1.06L9.811 12h2.439a2.25 2.25 0 002.25-2.25v-5a2.25 2.25 0 00-2.25-2.25h-8.5a2.25 2.25 0 00-2.25 2.25v5A2.25 2.25 0 003.75 12H5v1.5H3.75A3.75 3.75 0 010 9.75v-5z"/><path fill="currentColor" d="M7 8V5h1.5v5H7V8z"/>'
                        : '<path fill="currentColor" d="M0 4.75A3.75 3.75 0 013.75 1h8.5A3.75 3.75 0 0116 4.75v5a3.75 3.75 0 01-3.75 3.75H9.81l1.018 1.018a.75.75 0 11-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 111.06 1.06L9.811 12h2.439a2.25 2.25 0 002.25-2.25v-5a2.25 2.25 0 00-2.25-2.25h-8.5a2.25 2.25 0 00-2.25 2.25v5A2.25 2.25 0 003.75 12H5v1.5H3.75A3.75 3.75 0 010 9.75v-5z"/>'
                      }
                    </svg>
                  </button>
                </div>
                
                <!-- Center -->
                <div class="controls-center">
                  <button class="btn" onclick="sendMessage('previous')" title="Previous">
                    <svg viewBox="0 0 16 16" class="icon">
                      <path fill="currentColor" d="M3.3 1a.7.7 0 01.7.7v5.15l9.95-5.744a.7.7 0 011.05.606v12.575a.7.7 0 01-1.05.607L4 9.149V14.3a.7.7 0 01-.7.7H1.7a.7.7 0 01-.7-.7V1.7a.7.7 0 01.7-.7h1.6z"/>
                    </svg>
                  </button>
                  
                  <button class="play-btn" onclick="sendMessage('playPause')" title="${isPlaying ? 'Pause' : 'Play'}">
                    ${isPlaying 
                      ? '<svg viewBox="0 0 16 16" class="icon"><path fill="currentColor" d="M2.7 1a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7H2.7zm8 0a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7h-2.6z"/></svg>'
                      : '<svg viewBox="0 0 16 16" class="icon"><path fill="currentColor" d="M3 1.713a.7.7 0 011.05-.607l10.89 6.288a.7.7 0 010 1.212L4.05 14.894A.7.7 0 013 14.288V1.713z"/></svg>'
                    }
                  </button>
                  
                  <button class="btn" onclick="sendMessage('next')" title="Next">
                    <svg viewBox="0 0 16 16" class="icon">
                      <path fill="currentColor" d="M12.7 1a.7.7 0 00-.7.7v5.15L2.05 1.107A.7.7 0 001 1.712v12.575a.7.7 0 001.05.607L12 9.149V14.3a.7.7 0 00.7.7h1.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7h-1.6z"/>
                    </svg>
                  </button>
                </div>
                
                <!-- Right -->
                <div class="controls-right">
                  <div class="volume-container">
                    <button class="btn" onclick="sendMessage('toggleMute')" title="Volume">
                      <svg viewBox="0 0 16 16" class="icon">
                        ${volume > 50 
                          ? '<path fill="currentColor" d="M9.741.85a.75.75 0 01.375.65v13a.75.75 0 01-1.125.65l-6.925-4a3.642 3.642 0 01-1.33-4.967 3.639 3.639 0 011.33-1.332l6.925-4a.75.75 0 01.75 0zm-6.924 5.3a2.139 2.139 0 000 3.7l5.8 3.35V2.8l-5.8 3.35zm8.683 4.29V5.56a2.75 2.75 0 010 4.88z"/><path fill="currentColor" d="M11.5 13.614a5.752 5.752 0 000-11.228v1.55a4.252 4.252 0 010 8.127v1.55z"/>'
                          : volume > 0
                          ? '<path fill="currentColor" d="M9.741.85a.75.75 0 01.375.65v13a.75.75 0 01-1.125.65l-6.925-4a3.642 3.642 0 01-1.33-4.967 3.639 3.639 0 011.33-1.332l6.925-4a.75.75 0 01.75 0zm-6.924 5.3a2.139 2.139 0 000 3.7l5.8 3.35V2.8l-5.8 3.35zm8.683 4.29V5.56a2.75 2.75 0 010 4.88z"/>'
                          : '<path fill="currentColor" d="M13.86 5.47a.75.75 0 00-1.061 0l-1.47 1.47-1.47-1.47A.75.75 0 008.8 6.53L10.269 8l-1.47 1.47a.75.75 0 101.06 1.06l1.47-1.47 1.47 1.47a.75.75 0 001.06-1.06L12.39 8l1.47-1.47a.75.75 0 000-1.06z"/><path fill="currentColor" d="M10.116 1.5A.75.75 0 008.991.85l-6.925 4a3.642 3.642 0 00-1.33 4.967 3.639 3.639 0 001.33 1.332l6.925 4a.75.75 0 001.125-.649v-1.906a4.73 4.73 0 01-1.5-.694v1.3L2.817 9.852a2.141 2.141 0 01-.781-2.92c.187-.324.456-.594.78-.782l5.8-3.35v1.3c.45-.313.956-.55 1.5-.694V1.5z"/>'
                        }
                      </svg>
                    </button>
                    <div class="volume-slider" onclick="handleVolumeClick(event)">
                      <div class="volume-fill"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <script>
            function sendMessage(action, value) {
              window.opener.postMessage({ action, value }, '*');
            }
            
            function handleProgressClick(e) {
              const rect = e.currentTarget.querySelector('.progress-bar').getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percent = Math.max(0, Math.min(1, x / rect.width));
              const time = percent * ${duration};
              sendMessage('seek', time);
            }
            
            function handleVolumeClick(e) {
              const rect = e.currentTarget.getBoundingClientRect();
              const x = e.clientX - rect.left;
              const percent = Math.max(0, Math.min(100, (x / rect.width) * 100));
              sendMessage('volume', percent);
            }
          </script>
        </body>
      </html>
    `;
  }, [track, isPlaying, currentTime, duration, volume, isShuffled, repeatMode, formatTime]);

  // Open PiP window
  const openPip = useCallback(async () => {
    if (isPipActive || !isPipSupported) return;

    try {
      // @ts-ignore
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 400,
        height: 300,
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
      console.log('✅ PiP opened');
    } catch (err: any) {
      console.error('PiP error:', err);
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
    console.log('✅ PiP closed');
  }, []);

  // Manual toggle (from button)
  const togglePip = () => {
    if (isPipActive) {
      isManualControlRef.current = true;
      closePip();
      toast.info('Picture-in-Picture closed');
    } else {
      isManualControlRef.current = false;
      openPip();
      toast.success('Picture-in-Picture activated! 🎵');
    }
  };

  // Improved auto open/close with proper timing
  useEffect(() => {
    const handleBlur = () => {
      // Clear any pending focus timeout
      if (focusTimeoutRef.current) {
        clearTimeout(focusTimeoutRef.current);
        focusTimeoutRef.current = null;
      }

      // Only auto-open if:
      // 1. Not manually controlled
      // 2. Music is playing
      // 3. PiP is not already active
      if (!isManualControlRef.current && isPlaying && !isPipActive) {
        // Add small delay to prevent opening during quick tab switches
        blurTimeoutRef.current = setTimeout(() => {
          console.log('🎵 Tab switched away - Opening PiP');
          openPip();
        }, 300);
      }
    };

    const handleFocus = () => {
      // Clear any pending blur timeout
      if (blurTimeoutRef.current) {
        clearTimeout(blurTimeoutRef.current);
        blurTimeoutRef.current = null;
      }

      // Only auto-close if:
      // 1. Not manually controlled
      // 2. PiP is active
      if (!isManualControlRef.current && isPipActive) {
        // Add small delay to prevent closing during quick focus changes
        focusTimeoutRef.current = setTimeout(() => {
          console.log('👁️ Tab focused - Closing PiP');
          closePip();
        }, 300);
      }
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
    };
  }, [isPlaying, isPipActive, openPip, closePip]);

  // Listen for messages from PiP window
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (!pipWindowRef.current || event.source !== pipWindowRef.current) return;

      const { action, value } = event.data;
      
      switch (action) {
        case 'playPause':
          onPlayPause();
          break;
        case 'next':
          onNext();
          break;
        case 'previous':
          onPrevious();
          break;
        case 'seek':
          if (onSeek && typeof value === 'number') {
            onSeek(value);
          }
          break;
        case 'volume':
          if (onVolumeChange && typeof value === 'number') {
            onVolumeChange(value);
          }
          break;
        case 'shuffle':
          // Could add shuffle toggle if needed
          break;
        case 'repeat':
          // Could add repeat toggle if needed
          break;
        case 'toggleMute':
          if (onVolumeChange) {
            onVolumeChange(volume > 0 ? 0 : 100);
          }
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onPlayPause, onNext, onPrevious, onSeek, onVolumeChange, volume]);

  // Optimized update with debouncing
  useEffect(() => {
    if (!isPipActive || !pipWindowRef.current || pipWindowRef.current.closed) return;

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
    }, 100);

    return () => {
      if (updateTimeoutRef.current) {
        clearTimeout(updateTimeoutRef.current);
      }
    };
  }, [track.id, isPlaying, Math.floor(currentTime), volume, isShuffled, repeatMode, isPipActive, createPipContent]);

  // Setup MediaSession API
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

  // Cleanup
  useEffect(() => {
    return () => {
      closePip();
      if (blurTimeoutRef.current) clearTimeout(blurTimeoutRef.current);
      if (focusTimeoutRef.current) clearTimeout(focusTimeoutRef.current);
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
