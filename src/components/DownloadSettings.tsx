import { Settings, Zap } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { DownloadSettings as DownloadSettingsType } from "@/types";

interface DownloadSettingsProps {
  settings: DownloadSettingsType;
  onSettingsChange: (settings: DownloadSettingsType) => void;
}

export const DownloadSettings = ({ settings, onSettingsChange }: DownloadSettingsProps) => {
  return (
    <div className="relative group">
      <div className="absolute -inset-1 bg-gradient-to-r from-primary/10 to-accent/10 rounded-2xl blur-xl opacity-50" />
      <div className="relative bg-card rounded-2xl border border-border p-8 shadow-card">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-primary/10 rounded-xl">
            <Settings className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h3 className="text-2xl font-bold">Download Settings</h3>
            <p className="text-sm text-muted-foreground mt-1">Configure your download preferences</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Format */}
          <div className="space-y-3">
            <Label htmlFor="format" className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              Audio Format
            </Label>
            <Select
              value={settings.format}
              onValueChange={(value: any) => onSettingsChange({ ...settings, format: value })}
            >
              <SelectTrigger 
                id="format" 
                className="h-12 bg-secondary/50 border-border rounded-xl hover:bg-secondary/70 transition-colors"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-card border-border">
                <SelectItem value="mp3" className="rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">MP3</span>
                    <span className="text-xs text-muted-foreground">(Recommended)</span>
                  </div>
                </SelectItem>
                <SelectItem value="flac" className="rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">FLAC</span>
                    <span className="text-xs text-muted-foreground">(Lossless)</span>
                  </div>
                </SelectItem>
                <SelectItem value="ogg" className="rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">OGG</span>
                    <span className="text-xs text-muted-foreground">(Vorbis)</span>
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Choose your preferred audio format</p>
          </div>

          {/* Quality */}
          <div className="space-y-3">
            <Label htmlFor="quality" className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="w-2 h-2 bg-primary rounded-full"></span>
              Audio Quality
            </Label>
            <Select
              value={settings.quality}
              onValueChange={(value: any) => onSettingsChange({ ...settings, quality: value })}
            >
              <SelectTrigger 
                id="quality" 
                className="h-12 bg-secondary/50 border-border rounded-xl hover:bg-secondary/70 transition-colors"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl bg-card border-border">
                <SelectItem value="128k" className="rounded-lg">128 kbps • Good</SelectItem>
                <SelectItem value="192k" className="rounded-lg">192 kbps • Better</SelectItem>
                <SelectItem value="256k" className="rounded-lg">256 kbps • High</SelectItem>
                <SelectItem value="320k" className="rounded-lg">
                  <div className="flex items-center gap-2">
                    <span>320 kbps • Best</span>
                    <Zap className="w-3 h-3 text-primary" />
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">Higher bitrate = better sound quality</p>
          </div>

          {/* Threads */}
          <div className="space-y-3">
            <Label htmlFor="threads" className="text-sm font-semibold text-foreground flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 bg-primary rounded-full"></span>
                Download Threads
              </span>
              <span className="text-primary font-bold">{settings.threads}</span>
            </Label>
            <div className="pt-2">
              <Slider
                id="threads"
                min={1}
                max={16}
                step={1}
                value={[settings.threads]}
                onValueChange={([value]) => onSettingsChange({ ...settings, threads: value })}
                className="cursor-pointer"
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1 (Slow)</span>
              <span>16 (Fast)</span>
            </div>
            <p className="text-xs text-muted-foreground">
              More threads = faster downloads (uses more CPU)
            </p>
          </div>
        </div>

        {/* Info Box */}
        <div className="mt-8 p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">💡 Tip:</span> For best quality, use MP3 at 320kbps with 8 threads. 
            FLAC provides lossless quality but larger file sizes.
          </p>
        </div>
      </div>
    </div>
  );
};
