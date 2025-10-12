import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  Link2, 
  Copy, 
  Check, 
  MessageCircle, 
  Send, 
  Facebook, 
  Share2,
  Clock
} from 'lucide-react';
import { toast } from 'sonner';
import { generateShareableLink, ShareLinkOptions } from '@/lib/shareUtils';

interface SharePlaylistDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  playlistId: string;
  playlistName: string;
  playlistData?: any; // Full playlist data to share
}

export default function SharePlaylistDialog({ 
  open, 
  onOpenChange, 
  playlistId,
  playlistName,
  playlistData 
}: SharePlaylistDialogProps) {
  const [shareLink, setShareLink] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate link when dialog opens (always 24 hours expiry)
  useEffect(() => {
    if (open && playlistId) {
      generateLink();
    }
  }, [open, playlistId]);

  const generateLink = async () => {
    setIsGenerating(true);
    try {
      const options: ShareLinkOptions = {
        playlistId,
        playlistName,
        playlistData,
        expiry: '1d' // Always 24 hours
      };
      
      const link = await generateShareableLink(options);
      setShareLink(link);
    } catch (error) {
      console.error('Failed to generate share link:', error);
      toast.error('Failed to generate share link');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareLink);
      setCopied(true);
      toast.success('Link copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast.error('Failed to copy link');
    }
  };

  const shareToWhatsApp = () => {
    const text = encodeURIComponent(`Check out this playlist: ${playlistName}\n${shareLink}`);
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareToTelegram = () => {
    const text = encodeURIComponent(`Check out this playlist: ${playlistName}`);
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareLink)}&text=${text}`, '_blank');
  };

  const shareToFacebook = () => {
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareLink)}`, '_blank');
  };

  const shareToMessenger = () => {
    window.open(`https://www.facebook.com/dialog/send?link=${encodeURIComponent(shareLink)}&app_id=YOUR_APP_ID&redirect_uri=${encodeURIComponent(window.location.origin)}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Share Playlist
          </DialogTitle>
          <DialogDescription>
            Share <span className="font-semibold text-foreground">{playlistName}</span> with others
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Expiry Info */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
            <Clock className="w-4 h-4" />
            <span>Link expires in 24 hours</span>
          </div>

          {/* Generated Link */}
          <div className="space-y-2">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Link2 className="w-4 h-4" />
              Shareable Link
            </Label>
            <div className="flex gap-2">
              <Input
                value={shareLink}
                readOnly
                className="flex-1 bg-muted"
                placeholder={isGenerating ? "Generating link..." : ""}
              />
              <Button
                onClick={copyToClipboard}
                variant="outline"
                size="icon"
                disabled={!shareLink || isGenerating}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-500" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Share Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium">Share via</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                onClick={shareToWhatsApp}
                variant="outline"
                className="flex items-center gap-2 hover:bg-green-50 hover:text-green-600 hover:border-green-300 dark:hover:bg-green-950"
                disabled={!shareLink || isGenerating}
              >
                <MessageCircle className="w-4 h-4" />
                WhatsApp
              </Button>
              <Button
                onClick={shareToTelegram}
                variant="outline"
                className="flex items-center gap-2 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-300 dark:hover:bg-blue-950"
                disabled={!shareLink || isGenerating}
              >
                <Send className="w-4 h-4" />
                Telegram
              </Button>
              <Button
                onClick={shareToFacebook}
                variant="outline"
                className="flex items-center gap-2 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-400 dark:hover:bg-blue-950"
                disabled={!shareLink || isGenerating}
              >
                <Facebook className="w-4 h-4" />
                Facebook
              </Button>
              <Button
                onClick={shareToMessenger}
                variant="outline"
                className="flex items-center gap-2 hover:bg-purple-50 hover:text-purple-600 hover:border-purple-300 dark:hover:bg-purple-950"
                disabled={!shareLink || isGenerating}
              >
                <MessageCircle className="w-4 h-4" />
                Messenger
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

