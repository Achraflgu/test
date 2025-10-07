import { Settings } from "lucide-react";
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
    <div className="bg-card rounded-xl border border-border p-6 shadow-card">
      <div className="flex items-center gap-2 mb-6">
        <Settings className="w-5 h-5 text-primary" />
        <h3 className="text-xl font-bold">Download Settings</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Format */}
        <div className="space-y-2">
          <Label htmlFor="format" className="text-sm font-medium text-foreground">
            Audio Format
          </Label>
          <Select
            value={settings.format}
            onValueChange={(value: any) => onSettingsChange({ ...settings, format: value })}
          >
            <SelectTrigger id="format" className="bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="mp3">MP3 (Recommended)</SelectItem>
              <SelectItem value="flac">FLAC (Lossless)</SelectItem>
              <SelectItem value="ogg">OGG Vorbis</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Quality */}
        <div className="space-y-2">
          <Label htmlFor="quality" className="text-sm font-medium text-foreground">
            Audio Quality
          </Label>
          <Select
            value={settings.quality}
            onValueChange={(value: any) => onSettingsChange({ ...settings, quality: value })}
          >
            <SelectTrigger id="quality" className="bg-secondary border-border">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="128k">128 kbps (Good)</SelectItem>
              <SelectItem value="192k">192 kbps (Better)</SelectItem>
              <SelectItem value="256k">256 kbps (High)</SelectItem>
              <SelectItem value="320k">320 kbps (Best)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Threads */}
        <div className="space-y-2">
          <Label htmlFor="threads" className="text-sm font-medium text-foreground">
            Download Threads: {settings.threads}
          </Label>
          <Slider
            id="threads"
            min={1}
            max={16}
            step={1}
            value={[settings.threads]}
            onValueChange={([value]) => onSettingsChange({ ...settings, threads: value })}
            className="mt-2"
          />
          <p className="text-xs text-muted-foreground">
            Higher threads = faster downloads (uses more resources)
          </p>
        </div>
      </div>
    </div>
  );
};
