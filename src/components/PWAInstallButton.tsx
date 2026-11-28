import React, { useState } from 'react';
import { Download, Share, Smartphone, WifiOff } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { useOnlineStatus } from '../hooks/useOnlineStatus';
import { Button } from './ui/button';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from './ui/drawer';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={install}
        className="h-8 gap-1.5 border-blue-500/40 bg-blue-600/10 text-blue-700 hover:bg-blue-600 hover:text-white dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300 dark:hover:bg-blue-600 dark:hover:text-white"
      >
        <Download className="h-3.5 w-3.5" />
        <span className={compact ? 'hidden sm:inline' : ''}>Install App</span>
      </Button>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setShowGuide(true)}
        className="h-8 gap-1.5 text-slate-700 dark:text-slate-200"
      >
        <Download className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        <span className={compact ? 'hidden sm:inline' : ''}>
          {isIOS ? 'Install on iOS' : 'Get App'}
        </span>
      </Button>

      <Drawer open={showGuide} onOpenChange={setShowGuide}>
        <DrawerContent>
          <div className="mx-auto w-full max-w-md">
            <DrawerHeader>
              <DrawerTitle className="flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                {isIOS ? 'Install Toolivo on iPhone / iPad' : 'Install Toolivo Web App'}
              </DrawerTitle>
              <DrawerDescription>
                Run all 43 PDF, image, video, and audio utilities in a standalone window with offline caching.
              </DrawerDescription>
            </DrawerHeader>

            <div className="space-y-3 px-5 py-2 text-xs leading-relaxed text-slate-600 dark:text-slate-300">
              {isIOS ? (
                <ol className="list-decimal space-y-2 pl-4">
                  <li>
                    Tap the <strong className="inline-flex items-center gap-1 text-slate-950 dark:text-white"><Share className="h-3 w-3" /> Share</strong> button in Safari&apos;s toolbar.
                  </li>
                  <li>
                    Scroll down and tap <strong className="text-slate-950 dark:text-white">Add to Home Screen</strong>.
                  </li>
                  <li>
                    Tap <strong className="text-slate-950 dark:text-white">Add</strong> to launch Toolivo full-screen offline.
                  </li>
                </ol>
              ) : (
                <ol className="list-decimal space-y-2 pl-4">
                  <li>
                    Click the <strong className="text-slate-950 dark:text-white">Install</strong> icon in your browser&apos;s address bar (Chrome, Edge, or Brave).
                  </li>
                  <li>
                    Or open the browser menu (<strong className="text-slate-950 dark:text-white">⋮</strong>) and choose <strong className="text-slate-950 dark:text-white">Install Toolivo</strong>.
                  </li>
                  <li>
                    Once installed, Toolivo caches its core bundle locally so tools launch instantaneously offline.
                  </li>
                </ol>
              )}
            </div>

            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="contrast" className="w-full">
                  Got it
                </Button>
              </DrawerClose>
            </DrawerFooter>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
};

export const OfflineIndicator: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-500/60 bg-amber-500 px-3.5 py-2 text-xs font-bold text-slate-950 shadow-lg"
    >
      <WifiOff className="h-3.5 w-3.5 shrink-0" />
      <span>Offline Mode — Local browser tools remain ready</span>
    </div>
  );
};
