import { useState, useEffect } from "react";
import { Download, X, CheckCircle2, Loader2, ChevronUp, ChevronDown, Trash2, RefreshCw, Clock } from "lucide-react";
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

  // Don't load old downloads from localStorage - start fresh on each page load
  // Clear localStorage on mount to remove old downloads
  useEffect(() => {
    try {
      // Clear old downloads from localStorage
      localStorage.removeItem(STORAGE_KEY);
      // Start with empty downloads array
      setDownloads([]);
      setActiveDownloads(new Set());
    } catch (err) {
      console.error('Failed to clear download queue:', err);
    }
  }, []);

  // Don't persist downloads to localStorage - only keep in memory during session
  // Removed localStorage persistence to avoid showing old downloads on reload

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
    <Card className="fixed left-4 bottom-4 w-64 z-30 shadow-2xl border border-border/50 flex flex-col bg-background/60 backdrop-blur-md rounded-lg hover:bg-background/80 transition-all duration-300 max-h-[400px]">
      <CardHeader className="pb-2 pt-2.5 px-2.5 border-b border-border/30 flex-shrink-0 bg-gradient-to-r from-primary/5 to-accent/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="p-1 bg-primary/15 rounded">
              <RefreshCw className="h-3 w-3 text-primary animate-spin-slow" />
            </div>
            <div>
              <CardTitle className="text-xs font-semibold">Queue</CardTitle>
              <p className="text-[9px] text-muted-foreground/80">
                {activeCount > 0 
                  ? `${activeCount} • ${completedCount}`
                  : completedCount > 0
                    ? `${completedCount} done`
                    : 'Ready'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 hover:bg-primary/20 opacity-70 hover:opacity-100"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <ChevronUp className="h-3 w-3" />
            ) : (
              <ChevronDown className="h-3 w-3" />
            )}
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="flex-1 overflow-y-auto space-y-1.5 p-2">
          {/* Active Downloads Section */}
          {activeCount > 0 && (
            <div className="space-y-1">
              <div className="flex items-center gap-1 px-1 py-0.5">
                <Clock className="h-2.5 w-2.5 text-primary/80" />
                <span className="text-[9px] font-medium text-muted-foreground/70 uppercase tracking-wide">
                  Active ({activeCount})
                </span>
              </div>
              {downloads
                .filter(d => d.status === 'downloading' || d.status === 'queued')
                .map((download) => (
                  <div
                    key={download.downloadId}
                    className="flex items-start gap-1.5 p-1.5 bg-gradient-to-r from-primary/3 to-accent/3 rounded border border-primary/10 hover:border-primary/30 hover:bg-primary/5 transition-all"
                  >
                    <div className="p-1 bg-primary/15 rounded flex-shrink-0">
                      {download.status === 'downloading' ? (
                        <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />
                      ) : (
                        <Clock className="h-2.5 w-2.5 text-primary/60" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="text-[10px] font-medium truncate">
                          {download.folderName}
                        </p>
                        <Badge variant={download.status === 'downloading' ? 'default' : 'secondary'} className="text-[9px] px-0.5 py-0 h-3.5">
                          {download.status === 'downloading' ? 'Active' : 'Queued'}
                        </Badge>
                      </div>
                      <div className="space-y-0.5">
                        <Progress value={download.progress} className="h-1" />
                        <div className="flex items-center justify-between text-[9px]">
                          <span className="text-muted-foreground/70">
                            {download.completedTracks}/{download.totalTracks}
                          </span>
                          <span className="font-medium text-primary/80">
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
            <div className="space-y-1">
              <div className="flex items-center gap-1 px-1 py-0.5">
                <CheckCircle2 className="h-2.5 w-2.5 text-green-500/80" />
                <span className="text-[9px] font-medium text-muted-foreground/70 uppercase tracking-wide">
                  Done ({completedCount})
                </span>
              </div>
              {downloads
                .filter(d => d.status === 'completed')
                .map((download) => (
                  <div
                    key={download.downloadId}
                    className="flex items-start gap-1.5 p-1.5 bg-gradient-to-r from-green-50/30 to-emerald-50/30 dark:from-green-950/10 dark:to-emerald-950/10 rounded border border-green-200/30 dark:border-green-800/30 hover:border-green-400/50 dark:hover:border-green-600/50 hover:bg-green-50/40 dark:hover:bg-green-950/20 transition-all"
                  >
                    <div className="p-1 bg-green-100/50 dark:bg-green-900/30 rounded flex-shrink-0">
                      <CheckCircle2 className="h-2.5 w-2.5 text-green-600/80 dark:text-green-400/80" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <p className="text-[10px] font-medium truncate">
                          {download.folderName}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 flex-shrink-0 hover:bg-destructive/20 opacity-70 hover:opacity-100"
                          onClick={() => handleRemove(download.downloadId)}
                        >
                          <X className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] text-muted-foreground/70">
                          {download.completedTracks}/{download.totalTracks}
                        </span>
                        {download.completedAt && (
                          <span className="text-[9px] text-muted-foreground/60">
                            {new Date(download.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full h-6 text-[9px] font-medium"
                        onClick={() => handleDownload(download.downloadUrl!, download.folderName)}
                      >
                        <Download className="h-2.5 w-2.5 mr-1" />
                        Download
                      </Button>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Clear Completed Button */}
          {completedCount > 0 && (
            <div className="pt-1.5 border-t border-border/30 mt-auto">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-[9px] h-6 opacity-70 hover:opacity-100"
                onClick={handleClearCompleted}
              >
                <Trash2 className="h-2.5 w-2.5 mr-1" />
                Clear ({completedCount})
              </Button>
            </div>
          )}

          {/* Empty State */}
          {downloads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className="p-2 bg-muted/30 rounded-full mb-1.5">
                <RefreshCw className="h-3 w-3 text-muted-foreground/60" />
              </div>
              <p className="text-[10px] text-muted-foreground/70 font-medium">
                No downloads
              </p>
              <p className="text-[9px] text-muted-foreground/50 mt-0.5">
                Downloads appear here
              </p>
            </div>
          )}
        </CardContent>
      )}
      
      {/* Minimized State */}
      {isMinimized && (
        <div className="flex items-center justify-center p-1.5 border-t border-border/30">
          <div className="flex items-center gap-1">
            <div className="p-1 bg-primary/15 rounded">
              <RefreshCw className="h-2.5 w-2.5 text-primary/80 animate-spin-slow" />
            </div>
            <div className="text-[9px] font-medium text-muted-foreground/80">
              {activeCount > 0 && `${activeCount}`}
              {activeCount === 0 && completedCount > 0 && `${completedCount}`}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

