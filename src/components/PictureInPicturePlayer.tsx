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
  const lastTrackIdRef = useRef<string>('');
  const hasActivationRef = useRef<boolean>(true); // Track if we have user activation

  // Check support
  useEffect(() => {
    const isSupported = 'documentPictureInPicture' in window;
    setIsPipSupported(isSupported);
    
    if (isSupported) {
      console.log('✅ PiP supported');
    } else {
      console.log('❌ PiP not supported');
    }
  }, []);

  // Format time
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get volume icon SVG
  const getVolumeIcon = (vol: number) => {
    if (vol > 50) {
      return '<path fill="currentColor" d="M9.741.85a.75.75 0 01.375.65v13a.75.75 0 01-1.125.65l-6.925-4a3.642 3.642 0 01-1.33-4.967 3.639 3.639 0 011.33-1.332l6.925-4a.75.75 0 01.75 0zm-6.924 5.3a2.139 2.139 0 000 3.7l5.8 3.35V2.8l-5.8 3.35zm8.683 4.29V5.56a2.75 2.75 0 010 4.88z"/><path fill="currentColor" d="M11.5 13.614a5.752 5.752 0 000-11.228v1.55a4.252 4.252 0 010 8.127v1.55z"/>';
    } else if (vol > 0) {
      return '<path fill="currentColor" d="M9.741.85a.75.75 0 01.375.65v13a.75.75 0 01-1.125.65l-6.925-4a3.642 3.642 0 01-1.33-4.967 3.639 3.639 0 011.33-1.332l6.925-4a.75.75 0 01.75 0zm-6.924 5.3a2.139 2.139 0 000 3.7l5.8 3.35V2.8l-5.8 3.35zm8.683 4.29V5.56a2.75 2.75 0 010 4.88z"/>';
    } else {
      return '<path fill="currentColor" d="M13.86 5.47a.75.75 0 00-1.061 0l-1.47 1.47-1.47-1.47A.75.75 0 008.8 6.53L10.269 8l-1.47 1.47a.75.75 0 101.06 1.06l1.47-1.47 1.47 1.47a.75.75 0 001.06-1.06L12.39 8l1.47-1.47a.75.75 0 000-1.06z"/><path fill="currentColor" d="M10.116 1.5A.75.75 0 008.991.85l-6.925 4a3.642 3.642 0 00-1.33 4.967 3.639 3.639 0 001.33 1.332l6.925 4a.75.75 0 001.125-.649v-1.906a4.73 4.73 0 01-1.5-.694v1.3L2.817 9.852a2.141 2.141 0 01-.781-2.92c.187-.324.456-.594.78-.782l5.8-3.35v1.3c.45-.313.956-.55 1.5-.694V1.5z"/>';
    }
  };

  // Create HTML with draggable sliders
  const createHTML = () => {
    const progressPercent = ((currentTime / duration) * 100) || 0;
    
    return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>
*{margin:0;padding:0;box-sizing:border-box;user-select:none}
body{font-family:-apple-system,sans-serif;overflow:hidden;width:100vw;height:100vh;background:#121212;position:relative}
.bg{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;filter:brightness(0.8)blur(4px);transform:scale(1.02)}
.overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(0,0,0,0.3),rgba(0,0,0,0.8))}
.container{position:relative;width:100%;height:100%;display:flex;flex-direction:column;justify-content:flex-end;z-index:1;padding:clamp(10px,4vw,20px) clamp(10px,4vw,20px) clamp(8px,3vw,15px)}
.info{margin-bottom:clamp(6px,2.5vh,12px)}
.title{font-size:clamp(12px,4vw,16px);font-weight:700;color:#fff;margin-bottom:clamp(2px,1vh,4px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.artist{font-size:clamp(10px,3vw,13px);color:rgba(255,255,255,0.7);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.progress{margin-bottom:clamp(6px,2vh,12px);cursor:pointer;padding:4px 0}
.bar{width:100%;height:clamp(3px,1vw,4px);background:rgba(255,255,255,0.3);border-radius:2px;position:relative;transition:height 0.2s;cursor:pointer}
.container:hover .bar{height:clamp(4px,1.2vw,6px)}
.fill{position:absolute;left:0;top:0;height:100%;background:#1DB954;border-radius:2px;width:${progressPercent}%;pointer-events:none;transition:width 0.1s linear}
.thumb{position:absolute;right:-6px;top:50%;transform:translateY(-50%);width:clamp(8px,2.5vw,12px);height:clamp(8px,2.5vw,12px);background:#fff;border-radius:50%;opacity:0;transition:opacity 0.2s;box-shadow:0 2px 8px rgba(0,0,0,0.3);pointer-events:none}
.container:hover .thumb{opacity:1}
.time{display:flex;justify-content:space-between;font-size:clamp(9px,2vw,11px);color:rgba(255,255,255,0.9);margin-top:clamp(3px,1vh,6px);font-family:monospace;opacity:1;pointer-events:none}
.controls{display:flex;align-items:center;justify-content:space-between;gap:clamp(6px,2vw,12px)}
.left,.right{display:flex;align-items:center;gap:clamp(4px,1.5vw,10px);flex:1}
.center{display:flex;align-items:center;gap:clamp(6px,2vw,14px)}
.right{justify-content:flex-end}
.btn{background:none;border:none;color:rgba(255,255,255,0.7);cursor:pointer;padding:clamp(4px,1vw,6px);transition:all 0.2s;display:flex;border-radius:50%;width:clamp(24px,6vw,32px);height:clamp(24px,6vw,32px);align-items:center;justify-content:center}
.btn:hover{color:#fff;background:rgba(255,255,255,0.1);transform:scale(1.05);cursor:pointer}
.btn.active{color:#1DB954}
.btn svg{width:clamp(12px,3vw,18px);height:clamp(12px,3vw,18px)}
.play{width:clamp(32px,8vw,38px);height:clamp(32px,8vw,38px);background:#fff;color:#000;border-radius:50%;box-shadow:0 4px 12px rgba(0,0,0,0.3);cursor:pointer;display:flex;align-items:center;justify-content:center;padding:0;border:none}
.play:hover{transform:scale(1.08);cursor:pointer}
.play svg{width:clamp(14px,3.5vw,18px);height:clamp(14px,3.5vw,18px)}
.vol{display:flex;align-items:center;gap:clamp(4px,1.5vw,8px);opacity:1;pointer-events:auto}
.slider{width:clamp(40px,15vw,70px);height:clamp(3px,1vw,4px);background:rgba(255,255,255,0.3);border-radius:2px;position:relative;cursor:pointer}
.slider:hover{cursor:pointer}
.vfill{position:absolute;left:0;top:0;height:100%;background:#fff;border-radius:2px;width:${volume}%;pointer-events:none}
@media(max-width:350px){
.info{margin-bottom:4px}
.title{font-size:11px}
.artist{font-size:9px}
.progress{margin-bottom:4px}
.controls{gap:3px}
.left,.right{gap:2px}
.center{gap:4px}
.btn{padding:2px;width:18px;height:18px}
.btn svg{width:9px;height:9px}
.play{width:26px;height:26px}
.play svg{width:11px;height:11px}
.vol{gap:2px}
.slider{width:25px}
}
@media(max-height:200px){
.info{margin-bottom:2px}
.progress{margin-bottom:2px}
.time{margin-top:1px;font-size:7px}
.controls{gap:2px}
}
</style></head><body>
<img src="${track.imageUrl}" class="bg" alt="" crossorigin="anonymous" onerror="this.style.opacity='0.3'; this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22500%22 height=%22500%22><rect fill=%22%231DB954%22 width=%22500%22 height=%22500%22/><text x=%2250%25%22 y=%2250%25%22 text-anchor=%22middle%22 dy=%22.3em%22 fill=%22white%22 font-size=%2240%22>♪</text></svg>'">
<div class="overlay"></div>
<div class="container">
<div class="info">
<div class="title" id="title">${track.name}</div>
<div class="artist" id="artist">${track.artist}</div>
</div>
<div class="progress" id="pb">
<div class="bar" id="pbar"><div class="fill" id="fill"><div class="thumb"></div></div></div>
<div class="time"><span id="ct">${formatTime(currentTime)}</span><span id="dt">${formatTime(duration)}</span></div>
</div>
<div class="controls">
<div class="left">
<button class="btn ${isShuffled ? 'active' : ''}" id="sh" title="Shuffle">
<svg viewBox="0 0 16 16"><path fill="currentColor" d="M13.151.922a.75.75 0 10-1.06 1.06L13.109 3H11.16a3.75 3.75 0 00-2.873 1.34l-6.173 7.356A2.25 2.25 0 01.39 12.5H0V14h.391a3.75 3.75 0 002.873-1.34l6.173-7.356a2.25 2.25 0 011.724-.804h1.947l-1.017 1.018a.75.75 0 001.06 1.06L15.98 3.75 13.15.922z"/></svg>
</button>
<button class="btn ${repeatMode !== 'off' ? 'active' : ''}" id="rp" title="Repeat">
<svg viewBox="0 0 16 16"><path fill="currentColor" d="M0 4.75A3.75 3.75 0 013.75 1h8.5A3.75 3.75 0 0116 4.75v5a3.75 3.75 0 01-3.75 3.75H9.81l1.018 1.018a.75.75 0 11-1.06 1.06L6.939 12.75l2.829-2.828a.75.75 0 111.06 1.06L9.811 12h2.439a2.25 2.25 0 002.25-2.25v-5a2.25 2.25 0 00-2.25-2.25h-8.5a2.25 2.25 0 00-2.25 2.25v5A2.25 2.25 0 003.75 12H5v1.5H3.75A3.75 3.75 0 010 9.75v-5z"/>${repeatMode === 'one' ? '<path fill="currentColor" d="M7 8V5h1.5v5H7V8z"/>' : ''}</svg>
</button>
</div>
<div class="center">
<button class="btn" id="pr" title="Previous">
<svg viewBox="0 0 16 16"><path fill="currentColor" d="M3.3 1a.7.7 0 01.7.7v5.15l9.95-5.744a.7.7 0 011.05.606v12.575a.7.7 0 01-1.05.607L4 9.149V14.3a.7.7 0 01-.7.7H1.7a.7.7 0 01-.7-.7V1.7a.7.7 0 01.7-.7h1.6z"/></svg>
</button>
<button class="play" id="pp" title="${isPlaying ? 'Pause' : 'Play'}">
<svg viewBox="0 0 16 16" id="playicon">
${isPlaying 
  ? '<path fill="currentColor" d="M2.7 1a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7H2.7zm8 0a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7h-2.6z"/>'
  : '<path fill="currentColor" d="M3 1.713a.7.7 0 011.05-.607l10.89 6.288a.7.7 0 010 1.212L4.05 14.894A.7.7 0 013 14.288V1.713z"/>'
}
</svg>
</button>
<button class="btn" id="nx" title="Next">
<svg viewBox="0 0 16 16"><path fill="currentColor" d="M12.7 1a.7.7 0 00-.7.7v5.15L2.05 1.107A.7.7 0 001 1.712v12.575a.7.7 0 001.05.607L12 9.149V14.3a.7.7 0 00.7.7h1.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7h-1.6z"/></svg>
</button>
</div>
<div class="right">
<div class="vol">
<button class="btn" id="vm" title="Volume">
<svg viewBox="0 0 16 16" id="volicon">${getVolumeIcon(volume)}</svg>
</button>
<div class="slider" id="vs"><div class="vfill" id="vfill"></div></div>
</div>
</div>
</div>
</div>
<script>
const DURATION=${duration};
let isDraggingProgress=false;
let isDraggingVolume=false;

function msg(a,v){window.opener&&window.opener.postMessage({action:a,value:v},'*')}

// Progress bar drag
const pbar=document.getElementById('pbar');
pbar.addEventListener('mousedown',e=>{
  isDraggingProgress=true;
  updateProgress(e);
});
document.addEventListener('mousemove',e=>{
  if(isDraggingProgress) updateProgress(e);
});
document.addEventListener('mouseup',()=>{
  isDraggingProgress=false;
});
function updateProgress(e){
  const r=pbar.getBoundingClientRect();
  const p=Math.max(0,Math.min(1,(e.clientX-r.left)/r.width));
  document.getElementById('fill').style.width=(p*100)+'%';
  msg('seek',p*DURATION);
}

// Volume slider drag
const vs=document.getElementById('vs');
vs.addEventListener('mousedown',e=>{
  isDraggingVolume=true;
  updateVolume(e);
});
document.addEventListener('mousemove',e=>{
  if(isDraggingVolume) updateVolume(e);
});
document.addEventListener('mouseup',()=>{
  isDraggingVolume=false;
});
function updateVolume(e){
  const r=vs.getBoundingClientRect();
  const p=Math.max(0,Math.min(100,((e.clientX-r.left)/r.width)*100));
  document.getElementById('vfill').style.width=p+'%';
  msg('volume',p);
}

// Buttons
document.getElementById('pp').onclick=()=>msg('playPause');
document.getElementById('nx').onclick=()=>msg('next');
document.getElementById('pr').onclick=()=>msg('previous');
document.getElementById('vm').onclick=()=>msg('toggleMute');

// Updates from parent
window.addEventListener('message',e=>{
  const d=e.data.update;
  if(!d)return;
  if(!isDraggingProgress&&d.progress!==undefined) document.getElementById('fill').style.width=d.progress+'%';
  if(d.currentTime!==undefined) document.getElementById('ct').textContent=d.currentTime;
  if(d.duration!==undefined) document.getElementById('dt').textContent=d.duration;
  if(!isDraggingVolume&&d.volume!==undefined) document.getElementById('vfill').style.width=d.volume+'%';
  if(d.isPlaying!==undefined){
    document.getElementById('playicon').innerHTML=d.isPlaying?'<path fill="currentColor" d="M2.7 1a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7H2.7zm8 0a.7.7 0 00-.7.7v12.6a.7.7 0 00.7.7h2.6a.7.7 0 00.7-.7V1.7a.7.7 0 00-.7-.7h-2.6z"/>':'<path fill="currentColor" d="M3 1.713a.7.7 0 011.05-.607l10.89 6.288a.7.7 0 010 1.212L4.05 14.894A.7.7 0 013 14.288V1.713z"/>';
  }
  if(d.shuffle!==undefined) document.getElementById('sh').className=d.shuffle?'btn active':'btn';
  if(d.repeat!==undefined) document.getElementById('rp').className=d.repeat?'btn active':'btn';
  if(d.volumeIcon!==undefined) document.getElementById('volicon').innerHTML=d.volumeIcon;
  if(d.trackName!==undefined){
    document.getElementById('title').textContent=d.trackName;
    document.getElementById('artist').textContent=d.trackArtist||'';
    if(d.trackImage) document.querySelector('.bg').src=d.trackImage;
  }
});
console.log('✅ PiP initialized');
</script>
</body></html>`;
  };

  // Open PiP
  const openPip = async () => {
    if (isPipActive || !isPipSupported) return;

    try {
      // @ts-ignore
      const pipWindow = await window.documentPictureInPicture.requestWindow({
        width: 400,
        height: 280,
      });

      pipWindowRef.current = pipWindow;
      lastTrackIdRef.current = track.id;
      
      pipWindow.document.write(createHTML());
      pipWindow.document.close();

      pipWindow.addEventListener('pagehide', () => {
        setIsPipActive(false);
        pipWindowRef.current = null;
        console.log('🔴 PiP closed');
      });

      setIsPipActive(true);
      console.log('🟢 PiP opened');
      // Keep activation flag - successful open means we still have activation
    } catch (err: any) {
      console.error('PiP error:', err);
      if (err.name === 'NotAllowedError') {
        // Mark that we need activation
        hasActivationRef.current = false;
        console.log('⏳ Need user interaction to enable auto-open');
      }
    }
  };

  // Close PiP
  const closePip = () => {
    if (pipWindowRef.current && !pipWindowRef.current.closed) {
      pipWindowRef.current.close();
    }
    pipWindowRef.current = null;
    setIsPipActive(false);
  };

  // Toggle
  const togglePip = () => {
    if (isPipActive) {
      closePip();
      toast.info('Picture-in-Picture closed');
    } else {
      openPip().then(() => {
        toast.success('PiP opened! 🎵', {
          description: 'Auto-open/close enabled'
        });
      });
    }
  };

  // Listen for ANY user interaction to refresh activation
  useEffect(() => {
    const captureActivation = () => {
      if (!hasActivationRef.current) {
        console.log('✅ User activation captured');
        hasActivationRef.current = true;
      }
    };

    // Listen for ANY user interaction
    document.addEventListener('click', captureActivation, true);
    document.addEventListener('keydown', captureActivation, true);
    document.addEventListener('mousedown', captureActivation, true);

    return () => {
      document.removeEventListener('click', captureActivation, true);
      document.removeEventListener('keydown', captureActivation, true);
      document.removeEventListener('mousedown', captureActivation, true);
    };
  }, []);

  // Capture activation when user presses Alt/Tab (before switching)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Capture Alt, Tab, or Meta key as user activation
      if (e.key === 'Alt' || e.key === 'Tab' || e.metaKey || e.altKey) {
        if (!hasActivationRef.current) {
          console.log('✅ Keyboard activation captured (Alt/Tab)');
          hasActivationRef.current = true;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);

  // Auto open/close with visibility API - FULLY AUTOMATIC
  useEffect(() => {
    let timeout: NodeJS.Timeout;

    const handleVisibilityChange = () => {
      clearTimeout(timeout);
      
      console.log(`👁️ Visibility: ${document.hidden ? 'HIDDEN' : 'VISIBLE'}, Playing: ${isPlaying}, PiP: ${isPipActive}, HasActivation: ${hasActivationRef.current}`);
      
      // Auto-open when tab hidden and playing (only if we have activation)
      if (document.hidden && isPlaying && !isPipActive && hasActivationRef.current) {
        timeout = setTimeout(() => {
          console.log('🎵 Auto-opening PiP');
          openPip();
        }, 300);
      } 
      // Auto-close when tab visible
      else if (!document.hidden && isPipActive) {
        timeout = setTimeout(() => {
          console.log('🔴 Auto-closing PiP');
          closePip();
          // Mark that we need new activation
          hasActivationRef.current = false;
          console.log('⏳ Waiting for user interaction...');
        }, 300);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      clearTimeout(timeout);
    };
  }, [isPlaying, isPipActive]);

  // Send updates
  useEffect(() => {
    if (!isPipActive || !pipWindowRef.current || pipWindowRef.current.closed) return;

    try {
      const progressPercent = ((currentTime / duration) * 100) || 0;
      
      pipWindowRef.current.postMessage({
        update: {
          progress: progressPercent,
          currentTime: formatTime(currentTime),
          duration: formatTime(duration),
          volume: volume,
          isPlaying: isPlaying,
          shuffle: isShuffled,
          repeat: repeatMode !== 'off',
          volumeIcon: getVolumeIcon(volume),
        }
      }, '*');
    } catch (err) {
      console.error('Update failed:', err);
    }
  }, [isPipActive, currentTime, duration, volume, isPlaying, isShuffled, repeatMode]);

  // Recreate on track change
  useEffect(() => {
    if (!isPipActive || !pipWindowRef.current || pipWindowRef.current.closed) return;
    
    if (lastTrackIdRef.current !== track.id) {
      console.log('🔄 Track changed - Updating PiP');
      lastTrackIdRef.current = track.id;
      
      // Send full update with track info
      pipWindowRef.current.postMessage({
        update: {
          trackName: track.name,
          trackArtist: track.artist,
          trackImage: track.imageUrl,
          progress: 0,
          currentTime: formatTime(0),
          duration: formatTime(duration),
          volume: volume,
          isPlaying: isPlaying,
          shuffle: isShuffled,
          repeat: repeatMode !== 'off',
          volumeIcon: getVolumeIcon(volume),
        }
      }, '*');
    }
  }, [track.id, track.name, track.artist, track.imageUrl, isPipActive]);

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
        case 'toggleMute': onVolumeChange?.(volume > 0 ? 0 : 100); break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onPlayPause, onNext, onPrevious, onSeek, onVolumeChange, volume]);

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
  }, []);

  if (!isPipSupported) {
    return (
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          toast.error('Picture-in-Picture not supported', {
            description: 'Update to Chrome 116+ or Edge 116+',
          });
        }}
        className="hover:bg-primary/20 opacity-50"
        title="PiP not supported"
      >
        <PictureInPicture2 className="w-4 h-4" />
      </Button>
    );
  }

  const needsActivation = !hasActivationRef.current && !isPipActive;
  
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={togglePip}
      className={`hover:bg-primary/20 ${isPipActive ? 'text-primary' : ''} ${needsActivation ? 'animate-pulse text-yellow-500' : ''}`}
      title={
        isPipActive
          ? 'Close Picture-in-Picture'
          : needsActivation
          ? 'Click to enable auto-open PiP (needs user interaction)'
          : 'Picture-in-Picture (Auto-open/close enabled)'
      }
    >
      <PictureInPicture2 className={`w-4 h-4 ${isPipActive ? 'animate-pulse' : ''}`} />
    </Button>
  );
};
