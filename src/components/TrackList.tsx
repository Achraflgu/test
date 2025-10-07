import { useState } from "react";
import { Download, Play, Check, X, Loader2, ChevronDown, ChevronUp } from "lucide-react";
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

  const getStatusIcon = (status: Track['downloadStatus']) => {
    switch (status) {
      case 'completed':
        return <Check className="w-4 h-4 text-success" />;
      case 'failed':
        return <X className="w-4 h-4 text-destructive" />;
      case 'downloading':
        return <Loader2 className="w-4 h-4 text-downloading animate-spin" />;
      default:
        return <Download className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: Track['downloadStatus']) => {
    switch (status) {
      case 'completed':
        return 'text-success';
      case 'failed':
        return 'text-destructive';
      case 'downloading':
        return 'text-downloading';
      default:
        return 'text-muted-foreground';
    }
  };

  const downloadAll = async () => {
    setDownloading(true);
    toast.success("Download started!");

    // Simulate download process
    for (let i = 0; i < tracks.length; i++) {
      // Update status to downloading
      setTracks(prev => prev.map((track, idx) => 
        idx === i ? { ...track, downloadStatus: 'downloading' as const, downloadProgress: 0 } : track
      ));

      // Simulate progress
      for (let progress = 0; progress <= 100; progress += 10) {
        await new Promise(resolve => setTimeout(resolve, 100));
        setTracks(prev => prev.map((track, idx) => 
          idx === i ? { ...track, downloadProgress: progress } : track
        ));
      }

      // Mark as completed (90% success rate simulation)
      const success = Math.random() > 0.1;
      setTracks(prev => prev.map((track, idx) => 
        idx === i ? { 
          ...track, 
          downloadStatus: success ? 'completed' as const : 'failed' as const,
          downloadProgress: success ? 100 : 0
        } : track
      ));

      if (!success) {
        toast.error(`Failed to download: ${tracks[i].name}`);
      }
    }

    setDownloading(false);
    toast.success("Download completed!");
  };

  const completedCount = tracks.filter(t => t.downloadStatus === 'completed').length;
  const failedCount = tracks.filter(t => t.downloadStatus === 'failed').length;

  return (
    <div className="bg-card rounded-xl border border-border shadow-card overflow-hidden">
      {/* Header */}
      <div className="p-6 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h3 className="text-2xl font-bold">Tracks</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="text-muted-foreground hover:text-foreground"
            >
              {expanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
            </Button>
          </div>
          <Button
            onClick={downloadAll}
            disabled={downloading}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-glow"
          >
            {downloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Downloading...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Download All ({tracks.length})
              </>
            )}
          </Button>
        </div>

        {/* Progress Summary */}
        {(completedCount > 0 || failedCount > 0) && (
          <div className="flex gap-4 text-sm">
            {completedCount > 0 && (
              <span className="text-success">✓ {completedCount} completed</span>
            )}
            {failedCount > 0 && (
              <span className="text-destructive">✗ {failedCount} failed</span>
            )}
          </div>
        )}
      </div>

      {/* Track List */}
      {expanded && (
        <div className="divide-y divide-border max-h-[600px] overflow-y-auto">
          {tracks.map((track, index) => (
            <div
              key={track.id}
              className="p-4 hover:bg-secondary/50 transition-colors"
            >
              <div className="flex items-center gap-4">
                {/* Track Number */}
                <div className="w-8 text-center text-muted-foreground font-medium">
                  {index + 1}
                </div>

                {/* Album Art */}
                <img
                  src={track.imageUrl}
                  alt={track.album}
                  className="w-12 h-12 rounded object-cover"
                />

                {/* Track Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground truncate">{track.name}</p>
                  <p className="text-sm text-muted-foreground truncate">{track.artist}</p>
                </div>

                {/* Album */}
                <div className="hidden md:block flex-1 min-w-0">
                  <p className="text-sm text-muted-foreground truncate">{track.album}</p>
                </div>

                {/* Duration */}
                <div className="text-sm text-muted-foreground w-16 text-right">
                  {formatDuration(track.duration)}
                </div>

                {/* Status */}
                <div className="flex items-center gap-2 w-24">
                  {getStatusIcon(track.downloadStatus)}
                  <span className={`text-sm font-medium ${getStatusColor(track.downloadStatus)}`}>
                    {track.downloadStatus === 'downloading' ? `${track.downloadProgress}%` : track.downloadStatus}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              {track.downloadStatus === 'downloading' && (
                <div className="mt-3 ml-24">
                  <Progress value={track.downloadProgress} className="h-1" />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
