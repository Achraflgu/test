import { useEffect, useState, useRef } from 'react';
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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPipActive, setIsPipActive] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const animationFrameRef = useRef<number>();
  const imageRef = useRef<HTMLImageElement | null>(null);

  // Check PiP support
  useEffect(() => {
    setIsPipSupported('pictureInPictureEnabled' in document);
  }, []);

  // Format time helper
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Preload album art
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = track.imageUrl;
    img.onload = () => {
      imageRef.current = img;
    };
    img.onerror = () => {
      imageRef.current = null;
    };
  }, [track.imageUrl]);

  // Draw Spotify-style player on canvas
  const drawPlayer = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Set canvas size (16:9 ratio)
    const width = 640;
    const height = 360;
    canvas.width = width;
    canvas.height = height;

    // Background - Dark gradient like Spotify
    ctx.fillStyle = '#121212';
    ctx.fillRect(0, 0, width, height);

    // Add subtle gradient
    const bgGradient = ctx.createRadialGradient(width / 2, height / 2, 0, width / 2, height / 2, width / 2);
    bgGradient.addColorStop(0, 'rgba(29, 185, 84, 0.1)');
    bgGradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Album art area - centered and larger
    const artSize = 200;
    const artX = (width - artSize) / 2;
    const artY = 40;

    // Shadow for album art
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 10;

    // Draw album art with rounded corners
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(artX, artY, artSize, artSize, 16);
    ctx.clip();
    
    if (imageRef.current) {
      ctx.drawImage(imageRef.current, artX, artY, artSize, artSize);
    } else {
      // Placeholder
      ctx.fillStyle = '#282828';
      ctx.fillRect(artX, artY, artSize, artSize);
      ctx.fillStyle = '#b3b3b3';
      ctx.font = '60px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('♪', artX + artSize / 2, artY + artSize / 2);
    }
    ctx.restore();

    // Reset shadow
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;

    // Spotify green border if playing
    if (isPlaying) {
      ctx.strokeStyle = '#1DB954';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.roundRect(artX, artY, artSize, artSize, 16);
      ctx.stroke();

      // Playing animation - pulsing dots
      const dotY = artY + artSize + 20;
      const dotSize = 4;
      const dotSpacing = 8;
      const centerX = width / 2;
      
      ctx.fillStyle = '#1DB954';
      for (let i = 0; i < 3; i++) {
        const x = centerX - dotSpacing + (i * dotSpacing);
        const pulse = Math.abs(Math.sin((Date.now() / 300) + i)) * 0.5 + 0.5;
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.arc(x, dotY, dotSize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Track info - centered below album art
    const infoY = artY + artSize + 45;

    // Track name
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    let trackName = track.name;
    let metrics = ctx.measureText(trackName);
    const maxWidth = width - 80;
    if (metrics.width > maxWidth) {
      while (metrics.width > maxWidth && trackName.length > 0) {
        trackName = trackName.slice(0, -1);
        metrics = ctx.measureText(trackName + '...');
      }
      trackName += '...';
    }
    ctx.fillText(trackName, width / 2, infoY);

    // Artist name
    ctx.fillStyle = '#b3b3b3';
    ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    
    let artistName = track.artist;
    metrics = ctx.measureText(artistName);
    if (metrics.width > maxWidth) {
      while (metrics.width > maxWidth && artistName.length > 0) {
        artistName = artistName.slice(0, -1);
        metrics = ctx.measureText(artistName + '...');
      }
      artistName += '...';
    }
    ctx.fillText(artistName, width / 2, infoY + 32);

    // Progress bar
    const progressY = height - 80;
    const progressHeight = 5;
    const progressWidth = width - 80;
    const progressX = 40;

    // Background
    ctx.fillStyle = '#4d4d4d';
    ctx.beginPath();
    ctx.roundRect(progressX, progressY, progressWidth, progressHeight, 2.5);
    ctx.fill();

    // Progress
    const progress = (currentTime / duration) || 0;
    ctx.fillStyle = '#1DB954';
    ctx.beginPath();
    ctx.roundRect(progressX, progressY, progressWidth * progress, progressHeight, 2.5);
    ctx.fill();

    // Thumb
    if (progress > 0) {
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(progressX + progressWidth * progress, progressY + progressHeight / 2, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Time labels
    ctx.fillStyle = '#b3b3b3';
    ctx.font = '14px "SF Mono", Monaco, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(formatTime(currentTime), progressX, progressY + 18);
    
    const durationText = formatTime(duration);
    ctx.textAlign = 'right';
    ctx.fillText(durationText, progressX + progressWidth, progressY + 18);

    // Control icons at the bottom
    const controlY = height - 35;
    const iconSize = 20;
    
    // Helper function to draw centered text
    const drawIcon = (text: string, x: number, color: string, size: number = 22) => {
      ctx.fillStyle = color;
      ctx.font = `${size}px Arial`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(text, x, controlY);
    };

    // Shuffle
    drawIcon('⤮', width / 2 - 120, isShuffled ? '#1DB954' : '#7f7f7f', 20);

    // Previous
    drawIcon('⏮', width / 2 - 60, '#ffffff', 26);

    // Play/Pause (center - larger with circle)
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(width / 2, controlY, 22, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.fillStyle = '#000000';
    drawIcon(isPlaying ? '⏸' : '▶', width / 2, '#000000', 22);

    // Next
    drawIcon('⏭', width / 2 + 60, '#ffffff', 26);

    // Repeat
    const repeatIcon = repeatMode === 'one' ? '🔂' : '🔁';
    drawIcon(repeatIcon, width / 2 + 120, repeatMode !== 'off' ? '#1DB954' : '#7f7f7f', 20);

    // Branding
    ctx.fillStyle = '#1DB954';
    ctx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'bottom';
    ctx.fillText('♫ TrackMiner', 15, height - 10);
  };

  // Animation loop
  const animate = () => {
    drawPlayer();
    animationFrameRef.current = requestAnimationFrame(animate);
  };

  // Toggle PiP
  const togglePip = async () => {
    if (!videoRef.current) return;

    // Check if video is ready
    if (!isVideoReady) {
      toast.info('Please wait...', {
        description: 'Video player is initializing',
      });
      return;
    }

    try {
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
      } else {
        await videoRef.current.requestPictureInPicture();
        toast.success('Picture-in-Picture activated! 🎵', {
          description: 'Player will stay on top of all windows',
        });
      }
    } catch (err: any) {
      console.error('PiP error:', err);
      toast.error('Failed to activate Picture-in-Picture', {
        description: 'Make sure your browser supports this feature',
      });
    }
  };

  // Handle video ready state
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleLoadedMetadata = () => {
      console.log('✅ Video metadata loaded - PiP ready');
      setIsVideoReady(true);
    };

    const handleCanPlay = () => {
      console.log('✅ Video can play - PiP ready');
      setIsVideoReady(true);
    };

    // Check if already loaded
    if (video.readyState >= 2) {
      setIsVideoReady(true);
    }

    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
    };
  }, []);

  // Handle PiP events
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleEnterPip = () => {
      setIsPipActive(true);
      animate();
    };

    const handleLeavePip = () => {
      setIsPipActive(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };

    video.addEventListener('enterpictureinpicture', handleEnterPip);
    video.addEventListener('leavepictureinpicture', handleLeavePip);

    return () => {
      video.removeEventListener('enterpictureinpicture', handleEnterPip);
      video.removeEventListener('leavepictureinpicture', handleLeavePip);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, []);

  // Update canvas when playing
  useEffect(() => {
    if (isPipActive) {
      drawPlayer();
    }
  }, [track, isPlaying, currentTime, duration, isShuffled, repeatMode, isPipActive]);

  // Setup MediaSession API for native controls
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

      // Update playback state
      navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
    }

    return () => {
      if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = null;
      }
    };
  }, [track, isPlaying, onPlayPause, onNext, onPrevious]);

  // Setup canvas stream to video
  useEffect(() => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (!canvas || !video) return;

    // Initial draw
    drawPlayer();

    // Create a stream from canvas
    const stream = canvas.captureStream(30); // 30 FPS
    video.srcObject = stream;
    video.muted = true;
    video.loop = true;
    
    // Ensure video loads and plays
    video.load();
    video.play()
      .then(() => {
        console.log('✅ Video playing - PiP ready');
        setIsVideoReady(true);
      })
      .catch(err => {
        console.error('Video play error:', err);
        // Try again after a delay
        setTimeout(() => {
          video.play()
            .then(() => setIsVideoReady(true))
            .catch(e => console.error('Retry failed:', e));
        }, 500);
      });
  }, []);

  if (!isPipSupported) {
    return null;
  }

  return (
    <>
      {/* Hidden canvas and video */}
      <div style={{ position: 'fixed', top: '-9999px', left: '-9999px', pointerEvents: 'none' }}>
        <canvas ref={canvasRef} />
        <video
          ref={videoRef}
          muted
          playsInline
          loop
          style={{
            width: '640px',
            height: '360px',
          }}
        />
      </div>

      {/* PiP Toggle Button */}
      <Button
        size="sm"
        variant="ghost"
        onClick={togglePip}
        disabled={!isVideoReady}
        className={`hover:bg-primary/20 ${isPipActive ? 'text-primary' : ''} ${!isVideoReady ? 'opacity-50 cursor-not-allowed' : ''}`}
        title={
          !isVideoReady 
            ? 'Initializing player...' 
            : isPipActive 
              ? 'Exit Picture-in-Picture' 
              : 'Enter Picture-in-Picture'
        }
      >
        <PictureInPicture2 className={`w-4 h-4 ${isPipActive ? 'animate-pulse' : ''} ${!isVideoReady ? 'animate-spin' : ''}`} />
      </Button>
    </>
  );
};
