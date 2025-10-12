import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { 
  Link2, 
  Copy, 
  Check, 
  MessageCircle, 
  Send, 
  Facebook, 
  Share2,
  Clock,
  Infinity
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
  const [expiry, setExpiry] = useState<'1h' | '1d' | '1w' | 'never'>('never');
  const [isGenerating, setIsGenerating] = useState(false);

  // Generate link when dialog opens
  useEffect(() => {
    if (open && playlistId) {
      generateLink();
    }
  }, [open, playlistId, expiry]);

  const generateLink = async () => {
    setIsGenerating(true);
    try {
      const options: ShareLinkOptions = {
        playlistId,
        playlistName,
        playlistData,
        expiry: expiry === 'never' ? undefined : expiry
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
          {/* Expiry Options */}
          <div className="space-y-3">
            <Label className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Link Expiry
            </Label>
            <RadioGroup value={expiry} onValueChange={(value: any) => setExpiry(value)}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="1h" id="1h" />
                <Label htmlFor="1h" className="cursor-pointer">1 Hour</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="1d" id="1d" />
                <Label htmlFor="1d" className="cursor-pointer">1 Day</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="1w" id="1w" />
                <Label htmlFor="1w" className="cursor-pointer">1 Week</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="never" id="never" />
                <Label htmlFor="never" className="cursor-pointer flex items-center gap-1">
                  <Infinity className="w-4 h-4" />
                  No Expiry
                </Label>
              </div>
            </RadioGroup>
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

