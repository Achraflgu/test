import { Clock, Music, User, ExternalLink } from "lucide-react";
import { Playlist } from "@/types";
import { Button } from "@/components/ui/button";

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
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl blur-xl opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative bg-gradient-card rounded-2xl border border-border overflow-hidden shadow-card">
        <div className="flex flex-col md:flex-row gap-8 p-8">
          {/* Playlist Image */}
          <div className="relative group/image flex-shrink-0">
            <div className="absolute -inset-1 bg-gradient-to-br from-primary/50 to-accent/50 rounded-2xl blur-md opacity-0 group-hover/image:opacity-100 transition-opacity duration-300" />
            <div className="relative overflow-hidden rounded-2xl">
              <img
                src={playlist.imageUrl}
                alt={playlist.name}
                className="w-56 h-56 object-cover shadow-2xl transition-transform duration-500 group-hover/image:scale-110"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover/image:opacity-100 transition-opacity duration-300" />
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/image:opacity-100 transition-opacity duration-300">
                <div className="p-4 bg-primary/90 backdrop-blur-sm rounded-full shadow-glow">
                  <Music className="w-10 h-10 text-primary-foreground" />
                </div>
              </div>
            </div>
          </div>

          {/* Playlist Info */}
          <div className="flex-1 flex flex-col justify-center space-y-4">
            <div className="inline-flex items-center gap-2 w-fit">
              <div className="px-3 py-1 bg-primary/20 backdrop-blur-sm rounded-full border border-primary/30">
                <span className="text-xs font-bold text-primary uppercase tracking-wider">Playlist</span>
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
              <div className="flex items-center gap-2">
                <div className="p-2 bg-primary/10 rounded-lg">
                  <User className="w-4 h-4 text-primary" />
                </div>
                <span className="font-semibold text-foreground">{playlist.owner}</span>
              </div>
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <Music className="w-4 h-4 text-primary" />
                <span className="font-medium">{playlist.totalTracks} tracks</span>
              </div>
              
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="w-4 h-4 text-primary" />
                <span className="font-medium">{formatDuration(playlist.totalDuration)}</span>
              </div>
            </div>

            {/* Action Button */}
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="hover-scale border-border/50 hover:border-primary/50 hover:bg-primary/5"
                asChild
              >
                <a href={playlist.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Open in Spotify
                </a>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
