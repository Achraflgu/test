import { useState, useEffect } from "react";
import { Download, X, CheckCircle2, Loader2, ChevronUp, ChevronDown, ChevronLeft, ChevronRight, Trash2, RefreshCw, Clock, ArrowLeft, ArrowRight } from "lucide-react";
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
  const [currentIndex, setCurrentIndex] = useState(0);

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
    console.log('🔌 [DownloadQueue] ========================================');
    console.log('🔌 [DownloadQueue] MOUNTING - Setting up socket listeners');
    console.log('🔌 [DownloadQueue] ========================================');
    
    // Initialize socket if not already initialized
    const socket = getSocket() || initWebSocket();
    
    if (!socket) {
      console.error('❌ [DownloadQueue] Socket not available for DownloadQueue');
      return;
    }
    
    console.log('✅ [DownloadQueue] Socket obtained, connected:', socket.connected);
    console.log('🔌 [DownloadQueue] Setting up socket listeners, socket connected:', socket.connected);

    // Track download start - listen to download:status or track it manually
    const handleDownloadStart = (downloadId: string, folderName: string, totalTracks: number) => {
      console.log('📥 [DownloadQueue] Download started:', { downloadId, folderName, totalTracks });
      
      setDownloads(prev => {
        // Check if this downloadId already exists (instant download scenario - completion arrived before start)
        const existingById = prev.find(d => d.downloadId === downloadId);
        if (existingById) {
          console.log(`⚠️ [DownloadQueue] Download ${downloadId} already exists (instant download), skipping duplicate`);
          return prev;
        }
        
        // Normalize folder names for comparison (case-insensitive, trim whitespace)
        const normalizedNewFolderName = folderName.toLowerCase().trim();
        
        // Check if a completed entry with the same folderName already exists (re-download scenario)
        const existingCompleted = prev.find(d => {
          const normalizedExistingFolderName = d.folderName.toLowerCase().trim();
          return normalizedExistingFolderName === normalizedNewFolderName && d.status === 'completed';
        });
        
        if (existingCompleted) {
          console.log(`⚠️ [DownloadQueue] Re-download detected for "${folderName}" - keeping old completed entry, not adding new one`);
          // Don't add new entry - keep the old completed entry
          // The download will still happen in the background, but won't show in queue
          return prev;
        }
        
        // Remove if already exists (same downloadId) - but keep completed entries
        const filtered = prev.filter(d => d.downloadId !== downloadId);
        
        // Only add if not already in the list
        const exists = filtered.some(d => d.downloadId === downloadId);
        if (exists) {
          console.log('⚠️ [DownloadQueue] Download already exists, skipping duplicate');
          return filtered;
        }
        
        console.log(`✅ [DownloadQueue] Adding new download: ${downloadId} (${folderName})`);
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
    // Store handlers so we can remove only our own listeners (not other components')
    const handlers: Record<string, (...args: any[]) => void> = {};
    
    const setupSocketListeners = () => {
      console.log('🔧 [DownloadQueue] setupSocketListeners() called');
      if (!socket) {
        console.error('❌ [DownloadQueue] Socket not available for setting up listeners');
        return;
      }
      
      console.log('🔧 [DownloadQueue] Removing old DownloadQueue listeners and adding new ones...');
      
      // Remove only our own listeners (using stored handlers)
      if (handlers.downloadQueueStart) socket.off('download:queue:start', handlers.downloadQueueStart);
      if (handlers.downloadStatus) socket.off('download:status', handlers.downloadStatus);
      if (handlers.downloadProgress) socket.off('download:progress', handlers.downloadProgress);
      if (handlers.downloadComplete) socket.off('download:complete', handlers.downloadComplete);
      if (handlers.downloadError) socket.off('download:error', handlers.downloadError);
      if (handlers.downloadTrack) socket.off('download:track', handlers.downloadTrack);
      
      console.log('✅ [DownloadQueue] Old DownloadQueue listeners removed, adding new listeners...');
      console.log('🔧 [DownloadQueue] Socket state - connected:', socket.connected, 'id:', socket.id);
      
      // Listen for custom queue start event (emitted from TrackList via Socket.IO)
      handlers.downloadQueueStart = (data: any) => {
        console.log('📥 [DownloadQueue] Received download:queue:start Socket.IO event:', data);
        handleDownloadStart(
          data.downloadId,
          data.folderName || 'Unknown',
          data.totalTracks || 0
        );
      };
      socket.on('download:queue:start', handlers.downloadQueueStart);
      console.log('✅ [DownloadQueue] Listener attached: download:queue:start');

      // Also listen for download status updates (which includes start and completion)
      handlers.downloadStatus = (data: any) => {
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
      };
      socket.on('download:status', handlers.downloadStatus);

      // Track download progress
      handlers.downloadProgress = (data: any) => {
        console.log('📊 [DownloadQueue] ========================================');
        console.log('📊 [DownloadQueue] RECEIVED download:progress EVENT');
        console.log('📊 [DownloadQueue] ========================================');
        console.log('📊 [DownloadQueue] Download progress:', JSON.stringify(data, null, 2));
        console.log('📊 [DownloadQueue] ========================================');
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
      };
      socket.on('download:progress', handlers.downloadProgress);

      // Track download completion
      handlers.downloadComplete = (data: any) => {
        console.log('✅ [DownloadQueue] ========================================');
        console.log('✅ [DownloadQueue] RECEIVED download:complete EVENT');
        console.log('✅ [DownloadQueue] ========================================');
        console.log('✅ [DownloadQueue] Download completed:', JSON.stringify(data, null, 2));
        console.log('✅ [DownloadQueue] ========================================');
        if (!data.downloadId) {
          console.warn('⚠️ [DownloadQueue] Complete event missing downloadId:', data);
          return;
        }
        
        setDownloads(prev => {
          const found = prev.find(d => d.downloadId === data.downloadId);
          if (!found) {
            // For instant downloads (file already exists), the completion event arrives BEFORE queue:start
            // In this case, create a completed entry directly
            console.log('📦 [DownloadQueue] Instant download detected - creating completed entry:', data.downloadId);
            
            const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3001";
            let downloadUrl = data.downloadUrl;
            if (downloadUrl && !downloadUrl.startsWith('http')) {
              downloadUrl = `${API_URL}${downloadUrl.startsWith('/') ? '' : '/'}${downloadUrl}`;
            }
            
            const totalSuccess = data.totalSuccess || 0;
            const totalFailed = data.totalFailed || 0;
            const completedTracks = totalSuccess > 0 ? totalSuccess : 1;
            const totalTracks = (totalSuccess + totalFailed) > 0 ? (totalSuccess + totalFailed) : 1;
            
            // Extract folder name from outputFolder or use downloadId
            const folderName = data.outputFolder ? data.outputFolder.split(/[/\\]/).pop() || 'Download' : 'Download';
            
            const newCompletedDownload: DownloadItem = {
              downloadId: data.downloadId,
              playlistName: folderName,
              folderName: folderName,
              status: 'completed',
              progress: 100,
              totalTracks: totalTracks,
              completedTracks: completedTracks,
              downloadUrl: downloadUrl,
              startedAt: new Date().toISOString(),
              completedAt: new Date().toISOString()
            };
            
            console.log('✅ [DownloadQueue] Created instant download entry:', newCompletedDownload);
            return [newCompletedDownload, ...prev];
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

        // Auto-trigger download when complete (ONLY DownloadQueue handles this to prevent duplicates)
        // TrackList will NOT auto-trigger to avoid double downloads
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
      };
      socket.on('download:complete', handlers.downloadComplete);

      // Track download failure
      handlers.downloadError = (data: any) => {
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
      };
      socket.on('download:error', handlers.downloadError);

      // Track individual track completion (for single track downloads)
      handlers.downloadTrack = (data: any) => {
        console.log('📨 [DownloadQueue] ========================================');
        console.log('📨 [DownloadQueue] RECEIVED download:track EVENT');
        console.log('📨 [DownloadQueue] ========================================');
        console.log('📨 [DownloadQueue] Download track event:', JSON.stringify(data, null, 2));
        console.log('📨 [DownloadQueue] ========================================');
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
            
            // Update to completed and ensure it's removed from active
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
          
          // Remove from active downloads set (ensures it doesn't show in active section)
          setActiveDownloads(prev => {
            const next = new Set(prev);
            next.delete(data.downloadId);
            console.log(`✅ [DownloadQueue] Removed ${data.downloadId} from active downloads (from download:track)`);
            return next;
          });
        }
      };
      socket.on('download:track', handlers.downloadTrack);
      
      console.log('✅ [DownloadQueue] ALL socket listeners attached successfully!');
      console.log('✅ [DownloadQueue] Listening for: download:queue:start, download:status, download:progress, download:complete, download:error, download:track');
    };
    
    // Set up listeners - try multiple times to ensure they're attached
    // This handles cases where socket connects before component mounts
    const ensureListenersSetup = () => {
      console.log('🔧 [DownloadQueue] Ensuring socket listeners are set up...');
      
      // Try immediately
      if (socket.connected) {
        console.log('✅ [DownloadQueue] Socket is connected, setting up listeners immediately');
        setupSocketListeners();
        return;
      }
      
      console.log('⏳ [DownloadQueue] Socket not connected, setting up connection handler...');
      
      // Set up listener for connect event (use 'on' not 'once' to catch reconnections)
      const connectHandler = () => {
        console.log('✅ [DownloadQueue] Socket connected via event, setting up listeners now');
        setupSocketListeners();
      };
      socket.on('connect', connectHandler);
      
      // Also try after delays to catch late connections
      const trySetup = (attempt: number) => {
        setTimeout(() => {
          if (socket.connected) {
            console.log(`✅ [DownloadQueue] Socket connected (attempt ${attempt}), setting up listeners`);
            setupSocketListeners();
          } else if (attempt < 3) {
            console.log(`⏳ [DownloadQueue] Socket still not connected (attempt ${attempt}), will retry...`);
            trySetup(attempt + 1);
          } else {
            console.warn('⚠️ [DownloadQueue] Socket still not connected after 3 attempts');
          }
        }, attempt * 500); // 500ms, 1000ms, 1500ms
      };
      
      trySetup(1);
    };
    
    ensureListenersSetup();
    console.log('✅ [DownloadQueue] Socket setup initiated');

    return () => {
      if (socket) {
        // Remove only our own listeners (using stored handlers)
        if (handlers.downloadQueueStart) socket.off('download:queue:start', handlers.downloadQueueStart);
        if (handlers.downloadStatus) socket.off('download:status', handlers.downloadStatus);
        if (handlers.downloadProgress) socket.off('download:progress', handlers.downloadProgress);
        if (handlers.downloadComplete) socket.off('download:complete', handlers.downloadComplete);
        if (handlers.downloadError) socket.off('download:error', handlers.downloadError);
        if (handlers.downloadTrack) socket.off('download:track', handlers.downloadTrack);
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

    // Use iframe method (stays on same page, works with IDM)
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    
    // Clean up iframe after download starts
    setTimeout(() => {
      try {
        document.body.removeChild(iframe);
      } catch (e) {
        // Ignore cleanup errors
      }
    }, 1000);

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

  // Reset index when downloads change
  useEffect(() => {
    if (currentIndex >= downloads.length && downloads.length > 0) {
      setCurrentIndex(downloads.length - 1);
    } else if (downloads.length === 0) {
      setCurrentIndex(0);
    }
  }, [downloads.length, currentIndex]);

  // Carousel navigation
  const handlePrevious = () => {
    setCurrentIndex(prev => (prev > 0 ? prev - 1 : downloads.length - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev < downloads.length - 1 ? prev + 1 : 0));
  };

  // Get current download to display
  const currentDownload = downloads[currentIndex];

  // Hide queue when empty
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

      {!isMinimized && currentDownload && (
        <CardContent className="p-3 space-y-3">
          {/* Current Download Display */}
          <div className="transition-all duration-300 ease-in-out">
            {(currentDownload.status === 'downloading' || currentDownload.status === 'queued') && (
              <div className="flex items-start gap-2.5 p-3 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg border border-primary/20 hover:border-primary/30 transition-all">
                <div className="p-2 bg-primary/10 rounded-lg flex-shrink-0">
                  {currentDownload.status === 'downloading' ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <Clock className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-sm font-semibold truncate">{currentDownload.folderName}</p>
                    <Badge variant="default" className="text-[10px] px-2 py-0.5 h-5 shrink-0">
                      {currentDownload.status === 'downloading' ? 'Active' : 'Queued'}
                    </Badge>
                  </div>
                  <div className="space-y-2">
                    <div className="relative overflow-hidden rounded-full h-3">
                      <Progress 
                        value={currentDownload.progress} 
                        className="h-full bg-muted/50" 
                      />
                      {currentDownload.status === 'downloading' && currentDownload.progress > 0 && currentDownload.progress < 100 && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer rounded-full" />
                      )}
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground font-medium">
                        {currentDownload.completedTracks}/{currentDownload.totalTracks} tracks
                      </span>
                      <span className="font-bold text-primary">{currentDownload.progress}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {currentDownload.status === 'completed' && (
              <div className="flex items-start gap-2.5 p-3 bg-gradient-to-br from-green-500/10 to-green-500/5 rounded-lg border border-green-500/20 hover:border-green-500/30 transition-all">
                <div className="p-2 bg-green-500/10 rounded-lg flex-shrink-0">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold truncate">{currentDownload.folderName}</p>
                    <Badge variant="outline" className="text-[10px] px-2 py-0.5 h-5 border-green-500/30 text-green-600 shrink-0">
                      Done
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{currentDownload.completedTracks}/{currentDownload.totalTracks} tracks</span>
                    {currentDownload.completedAt && (
                      <span>{new Date(currentDownload.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </div>
                  {currentDownload.downloadUrl ? (
                    <Button
                      variant="default"
                      size="sm"
                      className="w-full h-7 text-[11px] font-medium bg-green-600 hover:bg-green-700"
                      onClick={() => handleDownload(currentDownload.downloadUrl!, currentDownload.folderName)}
                    >
                      <Download className="h-3 w-3 mr-1.5" />
                      Download ZIP
                    </Button>
                  ) : (
                    <div className="text-xs text-muted-foreground text-center py-1.5">
                      Processing...
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Navigation Controls */}
          {downloads.length > 1 && (
            <div className="flex items-center justify-between pt-2 border-t border-border/20">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={handlePrevious}
              >
                <ArrowLeft className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">Prev</span>
              </Button>
              
              {/* Indicator Dots */}
              <div className="flex items-center gap-1.5">
                {downloads.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentIndex(index)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      index === currentIndex 
                        ? 'w-6 bg-primary' 
                        : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                    }`}
                    aria-label={`Go to download ${index + 1}`}
                  />
                ))}
              </div>
              
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={handleNext}
              >
                <span className="text-xs">Next</span>
                <ArrowRight className="h-3.5 w-3.5 ml-1" />
              </Button>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-border/20">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-7 text-xs"
              onClick={() => handleRemove(currentDownload.downloadId)}
            >
              <X className="h-3 w-3 mr-1" />
              Remove
            </Button>
            {completedCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-7 text-xs"
                onClick={handleClearCompleted}
              >
                <Trash2 className="h-3 w-3 mr-1" />
                Clear All ({completedCount})
              </Button>
            )}
          </div>
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

