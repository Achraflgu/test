import { useState } from "react";
import { Clock, Music, User, ExternalLink, Play, RotateCcw, Share2 } from "lucide-react";
import { Playlist } from "@/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import SharePlaylistDialog from "./SharePlaylistDialog";

interface PlaylistHeaderProps {
  playlist: Playlist;
  combinedPlaylists?: {
    names: string[];
    images: string[];
    urls: string[];
  };
  onReset?: () => void;
  hasActiveTracks?: boolean;
}

export const PlaylistHeader = ({ playlist, combinedPlaylists, onReset, hasActiveTracks = false }: PlaylistHeaderProps) => {
  const [showPlaylistDialog, setShowPlaylistDialog] = useState(false);
  const [listenMode, setListenMode] = useState<'choose' | 'embed'>('choose');
  const [selectedPlaylistIndex, setSelectedPlaylistIndex] = useState<number>(0);
  const [showResetDialog, setShowResetDialog] = useState(false);
  const [showShareDialog, setShowShareDialog] = useState(false);

  const handleReset = () => {
    if (!onReset) return;
    setShowResetDialog(false);
    onReset();
  };

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  // Helper function to extract YouTube playlist ID
  const extractYouTubePlaylistId = (url: string): string | null => {
    const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  };

  // Helper function to extract YouTube video ID
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

  const isYouTube = playlist.url.includes('youtube.com') || playlist.url.includes('youtu.be');
  const isMultiplePlaylists = combinedPlaylists && combinedPlaylists.names.length > 1;
  const hasYouTube = combinedPlaylists?.urls.some(url => url.includes('youtube.com') || url.includes('youtu.be')) || isYouTube;

  const openPlaylist = (mode: 'newTab' | 'embed') => {
    if (isYouTube) {
      // YouTube playlist or video
      if (mode === 'newTab') {
        window.open(playlist.url, '_blank', 'noopener,noreferrer');
        toast.success(`🎬 Opening "${playlist.name}" on YouTube...`);
        setShowPlaylistDialog(false);
      } else {
        setListenMode('embed');
        toast.success(`🎬 Loading player for "${playlist.name}"...`);
      }
    } else {
      // Spotify playlist
      const embedUrl = playlist.url.replace('open.spotify.com/', 'open.spotify.com/embed/');
      
      if (mode === 'newTab') {
        window.open(embedUrl, '_blank', 'noopener,noreferrer');
        toast.success(`🎵 Opening "${playlist.name}" on Spotify (No login required!)...`);
        setShowPlaylistDialog(false);
      } else {
        setListenMode('embed');
        toast.success(`🎵 Loading player for "${playlist.name}"...`);
      }
    }
  };

  // Check if owner is unknown/default
  const shouldShowOwner = playlist.owner && 
    playlist.owner !== 'Unknown' && 
    playlist.owner !== 'Spotify User' &&
    !playlist.owner.toLowerCase().includes('unknown');

  // Determine content type based on URL and track count
  const getContentType = () => {
    if (playlist.totalTracks === 1) {
      // Single track or video
      if (playlist.url.includes('youtube.com') || playlist.url.includes('youtu.be')) {
        return 'Video';
      }
      return 'Track';
    }
    // Multiple tracks
    if (playlist.url.includes('youtube.com')) {
      return 'Playlist';
    }
    return 'Playlist';
  };

  const contentType = getContentType();

  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative bg-gradient-card rounded-2xl border border-border overflow-hidden shadow-card">
        <div className="flex flex-col md:flex-row gap-8 p-8">
          {/* Playlist Image(s) - Clickable */}
          <button
            onClick={() => setShowPlaylistDialog(true)}
            className="relative group/image flex-shrink-0 cursor-pointer hover-scale"
            title={isYouTube ? "Click to watch on YouTube!" : "Click to listen on Spotify - No login required!"}
          >
            <div className="absolute -inset-1 bg-gradient-to-br from-primary/50 to-accent/50 rounded-2xl blur-md opacity-0 group-hover/image:opacity-100 transition-opacity duration-300" />
            
            {/* Multi-Playlist Images Grid */}
            {isMultiplePlaylists && combinedPlaylists ? (
              <div className="relative w-56 h-56">
                {combinedPlaylists.images.length === 2 ? (
                  // 2 Playlists: Side by side
                  <div className="grid grid-cols-2 gap-2 w-56 h-56">
                    {combinedPlaylists.images.map((img, idx) => (
                      <div key={idx} className="relative overflow-hidden rounded-xl group/img">
                        <img
                          src={img}
                          alt={combinedPlaylists.names[idx]}
                          className="w-full h-full object-cover shadow-xl transition-transform duration-500 group-hover/image:scale-110"
                        />
                        <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-bold text-white">
                          {idx + 1}/{combinedPlaylists.images.length}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : combinedPlaylists.images.length === 3 ? (
                  // 3 Playlists: 2 top, 1 bottom
                  <div className="grid grid-rows-2 gap-2 w-56 h-56">
                    <div className="grid grid-cols-2 gap-2">
                      {combinedPlaylists.images.slice(0, 2).map((img, idx) => (
                        <div key={idx} className="relative overflow-hidden rounded-xl">
                          <img
                            src={img}
                            alt={combinedPlaylists.names[idx]}
                            className="w-full h-full object-cover shadow-xl transition-transform duration-500 group-hover/image:scale-110"
                          />
                          <div className="absolute top-1 right-1 bg-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white">
                            {idx + 1}/{combinedPlaylists.images.length}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="relative overflow-hidden rounded-xl">
                      <img
                        src={combinedPlaylists.images[2]}
                        alt={combinedPlaylists.names[2]}
                        className="w-full h-full object-cover shadow-xl transition-transform duration-500 group-hover/image:scale-110"
                      />
                      <div className="absolute top-2 right-2 bg-black/80 backdrop-blur-sm px-2 py-1 rounded-full text-xs font-bold text-white">
                        3/{combinedPlaylists.images.length}
                      </div>
                    </div>
                  </div>
                ) : (
                  // 4+ Playlists: 2x2 grid
                  <div className="grid grid-cols-2 grid-rows-2 gap-2 w-56 h-56">
                    {combinedPlaylists.images.slice(0, 4).map((img, idx) => (
                      <div key={idx} className="relative overflow-hidden rounded-xl">
                        <img
                          src={img}
                          alt={combinedPlaylists.names[idx]}
                          className="w-full h-full object-cover shadow-xl transition-transform duration-500 group-hover/image:scale-110"
                        />
                        <div className="absolute top-1 right-1 bg-black/80 backdrop-blur-sm px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white">
                          {idx + 1}/{combinedPlaylists.images.length}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                
                {/* Play Button Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity duration-300 rounded-2xl" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity duration-300">
                  <div className="p-4 bg-primary/90 backdrop-blur-sm rounded-full shadow-glow">
                    <Play className="w-10 h-10 text-primary-foreground" />
                  </div>
                </div>
              </div>
            ) : (
              // Single Playlist: Original display
              <div className="relative overflow-hidden rounded-2xl">
                <img
                  src={playlist.imageUrl}
                  alt={playlist.name}
                  className="w-56 h-56 object-cover shadow-2xl transition-transform duration-500 group-hover/image:scale-110"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity duration-300" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity duration-300">
                  <div className="p-4 bg-primary/90 backdrop-blur-sm rounded-full shadow-glow">
                    <Play className="w-10 h-10 text-primary-foreground" />
                  </div>
                </div>
              </div>
            )}
          </button>

          {/* Playlist Info */}
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div className="flex items-center justify-between gap-4">
              <div className="inline-flex items-center gap-2">
                <div className="px-3 py-1 bg-primary/20 backdrop-blur-sm rounded-full border border-primary/30">
                  <span className="text-xs font-bold text-primary uppercase tracking-wider">{contentType}</span>
                </div>
              </div>
              
              {/* Action Buttons */}
              <div className="flex items-center gap-2">
                {/* Share Button */}
                <Button
                  onClick={() => setShowShareDialog(true)}
                  variant="outline"
                  size="sm"
                  className="h-9 px-3 border-2 border-blue-500/40 text-blue-500 hover:bg-blue-500/10 hover:border-blue-500 transition-all rounded-lg hover:scale-105"
                  title="Share this playlist"
                >
                  <Share2 className="w-4 h-4 mr-1.5" />
                  <span className="text-xs font-semibold">Share</span>
                </Button>
                
                {/* Reset Button */}
                {onReset && (
                  <Button
                    onClick={() => setShowResetDialog(true)}
                    disabled={!hasActiveTracks}
                    variant="outline"
                    size="sm"
                    className="h-9 px-3 border-2 border-orange-500/40 text-orange-500 hover:bg-orange-500/10 hover:border-orange-500 transition-all rounded-lg hover:scale-105 disabled:opacity-50"
                    title="Reset session (clear playlist and player)"
                  >
                    <RotateCcw className="w-4 h-4 mr-1.5" />
                    <span className="text-xs font-semibold">Reset</span>
                  </Button>
                )}
              </div>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold text-foreground leading-tight hover-scale">
              {playlist.name}
            </h2>
            
            {playlist.description && (
              <p className="text-muted-foreground text-lg leading-relaxed line-clamp-2">
                {playlist.description}
              </p>
            )}

            {/* Stats */}
            <div className="flex flex-wrap items-center gap-6 pt-2">
              {/* Owner with photo and link - Only show if valid owner */}
              {shouldShowOwner && playlist.ownerUrl ? (
                <a 
                  href={playlist.ownerUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 hover:opacity-80 transition-opacity group"
                >
                  {playlist.ownerImage ? (
                    <img 
                      src={playlist.ownerImage} 
                      alt={playlist.owner}
                      className="w-8 h-8 rounded-full border-2 border-primary/20 group-hover:border-primary/50 transition-all"
                    />
                  ) : (
                    <div className="p-2 bg-primary/10 rounded-lg group-hover:bg-primary/20 transition-colors">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <span className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {playlist.owner}
                  </span>
                  <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </a>
              ) : shouldShowOwner ? (
                <div className="flex items-center gap-2">
                  {playlist.ownerImage ? (
                    <img 
                      src={playlist.ownerImage} 
                      alt={playlist.owner}
                      className="w-8 h-8 rounded-full border-2 border-primary/20"
                    />
                  ) : (
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <User className="w-4 h-4 text-primary" />
                    </div>
                  )}
                  <span className="font-semibold text-foreground">{playlist.owner}</span>
                </div>
              ) : null}
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <Music className="w-4 h-4 text-primary" />
                <span className="font-medium">{playlist.totalTracks} tracks</span>
              </div>
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4 text-primary" />
                <span className="font-medium">{formatDuration(playlist.totalDuration)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Listen Dialog */}
      <Dialog open={showPlaylistDialog} onOpenChange={(open) => {
        setShowPlaylistDialog(open);
        if (!open) setListenMode('choose');
      }}>
        <DialogContent className={`bg-card border-border rounded-2xl max-h-[90vh] overflow-y-auto ${listenMode === 'embed' ? 'sm:max-w-[90vw] md:max-w-[800px]' : 'sm:max-w-[95vw] md:max-w-[500px]'}`}>
          <DialogHeader>
            <DialogTitle className="text-xl sm:text-2xl font-bold flex items-center gap-2">
              <Music className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
              {listenMode === 'choose' 
                ? (isMultiplePlaylists 
                    ? (hasYouTube ? 'Watch Playlists' : 'Listen to Playlists')
                    : (isYouTube ? 'Watch Playlist' : 'Listen to Playlist'))
                : (isMultiplePlaylists && combinedPlaylists
                    ? combinedPlaylists.names[selectedPlaylistIndex]
                    : playlist.name)
              }
            </DialogTitle>
            <DialogDescription className="text-sm sm:text-base text-muted-foreground">
              {listenMode === 'choose' 
                ? (isMultiplePlaylists
                    ? `${combinedPlaylists?.names.length} playlists combined - ${hasYouTube ? 'Watch' : 'Listen'} to all together! 🎉`
                    : (isYouTube 
                        ? 'Choose how you want to watch - Free on YouTube! 🎉'
                        : 'Choose how you want to listen - No login required! 🎉'))
                : (isMultiplePlaylists && combinedPlaylists
                    ? `Playing playlist ${selectedPlaylistIndex + 1} of ${combinedPlaylists.names.length}`
                    : `Now ${isYouTube ? 'watching' : 'playing'}: ${playlist.totalTracks} ${isYouTube ? 'videos' : 'tracks'}`)
              }
            </DialogDescription>
          </DialogHeader>
          
          {listenMode === 'choose' ? (
            <div className="space-y-4 py-4">
              {/* Single Playlist Preview - Only show for single playlist */}
              {!isMultiplePlaylists && (
                <div className="flex items-center gap-4 p-4 bg-secondary/30 rounded-xl border border-border/50">
                  <img 
                    src={playlist.imageUrl} 
                    alt={playlist.name}
                    className="w-20 h-20 rounded-lg shadow-md flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-lg sm:text-xl text-foreground truncate">{playlist.name}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs sm:text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Music className="w-3 h-3" />
                        {playlist.totalTracks} tracks
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatDuration(playlist.totalDuration)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Listen Options */}
              {isMultiplePlaylists && combinedPlaylists ? (
                // Individual playlist buttons when multiple playlists
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1 mb-1">
                    <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <Music className="w-4 h-4 text-primary" />
                      Select Playlist
                    </p>
                    <span className="text-xs px-2.5 py-1 rounded-full bg-primary/20 text-primary font-semibold border border-primary/30">
                      {combinedPlaylists.names.length} Total
                    </span>
                  </div>
                  <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-2 custom-scrollbar">
                    {combinedPlaylists.names.map((name, idx) => {
                      const isYT = combinedPlaylists.urls[idx].includes('youtube.com') || combinedPlaylists.urls[idx].includes('youtu.be');
                      return (
                        <div 
                          key={idx} 
                          className="group relative bg-gradient-to-br from-secondary/40 to-secondary/20 hover:from-secondary/60 hover:to-secondary/40 rounded-2xl border border-border/50 hover:border-primary/40 p-3.5 transition-all duration-300 hover:shadow-lg hover:shadow-primary/10"
                        >
                          {/* Playlist Info */}
                          <div className="flex items-center gap-3 mb-3">
                            <div className="relative">
                              <img 
                                src={combinedPlaylists.images[idx]} 
                                alt={name}
                                className="w-14 h-14 rounded-xl shadow-lg group-hover:shadow-xl transition-all"
                              />
                              <div className="absolute -top-1.5 -right-1.5 bg-gradient-to-br from-primary to-primary/80 text-primary-foreground text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-md ring-2 ring-background">
                                {idx + 1}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-bold text-sm text-foreground truncate group-hover:text-primary transition-colors">
                                {name}
                              </h4>
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
                                  isYT 
                                    ? 'bg-red-500/20 text-red-300 border border-red-500/40' 
                                    : 'bg-[#1DB954]/20 text-[#1DB954] border border-[#1DB954]/40'
                                }`}>
                                  {isYT ? '▶' : '♪'}
                                  {isYT ? 'YouTube' : 'Spotify'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="grid grid-cols-2 gap-2">
                            {/* Watch/Listen Here - Embed Player */}
                            <Button
                              onClick={() => {
                                setSelectedPlaylistIndex(idx);
                                setListenMode('embed');
                                toast.success(`${isYT ? '🎬' : '🎵'} Loading "${name}" player...`);
                              }}
                              size="sm"
                              className="h-auto py-2.5 px-3 bg-gradient-to-r from-primary to-primary/90 hover:from-primary hover:to-primary text-primary-foreground font-semibold shadow-md hover:shadow-lg hover:shadow-primary/40 transition-all rounded-xl group/btn"
                            >
                              <Play className="w-3.5 h-3.5 mr-1.5 group-hover/btn:scale-110 transition-transform" />
                              <span className="text-xs">{isYT ? 'Watch' : 'Listen'} Here</span>
                            </Button>

                            {/* Open in New Tab */}
                            <Button
                              onClick={() => {
                                window.open(combinedPlaylists.urls[idx], '_blank', 'noopener,noreferrer');
                                toast.success(`${isYT ? '🎬' : '🎵'} Opening "${name}"...`);
                              }}
                              size="sm"
                              variant="outline"
                              className={`h-auto py-2.5 px-3 font-semibold rounded-xl transition-all group/btn ${
                                isYT
                                  ? 'border-red-500/50 hover:bg-red-500/10 hover:border-red-500 text-red-300 hover:text-red-200'
                                  : 'border-[#1DB954]/50 hover:bg-[#1DB954]/10 hover:border-[#1DB954] text-[#1DB954] hover:text-[#1ed760]'
                              }`}
                            >
                              <ExternalLink className="w-3.5 h-3.5 mr-1.5 group-hover/btn:scale-110 transition-transform" />
                              <span className="text-xs">New Tab</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                // Single playlist - original buttons
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <Button
                    onClick={() => openPlaylist('embed')}
                    className="h-auto flex-col gap-2 sm:gap-3 p-4 sm:p-6 bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary text-white shadow-lg hover:shadow-xl hover:shadow-primary/50 transition-all rounded-xl"
                  >
                    <Play className="w-6 h-6 sm:w-8 sm:h-8" />
                    <div className="text-center">
                      <div className="font-bold text-sm sm:text-base">
                        {isYouTube ? 'Watch Here' : 'Listen Here'}
                      </div>
                      <div className="text-xs opacity-90">In-website player</div>
                    </div>
                  </Button>

                  <Button
                    onClick={() => openPlaylist('newTab')}
                    className={`h-auto flex-col gap-2 sm:gap-3 p-4 sm:p-6 ${
                      isYouTube
                        ? 'bg-gradient-to-br from-[#FF0000] to-[#CC0000] hover:from-[#CC0000] hover:to-[#FF0000]'
                        : 'bg-gradient-to-br from-[#1DB954] to-[#1ed760] hover:from-[#1ed760] hover:to-[#1DB954]'
                    } text-white shadow-lg hover:shadow-xl transition-all rounded-xl`}
                    style={{
                      boxShadow: isYouTube
                        ? '0 10px 25px -5px rgba(255, 0, 0, 0.5)'
                        : '0 10px 25px -5px rgba(29, 185, 84, 0.5)'
                    }}
                  >
                    <ExternalLink className="w-6 h-6 sm:w-8 sm:h-8" />
                    <div className="text-center">
                      <div className="font-bold text-sm sm:text-base">
                        {isYouTube ? 'Open YouTube' : 'Open Spotify'}
                      </div>
                      <div className="text-xs opacity-90">New tab</div>
                    </div>
                  </Button>
                </div>
              )}

              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-xs sm:text-sm text-muted-foreground text-center">
                  <span className="font-semibold text-primary">🎉 Free Access:</span> {
                    isMultiplePlaylists
                      ? `${hasYouTube ? 'Watch all' : 'Listen to all'} ${combinedPlaylists?.names.length} playlists together!`
                      : (hasYouTube
                          ? 'Watch the full playlist on YouTube!'
                          : 'Listen instantly without creating an account!')
                  }
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {/* Show selected playlist info when multiple playlists */}
              {isMultiplePlaylists && combinedPlaylists && (
                <div className="flex items-center gap-3 p-3 bg-secondary/40 rounded-xl border border-border/50">
                  <img 
                    src={combinedPlaylists.images[selectedPlaylistIndex]} 
                    alt={combinedPlaylists.names[selectedPlaylistIndex]}
                    className="w-12 h-12 rounded-lg shadow-md flex-shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground truncate">
                      {combinedPlaylists.names[selectedPlaylistIndex]}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Now playing • Playlist {selectedPlaylistIndex + 1} of {combinedPlaylists.names.length}
                    </p>
                  </div>
                </div>
              )}

              {/* Embedded Player (Spotify or YouTube) */}
              <div className="relative rounded-xl overflow-hidden shadow-2xl border border-border/50 animate-fade-in">
                {(() => {
                  // Get the correct URL for embed
                  const embedUrl = isMultiplePlaylists && combinedPlaylists 
                    ? combinedPlaylists.urls[selectedPlaylistIndex]
                    : playlist.url;
                  
                  const isCurrentYouTube = embedUrl.includes('youtube.com') || embedUrl.includes('youtu.be');
                  
                  if (isCurrentYouTube) {
                    // Check if it's a playlist or single video
                    const playlistId = extractYouTubePlaylistId(embedUrl);
                    const videoId = extractYouTubeVideoId(embedUrl);
                    
                    if (playlistId) {
                      // YouTube Playlist embed
                      return (
                        <iframe
                          src={`https://www.youtube.com/embed/videoseries?list=${playlistId}`}
                          width="100%"
                          height="480"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          loading="lazy"
                          className="rounded-xl"
                          title={`YouTube Playlist - ${isMultiplePlaylists && combinedPlaylists ? combinedPlaylists.names[selectedPlaylistIndex] : playlist.name}`}
                        />
                      );
                    } else if (videoId) {
                      // Single YouTube video embed
                      return (
                        <iframe
                          src={`https://www.youtube.com/embed/${videoId}`}
                          width="100%"
                          height="480"
                          frameBorder="0"
                          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                          allowFullScreen
                          loading="lazy"
                          className="rounded-xl"
                          title={`YouTube Video - ${isMultiplePlaylists && combinedPlaylists ? combinedPlaylists.names[selectedPlaylistIndex] : playlist.name}`}
                        />
                      );
                    }
                  }
                  
                  // Default to Spotify embed
                  return (
                    <iframe
                      src={embedUrl.replace('open.spotify.com/', 'open.spotify.com/embed/')}
                      width="100%"
                      height="380"
                      frameBorder="0"
                      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                      loading="lazy"
                      className="rounded-xl"
                      title={`Spotify Player - ${isMultiplePlaylists && combinedPlaylists ? combinedPlaylists.names[selectedPlaylistIndex] : playlist.name}`}
                    />
                  );
                })()}
              </div>

              <div className="p-3 bg-primary/5 rounded-lg border border-primary/20">
                <p className="text-xs text-muted-foreground text-center">
                  <span className="font-semibold text-primary">💡 Tip:</span> {
                    (() => {
                      const embedUrl = isMultiplePlaylists && combinedPlaylists 
                        ? combinedPlaylists.urls[selectedPlaylistIndex]
                        : playlist.url;
                      const isCurrentYouTube = embedUrl.includes('youtube.com') || embedUrl.includes('youtu.be');
                      
                      return isCurrentYouTube
                        ? 'Click play to watch. Use the playlist controls to navigate!'
                        : 'Click tracks in the player to listen. Controls are at the bottom!';
                    })()
                  }
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            {listenMode === 'embed' && (
              <Button
                variant="outline"
                onClick={() => setListenMode('choose')}
                className="rounded-xl border-border/50"
              >
                Back
              </Button>
            )}
            <Button
              variant="outline"
              onClick={() => {
                setShowPlaylistDialog(false);
                setListenMode('choose');
              }}
              className="rounded-xl border-border/50"
            >
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reset Session Dialog */}
      <Dialog open={showResetDialog} onOpenChange={setShowResetDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-orange-500">
              <RotateCcw className="w-5 h-5" />
              Reset Current Session?
            </DialogTitle>
            <DialogDescription>
              This will clear the current playlist, tracks, and stop playback. Your saved playlists will NOT be affected.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="p-4 bg-orange-500/10 border border-orange-500/30 rounded-lg space-y-2">
              <h4 className="font-semibold text-sm">What will be reset:</h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• Current playlist and all tracks</li>
                <li>• Playback queue and player state</li>
                <li>• Player position and time</li>
              </ul>
              <p className="text-xs text-orange-500 font-medium mt-2">⚠️ Page will reload after reset</p>
            </div>

            <div className="p-4 bg-primary/10 border border-primary/30 rounded-lg space-y-2">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <ExternalLink className="w-4 h-4 text-primary" />
                What will be kept:
              </h4>
              <ul className="text-sm space-y-1 text-muted-foreground">
                <li>• All saved playlists (in History)</li>
                <li>• Download settings</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowResetDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleReset}
              className="bg-orange-500 hover:bg-orange-600 text-white"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reset Session
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Share Playlist Dialog */}
      <SharePlaylistDialog
        open={showShareDialog}
        onOpenChange={setShowShareDialog}
        playlistId={playlist.id}
        playlistName={playlist.name}
        playlistData={playlist}
      />
    </div>
  );
};
