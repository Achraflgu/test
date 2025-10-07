import { Clock, Music, User } from "lucide-react";
import { Playlist } from "@/types";

interface PlaylistHeaderProps {
  playlist: Playlist;
}

export const PlaylistHeader = ({ playlist }: PlaylistHeaderProps) => {
  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  return (
    <div className="bg-gradient-card rounded-xl border border-border overflow-hidden shadow-card">
      <div className="flex flex-col md:flex-row gap-6 p-6">
        {/* Playlist Image */}
        <div className="relative group">
          <img
            src={playlist.imageUrl}
            alt={playlist.name}
            className="w-48 h-48 rounded-lg object-cover shadow-lg transition-transform group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
            <Music className="w-12 h-12 text-white" />
          </div>
        </div>

        {/* Playlist Info */}
        <div className="flex-1 flex flex-col justify-center">
          <p className="text-sm font-semibold text-primary uppercase tracking-wide mb-2">
            Playlist
          </p>
          <h2 className="text-3xl md:text-4xl font-bold mb-3 text-foreground">
            {playlist.name}
          </h2>
          {playlist.description && (
            <p className="text-muted-foreground mb-4 line-clamp-2">
              {playlist.description}
            </p>
          )}

          {/* Stats */}
          <div className="flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2 text-foreground">
              <User className="w-4 h-4 text-primary" />
              <span className="font-medium">{playlist.owner}</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Music className="w-4 h-4" />
              <span>{playlist.totalTracks} tracks</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span>{formatDuration(playlist.totalDuration)}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
