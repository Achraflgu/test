import { useState, useEffect } from "react";
import { Download, X, CheckCircle2, Loader2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Trash2, RefreshCw, Clock } from "lucide-react";
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
    <Card className="fixed left-0 top-1/2 -translate-y-1/2 w-80 z-40 shadow-2xl border-l-4 border-l-primary/80 flex flex-col bg-gradient-to-br from-background via-background/95 to-background/90 backdrop-blur-xl rounded-r-2xl hover:shadow-primary/20 hover:border-l-primary transition-all duration-500 max-h-[600px] transform hover:translate-x-2 hover:scale-[1.02]">
      <CardHeader className="pb-3 pt-4 px-4 border-b border-border/40 flex-shrink-0 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/5 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative p-2.5 bg-gradient-to-br from-primary/30 to-primary/10 rounded-xl shadow-lg shadow-primary/20">
              <RefreshCw className="h-4 w-4 text-primary animate-spin-slow" />
              {activeCount > 0 && (
                <div className="absolute -top-1 -right-1 h-2 w-2 bg-primary rounded-full animate-pulse" />
              )}
            </div>
            <div>
              <CardTitle className="text-base font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Processing Queue
              </CardTitle>
              <p className="text-xs text-muted-foreground/90 mt-0.5 font-medium">
                {activeCount > 0 
                  ? `${activeCount} active • ${completedCount} completed`
                  : completedCount > 0
                    ? `${completedCount} completed`
                    : 'Ready to process'}
              </p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hover:bg-primary/20 rounded-lg transition-all"
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
        <CardContent className="flex-1 overflow-y-auto space-y-3 p-4 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
          {/* Active Downloads Section */}
          {activeCount > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-primary/5 rounded-lg border border-primary/10">
                <Clock className="h-4 w-4 text-primary" />
                <span className="text-xs font-bold text-primary uppercase tracking-wider">
                  Active Downloads ({activeCount})
                </span>
              </div>
              {downloads
                .filter(d => d.status === 'downloading' || d.status === 'queued')
                .map((download) => (
                  <div
                    key={download.downloadId}
                    className="flex items-start gap-3 p-3 bg-gradient-to-br from-primary/8 via-primary/5 to-accent/5 rounded-xl border border-primary/20 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/10 hover:bg-primary/10 transition-all duration-300 group"
                  >
                    <div className="p-2 bg-gradient-to-br from-primary/25 to-primary/10 rounded-lg flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                      {download.status === 'downloading' ? (
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      ) : (
                        <Clock className="h-4 w-4 text-primary/70" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold truncate text-foreground">
                          {download.folderName}
                        </p>
                        <Badge variant={download.status === 'downloading' ? 'default' : 'secondary'} className="text-xs px-2 py-0.5 h-5 font-medium">
                          {download.status === 'downloading' ? 'Active' : 'Queued'}
                        </Badge>
                      </div>
                      <div className="space-y-1.5">
                        <Progress value={download.progress} className="h-2 shadow-inner" />
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-muted-foreground font-medium">
                            {download.completedTracks}/{download.totalTracks} tracks
                          </span>
                          <span className="font-bold text-primary">
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
            <div className="space-y-2.5">
              <div className="flex items-center gap-2 px-2 py-1.5 bg-green-500/5 rounded-lg border border-green-500/10">
                <CheckCircle2 className="h-4 w-4 text-green-500" />
                <span className="text-xs font-bold text-green-500 uppercase tracking-wider">
                  Completed ({completedCount})
                </span>
              </div>
              {downloads
                .filter(d => d.status === 'completed')
                .map((download) => (
                  <div
                    key={download.downloadId}
                    className="flex items-start gap-3 p-3 bg-gradient-to-br from-green-500/8 via-green-500/5 to-emerald-500/5 rounded-xl border border-green-500/20 hover:border-green-500/40 hover:shadow-lg hover:shadow-green-500/10 hover:bg-green-500/10 transition-all duration-300 group"
                  >
                    <div className="p-2 bg-gradient-to-br from-green-500/25 to-green-500/10 rounded-lg flex-shrink-0 shadow-md group-hover:scale-110 transition-transform">
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <p className="text-sm font-semibold truncate text-foreground">
                          {download.folderName}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 flex-shrink-0 hover:bg-destructive/20 rounded-lg transition-all"
                          onClick={() => handleRemove(download.downloadId)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between mb-2.5">
                        <span className="text-xs text-muted-foreground font-medium">
                          {download.completedTracks}/{download.totalTracks} tracks
                        </span>
                        {download.completedAt && (
                          <span className="text-xs text-muted-foreground/70">
                            {new Date(download.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <Button
                        variant="default"
                        size="sm"
                        className="w-full h-8 text-xs font-semibold bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 shadow-lg shadow-green-500/20"
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
            <div className="pt-3 border-t border-border/40 mt-auto">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-9 font-medium border-destructive/30 hover:bg-destructive/10 hover:border-destructive/50 transition-all"
                onClick={handleClearCompleted}
              >
                <Trash2 className="h-3.5 w-3.5 mr-2" />
                Clear Completed ({completedCount})
              </Button>
            </div>
          )}

          {/* Empty State */}
          {downloads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-gradient-to-br from-primary/10 to-accent/10 rounded-2xl mb-4 shadow-lg">
                <RefreshCw className="h-6 w-6 text-primary/60 animate-spin-slow" />
              </div>
              <p className="text-sm text-foreground font-semibold mb-1">
                No active downloads
              </p>
              <p className="text-xs text-muted-foreground/70">
                Your downloads will appear here
              </p>
            </div>
          )}
        </CardContent>
      )}
      
      {/* Minimized State */}
      {isMinimized && (
        <div className="flex items-center justify-center p-3 border-t border-border/40 bg-gradient-to-r from-primary/5 to-accent/5">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/20 rounded-lg shadow-md">
              <RefreshCw className="h-4 w-4 text-primary animate-spin-slow" />
              {activeCount > 0 && (
                <div className="absolute -top-0.5 -right-0.5 h-2 w-2 bg-primary rounded-full animate-pulse" />
              )}
            </div>
            <div className="text-xs font-bold text-foreground">
              {activeCount > 0 && `${activeCount} active`}
              {activeCount === 0 && completedCount > 0 && `${completedCount} done`}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

