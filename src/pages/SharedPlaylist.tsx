import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { Music2, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { getSharedPlaylist, SharedPlaylistData } from '@/lib/shareUtils';
import { fetchShare } from '@/services/api';
import { savePlaylistToHistory } from '@/components/SavedPlaylists';
import { toast } from 'sonner';

const SharedPlaylist = () => {
  const { shareId } = useParams<{ shareId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [sharedData, setSharedData] = useState<SharedPlaylistData | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (!shareId) {
      setError('Invalid share link');
      setLoading(false);
      return;
    }

    (async () => {
      // Try server first for short links
      let data: any = null;
      try {
        data = await fetchShare(shareId);
      } catch {
        // ignore
      }

      // Fallback to URL encoded data/localStorage
      if (!data) {
        const urlData = searchParams.get('data');
        data = getSharedPlaylist(shareId, urlData || undefined);
      }
      
      if (!data) {
        setError('This share link has expired or does not exist');
        setLoading(false);
        return;
      }

      setSharedData(data);
      setLoading(false);
    })();
  }, [shareId, searchParams]);

  const handleLoadPlaylist = async () => {
    if (!sharedData) return;

    try {
      // Save to history
      const saved = await savePlaylistToHistory(
        sharedData.playlistName,
        sharedData.playlistData?.url || '',
        sharedData.playlistData?.imageUrl || '/placeholder.svg',
        sharedData.playlistData?.tracks?.length || 0,
        sharedData.playlistData?.owner || 'Shared',
        sharedData.playlistData?.description || '',
        sharedData.playlistData?.tracks || []
      );

      if (saved) {
        toast.success('Playlist added to your library!');
        // Navigate to home with the playlist loaded
        navigate('/', { 
          state: { 
            loadedPlaylist: sharedData.playlistData,
            fromShare: true 
          } 
        });
      }
    } catch (error) {
      console.error('Failed to load playlist:', error);
      toast.error('Failed to load playlist');
    }
  };

  const formatTimeRemaining = (expiresAt?: number) => {
    if (!expiresAt) return 'Never expires';
    
    const now = Date.now();
    const remaining = expiresAt - now;
    
    if (remaining <= 0) return 'Expired';
    
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
      return `Expires in ${hours}h ${minutes}m`;
    }
    return `Expires in ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Loading shared playlist...</p>
        </div>
      </div>
    );
  }

  if (error || !sharedData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-4">
        <Card className="max-w-md w-full p-8 text-center">
          <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
          <h1 className="text-2xl font-bold mb-2">Share Link Not Found</h1>
          <p className="text-muted-foreground mb-6">{error}</p>
          <Button onClick={() => navigate('/')} className="w-full">
            Go to Home
          </Button>
        </Card>
      </div>
    );
  }

  const trackCount = sharedData.playlistData?.tracks?.length || sharedData.playlistData?.totalTracks || 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-indigo-900 to-blue-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 mb-4 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-full">
            <Music2 className="w-5 h-5 text-white" />
            <span className="text-white font-semibold">Shared Playlist</span>
          </div>
        </div>

        {/* Playlist Card */}
        <Card className="p-8 md:p-12">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            {/* Playlist Image */}
            <div className="w-full md:w-48 h-48 flex-shrink-0">
              <img
                src={sharedData.playlistData?.imageUrl || '/placeholder.svg'}
                alt={sharedData.playlistName}
                className="w-full h-full object-cover rounded-lg shadow-lg"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = '/placeholder.svg';
                }}
              />
            </div>

            {/* Playlist Info */}
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold mb-2">
                {sharedData.playlistName}
              </h1>
              
              {sharedData.playlistData?.description && (
                <p className="text-muted-foreground mb-4">
                  {sharedData.playlistData.description}
                </p>
              )}

              <div className="flex flex-wrap gap-4 mb-6 text-sm">
                {sharedData.playlistData?.owner && (
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">By</span>
                    <span className="font-semibold">{sharedData.playlistData.owner}</span>
                  </div>
                )}
                
                <div className="flex items-center gap-2">
                  <Music2 className="w-4 h-4 text-muted-foreground" />
                  <span>{trackCount} {trackCount === 1 ? 'track' : 'tracks'}</span>
                </div>
                
                {sharedData.expiresAt && (
                  <div className="flex items-center gap-2 text-orange-500">
                    <Clock className="w-4 h-4" />
                    <span>{formatTimeRemaining(sharedData.expiresAt)}</span>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col sm:flex-row gap-3">
                <Button
                  onClick={handleLoadPlaylist}
                  size="lg"
                  className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  <Music2 className="w-5 h-5 mr-2" />
                  Add to My Library
                </Button>
                
                <Button
                  onClick={() => navigate('/')}
                  variant="outline"
                  size="lg"
                >
                  Go to Home
                </Button>
              </div>

              {/* Track Preview */}
              {sharedData.playlistData?.tracks && sharedData.playlistData.tracks.length > 0 && (
                <div className="mt-6 p-4 bg-muted/50 rounded-lg">
                  <p className="text-sm font-semibold mb-2">Preview tracks:</p>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {sharedData.playlistData.tracks.slice(0, 5).map((track: any, idx: number) => (
                      <li key={idx} className="truncate">
                        {idx + 1}. {track.name} {track.artist && track.artist !== 'Unknown Artist' ? `- ${track.artist}` : ''}
                      </li>
                    ))}
                    {sharedData.playlistData.tracks.length > 5 && (
                      <li className="text-xs">... and {sharedData.playlistData.tracks.length - 5} more</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </Card>

        {/* Info Footer */}
        <div className="mt-6 text-center text-white/60 text-sm">
          <p>Shared via Track Miner • Free Music Downloader</p>
        </div>
      </div>
    </div>
  );
};

export default SharedPlaylist;

