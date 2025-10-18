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
  const isManualControlRef = useRef(false);

  // Check support
  useEffect(() => {
    const isSupported = 'documentPictureInPicture' in window;
    setIsPipSupported(isSupported);
    
    if (!isSupported) {
      console.log('⚠️ Document Picture-in-Picture not supported. Requires Chrome 116+');
    } else {
      console.log('✅ Picture-in-Picture supported');
    }
  }, []);

  // Format time
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Create HTML content
  const getHTML = useCallback(() => {
    const progressPercent = ((currentTime / duration) * 100) || 0;
    
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><style>
*{margin:0;padding:0;box-sizing:border-box;user-select:none}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;overflow:hidden;width:100vw;height:100vh;position:relative;background:#000}
.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.4)blur(20px);transform:scale(1.1)}
.overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.3)0%,rgba(0,0,0,0.5)60%,rgba(0,0,0,0.8)100%)}
.container{position:relative;width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;z-index:1;padding:20px;padding-bottom:15px}
.info{margin-bottom:12px}
.title{font-size:16px;font-weight:700;color:#fff;margin-bottom:4px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.artist{font-size:13px;color:rgba(255,255,255,0.7);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.progress{margin-bottom:12px;cursor:pointer;padding:4px 0}
.bar{width:100%;height:4px;background:rgba(255,255,255,0.3);border-radius:2px;position:relative;transition:height 0.2s}
.container:hover .bar{height:6px}
.fill{position:absolute;left:0;top:0;height:100%;background:#1DB954;border-radius:2px;width:${progressPercent}%;transition:width 0.1s linear}
.thumb{position:absolute;right:-6px;top:50%;transform:translateY(-50%);width:12px;height:12px;background:#fff;border-radius:50%;opacity:0;transition:opacity 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.3)}
.container:hover .thumb{opacity:1}
.time{display:flex;justify-content:space-between;font-size:11px;color:rgba(255,255,255,0.7);margin-top:6px;opacity:0;transition:opacity 0.2s;font-family:monospace}
.container:hover .time{opacity:1}
.controls{display:flex;align-items:center;justify-content:space-between;gap:12px}
.left,.right{display:flex;align-items:center;gap:10px;flex:1}
.center{display:flex;align-items:center;gap:14px}
.right{justify-content:flex-end}
.btn{background:none;border:none;color:rgba(255,255,255,0.7);cursor:pointer;padding:6px;transition:all 0.2s;display:flex;align-items:center;justify-content:center;border-radius:50%}
.btn:hover{color:#fff;background:rgba(255,255,255,0.1);transform:scale(1.05)}
.btn.active{color:#1DB954}
.btn svg{width:18px;height:18px}
.play{width:38px;height:38px;background:#fff;color:#000;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,0.3)}
.play:hover{transform:scale(1.08);background:#fff;color:#000}
.play svg{width:18px;height:18px}
.vol{display:flex;align-items:center;gap:8px;opacity:0;transition:opacity 0.2s;pointer-events:none}
.container:hover .vol{opacity:1;pointer-events:auto}
.slider{width:70px;height:4px;background:rgba(255,255,255,0.3);border-radius:2px;position:relative;cursor:pointer}
.vfill{position:absolute;left:0;top:0;height:100%;background:#fff;border-radius:2px;width:${volume}%}
</style></head><body>
<img src="${track.imageUrl}" class="bg" onerror="this.style.display='none'">
<div class="overlay"></div>
<div class="container" id="c">
<div class="info">
<div class="title">${track.name}</div>
<div class="artist">${track.artist}</div>
</div>
<div class="progress" id="pb">
<div class="bar"><div class="fill"><div class="thumb"></div></div></div>
<div class="time"><span>${formatTime(currentTime)}</span><span>${formatTime(duration)}</span></div>
</div>
<div class="controls">
<div class="left">
<button class="btn ${isShuffled?'active':''}" id="sh" title="Shuffle">
<svg viewBox="0 0 16 16"><path fill="currentColor" d="M13.151.922a.75.75 0 10-1.06 1.06L13.109 3H11.16a3.75 3.75 0 00-2.873 1.34l-6.173 7.356A2.25 2.25 0 01.39 12.5H0V14h.391a3.75 3.75 0 002.873-1.34l6.173-7.356a2.25 2.25 0 011.724-.804h1.947l-1.017 1.018a.75.75 0 001.06 1.06L15.98 3.75 13.15.922zM.391 3.5H0V2h.391c1.109 0 2.16.49 2.873 1.34L4.89 5.277l-.979 1.167-1.796-2.14A2.25 2.25 0 00.39 3.5z"/><path fill="currentColor" d="M7.5 10.723l.98-1.167.957 1.14a2.25 2.25 0 001.724.804h1.947l-1.017-1.018a.75.75 0 111.06-1.06l2.829 2.828-2.829 2.828a.75.75 0 11-1.06-1.06L13.109 13H11.16a3.75 3.75 0 01-2.873-1.34l-.787-.938z"/></svg>
</button>
<button class="btn ${repeatMode!=='off'?'active':''}" id="rp" title="Repeat">
<svg viewBox="0 0 16 16"><path fill="currentColor" d="M0 4.75A3.75 3.75 0 013.75 1h8.5A3.75 3.75 0 0116 4.75v5a3.75 3.75 0 01-3.75 3.75H9.81l1.018 1.018a.75.75 0 11-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 111.06 1.06L9.811 12h2.439a2.25 2.25 0 002.25-2.25v-5a2.25 2.25 0 00-2.25-2.25h-8.5a2.25 2.25 0 00-2.25 2.25v5A2.25 2.25 0 003.75 12H5v1.5H3.75A3.75 3.75 0 010 9.75v-5z"/>${repeatMode==='one'?'<path fill="currentColor" d="M7 8V5h1.5v5H7V8z"/>':''}</svg>
</button>
</div>
<div class="center">
<button class="btn" id="pr" title="Previous">
<svg viewBox="0 0 16 16"><path fill="currentColor" d="M3.3 1a.7.7 0 01.7.7v5.15l9.95-5.744a.7.7 0 011.05.606v12.575a.7.7 0 01-1.05.607L4 9.149V14.3a.7.7 0 01-.7.7H1.7a.7.7 0 01-.7-.7V1.7a.7.7 0 01.7-.7h1.6z"/></svg>
</button>
<button class="play" id="pp" title="${isPlaying?'Pause':'Play'}">
${isPlaying?'<svg viewBox="0 0 16 16"><path fill="currentColor" d="M2.7 1a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7H2.7zm8 0a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7h-2.6z"/></svg>':'<svg viewBox="0 0 16 16"><path fill="currentColor" d="M3 1.713a.7.7 0 011.05-.607l10.89 6.288a.7.7 0 010 1.212L4.05 14.894A.7.7 0 013 14.288V1.713z"/></svg>'}
</button>
<button class="btn" id="nx" title="Next">
<svg viewBox="0 0 16 16"><path fill="currentColor" d="M12.7 1a.7.7 0 00-.7.7v5.15L2.05 1.107A.7.7 0 001 1.712v12.575a.7.7 0 001.05.607L12 9.149V14.3a.7.7 0 00.7.7h1.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7h-1.6z"/></svg>
</button>
</div>
<div class="right">
<div class="vol">
<button class="btn" id="vm" title="Volume">
<svg viewBox="0 0 16 16"><path fill="currentColor" d="${volume>50?'M9.741.85a.75.75 0 01.375.65v13a.75.75 0 01-1.125.65l-6.925-4a3.642 3.642 0 01-1.33-4.967 3.639 3.639 0 011.33-1.332l6.925-4a.75.75 0 01.75 0zm-6.924 5.3a2.139 2.139 0 000 3.7l5.8 3.35V2.8l-5.8 3.35zm8.683 4.29V5.56a2.75 2.75 0 010 4.88z'+(volume>50?' M11.5 13.614a5.752 5.752 0 000-11.228v1.55a4.252 4.252 0 010 8.127v1.55z':''):volume>0?'M9.741.85a.75.75 0 01.375.65v13a.75.75 0 01-1.125.65l-6.925-4a3.642 3.642 0 01-1.33-4.967 3.639 3.639 0 011.33-1.332l6.925-4a.75.75 0 01.75 0zm-6.924 5.3a2.139 2.139 0 000 3.7l5.8 3.35V2.8l-5.8 3.35zm8.683 4.29V5.56a2.75 2.75 0 010 4.88z':'M13.86 5.47a.75.75 0 00-1.061 0l-1.47 1.47-1.47-1.47A.75.75 0 008.8 6.53L10.269 8l-1.47 1.47a.75.75 0 101.06 1.06l1.47-1.47 1.47 1.47a.75.75 0 001.06-1.06L12.39 8l1.47-1.47a.75.75 0 000-1.06z M10.116 1.5A.75.75 0 008.991.85l-6.925 4a3.642 3.642 0 00-1.33 4.967 3.639 3.639 0 001.33 1.332l6.925 4a.75.75 0 001.125-.649v-1.906a4.73 4.73 0 01-1.5-.694v1.3L2.817 9.852a2.141 2.141 0 01-.781-2.92c.187-.324.456-.594.78-.782l5.8-3.35v1.3c.45-.313.956-.55 1.5-.694V1.5z'}"/></svg>
</button>
<div class="slider" id="vs"><div class="vfill"></div></div>
</div>
</div>
</div>
</div>
<script>
function msg(a,v){window.opener&&window.opener.postMessage({action:a,value:v},'*')}
document.getElementById('pp').onclick=()=>msg('playPause');
document.getElementById('nx').onclick=()=>msg('next');
document.getElementById('pr').onclick=()=>msg('previous');
document.getElementById('pb').onclick=(e)=>{const r=e.currentTarget.querySelector('.bar').getBoundingClientRect();const x=e.clientX-r.left;const p=Math.max(0,Math.min(1,x/r.width));msg('seek',p*${duration})};
document.getElementById('vs').onclick=(e)=>{const r=e.currentTarget.getBoundingClientRect();const x=e.clientX-r.left;const p=Math.max(0,Math.min(100,(x/r.width)*100));msg('volume',p)};
document.getElementById('vm').onclick=()=>msg('volume',${volume>0?0:100});
</script>
</body></html>`;
  }, [track, isPlaying, currentTime, duration, volume, isShuffled, repeatMode]);

  // Open PiP
  const openPip = useCallback(async () => {
    if (isPipActive || !isPipSupported) return;

    try {
      // @ts-ignore
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 400,
        height: 280,
      });

      pipWindowRef.current = pipWindow;
      pipWindow.document.write(getHTML());
      pipWindow.document.close();

      pipWindow.addEventListener('pagehide', () => {
        setIsPipActive(false);
        pipWindowRef.current = null;
      });

      setIsPipActive(true);
      console.log('✅ PiP opened');
    } catch (err) {
      console.error('PiP error:', err);
      if (!isManualControlRef.current) {
        // Only show toast for manual attempts
      }
    }
  }, [isPipActive, isPipSupported, getHTML]);

  // Close PiP
  const closePip = useCallback(() => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
    }
    pipWindowRef.current = null;
    setIsPipActive(false);
  }, []);

  // Toggle (manual)
  const togglePip = () => {
    isManualControlRef.current = true;
    if (isPipActive) {
      closePip();
      toast.info('Picture-in-Picture closed');
    } else {
      openPip();
      toast.success('Picture-in-Picture activated! 🎵');
    }
    // Reset after 5 seconds to allow auto control again
    setTimeout(() => {
      isManualControlRef.current = false;
    }, 5000);
  };

  // Auto open/close with visibility API (more reliable than blur/focus)
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const handleVisibilityChange = () => {
      clearTimeout(timeout);
      
      if (document.hidden) {
        // Tab is hidden (switched away)
        if (!isManualControlRef.current && isPlaying && !isPipActive) {
          timeout = setTimeout(() => {
            console.log('🎵 Tab hidden - Auto-opening PiP');
            openPip();
          }, 500);
        }
      } else {
        // Tab is visible (switched back)
        if (!isManualControlRef.current && isPipActive) {
          timeout = setTimeout(() => {
            console.log('👁️ Tab visible - Auto-closing PiP');
            closePip();
          }, 500);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(timeout);
    };
  }, [isPlaying, isPipActive, openPip, closePip]);

  // Handle messages
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (!pipWindowRef.current || e.source !== pipWindowRef.current) return;

      const { action, value } = e.data;
      
      switch (action) {
        case 'playPause': onPlayPause(); break;
        case 'next': onNext(); break;
        case 'previous': onPrevious(); break;
        case 'seek': onSeek?.(value); break;
        case 'volume': onVolumeChange?.(value); break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onPlayPause, onNext, onPrevious, onSeek, onVolumeChange]);

  // Update content when state changes
  useEffect(() => {
    if (!isPipActive || !pipWindowRef.current || pipWindowRef.current.closed) return;

    try {
      pipWindowRef.current.document.open();
      pipWindowRef.current.document.write(getHTML());
      pipWindowRef.current.document.close();
    } catch (err) {
      console.error('Update failed:', err);
      setIsPipActive(false);
      pipWindowRef.current = null;
    }
  }, [isPipActive, track.id, isPlaying, Math.floor(currentTime), volume, isShuffled, repeatMode, getHTML]);

  // MediaSession
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
    return () => closePip();
  }, [closePip]);

  if (!isPipSupported) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          toast.error('Picture-in-Picture not supported', {
            description: 'Requires Chrome 116+ or Edge 116+',
          });
        }}
        className="hover:bg-primary/20 opacity-50"
        title="Picture-in-Picture (Not Supported)"
      >
        <PictureInPicture2 className="w-4 h-4" />
      </Button>
    );
  }

  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={togglePip}
      className={`hover:bg-primary/20 ${isPipActive ? 'text-primary' : ''}`}
      title={isPipActive ? 'Close Picture-in-Picture (Auto-managed)' : 'Open Picture-in-Picture'}
    >
      <PictureInPicture2 className={`w-4 h-4 ${isPipActive ? 'animate-pulse' : ''}`} />
    </Button>
  );
};
