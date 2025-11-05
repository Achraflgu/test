import { useState, useEffect } from "react";
import { Download, X, CheckCircle2, Loader2, ChevronUp, ChevronDown, Trash2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getSocket } from "@/services/api";

interface DownloadItem {
  downloadId: string;
  playlistName: string;
  folderName: string;
  status: 'queued' | 'downloading' | 'completed' | 'failed';
  progress: number;
  totalTracks: number;
  completedTracks: number;
  downloadUrl?: string;
  completedAt?: string;
  startedAt: string;
}

const STORAGE_KEY = 'downloadQueue';

export const DownloadQueue = () => {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeDownloads, setActiveDownloads] = useState<Set<string>>(new Set());

  // Load completed downloads from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setDownloads(parsed);
        // Check which downloads are still active
        const active = parsed.filter((d: DownloadItem) => 
          d.status === 'downloading' || d.status === 'queued'
        ).map((d: DownloadItem) => d.downloadId);
        setActiveDownloads(new Set(active));
      }
    } catch (err) {
      console.error('Failed to load download queue:', err);
    }
  }, []);

  // Save to localStorage whenever downloads change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(downloads));
    } catch (err) {
      console.error('Failed to save download queue:', err);
    }
  }, [downloads]);

  // Listen to Socket.IO events
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Track download start - listen to download:status or track it manually
    const handleDownloadStart = (downloadId: string, folderName: string, totalTracks: number) => {
      console.log('📥 Download started:', { downloadId, folderName, totalTracks });
      const newDownload: DownloadItem = {
        downloadId,
        playlistName: folderName,
        folderName,
        status: 'queued',
        progress: 0,
        totalTracks,
        completedTracks: 0,
        startedAt: new Date().toISOString()
      };

      setDownloads(prev => {
        // Remove if already exists (restart scenario)
        const filtered = prev.filter(d => d.downloadId !== downloadId);
        return [newDownload, ...filtered];
      });
      setActiveDownloads(prev => new Set(prev).add(downloadId));
    };

    // Listen for custom queue start event (emitted from TrackList)
    socket.on('download:queue:start', (data: any) => {
      handleDownloadStart(
        data.downloadId,
        data.folderName || 'Unknown',
        data.totalTracks || 0
      );
    });

    // Also listen for download status updates (which includes start)
    socket.on('download:status', (data: any) => {
      if (data.status === 'started' || data.status === 'processing') {
        handleDownloadStart(
          data.downloadId,
          data.folderName || data.outputFolder || 'Unknown',
          data.totalTracks || 0
        );
      }
    });

    // Track download progress
    socket.on('download:progress', (data: any) => {
      console.log('📊 Download progress:', data);
      setDownloads(prev => prev.map(d => {
        if (d.downloadId === data.downloadId) {
          const progress = data.totalTracks > 0 
            ? Math.round((data.completed / data.totalTracks) * 100)
            : 0;
          return {
            ...d,
            status: 'downloading',
            progress,
            completedTracks: data.completed || 0,
            totalTracks: data.totalTracks || d.totalTracks
          };
        }
        return d;
      }));
    });

    // Track download completion
    socket.on('download:complete', (data: any) => {
      console.log('✅ Download completed:', data);
      setDownloads(prev => prev.map(d => {
        if (d.downloadId === data.downloadId) {
          const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
          // Handle both full URL and relative path
          let downloadUrl = data.downloadUrl;
          if (downloadUrl && !downloadUrl.startsWith('http')) {
            // Relative path - prepend API URL
            downloadUrl = `${API_URL}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
          }
          
          return {
            ...d,
            status: 'completed',
            progress: 100,
            completedTracks: data.totalSuccess || d.completedTracks,
            totalTracks: data.totalSuccess ? (data.totalSuccess + (data.totalFailed || 0)) : d.totalTracks,
            downloadUrl,
            completedAt: new Date().toISOString()
          };
        }
        return d;
      }));
      setActiveDownloads(prev => {
        const next = new Set(prev);
        next.delete(data.downloadId);
        return next;
      });

      // Only show toast if download URL is available
      if (data.downloadUrl) {
        toast.success('Download Complete!', {
          description: `Your files are ready to download`,
          duration: 5000,
          action: {
            label: 'Download Now',
            onClick: () => {
              const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
              let url = data.downloadUrl;
              if (url && !url.startsWith('http')) {
                url = `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
              }
              if (url) {
                window.open(url, '_blank');
              }
            }
          }
        });
      }
    });

    // Track download failure
    socket.on('download:error', (data: any) => {
      console.log('❌ Download error:', data);
      setDownloads(prev => prev.map(d => {
        if (d.downloadId === data.downloadId) {
          return {
            ...d,
            status: 'failed',
            progress: 0
          };
        }
        return d;
      }));
      setActiveDownloads(prev => {
        const next = new Set(prev);
        next.delete(data.downloadId);
        return next;
      });
    });

    return () => {
      socket.off('download:queue:start');
      socket.off('download:status');
      socket.off('download:progress');
      socket.off('download:complete');
      socket.off('download:error');
    };
  }, []);

  const handleDownload = (downloadUrl: string, folderName: string) => {
    if (!downloadUrl) {
      toast.error('Download URL not available');
      return;
    }

    // Create a temporary link and click it
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = `${folderName}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast.success('Download started!', {
      description: `Downloading ${folderName}.zip`
    });
  };

  const handleRemove = (downloadId: string) => {
    setDownloads(prev => prev.filter(d => d.downloadId !== downloadId));
    toast.success('Removed from queue');
  };

  const handleClearCompleted = () => {
    setDownloads(prev => prev.filter(d => d.status !== 'completed'));
    toast.success('Cleared completed downloads');
  };

  const activeCount = downloads.filter(d => d.status === 'downloading' || d.status === 'queued').length;
  const completedCount = downloads.filter(d => d.status === 'completed').length;

  if (downloads.length === 0) return null;

  return (
    <Card className="fixed bottom-4 right-4 w-96 z-50 shadow-2xl border-2">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-full">
              <RefreshCw className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Processing Queue</CardTitle>
              <p className="text-sm text-muted-foreground">
                {activeCount > 0 
                  ? `${activeCount} Download${activeCount > 1 ? 's' : ''} in progress...`
                  : completedCount > 0
                    ? `${completedCount} Completed`
                    : 'No active downloads'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setIsMinimized(!isMinimized)}
            >
              {isMinimized ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronUp className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="space-y-3 max-h-96 overflow-y-auto">
          {/* Active Downloads */}
          {downloads
            .filter(d => d.status === 'downloading' || d.status === 'queued')
            .map((download) => (
              <div
                key={download.downloadId}
                className="flex items-start gap-3 p-3 bg-muted/50 rounded-lg border"
              >
                <div className="p-2 bg-muted rounded">
                  {download.status === 'downloading' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                  ) : (
                    <Download className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <p className="text-sm font-medium truncate">
                      {download.folderName}
                    </p>
                    <Badge variant={download.status === 'downloading' ? 'default' : 'secondary'}>
                      {download.status === 'downloading' ? 'Downloading' : 'Queued'}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <Progress value={download.progress} className="h-2" />
                    <p className="text-xs text-muted-foreground">
                      {download.completedTracks}/{download.totalTracks} tracks • {download.progress}%
                    </p>
                  </div>
                </div>
              </div>
            ))}

          {/* Completed Downloads */}
          {downloads
            .filter(d => d.status === 'completed')
            .map((download) => (
              <div
                key={download.downloadId}
                className="flex items-start gap-3 p-3 bg-green-50 dark:bg-green-950/20 rounded-lg border border-green-200 dark:border-green-800"
              >
                <div className="p-2 bg-green-100 dark:bg-green-900 rounded">
                  <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-medium truncate">
                      {download.folderName}
                    </p>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleDownload(download.downloadUrl!, download.folderName)}
                      >
                        <Download className="h-3 w-3 mr-1" />
                        Download
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleRemove(download.downloadId)}
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{download.completedTracks}/{download.totalTracks} tracks</span>
                    {download.completedAt && (
                      <span>
                        {new Date(download.completedAt).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}

          {/* Clear Completed Button */}
          {completedCount > 0 && (
            <div className="pt-2 border-t">
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-xs"
                onClick={handleClearCompleted}
              >
                <Trash2 className="h-3 w-3 mr-2" />
                Clear Completed ({completedCount})
              </Button>
            </div>
          )}

          {/* Empty State */}
          {downloads.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No downloads in queue
            </p>
          )}
        </CardContent>
      )}
    </Card>
  );
};

