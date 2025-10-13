import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Music2, Users, Radio, LogOut, Play, Pause, SkipForward, SkipBack, Volume2, VolumeX, Loader2 } from 'lucide-react';
import { Track } from '@/types';
import { initWebSocket } from '@/services/api';
import { liveListeningService } from '@/services/liveListening';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';

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
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(70);
  const [isMuted, setIsMuted] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const isSyncingRef = useRef(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Initialize WebSocket and join room
  useEffect(() => {
    const socket = initWebSocket();
    liveListeningService.init(socket);

    if (roomId) {
      // Listener joining via link
      const userName = localStorage.getItem('userName') || `Listener_${Math.random().toString(36).substring(7)}`;
      liveListeningService.joinRoom(roomId, userName);

      // Setup event listeners
      liveListeningService.onRoomJoined((data) => {
        console.log('✅ Successfully joined room:', data);
        setIsListener(true);
        setIsHost(false);
        setHostName(data.hostName || 'Host');
        setListenerCount(data.listenerCount || 0);
        
        // Sync with current playback state
        if (data.currentTrack) {
          setCurrentTrack(data.currentTrack);
          setIsPlaying(data.isPlaying);
          setCurrentTime(data.currentTime || 0);
          setDuration(data.currentTrack.duration || 0);

          // Load track with sync offset
          loadTrackAndSync(data.currentTrack, data.currentTime, data.isPlaying);
        }

        setIsLoading(false);
        toast.success(`Joined ${data.hostName}'s Live Session! 🎧`);
      });

      liveListeningService.onPlaybackUpdated((data) => {
        console.log('🔄 Playback state updated:', data);
        setIsSyncing(true);
        
        if (data.currentTrack && data.currentTrack.id !== currentTrack?.id) {
          // New track
          setCurrentTrack(data.currentTrack);
          setDuration(data.currentTrack.duration || 0);
          loadTrackAndSync(data.currentTrack, data.currentTime, data.isPlaying);
        } else {
          // Same track, just sync time
          setIsPlaying(data.isPlaying);
          setCurrentTime(data.currentTime);
          
          if (audioRef.current) {
            audioRef.current.currentTime = data.currentTime;
            if (data.isPlaying && audioRef.current.paused) {
              audioRef.current.play().catch(console.error);
            } else if (!data.isPlaying && !audioRef.current.paused) {
              audioRef.current.pause();
            }
          }
        }

        setTimeout(() => setIsSyncing(false), 1000);
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
      // No room ID provided
      toast.error('No room ID provided');
      navigate('/');
    }

    return () => {
      if (isListener) {
        liveListeningService.leaveRoom();
      }
      liveListeningService.cleanup();
    };
  }, [roomId]);

  // Load track and sync
  const loadTrackAndSync = (track: Track, time: number, playing: boolean) => {
    if (!audioRef.current) return;

    isSyncingRef.current = true;
    setIsSyncing(true);

    // For YouTube tracks, we'll need to use the embedded player (simplified for now)
    const audioUrl = track.url; // In production, you'd need to get the audio stream URL

    audioRef.current.src = audioUrl;
    audioRef.current.currentTime = time;
    
    if (playing) {
      audioRef.current.play().catch((err) => {
        console.error('Playback error:', err);
        setIsPlaying(false);
      });
    } else {
      audioRef.current.pause();
    }

    setTimeout(() => {
      isSyncingRef.current = false;
      setIsSyncing(false);
    }, 1500);
  };

  // Audio time update
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      if (!isSyncingRef.current) {
        setCurrentTime(audio.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);

  // Volume control
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume / 100;
    }
  }, [volume, isMuted]);

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin mx-auto mb-4 text-purple-500" />
          <p className="text-gray-400">Joining live session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900/20 via-black to-blue-900/20 text-white p-6">
      {/* Hidden audio element */}
      <audio ref={audioRef} />

      {/* Header */}
      <div className="max-w-6xl mx-auto mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-500/20 rounded-xl">
              <Radio className="w-6 h-6 text-purple-500" />
            </div>
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                🎧 Listening Live with {hostName}
              </h1>
              <p className="text-sm text-gray-400">Listener Mode - Synchronized playback</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 rounded-lg">
              <Users className="w-5 h-5 text-purple-400" />
              <span className="font-semibold">{listenerCount}</span>
              <span className="text-sm text-gray-400">listeners</span>
            </div>

            <Button
              variant="outline"
              onClick={handleLeaveRoom}
              className="gap-2"
            >
              <LogOut className="w-4 h-4" />
              Leave Session
            </Button>
          </div>
        </div>

        {/* Syncing indicator */}
        {isSyncing && (
          <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg px-4 py-2 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            <span className="text-sm text-blue-400">🔄 Syncing...</span>
          </div>
        )}
      </div>

      {/* Main Player */}
      <div className="max-w-6xl mx-auto">
        {currentTrack ? (
          <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 backdrop-blur-xl rounded-2xl p-8 border border-purple-500/20">
            {/* Album Art */}
            <div className="flex flex-col items-center mb-8">
              <div className="relative mb-6">
                <img
                  src={currentTrack.imageUrl}
                  alt={currentTrack.name}
                  className="w-80 h-80 rounded-2xl shadow-2xl object-cover"
                />
                {isPlaying && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded-2xl">
                    <div className="w-16 h-16 bg-purple-500/30 rounded-full flex items-center justify-center animate-pulse">
                      <Music2 className="w-8 h-8 text-purple-400" />
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
                <span className="text-sm text-gray-400 w-12 text-right">{formatTime(currentTime)}</span>
                <div className="flex-1">
                  <Progress 
                    value={(currentTime / duration) * 100} 
                    className="h-2 cursor-not-allowed"
                  />
                </div>
                <span className="text-sm text-gray-400 w-12">{formatTime(duration)}</span>
              </div>
              <p className="text-xs text-center text-gray-500 mt-2">
                Controlled by {hostName}
              </p>
            </div>

            {/* Controls (Display only - no functionality for listeners) */}
            <div className="flex items-center justify-center gap-4 mb-6">
              <Button
                variant="ghost"
                size="icon"
                className="w-12 h-12 opacity-50 cursor-not-allowed"
                disabled
              >
                <SkipBack className="w-6 h-6" />
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="w-16 h-16 bg-purple-500/20 hover:bg-purple-500/30 opacity-50 cursor-not-allowed"
                disabled
              >
                {isPlaying ? (
                  <Pause className="w-8 h-8" />
                ) : (
                  <Play className="w-8 h-8" />
                )}
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="w-12 h-12 opacity-50 cursor-not-allowed"
                disabled
              >
                <SkipForward className="w-6 h-6" />
              </Button>
            </div>

            {/* Volume Control (Local only) */}
            <div className="flex items-center justify-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsMuted(!isMuted)}
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
          <div className="bg-gradient-to-br from-purple-900/30 to-blue-900/30 backdrop-blur-xl rounded-2xl p-12 border border-purple-500/20 text-center">
            <Music2 className="w-16 h-16 mx-auto mb-4 text-gray-500" />
            <p className="text-xl text-gray-400">Waiting for host to play music...</p>
          </div>
        )}
      </div>

      {/* Info Footer */}
      <div className="max-w-6xl mx-auto mt-8 text-center">
        <p className="text-sm text-gray-500">
          💡 You're listening in sync with {hostName}. Only the host can control playback.
          <br />
          You can adjust your volume independently.
        </p>
      </div>
    </div>
  );
};

