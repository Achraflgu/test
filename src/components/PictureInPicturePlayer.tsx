import { useEffect, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, X, Shuffle, Repeat, Repeat1 } from 'lucide-react';
import { Track } from '@/types';
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
  onClose: () => void;
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
  onClose,
}: PictureInPicturePlayerProps) => {
  const [isVisible, setIsVisible] = useState(false);

  // Show PiP when window loses focus, hide when it regains focus
  useEffect(() => {
    const handleBlur = () => {
      setIsVisible(true);
    };

    const handleFocus = () => {
      setIsVisible(false);
    };

    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  // Format time helper
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isVisible) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] w-[420px] animate-in slide-in-from-top duration-300">
      {/* Main Container with Glass Effect */}
      <div className="relative bg-black/95 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/10 overflow-hidden">
        {/* Background Glow Effect */}
        <div 
          className="absolute inset-0 opacity-30 blur-3xl"
          style={{
            background: `radial-gradient(circle at 50% 50%, rgba(29, 185, 84, 0.3), transparent 70%)`
          }}
        />

        {/* Content */}
        <div className="relative p-5">
          {/* Header with Close Button */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-[#1DB954] rounded-full animate-pulse" />
              <span className="text-xs text-white/60 font-medium">Now Playing</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 rounded-full bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Track Info Section */}
          <div className="flex items-center gap-4 mb-5">
            {/* Album Art */}
            <div className="relative flex-shrink-0 group">
              <img
                src={track.imageUrl}
                alt={track.name}
                className="w-24 h-24 rounded-xl shadow-2xl object-cover ring-2 ring-white/10"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
              {/* Playing Animation Overlay */}
              {isPlaying && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-xl backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="flex gap-1">
                    <div className="w-1 h-4 bg-[#1DB954] rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                    <div className="w-1 h-4 bg-[#1DB954] rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                    <div className="w-1 h-4 bg-[#1DB954] rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
            </div>

            {/* Track Details */}
            <div className="flex-1 min-w-0">
              <h3 className="text-white font-bold text-lg line-clamp-2 mb-1">
                {track.name}
              </h3>
              <p className="text-white/60 text-sm line-clamp-1">
                {track.artist}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-4">
            <div className="relative h-1 bg-white/10 rounded-full overflow-hidden group cursor-pointer">
              <div
                className="absolute h-full bg-[#1DB954] rounded-full transition-all"
                style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
              />
              {/* Hover Effect */}
              <div 
                className="absolute h-full bg-white/20 rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                style={{ width: `${(currentTime / duration) * 100 || 0}%` }}
              />
            </div>
            <div className="flex justify-between mt-2 text-xs text-white/50 font-mono">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Playback Controls */}
          <div className="flex items-center justify-center gap-4">
            {/* Shuffle Button */}
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-full transition-all ${
                isShuffled 
                  ? 'text-[#1DB954] bg-[#1DB954]/20 hover:bg-[#1DB954]/30' 
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              <Shuffle className="w-4 h-4" />
            </Button>

            {/* Previous Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onPrevious}
              className="h-9 w-9 rounded-full text-white hover:text-white hover:bg-white/10 hover:scale-110 transition-all"
            >
              <SkipBack className="w-5 h-5" fill="currentColor" />
            </Button>

            {/* Play/Pause Button */}
            <Button
              onClick={onPlayPause}
              className="h-12 w-12 rounded-full bg-white hover:bg-white/90 text-black shadow-lg hover:scale-105 transition-all"
            >
              {isPlaying ? (
                <Pause className="w-6 h-6" fill="currentColor" />
              ) : (
                <Play className="w-6 h-6 ml-0.5" fill="currentColor" />
              )}
            </Button>

            {/* Next Button */}
            <Button
              variant="ghost"
              size="icon"
              onClick={onNext}
              className="h-9 w-9 rounded-full text-white hover:text-white hover:bg-white/10 hover:scale-110 transition-all"
            >
              <SkipForward className="w-5 h-5" fill="currentColor" />
            </Button>

            {/* Repeat Button */}
            <Button
              variant="ghost"
              size="icon"
              className={`h-8 w-8 rounded-full transition-all ${
                repeatMode !== 'off' 
                  ? 'text-[#1DB954] bg-[#1DB954]/20 hover:bg-[#1DB954]/30' 
                  : 'text-white/60 hover:text-white hover:bg-white/10'
              }`}
            >
              {repeatMode === 'one' ? (
                <Repeat1 className="w-4 h-4" />
              ) : (
                <Repeat className="w-4 h-4" />
              )}
            </Button>
          </div>

          {/* Hint Text */}
          <div className="mt-4 pt-4 border-t border-white/5">
            <p className="text-center text-xs text-white/40">
              Click the window to return to TrackMiner
            </p>
          </div>
        </div>

        {/* Bottom Accent Line */}
        <div className="h-1 bg-gradient-to-r from-[#1DB954] via-[#1ed760] to-[#1DB954]" />
      </div>
    </div>
  );
};

