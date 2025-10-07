import { useState } from "react";
import { Download, Play, Check, X, Loader2, ChevronDown, ChevronUp, Music2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Track, DownloadSettings } from "@/types";
import { toast } from "sonner";

interface TrackListProps {
  tracks: Track[];
  settings: DownloadSettings;
}

export const TrackList = ({ tracks: initialTracks, settings }: TrackListProps) => {
  const [tracks, setTracks] = useState(initialTracks);
  const [downloading, setDownloading] = useState(false);
  const [expanded, setExpanded] = useState(true);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusIcon = (status: Track['downloadStatus'], progress: number) => {
    switch (status) {
      case 'completed':
        return (
          <div className="p-2 bg-success/20 rounded-lg">
            <Check className="w-4 h-4 text-success" />
          </div>
        );
      case 'failed':
        return (
          <div className="p-2 bg-destructive/20 rounded-lg">
            <X className="w-4 h-4 text-destructive" />
          </div>
        );
      case 'downloading':
        return (
          <div className="p-2 bg-downloading/20 rounded-lg">
            <Loader2 className="w-4 h-4 text-downloading animate-spin" />
          </div>
        );
      default:
        return (
          <div className="p-2 bg-muted rounded-lg opacity-50">
            <Download className="w-4 h-4 text-muted-foreground" />
          </div>
        );
    }
  };

  const getStatusColor = (status: Track['downloadStatus']) => {
    switch (status) {
      case 'completed': return 'text-success';
      case 'failed': return 'text-destructive';
      case 'downloading': return 'text-downloading';
      default: return 'text-muted-foreground';
    }
  };

  const downloadAll = async () => {
    setDownloading(true);
    toast.success("🚀 Download started!");

    for (let i = 0; i < tracks.length; i++) {
      setTracks(prev => prev.map((track, idx) => 
        idx === i ? { ...track, downloadStatus: 'downloading' as const, downloadProgress: 0 } : track
      ));

      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setTracks(prev => prev.map((track, idx) => 
          idx === i ? { ...track, downloadProgress: progress } : track
        ));
      }

      const success = Math.random() > 0.1;
      setTracks(prev => prev.map((track, idx) => 
        idx === i ? { 
          ...track, 
          downloadStatus: success ? 'completed' as const : 'failed' as const,
          downloadProgress: success ? 100 : 0
        } : track
      ));

      if (!success) {
        toast.error(`❌ Failed: ${tracks[i].name}`);
      }
    }

    setDownloading(false);
    toast.success("✨ All downloads completed!");
  };

  const completedCount = tracks.filter(t => t.downloadStatus === 'completed').length;
  const failedCount = tracks.filter(t => t.downloadStatus === 'failed').length;
  const overallProgress = (completedCount / tracks.length) * 100;

  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-primary/5 to-accent/5 rounded-2xl blur-xl opacity-50" />
      <div className="relative bg-card rounded-2xl border border-border shadow-card overflow-hidden">
        {/* Header */}
        <div className="p-8 border-b border-border bg-gradient-to-br from-card to-secondary/20">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <Music2 className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h3 className="text-3xl font-bold">Track List</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  {tracks.length} tracks • {settings.format.toUpperCase()} • {settings.quality}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setExpanded(!expanded)}
                className="ml-2 hover:bg-secondary/50 rounded-lg"
              >
                {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </Button>
            </div>
            
            <Button
              onClick={downloadAll}
              disabled={downloading}
              className="h-14 px-8 bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow hover:shadow-[0_0_50px_hsl(141_76%_48%/0.5)] transition-all duration-300 rounded-xl font-semibold hover-scale"
            >
              {downloading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Downloading...
                </>
              ) : (
                <>
                  <Download className="w-5 h-5 mr-2" />
                  Download All
                </>
              )}
            </Button>
          </div>

          {/* Overall Progress */}
          {(completedCount > 0 || failedCount > 0) && (
            <div className="space-y-3">
              <Progress value={overallProgress} className="h-2" />
              <div className="flex gap-6 text-sm font-medium">
                {completedCount > 0 && (
                  <span className="text-success flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    {completedCount} completed
                  </span>
                )}
                {failedCount > 0 && (
                  <span className="text-destructive flex items-center gap-2">
                    <X className="w-4 h-4" />
                    {failedCount} failed
                  </span>
                )}
                <span className="text-muted-foreground">
                  {Math.round(overallProgress)}% complete
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Track List */}
        {expanded && (
          <div className="divide-y divide-border/50 max-h-[600px] overflow-y-auto">
            {tracks.map((track, index) => (
              <div
                key={track.id}
                className="p-5 hover:bg-secondary/30 transition-all duration-300 group/track"
              >
                <div className="flex items-center gap-4">
                  {/* Track Number */}
                  <div className="w-10 text-center">
                    <span className="text-muted-foreground font-semibold group-hover/track:text-primary transition-colors">
                      {index + 1}
                    </span>
                  </div>

                  {/* Album Art */}
                  <div className="relative group/art">
                    <img
                      src={track.imageUrl}
                      alt={track.album}
                      className="w-14 h-14 rounded-lg object-cover shadow-md group-hover/art:shadow-lg transition-all"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/art:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                      <Play className="w-6 h-6 text-white" />
                    </div>
                  </div>

                  {/* Track Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate group-hover/track:text-primary transition-colors">
                      {track.name}
                    </p>
                    <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                  </div>

                  {/* Album */}
                  <div className="hidden lg:block flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground truncate">{track.album}</p>
                  </div>

                  {/* Duration */}
                  <div className="text-sm text-muted-foreground font-mono w-16 text-right">
                    {formatDuration(track.duration)}
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-3 w-32">
                    {getStatusIcon(track.downloadStatus, track.downloadProgress)}
                    <div className="flex flex-col">
                      <span className={`text-xs font-bold uppercase tracking-wide ${getStatusColor(track.downloadStatus)}`}>
                        {track.downloadStatus === 'downloading' ? `${track.downloadProgress}%` : track.downloadStatus}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Bar */}
                {track.downloadStatus === 'downloading' && (
                  <div className="mt-4 ml-28">
                    <Progress value={track.downloadProgress} className="h-1.5 bg-secondary" />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Empty state when collapsed */}
        {!expanded && (
          <div className="p-8 text-center text-muted-foreground">
            <p className="text-sm">Click to expand track list</p>
          </div>
        )}
      </div>
    </div>
  );
};
