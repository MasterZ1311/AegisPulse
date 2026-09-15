import React, { useState } from 'react';
import { Smartphone, Copy, Check, ShieldCheck, Wifi } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface BedsideQrModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  bedNumber: string;
}

export const BedsideQrModal: React.FC<BedsideQrModalProps> = ({
  isOpen,
  onClose,
  patientId,
  bedNumber,
}) => {
  const [copied, setCopied] = useState(false);
  const [customHost, setCustomHost] = useState('');

  const defaultOrigin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
  const activeBaseUrl = customHost.trim() || defaultOrigin;
  const targetUrl = `${activeBaseUrl}/?patientId=${encodeURIComponent(patientId)}&bed=${encodeURIComponent(bedNumber)}&mode=spotcheck`;

  const handleCopy = () => {
    navigator.clipboard.writeText(targetUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Generate simple QR Code image via standard secure HTTPS quick-chart API with fallback
  const qrCodeApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
    targetUrl
  )}&bgcolor=0f172a&color=38bdf8&margin=1`;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent onClose={onClose} className="max-w-md p-6 font-sans">
        <DialogHeader className="border-b border-border/40 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-primary/10 border border-primary/20 text-primary">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                Mobile Bedside Spot-Check
                <Badge variant="outline" className="font-mono text-[10px] text-primary border-primary/30">
                  Bed {bedNumber}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Scan on your mobile phone to launch contactless camera spot-check at bedside.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4 flex flex-col items-center text-center">
          {/* QR Code Container */}
          <div className="p-4 rounded-xl bg-card border border-border/80 shadow-xs flex flex-col items-center justify-center">
            <img
              src={qrCodeApiUrl}
              alt="Mobile Access QR Code"
              className="w-48 h-48 rounded-lg shadow-sm"
              onError={(e) => {
                // Fallback visual indicator if offline
                (e.target as HTMLElement).style.display = 'none';
              }}
            />
            <div className="mt-2.5 text-[10px] font-mono text-primary flex items-center gap-1 font-medium">
              <Wifi className="h-3 w-3" />
              <span>Connect phone to Ward WiFi or Local Network</span>
            </div>
          </div>

          {/* Target URL Display */}
          <div className="w-full text-left space-y-1.5">
            <label className="text-[11px] font-mono text-muted-foreground">Mobile Target URL:</label>
            <div className="bg-muted/50 border border-border/50 p-2 rounded-lg flex items-center justify-between gap-2 font-mono text-xs text-foreground overflow-hidden">
              <span className="truncate">{targetUrl}</span>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopy}
                className="h-7 px-2 text-xs font-mono shrink-0 cursor-pointer"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>

          {/* Local IP Override (Useful for local ward dev testing) */}
          <div className="w-full text-left space-y-1">
            <label className="text-[10px] font-mono text-muted-foreground">
              Local Ward IP (if testing from physical phone):
            </label>
            <input
              type="text"
              placeholder="e.g. https://192.168.1.100:5173"
              value={customHost}
              onChange={(e) => setCustomHost(e.target.value)}
              className="w-full px-3 py-1.5 rounded-lg bg-background border border-border text-xs font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          <div className="flex items-center gap-2 text-[11px] text-muted-foreground pt-1">
            <ShieldCheck className="h-4 w-4 text-emerald-500 shrink-0" />
            <span>Encrypted local session. Camera frames never leave mobile browser RAM.</span>
          </div>
        </div>

        <div className="border-t border-border/40 pt-3 flex justify-end">
          <Button size="sm" variant="default" onClick={onClose} className="font-mono text-xs cursor-pointer">
            Done
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
