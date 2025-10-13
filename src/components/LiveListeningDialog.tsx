import { useState } from 'react';
import { Radio, Copy, Share2, MessageCircle, Send, X, Users, Link2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

interface LiveListeningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onStartLive: (hostName: string) => void;
}

export const LiveListeningDialog = ({ open, onOpenChange, onStartLive }: LiveListeningDialogProps) => {
  const [hostName, setHostName] = useState(() => {
    return localStorage.getItem('userName') || '';
  });

  const handleStartLive = () => {
    if (!hostName.trim()) {
      toast.error('Please enter your name');
      return;
    }

    // Save username for future use
    localStorage.setItem('userName', hostName.trim());

    onStartLive(hostName.trim());
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-purple-500/20 rounded-lg">
              <Radio className="w-6 h-6 text-purple-500" />
            </div>
            <DialogTitle className="text-2xl">Start Live Listening</DialogTitle>
          </div>
          <DialogDescription>
            Create a live session and invite friends to listen to music together in real-time!
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="host-name">Your Name</Label>
            <Input
              id="host-name"
              placeholder="Enter your name..."
              value={hostName}
              onChange={(e) => setHostName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleStartLive()}
            />
          </div>

          <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold flex items-center gap-2">
              <Users className="w-4 h-4" />
              How it works:
            </h4>
            <ul className="text-sm text-gray-400 space-y-1 ml-6 list-disc">
              <li>You'll get a unique link to share with friends</li>
              <li>Friends can join and listen in sync with you</li>
              <li>You control the music, they just listen</li>
              <li>Everyone can adjust their own volume</li>
            </ul>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Cancel
          </Button>
          <Button
            onClick={handleStartLive}
            className="flex-1 bg-purple-600 hover:bg-purple-700"
          >
            <Radio className="w-4 h-4 mr-2" />
            Start Session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface ShareLiveRoomDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roomId: string;
  listenerCount: number;
  onEndSession: () => void;
}

export const ShareLiveRoomDialog = ({ 
  open, 
  onOpenChange, 
  roomId, 
  listenerCount,
  onEndSession 
}: ShareLiveRoomDialogProps) => {
  const getRoomUrl = () => {
    return `${window.location.origin}/live/${roomId}`;
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(getRoomUrl());
    toast.success('Link copied to clipboard! 🔗');
  };

  const shareViaWhatsApp = () => {
    const url = getRoomUrl();
    const text = `🎧 Join my Live Listening session on Track Miner!`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + url)}`, '_blank');
  };

  const shareViaTelegram = () => {
    const url = getRoomUrl();
    const text = `🎧 Join my Live Listening session on Track Miner!`;
    window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareViaMessenger = () => {
    const url = getRoomUrl();
    window.open(`https://www.facebook.com/dialog/send?link=${encodeURIComponent(url)}&app_id=YOUR_APP_ID&redirect_uri=${encodeURIComponent(url)}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <Radio className="w-6 h-6 text-green-500 animate-pulse" />
              </div>
              <DialogTitle className="text-2xl">Session Active!</DialogTitle>
            </div>
            <div className="flex items-center gap-2 px-3 py-1 bg-purple-500/20 rounded-full">
              <Users className="w-4 h-4 text-purple-400" />
              <span className="font-semibold text-purple-400">{listenerCount}</span>
            </div>
          </div>
          <DialogDescription>
            Share this link with friends to invite them to your live session
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Room Link */}
          <div className="space-y-2">
            <Label>Live Session Link</Label>
            <div className="flex gap-2">
              <Input
                value={getRoomUrl()}
                readOnly
                className="font-mono text-sm"
              />
              <Button
                variant="outline"
                size="icon"
                onClick={copyToClipboard}
              >
                <Copy className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Share Options */}
          <div className="space-y-2">
            <Label>Share via</Label>
            <div className="grid grid-cols-3 gap-2">
              <Button
                variant="outline"
                onClick={shareViaWhatsApp}
                className="flex flex-col items-center gap-2 h-auto py-4"
              >
                <MessageCircle className="w-5 h-5 text-green-500" />
                <span className="text-xs">WhatsApp</span>
              </Button>

              <Button
                variant="outline"
                onClick={shareViaTelegram}
                className="flex flex-col items-center gap-2 h-auto py-4"
              >
                <Send className="w-5 h-5 text-blue-500" />
                <span className="text-xs">Telegram</span>
              </Button>

              <Button
                variant="outline"
                onClick={shareViaMessenger}
                className="flex flex-col items-center gap-2 h-auto py-4"
              >
                <MessageCircle className="w-5 h-5 text-blue-600" />
                <span className="text-xs">Messenger</span>
              </Button>
            </div>
          </div>

          {/* Session Info */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <h4 className="font-semibold flex items-center gap-2 mb-2">
              <Link2 className="w-4 h-4" />
              Session Info:
            </h4>
            <div className="text-sm text-gray-400 space-y-1">
              <p>• You are the host - you control the music</p>
              <p>• Listeners will hear what you play in real-time</p>
              <p>• Session ends when you close this or leave</p>
              <p>• Currently {listenerCount} listener{listenerCount !== 1 ? 's' : ''} connected</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            Keep Open
          </Button>
          <Button
            variant="destructive"
            onClick={onEndSession}
            className="flex-1"
          >
            <X className="w-4 h-4 mr-2" />
            End Session
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

