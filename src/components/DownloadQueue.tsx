import { useState, useEffect } from "react";
import { Download, X, CheckCircle2, Loader2, ChevronLeft, ChevronRight, Trash2, RefreshCw, Clock } from "lucide-react";
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

  // Listen to Socket.IO events and custom DOM events
  useEffect(() => {
    const socket = getSocket();

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

    // Listen for client-side custom DOM events (for immediate UI update, works even if socket not ready)
    const handleQueueStart = (event: Event) => {
      const customEvent = event as CustomEvent;
      const data = customEvent.detail;
      console.log('📥 Queue: Received custom DOM download:queue:start event:', data);
      if (data && data.downloadId) {
        handleDownloadStart(
          data.downloadId,
          data.folderName || 'Unknown',
          data.totalTracks || 0
        );
      }
    };
    
    // Add event listener for custom DOM events FIRST (fires immediately, before Socket.IO)
    window.addEventListener('download:queue:start', handleQueueStart);

    // Socket.IO listeners (only if socket is available)
    if (socket) {
      // Listen for custom queue start event (emitted from TrackList via Socket.IO)
      socket.on('download:queue:start', (data: any) => {
        console.log('📥 Queue: Received download:queue:start Socket.IO event:', data);
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
    }

    return () => {
      if (socket) {
        socket.off('download:queue:start');
        socket.off('download:status');
        socket.off('download:progress');
        socket.off('download:complete');
        socket.off('download:error');
      }
      window.removeEventListener('download:queue:start', handleQueueStart);
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

  // Always show component if there are any downloads (active or completed)
  // Hide only if completely empty and no downloads in localStorage
  if (downloads.length === 0) {
    return null;
  }

  return (
    <Card className="fixed left-0 md:left-4 top-0 md:top-4 bottom-0 md:bottom-4 w-full md:w-80 z-40 shadow-2xl border-0 md:border-2 flex flex-col bg-background/95 backdrop-blur-xl md:rounded-lg">
      <CardHeader className="pb-3 border-b flex-shrink-0 bg-gradient-to-r from-primary/10 to-accent/10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-primary/20 rounded-lg">
              <RefreshCw className="h-5 w-5 text-primary animate-spin-slow" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold">Processing Queue</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {activeCount > 0 
                  ? `${activeCount} active • ${completedCount} done`
                  : completedCount > 0
                    ? `${completedCount} completed`
                    : 'Ready'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-primary/20"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="flex-1 overflow-y-auto space-y-3 p-4">
          {/* Active Downloads Section */}
          {activeCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2 py-1">
                <Clock className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Active ({activeCount})
                </span>
              </div>
              {downloads
                .filter(d => d.status === 'downloading' || d.status === 'queued')
                .map((download) => (
                  <div
                    key={download.downloadId}
                    className="flex items-start gap-3 p-3 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg border border-primary/20 hover:border-primary/40 transition-all"
                  >
                    <div className="p-2 bg-primary/20 rounded-lg flex-shrink-0">
                      {download.status === 'downloading' ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Clock className="h-4 w-4 text-primary/70" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold truncate">
                          {download.folderName}
                        </p>
                        <Badge variant={download.status === 'downloading' ? 'default' : 'secondary'} className="text-xs">
                          {download.status === 'downloading' ? 'Active' : 'Queued'}
                        </Badge>
                      </div>
                      <div className="space-y-1.5">
                        <Progress value={download.progress} className="h-2" />
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground">
                            {download.completedTracks}/{download.totalTracks} tracks
                          </span>
                          <span className="font-medium text-primary">
                            {download.progress}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Completed Downloads Section */}
          {completedCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-2 px-2 py-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Completed ({completedCount})
                </span>
              </div>
              {downloads
                .filter(d => d.status === 'completed')
                .map((download) => (
                  <div
                    key={download.downloadId}
                    className="flex items-start gap-3 p-3 bg-gradient-to-r from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20 rounded-lg border border-green-200/50 dark:border-green-800/50 hover:border-green-400 dark:hover:border-green-600 transition-all"
                  >
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg flex-shrink-0">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold truncate">
                          {download.folderName}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 flex-shrink-0 hover:bg-destructive/20"
                          onClick={() => handleRemove(download.downloadId)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-muted-foreground">
                          {download.completedTracks}/{download.totalTracks} tracks
                        </span>
                        {download.completedAt && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(download.completedAt).toLocaleTimeString()}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full h-8 text-xs font-medium"
                        onClick={() => handleDownload(download.downloadUrl!, download.folderName)}
                      >
                        <Download className="h-3.5 w-3.5 mr-1.5" />
                        Download Now
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Clear Completed Button */}
          {completedCount > 0 && (
            <div className="pt-3 border-t border-border mt-auto">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                onClick={handleClearCompleted}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Clear All ({completedCount})
              </Button>
            </div>
          )}

          {/* Empty State */}
          {downloads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-muted/50 rounded-full mb-3">
                <RefreshCw className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground font-medium">
                No downloads yet
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Your downloads will appear here
              </p>
            </div>
          )}
        </CardContent>
      )}
      
      {/* Minimized State */}
      {isMinimized && (
        <div className="flex items-center justify-center p-4 border-t">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/20 rounded-lg">
              <RefreshCw className="h-4 w-4 text-primary" />
            </div>
            <div className="text-xs font-medium">
              {activeCount > 0 && `${activeCount} active`}
              {activeCount === 0 && completedCount > 0 && `${completedCount} done`}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

