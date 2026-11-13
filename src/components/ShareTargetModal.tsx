import React, { useState } from 'react';
import { Share2, Download, Smartphone, CheckCircle, ExternalLink, MessageSquare, Sparkles, X, Copy, ArrowRight } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';
import { copyToClipboard } from '../lib/utils';

interface ShareTargetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onTestShare: (sampleText: string) => void;
  theme?: string;
}

export const ShareTargetModal: React.FC<ShareTargetModalProps> = ({
  isOpen,
  onClose,
  onTestShare,
  theme = 'dark',
}) => {
  const { isInstallable, isInstalled, isIOS, isAndroid, install } = usePWAInstall();
  const [testText, setTestText] = useState(
    `🚨 *Breaking Intelligence Update - Digital Bharat*\n` +
    `Government announces new multi-lingual data integration initiative across 23 regional territories.\n\n` +
    `Key Points:\n` +
    `• Instant cross-script translations\n` +
    `• Direct support for local vernacular content\n` +
    `• High-performance offline sync engine\n\n` +
    `Forwarded as received via WhatsApp.`
  );
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const isDark = theme === 'dark';

  const handleCopyLink = () => {
    copyToClipboard(window.location.origin);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className={`w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-2xl border shadow-2xl p-6 ${
          isDark 
            ? 'bg-[#0f172a] border-slate-700 text-slate-100' 
            : 'bg-white border-slate-200 text-slate-800'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-500 to-emerald-400 flex items-center justify-center shadow-lg shadow-indigo-500/20 text-white">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold flex items-center gap-2">
                WhatsApp & System Share Setup
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Web Share Target
                </span>
              </h2>
              <p className="text-xs text-slate-400">
                Appear alongside Grok, DeepSeek, and other apps in the Android Share drawer
              </p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Status / Install callout */}
        <div className="mt-5 space-y-4">
          {isInstalled ? (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-300">
                  App Installed & Registered in OS Share Sheet!
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Bharat Agent is installed on your device. Android and Chromium have registered this app as a system share receiver. Whenever you select text in WhatsApp and tap Share, Bharat Agent appears in the suggestions.
                </p>
              </div>
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex flex-col gap-3">
              <div className="flex items-start gap-3">
                <Smartphone className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-indigo-300">
                    Step 1: Install App to Phone / Chrome
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Android OS <span className="font-semibold text-slate-200">only exposes installed apps</span> in WhatsApp's share sheet (this is why native apps like Grok and DeepSeek appear). Installing this web app registers it directly into Android's native share drawer!
                  </p>
                </div>
              </div>

              {isInstallable ? (
                <button
                  onClick={async () => {
                    await install();
                  }}
                  className="flex items-center justify-center gap-2 w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white font-medium text-sm shadow-lg shadow-indigo-600/30 transition active:scale-[0.98]"
                >
                  <Download className="w-4 h-4" />
                  Install Bharat Agent to Phone (1-Tap)
                </button>
              ) : isIOS ? (
                <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300">
                  <span className="font-semibold text-indigo-400">On iPhone / iPad:</span> Tap Safari's <strong>Share</strong> button (box with up arrow), scroll down, and tap <strong>Add to Home Screen</strong>.
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-slate-800/60 border border-slate-700/60 text-xs text-slate-300 space-y-1">
                  <p className="font-semibold text-indigo-400">To Install on Android:</p>
                  <p>1. Open this page in <strong>Google Chrome</strong> or <strong>Edge</strong>.</p>
                  <p>2. Tap the <strong>⋮ (three dots menu)</strong> at the top right of Chrome.</p>
                  <p>3. Tap <strong>Install app</strong> or <strong>Add to Home screen</strong>.</p>
                </div>
              )}
            </div>
          )}

          {/* How WhatsApp sharing works */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5 text-emerald-400" />
              How To Share From WhatsApp:
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/40">
                <span className="inline-block w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-center leading-5 mb-1.5">1</span>
                <p className="font-medium text-slate-200">Select in WhatsApp</p>
                <p className="text-slate-400 mt-0.5">Highlight text or long-press any message in a WhatsApp chat.</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/40">
                <span className="inline-block w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-center leading-5 mb-1.5">2</span>
                <p className="font-medium text-slate-200">Tap Share</p>
                <p className="text-slate-400 mt-0.5">Tap <strong>Share</strong> in the WhatsApp popup menu.</p>
              </div>

              <div className="p-3 rounded-lg bg-slate-800/80 border border-slate-700/40">
                <span className="inline-block w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-300 font-bold text-center leading-5 mb-1.5">3</span>
                <p className="font-medium text-slate-200">Pick Bharat Agent</p>
                <p className="text-slate-400 mt-0.5">Select <strong>Bharat Agent</strong> alongside Grok / DeepSeek!</p>
              </div>
            </div>
          </div>

          {/* Test WhatsApp share simulation */}
          <div className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                Simulate WhatsApp Share Intake
              </h3>
              <span className="text-[11px] text-slate-400">Test receiver live</span>
            </div>

            <textarea
              value={testText}
              onChange={(e) => setTestText(e.target.value)}
              rows={4}
              className="w-full text-xs p-3 rounded-lg bg-slate-900 border border-slate-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none text-slate-200 font-mono resize-none"
              placeholder="Paste or type WhatsApp message to simulate sharing..."
            />

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={handleCopyLink}
                className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 transition"
              >
                <Copy className="w-3.5 h-3.5" />
                {copiedLink ? 'Link copied!' : 'Copy App Link'}
              </button>

              <button
                onClick={() => {
                  onTestShare(testText);
                  onClose();
                }}
                className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow transition"
              >
                Test Intake Now
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition"
          >
            Got it, Close
          </button>
        </div>
      </div>
    </div>
  );
};
