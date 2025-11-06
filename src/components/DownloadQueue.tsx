import { useState, useEffect } from "react";
import { Download, X, CheckCircle2, Loader2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Trash2, RefreshCw, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getSocket, initWebSocket } from "@/services/api";

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
    // Initialize socket if not already initialized
    const socket = getSocket() || initWebSocket();
    
    if (!socket) {
      console.warn('⚠️ Socket not available for DownloadQueue');
      return;
    }
    
    console.log('🔌 DownloadQueue: Setting up socket listeners, socket connected:', socket.connected);

    // Track download start - listen to download:status or track it manually
    const handleDownloadStart = (downloadId: string, folderName: string, totalTracks: number) => {
      console.log('📥 Download started:', { downloadId, folderName, totalTracks });
      const newDownload: DownloadItem = {
        downloadId,
        playlistName: folderName,
        folderName,
        status: 'queued',
        progress: 0,
        totalTracks: totalTracks || 1, // Ensure at least 1 for single tracks
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

    // Set up socket listeners
    const setupSocketListeners = () => {
      if (!socket) {
        console.warn('⚠️ Socket not available for setting up listeners');
        return;
      }
      
      // Remove existing listeners to prevent duplicates
      socket.off('download:queue:start');
      socket.off('download:status');
      socket.off('download:progress');
      socket.off('download:complete');
      socket.off('download:error');
      socket.off('download:track');
      
      // Listen for custom queue start event (emitted from TrackList via Socket.IO)
      socket.on('download:queue:start', (data: any) => {
        console.log('📥 Queue: Received download:queue:start Socket.IO event:', data);
        handleDownloadStart(
          data.downloadId,
          data.folderName || 'Unknown',
          data.totalTracks || 0
        );
      });

      // Also listen for download status updates (which includes start and completion)
      socket.on('download:status', (data: any) => {
        if (data.status === 'started' || data.status === 'processing') {
          handleDownloadStart(
            data.downloadId,
            data.folderName || data.outputFolder || 'Unknown',
            data.totalTracks || 0
          );
        } else if (data.status === 'completed') {
          // Handle completion via download:status event (for single track downloads)
          console.log('✅ Download completed via download:status:', data);
          setDownloads(prev => prev.map(d => {
            if (d.downloadId === data.downloadId) {
              return {
                ...d,
                status: 'completed',
                progress: 100,
                completedTracks: d.completedTracks || 1,
                totalTracks: d.totalTracks || 1,
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
        }
      });

      // Track download progress
      socket.on('download:progress', (data: any) => {
        console.log('📊 [DownloadQueue] Download progress:', JSON.stringify(data, null, 2));
        if (!data.downloadId) {
          console.warn('⚠️ [DownloadQueue] Progress event missing downloadId:', data);
          return;
        }
        
        setDownloads(prev => {
          const found = prev.find(d => d.downloadId === data.downloadId);
          if (!found) {
            console.warn('⚠️ [DownloadQueue] Progress event for unknown downloadId:', data.downloadId, 'Available:', prev.map(d => d.downloadId));
            return prev;
          }
          
          return prev.map(d => {
            if (d.downloadId === data.downloadId) {
            // Handle both playlist progress (completed/totalTracks) and single track progress (progress: 100)
            let progress = d.progress; // Start with current progress
            let completedTracks = d.completedTracks || 0;
            let totalTracks = d.totalTracks || 1;
            
            // Priority 1: Check for playlist progress format (completed/totalTracks) - MOST ACCURATE
            if (data.totalTracks > 0 && data.completed !== undefined) {
              // Playlist progress format - use exact values from backend
              completedTracks = data.completed;
              totalTracks = data.totalTracks;
              progress = Math.round((data.completed / data.totalTracks) * 100);
            }
            // Priority 2: Individual track completed (status: 'completed' with completed/totalTracks info)
            else if (data.status === 'completed' && data.totalTracks > 0 && data.completed !== undefined) {
              // Individual track completed - use the completed count from backend
              completedTracks = data.completed;
              totalTracks = data.totalTracks;
              progress = Math.round((data.completed / data.totalTracks) * 100);
            }
            // Priority 3: Single track download (progress: 100)
            else if (data.progress !== undefined && totalTracks === 1) {
              // Single track progress format
              progress = Math.max(d.progress, data.progress);
              if (data.progress === 100) {
                completedTracks = 1;
                progress = 100;
              }
            }
            // Priority 4: Status is completed but no progress info
            else if (data.status === 'completed') {
              // Assume completion if status says so
              if (totalTracks === 1) {
                completedTracks = 1;
                progress = 100;
              } else {
                // For playlists, only mark complete if we have all tracks
                if (completedTracks >= totalTracks) {
                  progress = 100;
                }
              }
            }
            
            // Update status - mark as completed only when ALL tracks are done
            // Individual tracks send status: 'completed', but overall download is only complete when all tracks are done
            const isCompleted = (completedTracks >= totalTracks && totalTracks > 1) || 
                               (data.status === 'completed' && totalTracks === 1) ||
                               (progress === 100 && completedTracks >= totalTracks);
            const newStatus = isCompleted ? 'completed' : 'downloading';
            
            // Ensure progress doesn't go backwards and is clamped to valid range
            const finalProgress = Math.min(Math.max(d.progress, progress), 100);
            const finalCompletedTracks = Math.min(completedTracks, totalTracks);
            
            console.log(`📊 [DownloadQueue] Updating download ${data.downloadId}: ${d.status} → ${newStatus}, ${d.progress}% → ${finalProgress}%, ${d.completedTracks}/${d.totalTracks} → ${finalCompletedTracks}/${totalTracks}`);
            
            return {
              ...d,
              status: newStatus,
              progress: finalProgress,
              completedTracks: finalCompletedTracks,
              totalTracks,
              // Set completedAt if status is completed
              completedAt: newStatus === 'completed' && !d.completedAt ? new Date().toISOString() : d.completedAt
            };
          }
          return d;
          });
        });
        
        // If progress event indicates completion, also remove from active downloads
        // Check multiple conditions to ensure we catch completion
        const isCompleted = data.status === 'completed' || 
                           data.progress === 100 || 
                           (data.progress !== undefined && data.progress >= 100);
        
        if (isCompleted) {
          setActiveDownloads(prev => {
            const next = new Set(prev);
            next.delete(data.downloadId);
            console.log(`✅ [DownloadQueue] Removed ${data.downloadId} from active downloads (progress: ${data.progress}, status: ${data.status})`);
            return next;
          });
        }
      });

      // Track download completion
      socket.on('download:complete', (data: any) => {
        console.log('✅ [DownloadQueue] Download completed:', JSON.stringify(data, null, 2));
        if (!data.downloadId) {
          console.warn('⚠️ [DownloadQueue] Complete event missing downloadId:', data);
          return;
        }
        
        setDownloads(prev => {
          const found = prev.find(d => d.downloadId === data.downloadId);
          if (!found) {
            console.warn('⚠️ [DownloadQueue] Complete event for unknown downloadId:', data.downloadId, 'Available:', prev.map(d => d.downloadId));
            return prev;
          }
          
          return prev.map(d => {
            if (d.downloadId === data.downloadId) {
              const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
              // Handle both full URL and relative path
              let downloadUrl = data.downloadUrl;
              if (downloadUrl && !downloadUrl.startsWith('http')) {
                // Relative path - prepend API URL
                downloadUrl = `${API_URL}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
              }
              
              // Calculate completed tracks from backend data
              const totalSuccess = data.totalSuccess || 0;
              const totalFailed = data.totalFailed || 0;
              const completedTracks = totalSuccess > 0 ? totalSuccess : (d.completedTracks || 1);
              const totalTracks = (totalSuccess + totalFailed) > 0 ? (totalSuccess + totalFailed) : (d.totalTracks || 1);
              
              console.log(`✅ [DownloadQueue] Marking download ${data.downloadId} as completed: ${completedTracks}/${totalTracks} tracks, URL: ${downloadUrl || 'none'}`);
              
              return {
                ...d,
                status: 'completed',
                progress: 100,
                completedTracks,
                totalTracks,
                downloadUrl: downloadUrl || d.downloadUrl, // Keep existing URL if new one is not provided
                completedAt: new Date().toISOString()
              };
            }
            return d;
          });
        });
        
        setActiveDownloads(prev => {
          const next = new Set(prev);
          next.delete(data.downloadId);
          console.log(`✅ [DownloadQueue] Removed ${data.downloadId} from active downloads`);
          return next;
        });

        // Auto-trigger download when complete (DownloadQueue handles this)
        if (data.downloadUrl) {
          const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
          let fullDownloadUrl = data.downloadUrl;
          if (fullDownloadUrl && !fullDownloadUrl.startsWith('http')) {
            fullDownloadUrl = `${API_URL}${fullDownloadUrl.startsWith('/') ? '' : '/'}${fullDownloadUrl}`;
          }
          
          // Get folder name for filename
          const folderName = data.outputFolder ? data.outputFolder.split(/[/\\]/).pop() || 'Download' : 'Download';
          const downloadFilename = `${folderName}.zip`;
          
          // Auto-start download using iframe method (works with IDM and regular browsers)
          console.log('📥 [DownloadQueue] Auto-triggering download:', fullDownloadUrl, downloadFilename);
          
          // Create hidden iframe for download (IDM-compatible)
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = fullDownloadUrl;
          document.body.appendChild(iframe);
          
          // Clean up iframe after download starts
          setTimeout(() => {
            try {
              document.body.removeChild(iframe);
            } catch (e) {
              // Ignore cleanup errors
            }
          }, 1000);
          
          toast.success('📦 Download Complete!', {
            description: `Your files are downloading automatically...`,
            duration: 3000,
          });
        } else {
          console.warn('⚠️ [DownloadQueue] download:complete event received but no downloadUrl provided');
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

      // Track individual track completion (for single track downloads)
      socket.on('download:track', (data: any) => {
        console.log('📨 [DownloadQueue] Download track event:', JSON.stringify(data, null, 2));
        if (!data.downloadId) {
          console.warn('⚠️ [DownloadQueue] Track event missing downloadId:', data);
          return;
        }
        
        // If track status is completed, update the download progress
        if (data.status === 'completed' && data.progress === 100) {
          setDownloads(prev => {
            const found = prev.find(d => d.downloadId === data.downloadId);
            if (!found) {
              console.warn('⚠️ [DownloadQueue] Track event for unknown downloadId:', data.downloadId);
              return prev;
            }
            
            return prev.map(d => {
              if (d.downloadId === data.downloadId) {
                console.log(`✅ [DownloadQueue] Track completed for download ${data.downloadId}, updating to 100%`);
                return {
                  ...d,
                  status: 'completed',
                  progress: 100,
                  completedTracks: 1,
                  totalTracks: 1,
                  completedAt: d.completedAt || new Date().toISOString()
                };
              }
              return d;
            });
          });
          setActiveDownloads(prev => {
            const next = new Set(prev);
            next.delete(data.downloadId);
            console.log(`✅ [DownloadQueue] Removed ${data.downloadId} from active downloads (from download:track)`);
            return next;
          });
        }
      });
    };
    
    // Set up listeners immediately if socket is connected, otherwise wait for connection
    if (socket.connected) {
      console.log('🔌 DownloadQueue: Socket already connected, setting up listeners');
      setupSocketListeners();
    } else {
      console.log('🔌 DownloadQueue: Socket not connected yet, waiting for connection...');
      socket.on('connect', () => {
        console.log('🔌 DownloadQueue: Socket connected, setting up listeners');
        setupSocketListeners();
      });
    }

    return () => {
      if (socket) {
        socket.off('download:queue:start');
        socket.off('download:status');
        socket.off('download:progress');
        socket.off('download:complete');
        socket.off('download:error');
        socket.off('download:track');
        socket.off('connect');
      }
      window.removeEventListener('download:queue:start', handleQueueStart);
    };
  }, []);

  const handleDownload = (downloadUrl: string, folderName: string) => {
    if (!downloadUrl) {
      toast.error('Download URL not available');
      return;
    }

    const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
    // Handle both full URL and relative path
    let url = downloadUrl;
    if (url && !url.startsWith('http')) {
      // Relative path - prepend API URL
      url = `${API_URL}${url.startsWith('/') ? '' : '/'}${url}`;
    }

    // Open in new window/tab for download
    window.open(url, '_blank');

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
    <Card className="fixed left-2 bottom-24 w-72 z-40 shadow-lg border border-border/40 flex flex-col bg-background/40 backdrop-blur-md rounded-xl hover:bg-background/85 hover:shadow-xl hover:border-border/60 transition-all duration-300 max-h-[450px]">
      <CardHeader className="pb-2.5 pt-3 px-3 border-b border-border/30 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-4 w-4 text-primary/70 animate-spin-slow" />
            <div>
              <CardTitle className="text-sm font-semibold">Queue</CardTitle>
              <p className="text-xs text-muted-foreground/70 mt-0.5">
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
            className="h-7 w-7 hover:bg-muted rounded"
            onClick={() => setIsMinimized(!isMinimized)}
          >
            {isMinimized ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </CardHeader>

      {!isMinimized && (
        <CardContent className="flex-1 overflow-y-auto space-y-2.5 p-3">
          {/* Active Downloads Section */}
          {activeCount > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5 px-2 py-1">
                <Clock className="h-3 w-3 text-primary/70" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Active ({activeCount})
                </span>
              </div>
              {downloads
                .filter(d => d.status === 'downloading' || d.status === 'queued')
                .map((download) => (
                  <div
                    key={download.downloadId}
                    className="flex items-start gap-2.5 p-2.5 bg-muted/30 rounded-lg border border-border/30 hover:bg-muted/50 hover:border-border/50 transition-all group"
                  >
                    <div className="p-1.5 bg-muted/50 rounded flex-shrink-0">
                      {download.status === 'downloading' ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      ) : (
                        <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className="text-sm font-medium truncate text-foreground">
                          {download.folderName}
                        </p>
                        <div className="flex items-center gap-1">
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                            {download.status === 'downloading' ? 'Active' : 'Queued'}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 hover:bg-destructive/20 opacity-70 hover:opacity-100"
                            onClick={() => handleRemove(download.downloadId)}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <div className="relative overflow-hidden rounded-full">
                          <Progress 
                            value={download.progress} 
                            className="h-2.5 bg-muted/50 transition-all duration-500 ease-out" 
                          />
                          {/* Animated gradient overlay for active downloads */}
                          {download.status === 'downloading' && download.progress > 0 && (
                            <div 
                              className="absolute inset-0 bg-gradient-to-r from-primary/30 via-primary/50 to-primary/30 rounded-full transition-all duration-500 ease-out"
                              style={{ width: `${download.progress}%` }}
                            />
                          )}
                          {/* Shimmer effect during download */}
                          {download.status === 'downloading' && download.progress > 0 && download.progress < 100 && (
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-shimmer rounded-full" />
                          )}
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className="flex items-center gap-1.5 text-muted-foreground">
                            {download.status === 'downloading' && (
                              <Loader2 className="h-2.5 w-2.5 animate-spin text-primary" />
                            )}
                            <span className="font-medium">
                              {download.completedTracks}/{download.totalTracks} tracks
                            </span>
                          </span>
                          <span className="font-bold text-primary transition-all duration-300">
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
              <div className="flex items-center gap-1.5 px-2 py-1">
                <CheckCircle2 className="h-3 w-3 text-green-500/70" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Completed ({completedCount})
                </span>
              </div>
              {downloads
                .filter(d => d.status === 'completed')
                .map((download) => (
                  <div
                    key={download.downloadId}
                    className="flex items-start gap-2.5 p-2.5 bg-muted/20 rounded-lg border border-border/30 hover:bg-muted/30 hover:border-border/50 transition-all"
                  >
                    <div className="p-1.5 bg-muted/40 rounded flex-shrink-0">
                      <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <p className="text-sm font-medium truncate text-foreground">
                          {download.folderName}
                        </p>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 hover:bg-destructive/20 opacity-70 hover:opacity-100"
                          onClick={() => handleRemove(download.downloadId)}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      <div className="flex items-center justify-between mb-2 text-xs text-muted-foreground">
                        <span>{download.completedTracks}/{download.totalTracks} tracks</span>
                        {download.completedAt && (
                          <span>{new Date(download.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        )}
                      </div>
                      {download.downloadUrl ? (
                        <Button
                          variant="default"
                          size="sm"
                          className="w-full h-6 text-[10px] font-medium bg-green-600 hover:bg-green-700 px-2"
                          onClick={() => handleDownload(download.downloadUrl!, download.folderName)}
                        >
                          <Download className="h-2.5 w-2.5 mr-1" />
                          Download
                        </Button>
                      ) : (
                        <div className="text-xs text-muted-foreground text-center py-1">
                          Processing...
                        </div>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          )}

          {/* Clear Completed Button */}
          {completedCount > 0 && (
            <div className="pt-2 border-t border-border/20 mt-auto">
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-7 font-medium"
                onClick={handleClearCompleted}
              >
                <Trash2 className="h-3 w-3 mr-1.5" />
                Clear ({completedCount})
              </Button>
            </div>
          )}

          {/* Empty State */}
          {downloads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="p-3 bg-muted/30 rounded-lg mb-3">
                <RefreshCw className="h-4 w-4 text-muted-foreground animate-spin-slow" />
              </div>
              <p className="text-sm text-foreground font-medium mb-1">
                No downloads
              </p>
              <p className="text-xs text-muted-foreground">
                Downloads will appear here
              </p>
            </div>
          )}
        </CardContent>
      )}
      
      {/* Minimized State */}
      {isMinimized && (
        <div className="flex items-center justify-center p-2 border-t border-border/20">
          <div className="flex items-center gap-2">
            <RefreshCw className="h-3.5 w-3.5 text-muted-foreground animate-spin-slow" />
            <div className="text-xs font-medium text-foreground">
              {activeCount > 0 && `${activeCount} active`}
              {activeCount === 0 && completedCount > 0 && `${completedCount} done`}
            </div>
          </div>
        </div>
      )}
    </Card>
  );
};

