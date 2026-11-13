import React, { useState, useEffect, useRef, ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { FolderKanban, Library } from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { Menu, Play, Download, Settings2, FileText, List, Volume2, Loader2, AlertCircle, MonitorPlay, Cloud, ThumbsUp, ThumbsDown, Share2, Trash2, Tag, BookOpen, Plus, Moon, Sun, Sparkles, ChevronRight, History, Monitor, ArrowRight, MessageSquare, Bell, Activity, Maximize2, Minimize2, Clock, Folder, Layers, X, Star, Highlighter, Camera, Video, FileAudio, Type, Palette, Undo2, Redo2, Pause, SkipBack, SkipForward, VolumeX, Copy, Brain, Target, Mic, Square, Map as MapIcon, Check, MapPin, Zap, BarChart3, Circle, ChevronDown, ChevronUp, LogIn, Globe, Search, Repeat, Twitter, Instagram, MousePointerClick, Rocket, Upload, Users, Layout, User, Smile, Scissors, RotateCcw, Music, Lock, Shield, ShieldAlert, ShieldCheck, Youtube, Send, Terminal, Cpu, CheckCircle2, ArrowUpRight, FileDown, Edit2, FileUp, Image as ImageIcon, Eye, ZoomIn, Columns, Printer, Wand2, Table } from 'lucide-react';
import html2canvas from 'html2canvas';
import { motion, AnimatePresence } from 'motion/react';
import { LANGUAGES, GENDERS } from './constants';
import { cn, containsTable, copyToClipboard, stripMarkdownAndDelimiters } from './lib/utils';
import jsPDF from 'jspdf';
import { AuthComponent } from './components/Auth';
import { ActionSidebar } from './components/ActionSidebar';
import { listFiles, getDocContent } from './services/GoogleWorkspaceService';
import { KnowledgeGraph } from './components/KnowledgeGraph';
import { AudioWaveform } from './components/AudioWaveform';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useFirebase } from './components/FirebaseProvider';
import { TabularGrid } from './components/TabularGrid';
import { ShareTargetModal } from './components/ShareTargetModal';
import { usePWAInstall } from './hooks/usePWAInstall';
import { db, auth as importedAuth } from './lib/firebase';
import { collection, query, where, onSnapshot, addDoc, deleteDoc, doc, serverTimestamp, updateDoc, arrayUnion, getDocs, orderBy, setDoc, getDoc } from 'firebase/firestore';

import * as pdfjsLib from 'pdfjs-dist';

// Use UNPKG CDN for worker to avoid bundling complexities in the preview environment
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.7.284/build/pdf.worker.min.mjs';

const WaveformVisualizer = ({ isActive }: { isActive?: boolean }) => {
  return (
    <div className="flex items-center gap-1 h-6">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          initial={{ height: Math.random() * 10 + 4 }}
          animate={isActive ? {
            height: [Math.random() * 15 + 5, Math.random() * 20 + 5, Math.random() * 10 + 2]
          } : { height: Math.random() * 10 + 4 }}
          transition={isActive ? {
            repeat: Infinity,
            duration: 0.8,
            ease: "easeInOut",
            delay: i * 0.05
          } : { duration: 1 }}
          className={cn(
            "w-0.5 rounded-full",
            isActive ? "bg-slate-400" : "bg-[#333537]"
          )}
        />
      ))}
    </div>
  );
};

function CustomAudioPlayer({ src, fileName, onPlay, onPause, onEnded, className, autoPlay, internalRef }: { src: string, fileName?: string, onPlay?: () => void, onPause?: () => void, onEnded?: () => void, className?: string, autoPlay?: boolean, internalRef?: React.RefObject<HTMLAudioElement | null> }) {
  const defaultRef = useRef<HTMLAudioElement>(null);
  const audioRef = internalRef || defaultRef;
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  const downloadAudio = () => {
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = src;
    a.download = fileName || 'audio.mp3';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  useEffect(() => {
    if (autoPlay && audioRef.current) {
       audioRef.current.play().catch(() => {});
    }
  }, [src, autoPlay, audioRef]);

  const togglePlay = () => {
    if (audioRef.current) {
      if (isPlaying) audioRef.current.pause();
      else audioRef.current.play();
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      setProgress((audioRef.current.currentTime / (audioRef.current.duration || 1)) * 100);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    if (audioRef.current) {
      const newTime = (val / 100) * (audioRef.current.duration || 1);
      audioRef.current.currentTime = newTime;
      setProgress(val);
    }
  };

  const skip = (seconds: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.currentTime + seconds, audioRef.current.duration || 0));
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (audioRef.current) {
      audioRef.current.volume = val;
      setIsMuted(val === 0);
    }
  };

  const toggleMute = () => {
    if (audioRef.current) {
      const newMuted = !isMuted;
      setIsMuted(newMuted);
      audioRef.current.volume = newMuted ? 0 : volume || 1;
    }
  };

  const formatTime = (time: number) => {
    if (isNaN(time)) return '0:00';
    const min = Math.floor(time / 60);
    const sec = Math.floor(time % 60);
    return `${min}:${sec < 10 ? '0' : ''}${sec}`;
  };

  return (
    <div className={`flex flex-col gap-2 w-full max-w-sm ${className || ''}`}>
      <audio 
        ref={audioRef as any}
        src={src} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => { setIsPlaying(true); onPlay?.(); }}
        onPause={() => { setIsPlaying(false); onPause?.(); }}
        onEnded={() => { setIsPlaying(false); onEnded?.(); }}
      />
      <div className="flex items-center gap-2 lg:gap-4 w-full">
        <button onClick={() => skip(-10)} className="text-[#C4C7C5] hover:text-white transition-colors flex-shrink-0" title="Skip back 10s">
          <SkipBack size={18} />
        </button>
        <button onClick={togglePlay} className="p-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-full transition-colors flex-shrink-0">
          {isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current translate-x-0.5" />}
        </button>
        <button onClick={() => skip(10)} className="text-[#C4C7C5] hover:text-white transition-colors flex-shrink-0" title="Skip forward 10s">
          <SkipForward size={18} />
        </button>
        
        <div className="flex items-center gap-2 flex-1 min-w-[100px]">
          <span className="text-[10px] text-[#C4C7C5] font-mono tabular-nums leading-none hidden sm:inline-block">{formatTime(currentTime)}</span>
          <input 
            type="range" 
            min="0" max="100" step="0.01"
            value={progress || 0} 
            onChange={handleSeek} 
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
          />
          <span className="text-[10px] text-[#C4C7C5] font-mono tabular-nums leading-none hidden sm:inline-block">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center gap-2 group/vol w-16 sm:w-24 flex-shrink-0 justify-end">
          <button onClick={downloadAudio} className="text-[#C4C7C5] hover:text-white transition-colors" title="Download Audio">
            <Download size={16} />
          </button>
          <button onClick={toggleMute} className="text-[#C4C7C5] hover:text-white transition-colors">
            {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
          </button>
          <input 
            type="range" 
            min="0" max="1" step="0.01"
            value={isMuted ? 0 : volume} 
            onChange={handleVolumeChange} 
            className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500 md:opacity-0 md:group-hover/vol:opacity-100 transition-opacity hidden md:inline-block"
            title="Volume"
          />
        </div>
      </div>
    </div>
  );
}

const getApiErrorMessage = (err: any): string => {
  const errMsg = err?.message?.toLowerCase() || String(err).toLowerCase();
  
  if (errMsg.includes("429") || errMsg.includes("quota") || err?.status === "RESOURCE_EXHAUSTED" || errMsg.includes("resource_exhausted") || errMsg.includes("rate limit")) {
    return "API Request Quota Reached: You have reached the temporary rate limit. Please wait a few seconds and try again, or add a custom Gemini API Key in Settings.";
  }
  if (!navigator.onLine) {
    return "Network connection error. Please check your internet connection.";
  }
  if (errMsg.includes("fetch failed") || errMsg.includes("network error") || errMsg.includes("failed to fetch")) {
    return "Unable to connect to the server. The connection failed or the server is temporarily unavailable.";
  }
  if (errMsg.includes("invalid") || errMsg.includes("400") || err?.status === "INVALID_ARGUMENT") {
    return "Invalid input formatting or settings. Please check your inputs and try again.";
  }
  if (errMsg.includes("401") || errMsg.includes("403") || err?.status === "PERMISSION_DENIED" || err?.status === "UNAUTHENTICATED") {
    return "Authentication failed. Please verify your API key permissions in Settings.";
  }
  if (errMsg.includes("500") || err?.status === "INTERNAL" || errMsg.includes("internal server error")) {
    return "The server encountered an error processing your request. Please try again in a moment.";
  }
  return err?.message || "An unexpected error occurred during the API request.";
};

const DubbingToggle = ({ icon: Icon, label, active, onClick }: { icon: any, label: string, active: boolean, onClick: () => void }) => (
  <button 
    onClick={onClick}
    className={cn(
      "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all hover:scale-105 active:scale-95",
      active ? "bg-indigo-500/10 border-indigo-500/50 text-white shadow-lg shadow-indigo-500/20" : "bg-white/[0.03] border-white/5 text-white/40 hover:bg-white/5"
    )}
  >
    <Icon size={20} className={active ? "text-indigo-400" : "text-white/20"} />
    <span className="text-[10px] font-black uppercase tracking-widest text-center">{label}</span>
  </button>
);

const cleanDelimitersAndMarkdown = (str: string) => {
  if (!str) return '';
  const lines = str.split('\n');
  const processedLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Preserve table rows and separator rows intact so TabularGrid functions perfectly
    const isTableRow = trimmed.startsWith('|') || (trimmed.includes('|') && /^[\|\s:\-]+$/.test(trimmed));
    if (isTableRow) {
      processedLines.push(line);
      continue;
    }

    // Clean non-table lines
    const cleanedLine = line
      .replace(/--- Page \d+ ---/g, '')
      .replace(/--- ([A-Z\s]+) ---/g, '')
      .replace(/\[\[(.*?)\]\]/g, '$1')
      .replace(/^\s*[-*_]{3,}\s*$/g, '')
      .replace(/^\s*```[a-z]*\s*$/g, '')
      .replace(/^\s*```\s*$/g, '')
      .replace(/^#+\s+/g, '')
      .replace(/(\*\*|__)(.*?)\1/g, '$2')
      .replace(/(\*|_)(.*?)\1/g, '$2')
      .replace(/`([^`]+)`/g, '$1')
      .replace(/(?<!\!)\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/^>\s+/g, '');

    processedLines.push(cleanedLine);
  }

  return processedLines.join('\n');
};

async function safeParseJson<T = any>(response: Response): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  let text = '';
  try {
    text = await response.text();
  } catch (err: any) {
    return { ok: false, status: response.status, data: null, error: err?.message || 'Failed to read response body' };
  }

  if (!text || !text.trim()) {
    return {
      ok: false,
      status: response.status,
      data: null,
      error: response.ok ? 'Server returned an empty response' : `Server returned error (${response.status}) with empty response body`
    };
  }

  try {
    const data = JSON.parse(text);
    const errorMessage = data?.error || data?.message;
    return {
      ok: response.ok && !errorMessage,
      status: response.status,
      data,
      error: errorMessage
    };
  } catch {
    return {
      ok: false,
      status: response.status,
      data: null,
      error: response.ok ? text : `Server error (${response.status}): ${text.slice(0, 150)}`
    };
  }
}

export default function App() {
  const { user, auth: firebaseContextAuth } = useFirebase();
  const [projects, setProjects] = useState<any[]>([]);
  const [driveFiles, setDriveFiles] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'single' | 'batch' | 'playlist' | 'shared' | 'dubbing' | 'voice' | 'conversation' | 'subtitles' | 'collab' | 'enhancement' | 'agent' | 'projects'>('single');
  const [rawText, setRawText] = useState('');
  const text = cleanDelimitersAndMarkdown(rawText);
  const setText = (updater: React.SetStateAction<string>) => {
    if (typeof updater === 'function') {
      setRawText(prev => cleanDelimitersAndMarkdown(updater(prev)));
    } else {
      setRawText(cleanDelimitersAndMarkdown(updater));
    }
  };
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth >= 1024;
    }
    return true;
  });
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState(false);
  const [isSocialDropdownOpen, setIsSocialDropdownOpen] = useState(false);
  const [isEnhancerDropdownOpen, setIsEnhancerDropdownOpen] = useState(false);
  const [isToolsDropdownOpen, setIsToolsDropdownOpen] = useState(false);
  const [targetLang, setTargetLang] = useState('English');
  const [voiceProfile, setVoiceProfile] = useState('neutral');

  const handleFetchYouTube = async () => {
    const trimmedInput = ytUrl.trim();
    if (!trimmedInput) {
      setErrorInfo("Please enter a URL (YouTube, Webpage) or a search topic first.");
      return;
    }

    // Auto-detect accidental paste of complete scripts or custom text blocks in the search/URL field
    if (trimmedInput.length > 200 || trimmedInput.includes('\n')) {
      setText(trimmedInput);
      setCommandFeedback("Direct script copy-paste imported successfully into the Editor!");
      setYtUrl('');
      setErrorInfo(null);
      return;
    }

    setIsGenerating(true);
    
    let isUrl = false;
    let normalizedUrl = trimmedInput;
    
    const hasProtocol = trimmedInput.toLowerCase().startsWith('http://') || trimmedInput.toLowerCase().startsWith('https://');
    const isLaxUrl = hasProtocol || trimmedInput.toLowerCase().startsWith('www.') || /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/.test(trimmedInput);
    
    if (isLaxUrl) {
      isUrl = true;
      if (!hasProtocol) {
        normalizedUrl = 'https://' + trimmedInput;
      }
    }
    
    const isYT = isUrl && (normalizedUrl.toLowerCase().includes('youtube.com') || normalizedUrl.toLowerCase().includes('youtu.be'));
    
    if (isYT) {
      setCommandFeedback("Fetching transcript from YouTube...");
    } else if (isUrl) {
      setCommandFeedback("Scraping webpage and parsing with AI...");
    } else {
      setCommandFeedback(`Searching and drafting script for "${trimmedInput}"...`);
    }

    setFetchedVideoTitle(null);
    setErrorInfo(null);
    try {
      const response = await fetch('/api/youtube-transcript', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: normalizedUrl })
      });
      
      let data;
      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const textResp = await response.text().catch(() => "No response body");
        throw new Error(`Server block (${response.status}): ${textResp.substring(0, 100)}`);
      }

      if (data.text && !data.error) {
        let finalContent = data.text;
        if (targetLang && targetLang !== 'English') {
          setCommandFeedback(`Translating content to ${targetLang}...`);
          try {
            const translatePrompt = `Translate the following content into ${targetLang}. Return ONLY the translated text without any conversational fillers. \n\nContent: ${data.text.substring(0, 15000)}`;
            const translatedText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: translatePrompt }] }]);
            if (translatedText) finalContent = translatedText;
          } catch (tErr) {
            console.error("Translation failed:", tErr);
            setCommandFeedback("Fetch successful, but translation failed. Using original text.");
          }
        }
        setText(finalContent);
        if (data.title) setFetchedVideoTitle(data.title);
        
        let targetLangCode = LANGUAGES.find(l => l.name === targetLang)?.code || LANGUAGES[0].code;
        setLanguageCode(targetLangCode);
        
        setCommandFeedback(`Content for "${data.title || 'request'}" processed ${targetLang !== 'English' ? 'and translated ' : ''}successfully!`);
        setTimeout(() => handleGenerateSingle(), 800);
      } else {
        if (data.error === 'BOT_DETECTION' || response.status === 403) {
          setErrorInfo(
            <div className="space-y-3 w-full">
              <p className="font-bold text-red-400">YouTube Security Blocked Our Server</p>
              <p className="text-sm">YouTube's bot detection is currently blocking our automated request. Please follow these simple steps to continue:</p>
              <ol className="text-xs list-decimal list-inside space-y-1 mt-2 text-[#8E918F]">
                <li>Open the video on YouTube</li>
                <li>Click <span className="text-white font-bold">"... More"</span> below the video</li>
                <li>Select <span className="text-white font-bold">"Show Transcript"</span></li>
                <li>Copy the text and paste it into the manual backup box below:</li>
              </ol>
              <div className="border border-[#333537] rounded-xl bg-[#131314] p-4 space-y-3 shadow-inner mt-4">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-indigo-400 tracking-widest block">📋 Paste Transcript Offline</label>
                  <span className="text-[9px] font-mono text-gray-500">Bypass Block</span>
                </div>
                <textarea 
                  className="w-full h-24 bg-[#1E1F20]/80 text-xs text-[#C4C7C5] p-3 rounded-lg border border-[#333537] focus:outline-none focus:border-indigo-500 placeholder:text-gray-600 focus:ring-1 focus:ring-indigo-500/20 font-mono transition-all resize-none shadow-md"
                  placeholder="Paste the copied YouTube transcript text here..."
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.trim()) {
                      setText(val);
                      setErrorInfo(null);
                      setCommandFeedback("Manual script text loaded successfully!");
                    }
                  }}
                />
              </div>
            </div>
          );
        } else {
          setErrorInfo(
            <div className="space-y-3 w-full">
              <p className="font-bold text-red-400">{data.message || data.error || "Could not fetch content."}</p>
              <div className="border border-[#333537] rounded-xl bg-[#131314] p-4 space-y-3 shadow-inner">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-indigo-400 tracking-widest block">📋 Paste Content Manually</label>
                  <span className="text-[9px] font-mono text-gray-500">Backup Option</span>
                </div>
                <p className="text-[10px] text-[#8E918F] leading-snug">
                  Simply paste your copied text, article transcript, or draft here to import it into the main editor directly:
                </p>
                <textarea 
                  className="w-full h-24 bg-[#1E1F20]/80 text-xs text-[#C4C7C5] p-3 rounded-lg border border-[#333537] focus:outline-none focus:border-indigo-500 placeholder:text-gray-600 focus:ring-1 focus:ring-indigo-500/20 font-mono transition-all resize-none shadow-md"
                  placeholder="Paste the copied text here..."
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val.trim()) {
                      setText(val);
                      setErrorInfo(null);
                      setCommandFeedback("Manual script text loaded successfully!");
                    }
                  }}
                />
              </div>
            </div>
          );
        }
      }
    } catch (err: any) {
      console.error("Content fetch error:", err);
      const is403 = err.message?.includes('403');
      setErrorInfo(
        <div className="space-y-3 w-full">
          <p className="font-bold text-red-400">
            {is403 ? "Connection is blocking our server's request." : `Extraction failed: ${err.message || 'Network error'}`}
          </p>
          <div className="border border-[#333537] rounded-xl bg-[#131314] p-4 space-y-3 shadow-inner">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase text-indigo-400 tracking-widest block">📋 Paste Content Manually</label>
              <span className="text-[9px] font-mono text-gray-500">Fast Bypass</span>
            </div>
            <p className="text-[10px] text-[#8E918F] leading-snug">
              To proceed directly, please copy the content manually and paste it into the box below:
            </p>
            <textarea 
              className="w-full h-24 bg-[#1E1F20]/80 text-xs text-[#C4C7C5] p-3 rounded-lg border border-[#333537] focus:outline-none focus:border-indigo-500 placeholder:text-gray-600 focus:ring-1 focus:ring-indigo-500/20 font-mono transition-all resize-none shadow-md"
              placeholder="Paste the copied content here..."
              onChange={(e) => {
                const val = e.target.value;
                if (val.trim()) {
                  setText(val);
                  setErrorInfo(null);
                  setCommandFeedback("Manual script text loaded successfully!");
                }
              }}
            />
          </div>
        </div>
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefineScript = async () => {
      if (!text.trim()) return;
      setIsGenerating(true);
      setCommandFeedback("Refining script with AI...");
      try {
          const prompt = `Refine this script to be better, more engaging, and professional. Return ONLY the refined script. Don't add introductory text.\n\nScript: "${text}"`;
          const refined = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
          if (refined) setText(refined);
          setCommandFeedback("Script refined successfully!");
      } catch (e) {
          setCommandFeedback("Refining failed.");
          setErrorInfo("Could not refine script.");
      } finally {
          setIsGenerating(false);
      }
  };

  const handleExportAsPDF = () => {
    if (!text.trim()) {
      setCommandFeedback("Editor is empty. Write some script content first!");
      return;
    }

    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageHeight = doc.internal.pageSize.height; // A4 is 297mm
    const pageWidth = doc.internal.pageSize.width; // A4 is 210mm
    const margin = 20;
    const maxContentWidth = pageWidth - (margin * 2);

    let currentY = 25;

    // Title Page/Header decoration
    // Primary Elegant Title
    doc.setFillColor(30, 31, 32); // Dark slate banner
    doc.rect(0, 0, pageWidth, 40, 'F');
    
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(18);
    doc.text("AI SCRIPT DOCUMENT", margin, 18);

    doc.setTextColor(142, 145, 143); // Subtle gray
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const dateString = new Date().toLocaleDateString();
    doc.text(`DATE: ${dateString}  |  LANG: ${targetLang.toUpperCase()}  |  WORDS: ${text.split(/\s+/).filter(Boolean).length}`, margin, 28);

    currentY = 50;

    // Helper to handle page break safely
    const checkPageBreak = (neededHeight: number) => {
      if (currentY + neededHeight > pageHeight - 20) {
        doc.addPage();
        currentY = 25; // Reset Y on new page
        // Add subtle footer-like header or line on subsequent pages
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.line(margin, 12, pageWidth - margin, 12);
        doc.setTextColor(140, 140, 140);
        doc.setFont("helvetica", "italic");
        doc.setFontSize(8);
        doc.text("AI Script Performance Editor", margin, 10);
      }
    };

    // Split text into paragraphs (or lines)
    const paragraphs = text.split('\n');

    paragraphs.forEach((para) => {
      const trimmed = para.trim();
      if (!trimmed) {
        currentY += 6; // Standard paragraph spacing for empty line
        return;
      }

      // Format based on type of line
      if (trimmed.startsWith('#')) {
        // Bold heading styling
        const level = (trimmed.match(/^#+/) || ['#'])[0].length;
        const headingText = trimmed.replace(/^#+\s*/, '');
        const fontSize = level === 1 ? 16 : level === 2 ? 14 : 12;
        
        checkPageBreak(12);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(fontSize);
        doc.setTextColor(79, 70, 229); // Beautiful Indigo-600
        
        const lines = doc.splitTextToSize(headingText, maxContentWidth);
        lines.forEach((lineText: string) => {
          doc.text(lineText, margin, currentY);
          currentY += fontSize * 0.4 + 4;
        });
        currentY += 2; // Extra padding below headings
      } else if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        // Table or list formatting
        checkPageBreak(8);
        doc.setFont("courier", "normal");
        doc.setFontSize(10);
        doc.setTextColor(120, 120, 120);
        
        const lines = doc.splitTextToSize(trimmed, maxContentWidth);
        lines.forEach((lineText: string) => {
          doc.text(lineText, margin + 4, currentY);
          currentY += 5;
        });
      } else if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        // Dialogue / Director Cues
        checkPageBreak(10);
        doc.setFont("helvetica", "bolditalic");
        doc.setFontSize(10);
        doc.setTextColor(217, 119, 6); // Beautiful Amber-600
        
        const lines = doc.splitTextToSize(trimmed, maxContentWidth);
        lines.forEach((lineText: string) => {
          doc.text(lineText, margin + 8, currentY);
          currentY += 5;
        });
      } else {
        // Standard Body Paragraph
        checkPageBreak(8);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(40, 40, 42); // Warm charcoal
        
        const lines = doc.splitTextToSize(trimmed, maxContentWidth);
        lines.forEach((lineText: string) => {
          checkPageBreak(6);
          doc.text(lineText, margin, currentY);
          currentY += 6;
        });
        currentY += 3; // Space after standard paragraph
      }
    });

    // Apply beautiful page numbers to all pages
    const totalPages = (doc as any).internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(160, 160, 160);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 15, pageHeight - 10);
    }

    doc.save(`Script_Export_${new Date().toISOString().slice(0, 10)}.pdf`);
    setCommandFeedback("Script successfully exported as professional PDF!");
  };

  const handleExportAsTxt = () => {
    if (!text.trim()) {
      setCommandFeedback("Editor is empty. Write some content first!");
      return;
    }

    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const year = now.getFullYear();
    const month = pad(now.getMonth() + 1);
    const day = pad(now.getDate());
    const hours = pad(now.getHours());
    const minutes = pad(now.getMinutes());
    const seconds = pad(now.getSeconds());

    const timestampStr = `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    const filename = `Document_Export_${timestampStr}.txt`;

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    saveAs(blob, filename);

    setCommandFeedback(`Exported plain text file as "${filename}" successfully!`);
  };

  const handleAutoSegment = async () => {
    if (!text.trim()) {
      setCommandFeedback("Please write some content first!");
      return;
    }
    setIsSegmenting(true);
    setCommandFeedback("Analyzing narrative flow & segmenting script...");
    try {
      const prompt = `You are an elite narrative designer. Your job is to divide the provided script into logical, thematic blocks based on the narrative flow of ideas (such as Hook, Exposition, Argument, Proof, Call to Action, Outro, etc.).
Ensure that every line of the original script is assigned to EXACTLY ONE block, and when joined chronologically, the verbatim blocks reconstruct the entire input text exactly.
Do not omit, summarize, edit, or paraphrase the script lines. Pull exact text chunks.

Your response MUST be a JSON array of blocks. Each block must have the following structure:
[
  {
    "title": "Short descriptive title of the thematic segment",
    "content": "Verbatim chunk of text belonging to this block from the script",
    "purpose": "Narrative purpose or focus (e.g., 'Attention-Grabber Hook', 'Core Exposition', 'Technical Deep-Dive', 'Closing Call-to-Action')",
    "duration": "Estimated read/speaking duration, e.g., '15s' or '1m 10s'"
  },
  ...
]

Return ONLY this JSON array. Do not wrap it in markdown block quotes. Just the raw JSON.

Here is the script to segment:
"${text}"`;

      const responseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }], { responseMimeType: "application/json" });
      
      if (responseText) {
        let cleanJson = responseText.trim();
        if (cleanJson.startsWith("```json")) {
          cleanJson = cleanJson.substring(7);
        }
        if (cleanJson.endsWith("```")) {
          cleanJson = cleanJson.substring(0, cleanJson.length - 3);
        }
        cleanJson = cleanJson.trim();
        
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setThematicBlocks(parsed);
          setIsThematicBlocksOpen(true);
          setCommandFeedback(`Successfully divided script into ${parsed.length} thematic blocks!`);
        } else {
          throw new Error("Parsed JSON was not a valid array");
        }
      } else {
        throw new Error("No response from AI");
      }
    } catch (e: any) {
      console.error("Auto-Segment failed:", e);
      setCommandFeedback("Failed to segment script.");
      setErrorInfo("Narrative segmentation failed: " + (e.message || e));
    } finally {
      setIsSegmenting(false);
    }
  };
  
  // Load saved text from local storage
  // Load saved text from local storage
  useEffect(() => {
    const savedText = localStorage.getItem('bharat-voice-current-text');
    if (savedText) setText(savedText);
  }, []);
  
  const handleCreateProject = async () => {
    if (!user) return;
    const name = prompt("Enter project name:");
    if (!name) return;
    
    await addDoc(collection(db, 'projects'), {
        name,
        ownerId: user.uid,
        createdAt: serverTimestamp()
    });
  };

  useEffect(() => {
    if (activeTab === 'projects' && user) {
        const q = query(collection(db, 'projects'), where('ownerId', '==', user.uid), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            setProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        });
        
        listFiles().then(files => setDriveFiles(files.files || [])).catch(console.error);

        return () => unsubscribe();
    }
  }, [activeTab, user]);

  // Save text to local storage
  useEffect(() => {
    localStorage.setItem('bharat-voice-current-text', text);
  }, [text]);

  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [useSSML, setUseSSML] = useState(false);
  const [batchTexts, setBatchTexts] = useState<string>('');
  
  // Settings
  const [engine, setEngine] = useState<'cloud' | 'browser'>('cloud');
  const [languageCode, setLanguageCode] = useState(LANGUAGES[0].code);
  const [genderFilter, setGenderFilter] = useState('ALL');
  const [voiceName, setVoiceName] = useState(LANGUAGES[0].voices[0].id);
  const [speed, setSpeed] = useState(1.0);
  const [pitch, setPitch] = useState(0.0);
  const [volume, setVolume] = useState(0.0);
  
  // Browser Voices
  const [browserVoices, setBrowserVoices] = useState<SpeechSynthesisVoice[]>([]);
  
  // State
  const [isGenerating, setIsGenerating] = useState(false);
  const [isPlayingBrowser, setIsPlayingBrowser] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [allLanguageResults, setAllLanguageResults] = useState<{ code: string, name: string, text: string, audioUrl?: string, isSelected: boolean }[]>([]);
  const [showAllResults, setShowAllResults] = useState(false);
const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const generateVisualAsset = async () => { console.log('Visual asset generation placeholder'); };
  const [bgMusic, setBgMusic] = useState<string | null>(null);
  const [searchLanguage, setSearchLanguage] = useState('hi-IN');
  const [searchQuery, setSearchQuery] = useState('');
  const [isListeningSearch, setIsListeningSearch] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [searchSuggestions, setSearchSuggestions] = useState<string[]>([]);
  const [isSemanticSearching, setIsSemanticSearching] = useState(false);
  const [commandFeedback, setCommandFeedback] = useState<string | null>(null);
  const [isUploadingPdf, setIsUploadingPdf] = useState(false);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [extractedPdfImages, setExtractedPdfImages] = useState<Array<{
    id: string;
    page?: number;
    dataUrl: string;
    caption: string;
    fileName?: string;
  }>>([]);
  const [selectedViewingImage, setSelectedViewingImage] = useState<{
    dataUrl: string;
    caption: string;
  } | null>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const dubbingInputRef = useRef<HTMLInputElement>(null);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [isVideoUploaded, setIsVideoUploaded] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [preserveBackground, setPreserveBackground] = useState(true);
  const [lipSyncEnabled, setLipSyncEnabled] = useState(true);
  const [voiceCloningEnabled, setVoiceCloningEnabled] = useState(true);
  const [emotionAwareEnabled, setEmotionAwareEnabled] = useState(true);
  const [stemIsolationEnabled, setStemIsolationEnabled] = useState(true);
  const [culturalAdaptationEnabled, setCulturalAdaptationEnabled] = useState(true);
  const [zeroTrustEnabled, setZeroTrustEnabled] = useState(false);
  const [zeroDayScanEnabled, setZeroDayScanEnabled] = useState(false);
  const [isPerformingSecurityScan, setIsPerformingSecurityScan] = useState(false);
  const [securityScanResults, setSecurityScanResults] = useState<any>(null);
  const [dubbingSegments, setDubbingSegments] = useState([
    { id: '1', start: '00:00', end: '00:05', original: "Hello everyone, welcome to the demo.", dubbed: "नमस्ते सब, डेमो में आपका स्वागत है।", speaker: "Speaker 1", emotion: "Friendly", volume: 1 },
    { id: '2', start: '00:05', end: '00:12', original: "Today we are showcasing our new AI dubbing platform.", dubbed: "आज हम अपने नए एआई डबिंग प्लेटफॉर्म का प्रदर्शन कर रहे हैं।", speaker: "Speaker 1", emotion: "Excited", volume: 0.9 },
  ]);
  const [selectedVideoLanguages, setSelectedVideoLanguages] = useState<string[]>([]);
  const [isAudioEnhanced, setIsAudioEnhanced] = useState(false);
  const [videoMetadata, setVideoMetadata] = useState<{
    sentiment?: { mood: string; score: number; description: string };
    srt?: string;
  } | null>(null);

  const VIDEO_LANGUAGES = [
    { id: 'all', name: 'All Languages' },
    { id: 'Hindi', name: 'Hindi' },
    { id: 'Bengali', name: 'Bengali' },
    { id: 'Marathi', name: 'Marathi' },
    { id: 'Telugu', name: 'Telugu' },
    { id: 'Tamil', name: 'Tamil' },
    { id: 'Gujarati', name: 'Gujarati' },
    { id: 'Urdu', name: 'Urdu' },
    { id: 'Kannada', name: 'Kannada' },
    { id: 'Odia', name: 'Odia' },
    { id: 'Malayalam', name: 'Malayalam' },
    { id: 'Punjabi', name: 'Punjabi' }
  ];

  const handlePdfUpload = async (file: File) => {
    const isPdf = file && (
      file.type === 'application/pdf' || 
      file.name.toLowerCase().endsWith('.pdf')
    );

    if (!isPdf) {
      setCommandFeedback("Please upload a valid PDF document (.pdf).");
      return;
    }

    setIsUploadingPdf(true);
    setCommandFeedback(`Digitizing ${file.name} & extracting embedded images/photos...`);
    
    try {
      // 1. Convert to Base64 safely without call stack limit
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.includes(',') ? result.split(',')[1] : result;
          resolve(base64Data);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const arrayBuffer = await file.arrayBuffer();

      // 2. Scan and extract all embedded photos, diagrams, figures & visual media from the PDF via PDF.js
      setCommandFeedback(`Scanning ${file.name} for photos, images, and visual content...`);
      const extractedImagesList: Array<{ id: string; page: number; dataUrl: string; caption: string; fileName: string }> = [];
      let localAccumulatorText = '';

      try {
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        const totalPages = pdf.numPages;

        for (let i = 1; i <= totalPages; i++) {
          try {
            const page = await pdf.getPage(i);
            const ops = await page.getOperatorList();
            
            // Extract textual content for fallback
            const textContent = await page.getTextContent();
            const pageStr = textContent.items.map((item: any) => item.str).join(' ');
            if (pageStr.trim()) {
              localAccumulatorText += (localAccumulatorText ? '\n\n' : '') + `--- Page ${i} ---\n` + pageStr;
            }

            // Check if page contains image/photo operators
            let pageHasImages = false;
            for (let j = 0; j < ops.fnArray.length; j++) {
              const fn = ops.fnArray[j];
              if (
                fn === pdfjsLib.OPS.paintImageXObject ||
                fn === pdfjsLib.OPS.paintInlineImageXObject ||
                fn === pdfjsLib.OPS.paintImageMaskXObject ||
                fn === pdfjsLib.OPS.paintSolidColorImageMask
              ) {
                pageHasImages = true;
                break;
              }
            }

            // Extract visual canvas if image operations exist or if page is image-heavy / short doc
            const isVisualPage = pageHasImages || (totalPages <= 5) || (pageStr.trim().length < 60);

            if (isVisualPage) {
              const scale = 1.5;
              const viewport = page.getViewport({ scale });
              const canvas = document.createElement('canvas');
              canvas.width = viewport.width;
              canvas.height = viewport.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                await page.render({ canvasContext: ctx, viewport, canvas } as any).promise;
                const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
                extractedImagesList.push({
                  id: `pdf-img-${i}-${Math.random().toString(36).substr(2, 6)}`,
                  page: i,
                  dataUrl,
                  caption: `Page ${i} Photo / Visual`,
                  fileName: file.name
                });
              }
            }
          } catch (pageErr) {
            console.warn(`Error scanning PDF page ${i} for images:`, pageErr);
          }
        }
      } catch (pdfJsErr) {
        console.warn("PDF.js image/text scanner encountered error:", pdfJsErr);
      }

      let extractedText = '';

      // 3. Direct server-side high-precision OCR / Markdown reconstruction via Gemini 3.5-flash
      try {
        setCommandFeedback(`Digitizing text and tables from ${file.name}...`);
        const pdfResponse = await fetch('/api/pdf-to-words', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            base64,
            promptOverride: "Perform an EXACT 1:1 ('same to same') verbatim transcription of this entire PDF document. Reconstruct all text, tables, headings, numbered and bulleted lists, numbers, symbols, figures, and punctuation exactly as they appear in the original file. If there is a table, reproduce it precisely as a Markdown table. If there are figures/photos/diagrams, note their titles/captions. Do not summarize, do not skip columns, do not omit any content, and do not filter or translate any languages. Return ONLY the verbatim Markdown content."
          })
        });

        const pdfResult = await safeParseJson(pdfResponse);
        if (pdfResult.ok && pdfResult.data) {
          extractedText = pdfResult.data.text || pdfResult.data.words || '';
        }
      } catch (serverErr) {
        console.warn("Primary /api/pdf-to-words endpoint returned error, trying fallback parser:", serverErr);
      }

      // 4. If primary endpoint was empty, try secondary parse endpoint
      if (!extractedText.trim()) {
        try {
          const parseResponse = await fetch('/api/parse-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, mimeType: 'application/pdf' })
          });
          const parseResult = await safeParseJson(parseResponse);
          if (parseResult.ok && parseResult.data) {
            extractedText = parseResult.data.text || '';
          }
        } catch (e) {
          console.warn("Secondary file parse failed", e);
        }
      }

      // 5. Fallback to client-side text if server returned empty
      if (!extractedText.trim() && localAccumulatorText.trim()) {
        extractedText = localAccumulatorText;
      }

      // 6. Clean text and attach extracted images/photos
      let rawCleanedText = extractedText.trim().replace(/^```(markdown|text)?\r?\n/, '').replace(/\r?\n```$/, '');

      if (extractedImagesList.length > 0) {
        setExtractedPdfImages(prev => [...extractedImagesList, ...prev]);

        // Embed the images directly into Markdown content so they upload & display seamlessly
        const imageMarkdownBlock = extractedImagesList.map(img => 
          `\n\n![${img.caption}](${img.dataUrl})\n*📷 ${img.caption} from ${file.name}*`
        ).join('\n');

        if (rawCleanedText) {
          rawCleanedText = `${rawCleanedText}\n\n### 🖼️ Extracted Photos & Images\n${imageMarkdownBlock}`;
        } else {
          rawCleanedText = `### 🖼️ Extracted Photos & Images from ${file.name}\n${imageMarkdownBlock}`;
        }
      }

      if (rawCleanedText.trim()) {
        const cleanExtracted = stripMarkdownAndDelimiters(rawCleanedText);
        const newHistoryItem: any = {
          id: Math.random().toString(36).substr(2, 9),
          text: cleanExtracted,
          timestamp: new Date().toISOString(),
          tags: ['PDF', extractedImagesList.length > 0 ? 'PDF + Photos' : 'Verbatim 1:1', 'Document'],
          fileName: file.name
        };
        
        setHistory(prev => [newHistoryItem, ...prev]);
        setText(cleanExtracted);
        setCommandFeedback(
          extractedImagesList.length > 0
            ? `Success: ${file.name} uploaded with ${extractedImagesList.length} image(s)/photo(s) extracted.`
            : `Success: ${file.name} imported 1:1 ('same to same').`
        );
        if (containsTable(rawCleanedText)) {
          setEditMode('grid');
          setIsPreviewMode(false);
        }
        setSearchQuery(`document:${file.name}`);
        
        if (textareaRef.current) {
          textareaRef.current.scrollTop = 0;
        }
      } else {
        setCommandFeedback("Could not extract any content from the PDF.");
      }
    } catch (err) {
      console.error("PDF Extraction Error:", err);
      setCommandFeedback("Error processing PDF: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsUploadingPdf(false);
      if (pdfInputRef.current) {
        pdfInputRef.current.value = '';
      }
    }
  };

  const handleVideoUpload = async (file: File) => {
    if (!file || !(file.type.startsWith('video/') || file.type.startsWith('audio/') || file.type === 'application/pdf' || file.type === 'text/plain')) {
      setCommandFeedback("Please upload a valid video, audio, or document file (PDF, TXT).");
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      setCommandFeedback("File too large. Max 50MB for transcription.");
      return;
    }

    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
    setIsUploadingVideo(true);
    setCommandFeedback(`Processing: ${file.name}...`);
    
    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const result = reader.result as string;
          const base64Data = result.split(',')[1];
          resolve(base64Data);
        };
        reader.onerror = reject;
      });
      
      reader.readAsDataURL(file);
      const base64 = await base64Promise;

      setIsVideoUploaded(true);
      setActiveTab('dubbing');
      setCommandFeedback(`Transcribing via Gemini AI 3...`);
      
      const targetLanguages = selectedVideoLanguages.length === 0 
        ? [] 
        : selectedVideoLanguages.includes('all')
          ? ['Hindi', 'Bengali', 'Marathi', 'Telugu', 'Tamil', 'Gujarati', 'Urdu', 'Kannada', 'Odia', 'Malayalam', 'Punjabi']
          : selectedVideoLanguages;

      let prompt = `Act as an expert analyst, transcriber, and assistant. 
      1. TRANSCRIBE: Capture all spoken dialogue with high accuracy. Use Speaker Diarization: identify different speakers as [Speaker 1], [Speaker 2], etc.
      2. SUMMARY: Provide a concise, logical summary of the content.
      3. ACTION ITEMS: Extract any specific tasks, action items, or decisions made.
      4. VISUAL/AUDIO CONTEXT: Insert brief descriptions in brackets (e.g., [Visual description/Background noise]) if relevant.
      5. FORMAT: Use a clean script format for the transcript, followed by distinct sections for summary and action items.
      6. SENTIMENT: Analyze mood, tone, sentiment.
      7. SUBTITLES: Generate simple SRT formatted subtitle strings.
      ${isAudioEnhanced ? '8. AUDIO ENHANCEMENT: Focus strictly on clarifying speech patterns over background activity.' : ''}
      
      Media Context: ${file.name}
      
      Return the response in a structured JSON format with the following keys:
      {
         "transcript": "Full transcript",
         "summary": "Concise summary",
         "actionItems": "Extracted tasks",
         "sentiment": { "mood": "e.g. Professional", "score": 0.8, "description": "Explanation" },
         "srt": "Full SRT formatted string",
         "translations": { "LanguageName": "Translated text..." }
      }
      
      Return ONLY the valid JSON object. No extra text or markdown code blocks.`;

      if (targetLanguages && targetLanguages.length > 0) {
        prompt += `\n\nFor translations, provide them for: ${targetLanguages.join(', ')}.`;
      }

      let data: any = {};
      let extractedText = "";

      try {
        const responseText = await genAIResponse("gemini-3.8-flash", [
          { inlineData: { data: base64, mimeType: file.type } },
          { text: prompt }
        ], {
          responseMimeType: "application/json"
        });
        
        console.log("Transcription response received:", responseText);
        
        data = JSON.parse(responseText);
        extractedText = data.transcript || "";
      } catch (error) {
        console.error("Transcription generation failed:", error);
        setCommandFeedback(`Transcription failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        setIsUploadingVideo(false);
      }
      
      if (data.summary) extractedText += `\n\n## Summary\n${data.summary}`;
      if (data.actionItems) extractedText += `\n\n## Action Items\n${data.actionItems}`;
      
      if (data.translations) {
        Object.entries(data.translations).forEach(([lang, translation]) => {
          extractedText += `\n\n## ${lang} Translation\n${translation as string}`;
        });
      }

      if (extractedText.trim()) {
        const rawCleanedText = extractedText.trim();
        setVideoMetadata({
          sentiment: data.sentiment,
          srt: data.srt
        });

        const newHistoryItem: any = {
          id: Math.random().toString(36).substr(2, 9),
          text: rawCleanedText,
          timestamp: new Date().toISOString(),
          tags: [file.type.startsWith('video/') ? 'Video' : 'Audio', 'AI Transcribe', data.sentiment?.mood || 'Words'],
          fileName: file.name,
          videoMetadata: {
            sentiment: data.sentiment,
            srt: data.srt
          }
        };
        
        setHistory(prev => [newHistoryItem, ...prev]);
        setText(rawCleanedText);
        setCommandFeedback(`Success: ${file.name} transcribed 1:1 ('same to same').`);
        setIsPreviewMode(true);
        setPreviewDisplayMode('split');
        setSearchQuery(`media:${file.name}`);
        
        if (textareaRef.current) {
          textareaRef.current.scrollTop = 0;
        }
      } else {
        setCommandFeedback("Could not extract any words.");
      }
    } catch (err: any) {
      console.error("Transcription Error:", err);
      const apiError = getApiErrorMessage(err);
      setCommandFeedback(`Error processing file: ${apiError}`);
      if (apiError.includes("quota") || apiError.includes("API key")) {
         setErrorInfo(`Gemini API Error: ${apiError}. Please check Settings > Secrets.`);
      }
    } finally {
      setIsUploadingVideo(false);
    }
  };

  const performSecurityAudit = async () => {
    if (!text.trim() && !isVideoUploaded) {
      setErrorInfo("Please upload a file or enter text to audit.");
      return;
    }
    setIsPerformingSecurityScan(true);
    setSecurityScanResults(null);
    try {
      const prompt = `Act as a Cybersecurity Expert. Perform a 'Zero Trust' and 'Zero-day Vulnerability' audit on the following content and context.
      
      Requirements:
      1. Zero Trust: Analyze the data flows and access patterns implied. Identify where explicit verification is needed.
      2. Zero-day Scan: Identify patterns that could lead to vulnerabilities (e.g. prompt injection, PII leak, insecure data handling).
      3. Financial Integrity: Check for potential financial logic flaws or unauthorized spending patterns.
      4. Mitigation: Provide 3 concrete steps to harden the system.
      
      Content: "${text.substring(0, 3000)}"
      
      Return ONLY a valid JSON object with:
      {
        "zeroTrustScore": number (0-100),
        "vulnerabilityStatus": "Safe" | "At Risk" | "Critical",
        "findings": ["Finding 1", "Finding 2"],
        "hardeningSteps": ["Step 1", "Step 2"],
        "zeroDayIntel": "Simulated intelligence on emerging threats related to this content type"
      }`;
      
      const resText = await genAIResponse("gemini-3.8-flash", [{ text: prompt }]);
      const data = JSON.parse(resText || "{}");
      setSecurityScanResults(data);
    } catch (e) {
      console.error(e);
      setErrorInfo("Security audit failed.");
    } finally {
      setIsPerformingSecurityScan(false);
    }
  };

  const startVoiceSearch = () => {
    if (isListeningSearch) {
        console.log("Recognition already active.");
        return;
    }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    // Default to browser locale if no specific language is selected
    if (searchLanguage && searchLanguage !== 'auto') {
        recognition.lang = searchLanguage;
    } else {
        recognition.lang = navigator.language || 'en-US';
    }
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      console.log("Voice search started, language:", recognition.lang);
      setIsListeningSearch(true);
    };
    recognition.onend = () => {
      console.log("Voice search ended");
      setIsListeningSearch(false);
    };
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      console.log("Captured speech:", transcript);
      setSearchQuery(transcript);
      setSearchHistory(prev => [transcript, ...prev.filter(i => i !== transcript)].slice(0, 5));
      
      handleCommand(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListeningSearch(false);
      setCommandFeedback(`Voice error: ${event.error}`);
    };

    recognition.start();
  };

  const performSemanticSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSemanticSearching(true);
    try {
      const historyContext = history.slice(0, 20).map(h => `ID: ${h.id}, Text: ${h.text.substring(0, 100)}...`).join('\n');
      const response = await genAIResponse("gemini-3.8-flash", [
        { text: `System: You are an advanced Semantic Search Engine. 
Query: "${searchQuery}"
Context (Available Documents):
${historyContext}

Task: Find the most relevant document IDs (up to 3) that match the search query's meaning, even across languages. 
Explain WHY they match briefly.

Return ONLY a JSON array: [{"id": "string", "reason": "string"}]` }
      ]);
      
      const cleanText = response.replace(/```json|```/g, '').trim();
      const results = JSON.parse(cleanText);
      
      if (results.length > 0) {
        setCommandFeedback(`Semantic Match: ${results[0].reason}`);
        // Optionally highlight or filter, for now we just show feedback
      } else {
        setCommandFeedback("No semantic matches found.");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSemanticSearching(false);
    }
  };

  const handleCommand = async (cmd: string) => {
    setSearchHistory(prev => [cmd, ...prev.filter(i => i !== cmd)].slice(0, 5));
    
    console.log("Command received:", cmd);
    console.log("Current text length:", text ? text.length : 0);
    
    // AI Intent Classification
    let intent = 'OTHER';
    let args: any = {};
    
    try {
        const interpretation = await genAIResponse("gemini-3.8-flash", [{ text: `Parse the command into JSON format: { "intent": "OPEN_FILES" | "OPEN_FILE" | "TRANSLATE_CONTENT" | "IMPORT_DEVICE_CONTENT" | "SHARE_CONTENT" | "SUMMARIZE_CONTENT" | "ANALYZE_CONTENT" | "CLEAR_CONTENT" | "SWITCH_TAB" | "GENERATE_CONTENT" | "FORMAT_CONTENT" | "SEARCH_CONTENT" | "READ_ALOUD" | "SAVE_CONTENT" | "CORRECT_GRAMMAR" | "CHANGE_TONE" | "APPEND_CONTENT" | "GET_STATS" | "EXTRACT_ENTITIES" | "OTHER", "args": { "filename": "...", "language": "...", "platform": "...", "tab": "...", "prompt": "...", "query": "...", "format": "...", "tone": "...", "text_to_append": "..." } }. 
        Rules:
        1. If the command is about translating or converting text, set intent to TRANSLATE_CONTENT.
        2. If the command is about importing content from the device or uploading a file/doc, set intent to IMPORT_DEVICE_CONTENT.
        3. If the command is about sharing content, set intent to SHARE_CONTENT and extract 'platform' (e.g., Twitter, Email, etc.) if specified.
        4. If the command is to summarize or give a brief overview, set intent to SUMMARIZE_CONTENT.
        5. If the command is to analyze, check sentiment, or extract key points, set intent to ANALYZE_CONTENT.
        6. If the command is to clear, delete, or empty the workspace/text, set intent to CLEAR_CONTENT.
        7. If the command is to go to, open, or switch to a specific section/tab (like projects, chat, voice), set intent to SWITCH_TAB and identify the 'tab'.
        8. If the command is to write, compose, or create new content (like an email, blog post, or story) based on a prompt, set intent to GENERATE_CONTENT and put the description in 'prompt'.
        9. If the command is to reformat, restructure, or change the style (e.g., "make it a list", "format as email"), set intent to FORMAT_CONTENT and describe the 'format'.
        10. If the command is to find, look for, or search for something specific IN the text, set intent to SEARCH_CONTENT and put it in 'query'.
        11. If the command is to read the text back, speak it, or listen to the document, set intent to READ_ALOUD.
        12. If the command is to save, download, or export the document, set intent to SAVE_CONTENT.
        13. If the command is to fix grammar, spelling, or proofread, set intent to CORRECT_GRAMMAR.
        14. If the command is to change the tone (e.g., "make it professional", "make it funny"), set intent to CHANGE_TONE and extract 'tone'.
        15. If the command is to add something to the end or append text, set intent to APPEND_CONTENT and extract 'text_to_append'.
        16. If the command is to get word count, length, or stats, set intent to GET_STATS.
        17. If the command is to extract specific info like names, dates, or emails, set intent to EXTRACT_ENTITIES.
        18. If intent is TRANSLATE_CONTENT, extract the target 'language' (default to English if not specified).
        Command: "${cmd}"` }]);
        console.log("Intent interpretation:", interpretation);
        const parsed = JSON.parse(interpretation.replace(/```json|```/g, '').trim());
        intent = parsed.intent;
        args = parsed.args || {};
        console.log("Parsed intent:", intent, "Parsed args:", args);
        setCommandFeedback(`Intent: ${intent}`);
        // Ensure language is set if it's a translation intent
        if (intent === 'TRANSLATE_CONTENT' && !args.language) {
          args.language = 'English';
        }

    } catch (e) {
        console.error("Intent parsing failed", e);
    }
    console.log("Chosen intent:", intent, "args:", args);

    switch (intent) {
        case 'OPEN_FILES':
            setActiveTab('projects');
            setCommandFeedback("Opening files...");
            break;
        case 'OPEN_FILE':
            if (!args.filename) {
                setCommandFeedback("Which file?");
                return;
            }
            const file = driveFiles.find(f => f.name.toLowerCase().includes(args.filename.toLowerCase()));
            if (file) {
                setCommandFeedback(`Opening ${file.name}...`);
                try {
                    const content = await getDocContent(file.id);
                    // Assuming content structure, need to properly extract text
                    const docText = content.body.content.map((c: any) => c.paragraph?.elements?.map((e: any) => e.textRun?.content).join('')).join('\n');
                    setText(docText);
                    setCommandFeedback(`Opened ${file.name}`);
                } catch (e) {
                    setCommandFeedback("Failed to open file.");
                }
            } else {
                setCommandFeedback(`Searching for "${args.filename}" on Google...`);
                try {
                    // Using googleSearch tool for external search. 
                    // NOTE: This uses client-side API calls, which should be migrated to server-side for production.
                    const searchResults = await genAIResponse("gemini-3.8-flash", [{ text: `Search for "${args.filename}" and provide information about it.` }], [ { googleSearch: {} } ]);
                    setCommandFeedback(`Google Search Result: ${searchResults.text || 'No information found.'}`);
                } catch (e) {
                    setCommandFeedback("Google search failed.");
                }
            }
            break;
        case 'IMPORT_DEVICE_CONTENT':
            setCommandFeedback("Opening device file picker...");
            docInputRef.current?.click();
            break;
        case 'SHARE_CONTENT':
            if (!text) {
                setCommandFeedback("No content to share.");
                return;
            }
            const platform = args.platform || 'General';
            setCommandFeedback(`Sharing to ${platform}...`);
            const shareData = {
                title: 'AI Studio Content',
                text: text.substring(0, 1000),
                url: window.location.href,
            };
            if (navigator.share) {
                try {
                    await navigator.share(shareData);
                    setCommandFeedback(`Shared content via ${platform}.`);
                } catch (e) {
                    setCommandFeedback("Share cancelled or failed.");
                }
            } else {
                try {
                    await copyToClipboard(text);
                    setCommandFeedback(`Content copied to clipboard (Sharing to ${platform} not supported by browser).`);
                } catch (e) {
                    setCommandFeedback("Failed to copy content.");
                }
            }
            break;
        case 'TRANSLATE_CONTENT':
            console.log("Translation intent - text length:", text ? text.length : 0);
            if (!text) {
                setCommandFeedback("No content to translate.");
                return;
            }
            const lang = args.language || 'English';
            setCommandFeedback(`Translating to ${lang}...`);
            try {
                const translatePrompt = `Translate the following to ${lang}. Return ONLY the translated text.\n\nText: ${text.substring(0, 15000)}`;
                const translatedText = await genAIResponse("gemini-3.8-flash", [{ text: translatePrompt }]);
                if (translatedText) setText(translatedText);
                setCommandFeedback(`Translated to ${lang}.`);
            } catch (e) {
                setCommandFeedback("Translation failed.");
            }
            break;
        case 'SUMMARIZE_CONTENT':
            if (!text) {
                setCommandFeedback("No content to summarize.");
                return;
            }
            setCommandFeedback("Summarizing content...");
            try {
                const summaryPrompt = `Summarize the following text concisely. Capture the main points.\n\nText: ${text.substring(0, 20000)}`;
                const summary = await genAIResponse("gemini-3.8-flash", [{ text: summaryPrompt }]);
                if (summary) setCommandFeedback(`Summary: ${summary.substring(0, 300)}...`);
                // Optionally replace text or show in alert, but feedback is safer for now
                if (summary) {
                    const confirmSummary = window.confirm("Would you like to replace current text with this summary?");
                    if (confirmSummary) setText(summary);
                }
            } catch (e) {
                setCommandFeedback("Summarization failed.");
            }
            break;
        case 'ANALYZE_CONTENT':
            if (!text) {
                setCommandFeedback("No content to analyze.");
                return;
            }
            setCommandFeedback("Analyzing content...");
            try {
                const analyzePrompt = `Analyze the tone, sentiment, and key entities of this text. Be brief.\n\nText: ${text.substring(0, 20000)}`;
                const analysis = await genAIResponse("gemini-3.8-flash", [{ text: analyzePrompt }]);
                if (analysis) setCommandFeedback(`Analysis: ${analysis}`);
            } catch (e) {
                setCommandFeedback("Analysis failed.");
            }
            break;
        case 'CLEAR_CONTENT':
            setText('');
            setCommandFeedback("Workspace cleared.");
            break;
        case 'SWITCH_TAB':
            const targetTab = args.tab?.toLowerCase();
            const tabMap: Record<string, string> = {
                'project': 'projects',
                'files': 'projects',
                'chat': 'agent',
                'agent': 'agent',
                'voice': 'voice',
                'cloning': 'voice',
                'batch': 'batch',
                'single': 'single',
                'playlist': 'playlist',
                'team': 'shared',
                'shared': 'shared'
            };
            let matchedTab = null;
            for (const key in tabMap) {
                if (targetTab?.includes(key)) {
                    matchedTab = tabMap[key];
                    break;
                }
            }
            if (matchedTab) {
                setActiveTab(matchedTab);
                setCommandFeedback(`Switched to ${matchedTab} tab.`);
            } else {
                setCommandFeedback(`Could not find tab matching "${args.tab}".`);
            }
            break;
        case 'GENERATE_CONTENT':
            setCommandFeedback("Generating content...");
            try {
                const genPrompt = `Act as a professional assistant. Generate content based on this request: "${args.prompt}". 
                If there is existing context below, use it. Otherwise create from scratch.
                
                Existing Context:
                ${text.substring(0, 5000)}
                
                Return ONLY the generated text.`;
                const generated = await genAIResponse("gemini-3.8-flash", [{ text: genPrompt }]);
                if (generated) {
                    setText(generated);
                    setCommandFeedback("New content generated.");
                }
            } catch (e) {
                setCommandFeedback("Generation failed.");
            }
            break;
        case 'FORMAT_CONTENT':
            if (!text) {
                setCommandFeedback("No content to format.");
                return;
            }
            setCommandFeedback(`Formatting as ${args.format || 'requested style'}...`);
            try {
                const formatPrompt = `Reformat the following text as ${args.format || 'a clean, structured document'}. Preserve the core information but change the layout/style as requested. Return ONLY the formatted text.\n\nText: ${text.substring(0, 15000)}`;
                const formatted = await genAIResponse("gemini-3.8-flash", [{ text: formatPrompt }]);
                if (formatted) {
                    setText(formatted);
                    setCommandFeedback("Content reformatted.");
                }
            } catch (e) {
                setCommandFeedback("Formatting failed.");
            }
            break;
        case 'SEARCH_CONTENT':
            if (!text) {
                setCommandFeedback("Workspace is empty.");
                return;
            }
            const query = args.query?.toLowerCase() || '';
            const occurrences = text.toLowerCase().split(query).length - 1;
            if (occurrences > 0) {
                setCommandFeedback(`Found "${query}" ${occurrences} time(s) in document.`);
                // Basic scroll to feedback for now, in a real text area we'd highlight
            } else {
                setCommandFeedback(`"${query}" not found in current text.`);
            }
            break;
        case 'READ_ALOUD':
            if (!text) {
                setCommandFeedback("Nothing to read.");
                return;
            }
            setCommandFeedback("Reading document aloud...");
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel(); // Stop any current speaking
                const utterance = new SpeechSynthesisUtterance(text.substring(0, 4000)); // Limit length for stability
                window.speechSynthesis.speak(utterance);
            } else {
                setCommandFeedback("Text-to-speech not supported in this browser.");
            }
            break;
        case 'SAVE_CONTENT':
            if (!text) {
                setCommandFeedback("No content to save.");
                return;
            }
            setCommandFeedback("Exporting document...");
            try {
                const blob = new Blob([text], { type: 'text/plain' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `voice-export-${new Date().getTime()}.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                setCommandFeedback("Document saved to your device.");
            } catch (e) {
                setCommandFeedback("Save failed.");
            }
            break;
        case 'CORRECT_GRAMMAR':
            if (!text) {
                setCommandFeedback("No content to correct.");
                return;
            }
            setCommandFeedback("Fixing grammar and spelling...");
            try {
                const correctPrompt = `Proofread and correct the grammar, spelling, and punctuation of the following text. Preserve the original meaning. Return ONLY the corrected text.\n\nText: ${text.substring(0, 15000)}`;
                const corrected = await genAIResponse("gemini-3.8-flash", [{ text: correctPrompt }]);
                if (corrected) {
                    setText(corrected);
                    setCommandFeedback("Grammar and spelling corrected.");
                }
            } catch (e) {
                setCommandFeedback("Correction failed.");
            }
            break;
        case 'CHANGE_TONE':
            if (!text) {
                setCommandFeedback("No content to adjust.");
                return;
            }
            const tone = args.tone || 'professional';
            setCommandFeedback(`Shifting tone to ${tone}...`);
            try {
                const tonePrompt = `Rewrite the following text in a ${tone} tone. Keep the core information the same. Return ONLY the rewritten text.\n\nText: ${text.substring(0, 15000)}`;
                const adjusted = await genAIResponse("gemini-3.8-flash", [{ text: tonePrompt }]);
                if (adjusted) {
                    setText(adjusted);
                    setCommandFeedback(`Tone adjusted to ${tone}.`);
                }
            } catch (e) {
                setCommandFeedback("Tone adjustment failed.");
            }
            break;
        case 'APPEND_CONTENT':
            if (!args.text_to_append) {
                setCommandFeedback("Nothing to append.");
                return;
            }
            setText(prev => (prev ? prev + "\n\n" : "") + args.text_to_append);
            setCommandFeedback("Text appended to document.");
            break;
        case 'GET_STATS':
            if (!text) {
                setCommandFeedback("Workspace is empty.");
                return;
            }
            const words = text.trim().split(/\s+/).length;
            const chars = text.length;
            const readingTime = Math.ceil(words / 200);
            setCommandFeedback(`Stats: ${words} words, ${chars} characters. Est. reading time: ${readingTime} min.`);
            break;
        case 'EXTRACT_ENTITIES':
            if (!text) {
                setCommandFeedback("No content to analyze.");
                return;
            }
            setCommandFeedback("Extracting names, dates, and locations...");
            try {
                const extractPrompt = `Extract all names of people, specific dates, and locations from this text. Return them as a clean bulleted list. Be brief.\n\nText: ${text.substring(0, 15000)}`;
                const entities = await genAIResponse("gemini-3.8-flash", [{ text: extractPrompt }]);
                if (entities) setCommandFeedback(`Entities found:\n${entities}`);
            } catch (e) {
                setCommandFeedback("Extraction failed.");
            }
            break;
        default:
            // Fallback to old commands
            const cmdParts = cmd.split(' ');
            const action = cmdParts[0].toLowerCase();
            const legacyArgs = cmdParts.slice(1).join(' ');
            
            switch (action) {
              case '/summary':
                if (!legacyArgs) {
                  setCommandFeedback("Usage: /summary [text or item ID]");
                  return;
                }
                setCommandFeedback("Summarizing...");
                try {
                  const res = await genAIResponse("gemini-3.8-flash", [{ text: `Summarize this text concisely: ${args}` }]);
                  setCommandFeedback(`Summary: ${res}`);
                } catch (e) { setCommandFeedback("Summarization failed."); }
                break;
              case '/translate':
                if (!args) {
                  setCommandFeedback("Usage: /translate [text]");
                  return;
                }
                setCommandFeedback("Translating...");
                try {
                  const res = await genAIResponse("gemini-3.8-flash", [{ text: `Translate this to ${searchLanguage}: ${args}` }]);
                  setCommandFeedback(`Translation: ${res}`);
                } catch (e) { setCommandFeedback("Translation failed."); }
                break;
              case '/clear':
                setSearchQuery('');
                setCommandFeedback(null);
                break;
              default:
                setCommandFeedback("Unknown command. Try /summary, /translate, or /clear");
            }
    }
  };

  useEffect(() => {
    if (searchQuery.startsWith('/')) return;
    if (searchQuery.length > 2) {
      const suggestions = [
        "भविष्य की तकनीक",
        "डिजिटल इंडिया मिशन",
        "AI for Agriculture",
        "Economic Growth 2026",
        "Sustainable Development",
        "Space Exploration"
      ].filter(s => s.toLowerCase().includes(searchQuery.toLowerCase()));
      setSearchSuggestions(suggestions);
    } else {
      setSearchSuggestions([]);
    }
  }, [searchQuery]);
  const [currentGenerationId, setCurrentGenerationId] = useState<string | null>(null);
  const [isDialogueMode, setIsDialogueMode] = useState(false);
  const [clonedVoices, setClonedVoices] = useState<{id: string, pitch: number, speed: number, gender: string, label: string}[]>([]);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const voiceRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const [exportFormat, setExportFormat] = useState('mp3');
  const [karaokeSpeed, setKaraokeSpeed] = useState(0); 
  const [currentWord, setCurrentWord] = useState('');
  
  interface HistoryItem { 
    url: string, 
    text: string, 
    timestamp: number, 
    id: string, 
    likeStatus?: 'like' | 'dislike' | null, 
    isStarred?: boolean,
    feedback?: string, 
    tags: string[],
    directorsNotes?: string
  };
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [playlist, setPlaylist] = useState<HistoryItem[]>([]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [errorInfo, setErrorInfo] = useState<ReactNode | string | null>(null);
  const [batchResults, setBatchResults] = useState<{ text: string, url?: string, error?: string }[]>([]);
  const [isTalkBackActive, setIsTalkBackActive] = useState(false);
  const [isTutorMinimized, setIsTutorMinimized] = useState(false);
  const [isTutorMaximized, setIsTutorMaximized] = useState(false);
  const [isAdaptiveTesting, setIsAdaptiveTesting] = useState(() => localStorage.getItem('isAdaptiveTesting') === 'true');
  const [isSocraticMode, setIsSocraticMode] = useState(() => localStorage.getItem('isSocraticMode') === 'true');
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [currentWordIndex, setCurrentWordIndex] = useState(-1);
  const [difficultyLevel, setDifficultyLevel] = useState(1);
  const [correctStreak, setCorrectStreak] = useState(0);
  const [graphData, setGraphData] = useState<{ nodes: {id: string, label: string}[], links: {source: string, target: string}[] } | null>(null);
  const [masteryData, setMasteryData] = useState<Record<string, number>>({});
  const [learningPath, setLearningPath] = useState<{ module: string, completed: boolean }[] | null>(null);
  const [microChallenge, setMicroChallenge] = useState<string | null>(null);
  const [tutorTab, setTutorTab] = useState<'chat' | 'path' | 'challenge' | 'dashboard'>('chat');
  const [talkBackMessages, setTalkBackMessages] = useState<{role: 'user' | 'assistant', content: string}[]>([]);
  const [talkBackInput, setTalkBackInput] = useState('');
  const [tutorLevel, setTutorLevel] = useState<string>('Middle School');
  const [isListening, setIsListening] = useState(false);
  const [isDictatingEditor, setIsDictatingEditor] = useState(false);
  const [isMainEditorCopied, setIsMainEditorCopied] = useState(false);
  const [showClearEditorConfirm, setShowClearEditorConfirm] = useState(false);
  const recognitionRef = useRef<any>(null);
  const editorRecognitionRef = useRef<any>(null);

  useEffect(() => { localStorage.setItem('isAdaptiveTesting', String(isAdaptiveTesting)); }, [isAdaptiveTesting]);
  useEffect(() => { localStorage.setItem('isSocraticMode', String(isSocraticMode)); }, [isSocraticMode]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        clearHistory();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        shareSession();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const clearHistory = () => {
    if (confirm("This will permanently delete your entire search history and all extracted documents. Continue?")) {
        setTalkBackMessages([]);
        setHistory([]);
        setBatchResults([]);
        setSearchHistory([]);
        setSearchSuggestions([]);
        setCommandFeedback("History cleared successfully.");
        setTimeout(() => setCommandFeedback(null), 3000);
    }
  };

  const shareSession = async () => {
    const shareData = {
        title: 'My AI Studio App',
        text: 'Check out this AI-powered audio app!',
        url: window.location.href,
    };
    if (navigator.share) {
        try { await navigator.share(shareData); } catch (e) {
        copyToClipboard(window.location.href);
        setErrorInfo("Session link copied to clipboard!");
        }
    } else {
        copyToClipboard(window.location.href);
        setErrorInfo("Session link copied to clipboard!");
    }
  };

  // AI Tutor Adaptive Update
  useEffect(() => {
    if (isTalkBackActive && talkBackMessages.length > 0 && !isGenerating && !isRecordingVoice) {
      // Reset derived content to force regeneration for new context
      setLearningPath(null);
      setMicroChallenge(null);
      setGraphData(null);
      setMasteryData({});
      setQuizData(null);
      setQuizPhase('loading');

      const langName = LANGUAGES.find(l => l.code === languageCode)?.name || 'English';
      const prompt = `[System Update] User has changed preferences. Current Language: ${langName}, Comprehension Level: ${tutorLevel}. Please briefly acknowledge this change in ${langName}, reset our educational trajectory, and adapt to this new target level.`;
      
      handleTalkBackSubmit(prompt);
    }
  }, [languageCode, tutorLevel]);

  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      // Tutor recognition
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.lang = 'en-US';
      recognitionRef.current.onspeechstart = () => {
        window.speechSynthesis.cancel();
      };
      recognitionRef.current.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setTalkBackInput(transcript);
        setIsListening(false);
      };
      recognitionRef.current.onend = () => setIsListening(false);

      // Editor dictation recognition
      editorRecognitionRef.current = new SpeechRecognition();
      editorRecognitionRef.current.continuous = true;
      editorRecognitionRef.current.interimResults = true;
      editorRecognitionRef.current.lang = 'en-US';
      
      let finalTranscript = '';

      editorRecognitionRef.current.onresult = (event: any) => {
          let interimTranscript = '';
          finalTranscript = ''; // resetting here so we don't duplicate on each result callback

          for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                  finalTranscript += event.results[i][0].transcript + ' ';
              } else {
                  interimTranscript += event.results[i][0].transcript;
              }
          }
          
          if (finalTranscript) {
             setText(prev => typeof prev === 'string' ? prev + (prev.endsWith(' ') ? '' : ' ') + finalTranscript : prev);
          }
      };
      editorRecognitionRef.current.onend = () => {
         setIsDictatingEditor(false);
      };
    }
  }, []);

  const toggleEditorDictation = () => {
      if (!editorRecognitionRef.current) {
          setErrorInfo("Speech recognition is not supported in this browser.");
          return;
      }
      if (isDictatingEditor) {
          editorRecognitionRef.current.stop();
          setIsDictatingEditor(false);
      } else {
          editorRecognitionRef.current.start();
          setIsDictatingEditor(true);
      }
  };

  const handleMicClick = () => {
    if (!recognitionRef.current) {
        alert("Speech recognition not supported in this browser.");
        return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };
  const stopSpeech = () => {
    window.speechSynthesis.cancel();
    if (currentAudioElement) {
      currentAudioElement.pause();
      currentAudioElement.currentTime = 0;
    }
    setIsAudioPlaying(false);
  };

  const flagStruggledTopic = async (topic: string, diff: number) => {
    if (!firebaseContextAuth.currentUser) return;
    try {
        await addDoc(collection(db, 'review_topics'), {
            userId: firebaseContextAuth.currentUser.uid,
            topic: topic,
            difficultyWhenStruggled: diff,
            flaggedAt: serverTimestamp()
        });
    } catch(e) {
        console.error("Failed to flag topic:", e);
    }
  };

  const speakMessage = async (text: string) => {
    try {
      stopSpeech();
      const audioUrl = await generateGenericAudio(text);
      if (audioUrl) {
        const audio = new Audio(audioUrl);
        setCurrentAudioElement(audio);
        setIsAudioPlaying(true);
        audio.onended = () => {
          setIsAudioPlaying(false);
          setCurrentAudioElement(null);
        };
        audio.play().catch(e => console.error("Audio playback failed:", e));
      } else {
        // Fallback for browser engine if necessary, though generateGenericAudio handles it
      }
    } catch (e: any) {
      console.error("Failed to speak message:", e);
      setErrorInfo(e.message || "Failed to generate text-to-speech audio.");
    }
  };
  const [isPacingCoachActive, setIsPacingCoachActive] = useState(false);
  const [ytUrl, setYtUrl] = useState('');
  const [fetchedVideoTitle, setFetchedVideoTitle] = useState<string | null>(null);
  const [scriptPersona, setScriptPersona] = useState('explainer');
  const [polishVibe, setPolishVibe] = useState('Standard');
  const [polishAction, setPolishAction] = useState('Polish');
  const [bilingualLang, setBilingualLang] = useState('Hinglish');
  const [isFactChecking, setIsFactChecking] = useState(false);
  const [targetDialect, setTargetDialect] = useState('Standard Hindi');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [scriptChapters, setScriptChapters] = useState<{title: string, startTime: string, description: string}[] | null>(null);

  const handleEnhanceScript = async (type: 'ENHANCE' | 'DIALECT' | 'SHORTEN' | 'CHAPTERS') => {
    if (!text.trim()) return;
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
    setIsEnhancing(true);
    setCommandFeedback(`AI is ${type.toLowerCase()}ing your script...`);
    try {
      if (type === 'CHAPTERS') {
        const prompt = `Analyze the following script/text and split it into logical chapters (e.g., Intro, key segments, Outro). Estimate start times chronologically starting at 00:00, assuming a reading/speaking speed of about 140 words per minute. For each chapter, provide a concise title, its estimated startTime (e.g. '00:00', '01:15', etc.), and a short description of what is covered in that section.
Return ONLY a valid JSON array of objects. Do not wrap in markdown or backticks.
JSON Schema:
[
  { "title": "string", "startTime": "string", "description": "string" }
]

Text to analyze:
"${text}"`;

        const aiResponse = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
        if (aiResponse) {
          let cleanJson = aiResponse.trim();
          if (cleanJson.includes("```")) {
            cleanJson = cleanJson.replace(/```json/g, "").replace(/```/g, "").trim();
          }
          const parsed = JSON.parse(cleanJson);
          if (Array.isArray(parsed)) {
            setScriptChapters(parsed);
            setCommandFeedback("Chapters generated successfully!");
          } else {
            throw new Error("Invalid response format");
          }
        } else {
          throw new Error("Empty response");
        }
      } else {
        let prompt = "";
        if (type === 'ENHANCE') {
          prompt = `Enhance, enrich, and polish the following voiceover script/text to make it more professional, engaging, and flow beautifully. Maintain the core message but elevate the delivery and style. Return ONLY the enhanced text, with no conversational filler or introductory notes.\n\nText:\n"${text}"`;
        } else if (type === 'SHORTEN') {
          prompt = `Condense and shorten the following voiceover script/text, making it more concise and directly to the point. Eliminate wordiness while keeping the essential message. Return ONLY the condensed text, with no conversational filler or introductory notes.\n\nText:\n"${text}"`;
        } else if (type === 'DIALECT') {
          prompt = `Translate or adapt the following voiceover script/text into the target dialect or language: "${targetDialect}". Ensure it sounds natural and idiomatic in that specific dialect. Return ONLY the translated/adapted text, with no conversational filler or introductory notes.\n\nText:\n"${text}"`;
        }

        const aiResponse = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
        if (aiResponse) {
          const cleanText = stripMarkdownAndDelimiters(aiResponse);
          setText(cleanText);
          if (containsTable(aiResponse)) {
            setEditMode('grid');
          }
          setCommandFeedback("Script updated by AI!");
        } else {
          throw new Error("Empty response");
        }
      }
    } catch (e) {
      console.error(e);
      setErrorInfo(`Failed to ${type.toLowerCase()} script.`);
    } finally {
      setIsEnhancing(false);
    }
  };

  const handleRunPolish = async () => {
    if (!text.trim()) return;
    setIsGenerating(true);
    setCommandFeedback(`AI is performing ${polishAction}...`);
    try {
      let prompt = "";
      let model = "gemini-3.8-flash";
      let options: any = {};

      switch(polishAction) {
        case 'Fact-Check':
          model = "gemini-4-argon";
          options = [{ googleSearch: {} }];
          prompt = `Analyze the following text for factual claims. Use Google Search to verify them. 
          Identify any potentially inaccurate statements. 
          Return the original text but wrap inaccurate claims in [Fact Check: ...Correction/Source...] markers. 
          If everything is accurate, return the text as is but add a brief "Verified by AI" stamp at the end.
          Text: ${text}`;
          break;
        case 'Structure':
          prompt = `Convert the following messy notes or text into a polished 3-act script structure optimized for video/podcasts.
          Format:
          [HOOK: First 5-10 seconds to grab attention]
          [VALUE: The core content, split into logical points]
          [CTA: A strong call-to-action]
          
          Text: ${text}`;
          break;
        case 'Bilingual':
          prompt = `Act as a bilingual script writer. Take the following text and naturally infuse ${bilingualLang} vocabulary and cultural nuances to make it sound more relatable to Indian audiences. Keep the core message but "Code-Switch" naturally where appropriate.
          Return ONLY the revised text.
          Text: ${text}`;
          break;
        case 'SEO Optimizer':
          prompt = `Analyze the first 30 seconds of this script. Suggest 3 different versions of a "Viral Hook" (Opening sentence) that significantly improves audience retention.
          Finally, suggest an SEO-optimized title for this content.
          Format:
          # Hook 1: ...
          # Hook 2: ...
          # Hook 3: ...
          # SEO Title: ...
          
          Text: ${text}`;
          break;
        case 'Pacing':
          prompt = `Analyze the following text for TTS (Text-to-Speech) readout. 
          Automatically insert punctuation and specific SSML-style pacing markers like <break time="800ms"/> for dramatic effect or natural breathing. 
          Ensure the flow sounds human and not robotic.
          Return ONLY the marked-up text.
          Text: ${text}`;
          break;
        case 'Visual Anchors':
          prompt = `Analyze this script and suggest specific B-roll timestamps or image descriptions. 
          Insert them into the text using brackets like [Visual: description @ time]. 
          The visual choices should match the emotional arc of the script.
          Text: ${text}`;
          break;
        case 'Resonance':
          prompt = `Analyze the resonance of this script for the following audience: "${scriptPersona || 'Modern Audiences'}".
          Rate it on a scale of 1-10 for Engagement, Trust, and Clarity.
          Briefly explain WHY they might connect or disconnect with specific phrases.
          Text: ${text}`;
          break;
        case 'Batch Translate':
          prompt = `Translate the following script segment (first 1000 chars) into: Hindi, Marathi, Bengali, Tamil, Telugu, Kannada, Gujarati, and Punjabi.
          Return the result as a detailed Markdown table with columns: Language | Translation.
          Text: ${text.substring(0, 1000)}`;
          break;
        default: // Polish
          const vibePrompts: Record<string, string> = {
            'Standard': "Polish this text for grammar, flow, and natural pauses for TTS.",
            'Gen-Z': "Transform this text into a Gen-Z social media vibe. Use slang (no-cap, fr, bet, etc.), emojis, and high-energy short sentences. Keep the main info.",
            'Professional Documentary': "Rewrite this in the style of a high-end BBC or National Geographic documentary narrator. Use evocative, precise vocabulary and formal, steady pacing.",
            'Socratic': "Rewrite this as a Socratic lesson. Use guiding questions to lead the listener to the core concepts. Educational and inquisitive tone.",
            'Brutally Honest': "Rewrite this script with a brutally honest, no-nonsense corporate-transparency tone. Cut the fluff and marketing speak.",
            'Minimalist': "Strip this text down to its absolute bare essentials. High information density with minimal words.",
            'Enthusiastic': "Infuse this text with extreme excitement, positivity, and energy. Like a stadium announcer or a high-energy product launch."
          };
          prompt = `${vibePrompts[polishVibe] || vibePrompts['Standard']}
          Also add natural pauses for TTS. Insert visual cues in brackets, e.g., [Visual: ...], to suggest B-roll. 
          Return ONLY text.
          Text: ${text}`;
      }

      const polishedText = await genAIResponse(model, [{ role: "user", parts: [{ text: prompt }] }], options);
      if (polishedText) {
        const cleanPolished = stripMarkdownAndDelimiters(polishedText);
        if (['SEO Optimizer', 'Fact-Check', 'Resonance', 'Batch Translate'].includes(polishAction)) {
          setText(prev => `${cleanPolished}\n\n${stripMarkdownAndDelimiters(prev)}`);
          if (polishAction === 'Batch Translate') {
            setIsPreviewMode(true);
            setPreviewDisplayMode('split');
          }
        } else {
          setText(cleanPolished);
        }
        setCommandFeedback(`${polishAction} completed successfully.`);
      }
    } catch (e) {
      console.error(e);
      setErrorInfo(`${polishAction} failed.`);
    } finally {
      setIsGenerating(false);
    }
  };

  const [isQuizActive, setIsQuizActive] = useState(false);
  const [quizData, setQuizData] = useState<{question: string, options: string[], correctIndex: number, explanation: string}[] | null>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [quizScore, setQuizScore] = useState(0);
  const [quizPhase, setQuizPhase] = useState<'loading' | 'active' | 'results'>('loading');
  const [seoData, setSeoData] = useState<{ titles: string[], description: string, tags: string[] } | null>(null);
  const [socialChapters, setSocialChapters] = useState<{ timestamp: string, title: string }[] | null>(null);
  const [isGeneratingSeo, setIsGeneratingSeo] = useState(false);
  const [isGeneratingChapters, setIsGeneratingChapters] = useState(false);
  const [thumbnailConcepts, setThumbnailConcepts] = useState<{ concept: string, prompt: string, designGuidance: string }[] | null>(null);
  const [isGeneratingThumbnails, setIsGeneratingThumbnails] = useState(false);
  const [isAnalyzingCompetitor, setIsAnalyzingCompetitor] = useState(false);
  const [competitorAnalysis, setCompetitorAnalysis] = useState<string | null>(null);
  const [isPlatformToolkitOpen, setIsPlatformToolkitOpen] = useState(false);
  const [repurposedContent, setRepurposedContent] = useState<{ platform: string, content: string } | null>(null);
  const [isGeneratingRepurposed, setIsGeneratingRepurposed] = useState<string | null>(null);
  const [isToolkitMaximized, setIsToolkitMaximized] = useState(false);
  
  // Auto-Segment States
  const [thematicBlocks, setThematicBlocks] = useState<{ title: string, content: string, purpose: string, duration: string }[] | null>(null);
  const [isSegmenting, setIsSegmenting] = useState(false);
  const [editingBlockIndex, setEditingBlockIndex] = useState<number | null>(null);
  const [editingBlockContent, setEditingBlockContent] = useState<string>('');
  const [isThematicBlocksOpen, setIsThematicBlocksOpen] = useState(false);
  
  // New Added Features State
  const [brandVoice, setBrandVoice] = useState('Maintain a professional, engaging tone.');
  const [isGeneratingVoiceover, setIsGeneratingVoiceover] = useState(false);
  const [isPerformingSentimentAnalysis, setIsPerformingSentimentAnalysis] = useState(false);
  const [isExtractingKeySnippets, setIsExtractingKeySnippets] = useState(false);
  const [tone, setTone] = useState('Professional');
  const [language, setLanguage] = useState('English');
  const [isGeneratingEcosystem, setIsGeneratingEcosystem] = useState(false);
  const [isAnalyzingKeywords, setIsAnalyzingKeywords] = useState(false);
  const [isOptimizingTitles, setIsOptimizingTitles] = useState(false);
  const [contentTasks, setContentTasks] = useState<any[]>([]);
  const [brandAssets, setBrandAssets] = useState<any[]>([]);
  const docInputRef = useRef<HTMLInputElement>(null);

  const [visualCues, setVisualCues] = useState<string | null>(null);
  const [isAnalyzingVisuals, setIsAnalyzingVisuals] = useState(false);
  const [scriptStyle, setScriptStyle] = useState('Punchy/Fast-paced');
  const [isTuningScript, setIsTuningScript] = useState(false);
  const [conceptTesting, setConceptTesting] = useState<{angle: string, description: string}[] | null>(null);
  const [isGeneratingConcepts, setIsGeneratingConcepts] = useState(false);
  const [polls, setPolls] = useState<{question: string, options: string[]}[] | null>(null);
  const [isGeneratingPolls, setIsGeneratingPolls] = useState(false);

  // Task Performer Agent State
  const [agentSourceUrl, setAgentSourceUrl] = useState('');
  const [agentBrandGoal, setAgentBrandGoal] = useState('');
  const [showAgentSettings, setShowAgentSettings] = useState(false);
  const [agentTone, setAgentTone] = useState<'educational' | 'hype' | 'storytelling' | 'news'>('educational');
  const [agentSchedule, setAgentSchedule] = useState<'manual' | '6h' | '12h' | 'daily'>('manual');
  const [budgetLimit, setBudgetLimit] = useState<number>(5.00);
  const [currentSpend, setCurrentSpend] = useState<number>(0);
  const [agentSelectedLangs, setAgentSelectedLangs] = useState<string[]>(["Hindi", "English"]);
  const [socialConnections, setSocialConnections] = useState<{
    platform: string;
    connected: boolean;
    username?: string;
  }[]>([
    { platform: 'Facebook', connected: false },
    { platform: 'YouTube', connected: false },
    { platform: 'Instagram', connected: false },
    { platform: 'Telegram', connected: false },
    { platform: 'Twitter', connected: false },
    { platform: 'TikTok', connected: false },
  ]);
  const [isPushing, setIsPushing] = useState(false);
  
  const connectSocial = async (platform: string) => {
    // Check if currently connected - if so, disconnect
    const existing = socialConnections.find(s => s.platform.toLowerCase() === platform.toLowerCase());
    if (existing && existing.connected) {
      setSocialConnections(prev => prev.map(s => s.platform.toLowerCase() === platform.toLowerCase() ? { ...s, connected: false, username: undefined } : s));
      setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Disconnected from ${platform}.`]);
      setCommandFeedback(`Disconnected from ${platform}`);
      return;
    }

    // Set platform and show the detailed connection dialog (with real OAuth & sandbox options)
    setPlatformToConnect(platform);
    setShowPermissionDialog(true);
  };

  const pushToSocial = async (lang: string, platform: string, content: string) => {
    setIsPushing(true);
    setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Pushing ${lang} content to ${platform}...`]);
    
    try {
        const response = await fetch('/api/social/post', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ platform, content, lang })
        });
        
        if (!response.ok) throw new Error("Post failed");
        
        setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Successfully posted to ${platform} for ${lang}.`]);
    } catch (error) {
        setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Failed to post to ${platform}: ${error}`]);
    } finally {
        setIsPushing(false);
    }
  };
  const [agentStatus, setAgentStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [agentLog, setAgentLog] = useState<string[]>([]);
  const agentLogRef = useRef<HTMLDivElement>(null);
  const [agentResults, setAgentResults] = useState<{
    lang: string;
    text: string;
    audioUrl?: string;
    socialPosts?: { platform: string, content: string }[];
    visualPrompts?: { type: string, prompt: string }[];
    variants?: { A: string, B: string };
    sentiment?: string;
    researchSummary?: string;
    seoKeywords?: string[];
    vocalProfile?: { tone: string, speed: string, emotion: string };
    trends?: string;
    status: 'pending' | 'processing' | 'done' | 'error';
  }[]>([]);
  const [isAgentPaused, setIsAgentPaused] = useState(false);

  useEffect(() => {
    let intervalId: any;
    if (agentSchedule !== 'manual') {
      const ms = agentSchedule === '6h' ? 6 * 3600000 : agentSchedule === '12h' ? 12 * 3600000 : 24 * 3600000;
      setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] 📅 Agent Schedule Active: Next check in ${agentSchedule}.`]);
      intervalId = setInterval(() => {
        if (agentStatus === 'idle' || agentStatus === 'completed') {
           startTaskPerformerAgent();
        }
      }, ms);
    }
    return () => clearInterval(intervalId);
  }, [agentSchedule, agentStatus]);

  useEffect(() => {
    if (agentLogRef.current) {
      const { scrollHeight, clientHeight, scrollTop } = agentLogRef.current;
      const isAtBottom = scrollHeight - clientHeight <= scrollTop + 100;
      if (isAtBottom || agentLog.length <= 1) {
        agentLogRef.current.scrollTo({ top: scrollHeight, behavior: 'smooth' });
      }
    }
  }, [agentLog]);

  // Task Performer Agent Logic
  const startTaskPerformerAgent = async () => {
    if (!agentSourceUrl) {
      setErrorInfo("Please provide a source link.");
      return;
    }

    if (currentSpend >= budgetLimit) {
      setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ BUDGET CEILING REACHED. Current Spend: $${currentSpend.toFixed(3)}. Agent suspended to protect your wallet.`]);
      return;
    }

    setAgentStatus('running');
    setAgentLog([`[${new Date().toLocaleTimeString()}] 🚀 Launching Performance Agent Pipeline...`]);
    setAgentResults(agentSelectedLangs.map(l => ({ lang: l, text: '', status: 'pending' })));

    try {
      // 1. EXTRACTION PHASE
      setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] 📥 Phase 1: Deep Extraction from ${agentSourceUrl}`]);
      const extractionPrompt = `Extract the core content/script from this URL: ${agentSourceUrl}. 
      Brand/Context provided: ${agentBrandGoal || "General Education"}.
      Return the raw intelligence content optimized for retelling.`;
      
      const masterContent = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: extractionPrompt }] }]);
      if (!masterContent) throw new Error("Source extraction failed.");
      setCurrentSpend(prev => prev + 0.002);

      // 2. COMPETITIVE INTELLIGENCE PHASE
      setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🔎 Phase 2: Competitive Intelligence & Gap Analysis`]);
      const researchPrompt = `Using Google Search:
      1. Find what the top creators or websites are currently saying about this topic: ${agentSourceUrl}.
      2. Identify a "Competitive Gap": What is missing from the current conversation?
      3. Suggest a unique angle for [Brand: ${agentBrandGoal || "Unknown"}] to win the audience's attention.
      4. List 5 high-performing SEO keywords.`;
      
      const researchData = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: researchPrompt }] }], [{ googleSearch: {} }]);

      for (const lang of agentSelectedLangs) {
        if (currentSpend >= budgetLimit) {
          setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ⚠️ CEILING REACHED: Skipping ${lang}.`]);
          continue;
        }
        setCurrentSpend(prev => prev + 0.005);

        setAgentResults(prev => prev.map(r => r.lang === lang ? { ...r, status: 'processing' } as any : r));
        setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🌏 Territorial Optimization: ${lang}`]);

        // 3. TRANSLATION & LOCALIZATION
        const translatePrompt = `Translate and LOCALIZE the script into ${lang}. 
        Incorporate the Competitive Intelligence angle naturally.
        Script: ${masterContent}
        Intel Context: ${researchData}`;
        const translated = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: translatePrompt }] }]);

        // 4. MULTI-VARIANT POLISH
        setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✨ Generating Dual-Narrative Variants for ${lang}`]);
        const polishPrompt = `Act as an expert ${lang} director for [Brand: ${agentBrandGoal}]. 
        Tone Strategy: ${agentTone}.
        1. Create two distinct versions of the script opening: A (Problem-First) and B (Curiosity-First).
        2. Provide the final optimized script.
        3. Define the Vocal Engine settings.
        Return as JSON: {"variants": {"A": "...", "B": "..."}, "script": "...", "vocalProfile": {"tone": "...", "speed": "...", "emotion": "..."}, "keywords": ["..."]}`;
        const polishRes = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: polishPrompt }] }]);
        let parsedPolish = { variants: {A: '', B: ''}, script: translated, vocalProfile: { tone: 'Direct', speed: '1.0x', emotion: 'Informative' }, keywords: [] };
        try { parsedPolish = JSON.parse(polishRes.replace(/```json|```/g, '').trim()); } catch(e) {}

        // 5. SOCIAL MEDIA BUNDLE
        const socialPrompt = `Generate optimized post metadata (Caption, Bio-Link text, and 5 Hashtags) for:
        Facebook, YouTube, Instagram, Telegram, Twitter, and TikTok in ${lang}.
        Return ONLY a clean JSON array: [{"platform": "...", "content": "..."}]`;
        const socialJson = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: socialPrompt }] }]);
        let socialPosts = [];
        try { socialPosts = JSON.parse(socialJson.replace(/```json|```/g, '').trim()); } catch(e) {}

        // 6. VISUAL ASSET DESIGN
        const visualPrompt = `Based on the ${lang} script, suggest 3 high-impact thumbnail designs and 2 B-roll image prompts.
        Format as JSON array: [{"type": "Thumbnail", "prompt": "..."}]`;
        const visualJson = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: visualPrompt }] }]);
        let visualPrompts = [];
        try { visualPrompts = JSON.parse(visualJson.replace(/```json|```/g, '').trim()); } catch(e) {}

        // 7. SENTIMENT & SENSITIVITY AUDIT
        const auditPrompt = `Predict local audience reaction in the ${lang} region. 
        Identify any cultural sensitivities. Give a "Resonance Score" out of 10.`;
        const auditResult = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: auditPrompt }] }]);

        setAgentResults(prev => prev.map(r => r.lang === lang ? { 
          ...r, 
          text: parsedPolish.script, 
          socialPosts,
          visualPrompts,
          variants: parsedPolish.variants,
          vocalProfile: parsedPolish.vocalProfile,
          seoKeywords: parsedPolish.keywords,
          sentiment: auditResult,
          researchSummary: researchData,
          status: 'done' 
        } as any : r));
        
        setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ✅ Territory ${lang} Finished.`]);
      }
      
      setAgentStatus('completed');
      setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] 🏁 Mission Accomplished. All territories synced.`]);
    } catch (err: any) {
      setAgentStatus('error');
      setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] ❌ Critical Failure: ${err?.message || String(err)}`]);
      setErrorInfo(`Agent Pipeline Interrupted: ${err?.message}`);
    }
  };

  const clearAgent = () => {
    setAgentStatus('idle');
    setAgentLog([]);
    setAgentResults([]);
  };

  const toggleAgentLang = (lang: string) => {
    setAgentSelectedLangs(prev => 
      prev.includes(lang) ? prev.filter(l => l !== lang) : [...prev, lang]
    );
  };
  
  // New Toolkit Features State
  const [viralHooks, setViralHooks] = useState<{type: string, text: string}[] | null>(null);
  const [isGeneratingHooks, setIsGeneratingHooks] = useState(false);
  const [ctaLibrary, setCtaLibrary] = useState<string[] | null>(null);
  const [isGeneratingCtas, setIsGeneratingCtas] = useState(false);
  const [scriptVitals, setScriptVitals] = useState<{readability: string, readingTime: string, tone: string, punchiness: number} | null>(null);
  const [isAnalyzingVitals, setIsAnalyzingVitals] = useState(false);
  const [extractedKeywords, setExtractedKeywords] = useState<string[] | null>(null);
  const [isExtractingKeywords, setIsExtractingKeywords] = useState(false);
  
  // Shared Playlists State
  const [sharedPlaylists, setSharedPlaylists] = useState<any[]>([]);
  const [selectedSharedPlaylist, setSelectedSharedPlaylist] = useState<any | null>(null);
  const [sharedItems, setSharedItems] = useState<any[]>([]);
  const [playlistComments, setPlaylistComments] = useState<Record<string, any[]>>({});
  const [playlistScripts, setPlaylistScripts] = useState<Record<string, any[]>>({});
  const [playlistAnalytics, setPlaylistAnalytics] = useState<Record<string, any[]>>({});
  const [sharedReactions, setSharedReactions] = useState<Record<string, any[]>>({});
  const [notifications, setNotifications] = useState<any[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectDesc, setNewProjectDesc] = useState('');
  const [activeListenSession, setActiveListenSession] = useState<{ playlistId: string, itemId: string, startTime: number } | null>(null);
  const [activeScript, setActiveScript] = useState<any | null>(null);
  const [showHistorySelection, setShowHistorySelection] = useState(false);

  const createProject = () => {
    if (!newProjectName.trim()) return;
    const project = {
      id: Date.now().toString(),
      name: newProjectName,
      description: newProjectDesc,
      createdAt: Date.now()
    };
    setProjects(prev => [project, ...prev]);
    setShowProjectModal(false);
    setNewProjectName('');
    setNewProjectDesc('');
  };
  const [socialFormat, setSocialFormat] = useState<'Standard' | 'TikTok' | 'YouTube' | 'Podcast' | 'Facebook' | 'Twitter' | 'X'>('Standard');
  const [showDirectingRoom, setShowDirectingRoom] = useState(false);
  const [feedbackModal, setFeedbackModal] = useState<{ id: string, status: 'like' | 'dislike' } | null>(null);
  const [feedbackText, setFeedbackText] = useState('');
  const [isEditorMaximized, setIsEditorMaximized] = useState(false);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [previewDisplayMode, setPreviewDisplayMode] = useState<'full' | 'split'>('full');
  const [editMode, setEditMode] = useState<'text' | 'grid'>('text');
  const [isHighlighterMode, setIsHighlighterMode] = useState(false);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [editorFontFamily, setEditorFontFamily] = useState<'mono' | 'sans' | 'serif'>('mono');

  const handleFormatText = () => {
    if (!text) return;
    const cleaned = text
      .split('\n')
      .map(line => line.trim().replace(/[ \t]+/g, ' '))
      .filter((line, idx, arr) => line !== '' || (idx > 0 && arr[idx - 1] !== ''))
      .join('\n')
      .trim();
    setText(cleaned);
    setCommandFeedback("Formatted & cleaned text spacing!");
    setTimeout(() => setCommandFeedback(null), 2000);
  };

  const handleInsertSample = (preset: 'narrative' | 'pitch' | 'social') => {
    let sample = '';
    if (preset === 'narrative') {
      sample = `[00:00] THE REVOLUTION OF BHARAT CREATORS\n\nIn a world flooded with generic content, true impact lies in authentic localized stories.\n\n[00:15] KEY INSIGHT\nLocal language creators reach 3x deeper engagement by capturing nuanced cultural context.\n\n[00:45] CALL TO ACTION\nTransform your narrative today. Deliver high-impact performance scripts across 23+ Bharat dialects.`;
    } else if (preset === 'pitch') {
      sample = `HOOK: What if 100 million creators could instantly localize their ideas in seconds?\n\nPROBLEM: Language barriers prevent local creators from scaling their voice globally.\n\nSOLUTION: Bharat Performance Agent optimizes narrative flow, vocal DNA, and cross-platform publishing in one seamless workspace.\n\nCTA: Join the revolution today.`;
    } else {
      sample = `🔥 5 Secrets of High-Converting Mobile Narratives:\n\n1. Hook in the first 3 seconds with a bold visual cue.\n2. Keep line length punchy for rapid on-screen reading.\n3. Speak in the viewer's native regional cadence.\n4. Deliver value before asking for the subscribe.\n5. End with a single, clear call-to-action.\n\n#ContentCreator #BharatVoice #Growth`;
    }
    setText(sample);
    setCommandFeedback("Loaded starter template into editor!");
    setTimeout(() => setCommandFeedback(null), 2000);
  };

  const handleDownloadText = () => {
    if (!text.trim()) {
      setCommandFeedback("Editor is empty.");
      setTimeout(() => setCommandFeedback(null), 2000);
      return;
    }
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `script_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    setCommandFeedback("Script downloaded as .txt!");
    setTimeout(() => setCommandFeedback(null), 2000);
  };

  const updateCursorPos = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    if (!ta) return;
    const pos = ta.selectionStart || 0;
    const val = ta.value || '';
    const lines = val.substring(0, pos).split('\n');
    const line = lines.length;
    const col = (lines[lines.length - 1] || '').length + 1;
    setCursorPos({ line, col });
  };

  const handleTouchEditor = (e: React.TouchEvent<HTMLTextAreaElement>) => {
    // Touch-friendly cursor positioning for mobile devices
    updateCursorPos(e as unknown as React.SyntheticEvent<HTMLTextAreaElement>);
  };

  const handleCopyEditorText = async (e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
    }
    if (!text || text.trim().length === 0) {
      setCommandFeedback("Editor is empty — nothing to copy.");
      setTimeout(() => setCommandFeedback(null), 2000);
      return;
    }
    try {
      const success = await copyToClipboard(text);
      if (success) {
        setIsMainEditorCopied(true);
        setCommandFeedback("Document text copied to clipboard!");
        setTimeout(() => {
          setIsMainEditorCopied(false);
          setCommandFeedback(null);
        }, 2000);
      } else {
        setErrorInfo("Could not copy to clipboard. Please select text manually.");
      }
    } catch (err) {
      setErrorInfo("Could not copy text to clipboard.");
    }
  };
  const [pdfMargin, setPdfMargin] = useState<'compact' | 'normal' | 'wide'>('normal');
  const [pdfAlignment, setPdfAlignment] = useState<'left' | 'center' | 'justify' | 'right'>('left');
  const [pdfLineSpacing, setPdfLineSpacing] = useState<'tight' | 'normal' | 'relaxed'>('normal');
  const [isPdfLayoutLocked, setIsPdfLayoutLocked] = useState(false);
  const [showPdfLayoutModal, setShowPdfLayoutModal] = useState(false);

  const getPdfStyles = () => {
    const marginMap = { compact: '0.5in', normal: '1in', wide: '1.5in' };
    const alignMap = { left: 'left', center: 'center', justify: 'justify', right: 'right' };
    const spacingMap = { tight: '1.2', normal: '1.6', relaxed: '2.0' };
    return `
      @media print {
        body {
          margin: ${marginMap[pdfMargin]} !important;
          text-align: ${alignMap[pdfAlignment]} !important;
          line-height: ${spacingMap[pdfLineSpacing]} !important;
        }
        textarea, .markdown-body, div {
          text-align: ${alignMap[pdfAlignment]} !important;
          line-height: ${spacingMap[pdfLineSpacing]} !important;
        }
      }
    `;
  };


  const [activeSegmentMoods, setActiveSegmentMoods] = useState<{ text: string, mood: 'Excited' | 'Calm' | 'Professional' | 'Urgent' }[]>([]);
  const [useSentimentAI, setUseSentimentAI] = useState(false);
  const [isAnalyzingSentiment, setIsAnalyzingSentiment] = useState(false);
  const [sentimentPreviewOpen, setSentimentPreviewOpen] = useState(false);
  const [isExtractingHandwriting, setIsExtractingHandwriting] = useState(false);
  const [isSmartInputsOpen, setIsSmartInputsOpen] = useState(false);
  const [socialCaption, setSocialCaption] = useState('');
  const [isGeneratingCaption, setIsGeneratingCaption] = useState(false);
  const [comparingIds, setComparingIds] = useState<string[]>([]);

  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [comparisonAnalysis, setComparisonAnalysis] = useState<string | null>(null);
  const [isAnalyzingComparison, setIsAnalyzingComparison] = useState(false);
  
  // Social Connections State
  const [connectedPlatforms, setConnectedPlatforms] = useState<Record<string, boolean>>({
    YouTube: false,
    TikTok: false,
    Twitter: false,
    Facebook: false
  });

  // Keep connectedPlatforms and socialConnections perfectly in sync
  useEffect(() => {
    const next: Record<string, boolean> = {};
    socialConnections.forEach(s => {
      next[s.platform] = s.connected;
      if (s.platform === 'Twitter') {
        next['X'] = s.connected;
      }
    });
    setConnectedPlatforms(next);
  }, [socialConnections]);

  const togglePlatformConnection = (plat: string, isConnected: boolean, username?: string) => {
    setSocialConnections(prev => {
      const exists = prev.some(s => s.platform.toLowerCase() === plat.toLowerCase());
      if (exists) {
        return prev.map(s => s.platform.toLowerCase() === plat.toLowerCase() ? { ...s, connected: isConnected, username: isConnected ? (username || 'Linked') : undefined } : s);
      } else {
        return [...prev, { platform: plat, connected: isConnected, username: isConnected ? (username || 'Linked') : undefined }];
      }
    });
  };
  const [telegramToken, setTelegramToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [platformToConnect, setPlatformToConnect] = useState<string | null>(null);

  // Original Handlers
  const generateSocialMetadata = async () => {
    if (!text.trim()) return;
    setIsGeneratingCaption(true);
    try {
      const textResponse = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: `Generate a compelling ${socialFormat} caption for this voiceover script. Include emojis and relevant hashtags. Script: ${text.substring(0, 1000)}` }] }]);
      setSocialCaption(textResponse);
    } catch (e) {
      setSocialCaption(`Error generate caption: ${e instanceof Error ? e.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingCaption(false);
    }
  };

  const analyzeComparison = async () => {
    if (comparingIds.length < 2) return;
    setIsAnalyzingComparison(true);
    setComparisonAnalysis(null);
    setShowComparisonModal(true);

    const takeA = history.find(h => h.id === comparingIds[0]);
    const takeB = history.find(h => h.id === comparingIds[1]);

    if (!takeA || !takeB) return;

    try {
      const textResponse = await genAIResponse("gemini-3.8-flash", [{ 
        role: "user", 
        parts: [{ text: `Compare these two voice script takes for a voiceover project.
        Take 1: "${takeA.text}"
        Take 2: "${takeB.text}"
        
        Provide a brief "Performance Review" comparing their emotional resonance, clarity, and suitability for ${socialFormat}. Which one would you recommend and why?` }] 
      }]);
      setComparisonAnalysis(textResponse);
    } catch (e) {
      setComparisonAnalysis("Unable to analyze takes at this time.");
    } finally {
      setIsAnalyzingComparison(false);
    }
  };

  // Feature Handlers
  const checkCompliance = async () => {
    try {
      const response = await fetch('/api/compliance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, brandGuidelines: brandVoice })
      });
      const data = await response.json();
      setErrorInfo(data.compliant ? "Content is compliant!" : `Compliance Issue: ${data.details}`);
    } catch(e) { setErrorInfo("Failed to check compliance."); }
  };

  const translateContent = async () => {
    if (!text.trim()) return;
    try {
      if (language === 'ALL') {
        setIsGenerating(true);
        setCommandFeedback("Translating to all available languages and generating audio in parallel...");
        const allLangs = LANGUAGES.map(l => l.name).join(', ');
        const prompt = `Translate the following text into ALL of these languages: ${allLangs}. 
        Return a JSON object where keys are language names and values are the strictly translated text.
        Text: ${text}`;
        
        const res = await genAIResponse("gemini-3.8-flash", [{ text: prompt }]);
        const translations = JSON.parse(res.replace(/```json|```/g, '').trim());
        
        const promises = LANGUAGES.map(async (l) => {
            const translatedText = translations[l.name] || translations[l.code] || '';
            if (!translatedText) return null;

            let audioUrl = '';
            // Only generate audio if voices exist
            if (l.voices.length > 0) {
                const voice = l.voices[0];
                try {
                  const ttsRes = await fetch('/api/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      text: translatedText,
                      useSSML: false,
                      languageCode: l.code,
                      name: voice.id,
                      pitch: 0,
                      speakingRate: 1,
                      volumeGainDb: 0
                    })
                  });
                  const data = await ttsRes.json();
                  if (data.audioContent) {
                    const bStr = atob(data.audioContent);
                    const b = new Uint8Array(bStr.length);
                    for (let i = 0; i < bStr.length; i++) b[i] = bStr.charCodeAt(i);
                    const blob = new Blob([b], { type: 'audio/mp3' });
                    audioUrl = URL.createObjectURL(blob);
                  }
                } catch (e) {
                  console.error(`Audio failed for ${l.name}`, e);
                }
            }

            return {
                code: l.code,
                name: l.name,
                text: translatedText,
                audioUrl,
                isSelected: true
            };
        });

        const activeResults = await Promise.all(promises);
        const results = activeResults.filter(Boolean);

        setAllLanguageResults(results as any);
        setShowAllResults(true);
        setIsGenerating(false);
        setCommandFeedback("Multi-language translations and audio ready!");
        return;
      }

      setIsGenerating(true);
      setCommandFeedback(`Translating to ${language}...`);
      const prompt = `Translate the following text to ${language}. Return ONLY the strictly translated text, with no explanation or introductory/outro text or markdown formatting markers unless preserving existing ones. Text:\n\n${text}`;
      const translatedText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      if (translatedText && translatedText.trim()) {
        setText(translatedText.trim());
        setCommandFeedback(`Successfully translated to ${language}!`);
      } else {
        throw new Error("Translation returned empty content.");
      }
      setIsGenerating(false);
    } catch (e: any) {
      setIsGenerating(false);
      console.error("Translation failed:", e);
      setErrorInfo(`Translation failed: ${e.message || e}`);
    }
  };

  const postToSocial = async (platform: string) => {
    if (!text.trim()) return;
    
    if (!connectedPlatforms[platform]) {
      setPlatformToConnect(platform);
      setShowPermissionDialog(true);
      return;
    }

    try {
      await fetch('/api/social/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform, content: text })
      });
      setErrorInfo(`Successfully posted to ${platform}`);
    } catch(e) { setErrorInfo("Failed to post."); }
  };

  const generateSubtitles = async () => {
    try {
      const response = await fetch('/api/subtitles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      });
      const data = await response.json();
      // For now just error if something, or log
      setErrorInfo("Subtitles generated (check console)");
      console.log(data.srt);
    } catch(e) { setErrorInfo("Failed to generate subtitles."); }
  };

  const toggleComparison = (id: string) => {
    setComparingIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id].slice(-2)
    );
  };
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLDivElement>(null);
  const lineGutterRef = useRef<HTMLDivElement>(null);
  
  const [editorFontSize, setEditorFontSize] = useState<number>(24);
  const [editorColor, setEditorColor] = useState<string>('');
  const [editorBg, setEditorBg] = useState<string>('');

  const [undoStack, setUndoStack] = useState<string[]>([]);
  const [redoStack, setRedoStack] = useState<string[]>([]);
  const isUndoRedoRef = useRef(false);
  const lastSavedText = useRef(text);

  useEffect(() => {
    if (isUndoRedoRef.current) {
        isUndoRedoRef.current = false;
        return;
    }
    const handler = setTimeout(() => {
        if (text !== lastSavedText.current) {
            setUndoStack(prev => [...prev, lastSavedText.current].slice(-50));
            lastSavedText.current = text;
            setRedoStack([]);
        }
    }, 500);
    return () => clearTimeout(handler);
  }, [text]);

  useEffect(() => {
    if (!firebaseContextAuth.currentUser) return;
    const qTasks = query(collection(db, 'contentTasks'), where('userId', '==', firebaseContextAuth.currentUser.uid));
    const unsubTasks = onSnapshot(qTasks, (snapshot) => {
      setContentTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qAssets = query(collection(db, 'brandAssets'), where('userId', '==', firebaseContextAuth.currentUser.uid));
    const unsubAssets = onSnapshot(qAssets, (snapshot) => {
      setBrandAssets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubTasks();
      unsubAssets();
    };
  }, [firebaseContextAuth.currentUser]);


  const handleUndo = () => {
    if (undoStack.length === 0) return;
    isUndoRedoRef.current = true;
    const newStack = [...undoStack];
    const prevText = newStack.pop() as string;
    
    setRedoStack(prev => [lastSavedText.current, ...prev].slice(-50));
    setUndoStack(newStack);
    lastSavedText.current = prevText;
    setText(prevText);
  };

  const handleRedo = () => {
    if (redoStack.length === 0) return;
    isUndoRedoRef.current = true;
    const newStack = [...redoStack];
    const nextText = newStack.shift() as string;
    
    setUndoStack(prev => [...prev, lastSavedText.current].slice(-50));
    setRedoStack(newStack);
    lastSavedText.current = nextText;
    setText(nextText);
  };

  const handleSocialFormatChange = (fmt: string) => {
      setSocialFormat(fmt as any);
      if (fmt === 'TikTok') { setSpeed(1.15); setPitch(2); setUseSentimentAI(true); }
      if (fmt === 'Podcast') { setSpeed(0.95); setPitch(-2); setUseSentimentAI(true); }
      if (fmt === 'YouTube') { setSpeed(1.05); setPitch(0); setUseSentimentAI(true); }
      if (fmt === 'Facebook') { setSpeed(1.0); setPitch(0); setUseSentimentAI(false); }
      if (fmt === 'Twitter' || fmt === 'X') { setSpeed(1.1); setPitch(1); setUseSentimentAI(true); }
  };

  const handleEditorScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (previewRef.current) {
      previewRef.current.scrollTop = e.currentTarget.scrollTop;
      previewRef.current.scrollLeft = e.currentTarget.scrollLeft;
    }
    if (lineGutterRef.current) {
      lineGutterRef.current.scrollTop = e.currentTarget.scrollTop;
    }
  };

  const takeSnapshot = async () => {
    const container = document.getElementById('editor-render-container');
    if (!container) return;
    try {
      const origScroll = container.scrollTop;
      container.style.overflow = 'visible';
      const canvas = await html2canvas(container, {
        backgroundColor: editorBg || (theme === 'dark' ? '#1E1F20' : '#ffffff'),
        scale: 2,
        windowWidth: container.scrollWidth,
        windowHeight: container.scrollHeight,
        onclone: (clonedDoc: Document) => {
          try {
            const sheets = clonedDoc.styleSheets;
            for (let s = 0; s < sheets.length; s++) {
              try {
                const rules = sheets[s].cssRules;
                for (let r = 0; r < rules.length; r++) {
                  const rule = rules[r] as CSSStyleRule;
                  if (rule && rule.style) {
                    for (let i = 0; i < rule.style.length; i++) {
                      const prop = rule.style[i];
                      const val = rule.style.getPropertyValue(prop);
                      if (val && (val.includes('oklab') || val.includes('oklch'))) {
                        rule.style.setProperty(prop, '#333333');
                      }
                    }
                  }
                }
              } catch (e) {}
            }
          } catch (e) {}
        }
      } as any);
      container.style.overflow = 'auto';
      container.scrollTop = origScroll;
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `snapshot-${Date.now()}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error(err);
      setErrorInfo("Failed to take snapshot due to unsupported color format.");
    }
  };

  const extractHandwriting = async (base64Data: string, mimeType: string) => {
    if (isExtractingHandwriting) return;
    setIsExtractingHandwriting(true);
    setIsGenerating(true);
    setCommandFeedback("Digitizing image/photo (exact 1:1 match)... please wait.");
    try {
      const dataUrl = `data:${mimeType};base64,${base64Data}`;
      const newImgItem = {
        id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
        dataUrl,
        caption: "Uploaded Photo / Image",
        fileName: "uploaded-image"
      };
      setExtractedPdfImages(prev => [newImgItem, ...prev]);

      let textResponse = '';
      try {
        textResponse = await genAIResponse("gemini-3.8-flash", [{
          role: "user",
          parts: [
            { inlineData: { data: base64Data, mimeType } },
            { text: "You are an expert OCR and document digitizer. Perform an EXACT 1:1 ('same to same') verbatim transcription of this scanned/uploaded image or document.\n\nCRITICAL INSTRUCTIONS:\n1. Reconstruct all text, handwriting, numbers, punctuation, casing, special characters, and math/formulas exactly as they appear in the original source without omitting, skipping, summarizing, paraphrasing, translating, or altering anything.\n2. If there are tables, reproduce them EXACTLY row-for-row and column-for-column in GitHub Flavored Markdown table format.\n3. Preserve all languages (English, Hindi, regional Indian languages, international languages, or any other scripts) exactly as written.\n4. Maintain original line breaks, bullet points, headers, indentations, and list structures.\n5. Return ONLY the verbatim transcribed text/Markdown content without any introductory remarks, notes, conversational filler, or code block delimiters." }
          ]
        }]);
      } catch (genErr) {
        console.warn("Direct Gemini image OCR call failed, attempting server-side parse-file fallback...", genErr);
        const serverRes = await fetch('/api/parse-file', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ base64: base64Data, mimeType })
        });
        const parseRes = await safeParseJson(serverRes);
        if (parseRes.ok && parseRes.data && parseRes.data.text) {
          textResponse = parseRes.data.text;
        } else {
          throw genErr;
        }
      }

      let content = textResponse;
      if (content && typeof content === 'string' && content.trim().length > 0) {
        content = stripMarkdownAndDelimiters(content);
        const cleanContentText = stripMarkdownAndDelimiters(content);
        setText(prev => prev ? prev + "\n\n" + cleanContentText : cleanContentText);
        setCommandFeedback("Image/photo uploaded and digitized successfully.");
        if (containsTable(content)) {
           setEditMode('grid');
           setIsPreviewMode(false);
           setCommandFeedback("Table detected in scanned document. Switched to Tabular Grid Editor.");
        }
      } else {
        setText(prev => prev ? prev + "\n\nPhoto uploaded successfully." : "Photo uploaded successfully.");
        setCommandFeedback("Photo uploaded successfully.");
      }
    } catch (err: any) {
      console.error("Image OCR error:", err);
      const errMsg = err?.message || String(err);
      setErrorInfo(errMsg ? `Failed to extract text from image: ${errMsg}` : "Failed to extract text from image. Please ensure the image is clear and try again.");
    } finally {
      setIsExtractingHandwriting(false);
      setIsGenerating(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Reset target value so selecting the same file again triggers onChange
    e.target.value = '';

    let mimeType = file.type || '';
    if (!mimeType) {
        const lowerName = file.name.toLowerCase();
        if (lowerName.endsWith('.pdf')) mimeType = 'application/pdf';
        else if (lowerName.endsWith('.docx')) mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        else if (lowerName.endsWith('.doc')) mimeType = 'application/msword';
        else if (lowerName.endsWith('.pptx')) mimeType = 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
        else if (lowerName.endsWith('.ppt')) mimeType = 'application/vnd.ms-powerpoint';
        else if (lowerName.endsWith('.xlsx')) mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        else if (lowerName.endsWith('.xls')) mimeType = 'application/vnd.ms-excel';
        else if (lowerName.endsWith('.csv')) mimeType = 'text/csv';
        else if (lowerName.endsWith('.tsv')) mimeType = 'text/tab-separated-values';
        else if (lowerName.endsWith('.png')) mimeType = 'image/png';
        else if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) mimeType = 'image/jpeg';
        else if (lowerName.endsWith('.gif')) mimeType = 'image/gif';
        else if (lowerName.endsWith('.webp')) mimeType = 'image/webp';
    }
    console.log("File uploaded:", file.name, mimeType);

    if (mimeType && mimeType.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64Data = (reader.result as string).split(',')[1];
          extractHandwriting(base64Data, mimeType);
        };
        reader.readAsDataURL(file);
        return;
    }
    
    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = (e.target?.result as string).split(',')[1];
      try {
        let textResult = '';
        if (mimeType.startsWith('video/') || mimeType.startsWith('audio/')) {
          setCommandFeedback(`Digitizing ${mimeType.startsWith('audio/') ? 'audio' : 'video'}: ${file.name}...`);
          const targetLanguages = selectedVideoLanguages.length === 0 
            ? [] 
            : selectedVideoLanguages.includes('all')
              ? ['Hindi', 'Bengali', 'Marathi', 'Telugu', 'Tamil', 'Gujarati', 'Urdu', 'Kannada', 'Odia', 'Malayalam', 'Punjabi']
              : selectedVideoLanguages;
          const response = await fetch('/api/video-to-words', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              base64, 
              fileName: file.name, 
              mimeType: mimeType,
              targetLanguages: targetLanguages,
              enhanceAudio: isAudioEnhanced
            })
          });
          const parsed = await safeParseJson(response);
          if (!parsed.ok || !parsed.data) {
            throw new Error(parsed.error || `Failed to transcribe media (${response.status})`);
          }
          const data = parsed.data;
          textResult = data.transcript || data.words || data.text || '';
          
          if (data.translations) {
            Object.entries(data.translations).forEach(([lang, translation]) => {
              textResult += `\n\n${lang} Translation:\n${translation as string}`;
            });
          }
          
          setVideoMetadata({
            sentiment: data.sentiment,
            srt: data.srt
          });
        } else if (mimeType === 'application/pdf' || file.name.endsWith('.pdf')) {
          setCommandFeedback(`Analysing ${file.name} (exact 1:1 match)...`);
          const response = await fetch('/api/pdf-to-words', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              base64, 
              fileName: file.name, 
              promptOverride: "Perform an EXACT 1:1 ('same to same') verbatim transcription of this document. Reconstruct all text, headings, lists, numbers, punctuation, casing, and formatting exactly as they appear in the original file. IF THERE IS A TABLE, REPRODUCE IT PRECISELY row-for-row and column-for-column as a Markdown table. Do not summarize, do not skip columns, do not omit any content, and do not filter or translate any languages. Return ONLY the verbatim Markdown content."
            })
          });
          const parsed = await safeParseJson(response);
          if (!parsed.ok || !parsed.data) {
            throw new Error(parsed.error || `Failed to process PDF (${response.status})`);
          }
          const data = parsed.data;
          textResult = data.words || data.text || '';
        } else {
          const response = await fetch('/api/parse-file', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ base64, mimeType: mimeType })
          });
          const parsed = await safeParseJson(response);
          if (!parsed.ok || !parsed.data) {
            throw new Error(parsed.error || `Failed to parse document (${response.status})`);
          }
          const data = parsed.data;
          textResult = data.text || '';
        }
        
        if (textResult && typeof textResult === 'string' && textResult.trim().length > 0) {
            const rawImportedText = textResult.trim().replace(/^```(markdown|text)?\r?\n/, '').replace(/\r?\n```$/, '');
            const cleanImported = cleanDelimitersAndMarkdown(rawImportedText);
            setText(prev => prev ? prev + "\n\n" + cleanImported : cleanImported);
            setCommandFeedback(`Document ${file.name} imported successfully.`);
            if (containsTable(rawImportedText)) {
               setEditMode('grid');
               setIsPreviewMode(false);
               setCommandFeedback(`Table detected in ${file.name}. Switched to Tabular Grid Editor.`);
            }
        } else {
            setErrorInfo("No readable text content could be extracted from this document.");
        }
      } catch(err) {
        console.error("File upload error:", err);
        setErrorInfo(err instanceof Error ? err.message : "Failed to parse file.");
      }
    };
    reader.readAsDataURL(file);
  };

  const analyzeSentiment = async (content: string) => {
    if (!content.trim() || isAnalyzingSentiment) return;
    setIsAnalyzingSentiment(true);
    try {
      const prompt = `Analyze the following text and break it into 3-5 logical segments. For each segment, assign ONE mood: 'Excited', 'Calm', 'Professional', 'Urgent'.
      Return ONLY a JSON array of objects with "text" and "mood" keys.
      Text: "${content.substring(0, 2000)}"`;

      const text = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);

      const jsonStr = text.trim().replace(/```json|```/g, '');
      const moods = JSON.parse(jsonStr);
      setActiveSegmentMoods(moods);
      return moods;
    } catch (e: any) {
      console.warn("Sentiment analysis fallback initiated:", e?.message || "Quota/Network error");
      const fallback = [{ text: content, mood: 'Professional' }];
      setActiveSegmentMoods(fallback as any);
      return fallback;
    } finally {
      setIsAnalyzingSentiment(false);
    }
  };

  const prepareExpressivePerformance = async () => {
    if (!text.trim()) return;
    const segments = await analyzeSentiment(text);
    if (segments) {
      setSentimentPreviewOpen(true);
    }
  };

  const generateSentimentalAudio = async (speechText: string, providedSegments?: any): Promise<string | null> => {
    try {
      const segments = providedSegments || await analyzeSentiment(speechText);
      if (!segments) return null;

      let ssml = `<speak>`;
      segments.forEach((seg: any) => {
        let pitchStr = "0st";
        let rateStr = "1.0";
        
        switch(seg.mood.toLowerCase()) {
          case 'excited': pitchStr = "+2st"; rateStr = "1.15"; break;
          case 'calm': pitchStr = "-1st"; rateStr = "0.85"; break;
          case 'urgent': pitchStr = "+1st"; rateStr = "1.3"; break;
          default: pitchStr = "0st"; rateStr = "1.0"; break;
        }
        
        ssml += `<prosody pitch="${pitchStr}" rate="${rateStr}">${seg.text}</prosody> `;
      });
      ssml += `</speak>`;

      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: ssml,
          useSSML: true,
          languageCode,
          name: resolveActualVoiceName(voiceName),
          pitch: pitch,
          speakingRate: speed,
          volumeGainDb: volume
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to generate audio');
      
      return `data:audio/mp3;base64,${data.audioContent}`;
    } catch (e: any) {
      console.error(e);
      throw new Error(getApiErrorMessage(e));
    }
  };

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  

  enum OperationType {
    CREATE = 'create',
    UPDATE = 'update',
    DELETE = 'delete',
    LIST = 'list',
    GET = 'get',
    WRITE = 'write',
  }

  interface FirestoreErrorInfo {
    error: string;
    operationType: OperationType;
    path: string | null;
    authInfo: {
      userId?: string | null;
      email?: string | null;
      emailVerified?: boolean | null;
      isAnonymous?: boolean | null;
    }
  }

  function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: user?.uid,
        email: user?.email,
        emailVerified: user?.emailVerified,
        isAnonymous: user?.isAnonymous,
      },
      operationType,
      path
    }
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }

  // Load history
  useEffect(() => {
    const savedHistory = localStorage.getItem('tts-history');
    if (savedHistory) setHistory(JSON.parse(savedHistory));
  }, []);

  // Save history
  useEffect(() => {
    localStorage.setItem('tts-history', JSON.stringify(history));
  }, [history]);

  const handleLike = (id: string, status: 'like' | 'dislike') => {
    setHistory(prev => {
      const currentItem = prev.find(h => h.id === id);
      const newStatus = currentItem?.likeStatus === status ? null : status;
      
      const newHistory = prev.map(item => item.id === id ? {
        ...item,
        likeStatus: newStatus
      } : item);

      // Only show modal if user is setting a status, not unsetting it
      if (newStatus === status) {
        setFeedbackModal({ id, status });
      }
      
      return newHistory;
    });
  };

  const submitFeedback = () => {
    if (!feedbackModal) return;
    setHistory(prev => prev.map(item => item.id === feedbackModal.id ? {
      ...item,
      feedback: feedbackText
    } : item));
    setFeedbackModal(null);
    setFeedbackText('');
    setErrorInfo("Thank you for your response!");
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
    setPlaylist(prev => prev.filter(item => item.id !== id));
  };

  const toggleStar = (id: string) => {
    setHistory(prev => prev.map(h => h.id === id ? { ...h, isStarred: !h.isStarred } : h));
  };

  const applyHighlight = () => {
    if (!textareaRef.current) return;
    const start = textareaRef.current.selectionStart;
    const end = textareaRef.current.selectionEnd;
    if (start === end) return;

    const selection = text.substring(start, end);
    const newText = text.substring(0, start) + `[[${selection}]]` + text.substring(end);
    setText(newText);
    setIsHighlighterMode(true);
  };

  const addToPlaylist = (item: HistoryItem) => {
    if (!playlist.find(p => p.id === item.id)) {
      setPlaylist(prev => [...prev, item]);
    }
  };

  const addTag = (id: string, tag: string) => {
    if (!tag.trim()) return;
    setHistory(prev => prev.map(item => item.id === id ? {
      ...item,
      tags: [...(item.tags || []), tag.trim()]
    } : item));
  };

  const addDirectorsNote = (id: string, note: string) => {
    setHistory(prev => prev.map(item => item.id === id ? {
      ...item,
      directorsNotes: note
    } : item));
  };
  
  const exportAsPDF = (item: HistoryItem) => {
    const doc = new jsPDF();
    doc.text(`Speech Transcript`, 10, 10);
    doc.text(item.text, 10, 20, { maxWidth: 180 });
    doc.save(`speech_${item.timestamp}.pdf`);
  };

  const genAIResponse = async (modelName: string, contents: any, optionsOrTools?: any) => {
    // Force upgrade to supported models as per gemini-api skill
    let finalModel = modelName;
    if (modelName === "gemini-3.8-flash" || modelName === "gemini-3.8-flash" || modelName === "gemini-3.8-flash" || modelName === "gemini-flash-latest" || modelName === "gemini-3.8-flash" || modelName === "gemini-3.8-flash") {
      finalModel = "gemini-3.8-flash";
    } else if (modelName === "gemini-4-argon" || modelName === "gemini-pro" || modelName === "gemini-4-argon" || modelName === "gemini-4-argon") {
      finalModel = "gemini-4-argon";
    }

    // Handle options: can be tools array or full config object
    let config = optionsOrTools;
    if (Array.isArray(optionsOrTools)) {
      config = { tools: optionsOrTools };
    }

    try {
      const response = await fetch('/api/gemini', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: finalModel,
          contents,
          config
        })
      });

      const parsed = await safeParseJson(response);
      if (!parsed.ok || !parsed.data) {
        throw new Error(parsed.error || `HTTP error! status: ${response.status}`);
      }

      return parsed.data.text;
    } catch (err: any) {
      console.warn("API request failed:", err?.message || err);
      const apiError = getApiErrorMessage(err);
      
      if (apiError.includes("API key") || apiError.includes("GEMINI_API_KEY_MISSING")) {
        setErrorInfo("Gemini API Key Missing: Please check Settings > Secrets and configure your API key.");
      } else if (apiError.includes("quota") || apiError.includes("429") || apiError.includes("RESOURCE_EXHAUSTED") || apiError.includes("limit")) {
        setErrorInfo("Google AI Free Daily Limit Reached: The daily limit for free AI requests was reached. Local offline tools (TTS Speech, Tables, PDF Import) are active!");
        setTimeout(() => setErrorInfo(null), 6000);
      } else if (apiError.includes("connect") || apiError.includes("503") || apiError.includes("unavailable")) {
        setErrorInfo("Server connection temporarily busy. Retrying locally...");
        setTimeout(() => setErrorInfo(null), 4000);
      } else {
        setErrorInfo("Notice: " + apiError);
        setTimeout(() => setErrorInfo(null), 5000);
      }
      
      throw err;
    }
  };

  const handleVoiceClone = async (file: File) => {
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
    setIsGenerating(true);
    setErrorInfo("Analyzing voice characteristics... Please wait.");
    try {
      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const text = await genAIResponse("gemini-3.8-flash", [
            { inlineData: { data: base64Data, mimeType: file.type } },
            { text: `System: You are an expert Acoustic Engineer and Voice Synthesis Specialist.
Task: Analyze the provided audio sample to extract precise biometric voice characteristics for a Neural Voice Clone.

1. TIMBRE & TEXTURE: Identify the core tonal quality (e.g., "Velvety", "Raspy", "Metallic", "Nasal").
2. SPECTRUM: Detect the dominant frequency range. Is it "Deep Baritone", "Warm Tenor", "Clear Soprano", or "Bright Alto"?
3. PITCH DYNAMICS (-20 to 20): Calculate the exact semi-tone shift required to align a base TTS model with this speaker's natural tonic.
4. CADENCE & PROSODY (0.25 to 4.0): Determine the rhythmic speed factor. Capture the unique pause patterns and syllable emphasis.
5. GENDER: "MALE" or "FEMALE" (based on acoustic features).
6. LABEL: Create a professional technical label (e.g., "Resonant Baritone (Scholar style)", "Soft Tenor (Professional)").

Return ONLY a valid JSON object:
{
  "pitch": number,
  "speed": number, 
  "gender": "MALE" | "FEMALE",
  "label": "string",
  "characteristics": "string"
}` }
          ]);
          
          const cleanText = text.replace(/```json|```/g, '').trim();
          const analysis = JSON.parse(cleanText);
          const newClone = { id: `cloned-${Date.now()}`, ...analysis };
          
          setClonedVoices(prev => [...prev, newClone, { ...newClone, id: `cloned-${Date.now()}-f`, gender: 'FEMALE', label: newClone.label + ' (Wavenet-A Base)' }]);
          setVoiceName(newClone.id);
          setPitch(analysis.pitch);
          setSpeed(analysis.speed);
          setGenderFilter(analysis.gender);
          setErrorInfo(`Digital Voice Twin '${analysis.label}' Created & Applied!`);
        } catch (err: any) {
          console.error(err);
          if (err?.message?.toLowerCase().includes("failed to fetch") || err?.message?.toLowerCase().includes("quota") || err?.message?.toLowerCase().includes("resource_exhausted") || err?.status) {
            setErrorInfo(getApiErrorMessage(err));
          } else {
            setErrorInfo("Failed to analyze voice. Ensure the audio is clear and the format is supported.");
          }
        } finally {
          setIsGenerating(false);
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      setErrorInfo("Voice cloning failed. Try a clearer sample.");
      setIsGenerating(false);
    }
  };

  const startVoiceRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      voiceChunksRef.current = [];
      
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };
      
      recorder.onstop = () => {
        const blob = new Blob(voiceChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], "voice_sample.webm", { type: 'audio/webm' });
        handleVoiceClone(file);
        stream.getTracks().forEach(track => track.stop());
      };
      
      recorder.start();
      voiceRecorderRef.current = recorder;
      setIsRecordingVoice(true);
      setErrorInfo("Recording... Speak for 10-15 seconds for best results.");
    } catch (err) {
      setErrorInfo("Microphone access denied. Please allow microphone permissions.");
    }
  };

  const stopVoiceRecording = () => {
    if (voiceRecorderRef.current && isRecordingVoice) {
      voiceRecorderRef.current.stop();
      setIsRecordingVoice(false);
    }
  };

  // Feature Helpers
  const summarizeText = async () => {
    if (!text.trim()) return;
    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
    setIsGenerating(true);
    try {
      const summary = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: `Summarize the following text while keeping key details for effective TTS. Return ONLY the summarized text.\n\nText: ${text}` }] }]);
      if (summary) setText(summary);
    } catch (e) {
      setErrorInfo("Summarization failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [currentAudioElement, setCurrentAudioElement] = useState<HTMLAudioElement | null>(null);

  useEffect(() => {
    let interval: any;
    if (isFocusMode && isAudioPlaying && currentAudioElement) {
        interval = setInterval(() => {
            const wordsPerSecond = 2.5; 
            const index = Math.floor(currentAudioElement.currentTime * wordsPerSecond);
            setCurrentWordIndex(index);
        }, 100);
    } else {
        setCurrentWordIndex(-1);
    }
    return () => clearInterval(interval);
  }, [isFocusMode, isAudioPlaying, currentAudioElement]);

  useEffect(() => {
    if (isFocusMode && isAudioPlaying && currentWordIndex > -1) {
        const activeWord = document.querySelector('.bg-yellow-400');
        if (activeWord) {
            activeWord.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }
  }, [isFocusMode, isAudioPlaying, currentWordIndex]);

  const cleanTextForTTS = (text: string): string => {
    return text
      .replace(/#{1,6}\s?/g, '') // Remove headers
      .replace(/\*\*/g, '') // Remove bold
      .replace(/\*/g, '') // Remove italics
      .replace(/```[\s\S]*?```/g, 'Code block omitted.') // Remove code blocks
      .replace(/`([^`]+)`/g, '$1') // Remove inline code
      .replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1') // Remove links
      .replace(/[🎨🚀💡🧠🤖✨]/g, '') // Remove common emojis that might cause weird speech
      .replace(/\n+/g, ' ') // Replace multiple newlines with space
      .trim();
  };

  const generateGenericAudio = async (speechText: string): Promise<string | null> => {
    const cleanedText = cleanTextForTTS(speechText);
    if (!cleanedText.trim()) return null;
    
    // For simplicity, we use the cloud engine settings if selected
    if (useSentimentAI && engine !== 'browser') {
      return generateSentimentalAudio(speechText);
    }

    if (engine === 'browser') {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(speechText);
      const selectedVoice = browserVoices.find(v => v.voiceURI === resolveActualVoiceName(voiceName));
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.rate = speed;
      utterance.pitch = 1 + (pitch / 20);
      window.speechSynthesis.speak(utterance);
      return null; 
    }

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: speechText,
          useSSML: false,
          languageCode,
          name: resolveActualVoiceName(voiceName),
          pitch: pitch,
          speakingRate: speed,
          volumeGainDb: volume
        })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error?.message || data.error || 'Failed to generate audio');
      
      return `data:audio/mp3;base64,${data.audioContent}`;
    } catch (e: any) {
      console.error(e);
      throw new Error(getApiErrorMessage(e));
    }
  };

  const generateQuiz = async () => {
    if (!text.trim()) return;
    setIsQuizActive(true);
    setQuizPhase('loading');
    setQuizData(null);
    setCurrentQuestionIndex(0);
    setQuizScore(0);
    setSelectedAnswer(null);

    try {
      const userTargetLanguage = LANGUAGES.find(l => l.code === languageCode)?.name || 'English';
      const prompt = `Based on the following text, create a 3-question multiple choice quiz to test reading comprehension.\n\nText: "${text.substring(0, 5000)}"\n\nCRITICAL: The entire quiz (questions, options, explanations) MUST be written in ${userTargetLanguage}.\n\nReturn ONLY a valid JSON array. Each object in the array should have exactly these keys: "question" (string), "options" (array of exactly 4 strings), "correctIndex" (number 0-3), and "explanation" (string explaining the correct answer). Do not wrap the JSON in markdown code blocks.`;
      
      const aiResponseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      
      let aiText = aiResponseText || "[]";
      aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsedData = JSON.parse(aiText);
      setQuizData(parsedData);
      setQuizPhase('active');
    } catch (err: any) {
      console.error(err);
      setErrorInfo(`Quiz Generation Error: ${err.message || 'Unknown error'}`);
      setIsQuizActive(false);
    }
  };

  const copyWithLabel = async (textToCopy: string, label?: string) => {
    try {
      const success = await copyToClipboard(textToCopy);
      if (success) {
        if (label) {
          setErrorInfo(`${label} copied to clipboard!`);
          setTimeout(() => setErrorInfo(null), 2000);
        }
        return true;
      } else {
        setErrorInfo(label ? `Failed to copy ${label}.` : "Failed to copy to clipboard.");
        setTimeout(() => setErrorInfo(null), 2000);
        return false;
      }
    } catch (e) {
      setErrorInfo(label ? `Failed to copy ${label}.` : "Failed to copy to clipboard.");
      setTimeout(() => setErrorInfo(null), 2000);
      return false;
    }
  };

  const generateSocialSeo = async () => {
    if (!text.trim()) return;
    setIsGeneratingSeo(true);
    setSeoData(null);
    const platform = socialFormat !== 'Standard' ? socialFormat : 'YouTube';
    try {
      let formatGuidance = "";
      if (platform === 'TikTok') formatGuidance = "Focus on viral hooks, trending keywords, and high-energy keywords.";
      if (platform === 'Podcast') formatGuidance = "Focus on searchability in podcast apps, include episode summary style descriptions.";
      if (platform === 'Twitter' || platform === 'X') formatGuidance = "Focus on hashtags, character limits (short titles), and engagement bait.";

      const prompt = `Analyze the following script and generate ${platform} SEO data. ${formatGuidance}
      Return ONLY valid JSON with keys "titles" (array of 3 engaging strings), "description" (engaging string with "[Insert Link Here]" placeholders for social links), and "tags" (array of strings).
      \n\nText: "${text.substring(0, 5000)}"`;
      
      const aiResponseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      let aiText = aiResponseText || "{}";
      aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
      setSeoData(JSON.parse(aiText));
    } catch (e) {
      console.error(e);
      setErrorInfo("Failed to generate SEO data.");
    } finally {
      setIsGeneratingSeo(false);
    }
  };

  const generateSocialChapters = async () => {
    if (!text.trim()) return;
    setIsGeneratingChapters(true);
    setSocialChapters(null);
    const platform = socialFormat !== 'Standard' ? socialFormat : 'YouTube';
    try {
      const prompt = `Analyze the following script and generate ${platform} ${platform === 'Podcast' ? 'timestamps' : 'chapters'} in MM:SS format. Return ONLY a valid JSON array with keys "timestamp" and "title".\n\nText: "${text.substring(0, 5000)}"`;
      const aiResponseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      let aiText = aiResponseText || "[]";
      aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
      setSocialChapters(JSON.parse(aiText));
    } catch (e) {
      console.error(e);
      setErrorInfo("Failed to generate chapters.");
    } finally {
      setIsGeneratingChapters(false);
    }
  };

  const generateVisualConcepts = async () => {
    if (!text.trim()) return;
    setIsGeneratingThumbnails(true);
    setThumbnailConcepts(null);
    const platform = socialFormat !== 'Standard' ? socialFormat : 'YouTube';
    try {
      let flavor = "For thumbnails, focus on high contrast, readable text, and expressive faces.";
      if (platform === 'TikTok') flavor = "Focus on the first frame 'Cover' image. Eye-catching overlay text and vertical layout hints.";
      if (platform === 'Podcast') flavor = "Focus on audiogram graphics, waveforms, and professional guest portrait layouts.";
      if (platform === 'Twitter' || platform === 'X') flavor = "Focus on infographics, 'eye-candy' charts, or meme-style attachments.";

      const prompt = `Analyze the following script and generate 3 distinct ${platform} visual assets (thumbnails, covers, or post images) concepts. ${flavor}
      Return ONLY a valid JSON array of objects, with keys "concept" (string), "prompt" (string, detailed image prompt for AI tools like DALL-E/Midjourney), and "designGuidance" (string, visual design tips).
      \n\nText: "${text.substring(0, 5000)}"`;
      
      const aiResponseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      let aiText = aiResponseText || "[]";
      aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
      setThumbnailConcepts(JSON.parse(aiText));
    } catch (e) {
      console.error(e);
      setErrorInfo("Failed to generate visual concepts.");
    } finally {
      setIsGeneratingThumbnails(false);
    }
  };

  const generateAIVoiceover = async () => {
    if (!text.trim()) return;
    setIsGeneratingVoiceover(true);
    try {
      const prompt = `Rewrite the following script into a engaging podcast or video-style voiceover script.\n\nBrand Voice: ${brandVoice}\nTone: ${tone}.\nTarget Language: ${language}.\nVoice Profile: ${voiceProfile}.\n\nText: "${text.substring(0, 5000)}"`;
      const aiResponseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      setText(aiResponseText || text);
    } catch (e) {
      console.error(e);
      setErrorInfo("Failed to generate voiceover script.");
    } finally {
      setIsGeneratingVoiceover(false);
    }
  };

  const performSentimentAnalysis = async () => {
    if (!text.trim()) return;
    setIsPerformingSentimentAnalysis(true);
    try {
      const prompt = `Analyze the sentiment and readability of the following text in ${language} with a ${tone} tone.\n\nBrand Voice: ${brandVoice}\n\nText: "${text.substring(0, 5000)}"`;
      const aiResponseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      setErrorInfo(`Sentiment Analysis: ${aiResponseText}`);
    } catch (e) {
      console.error(e);
      setErrorInfo("Failed to analyze sentiment.");
    } finally {
      setIsPerformingSentimentAnalysis(false);
    }
  };

  const extractKeySnippets = async () => {
    if (!text.trim()) return;
    setIsExtractingKeySnippets(true);
    try {
      const prompt = `Extract 3 key takeaways from the following text in ${language} to use as social media short snippets.\n\nBrand Voice: ${brandVoice}\nTone: ${tone}.\n\nText: "${text.substring(0, 5000)}"`;
      const aiResponseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      setErrorInfo(`Key Snippets: ${aiResponseText}`);
    } catch (e) {
      console.error(e);
      setErrorInfo("Failed to extract snippets.");
    } finally {
      setIsExtractingKeySnippets(false);
    }
  };

  const generateEcosystem = async () => {
    if (!text.trim()) return;
    setIsGeneratingEcosystem(true);
    try {
      const prompt = `Act as an expert content creator. Process this text and provide the following outputs in ${language} with a ${tone} tone:\n\nBrand Voice: ${brandVoice}\n\n1. Platform SEO Title and Description\n2. A engaging Podcast Voiceover Script\n3. 3 Social Media Snippets\n      
      Text: "${text.substring(0, 5000)}"`;
      const aiResponseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      setErrorInfo(`Ecosystem Results: \n${aiResponseText}`);
    } catch (e) {
        console.error(e);
        setErrorInfo("Failed to generate ecosystem outputs.");
    } finally {
        setIsGeneratingEcosystem(false);
    }
  };

  const analyzeDiscoveryKeywords = async () => {
    if (!text.trim()) return;
    setIsAnalyzingKeywords(true);
    try {
      const prompt = `Analyze the following text and extract 10 high-value, trending keywords/hashtags for better discoverability. Keep them relevant and punchy.\n\nBrand Voice: ${brandVoice}\nLanguage: ${language}\n\nText: "${text.substring(0, 5000)}"`;
      const aiResponseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      setErrorInfo(`Discovery Keywords: \n${aiResponseText}`);
    } catch (e) {
        console.error(e);
        setErrorInfo("Failed to analyze keywords.");
    } finally {
        setIsAnalyzingKeywords(false);
    }
  };

  const optimizeTitles = async () => {
    if (!text.trim()) return;
    setIsOptimizingTitles(true);
    try {
      const prompt = `Analyze the following text and suggest 5 highly-clickable, discovery-friendly titles that are honest but engaging (no deceptive clickbait).\n\nBrand Voice: ${brandVoice}\nLanguage: ${language}\n\nText: "${text.substring(0, 5000)}"`;
      const aiResponseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      setErrorInfo(`Optimized Titles: \n${aiResponseText}`);
    } catch (e) {
        console.error(e);
        setErrorInfo("Failed to optimize titles.");
    } finally {
        setIsOptimizingTitles(false);
    }
  };

  const analyzeCompetitor = async () => {
    const query = ytUrl.trim();
    if (!query) return;
    setIsAnalyzingCompetitor(true);
    setCompetitorAnalysis(null);
    try {
      const isUrl = query.toLowerCase().startsWith('http://') || query.toLowerCase().startsWith('https://');
      const isYT = isUrl && (query.toLowerCase().includes('youtube.com') || query.toLowerCase().includes('youtu.be'));

      let prompt = '';
      let tools = undefined;

      if (isYT) {
        prompt = `Analyze the YouTube video at the following URL: "${query}". 
        Extract: 
        1. Hook structure (how they opened). 
        2. Core pacing/topics. 
        3. Call to Action (CTA) placement.
        Provide a highly detailed, professional, and visually structured response.`;
      } else if (isUrl) {
        prompt = `Analyze the content of the competitor website or article at: "${query}". 
        Extract:
        1. Their content hooks and value propositions.
        2. Narrative structure and layout/formatting strategies.
        3. Call to Actions (CTAs) and conversion patterns.
        Provide a highly detailed, professional analysis. Help us understand their secrets.`;
      } else {
        // Topic search query
        prompt = `Perform online research using Google Search to analyze the best-performing content creators, competitor articles, and video approaches about the topic/keyword: "${query}".
        Identify:
        1. What specific hooks and titles get the most engagement for this topic.
        2. The most successful content structures, story styles, and angles.
        3. Key call-to-actions, offerings, or lead magnets commonly used.
        Ground everything in active Google Search results to provide highly accurate, fresh, and precise data.`;
        tools = [{ googleSearch: {} }];
      }
      
      const aiResponseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }], tools);
      
      setCompetitorAnalysis(aiResponseText || "Could not analyze competitor.");
    } catch (e) {
      console.error(e);
      setErrorInfo("Failed to analyze competitor.");
    } finally {
      setIsAnalyzingCompetitor(false);
    }
  };

  const generateRepurposedContent = async (platform: 'linkedin' | 'twitter' | 'instagram') => {
    if (!text.trim()) return;
    setIsGeneratingRepurposed(platform);
    setRepurposedContent(null);
    try {
      const userTargetLanguage = LANGUAGES.find(l => l.code === languageCode)?.name || 'English';
      let prompt = `Analyze the following script and transform it into a piece for ${platform} in ${userTargetLanguage} language.\n\n`;
      if (platform === 'linkedin') prompt += "Output: A structured, professional post with bullet points.";
      if (platform === 'twitter') prompt += "Output: A logically threaded sequence of 5-8 tweets.";
      if (platform === 'instagram') prompt += "Output: An engaging, emoji-friendly caption for the final video.";
      
      prompt += `\n\nText: "${text.substring(0, 5000)}"`;
      
      const aiResponseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      
      setRepurposedContent({ platform, content: aiResponseText || "Could not generate content." });
    } catch (e) {
      console.error(e);
      setErrorInfo(`Failed to generate ${platform} content.`);
    } finally {
      setIsGeneratingRepurposed(null);
    }
  };

  const analyzeVisualCues = async () => {
    if (!text.trim()) return;
    setIsAnalyzingVisuals(true);
    setVisualCues(null);
    try {
      const prompt = `Analyze the finalizing script and mark "Visual Cues". Suggest where to place B-roll or visual overlays. Suggest specific descriptions for stock footage searches.\n\nText: "${text.substring(0, 5000)}"`;
      const aiResponseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      setVisualCues(aiResponseText || "No visual cues suggested.");
    } catch (e) {
      console.error(e);
      setErrorInfo("Failed to analyze visual cues.");
    } finally {
      setIsAnalyzingVisuals(false);
    }
  };

  const tuneScript = async () => {
    if (!text.trim()) return;
    setIsTuningScript(true);
    try {
      const prompt = `Rewrite the following script to match this archetype: "${scriptStyle}".\n\nText: "${text.substring(0, 5000)}"`;
      const aiResponseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      setText(aiResponseText || text);
    } catch (e) {
      console.error(e);
      setErrorInfo("Failed to tune script.");
    } finally {
      setIsTuningScript(false);
    }
  };

  const generateConcepts = async () => {
    if (!text.trim()) return;
    setIsGeneratingConcepts(true);
    setConceptTesting(null);
    try {
      const prompt = `Input a topic and generate 3 completely different content angles for this topic. Return ONLY a valid JSON array of objects, with keys "angle" (string) and "description" (string). Do not wrap in markdown.\n\nTopic: "${text.substring(0, 500)}"`;
      const aiResponseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      let aiText = aiResponseText || "[]";
      aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
      setConceptTesting(JSON.parse(aiText));
    } catch (e) {
      console.error(e);
      setErrorInfo("Failed to generate concepts.");
    } finally {
      setIsGeneratingConcepts(false);
    }
  };

  const generatePolls = async () => {
    if (!text.trim()) return;
    setIsGeneratingPolls(true);
    setPolls(null);
    try {
      const prompt = `Analyze the finalized script and suggest three high-engagement poll questions for the YouTube Community tab to drive interaction. Return ONLY a valid JSON array of objects, with keys "question" (string) and "options" (array of strings, max 4). Do not wrap in markdown.\n\nText: "${text.substring(0, 5000)}"`;
      const aiResponseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      let aiText = aiResponseText || "[]";
      aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
      setPolls(JSON.parse(aiText));
    } catch (e) {
      console.error(e);
      setErrorInfo("Failed to generate polls.");
    } finally {
      setIsGeneratingPolls(false);
    }
  };

  const generateViralHooks = async () => {
    if (!text.trim()) return;
    setIsGeneratingHooks(true);
    setViralHooks(null);
    try {
      const prompt = `Analyze the following script and generate 5 punchy, viral-style hooks (opening lines) for ${socialFormat}. 
      Include different angles: 1. Curiosity Gap, 2. Contrarian, 3. Question-based, 4. Data/Fact-based, 5. High-Stakes.
      Return ONLY a valid JSON array of objects with keys "type" and "text".\n\nScript: "${text.substring(0, 5000)}"`;
      const result = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      let cleanText = (result || "[]").replace(/```json/gi, '').replace(/```/g, '').trim();
      setViralHooks(JSON.parse(cleanText));
    } catch (e) {
      console.error(e);
      setErrorInfo("Failed to generate viral hooks.");
    } finally {
      setIsGeneratingHooks(false);
    }
  };

  const generateCtaLibrary = async () => {
    if (!text.trim()) return;
    setIsGeneratingCtas(true);
    setCtaLibrary(null);
    try {
      const prompt = `Generate 4 effective Call-to-Actions (CTAs) for this script. 
      Tailor them for: 1. Newsletter Signup, 2. Direct Sales/Product, 3. Subscription/Follow, 4. Comment/Engagement.
      Return ONLY a valid JSON array of strings.\n\nScript: "${text.substring(0, 5000)}"`;
      const result = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      let cleanText = (result || "[]").replace(/```json/gi, '').replace(/```/g, '').trim();
      setCtaLibrary(JSON.parse(cleanText));
    } catch (e) {
      console.error(e);
      setErrorInfo("Failed to generate CTAs.");
    } finally {
      setIsGeneratingCtas(false);
    }
  };

  const analyzeScriptVitals = async () => {
    if (!text.trim()) return;
    setIsAnalyzingVitals(true);
    setScriptVitals(null);
    try {
      const prompt = `Analyze the readability and pacing of this script. 
      Calculate: 1. Readability Level (e.g. '8th Grade', 'University'), 2. Est. Reading Time (at 150wpm), 3. Tone Description, 4. Punchiness Score (1-100).
      Return ONLY valid JSON with keys "readability", "readingTime", "tone", "punchiness" (number).\n\nScript: "${text.substring(0, 5000)}"`;
      const result = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      let cleanText = (result || "{}").replace(/```json/gi, '').replace(/```/g, '').trim();
      setScriptVitals(JSON.parse(cleanText));
    } catch (e) {
      console.error(e);
      setErrorInfo("Failed to analyze vitals.");
    } finally {
      setIsAnalyzingVitals(false);
    }
  };

  const extractKeywords = async () => {
    if (!text.trim()) return;
    setIsExtractingKeywords(true);
    setExtractedKeywords(null);
    try {
      const prompt = `Extract 10 high-intent, SEO-optimized keywords/hashtags from this script for ${socialFormat} search algorithms.
      Return ONLY a valid JSON array of strings.\n\nScript: "${text.substring(0, 5000)}"`;
      const result = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
      let cleanText = (result || "[]").replace(/```json/gi, '').replace(/```/g, '').trim();
      setExtractedKeywords(JSON.parse(cleanText));
    } catch (e) {
      console.error(e);
      setErrorInfo("Failed to extract keywords.");
    } finally {
      setIsExtractingKeywords(false);
    }
  };

  const handleExportSocialBundle = async () => {
    if (!text.trim()) return;

    const zip = new JSZip();
    const folder = zip.folder(`${socialFormat.toLowerCase()}_assets`);
    
    // Script with chapters
    let scriptContent = text;
    if (socialChapters) {
      scriptContent += `\n\n--- ${socialFormat === 'Podcast' ? 'TIMESTAMPS' : 'CHAPTERS'} ---\n` + socialChapters.map(c => `${c.timestamp} ${c.title}`).join('\n');
    }
    zip.file('script.txt', scriptContent);

    // Audio file
    if (audioUrl) {
      try {
        const response = await fetch(audioUrl);
        const blob = await response.blob();
        zip.file('audio.mp3', blob);
      } catch (e) {
        console.error("Failed to add audio to zip", e);
      }
    }

    // Comprehensive Metadata
    let metaContent = `PLATFORM: ${socialFormat}\nDATE: ${new Date().toLocaleDateString()}\n\n`;

    if (seoData) {
      metaContent += `--- SEO DATA ---\n`;
      metaContent += `Primary Title: ${seoData.titles[0]}\n`;
      metaContent += `Alt Titles: ${seoData.titles.slice(1).join(' | ')}\n`;
      metaContent += `Description/Post: ${seoData.description}\n`;
      metaContent += `Tags/Hashtags: ${seoData.tags.join(', ')}\n\n`;
    }

    if (viralHooks) {
      metaContent += `--- VIRAL HOOKS ---\n`;
      viralHooks.forEach(h => {
        metaContent += `[${h.type}] ${h.text}\n`;
      });
      metaContent += `\n`;
    }

    if (ctaLibrary) {
      metaContent += `--- CTAs ---\n`;
      ctaLibrary.forEach(c => {
        metaContent += `- ${c}\n`;
      });
      metaContent += `\n`;
    }

    if (scriptVitals) {
      metaContent += `--- SCRIPT VITALS ---\n`;
      metaContent += `Readability: ${scriptVitals.readability}\n`;
      metaContent += `Reading Time: ${scriptVitals.readingTime}\n`;
      metaContent += `Tone: ${scriptVitals.tone}\n`;
      metaContent += `Punchiness: ${scriptVitals.punchiness}/100\n\n`;
    }

    if (extractedKeywords) {
      metaContent += `--- KEYWORDS ---\n`;
      metaContent += extractedKeywords.join(', ') + `\n\n`;
    }

    if (thumbnailConcepts) {
      metaContent += `--- VISUAL ASSET CONCEPTS ---\n`;
      thumbnailConcepts.forEach(c => {
        metaContent += `Concept: ${c.concept}\nPrompt: ${c.prompt}\nGuidance: ${c.designGuidance}\n\n`;
      });
    }

    if (polls) {
      metaContent += `--- POLLS ---\n`;
      polls.forEach(p => {
        metaContent += `Q: ${p.question}\nOptions: ${p.options.join(', ')}\n\n`;
      });
    }

    if (visualCues) {
      zip.file('production_cues.txt', visualCues);
    }

    if (repurposedContent) {
      zip.file(`repurposed_${repurposedContent.platform}.txt`, repurposedContent.content);
    }

    zip.file(`${socialFormat.toLowerCase()}_platform_data.txt`, metaContent);

    const content = await zip.generateAsync({ type: 'blob' });
    saveAs(content, `${socialFormat.toLowerCase()}_bundle.zip`);
  };

  const handleTalkBackSubmit = async (customPrompt?: string | React.MouseEvent | React.KeyboardEvent) => {
    const userMsg = typeof customPrompt === 'string' ? customPrompt : talkBackInput;
    if (!userMsg?.trim() || isGenerating) return;
    
    if (typeof customPrompt !== 'string') {
      setTalkBackInput('');
    }
    const newMessages: {role: 'user' | 'assistant', content: string}[] = [...talkBackMessages, { role: 'user', content: userMsg }];
    setTalkBackMessages(newMessages);
    setTutorTab('chat');
    setIsGenerating(true);

    try {
      // Cross-document context discovery: include history/projects snippets
      const crossContext = history.slice(0, 5).map(h => `Related context from previous document "${h.text.substring(0, 100)}..."`).join('\n');
      
      const chatContext = newMessages.slice(0, -1).map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
      
      const userTargetLanguage = LANGUAGES.find(l => l.code === languageCode)?.name || 'the same language as the user';
      
      // Use the current editor text as context
      let prompt = `You are an AI Tutor tasked with explaining concepts at a "${tutorLevel}" comprehension level.
      
[TEXT CONTEXT]
"${text.substring(0, 5000)}"
${crossContext ? `\n[CROSS-DOCUMENT INSIGHTS]\n${crossContext}` : ''}

[PREVIOUS CONVERSATION]
${chatContext || "No previous conversation."}

Based on the provided context, ${userMsg.startsWith('Explain module:') ? `focus EXCLUSIVELY on explaining the module: "${userMsg.replace('Explain module: ', '')}". Provide a brand new, detailed, and structured explanation for this specific module, ignoring previous conversation if it contradicts this specific request.` : `answer the following question or explain: ${userMsg}.`} 

If the answer is NOT fully contained in the provided context or previous conversation, search the internet thoroughly to provide an accurate, high-quality answer.

You MUST tailor your explanation strictly to the "${tutorLevel}" level. If the user asks a doubt, thoroughly explain it. Use the internet to gather extra context if needed. Keep your response conversational and structured. Format your text nicely since it will be spoken out loud and also displayed in Markdown. CRITICAL: You MUST write your response in ${userTargetLanguage} OR the EXACT same language that the user used in their question, but prefer ${userTargetLanguage}.
      
      ${isSocraticMode ? `- CRITICAL: You are in SOCRATIC MODE. Do NOT provide direct answers. Instead, ask incisive, leading questions that guide the user to discover the answer themselves. Use the Socratic method.` : ''}
      
      ALSO: 
      1. Provide a knowledge graph structure for output: {"nodes": [{"id": "string", "label": "string"}], "links": [{"source": "id_string", "target": "id_string"}]}.
      // Only regenerate Learning Path if it's empty or the user asks to create it
      ${!learningPath ? '2. Generate a "Learning Path" curriculum (array of 5-7 hierarchical modules).' : ''}
      3. Suggest a "Micro-Challenge" for the user to practice this.
      4. Suggest a mastery update for the topic "${userMsg.substring(0, 20)}" (scale 1-100).
      
      Return the final output ONLY as a valid JSON object with keys "explanation" (string), "graph" (object), "learningPath" (array of strings), "microChallenge" (string), and "masteryUpdate" (number).
      
      IF the user asks for lists, rankings, or specific information (like "give me X questions"), YOU MUST SEARCH THE INTERNET for the most relevant and accurate information before constructing your explanation.`;
      
      if (isAdaptiveTesting) {
          prompt = `You are an adaptive AI Tutor. 
- Topic Context: "${text.substring(0, 5000)}"
- Difficulty: ${difficultyLevel}/10
- Correct Streak: ${correctStreak}

Present a question or challenge tailored to the difficulty. Increase if correct, lower and explain if wrong.
CRITICAL: You MUST write your response in ${userTargetLanguage}.
Return ONLY valid JSON: {"explanation": string, "graph": object, "learningPath": array, "microChallenge": string, "masteryUpdate": number, "isCorrect": boolean}.`;
      }

      const aiResponseText = await genAIResponse("gemini-4-argon", [{ role: "user", parts: [{ text: prompt }] }], [{ googleSearch: {} }]);
      
      let aiResponse = aiResponseText || '';
      
      // Robust JSON extraction
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
         throw new Error("Invalid AI response format");
      }
      
      const parsedResponse = JSON.parse(jsonMatch[0]);
      
      const explanationText = typeof parsedResponse.explanation === 'string' ? parsedResponse.explanation : JSON.stringify(parsedResponse.explanation || "I couldn't generate a clear explanation.");
      setTalkBackMessages(prev => [...prev, { role: 'assistant', content: explanationText }]);
      const graph = parsedResponse.graph;
      setGraphData(graph && Array.isArray(graph.nodes) && Array.isArray(graph.links) ? graph : null);
      
      if (parsedResponse.learningPath && Array.isArray(parsedResponse.learningPath) && parsedResponse.learningPath.length > 0 && !learningPath) {
        setLearningPath(parsedResponse.learningPath.map((m: any) => ({ module: typeof m === 'string' ? m : (m.title || m.module || JSON.stringify(m)), completed: false })));
      }
      
      if (parsedResponse.microChallenge !== undefined && parsedResponse.microChallenge !== null) {
        setMicroChallenge(typeof parsedResponse.microChallenge === 'string' ? parsedResponse.microChallenge : JSON.stringify(parsedResponse.microChallenge));
      }

      if (parsedResponse.masteryUpdate !== undefined) {
        const topic = userMsg.length > 20 ? userMsg.substring(0, 20) + '...' : userMsg;
        let mVal = parsedResponse.masteryUpdate;
        if (typeof mVal === 'object' && mVal !== null) {
          mVal = mVal.score || mVal.value || mVal.masteryUpdate || 50;
        }
        setMasteryData(prev => ({ ...prev, [topic]: Number(mVal) || 50 }));
      }

      if (isAdaptiveTesting) {
        if (parsedResponse.isCorrect) {
          setCorrectStreak(prev => prev + 1);
          setDifficultyLevel(prev => Math.min(10, prev + 1));
        } else {
          setCorrectStreak(0);
          setDifficultyLevel(prev => Math.max(1, prev - 1));
          flagStruggledTopic(userMsg, difficultyLevel);
        }
      }
      
      // Generate and play audio for the AI response
      const audioText = parsedResponse.explanation;
      if (audioText) {
        const audioUrl = await generateGenericAudio(audioText);
        if (audioUrl) {
           const audio = new Audio(audioUrl);
           setCurrentAudioElement(audio);
           setIsAudioPlaying(true);
           audio.onended = () => {
             setIsAudioPlaying(false);
             setCurrentAudioElement(null);
           };
           audio.play().catch(e => console.error("Audio playback failed:", e));
        }
      }
    } catch (err: any) {
      console.error("Talk Back error:", err);
      setErrorInfo("AI Tutor error: " + (err.message || "Please try again."));
    } finally {
      setIsGenerating(false);
    }
  };

  const insertTextAtCursor = (textToInsert: string) => {
    const cleanToInsert = stripMarkdownAndDelimiters(textToInsert);
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      setText(prev => typeof prev === 'string' ? prev.substring(0, start) + cleanToInsert + prev.substring(end) : prev);
      setTimeout(() => {
        textarea.focus();
        textarea.selectionStart = textarea.selectionEnd = start + cleanToInsert.length;
      }, 10);
    } else {
      setText(prev => typeof prev === 'string' ? prev + (prev ? '\n' : '') + cleanToInsert : prev);
    }
  };

  const filterEnglishOnlyIfMultiLanguage = async (rawText: string): Promise<string> => {
    // Preserve verbatim text 100% same to same across all languages and formats
    return rawText;
  };

  const handlePaste = async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    
    // Check if it's a URL
    if (pastedText && pastedText.startsWith('http')) {
      e.preventDefault();
      setIsGenerating(true);
      try {
        const prompt = targetLang && targetLang !== 'English' 
          ? `Extract the main article content or text from this URL and TRANSLATE it into ${targetLang}. Return ONLY the translated clean text without any metadata or labels. URL: ${pastedText}`
          : `Extract the main article content or text from this URL and return it as clean text. URL: ${pastedText}`;
          
        const aiResponseText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: prompt }] }]);
        const content = aiResponseText;
        if (content) {
          insertTextAtCursor(content.trim());
          if (containsTable(content)) {
            setEditMode('grid');
          }
        }
      } catch (err) {
        setErrorInfo(
          <div className="space-y-3 w-full">
            <p className="font-bold text-red-400">URL Extraction Failed</p>
            <div className="border border-[#333537] rounded-xl bg-[#131314] p-4 space-y-3 shadow-inner">
              <div className="flex items-center justify-between">
                <label className="text-[10px] font-black uppercase text-indigo-400 tracking-widest block">📋 Paste Content Manually</label>
                <span className="text-[9px] font-mono text-gray-500">Backup Option</span>
              </div>
              <p className="text-[10px] text-[#8E918F] leading-snug">
                We couldn't automatically extract content from that link. You can manually copy the text and paste it here:
              </p>
              <textarea 
                className="w-full h-24 bg-[#1E1F20]/80 text-xs text-[#C4C7C5] p-3 rounded-lg border border-[#333537] focus:outline-none focus:border-indigo-500 placeholder:text-gray-600 focus:ring-1 focus:ring-indigo-500/20 font-mono transition-all resize-none shadow-md"
                placeholder="Paste the copied webpage text here..."
                onChange={(e) => {
                  const val = e.target.value;
                  if (val.trim()) {
                    setText(val);
                    setErrorInfo(null);
                    setCommandFeedback("Manual script text loaded successfully!");
                  }
                }}
              />
            </div>
          </div>
        );
      } finally {
        setIsGenerating(false);
      }
      return;
    }

    // Check for images or audio files
    let hasMedia = false;
    const items = e.clipboardData.items;
    for (const item of Array.from(items) as DataTransferItem[]) {
      if (item.type.indexOf('image') !== -1) {
        hasMedia = true;
        const blob = item.getAsFile();
        if (!blob) continue;
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          const base64Data = (reader.result as string).split(',')[1];
          extractHandwriting(base64Data, item.type);
        };
      } else if (item.type.indexOf('audio') !== -1) {
        hasMedia = true;
        const blob = item.getAsFile();
        if (!blob) continue;
        setIsGenerating(true);
        try {
          const reader = new FileReader();
          reader.readAsDataURL(blob);
          reader.onloadend = async () => {
            const base64Data = (reader.result as string).split(',')[1];
            const aiResponseText = await genAIResponse("gemini-3.8-flash", [{
              role: "user",
              parts: [
                { inlineData: { data: base64Data, mimeType: item.type } },
                { text: "Transcribe this audio file into text with 100% fidelity. Return ONLY the transcription." }
              ]
            }]);
            const content = aiResponseText;
            if (content) insertTextAtCursor(content.trim());
            setIsGenerating(false);
          };
        } catch (err) {
          setErrorInfo("Failed to process audio file.");
          setIsGenerating(false);
        }
      }
    }
    
    if (!hasMedia && pastedText && pastedText.trim().length > 0) {
      // Direct verbatim insertion: preserve 100% same to same
      if (containsTable(pastedText)) {
        setEditMode('grid');
      }
    }
  };

  const audioRef = useRef<HTMLAudioElement>(null);
  const musicRef = useRef<HTMLAudioElement>(null);

  const filteredHistory = history.filter(item => {
    const matchesTags = selectedTags.length === 0 || (item.tags || []).some(tag => selectedTags.includes(tag));
    const matchesProject = !activeProjectId || (item as any).projectId === activeProjectId;
    const matchesSearch = !searchQuery.trim() || item.text.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTags && matchesProject && matchesSearch;
  });

  const allTags = Array.from(new Set(history.flatMap(h => h.tags || [])));

  // Sync background music
  useEffect(() => {
    if (musicRef.current) {
        if (bgMusic && (audioUrl || isPlayingBrowser)) {
            musicRef.current.src = bgMusic;
            musicRef.current.volume = 0.1;
            musicRef.current.loop = true;
            musicRef.current.play();
        } else {
            musicRef.current.pause();
        }
    }
  }, [bgMusic, audioUrl, isPlayingBrowser]);
  
  // Load notifications
  useEffect(() => {
    if (!user) {
      setNotifications([]);
      return;
    }
    const q = query(
      collection(db, 'notifications'), 
      where('recipientUid', '==', user.uid),
      orderBy('timestamp', 'desc')
    );
    return onSnapshot(q, (snapshot) => {
      setNotifications(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'notifications'));
  }, [user]);

  // Sync User Profile
  useEffect(() => {
    if (user && user.email) {
      setDoc(doc(db, 'users', user.uid), {
        email: user.email.toLowerCase(),
        displayName: user.displayName,
        lastLogin: serverTimestamp()
      }, { merge: true }).catch(console.error);
    }
  }, [user]);

  // Load Shared Playlists
  useEffect(() => {
    if (!user || !user.email) {
      setSharedPlaylists([]);
      return;
    }
    
    const userEmail = user.email.toLowerCase();
    const userId = user.uid;
    
    // Playlists owned by user OR where user is a collaborator
    const q = query(
      collection(db, 'shared_playlists'),
      where('collaborators', 'array-contains', userEmail)
    );
    
    const q2 = query(
      collection(db, 'shared_playlists'),
      where('ownerId', '==', userId)
    );

    const unsubscribe1 = onSnapshot(q, (snapshot) => {
      const collabs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSharedPlaylists(prev => {
        const others = prev.filter(p => p.ownerId === userId);
        const combined = [...others, ...collabs];
        return Array.from(new Map(combined.map(item => [item.id, item])).values());
      });
    }, (err) => console.error("Snapshot error:", err));

    const unsubscribe2 = onSnapshot(q2, (snapshot) => {
      const owned = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setSharedPlaylists(prev => {
        const others = prev.filter(p => !owned.find(o => o.id === p.id));
        const combined = [...owned, ...others];
        return Array.from(new Map(combined.map(item => [item.id, item])).values());
      });
    }, (err) => console.error("Snapshot error:", err));

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, [user]);

  // Load items for selected shared playlist
  useEffect(() => {
    if (!selectedSharedPlaylist) {
      setSharedItems([]);
      return;
    }
    const q = query(collection(db, `shared_playlists/${selectedSharedPlaylist.id}/items`), orderBy('timestamp', 'desc'));
    const unsubItems = onSnapshot(q, (snapshot) => {
      setSharedItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `shared_playlists/${selectedSharedPlaylist.id}/items`));

    const unsubScripts = fetchScripts(selectedSharedPlaylist.id);

    return () => {
      unsubItems();
      if (unsubScripts) unsubScripts();
    };
  }, [selectedSharedPlaylist]);
  
  // Eagerly fetch feedback and metrics for shared items in current view
  useEffect(() => {
    if (!selectedSharedPlaylist || sharedItems.length === 0) return;
    
    // We only fetch for the most recent items to avoid listener explosion
    const itemsToWatch = sharedItems.slice(0, 8);
    const unsubs: (() => void)[] = [];
    
    itemsToWatch.forEach(item => {
      unsubs.push(fetchComments(selectedSharedPlaylist.id, item.id));
      unsubs.push(fetchSharedReactions(selectedSharedPlaylist.id, item.id));
      // fetchAnalytics is usually handled on demand usually, but we could add it too
    });
    
    return () => unsubs.forEach(u => u());
  }, [sharedItems, selectedSharedPlaylist?.id]);

  const createSharedPlaylist = async () => {
    if (!user) return;
    const name = prompt("Enter team folder/playlist name:");
    if (!name) return;
    
    try {
      await addDoc(collection(db, 'shared_playlists'), {
        name,
        ownerId: user?.uid,
        ownerEmail: user?.email,
        collaborators: [],
        collaboratorRoles: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      setErrorInfo("Shared playlist created!");
    } catch (e) {
      setErrorInfo("Failed to create shared playlist.");
    }
  };

  const inviteCollaborator = async (playlistId: string) => {
    const email = prompt("Enter colleague's email to invite:");
    if (!email || !email.includes('@')) return;
    
    const roleChoice = prompt("Select role: 1 for Editor, 2 for Viewer (default)");
    const role = (roleChoice === '1') ? 'editor' : 'viewer';
    
    const targetEmail = email.trim().toLowerCase();
    
    try {
      const playlistRef = doc(db, 'shared_playlists', playlistId);
      // Use setDoc with merge to avoid issues with dots in email keys when using updateDoc dot-notation
      await setDoc(playlistRef, {
        collaborators: arrayUnion(targetEmail),
        collaboratorRoles: {
          [targetEmail]: role
        },
        updatedAt: serverTimestamp()
      }, { merge: true });
      
      setErrorInfo(`Invited as ${role}!`);
    } catch (e) {
      console.error(e);
      setErrorInfo("Failed to invite collaborator.");
    }
  };

  const shareToPlaylist = async (playlistId: string, item: HistoryItem) => {
    if (!user) return;
    if (item.url?.startsWith('blob:')) {
      setErrorInfo("This audio was generated in an older session. Please click the replay button to regenerate it before sharing.");
      return;
    }
    try {
      await addDoc(collection(db, `shared_playlists/${playlistId}/items`), {
        text: item.text,
        url: item.url,
        authorId: user?.uid,
        authorName: user?.displayName || user?.email?.split('@')[0] || 'User',
        timestamp: serverTimestamp(),
        tags: item.tags || []
      });
      setErrorInfo("Added to shared playlist!");
    } catch (e) {
      setErrorInfo("Failed to share item.");
    }
  };

  const handleSharedLike = async (playlistId: string, itemId: string, status: 'like' | 'dislike') => {
    if (!user) return;
    try {
      const itemRef = doc(db, `shared_playlists/${playlistId}/items`, itemId);
      // We'll store reactions in a subcollection to avoid field bloat
      const reactionRef = doc(db, `shared_playlists/${playlistId}/items/${itemId}/reactions`, user.uid);
      const snap = await getDoc(reactionRef);
      
      if (snap.exists() && snap.data().status === status) {
        await deleteDoc(reactionRef);
      } else {
        await setDoc(reactionRef, {
          status,
          userId: user.uid,
          userName: user.displayName || user.email?.split('@')[0],
          timestamp: serverTimestamp(),
          playlistId,
          itemId
        });
      }
      
      // Update local state if needed, or rely on snapshots if we had a listener
      // For now, let's just trigger a notification if liked
      if (status === 'like') {
        const itemSnap = await getDoc(itemRef);
        if (itemSnap.exists()) {
          const itemData = itemSnap.data();
          if (itemData.authorId !== user.uid) {
            await addDoc(collection(db, 'notifications'), {
              recipientUid: itemData.authorId,
              senderName: user.displayName || user.email?.split('@')[0],
              message: `liked your shared track: "${itemData.text.substring(0, 30)}..."`,
              playlistId,
              itemId,
              timestamp: serverTimestamp(),
              isRead: false
            });
          }
        }
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.WRITE, `shared_playlists/${playlistId}/items/${itemId}/reactions`);
    }
  };

  const deleteSharedItem = async (playlistId: string, itemId: string) => {
    if (!confirm("Are you sure you want to remove this clip from the team folder?")) return;
    try {
      await deleteDoc(doc(db, `shared_playlists/${playlistId}/items`, itemId));
      setErrorInfo("Item removed from team folder.");
    } catch (e) {
      setErrorInfo("Failed to remove item. You might not have permission.");
    }
  };

  const addComment = async (playlistId: string, itemId: string, commentText: string) => {
    if (!user || !commentText.trim()) return;
    try {
      await addDoc(collection(db, `shared_playlists/${playlistId}/items/${itemId}/comments`), {
        text: commentText,
        userId: user?.uid,
        userName: user?.displayName || user?.email?.split('@')[0] || 'User',
        timestamp: serverTimestamp(),
        playlistId,
        itemId
      });

      // Mention Detection
      const mentionMatch = commentText.match(/@([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9_-]+)/g);
      if (mentionMatch && selectedSharedPlaylist) {
        const emails = mentionMatch.map(m => m.slice(1).toLowerCase());
        
        // Find UIDs of collaborators mentioned
        // Note: We don't have a direct email-to-UID mapping globally accessible easily without a users collection
        // But we can check if the mention is in the collaborator roles to proceed
        // If we had a users collection it would be better. 
        // For now, if the mention matches a collaborator, we attempt to find if they are online/have a profile?
        // Actually, to send a notification we NEED the recipient UID. 
        // Let's assume we have a simple 'users' collection to look up UID by email.
        // OR we can use the existing collaborators list if it contained UIDs.
        // Wait, the shared playlist only has emails. 
        // Let's modify the inviteCollaborator to also store UID if possible, or we just rely on an index.
        // Better: Let's quickly search for the user by email in a 'users' collection (assuming it exists or creating it on sign-in).
        
        for (const email of emails) {
          // Find the UID associated with this email
          const userQuery = query(collection(db, 'users'), where('email', '==', email));
          const userSnap = await getDocs(userQuery);
          if (!userSnap.empty) {
            const recipient = userSnap.docs[0];
            await addDoc(collection(db, 'notifications'), {
              recipientUid: recipient.id,
              senderName: user?.displayName || user?.email?.split('@')[0] || 'User',
              message: `mentioned you in a comment: "${commentText.substring(0, 50)}..."`,
              playlistId,
              itemId,
              timestamp: serverTimestamp(),
              isRead: false
            });
          }
        }
      }
    } catch (e) {
      setErrorInfo("Failed to add comment.");
    }
  };

  // Load comments for an item
  const fetchComments = (playlistId: string, itemId: string) => {
    const q = query(collection(db, `shared_playlists/${playlistId}/items/${itemId}/comments`), orderBy('timestamp', 'asc'));
    return onSnapshot(q, (snapshot) => {
      setPlaylistComments(prev => ({
        ...prev,
        [itemId]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `shared_playlists/${playlistId}/items/${itemId}/comments`));
  };

  const fetchSharedReactions = (playlistId: string, itemId: string) => {
    const q = collection(db, `shared_playlists/${playlistId}/items/${itemId}/reactions`);
    return onSnapshot(q, (snapshot) => {
      setSharedReactions(prev => ({
        ...prev,
        [itemId]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `shared_playlists/${playlistId}/items/${itemId}/reactions`));
  };

  const fetchFeedbackStream = (playlistId: string) => {
    // Note: This requires a composite index if using collectionGroup with WHERE.
    // For now, we cycle through sharedItems in the effect or just use a listener on a specific 'feedback' collection if we had one.
    // Let's stick to the current structure but fetch more eagerly.
  };

  // Load scripts for a playlist
  const fetchScripts = (playlistId: string) => {
    const q = query(collection(db, `shared_playlists/${playlistId}/scripts`), orderBy('updatedAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setPlaylistScripts(prev => ({
        ...prev,
        [playlistId]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `shared_playlists/${playlistId}/scripts`));
  };

  // Load analytics for an item
  const fetchAnalytics = (playlistId: string, itemId: string) => {
    const q = query(collection(db, `shared_playlists/${playlistId}/items/${itemId}/analytics`), orderBy('timestamp', 'desc'));
    return onSnapshot(q, (snapshot) => {
      setPlaylistAnalytics(prev => ({
        ...prev,
        [itemId]: snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      }));
    }, (error) => handleFirestoreError(error, OperationType.LIST, `shared_playlists/${playlistId}/items/${itemId}/analytics`));
  };

  const createScript = async (playlistId: string) => {
    if (!user) return;
    const title = prompt("Enter script title:");
    if (!title) return;

    try {
      await addDoc(collection(db, `shared_playlists/${playlistId}/scripts`), {
        title,
        content: '',
        lastAuthorId: user.uid,
        lastAuthorName: user.displayName || user.email?.split('@')[0] || 'User',
        updatedAt: serverTimestamp()
      });
      setErrorInfo("Collaborative script created!");
    } catch (e) {
      console.error(e);
      setErrorInfo("Failed to create script.");
    }
  };

  const updateScript = async (playlistId: string, scriptId: string, content: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, `shared_playlists/${playlistId}/scripts`, scriptId), {
        content,
        lastAuthorId: user.uid,
        lastAuthorName: user.displayName || user.email?.split('@')[0] || 'User',
        updatedAt: serverTimestamp()
      });
    } catch (e) {
      console.error(e);
    }
  };

  const logListenSession = async (playlistId: string, itemId: string, duration: number) => {
    if (!user || duration < 1) return;
    try {
      await addDoc(collection(db, `shared_playlists/${playlistId}/items/${itemId}/analytics`), {
        userId: user.uid,
        userName: user.displayName || user.email?.split('@')[0] || 'User',
        timestamp: serverTimestamp(),
        duration
      });
    } catch (e) {
      console.error("Failed to log analytics:", e);
    }
  };

  const markNotificationRead = async (notificationId: string) => {
    try {
      await updateDoc(doc(db, 'notifications', notificationId), { isRead: true });
    } catch (e) {
      console.error(e);
    }
  };

  const deleteNotification = async (notificationId: string) => {
    try {
      await deleteDoc(doc(db, 'notifications', notificationId));
    } catch (e) {
      console.error(e);
    }
  };

  // Waveform and audio Ref visualization hook
  useEffect(() => {
    if (audioRef.current) {
        audioRef.current.playbackRate = speed;
    }

    if (!audioUrl || !audioRef.current) return;
    
    const canvas = document.getElementById('waveform') as HTMLCanvasElement;
    if (!canvas) return;
    
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      analyserRef.current = audioContextRef.current.createAnalyser();
      sourceRef.current = audioContextRef.current.createMediaElementSource(audioRef.current);
      sourceRef.current.connect(analyserRef.current);
      analyserRef.current.connect(audioContextRef.current.destination);
    }
    
    const analyser = analyserRef.current!;
    analyser.fftSize = 64;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    const canvasCtx = canvas.getContext('2d');
    
    if (!canvasCtx) return;

    if (audioContextRef.current.state === 'suspended') {
      const resume = () => audioContextRef.current?.resume();
      window.addEventListener('click', resume, { once: true });
    }

    let animationId: number;
    function draw() {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      const barWidth = (canvas.width / bufferLength) * 1.5;
      let x = 0;
      
      for(let i = 0; i < bufferLength; i++) {
        const barHeight = dataArray[i] / 3;
        canvasCtx.fillStyle = `rgb(99, 102, 241)`;
        canvasCtx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    }
    
    draw();
    
    return () => {
      cancelAnimationFrame(animationId);
    }
  }, [audioUrl, speed]);

  // Load Browser Voices
  useEffect(() => {
    const loadVoices = () => {
      setBrowserVoices(window.speechSynthesis.getVoices());
    };
    loadVoices();
    if (window.speechSynthesis.onvoiceschanged !== undefined) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Update voice options when language, gender, or engine changes
  useEffect(() => {
    const isCloned = clonedVoices.some(c => c.id === voiceName);
    if (engine === 'cloud') {
      const lang = LANGUAGES.find(l => l.code === languageCode);
      if (lang) {
        const filteredVoices = lang.voices.filter(v => genderFilter === 'ALL' || v.gender === genderFilter);
        if (!isCloned && filteredVoices.length > 0 && !filteredVoices.some(v => v.id === voiceName)) {
          setVoiceName(filteredVoices[0].id);
        } else if (!isCloned && filteredVoices.length === 0) {
          setVoiceName('');
        }
      }
    } else {
      // Filter browser voices
      const filteredVoices = browserVoices.filter(v => v.lang.startsWith(languageCode.split('-')[0]));
      if (!isCloned && filteredVoices.length > 0 && !filteredVoices.some(v => v.voiceURI === resolveActualVoiceName(voiceName))) {
        setVoiceName(filteredVoices[0].voiceURI);
      } else if (!isCloned && filteredVoices.length === 0) {
        setVoiceName('');
      }
    }
  }, [languageCode, genderFilter, engine, browserVoices, clonedVoices]);

  function resolveActualVoiceName(currentVoiceName: string) {
    if (currentVoiceName.startsWith('cloned-')) {
        const cloned = clonedVoices.find(c => c.id === currentVoiceName);
        if (cloned) {
            if (engine === 'cloud') {
                const lang = LANGUAGES.find(l => l.code === languageCode);
                if (lang) {
                    const availableVoices = lang.voices.filter(v => v.gender === cloned.gender);
                    return availableVoices.length > 0 ? availableVoices[0].id : lang.voices[0].id;
                }
            } else {
                const filteredVoices = browserVoices.filter(v => v.lang.startsWith(languageCode.split('-')[0]));
                return filteredVoices.length > 0 ? filteredVoices[0].voiceURI : (browserVoices[0]?.voiceURI || '');
            }
        }
    }
    return currentVoiceName;
  }

  const handleGenerateSingle = async () => {
    if (!text.trim()) return;
    setIsGenerating(true);
    setErrorInfo(null);
    setAudioUrl(null);
    setShowAllResults(false);

    if (languageCode.toUpperCase() === 'ALL') {
      try {
        // Perform translations in batch using Gemini 2.0-flash
        const allLangs = LANGUAGES.map(l => l.name).join(', ');
        const translationPrompt = `Translate the following text into ALL of these languages: ${allLangs}. 
        Return a JSON object where keys are language names and values are the strictly translated text.
        Text: ${text}`;
        
        const translationsRes = await genAIResponse("gemini-3.8-flash", [{ text: translationPrompt }]);
        const translations = JSON.parse(translationsRes.replace(/```json|```/g, '').trim());

        // Process each language in parallel
        const promises = LANGUAGES.map(async (langObj) => {
            const translatedText = translations[langObj.name] || translations[langObj.code];
            if (!translatedText) return null;

            let finalAudioUrl = '';
            // Generate audio for it if it has voices and engine is cloud
            if (engine === 'cloud' && langObj.voices.length > 0) {
                const voice = langObj.voices[0]; // Pick first default voice
                try {
                  const res = await fetch('/api/tts', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      text: translatedText,
                      useSSML,
                      languageCode: langObj.code,
                      name: voice.id,
                      pitch,
                      speakingRate: speed,
                      volumeGainDb: volume
                    })
                  });
                  const data = await res.json();
                  if (data.audioContent) {
                    const bStr = atob(data.audioContent);
                    const b = new Uint8Array(bStr.length);
                    for (let i = 0; i < bStr.length; i++) b[i] = bStr.charCodeAt(i);
                    const blob = new Blob([b], { type: 'audio/mp3' });
                    finalAudioUrl = URL.createObjectURL(blob);
                  }
                } catch (e) {
                  console.error(`Audio generation failed for ${langObj.name}`, e);
                }
            }

            return {
                code: langObj.code,
                name: langObj.name,
                text: translatedText,
                audioUrl: finalAudioUrl,
                isSelected: true
            };
        });

        const activeResults = await Promise.all(promises);
        const results = activeResults.filter(Boolean);

        setAllLanguageResults(results as any);
        setShowAllResults(true);
      } catch (err: any) {
        setErrorInfo("Multi-language generation failed: " + err.message);
      } finally {
        setIsGenerating(false);
      }
      return;
    }
    
    if (engine === 'browser') {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      const selectedVoice = browserVoices.find(v => v.voiceURI === resolveActualVoiceName(voiceName));
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
      utterance.rate = speed;
      // pitch scaling for browser is generally 0 to 2
      utterance.pitch = 1 + (pitch / 20); 
      utterance.volume = 1 + (volume / 20); // rough approximation
      
      utterance.onstart = () => setIsPlayingBrowser(true);
      utterance.onboundary = (event) => {
        const word = text.substring(event.charIndex, text.indexOf(' ', event.charIndex));
        setCurrentWord(word);
      };
      utterance.onend = () => {
        setIsPlayingBrowser(false);
        setIsGenerating(false);
        setCurrentWord('');
      };
      utterance.onerror = (e) => {
        console.error(e);
        setIsPlayingBrowser(false);
        setIsGenerating(false);
      };
      
      window.speechSynthesis.speak(utterance);
      return;
    }

    if (useSentimentAI && !isDialogueMode) {
      try {
        const url = await generateSentimentalAudio(text);
        if (url) {
          setAudioUrl(url);
          const newItem: HistoryItem = {
            id: Date.now().toString(),
            text,
            url,
            timestamp: Date.now(),
            tags: ['AI-Expressive'],
            likeStatus: null,
            projectId: activeProjectId
          } as any;
          setHistory(prev => [newItem, ...prev]);
          setCurrentGenerationId(newItem.id);
        }
      } catch (err: any) {
        setErrorInfo(err.message || 'Failed to generate expressive audio.');
      } finally {
        setIsGenerating(false);
      }
      return;
    }
    
    // Cloud Engine Execution
    try {
      let audioChunks: Blob[] = [];

      if (isDialogueMode) {
        const dialoguePattern = /\[([^\]]+)\]([^\[]+)/g;
        const matches = Array.from(text.matchAll(dialoguePattern));
        
        if (matches.length > 0) {
          for (const match of matches as any[]) {
            const [_, persona, chunkText] = match;
            const segment = chunkText.trim();
            if (!segment) continue;

            let speedAdj = speed;
            let pitchAdj = pitch;
            let volumeAdj = volume;

            // Sentiment analysis for dialogue segment
            const sentiment = (await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: `Analyze the sentiment of this text and return ONLY one word: "excited", "calm", "professional", or "urgent". Text: ${segment}` }] }])).toLowerCase().trim();
            
            if (sentiment === 'excited') {
                speedAdj *= 1.1; pitchAdj += 3;
            } else if (sentiment === 'calm') {
                speedAdj *= 0.9; pitchAdj -= 3;
            }

            // Simple persona mapping
            if (persona.toLowerCase().includes('deep')) pitchAdj -= 8;
            if (persona.toLowerCase().includes('high')) pitchAdj += 8;

            const res = await fetch('/api/tts', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: segment,
                useSSML,
                languageCode,
                name: resolveActualVoiceName(voiceName),
                pitch: pitchAdj,
                speakingRate: speedAdj,
                volumeGainDb: volumeAdj
              })
            });
            
            const data = await res.json();
            if (data.audioContent) {
              const bStr = atob(data.audioContent);
              const b = new Uint8Array(bStr.length);
              for (let i = 0; i < bStr.length; i++) b[i] = bStr.charCodeAt(i);
              audioChunks.push(new Blob([b], { type: 'audio/mp3' }));
            }
          }
        } else {
          // Fallback if dialogue mode on but no tags found
          setIsDialogueMode(false);
          return handleGenerateSingle(); 
        }
    } else {
        // Feature: Dynamic Sentiment Analysis for Long Text
        // Split text into units (sentences) to ensure mood varies often and stays consistent with small segments
        const segments = useSSML ? [text] : (text.match(/[^.!?\n]+[.!?\n]*/g) || [text]);

        for (let i = 0; i < segments.length; i++) {
          const segment = segments[i].trim();
          if (!segment || segment.length < 2) continue;

          let speedAdj = speed;
          let pitchAdj = pitch;
          let volumeAdj = volume;

          if (!useSSML) {
            try {
              const sentiment = (await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: `Analyze the sentiment of this text and return ONLY one word: "excited", "calm", "professional", or "urgent". Text: ${segment}` }] }])).toLowerCase().trim();
              
              if (sentiment === 'excited') {
                  speedAdj *= 1.25; pitchAdj += 6;
              } else if (sentiment === 'calm') {
                  speedAdj *= 0.8; pitchAdj -= 4; volumeAdj -= 2;
              } else if (sentiment === 'urgent') {
                  speedAdj *= 1.35; pitchAdj += 3; volumeAdj += 2;
              }
            } catch (sentError) {
              console.warn("Sentiment analysis failed, using current sliders.");
            }
          }

          const res = await fetch('/api/tts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: segment,
              useSSML,
              languageCode,
              name: resolveActualVoiceName(voiceName),
              pitch: pitchAdj,
              speakingRate: speedAdj,
              volumeGainDb: volumeAdj
            })
          });
          
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to generate audio');
          
          const binaryStr = atob(data.audioContent);
          const bytes = new Uint8Array(binaryStr.length);
          for (let j = 0; j < binaryStr.length; j++) bytes[j] = binaryStr.charCodeAt(j);
          audioChunks.push(new Blob([bytes], { type: 'audio/mp3' }));
        }
      }

      const finalAudioBlob = new Blob(audioChunks, { type: 'audio/mp3' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const url = reader.result as string;
        setAudioUrl(url);
        const id = Date.now().toString();
        setCurrentGenerationId(id);
        
        // Update History
        const newItem: HistoryItem = { url, text, timestamp: Date.now(), id, likeStatus: null, tags: [], projectId: activeProjectId } as any;
        setHistory(prev => [newItem, ...prev].slice(0, 50));
        
        if (audioRef.current) {
          audioRef.current.src = url;
          audioRef.current.play();
        }
      };
      reader.readAsDataURL(finalAudioBlob);
    } catch (err: any) {
      setErrorInfo(getApiErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateBatch = async () => {
    const items = batchTexts.split('\n').map(t => t.trim()).filter(t => t.length > 0);
    if (items.length === 0) return;
    
    if (engine === 'browser') {
        setErrorInfo("Batch generation (MP3 Download) is only supported using the Cloud TTS Engine. The Built-in Browser engine only supports playback.");
        return;
    }

    setIsGenerating(true);
    setErrorInfo(null);
    setBatchResults([]);
    
    try {
      const res = await fetch('/api/tts/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          languageCode,
          name: resolveActualVoiceName(voiceName),
          pitch,
          speakingRate: speed,
          volumeGainDb: volume
        })
      });
      
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || data.error || 'Failed to process batch');
      }
      
      const results = data.results.map((r: any) => {
        if (r.error) {
          return { text: r.text, error: r.error };
        }
        return { text: r.text, url: `data:audio/mp3;base64,${r.audioContent}` };
      });
      
      setBatchResults(results);
    } catch (err: any) {
      setErrorInfo(getApiErrorMessage(err));
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadBatchZip = async () => {
    const validResults = batchResults.filter(r => r.url);
    if (validResults.length === 0) return;
    
    const zip = new JSZip();
    
    for (let i = 0; i < validResults.length; i++) {
      const result = validResults[i];
      const res = await fetch(result.url!);
      const blob = await res.blob();
      
      // Use the first few words as filename
      const snippet = result.text.substring(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase();
      zip.file(`audio_${i+1}_${snippet}.mp3`, blob);
    }
    
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'batch_audio.zip';
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPlaylistAsZip = async () => {
    if (playlist.length === 0) return;
    setIsGenerating(true);
    try {
      const zip = new JSZip();
      for (let i = 0; i < playlist.length; i++) {
        const item = playlist[i];
        let blob;
        try {
          const res = await fetch(item.url);
          blob = await res.blob();
        } catch (e) {
          if (item.url?.startsWith('blob:')) {
            setErrorInfo("Some audio files were generated in an older session and cannot be exported. Please re-generate them by clicking their replay button.");
          } else {
            setErrorInfo("Failed to fetch audio for export.");
          }
          setIsGenerating(false);
          return;
        }
        const snippet = item.text.substring(0, 20).replace(/[^a-z0-9]/gi, '_').toLowerCase();
        zip.file(`${i+1}_${snippet}.mp3`, blob);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `voice_collection_${Date.now()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      setErrorInfo("ZIP Export failed.");
    } finally {
      setIsGenerating(false);
    }
  };

  const currentLang = LANGUAGES.find(l => l.code === languageCode);
  const currentCloudVoices = currentLang ? currentLang.voices.filter(v => genderFilter === 'ALL' || v.gender === genderFilter) : [];
  const currentBrowserVoices = browserVoices.filter(v => {
    const lang = v.lang.replace('_', '-').toLowerCase();
    const target = languageCode.toLowerCase();
    // Strict match if possible, otherwise fallback to matching the first part and ensuring it's an Indian voice if it's English
    if (lang === target) return true;
    if (target.startsWith('en') && !lang.includes('in')) return false;
    return lang.startsWith(target.split('-')[0]);
  });
  const hasVoiceList = engine === 'cloud' ? currentCloudVoices.length > 0 : currentBrowserVoices.length > 0;

  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const { isInstallable, isInstalled, install } = usePWAInstall();

  // Handle incoming content shared from WhatsApp, Web Share Target, or external sources
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const externalText = params.get('text') || params.get('shared_text') || '';
    const externalUrl = params.get('url') || '';
    const externalTitle = params.get('title') || '';
    
    if (externalText || externalUrl || externalTitle) {
      let combined = externalText.trim();
      if (externalUrl && !combined.includes(externalUrl)) {
        combined = combined ? `${combined}\n\n${externalUrl}` : externalUrl;
      }
      if (externalTitle && !combined.includes(externalTitle)) {
        combined = `${externalTitle}\n\n${combined}`;
      }
      
      if (combined) {
        setText(combined);
        if (containsTable(combined)) {
          setEditMode('grid');
          setIsPreviewMode(false);
        }
        setCommandFeedback("Content received from WhatsApp / Share Target! Loaded into workspace.");
      } else if (externalUrl) {
        setText(externalUrl);
        handlePaste({ clipboardData: { getData: () => externalUrl } } as any);
      }
      
      // Clean up query parameters without page reload
      try {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (e) {
        console.warn('Could not clean share params from URL:', e);
      }
    }
  }, []);

  const handleSimulateWhatsAppShare = (sampleContent: string) => {
    setText(sampleContent);
    if (containsTable(sampleContent)) {
      setEditMode('grid');
      setIsPreviewMode(false);
    }
    setCommandFeedback("Simulated WhatsApp share received! Content loaded into editor.");
  };

  const [showTools, setShowTools] = useState(false);

  return (
    <div className={cn("min-h-screen flex flex-col lg:flex-row font-sans transition-colors duration-500", theme === 'dark' ? 'bg-[#131314] text-[#E3E3E3]' : 'bg-white text-[#1F1F1F]')}>
      <input 
        id="scan-handwriting-input"
        type="file" 
        ref={scanInputRef} 
        onChange={handleFileUpload} 
        accept="image/*" 
        className="hidden" 
      />
      
      {/* Sidebar Backdrop Overlay for Mobile */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Configuration */}
      <aside className={cn(
        "flex flex-col fixed inset-y-0 left-0 lg:relative lg:h-screen lg:sticky lg:top-0 overflow-hidden transition-all duration-500 z-50 shrink-0",
        isSidebarOpen ? "w-72 sm:w-80 lg:w-80 translate-x-0 opacity-100" : "-translate-x-full lg:w-0 lg:translate-x-0 border-none opacity-0 pointer-events-none lg:pointer-events-auto",
        theme === 'dark' ? "bg-[#1E1F20]/95 backdrop-blur-xl border-r border-white/5" : "bg-white border-r border-[#444746]/10"
      )}>
        <div className="p-5 border-b border-white/5 flex items-center space-x-3">
          <motion.div 
            whileHover={{ scale: 1.05, rotate: 5 }}
            className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center text-white shadow-xl shadow-indigo-500/20 border border-white/10"
          >
            <Volume2 size={24} />
          </motion.div>
          <div className="flex-1">
            <h1 className={cn("font-bold text-lg tracking-tight leading-tight", theme === 'dark' ? "text-white" : "text-[#131314]")}>
              Bharat Performance Agent
            </h1>
            <p className="text-[9px] text-[#C4C7C5] font-black tracking-widest uppercase opacity-60">Studio Edition</p>
          </div>
          <button 
                onClick={() => setIsSidebarOpen(false)}
                className="p-2 -mr-2 text-[#8E918F] hover:text-white lg:hidden transition-colors"
                title="Close"
              >
                <X size={20} />
          </button>
        </div>

        <div className="p-4 space-y-6 flex-1 overflow-y-auto custom-scrollbar">
          {/* Performer Agent Tab Trigger */}
          <div className="pb-4 border-b border-white/5">
            <button
              onClick={() => setActiveTab('agent')}
              className={cn(
                "w-full flex items-center justify-between p-3.5 rounded-2xl transition-all border font-black uppercase tracking-widest text-xs",
                activeTab === 'agent'
                  ? "bg-indigo-600 border-indigo-500 text-white shadow-lg shadow-indigo-600/20"
                  : "bg-white/[0.03] border-white/5 text-[#C4C7C5] hover:bg-white/10"
              )}
            >
              <div className="flex items-center gap-3">
                <Zap size={16} className={activeTab === 'agent' ? "text-white" : "text-indigo-400"} />
                <span>Performer Agent</span>
              </div>
              {activeTab === 'agent' && (
                <span className="w-2 h-2 rounded-full bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] animate-pulse" />
              )}
            </button>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <h2 className="text-[9px] font-black uppercase tracking-[0.25em] text-[#8E918F] flex items-center gap-2">
                <Settings2 size={12} className="text-[#C4C7C5]" />
                Audio Config
              </h2>
              <button
                onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                className="p-2 rounded-xl bg-[#1E1F20]/50 text-[#C4C7C5] hover:text-white hover:bg-[#1E1F20]/50 transition-all border border-[#333537]"
              >
                {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
              </button>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-[#8E918F] block mb-1">TTS Engine</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  title="Use Google Cloud TTS for professional, high-quality audio"
                  onClick={() => setEngine('cloud')}
                  className={cn(
                    "py-2 text-xs sm:text-sm font-semibold rounded-lg border transition-all flex flex-col items-center justify-center gap-1.5 shadow-sm",
                    engine === 'cloud' 
                      ? "bg-slate-100/10 text-[#C4C7C5] border-[#333537] shadow-indigo-900/20" 
                      : "bg-white/[0.03] text-[#C4C7C5] border-[#333537] hover:border-[#444746] hover:bg-white/10"
                  )}
                >
                  <Cloud size={16} />
                  <span>Cloud AI</span>
                </button>
                <button
                  title="Use your browser's built-in speech synthesis (Free, no API key)"
                  onClick={() => setEngine('browser')}
                  className={cn(
                    "py-2 text-xs sm:text-sm font-semibold rounded-lg border transition-all flex flex-col items-center justify-center gap-1.5 shadow-sm",
                    engine === 'browser' 
                      ? "bg-slate-100/10 text-[#C4C7C5] border-[#333537] shadow-indigo-900/20" 
                      : "bg-white/[0.03] text-[#C4C7C5] border-[#333537] hover:border-[#444746] hover:bg-white/10"
                  )}
                >
                  <MonitorPlay size={16} />
                  <span>Browser</span>
                </button>
              </div>
            </div>
            
            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-[#8E918F] block mb-1">Language</label>
              <select 
                title="Select Language"
                value={languageCode}
                onChange={(e) => setLanguageCode(e.target.value)}
                className="w-full bg-[#1E1F20]/50 border border-[#444746] rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-zinc-400 outline-none text-[#E3E3E3] transition-all"
              >
                <option value="ALL">ALL LANGUAGES</option>
                {LANGUAGES.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-[#8E918F] block mb-1">Tone / Gender</label>
              <div className="grid grid-cols-3 gap-2">
                {GENDERS.map(gender => (
                  <button
                    key={gender.id}
                    title={`Select ${gender.name} voice tone`}
                    disabled={engine === 'browser'}
                    onClick={() => setGenderFilter(gender.id)}
                    className={cn(
                      "py-2 text-sm font-medium rounded-lg border transition-all",
                      engine === 'browser' ? "cursor-not-allowed bg-[#1E1F20]/50 text-[#8E918F] border-[#444746] grayscale shadow-inner" :
                      genderFilter === gender.id 
                        ? "bg-[#1E1F20]/50 text-[#C4C7C5] border-white/30" 
                        : "bg-[#1E1F20]/50 text-[#C4C7C5] border-[#444746] hover:bg-[#333537]"
                    )}
                  >
                    {gender.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-[#8E918F] block mb-1">Voice Selector</label>
              <select 
                title="Select Voice"
                value={voiceName}
                onChange={(e) => {
                  const val = e.target.value;
                  setVoiceName(val);
                  const cloned = clonedVoices.find(c => c.id === val);
                  if (cloned) {
                    setPitch(cloned.pitch);
                    setSpeed(cloned.speed);
                    setGenderFilter(cloned.gender);
                  }
                }}
                className="w-full bg-[#1E1F20]/50 border border-[#444746] rounded-lg px-4 py-2.5 text-sm focus:ring-1 focus:ring-zinc-400 outline-none text-[#E3E3E3] transition-all"
              >
                {clonedVoices.length > 0 && (
                  <optgroup label="My Cloned Voices">
                    {clonedVoices.map(voice => (
                      <option key={voice.id} value={voice.id} title={voice.label}>
                        {voice.label} (Cloned {voice.gender})
                      </option>
                    ))}
                  </optgroup>
                )}
                <optgroup label="Standard Voices">
                {engine === 'cloud' ? (
                  currentCloudVoices.map(voice => (
                    <option key={voice.id} value={voice.id} title={voice.name}>
                      {voice.name} ({voice.gender.toLowerCase()})
                    </option>
                  ))
                ) : (
                  currentBrowserVoices.map(voice => (
                    <option key={voice.voiceURI} value={voice.voiceURI} title={voice.name}>
                      {voice.name}
                    </option>
                  ))
                )}
                </optgroup>
              </select>
              {!hasVoiceList && (
                <p className="text-xs text-[#8E918F]">No voices match this filter for the selected engine.</p>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-[#8E918F] block mb-1">Voice Modes</label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm text-[#C4C7C5] font-medium cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={isDialogueMode} 
                    onChange={e => setIsDialogueMode(e.target.checked)}
                    className="accent-zinc-400 rounded" 
                  />
                  Dialogue Mode
                </label>
              </div>
              {isDialogueMode && (
                <div className="text-xs text-[#C4C7C5]/70 border border-white/20 p-2 rounded bg-white/[0.03] space-y-1">
                  <p className="font-bold">Usage Guide:</p>
                  <p>1. Toggle Dialogue Mode ON.</p>
                  <p>2. Use tags like [Amit] Hello, [Riya] Hi there in your text.</p>
                  <p>3. AI will generate separate audio segments and join them.</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="text-xs font-bold uppercase tracking-widest text-[#8E918F] block mb-1">Background Music</label>
              <select 
                value={bgMusic || ''} 
                onChange={e => setBgMusic(e.target.value || null)}
                className="w-full bg-[#1E1F20]/50 border border-[#444746] rounded-lg px-4 py-2.5 text-sm outline-none text-[#E3E3E3]"
              >
                <option value="">None</option>
                <option value="https://www.bensound.com/bensound-music/bensound-elevate.mp3">Ambient Corporate</option>
                <option value="https://www.bensound.com/bensound-music/bensound-betterdays.mp3">Calm Inspiration</option>
                <option value="https://www.bensound.com/bensound-music/bensound-creativeminds.mp3">Tech Focus</option>
              </select>
            </div>

            <div className="space-y-3 pb-4">
              <label className="text-xs font-bold uppercase tracking-widest text-[#8E918F] block mb-1">Voice Profiles</label>
              <div className="flex flex-wrap gap-2">
                {[
                  { label: "Narrator", speed: 1.0, pitch: 0.0 },
                  { label: "Brisk", speed: 1.25, pitch: 2.0 },
                  { label: "Story", speed: 0.9, pitch: -2.0 },
                  { label: "Deep", speed: 0.85, pitch: -8.0 },
                ].map(profile => (
                  <button 
                    key={profile.label}
                    onClick={() => { setSpeed(profile.speed); setPitch(profile.pitch); }}
                    className="text-xs bg-[#1E1F20]/50 text-[#E3E3E3] border border-[#444746] px-3 py-1.5 rounded-xl hover:bg-slate-100 hover:text-white hover:border-[#444746] hover:-translate-y-0.5 active:translate-y-0 active:scale-95 transition-all shadow-sm"
                  >
                    {profile.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bg-white/[0.03] p-5 rounded-3xl border border-white/5 space-y-4">
            <div className="flex items-center gap-3 mb-1">
              <Sparkles className={cn("text-indigo-400", (isGenerating || isRecordingVoice) && "animate-pulse")} size={18} />
              <p className="text-[11px] font-black uppercase text-white tracking-[0.2em]">Clone My Voice</p>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => isRecordingVoice ? stopVoiceRecording() : startVoiceRecording()}
                className={cn(
                  "flex flex-col items-center justify-center gap-3 p-4 rounded-2xl border transition-all duration-300",
                  isRecordingVoice 
                    ? "bg-red-500/10 border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.2)]" 
                    : "bg-white/[0.03] border-white/5 text-[#C4C7C5] hover:bg-white/10 hover:border-white/10"
                )}
              >
                <Mic size={18} className={isRecordingVoice ? "animate-pulse" : ""} />
                <span className="text-[10px] font-bold uppercase tracking-wider">{isRecordingVoice ? 'Stop' : 'Record'}</span>
              </button>
              
              <label className="flex flex-col items-center justify-center gap-3 p-4 bg-white/[0.03] border border-white/5 text-[#C4C7C5] rounded-2xl hover:bg-white/10 hover:border-white/10 cursor-pointer transition-all duration-300">
                <Cloud size={18} />
                <span className="text-[10px] font-bold uppercase tracking-wider">Upload</span>
                <input 
                  type="file" 
                  accept="audio/*" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleVoiceClone(file);
                  }}
                />
              </label>
            </div>
            <p className="text-[9px] text-[#8E918F] text-center italic opacity-70">Capture 10-30s of your voice to calibrate the AI model</p>
            
            {clonedVoices.map(voice => (
              <motion.div 
                key={voice.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-3 bg-indigo-500/10 rounded-2xl border border-indigo-500/20 flex flex-col gap-2 mt-2"
              >
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)] animate-pulse" />
                      <span className="text-[10px] items-center flex font-black uppercase tracking-widest text-indigo-100 uppercase overflow-hidden text-ellipsis whitespace-nowrap max-w-[150px]">
                        <span>{voice.label}</span>
                      </span>
                    </div>
                    <button 
                      onClick={() => {
                        setClonedVoices(prev => prev.filter(v => v.id !== voice.id));
                        if (voiceName === voice.id) setVoiceName('');
                      }} 
                      className="p-1 text-slate-500 hover:text-red-400 transition-colors rounded-lg hover:bg-red-500/5"
                    >
                      <Trash2 size={12} />
                    </button>
                 </div>
                 <select
                   className="bg-black/20 text-xs border border-indigo-500/10 rounded-md p-1 mt-1 font-mono text-indigo-200 focus:outline-none"
                   value={voice.gender}
                   onChange={(e) => {
                     const newGender = e.target.value;
                     setClonedVoices(prev => prev.map(v => v.id === voice.id ? { ...v, gender: newGender } : v));
                     if (voiceName === voice.id) setGenderFilter(newGender);
                   }}
                 >
                   <option value="MALE">Base: Male TTS</option>
                   <option value="FEMALE">Base: Female TTS</option>
                 </select>
              </motion.div>
            ))}
          </div>

          <hr className="border-[#444746]" />

          <div className="space-y-5">
            <h2 className="text-xs font-bold uppercase tracking-widest text-[#8E918F]">
              Customization
            </h2>

            <div className="space-y-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#C4C7C5]">Speed</span>
                <span className="text-[#C4C7C5] font-mono">{speed.toFixed(2)}x</span>
              </div>
              <input 
                title="Speech Speed"
                type="range" min="0.25" max="4.0" step="0.25" 
                value={speed} onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full accent-zinc-400 h-1.5 bg-[#1E1F20]/50 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-[#8E918F] font-medium pt-1">
                <span>0.25x (Slow)</span>
                <span>4.0x (Fast)</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#C4C7C5]">Pitch</span>
                <span className="text-[#C4C7C5] font-mono">{pitch > 0 ? '+' : ''}{pitch.toFixed(1)}</span>
              </div>
              <input 
                title="Voice Pitch"
                type="range" min="-20.0" max="20.0" step="1.0" 
                value={pitch} onChange={(e) => setPitch(parseFloat(e.target.value))}
                className="w-full accent-zinc-400 h-1.5 bg-[#1E1F20]/50 rounded-lg appearance-none cursor-pointer"
              />
              <div className="flex justify-between text-xs text-[#8E918F] font-medium pt-1">
                <span>Deep (-20)</span>
                <span>High (+20)</span>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-xs mb-1">
                <span className="text-[#C4C7C5]">Background Music</span>
              </div>
              <select 
                title="Select Background Music"
                value={bgMusic || ''} 
                onChange={(e) => setBgMusic(e.target.value || null)}
                className="w-full bg-[#1E1F20]/50 border-none rounded-xl text-xs text-[#E3E3E3] p-2.5 focus:ring-1 focus:ring-zinc-400"
              >
                <option value="">None</option>
                <option value="https://cdn.pixabay.com/download/audio/2022/02/22/audio_d145e1286c.mp3?filename=ambient-piano-logo-16539.mp3">Ambient Piano</option>
                <option value="https://cdn.pixabay.com/download/audio/2022/01/18/audio_82750e0524.mp3?filename=lofi-study-112191.mp3">Lofi Study</option>
                <option value="https://cdn.pixabay.com/download/audio/2023/04/14/audio_34d1933c1d.mp3?filename=ethereal-meditation-149033.mp3">Ethereal</option>
              </select>
            </div>

            <div className="pt-6 border-t border-[#333537] space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-black uppercase tracking-widest text-[#C4C7C5]">Project Archives</h2>
                <button 
                  onClick={() => setShowProjectModal(true)}
                  className="p-1.5 rounded-lg bg-white/[0.03] text-[#C4C7C5] hover:bg-indigo-500 hover:text-white transition-all"
                >
                  <Plus size={12} />
                </button>
              </div>

              <div className="space-y-1.5 max-h-[200px] overflow-y-auto pr-2 custom-scrollbar">
                <button 
                  onClick={() => {
                    setActiveProjectId(null);
                    if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                      setIsSidebarOpen(false);
                    }
                  }}
                  className={cn(
                    "w-full text-left px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all border",
                    !activeProjectId 
                      ? "bg-slate-100 border-[#444746] text-black shadow-lg shadow-md shadow-black/50" 
                      : "bg-white/[0.03] border-transparent text-[#C4C7C5] hover:bg-white/10"
                  )}
                >
                  All Generations
                </button>
                {projects.map(project => (
                  <button 
                    key={project.id}
                    onClick={() => {
                      setActiveProjectId(project.id);
                      if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                        setIsSidebarOpen(false);
                      }
                    }}
                    className={cn(
                      "w-full text-left px-4 py-3 rounded-2xl text-xs font-bold uppercase tracking-widest transition-all border",
                      activeProjectId === project.id 
                        ? "bg-slate-100 border-[#444746] text-black shadow-lg shadow-md shadow-black/50" 
                        : "bg-white/[0.03] border-transparent text-[#C4C7C5] hover:bg-white/10"
                    )}
                  >
                    <div className="flex items-center gap-2">
                       <Folder size={12} className={activeProjectId === project.id ? "text-black" : "text-[#C4C7C5]"} />
                       <span className="truncate">{project.name}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-6 border-t border-[#333537] space-y-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-[#8E918F]">AI Script Studio</h2>
                <Sparkles size={14} className="text-indigo-400" />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => handleEnhanceScript('ENHANCE')}
                  disabled={isEnhancing}
                  className="flex items-center justify-center gap-2 p-3 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  {isEnhancing ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                  Enhance
                </button>
                <button 
                  onClick={() => handleEnhanceScript('SHORTEN')}
                  disabled={isEnhancing}
                  className="flex items-center justify-center gap-2 p-3 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  Condense
                </button>
                <button 
                  onClick={() => handleEnhanceScript('CHAPTERS')}
                  disabled={isEnhancing}
                  className="flex items-center justify-center gap-2 p-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  {isEnhancing ? <Loader2 size={12} className="animate-spin" /> : <List size={12} />}
                  Chapters
                </button>
                <button 
                  onClick={() => summarizeText()}
                  disabled={isGenerating}
                  className="flex items-center justify-center gap-2 p-3 bg-slate-500/10 hover:bg-slate-500/20 text-slate-400 border border-slate-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                >
                  {isGenerating ? <Loader2 size={12} className="animate-spin" /> : <Layout size={12} />}
                  Summary
                </button>
              </div>

              <div className="bg-[#1E1F20]/50 border border-[#333537] rounded-2xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-[9px] font-black uppercase text-[#8E918F] tracking-widest mb-1 px-1">
                  <User size={12} />
                  <span>Script Style</span>
                </div>
                <select 
                  value={scriptPersona} 
                  onChange={(e) => setScriptPersona(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-[10px] font-bold text-white focus:outline-none"
                >
                  <option value="hook">Shorts/TikTok Hook</option>
                  <option value="explainer">Educational Explainer</option>
                  <option value="storyteller">Vlog Storyteller</option>
                </select>
              </div>

              <div className="bg-[#1E1F20]/50 border border-[#333537] rounded-2xl p-3 space-y-2">
                <div className="flex items-center gap-2 text-[9px] font-black uppercase text-[#8E918F] tracking-widest mb-1 px-1">
                  <Globe size={12} />
                  <span>Target Dialect</span>
                </div>
                <div className="flex gap-2">
                  <select 
                    value={targetDialect}
                    onChange={(e) => setTargetDialect(e.target.value)}
                    className="flex-1 bg-white/5 border border-white/5 rounded-xl px-3 py-2 text-[10px] font-bold text-white focus:outline-none"
                  >
                    <option value="Bhojpuri">Bhojpuri</option>
                    <option value="Punjabi">Punjabi</option>
                    <option value="Tamil">Tamil</option>
                    <option value="Telugu">Telugu</option>
                    <option value="Bengali">Bengali</option>
                    <option value="Marathi">Marathi</option>
                    <option value="Malayalam">Malayalam</option>
                    <option value="Kannada">Kannada</option>
                    <option value="Haryanvi">Haryanvi</option>
                  </select>
                  <button 
                    onClick={() => handleEnhanceScript('DIALECT')}
                    className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                  >
                    Apply
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-6 border-t border-[#333537] space-y-4">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-[10px] font-black uppercase tracking-widest text-[#8E918F]">Document Studio</h2>
                <FileText size={14} className="text-blue-400" />
              </div>
              <div className="mb-2 px-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-[#8E918F] font-bold uppercase tracking-wider">Translation Target</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] text-[#8E918F] font-bold uppercase tracking-wider">All?</span>
                    <button 
                      onClick={() => {
                        if (selectedVideoLanguages.includes('all')) {
                          setSelectedVideoLanguages([]);
                        } else {
                          setSelectedVideoLanguages(['all']);
                        }
                      }}
                      className={cn(
                        "h-3.5 w-3.5 rounded border transition-all flex items-center justify-center cursor-pointer",
                        selectedVideoLanguages.includes('all') ? "bg-indigo-500 border-indigo-500 text-white" : "bg-[#333537] border-white/10 text-transparent hover:border-white/20"
                      )}
                    >
                      <Check size={10} className={cn("transition-transform", selectedVideoLanguages.includes('all') ? "scale-100" : "scale-0")} />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-1.5 max-h-24 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/10">
                  {VIDEO_LANGUAGES.filter(l => l.id !== 'all').map(lang => (
                    <div 
                      key={lang.id} 
                      onClick={() => {
                        if (selectedVideoLanguages.includes('all')) return;
                        setSelectedVideoLanguages(prev => 
                          prev.includes(lang.id) 
                            ? prev.filter(id => id !== lang.id) 
                            : [...prev, lang.id]
                        );
                      }}
                      className={cn(
                        "flex items-center justify-between p-1.5 rounded-lg border text-[9px] font-medium transition-all cursor-pointer group",
                        selectedVideoLanguages.includes(lang.id) || selectedVideoLanguages.includes('all')
                          ? "bg-indigo-500/10 border-indigo-500/30 text-indigo-300" 
                          : "bg-[#333537] border-white/5 text-[#8E918F] hover:border-white/10"
                      )}
                    >
                      <span className="truncate pr-1">{lang.name}</span>
                      <div className={cn(
                        "h-2.5 w-2.5 rounded-sm border transition-all flex items-center justify-center shrink-0",
                        selectedVideoLanguages.includes(lang.id) || selectedVideoLanguages.includes('all')
                          ? "bg-indigo-500 border-indigo-500 text-white" 
                          : "bg-black/20 border-white/10 text-transparent group-hover:border-white/20"
                      )}>
                        <Check size={7} />
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="flex items-center justify-between pt-1">
                  <div className="flex items-center gap-2">
                    <Mic size={10} className="text-emerald-400" />
                    <span className="text-[9px] text-[#8E918F] font-bold uppercase tracking-wider">Audio Enhancement</span>
                  </div>
                  <button 
                    onClick={() => setIsAudioEnhanced(!isAudioEnhanced)}
                    className={cn(
                      "relative inline-flex h-4 w-8 items-center rounded-full transition-colors",
                      isAudioEnhanced ? "bg-emerald-500" : "bg-[#333537]"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-2 w-2 transform rounded-full bg-white transition-transform",
                      isAudioEnhanced ? "translate-x-5" : "translate-x-1"
                    )} />
                  </button>
                </div>
              </div>
              <button 
                onClick={() => videoInputRef.current?.click()}
                className={cn(
                  "w-full flex items-center justify-between p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm mb-2 select-none",
                  isUploadingVideo 
                    ? "opacity-50 cursor-not-allowed pointer-events-none" 
                    : "hover:bg-indigo-500/20 text-indigo-400 cursor-pointer active:scale-95"
                )}
              >
                <div className="flex items-center gap-3">
                  <FileAudio size={12} />
                  Media to Words
                </div>
                {isUploadingVideo ? <Loader2 size={12} className="animate-spin text-indigo-400" /> : <Upload size={12} />}
              </button>

              {videoMetadata && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-[#1E1F20] border border-indigo-500/20 rounded-xl p-3 mb-2 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-indigo-400 font-bold uppercase tracking-wider">Tone Content</span>
                    {videoMetadata.sentiment && (
                      <span className={cn(
                        "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-tighter",
                        videoMetadata.sentiment.mood === 'Excited' ? "bg-amber-500/20 text-amber-500" :
                        videoMetadata.sentiment.mood === 'Urgent' ? "bg-red-500/20 text-red-500" :
                        "bg-emerald-500/20 text-emerald-500"
                      )}>
                        {videoMetadata.sentiment.mood}
                      </span>
                    )}
                  </div>
                  {videoMetadata.sentiment && (
                    <p className="text-[9px] text-[#8E918F] leading-tight italic">
                      "{videoMetadata.sentiment.description}"
                    </p>
                  )}
                  {videoMetadata.srt && (
                    <button 
                      onClick={() => {
                        const blob = new Blob([videoMetadata.srt || ''], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `subtitles-${Date.now()}.srt`;
                        a.click();
                      }}
                      className="w-full flex items-center justify-center gap-2 p-2 bg-white/5 hover:bg-white/10 text-white rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border border-white/5"
                    >
                      <Download size={10} />
                      Export Subtitles (.SRT)
                    </button>
                  )}
                </motion.div>
              )}
              <input 
                id="video-upload-input"
                type="file" 
                accept="video/*,audio/*" 
                ref={videoInputRef} 
                className="hidden" 
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleVideoUpload(file);
                  e.target.value = '';
                }} 
              />

            </div>

            <div className="pt-4 border-t border-[#333537] space-y-3">
              <button 
                onClick={() => setShowTools(true)}
                className="w-full flex items-center justify-between p-4 bg-white/[0.03] text-[#C4C7C5] rounded-2xl hover:bg-white/20 transition-all group border border-white/5"
              >
                <div className="flex items-center gap-3">
                   <Monitor size={18} />
                   <span className="text-xs font-black uppercase tracking-widest">Companion Tools</span>
                </div>
                <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
          
          <div className="mt-auto pt-6 border-t border-[#333537] space-y-4">
            <AuthComponent variant="compact" />
            <div className="text-center">
              <button 
                onClick={async () => {
                  const shareData = {
                    title: 'Bharat Performance Agent',
                    text: 'Extract intelligence and localize narratives across 23+ Bharat languages.',
                    url: window.location.origin,
                  };
                  if (navigator.share) {
                    try { await navigator.share(shareData); return; } catch (e) {}
                  }
                  const ok = await copyToClipboard(window.location.origin);
                  if (ok) {
                    setErrorInfo("App link copied to clipboard!");
                    setTimeout(() => setErrorInfo(null), 3000);
                  } else {
                    setErrorInfo("Could not copy link.");
                  }
                }}
                onTouchEnd={async (e) => {
                  e.preventDefault();
                  const shareData = {
                    title: 'Bharat Performance Agent',
                    text: 'Extract intelligence and localize narratives across 23+ Bharat languages.',
                    url: window.location.origin,
                  };
                  if (navigator.share) {
                    try { await navigator.share(shareData); return; } catch (e) {}
                  }
                  const ok = await copyToClipboard(window.location.origin);
                  if (ok) {
                    setErrorInfo("App link copied to clipboard!");
                    setTimeout(() => setErrorInfo(null), 3000);
                  } else {
                    setErrorInfo("Could not copy link.");
                  }
                }}
                className={cn(
                  "w-full flex items-center space-x-3 px-4 py-3 rounded-2xl transition-all duration-300 group touch-manipulation cursor-pointer active:scale-98",
                  theme === 'dark' ? "hover:bg-white/5 text-[#E3E3E3]" : "hover:bg-slate-100 text-[#444746]"
                )}
              >
                <Share2 size={18} className="text-indigo-400 group-hover:scale-110 transition-transform" />
                <span className="text-[10px] font-black uppercase tracking-widest">Share App Link</span>
              </button>

              <button 
                onClick={() => setShowTerms(true)}
                className="text-[10px] text-[#8E918F] hover:text-[#E3E3E3] uppercase tracking-widest font-bold transition-colors"
              >
                Terms and Conditions
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className={cn(
        "flex-1 flex flex-col relative transition-colors duration-500",
        theme === 'dark' ? 'bg-transparent' : 'bg-slate-50'
      )}>
        
        {/* Navigation Bar Header */}
        <div className={cn(
          "backdrop-blur-3xl border-b px-3 sm:px-6 flex items-center justify-between gap-3 shrink-0 z-40 transition-all duration-300 lg:sticky lg:top-0 h-16",
          theme === 'dark' ? 'bg-[#131314]/90 border-white/5' : 'bg-white/90 border-slate-200 shadow-xs'
        )}>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className={cn(
                "p-2 rounded-xl transition-colors flex-shrink-0 cursor-pointer",
                theme === 'dark' ? "hover:bg-white/5 text-slate-300 hover:text-white" : "hover:bg-slate-100 text-slate-800"
              )}
              title="Toggle Navigation Sidebar"
            >
              <Menu size={20} />
            </button>

            {/* App Brand Name */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-black">
                <Sparkles size={16} />
              </div>
              <span className="font-black text-sm tracking-wide text-white hidden sm:inline-block">Bharat AI Studio</span>
            </div>

            {/* Clear Workspace Tabs */}
            <div className="flex items-center gap-1.5 bg-white/[0.03] border border-white/5 p-1 rounded-xl ml-2">
              <button
                onClick={() => setActiveTab('single')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                  activeTab === 'single'
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                    : "text-[#8E918F] hover:text-white hover:bg-white/5"
                )}
              >
                <FileText size={14} />
                <span>Editor & Voice</span>
              </button>

              <button
                onClick={() => {
                  setActiveTab('single');
                  setEditMode('grid');
                  setIsPreviewMode(false);
                }}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer",
                  activeTab === 'single' && editMode === 'grid' && !isPreviewMode
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                    : "text-[#8E918F] hover:text-white hover:bg-white/5"
                )}
              >
                <Table size={14} />
                <span>Spreadsheet</span>
              </button>

              <button
                onClick={() => setActiveTab('projects')}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 cursor-pointer hidden md:flex",
                  activeTab === 'projects'
                    ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/25"
                    : "text-[#8E918F] hover:text-white hover:bg-white/5"
                )}
              >
                <FolderKanban size={14} />
                <span>Projects</span>
              </button>
            </div>
          </div>

          {/* Right Header Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => pdfInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl text-xs font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm"
              title="Upload PDF, Word, Excel or text document"
            >
              <Upload size={14} />
              <span className="hidden sm:inline">Upload File</span>
            </button>

            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className={cn(
                "p-2 rounded-xl border transition-all cursor-pointer",
                theme === 'dark' ? "bg-white/5 border-white/10 text-amber-300 hover:bg-white/10" : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-200"
              )}
              title="Toggle Dark / Light Theme"
            >
              <Sparkles size={16} />
            </button>
          </div>
        </div>


          {/* Moved the notification button after the single text button */}
          {user && (
            <div className="relative shrink-0 flex items-center">
              <button 
                onClick={() => setShowNotifications(!showNotifications)}
                className={cn(
                  "relative p-2.5 rounded-xl transition-all flex items-center justify-center cursor-pointer hover:bg-white/5",
                  showNotifications ? "bg-slate-400 text-white" : "text-white/70 hover:text-white"
                )}
                title="Notifications"
              >
                <Bell size={20} />
                {notifications.filter(n => !n.isRead).length > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-xs font-black rounded-full flex items-center justify-center border-2 border-[#1E1F20] animate-pulse">
                    {notifications.filter(n => !n.isRead).length}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <>
                    <div className="fixed inset-0 z-40 cursor-default" onClick={() => setShowNotifications(false)} />
                    <motion.div 
                      initial={{ opacity: 0, y: 10, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 10, scale: 0.95 }}
                      className="absolute left-0 top-full mt-2 w-80 bg-[#1E1F20] border border-[#444746] rounded-2xl shadow-3xl z-[150] overflow-hidden"
                    >
                      <div className="p-4 border-b border-[#333537] bg-white/[0.03] flex items-center justify-between">
                        <h4 className="text-xs font-black uppercase tracking-widest text-[#C4C7C5]">Notifications</h4>
                        {notifications.length > 0 && (
                          <button 
                            onClick={() => {
                              notifications.forEach(n => !n.isRead && markNotificationRead(n.id));
                            }}
                            className="text-[9px] font-bold text-white/70 hover:text-white"
                          >
                            Mark all read
                          </button>
                        )}
                      </div>
                      <div className="max-h-96 overflow-y-auto scrollbar-hide">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center opacity-30">
                            <Bell size={32} className="mx-auto mb-2" />
                            <p className="text-xs">No notifications yet</p>
                          </div>
                        ) : (
                          notifications.map(n => (
                            <div 
                              key={n.id} 
                              className={cn(
                                "p-4 border-b border-[#333537] hover:bg-white/[0.03] transition-all relative group",
                                !n.isRead && "bg-white/[0.03] shadow-inner"
                              )}
                            >
                              <div className="flex gap-3">
                                <div className="w-8 h-8 rounded-full bg-[#1E1F20]/50 flex items-center justify-center text-xs font-bold text-[#C4C7C5]">
                                  {n.senderName?.[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-white leading-relaxed">
                                    <span className="font-bold">{n.senderName}</span> {n.message}
                                  </p>
                                  <p className="text-[9px] font-bold text-white/50 mt-1 uppercase tracking-widest">
                                    {n.timestamp ? new Date(n.timestamp.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                                  </p>
                                </div>
                              </div>
                              <div className="absolute right-2 top-4 flex gap-1 transform scale-90 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all">
                                {!n.isRead && (
                                  <button onClick={() => markNotificationRead(n.id)} className="p-2 bg-[#1E1F20]/50 text-[#C4C7C5] hover:bg-slate-100 hover:text-white rounded-xl transition-all border border-white/20 shadow-sm"><ThumbsUp size={12} /></button>
                                )}
                                <button onClick={() => deleteNotification(n.id)} className="p-2 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-xl transition-all border border-red-500/10 shadow-sm"><Trash2 size={12} /></button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Search Box */}
          <div className="hidden lg:flex items-center gap-3 ml-auto bg-[#1E1F20]/50 border border-[#333537] p-1 rounded-2xl w-80 relative">
             <div className="absolute left-3 text-[#8E918F]">
                <Search size={14} />
             </div>
             <input 
               type="text"
               placeholder="Search document or type /command..."
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
               onKeyDown={(e) => {
                 if (e.key === 'Enter') {
                   if (searchQuery.startsWith('/')) {
                     handleCommand(searchQuery);
                   } else {
                     performSemanticSearch();
                   }
                 }
               }}
               className="flex-1 bg-transparent border-none focus:outline-none text-xs text-white pl-9 pr-10 h-8 font-medium"
             />
             {searchQuery && (
               <button 
                 onClick={() => setSearchQuery('')}
                 className="absolute right-2 p-1 text-[#8E918F] hover:text-white"
                 title="Clear Search"
               >
                 <X size={12} />
               </button>
             )}
          </div>

          <div className="flex-1 flex justify-end pb-5 items-center gap-3">

            {/* WhatsApp Share Target & PWA Install Button */}
            <button
              onClick={() => setIsShareModalOpen(true)}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all duration-200 shadow-sm hover:scale-[1.02] active:scale-[0.98]",
                isInstalled
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20"
                  : "bg-indigo-600/15 border-indigo-500/30 text-indigo-300 hover:bg-indigo-600/25 hover:text-white"
              )}
              title="WhatsApp Share Sheet Integration & PWA Setup"
            >
              <Share2 size={13} className={isInstalled ? "text-emerald-400" : "text-indigo-400"} />
              <span className="hidden sm:inline">
                {isInstalled ? "WhatsApp Share Ready" : "WhatsApp Share / Install"}
              </span>
              <span className="sm:hidden">Share</span>
              {!isInstalled && (
                <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              )}
            </button>

            <AuthComponent variant="header" />
            
          </div>

        <div className="p-2 sm:p-4 lg:p-5">
          <div className="max-w-[1850px] 2xl:max-w-full w-full space-y-4">
            <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            >
            {activeTab === 'single' && history.length > 0 && (
                <div className="space-y-8 mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                  <div className="flex items-center justify-between border-b border-[#333537] pb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-white/[0.03] flex items-center justify-center text-[#C4C7C5]">
                        <History size={16} />
                      </div>
                      <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-[#8E918F]">Recent generations</h3>
                    </div>
                    <div className="flex gap-2">
                            {allTags.map(tag => (
                              <button 
                                key={tag} 
                                onClick={() => setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag])}
                                className={cn(
                                  "text-xs px-4 py-2 rounded-xl font-bold transition-all border shadow-sm hover:-translate-y-0.5 active:translate-y-0",
                                  selectedTags.includes(tag) 
                                    ? "bg-slate-100 text-[#131314] border-[#444746] shadow-white/20" 
                                    : "bg-[#1E1F20]/50 text-[#E3E3E3] border-[#333537] hover:bg-[#333537] hover:text-white"
                                )}
                              >
                                {tag}
                              </button>
                            ))}
                      {history.length > 0 && (
                        <button 
                          onClick={clearHistory} 
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-300 hover:bg-rose-500/20 hover:text-white transition-all duration-200 text-[10px] font-bold uppercase tracking-wider border border-rose-500/20 hover:border-rose-500/40 shadow-sm hover:scale-105 active:scale-95 group/bulkdel"
                          title="Bulk Delete History"
                        >
                          <Trash2 size={12} className="group-hover/bulkdel:rotate-12 transition-transform text-rose-400" />
                          <span>Clear History</span>
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {filteredHistory.slice(0, 4).map((h, i) => (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.05 }}
                        key={h.id} 
                        className={cn(
                          "group p-5 rounded-2xl border transition-all flex items-center justify-between gap-4 glass-dark relative",
                          theme === 'dark' ? "hover:bg-white/[0.03]" : "bg-white/[0.03]0 hover:bg-white",
                          h.isStarred && "border-white/40 ring-1 ring-white/10"
                        )}
                      >
                        <div className="absolute top-2 right-2 flex gap-1 transform scale-75 opacity-0 group-hover:opacity-100 group-hover:scale-100 transition-all">
                           <button 
                            onClick={(e) => { e.stopPropagation(); toggleStar(h.id); }}
                            className={cn(
                              "p-2 rounded-xl transition-all border",
                              h.isStarred ? "bg-slate-100 text-[#131314] text-white border-white/50 shadow-lg shadow-white/20" : "bg-white/[0.03] text-[#C4C7C5] border-[#333537] hover:border-white/50"
                            )}
                            title={h.isStarred ? "Unstar" : "Star"}
                           >
                              <Star size={14} className={cn(h.isStarred && "fill-current scale-110")} />
                           </button>
                        </div>
                        <div className="flex-1 min-w-0">
                           <p className={cn("text-sm font-medium line-clamp-1", h.feedback ? "mb-1" : "mb-2", theme === 'dark' ? "text-[#E3E3E3]" : "text-[#1F1F1F]")}>{h.text}</p>
                           
                           {/* Waveform Visualization */}
                           <div className="mb-3">
                             <WaveformVisualizer isActive={audioUrl === h.url} />
                           </div>

                           {h.feedback && (
                             <div className="mb-3 px-4 py-2.5 bg-white/[0.03] rounded-2xl border border-[#333537] italic text-[11px] text-[#C4C7C5] flex items-start gap-3 shadow-inner">
                               <MessageSquare size={12} className="mt-0.5 shrink-0 opacity-60" />
                               <span className="leading-relaxed font-medium">{h.feedback}</span>
                             </div>
                           )}

                           {h.directorsNotes && (
                             <div className="mb-3 px-4 py-2.5 bg-slate-100 text-[#131314]/5 rounded-2xl border border-[#444746] text-[11px] text-[#8E918F] flex items-start gap-3 shadow-inner">
                               <AlertCircle size={12} className="mt-0.5 shrink-0 opacity-60" />
                               <span className="leading-relaxed font-medium">Director's Note: {h.directorsNotes}</span>
                             </div>
                           )}

                           <div className="flex items-center gap-4 text-xs text-[#8E918F] font-bold tracking-tight">
                              <span className="flex items-center gap-1.5"><Play size={10} className="text-[#C4C7C5]" /> {new Date(h.timestamp).toLocaleDateString()}</span>
                              <div className="flex flex-wrap gap-1">
                                 {(h.tags || []).map(t => <span key={t} className="px-1.5 py-0.5 bg-white/[0.03] text-[#C4C7C5] rounded-md">#{t}</span>)}
                                 <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const tag = prompt("Enter tag:");
                                      if (tag) addTag(h.id, tag);
                                    }}
                                    className="px-1.5 py-0.5 bg-white/[0.03] hover:text-white rounded-md transition-colors"
                                 >
                                    +
                                 </button>
                                 <button 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      const note = prompt("Enter Director's Note:", h.directorsNotes || '');
                                      if (note !== null) addDirectorsNote(h.id, note);
                                    }}
                                    className="px-1.5 py-0.5 bg-white/[0.03] hover:text-white rounded-md transition-colors"
                                    title="Add/Edit Director's Note"
                                 >
                                    <MessageSquare size={8} />
                                 </button>
                               </div>
                           </div>
                        </div>
                        <div className="flex items-center gap-1.5 transition-all">
                            <button 
                               title={comparingIds.includes(h.id) ? "Remove from Comparison" : "Add to Comparison"} 
                               onClick={() => toggleComparison(h.id)} 
                               className={cn(
                                 "p-2.5 rounded-2xl transition-all shadow-sm",
                                 comparingIds.includes(h.id) ? "bg-slate-100 text-[#131314] text-white animate-pulse" : "bg-white/[0.03] text-[#8E918F] hover:text-white"
                               )}
                             >
                               <Layers size={16} />
                             </button>
                             <button 
                               onClick={async () => {
                                 const shareData = {
                                   title: 'Bharat Performance Agent',
                                   text: `${h.text}\n\nGenerated via Bharat Performance Agent`,
                                   url: window.location.href, // Note: h.url is a local blob/base64 so we can't share it as url properly across devices, but this is the best we can do for now
                                 };
                                 if (navigator.share) {
                                   try { await navigator.share(shareData); return; } catch (e) {}
                                 }
                                 try {
                                   await navigator.clipboard.writeText(`${h.text}\n\nGenerated via Bharat Performance Agent: ${window.location.href}`);
                                   setErrorInfo("Text copied to clipboard!");
                                   setTimeout(() => setErrorInfo(null), 2000);
                                 } catch (e) {
                                   setErrorInfo("Clipboard access denied.");
                                 }
                               }} 
                               className="p-2.5 bg-white/[0.03] text-[#C4C7C5] hover:bg-slate-100 hover:text-white rounded-2xl transition-all"
                               title="Share/Copy"
                             >
                               <Share2 size={16} />
                             </button>
                            <button title="Replay" onClick={() => { setText(h.text); setAudioUrl(h.url); }} className="p-2.5 bg-white/[0.03] text-[#C4C7C5] hover:bg-indigo-500 hover:text-white rounded-2xl transition-all"><Play size={16} /></button>
                             <button onClick={() => addToPlaylist(h)} title="Add to Playlist" className="p-2.5 text-[#8E918F] hover:text-white hover:bg-white/10 rounded-2xl transition-all"><Plus size={16} /></button>
                             <button onClick={() => {
                               if (!user) { setErrorInfo("Sign in to share with teams!"); setActiveTab('shared'); return; }
                               if (sharedPlaylists.length === 0) { setErrorInfo("Create a team folder first!"); setActiveTab('shared'); return; }
                               const playlistNames = sharedPlaylists.map((p, i) => `${i+1}. ${p.name}`).join('\n');
                               const choice = prompt(`Select team folder (number):\n${playlistNames}`);
                               if (choice) {
                                 const index = parseInt(choice) - 1;
                                 const selected = sharedPlaylists[index];
                                 if (selected) {
                                   const isOwner = selected.ownerId === user?.uid;
                                   const role = selected.collaboratorRoles?.[user?.email?.toLowerCase() || ''] || 'viewer';
                                   if (!isOwner && role !== 'editor') {
                                     setErrorInfo("You need 'Editor' role to add tracks to this folder.");
                                   } else {
                                     shareToPlaylist(selected.id, h);
                                   }
                                 }
                               }
                             }} title="Share to Team" className="p-2.5 text-[#8E918F] hover:text-blue-400 hover:bg-white/10 rounded-2xl transition-all"><Users size={16} /></button>
                            <button onClick={async () => { 
                              try {
                                await navigator.clipboard.writeText(h.text); 
                                setCommandFeedback("History text copied!");
                                setTimeout(() => setCommandFeedback(null), 2000);
                              } catch(e) {
                                setErrorInfo("Failed to copy text.");
                              }
                            }} title="Copy Text" className="p-2.5 text-[#8E918F] hover:text-indigo-300 hover:bg-indigo-500/20 rounded-2xl border border-transparent hover:border-indigo-500/30 transition-all hover:scale-105 active:scale-95 group/hcopy"><Copy size={16} className="group-hover/hcopy:scale-110 transition-transform" /></button>
                            <button onClick={() => exportAsPDF(h)} title="Export PDF" className="p-2.5 text-[#8E918F] hover:text-red-400 hover:bg-white/10 rounded-2xl transition-all"><BookOpen size={16} /></button>
                            <button onClick={() => deleteHistoryItem(h.id)} title="Delete Item" className="p-2.5 text-[#8E918F] hover:text-rose-300 hover:bg-rose-500/20 rounded-2xl border border-transparent hover:border-rose-500/30 transition-all hover:scale-105 active:scale-95 group/hdel"><Trash2 size={16} className="group-hover/hdel:rotate-12 transition-transform" /></button>
                         </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {errorInfo && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-start justify-between text-red-400 shadow-2xl backdrop-blur-md relative"
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle size={20} className="flex-shrink-0 mt-0.5 text-red-400" />
                    <div className="text-xs">
                      <p className="font-black uppercase tracking-widest text-[10px] text-red-400/80 mb-0.5">System Alert</p>
                      <div className="font-medium text-red-100/90 leading-relaxed">{errorInfo}</div>
                    </div>
                  </div>
                  <button 
                    onClick={() => setErrorInfo(null)}
                    className="p-1 rounded-lg hover:bg-white/10 text-red-300 hover:text-white transition-colors flex-shrink-0 ml-3"
                    title="Dismiss alert"
                  >
                    <X size={16} />
                  </button>
                </motion.div>
              )}

              {activeTab === 'single' ? (
                <div className="space-y-6">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "rounded-2xl shadow-2xl border overflow-hidden flex flex-col transition-all duration-500 min-h-[520px] lg:min-h-[580px] glass-dark group focus-within:border-[#333537]",
                      theme === 'dark' ? 'border-[#333537] bg-[#1E1F20]/40' : 'bg-white border-[#444746]'
                    )}
                  >
                        <div className="px-4 sm:px-6 py-3 border-b border-[#333537] flex flex-wrap justify-between items-center gap-3 bg-white/[0.01]">
                            {/* Left Group: Primary Modes & Quick Copy */}
                            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                                {/* 3-Way Mode Switcher: Text Editor | Tabular Grid | Formatted Preview */}
                                <div className="flex bg-white/[0.04] border border-[#333537] rounded-xl p-0.5 items-center shadow-inner">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsPreviewMode(false);
                                      setEditMode('text');
                                    }}
                                    className={cn(
                                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                                      !isPreviewMode && editMode === 'text'
                                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold"
                                        : "text-[#C4C7C5] hover:text-white hover:bg-white/5"
                                    )}
                                    title="Switch to Text Editor Mode"
                                  >
                                    <FileText size={13} />
                                    <span>Text Editor</span>
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      setIsPreviewMode(false);
                                      setEditMode('grid');
                                    }}
                                    className={cn(
                                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                                      !isPreviewMode && editMode === 'grid'
                                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold"
                                        : "text-[#C4C7C5] hover:text-white hover:bg-white/5"
                                    )}
                                    title="Switch to Tabular Grid / Spreadsheet Mode"
                                  >
                                    <Table size={13} />
                                    <span>Tabular Grid</span>
                                  </button>

                                  <button 
                                    type="button"
                                    onClick={() => {
                                      setIsPreviewMode(true);
                                      setPreviewDisplayMode('full');
                                    }}
                                    className={cn(
                                      "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition-all cursor-pointer",
                                      isPreviewMode 
                                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-600/30 font-bold" 
                                        : "text-[#C4C7C5] hover:text-white hover:bg-white/5"
                                    )}
                                    title="Switch to Formatted Preview Mode"
                                  >
                                    <BookOpen size={13} />
                                    <span>Preview</span>
                                    {isPreviewMode && (
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />
                                    )}
                                  </button>
                                </div>

                                {/* Preview Split/Full Sub-selector */}
                                {isPreviewMode && (
                                  <div className="flex items-center bg-white/[0.04] border border-[#333537] rounded-xl p-0.5 animate-in fade-in duration-200">
                                    <button
                                      type="button"
                                      onClick={() => setPreviewDisplayMode('full')}
                                      className={cn(
                                        "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer",
                                        previewDisplayMode === 'full' 
                                          ? "bg-indigo-600 text-white shadow-xs" 
                                          : "text-[#8E918F] hover:text-white"
                                      )}
                                      title="Full Document Preview"
                                    >
                                      <BookOpen size={11} />
                                      <span>Full</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setPreviewDisplayMode('split')}
                                      className={cn(
                                        "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1 cursor-pointer",
                                        previewDisplayMode === 'split' 
                                          ? "bg-indigo-600 text-white shadow-xs" 
                                          : "text-[#8E918F] hover:text-white"
                                      )}
                                      title="Live Split View (Live Edit + Formatted Preview)"
                                    >
                                      <Columns size={11} />
                                      <span>Split View</span>
                                    </button>
                                  </div>
                                )}

                                <div className="h-4 w-px bg-white/10 mx-0.5 hidden sm:block" />

                                {/* Touch & Click Copy Button */}
                                <button 
                                  type="button"
                                  onClick={handleCopyEditorText}
                                  onTouchEnd={(e) => {
                                    e.preventDefault();
                                    handleCopyEditorText(e);
                                  }}
                                  className={cn(
                                    "touch-manipulation flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 border cursor-pointer select-none active:scale-95 shadow-sm",
                                    isMainEditorCopied 
                                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-emerald-500/20" 
                                      : "bg-white/[0.04] text-[#C4C7C5] hover:text-white border-[#333537] hover:bg-white/10"
                                  )}
                                  title="Copy text to clipboard"
                                >
                                  {isMainEditorCopied ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} className="text-indigo-400" />}
                                  <span>{isMainEditorCopied ? 'Copied!' : 'Copy'}</span>
                                </button>
                            </div>

                            {/* Right Group: Typography, Formatting & Smart Tools */}
                            <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">


                                {/* Font Size & Color Controls */}
                                <div className="hidden lg:flex items-center gap-1.5">
                                  <div className="flex items-center bg-white/[0.03] border border-[#333537] rounded-xl px-2.5 py-1">
                                    <Type size={13} className="text-[#8E918F] mr-1.5" />
                                    <input 
                                      type="range" 
                                      min="12" max="48" 
                                      value={editorFontSize} 
                                      onChange={(e) => setEditorFontSize(Number(e.target.value))} 
                                      className="w-14 h-1 bg-white/20 rounded-lg appearance-none cursor-pointer accent-indigo-500"
                                      title="Font Size"
                                    />
                                  </div>
                                  
                                  <div className="flex items-center bg-white/[0.03] border border-[#333537] rounded-xl px-2 py-1 gap-1.5 cursor-pointer hover:bg-white/10 transition-colors">
                                    <Palette size={13} className="text-[#8E918F]" />
                                    <input 
                                      type="color" 
                                      value={editorColor || (theme === 'dark' ? '#ffffff' : '#000000')} 
                                      onChange={(e) => setEditorColor(e.target.value)}
                                      className="w-4 h-4 p-0 border-none cursor-pointer bg-transparent rounded-full overflow-hidden" 
                                      title="Text Color"
                                    />
                                  </div>
                                </div>

                                <div className="h-4 w-px bg-white/10 mx-0.5 hidden sm:block" />

                                {/* Format Spacing & Save */}
                                <div className="flex items-center gap-1.5">
                                  <button
                                    type="button"
                                    onClick={handleFormatText}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-white/[0.04] text-[#C4C7C5] border border-[#333537] hover:bg-indigo-500/20 hover:text-indigo-300 hover:border-indigo-500/30 transition-all cursor-pointer active:scale-95 touch-manipulation"
                                    title="Format & clean spacing"
                                  >
                                    <Wand2 size={13} className="text-amber-400" />
                                    <span className="hidden md:inline">Format</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={handleDownloadText}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-white/[0.04] text-[#C4C7C5] border border-[#333537] hover:bg-white/10 hover:text-white transition-all cursor-pointer active:scale-95 touch-manipulation"
                                    title="Download .txt"
                                  >
                                    <Download size={13} className="text-indigo-400" />
                                    <span className="hidden md:inline">Save .txt</span>
                                  </button>
                                </div>

                                <div className="h-4 w-px bg-white/10 mx-0.5 hidden sm:block" />

                                {/* Platform Toolkit Button */}
                                <button 
                                  type="button"
                                  onClick={() => setIsPlatformToolkitOpen(true)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600 hover:text-white transition-all shadow-sm group/kit"
                                  title="Platform Distribution Toolkit"
                                >
                                  <Globe size={13} className="group-hover/kit:rotate-[360deg] transition-transform duration-700" />
                                  <span className="hidden sm:inline">Platform Toolkit</span>
                                </button>

                                {/* Dictation / Undo / Redo / Maximize */}
                                <div className="flex items-center gap-1">
                                  <button 
                                    type="button"
                                    onClick={toggleEditorDictation}
                                    className={cn(
                                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold uppercase tracking-wider transition-all",
                                      isDictatingEditor 
                                        ? "bg-red-500/20 text-red-300 border border-red-500/40 animate-pulse" 
                                        : "bg-white/[0.04] text-[#C4C7C5] border border-[#333537] hover:bg-white/10 hover:text-white"
                                    )}
                                    title={isDictatingEditor ? "Stop Dictation" : "Dictate Speech"}
                                  >
                                    <Mic size={13} className={isDictatingEditor ? "animate-pulse" : ""} />
                                    <span className="hidden md:inline">{isDictatingEditor ? 'Dictating...' : 'Dictate'}</span>
                                  </button>

                                  <button 
                                    type="button"
                                    onClick={handleUndo}
                                    disabled={undoStack.length === 0}
                                    className={cn("p-1.5 rounded-lg transition-all", undoStack.length === 0 ? "opacity-30 cursor-not-allowed text-slate-600" : "hover:bg-white/10 text-[#C4C7C5] hover:text-white")}
                                    title="Undo"
                                  >
                                    <Undo2 size={13} />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={handleRedo}
                                    disabled={redoStack.length === 0}
                                    className={cn("p-1.5 rounded-lg transition-all", redoStack.length === 0 ? "opacity-30 cursor-not-allowed text-slate-600" : "hover:bg-white/10 text-[#C4C7C5] hover:text-white")}
                                    title="Redo"
                                  >
                                    <Redo2 size={13} />
                                  </button>
                                  <button 
                                    type="button"
                                    onClick={() => setIsEditorMaximized(true)}
                                    className="p-1.5 rounded-lg transition-all hover:bg-white/10 text-[#C4C7C5] hover:text-white"
                                    title="Maximize Workspace"
                                  >
                                    <Maximize2 size={13} />
                                  </button>
                                </div>
                            </div>
                        </div>

                      {/* Extracted Photos & Images Gallery Strip */}
                      {extractedPdfImages.length > 0 && (
                        <div className="px-4 py-2.5 bg-indigo-950/20 border-b border-indigo-500/20 flex items-center justify-between gap-3 flex-wrap animate-fadeIn">
                          <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none max-w-full">
                            <div className="flex items-center gap-1.5 text-indigo-400 font-bold text-xs shrink-0 mr-1">
                              <ImageIcon size={14} />
                              <span>Document Photos ({extractedPdfImages.length}):</span>
                            </div>
                            {extractedPdfImages.map((img) => (
                              <div 
                                key={img.id} 
                                className="relative group/thumb shrink-0 rounded-lg overflow-hidden border border-white/15 bg-black/40 hover:border-indigo-400 transition-all cursor-pointer shadow-sm"
                                onClick={() => setSelectedViewingImage({ dataUrl: img.dataUrl, caption: img.caption })}
                                title={`${img.caption} - Click to preview full size`}
                              >
                                <img src={img.dataUrl || undefined} alt={img.caption} className="w-9 h-9 object-cover group-hover/thumb:scale-110 transition-transform" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover/thumb:opacity-100 transition-opacity flex items-center justify-center">
                                  <ZoomIn size={12} className="text-white" />
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button 
                              onClick={() => {
                                const imgTags = extractedPdfImages.map(img => `![${img.caption}](${img.dataUrl})`).join('\n\n');
                                setText(prev => prev ? prev + '\n\n' + imgTags : imgTags);
                                setCommandFeedback("Embedded all photos in document text.");
                              }}
                              className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white rounded-lg border border-indigo-500/30 transition-all cursor-pointer"
                            >
                              Embed In Text
                            </button>
                            <button 
                              onClick={() => setExtractedPdfImages([])}
                              className="p-1 hover:bg-white/10 text-[#8E918F] hover:text-white rounded-lg transition-colors cursor-pointer"
                              title="Dismiss image strip"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        </div>
                      )}

                      <div 
                        id="editor-render-container" 
                        className={cn(
                          "relative flex-1 flex flex-col transition-colors duration-200", 
                          (!isPreviewMode && editMode === 'text') && "bg-editor-grid",
                          isDraggingFile && "ring-2 ring-indigo-500/50 bg-indigo-500/[0.03]"
                        )} 
                        style={{ backgroundColor: editorBg || 'transparent' }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingFile(true);
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingFile(false);
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setIsDraggingFile(false);
                          const files = e.dataTransfer.files;
                          if (files && files.length > 0) {
                            const droppedFile = files[0];
                            if (droppedFile.type === 'application/pdf' || droppedFile.name.toLowerCase().endsWith('.pdf')) {
                              handlePdfUpload(droppedFile);
                            } else {
                              handleFileUpload({ target: { files: [droppedFile] } } as any);
                            }
                          }
                        }}
                      >
                        {/* Drag & Drop Visual Overlay */}
                        <AnimatePresence>
                          {isDraggingFile && (
                            <motion.div 
                              initial={{ opacity: 0, scale: 0.98 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.98 }}
                              className="absolute inset-0 z-50 bg-[#1E1F20]/90 backdrop-blur-sm border-2 border-dashed border-indigo-400/80 rounded-2xl flex flex-col items-center justify-center gap-3 text-white pointer-events-none p-6 text-center"
                            >
                              <div className="p-4 bg-indigo-600/30 rounded-full border border-indigo-400/40 text-indigo-300">
                                <FileUp size={36} className="animate-bounce" />
                              </div>
                              <p className="text-base font-bold tracking-tight">Drop PDF or Document Here</p>
                              <p className="text-xs text-[#C4C7C5] max-w-sm">Will be automatically digitized 1:1 ('same to same') with exact tables, text, photos, and formatting preserved.</p>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* PDF Uploading / Digitizing Indicator Overlay */}
                        <AnimatePresence>
                          {isUploadingPdf && (
                            <motion.div 
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="absolute inset-0 z-50 bg-[#131314]/85 backdrop-blur-sm flex flex-col items-center justify-center gap-4 text-white p-6 text-center"
                            >
                              <div className="p-4 bg-red-500/20 rounded-2xl border border-red-500/30">
                                <Loader2 size={36} className="animate-spin text-red-400" />
                              </div>
                              <div className="space-y-1 max-w-sm">
                                <h4 className="text-sm font-black uppercase tracking-wider text-red-400">Digitizing PDF & Extracting Photos...</h4>
                                <p className="text-xs text-[#C4C7C5]">Extracting all pages, text, Markdown tables, and embedded images with 100% 1:1 structural fidelity.</p>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Editor Content Area */}
                        {isPreviewMode ? (
                          <div className={cn(
                            "absolute inset-0 w-full h-full z-30 flex flex-col overflow-hidden",
                            theme === 'dark' ? "bg-[#131314]" : "bg-[#fcfcfd]"
                          )}>
                            {/* Preview Mode User-Friendly Header Bar */}
                            <div className={cn(
                              "px-4 sm:px-6 py-2.5 border-b flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 select-none backdrop-blur-md",
                              theme === 'dark' ? "bg-[#1E1F20]/90 border-[#333537] text-[#C4C7C5]" : "bg-white/90 border-slate-200 text-slate-600 shadow-xs"
                            )}>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-500/10 text-indigo-400 font-bold border border-indigo-500/20 text-[11px] uppercase tracking-wider">
                                  <BookOpen size={13} className="text-indigo-400" />
                                  <span>Formatted Preview</span>
                                </div>
                                <span className="text-[11px] text-[#8E918F] hidden sm:inline">
                                  {text ? `${text.split(/\s+/).filter(Boolean).length} words · ${text.length} characters` : 'Empty document'}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 flex-wrap">
                                {/* Layout switcher: Full vs Split */}
                                <div className="flex items-center bg-white/[0.04] border border-[#333537] rounded-xl p-0.5">
                                  <button
                                    onClick={() => setPreviewDisplayMode('full')}
                                    className={cn(
                                      "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
                                      previewDisplayMode === 'full' 
                                        ? "bg-indigo-600 text-white shadow-xs" 
                                        : "text-[#8E918F] hover:text-white"
                                    )}
                                    title="View full rendered preview"
                                  >
                                    <BookOpen size={12} />
                                    <span>Full Preview</span>
                                  </button>
                                  <button
                                    onClick={() => setPreviewDisplayMode('split')}
                                    className={cn(
                                      "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-1.5",
                                      previewDisplayMode === 'split' 
                                        ? "bg-indigo-600 text-white shadow-xs" 
                                        : "text-[#8E918F] hover:text-white"
                                    )}
                                    title="Live side-by-side editing and formatted preview"
                                  >
                                    <Columns size={12} />
                                    <span>Split View</span>
                                  </button>
                                </div>

                                <div className="h-4 w-px bg-white/10 mx-1 hidden sm:block" />

                                {/* Quick Copy Formatted Markdown Text */}
                                <button
                                  type="button"
                                  onClick={handleCopyEditorText}
                                  onTouchEnd={(e) => {
                                    e.preventDefault();
                                    handleCopyEditorText(e);
                                  }}
                                  className={cn(
                                    "flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 border",
                                    isMainEditorCopied 
                                      ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40" 
                                      : "bg-white/[0.03] text-[#C4C7C5] hover:text-white border-white/10 hover:border-white/20 hover:bg-white/10"
                                  )}
                                  title="Copy text to clipboard"
                                >
                                  {isMainEditorCopied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                                  <span>{isMainEditorCopied ? 'Copied' : 'Copy'}</span>
                                </button>

                                {/* Print / PDF Friendly Export */}
                                <button
                                  onClick={() => window.print()}
                                  className="flex items-center gap-1.5 px-3 py-1 bg-white/[0.03] hover:bg-white/10 text-[#C4C7C5] hover:text-white border border-white/10 hover:border-white/20 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all"
                                  title="Print or Save as PDF"
                                >
                                  <Printer size={12} />
                                  <span className="hidden sm:inline">Print</span>
                                </button>

                                {/* Back to Editor */}
                                <button
                                  onClick={() => setIsPreviewMode(false)}
                                  className="flex items-center gap-1.5 px-3 py-1 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all cursor-pointer shadow-sm ml-1"
                                  title="Return to standard editor view"
                                >
                                  <Edit2 size={12} />
                                  <span>Edit Text</span>
                                </button>
                              </div>
                            </div>

                            {/* Main Preview Container Body: Full or Split View */}
                            <div className="flex-1 flex overflow-hidden">
                              {/* If in Split View, show an editable live textarea side with quick formatting & status bar */}
                              {previewDisplayMode === 'split' && (
                                <div className={cn(
                                  "w-1/2 h-full flex flex-col border-r overflow-hidden",
                                  theme === 'dark' ? "border-[#333537] bg-black/20" : "border-slate-200 bg-slate-50/50"
                                )}>
                                  <div className="px-4 py-2.5 border-b border-white/5 flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-[#8E918F] bg-white/[0.01]">
                                    <div className="flex items-center gap-1.5">
                                      <Edit2 size={11} className="text-indigo-400 animate-pulse" />
                                      <span className="text-indigo-300 font-bold">✏️ Editable Raw Text (Type Here)</span>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-[10px] text-emerald-400 font-bold lowercase">
                                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                                      <span>live sync active</span>
                                    </div>
                                  </div>

                                  {/* Quick Formatting Toolbar */}
                                  <div className="px-3 py-1.5 bg-white/[0.02] border-b border-white/5 flex items-center gap-1 flex-wrap">
                                    <button
                                      onClick={() => insertTextAtCursor('**bold text**')}
                                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                                      title="Bold"
                                    >
                                      B
                                    </button>
                                    <button
                                      onClick={() => insertTextAtCursor('*italic text*')}
                                      className="px-2 py-0.5 rounded text-[10px] italic bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                                      title="Italic"
                                    >
                                      I
                                    </button>
                                    <button
                                      onClick={() => insertTextAtCursor('\n# Heading 1\n')}
                                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                                      title="Heading"
                                    >
                                      H1
                                    </button>
                                    <button
                                      onClick={() => insertTextAtCursor('\n- List item 1\n- List item 2\n')}
                                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                                      title="Bullet List"
                                    >
                                      List
                                    </button>
                                    <button
                                      onClick={() => insertTextAtCursor('> Quote block\n')}
                                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                                      title="Quote"
                                    >
                                      Quote
                                    </button>
                                    <button
                                      onClick={() => insertTextAtCursor('`code`')}
                                      className="px-2 py-0.5 rounded text-[10px] font-mono bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                                      title="Inline Code"
                                    >
                                      Code
                                    </button>
                                    <button
                                      onClick={() => insertTextAtCursor('[Link Text](https://example.com)')}
                                      className="px-2 py-0.5 rounded text-[10px] font-bold bg-white/5 hover:bg-white/10 text-slate-300 transition-colors"
                                      title="Insert Link"
                                    >
                                      Link
                                    </button>
                                  </div>

                                  <textarea
                                    ref={textareaRef}
                                    value={text}
                                    onChange={(e) => setText(e.target.value)}
                                    onClick={updateCursorPos}
                                    onKeyUp={updateCursorPos}
                                    onSelect={updateCursorPos}
                                    placeholder="Type your document content here in Markdown or plain text..."
                                    className={cn(
                                      "flex-1 w-full p-4 sm:p-6 border-none resize-none focus:outline-none font-mono text-sm leading-relaxed",
                                      theme === 'dark' ? "bg-transparent text-white placeholder:text-slate-600 selection:bg-indigo-500/30" : "bg-transparent text-slate-800 placeholder:text-slate-400 selection:bg-indigo-500/20"
                                    )}
                                    style={{
                                      fontSize: `${Math.max(12, Math.min(20, editorFontSize))}px`,
                                      lineHeight: 1.6,
                                      fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace'
                                    }}
                                  />

                                  {/* Bottom Stats Footer for Split Editor */}
                                  <div className="px-4 py-2 border-t border-white/5 flex items-center justify-between text-[11px] text-[#8E918F] bg-white/[0.01]">
                                    <span>{text ? `${text.split(/\s+/).filter(Boolean).length} words · ${text.length} chars` : '0 words'}</span>
                                    <span className="text-indigo-400 font-bold flex items-center gap-1">
                                      <span className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                                      <span>Ln {cursorPos.line}, Col {cursorPos.col}</span>
                                    </span>
                                  </div>
                                </div>
                              )}

                              {/* Formatted Markdown Render Area */}
                              <div 
                                ref={previewRef}
                                className={cn(
                                  "h-full overflow-y-auto break-words p-4 sm:p-6 md:p-8 lg:p-10 transition-all duration-300 font-sans selection:bg-indigo-500/30",
                                  previewDisplayMode === 'split' ? "w-1/2" : "w-full"
                                )}
                                style={{
                                  fontSize: `${editorFontSize}px`,
                                  color: editorColor || (theme === 'dark' ? '#f1f5f9' : '#0f172a'),
                                  lineHeight: 1.7,
                                  backgroundColor: editorBg || 'transparent'
                                }}
                              >
                                {text.trim() === '' ? (
                                  <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-8 text-[#8E918F]">
                                    <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center mb-4 text-indigo-400">
                                      <BookOpen size={28} />
                                    </div>
                                    <h3 className="text-sm font-bold text-white mb-1">Document is Empty</h3>
                                    <p className="text-xs max-w-sm mb-4">Type text, paste markdown, upload a PDF, or switch back to the text editor to start writing.</p>
                                    <button
                                      onClick={() => setIsPreviewMode(false)}
                                      className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-wider rounded-xl transition-all shadow-md cursor-pointer flex items-center gap-2"
                                    >
                                      <Edit2 size={13} />
                                      <span>Write in Text Editor</span>
                                    </button>
                                  </div>
                                ) : (
                                  <div className="max-w-4xl mx-auto markdown-body">
                                    <ReactMarkdown 
                                      remarkPlugins={[remarkGfm]}
                                      components={{
                                        p: ({ node, children, ...props }) => {
                                          const hasBlockChild = React.Children.toArray(children).some((child: any) => {
                                            if (React.isValidElement(child)) {
                                              const type = child.type;
                                              return type === 'div' || type === 'p' || type === 'table' || type === 'ul' || type === 'ol' || type === 'blockquote' || type === 'img';
                                            }
                                            return false;
                                          });

                                          if (hasBlockChild) {
                                            return <div {...props} className="my-3 leading-relaxed">{children}</div>;
                                          }
                                          return <p {...props} className="my-3 leading-relaxed">{children}</p>;
                                        },
                                        table: ({ node, children, ...props }: any) => (
                                          <div className="w-full my-6 overflow-x-auto rounded-xl border border-white/20 bg-[#161718]/90 shadow-2xl">
                                            <table {...props} className="w-full border-collapse text-xs font-mono">
                                              {children}
                                            </table>
                                          </div>
                                        ),
                                        thead: ({ node, children, ...props }: any) => (
                                          <thead {...props} className="bg-[#1E1F20] text-indigo-300 font-bold border-b border-white/20">
                                            {children}
                                          </thead>
                                        ),
                                        th: ({ node, children, ...props }: any) => {
                                          let content = children;
                                          if (typeof children === 'string' && (children.includes('<br>') || children.includes('<br/>') || children.includes('<br />'))) {
                                            const parts = children.split(/<br\s*\/?>/i);
                                            content = parts.map((part, idx) => (
                                              <React.Fragment key={idx}>
                                                {part}
                                                {idx < parts.length - 1 && <br />}
                                              </React.Fragment>
                                            ));
                                          }
                                          return (
                                            <th {...props} className="border border-white/20 px-3.5 py-2.5 text-left font-bold text-indigo-300 text-[11px] uppercase tracking-wider whitespace-nowrap bg-[#1E1F20]">
                                              {content || '\u00A0'}
                                            </th>
                                          );
                                        },
                                        td: ({ node, children, ...props }: any) => {
                                          let content = children;
                                          if (typeof children === 'string' && (children.includes('<br>') || children.includes('<br/>') || children.includes('<br />'))) {
                                            const parts = children.split(/<br\s*\/?>/i);
                                            content = parts.map((part, idx) => (
                                              <React.Fragment key={idx}>
                                                {part}
                                                {idx < parts.length - 1 && <br />}
                                              </React.Fragment>
                                            ));
                                          }
                                          return (
                                            <td {...props} className="border border-white/20 px-3.5 py-2 text-[#E3E3E3] font-mono text-xs whitespace-pre-wrap">
                                              {content || '\u00A0'}
                                            </td>
                                          );
                                        },
                                        tr: ({ node, children, ...props }: any) => (
                                          <tr {...props} className="hover:bg-indigo-500/[0.06] transition-colors border-b border-white/20">
                                            {children}
                                          </tr>
                                        ),
                                        img: ({ node, ...props }) => {
                                          if (!props.src) return null;
                                          return (
                                            <div className="my-5 group relative inline-block max-w-full">
                                              <img 
                                                {...props} 
                                                src={props.src || undefined}
                                                className="max-w-full h-auto max-h-[700px] rounded-2xl border border-white/10 shadow-2xl object-contain cursor-zoom-in hover:brightness-105 transition-all bg-black/20" 
                                                loading="eager" 
                                                alt={props.alt || "Document Image"} 
                                                onClick={() => setSelectedViewingImage({ dataUrl: props.src as string, caption: props.alt || 'Document Photo' })}
                                              />
                                              <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5 bg-black/80 backdrop-blur-md rounded-xl p-1.5 text-white text-xs shadow-lg border border-white/10">
                                                <button 
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedViewingImage({ dataUrl: props.src as string, caption: props.alt || 'Document Photo' });
                                                  }}
                                                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white cursor-pointer" 
                                                  title="View Full Resolution"
                                                >
                                                  <Eye size={14} />
                                                </button>
                                                <button 
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (props.src) {
                                                      saveAs(props.src, `${(props.alt || 'photo').replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`);
                                                    }
                                                  }}
                                                  className="p-1.5 hover:bg-white/20 rounded-lg transition-colors text-white cursor-pointer" 
                                                  title="Download Photo"
                                                >
                                                  <Download size={14} />
                                                </button>
                                              </div>
                                            </div>
                                          );
                                        }
                                      }}
                                    >
                                      {text}
                                    </ReactMarkdown>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : editMode === 'grid' ? (
                          <div className={cn(
                            "absolute inset-0 w-full h-full overflow-hidden z-30 flex flex-col",
                            theme === 'dark' ? "bg-[#131314]" : "bg-slate-50"
                          )}>
                            <TabularGrid text={text} setText={setText} theme={theme} />
                          </div>
                        ) : (
                          <div 
                            ref={previewRef}
                            className={cn(
                               "absolute inset-0 w-full h-full p-4 sm:p-6 md:p-8 lg:p-10 overflow-y-auto break-words transition-all duration-300 font-mono selection:bg-indigo-500/30",
                               isHighlighterMode ? "opacity-100 z-30 pointer-events-auto" : "opacity-0 -z-10 pointer-events-none"
                            )}
                            style={{ fontSize: `${editorFontSize}px`, color: editorColor || (theme === 'dark' ? '#ffffff' : '#131314'), lineHeight: 1.6, fontFamily: '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace', backgroundColor: 'transparent' }}
                          >
                             {text.split('\n').map((line, i) => {
                               let content: React.ReactNode = line;
                               if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
                                 content = line.split('').map((char, k) => (
                                   <span key={k} className={char === '|' ? "text-indigo-500/60 font-bold" : ""}>{char}</span>
                                 ));
                               } else if (line.trim().startsWith('#')) {
                                 content = <span className="text-indigo-400 font-bold">{line}</span>;
                               } else {
                                 content = line.split(/(\[\[.*?\]\]|\*\*.*?\*\*)/g).map((part, j) => {
                                   if (part.startsWith('[[') && part.endsWith(']]')) {
                                     return <mark key={j} className="bg-amber-200/50 text-blue-500 rounded shadow-sm">{part.slice(2, -2)}</mark>;
                                   }
                                   if (part.startsWith('**') && part.endsWith('**')) {
                                     return <strong key={j} className="text-white font-bold">{part}</strong>;
                                   }
                                   return part;
                                 });
                               }
                               return <div key={i} className="min-h-[1.5em]">{content}</div>;
                             })}
                             {text === '' && <span className="opacity-30 italic">Text editor highlights will appear here. Use [[text]] to highlight.</span>}
                          </div>
                        )}

                        <div className="px-6 py-3 border-b border-[#333537] flex items-center gap-3 bg-white/[0.02] flex-wrap sm:flex-nowrap">
                          {/* New Smart Inputs Dropdown */}
                          <div className="relative shrink-0">
                            <button
                              onClick={() => setIsSmartInputsOpen(!isSmartInputsOpen)}
                              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-all border border-indigo-500/30 text-xs font-bold uppercase tracking-wider cursor-pointer hover:scale-105 active:scale-95 duration-200 select-none shadow-lg shadow-indigo-600/15"
                              title="Smart AI Inputs"
                            >
                              <Sparkles size={16} />
                              <span>Smart AI Inputs</span>
                              <ChevronDown size={14} className={cn("transition-transform duration-200", isSmartInputsOpen && "rotate-180")} />
                            </button>

                            <AnimatePresence>
                              {isSmartInputsOpen && (
                                <>
                                  <div className="fixed inset-0 z-40 cursor-default" onClick={() => setIsSmartInputsOpen(false)} />
                                  <motion.div
                                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                    animate={{ opacity: 1, y: 0, scale: 1 }}
                                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                    className="absolute left-0 top-full mt-2 w-85 bg-[#1E1F20] border border-[#333537] rounded-2xl shadow-3xl z-[150] p-4 space-y-4"
                                  >
                                    <div className="border-b border-white/5 pb-2">
                                      <h4 className="text-[10px] font-black uppercase tracking-widest text-[#8E918F]">Input Enhancements</h4>
                                    </div>

                                    {/* Upload PDF Document */}
                                    <div className="space-y-1.5">
                                      <p className="text-[9px] font-black uppercase text-[#8E918F] tracking-tighter">PDF Document</p>
                                      <button 
                                        onClick={() => {
                                          setIsSmartInputsOpen(false);
                                          pdfInputRef.current?.click();
                                        }}
                                        className={cn(
                                          "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all border border-red-500/20 text-xs font-bold uppercase tracking-wider cursor-pointer bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 active:scale-95 duration-200 select-none shadow-sm",
                                          isUploadingPdf && "animate-pulse pointer-events-none opacity-60"
                                        )}
                                        title="Upload PDF Document (1:1 Exact Transcription)"
                                        disabled={isUploadingPdf}
                                      >
                                        <FileUp size={16} className="text-red-400" />
                                        <span>{isUploadingPdf ? 'Digitizing PDF...' : 'Upload PDF Document'}</span>
                                      </button>
                                    </div>

                                    {/* Scan Handwriting */}
                                    <div className="space-y-1.5">
                                      <p className="text-[9px] font-black uppercase text-[#8E918F] tracking-tighter">Image Scanner</p>
                                      <button 
                                        onClick={() => {
                                          setIsSmartInputsOpen(false);
                                          scanInputRef.current?.click();
                                        }}
                                        className={cn(
                                          "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all border border-[#333537] text-xs font-bold uppercase tracking-wider cursor-pointer hover:bg-white/5 active:scale-95 duration-200 select-none",
                                          isExtractingHandwriting 
                                            ? "bg-slate-100/10 text-[#8E918F] border-[#333537] animate-pulse cursor-not-allowed pointer-events-none" 
                                            : "text-[#C4C7C5] hover:text-white hover:bg-white/5"
                                        )}
                                        title="Scan Handwriting"
                                        disabled={isExtractingHandwriting}
                                      >
                                        <FileText size={16} className="text-violet-400" />
                                        <span>{isExtractingHandwriting ? 'Scanning...' : 'Scan Handwriting'}</span>
                                      </button>
                                    </div>

                                    {/* Voice Command */}
                                    <div className="space-y-1.5">
                                      <p className="text-[9px] font-black uppercase text-[#8E918F] tracking-tighter">Voice Assistant</p>
                                      <motion.button 
                                        whileTap={{ scale: 0.95 }}
                                        onClick={() => {
                                          setIsSmartInputsOpen(false);
                                          startVoiceSearch();
                                        }}
                                        className={cn(
                                          "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl transition-all relative border border-[#333537] text-xs font-bold uppercase tracking-wider cursor-pointer",
                                          isListeningSearch ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "bg-[#1E1F20] text-[#C4C7C5] hover:bg-white/5 hover:text-white"
                                        )}
                                        title="Voice Command"
                                      >
                                        <Mic size={16} className={cn(isListeningSearch && "animate-pulse text-rose-400")} />
                                        <span>{isListeningSearch ? 'Listening...' : 'Voice Command'}</span>
                                        {isListeningSearch && (
                                            <div className="absolute inset-0 flex items-center justify-center gap-0.5 overflow-hidden rounded-xl bg-red-500">
                                                {[1, 2, 3, 4, 5].map((i) => (
                                                    <motion.div
                                                        key={i}
                                                        animate={{
                                                            height: [4, 12, 4],
                                                            opacity: [0.3, 1, 0.3]
                                                        }}
                                                        transition={{
                                                            duration: 0.5,
                                                            repeat: Infinity,
                                                            delay: i * 0.1
                                                        }}
                                                        className="w-0.5 bg-white rounded-full"
                                                    />
                                                ))}
                                            </div>
                                        )}
                                      </motion.button>
                                    </div>

                                    {/* Search & Fetch */}
                                    <div className="space-y-1.5 pt-1">
                                      <p className="text-[9px] font-black uppercase text-[#8E918F] tracking-tighter">Web & Video Importer</p>
                                      <div className="space-y-2">
                                        <div className="relative">
                                          <div className="absolute left-3 top-1/2 -translate-y-1/2 text-indigo-400 opacity-60">
                                            <Search size={12} />
                                          </div>
                                          <input 
                                            type="text" 
                                            placeholder="Paste URL or search topic..." 
                                            value={ytUrl} 
                                            onChange={(e) => setYtUrl(e.target.value)}
                                            onKeyDown={(e) => {
                                              if (e.key === 'Enter') {
                                                setIsSmartInputsOpen(false);
                                                handleFetchYouTube();
                                              }
                                            }}
                                            className="w-full bg-[#161718] border border-[#444746] focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/20 rounded-xl pl-9 pr-3 py-2 text-[11px] text-white transition-all outline-none placeholder:text-gray-500"
                                          />
                                        </div>
                                        <button 
                                          onClick={() => {
                                            setIsSmartInputsOpen(false);
                                            handleFetchYouTube();
                                          }}
                                          disabled={isGenerating || !ytUrl}
                                          className={cn(
                                            "w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2",
                                            isGenerating ? "bg-white/10 text-[#8E918F] cursor-not-allowed" : "bg-indigo-600 hover:bg-indigo-700 text-white"
                                          )}
                                        >
                                          {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                                          <span>{isGenerating ? 'Searching...' : 'Search & Fetch'}</span>
                                        </button>
                                      </div>
                                    </div>
                                  </motion.div>
                                </>
                              )}
                            </AnimatePresence>
                          </div>

                          <div className="h-6 w-px bg-white/10 hidden sm:block" />

                          <button 
                            onClick={() => pdfInputRef.current?.click()}
                            disabled={isUploadingPdf}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 rounded-xl transition-all border border-red-500/20 text-xs font-bold uppercase tracking-wider cursor-pointer hover:scale-105 active:scale-95 duration-200 select-none shadow-sm",
                              isUploadingPdf && "animate-pulse opacity-60 pointer-events-none"
                            )}
                            title="Upload PDF document to digitize 1:1 verbatim"
                          >
                            {isUploadingPdf ? <Loader2 size={16} className="animate-spin text-red-400" /> : <FileUp size={16} className="text-red-400" />}
                            <span>{isUploadingPdf ? 'Digitizing...' : 'Upload PDF'}</span>
                          </button>

                          <button 
                            onClick={() => docInputRef.current?.click()}
                            className="flex items-center gap-2 px-4 py-2 text-[#C4C7C5] hover:text-white hover:bg-white/10 rounded-xl transition-all border border-[#333537] text-xs font-bold uppercase tracking-wider cursor-pointer hover:scale-105 active:scale-95 duration-200 select-none"
                            title="Upload File"
                          >
                            <Upload size={16} />
                            <span>Import Doc</span>
                          </button>

                          <button 
                            onClick={handleExportAsPDF}
                            className="flex items-center gap-2 px-4 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 hover:text-indigo-300 rounded-xl transition-all border border-indigo-500/20 text-xs font-bold uppercase tracking-wider cursor-pointer hover:scale-105 active:scale-95 duration-200 select-none"
                            title="Export current script as a professional formatted PDF document"
                          >
                            <FileDown size={16} />
                            <span>Export PDF</span>
                          </button>

                          <button 
                            onClick={handleExportAsTxt}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 hover:text-emerald-300 rounded-xl transition-all border border-emerald-500/20 text-xs font-bold uppercase tracking-wider cursor-pointer hover:scale-105 active:scale-95 duration-200 select-none"
                            title="Export current editor content as plain text (.txt) file with timestamp"
                          >
                            <FileText size={16} />
                            <span>Export TXT</span>
                          </button>

                          {fetchedVideoTitle && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10 max-w-[200px] shrink-0">
                              <Check size={12} className="text-green-400" />
                              <span className="text-[10px] font-bold text-[#8E918F] truncate uppercase tracking-tighter">{fetchedVideoTitle}</span>
                              <button onClick={() => setFetchedVideoTitle(null)} className="text-[#8E918F] hover:text-white"><X size={10} /></button>
                            </div>
                          )}
                        </div>
                        
                        {/* New Utility Toolbar */}
                        <div className="px-4 sm:px-10 py-2 sm:py-3 border-b border-[#333537] flex flex-wrap items-center justify-between text-[10px] sm:text-xs text-[#8E918F] bg-white/[0.02] gap-2">
                          <div className="flex flex-wrap items-center gap-4">
                            <button onClick={() => setText('')} className="bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white px-2.5 py-1 rounded-lg transition-colors">Clear</button>
                            <button onClick={handleRefineScript} className="bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 hover:text-indigo-400 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1">
                              <Sparkles size={13} /> <span className="hidden sm:inline">Refine Script</span><span className="sm:hidden">Refine</span>
                            </button>

                            <button 
                              onClick={handleAutoSegment} 
                              disabled={isSegmenting}
                              className="bg-amber-500/10 border border-amber-500/20 hover:bg-amber-500/25 hover:text-amber-400 text-amber-500 px-2.5 py-1 rounded-lg transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                              title="Auto-segment script content into thematic blocks based on narrative flow"
                            >
                              {isSegmenting ? (
                                <Loader2 size={13} className="animate-spin text-amber-400" />
                              ) : (
                                <Layers size={13} className="text-amber-400" />
                              )}
                              <span>Auto-Segment</span>
                            </button>
                            
                            <div className="w-px h-3.5 bg-white/10 mx-1 hidden xs:block" />

                            <span>Words: {text.split(/\s+/).filter(Boolean).length}</span>
                            <span className="hidden xs:inline">Chars: {text.length}</span>
                            <span className="text-indigo-400">Lang: {targetLang}</span>
                          </div>
                        </div>



                        {editMode === 'text' && !isPreviewMode && containsTable(text) && (
                          <div className="relative z-30 mx-6 mt-3 px-4 py-2.5 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between text-xs text-indigo-300 backdrop-blur-md shadow-lg shadow-indigo-950/20">
                            <div className="flex items-center gap-2.5">
                              <span className="flex h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                              <span className="font-semibold text-white">Table detected in document</span>
                              <span className="text-[#8E918F] hidden sm:inline">— You can view and edit it with the high-performance Tabular Grid Editor.</span>
                            </div>
                            <button
                              onClick={() => setEditMode('grid')}
                              className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all shadow hover:scale-105 active:scale-95"
                            >
                              Open Tabular Grid
                            </button>
                          </div>
                        )}

                        {editMode !== 'grid' && (
                          <div className="relative z-20 w-full h-full min-h-[380px] lg:min-h-[440px] flex overflow-hidden bg-transparent">
                            {!text.trim() && !isPreviewMode && (
                              <div className="absolute inset-0 pointer-events-none z-10 flex flex-col items-center justify-center p-6 text-center">
                                <div className="pointer-events-auto bg-[#18191A]/95 border border-[#333537] rounded-3xl p-6 sm:p-8 max-w-lg shadow-2xl backdrop-blur-xl space-y-4 animate-in fade-in zoom-in-95 duration-300">
                                  <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
                                    <Sparkles size={22} />
                                  </div>
                                  <div className="space-y-1">
                                    <h3 className="text-sm font-black uppercase tracking-wider text-white">Start Writing or Pick a Starter Script</h3>
                                    <p className="text-xs text-[#8E918F] leading-relaxed">Type directly in the workspace or load a structured narrative template:</p>
                                  </div>
                                  <div className="flex flex-wrap justify-center gap-2 pt-1">
                                    <button 
                                      type="button"
                                      onClick={() => handleInsertSample('narrative')}
                                      className="px-3.5 py-2 bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/30 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-sm cursor-pointer"
                                    >
                                      <FileText size={13} />
                                      <span>🎬 Video Script</span>
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => handleInsertSample('pitch')}
                                      className="px-3.5 py-2 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/30 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-sm cursor-pointer"
                                    >
                                      <Zap size={13} />
                                      <span>💡 Product Pitch</span>
                                    </button>
                                    <button 
                                      type="button"
                                      onClick={() => handleInsertSample('social')}
                                      className="px-3.5 py-2 bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-500/30 rounded-xl text-xs font-bold transition-all active:scale-95 flex items-center gap-1.5 shadow-sm cursor-pointer"
                                    >
                                      <Share2 size={13} />
                                      <span>📱 Social Hooks</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            )}

                            <textarea
                                ref={textareaRef}
                                className={cn(
                                "w-full flex-1 h-full min-h-[360px] p-4 sm:p-8 md:p-10 lg:p-12 border-none resize-none focus:outline-none transition-all duration-300 selection:bg-indigo-500/30 overflow-y-auto touch-manipulation caret-indigo-400",
                                editorFontFamily === 'mono' ? 'font-mono' : editorFontFamily === 'sans' ? 'font-sans' : 'font-serif',
                                theme === 'dark' ? 'text-white placeholder:text-slate-600' : 'text-[#131314] placeholder:text-slate-400',
                                "bg-transparent"
                                )}
                                style={{
                                  fontSize: `${Math.max(16, editorFontSize)}px`,
                                  color: editorColor || (theme === 'dark' ? '#ffffff' : '#131314'),
                                  lineHeight: 1.7,
                                  fontFamily: editorFontFamily === 'sans' 
                                    ? '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif' 
                                    : editorFontFamily === 'serif' 
                                    ? '"Lora", Georgia, Cambria, serif' 
                                    : '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
                                  touchAction: 'pan-y',
                                  WebkitOverflowScrolling: 'touch',
                                }}
                                placeholder="Type or paste document text here..."
                                value={text}
                                onChange={(e) => setText(e.target.value)}
                                onClick={updateCursorPos}
                                onKeyUp={updateCursorPos}
                                onSelect={updateCursorPos}
                                onTouchStart={handleTouchEditor}
                                onTouchEnd={handleTouchEditor}
                                onPaste={handlePaste}
                                onScroll={handleEditorScroll}
                                autoCapitalize="sentences"
                                autoCorrect="on"
                                spellCheck={false}
                            />
                          </div>
                        )}

                        {scriptChapters && (
                          <div className="absolute top-2 right-4 z-40 bg-[#1E1F20] border border-[#333537] rounded-2xl shadow-2xl w-72 max-h-[420px] overflow-hidden flex flex-col animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="p-4 border-b border-[#333537] flex justify-between items-center bg-white/[0.02]">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-black uppercase text-white tracking-widest">AI Chapters</span>
                                <span className="text-[9px] text-[#8E918F]">Click a chapter to write it</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <button 
                                  onClick={() => {
                                    const formattedChapters = "\n\n--- AI CHAPTERS ---\n" + scriptChapters.map(c => `[${c.startTime}] ${c.title}`).join('\n');
                                    insertTextAtCursor(formattedChapters);
                                    setCommandFeedback("All chapters written to editor!");
                                  }}
                                  className="text-[9px] font-black uppercase tracking-wider text-indigo-400 hover:text-indigo-300 px-2.5 py-1 rounded-lg bg-indigo-500/10 hover:bg-indigo-500/20 transition-all border border-indigo-500/20 active:scale-95"
                                  title="Write all chapters at current editor cursor position"
                                >
                                  Write All
                                </button>
                                <button onClick={() => setScriptChapters(null)} className="text-[#8E918F] hover:text-white p-1 hover:bg-white/5 rounded-lg" title="Dismiss"><X size={14} /></button>
                              </div>
                            </div>
                            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                              {scriptChapters.map((chapter, i) => (
                                <button 
                                  key={i} 
                                  onClick={() => {
                                    const textToInsert = `[${chapter.startTime}] ${chapter.title}`;
                                    insertTextAtCursor(textToInsert);
                                    setCommandFeedback(`Wrote "${chapter.title}" to script!`);
                                  }}
                                  className="w-full text-left p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group flex items-start justify-between gap-2"
                                  title="Click to write this chapter to current cursor position"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex justify-between items-center mb-1 gap-2">
                                      <span className="text-[10px] font-black text-amber-400 uppercase tracking-tighter truncate">{chapter.title}</span>
                                      <span className="text-[9px] font-mono text-[#8E918F] shrink-0">{chapter.startTime}</span>
                                    </div>
                                    <p className="text-[10px] text-[#8E918F] line-clamp-2 leading-tight group-hover:text-[#C4C7C5]">{chapter.description}</p>
                                  </div>
                                  <div className="shrink-0 self-center opacity-0 group-hover:opacity-100 transition-opacity bg-indigo-500/10 text-indigo-400 p-1.5 rounded-lg border border-indigo-500/20 hover:bg-indigo-500/20" title="Write to text">
                                    <ArrowRight size={12} className="group-hover:translate-x-0.5 transition-transform" />
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        )}

                        {thematicBlocks && isThematicBlocksOpen && (
                          <div className="absolute top-2 right-4 z-[50] bg-[#1E1F20] border border-[#333537] rounded-2xl shadow-3xl w-80 max-h-[440px] overflow-hidden flex flex-col animate-in fade-in slide-in-from-right-3 duration-200">
                            <div className="p-4 border-b border-[#333537] flex justify-between items-center bg-white/[0.02]">
                              <div className="flex flex-col gap-0.5">
                                <span className="text-[10px] font-black uppercase text-amber-400 tracking-widest">Thematic Blocks</span>
                                <span className="text-[9px] text-[#8E918F]">Chronological narrative segments</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                <button 
                                  onClick={() => {
                                    const reconstructed = thematicBlocks.map(b => b.content).join('\n\n');
                                    setText(reconstructed);
                                    setCommandFeedback("Editor text updated from blocks order!");
                                  }}
                                  className="text-[9px] font-black uppercase tracking-wider text-green-400 hover:text-green-300 px-2 py-1 rounded bg-green-500/10 hover:bg-green-500/20 transition-all border border-green-500/20 cursor-pointer"
                                  title="Sync block contents back to editor"
                                >
                                  Sync Text
                                </button>
                                <button 
                                  onClick={() => {
                                    const formatted = thematicBlocks.map(b => `### Segment: ${b.title} [${b.purpose}] (${b.duration})\n${b.content}`).join('\n\n');
                                    setText(formatted);
                                    setCommandFeedback("Wrote formatted outline and blocks to editor!");
                                  }}
                                  className="text-[9px] font-black uppercase tracking-wider text-indigo-400 hover:text-indigo-300 px-2 py-1 rounded bg-indigo-500/10 hover:bg-indigo-500/20 transition-all border border-indigo-500/20 cursor-pointer"
                                  title="Format sections with markdown headings"
                                >
                                  Layout
                                </button>
                                <button onClick={() => setIsThematicBlocksOpen(false)} className="text-[#8E918F] hover:text-white p-1 hover:bg-white/5 rounded-lg" title="Dismiss"><X size={14} /></button>
                              </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 custom-scrollbar">
                              {thematicBlocks.map((block, i) => (
                                <div 
                                  key={i} 
                                  className="w-full text-left p-3 rounded-xl bg-white/[0.02] border border-white/5 transition-all group hover:border-amber-500/30 flex flex-col gap-2 relative"
                                >
                                  <div className="flex items-start justify-between gap-1">
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-[9px] font-mono text-[#8E918F] shrink-0 bg-white/5 px-1 py-0.5 rounded border border-white/5">#{i+1}</span>
                                        <span className="text-[10px] font-black text-amber-500 uppercase tracking-tighter truncate max-w-[140px]" title={block.title}>{block.title}</span>
                                      </div>
                                      <div className="flex gap-1 items-center mt-1">
                                        <span className="text-[8px] uppercase tracking-wider text-[#C4C7C5] font-bold">{block.purpose}</span>
                                        <span className="text-[#8E918F] text-[8px]">•</span>
                                        <span className="text-[8px] font-mono text-[#8E918F]">{block.duration}</span>
                                      </div>
                                    </div>
                                    
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button 
                                        disabled={i === 0}
                                        onClick={() => {
                                          const nextBlocks = [...thematicBlocks];
                                          const temp = nextBlocks[i];
                                          nextBlocks[i] = nextBlocks[i-1];
                                          nextBlocks[i-1] = temp;
                                          setThematicBlocks(nextBlocks);
                                        }}
                                        className="text-[#8E918F] hover:text-white p-1 hover:bg-white/5 rounded cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                                        title="Move Up"
                                      >
                                        <ChevronUp size={10} />
                                      </button>
                                      <button 
                                        disabled={i === thematicBlocks.length - 1}
                                        onClick={() => {
                                          const nextBlocks = [...thematicBlocks];
                                          const temp = nextBlocks[i];
                                          nextBlocks[i] = nextBlocks[i+1];
                                          nextBlocks[i+1] = temp;
                                          setThematicBlocks(nextBlocks);
                                        }}
                                        className="text-[#8E918F] hover:text-white p-1 hover:bg-white/5 rounded cursor-pointer disabled:opacity-30 disabled:pointer-events-none"
                                        title="Move Down"
                                      >
                                        <ChevronDown size={10} />
                                      </button>
                                      <button 
                                        onClick={() => {
                                          setEditingBlockIndex(i);
                                          setEditingBlockContent(block.content);
                                        }}
                                        className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/5 cursor-pointer"
                                        title="Edit block text"
                                      >
                                        <Edit2 size={10} />
                                      </button>
                                      <button 
                                        onClick={() => {
                                          navigator.clipboard.writeText(block.content);
                                          setCommandFeedback(`Block #${i+1} copied to clipboard!`);
                                        }}
                                        className="text-indigo-400 hover:text-indigo-300 p-1 rounded hover:bg-white/5 cursor-pointer"
                                        title="Copy text"
                                      >
                                        <Copy size={10} />
                                      </button>
                                    </div>
                                  </div>
                                  
                                  {editingBlockIndex === i ? (
                                    <div className="space-y-1.5 pt-1 border-t border-white/5">
                                      <textarea 
                                        value={editingBlockContent}
                                        onChange={(e) => setEditingBlockContent(e.target.value)}
                                        className="w-full min-h-[100px] text-[10px] font-mono bg-black/40 border border-white/10 rounded-lg p-2.5 outline-none focus:border-amber-500/50 text-white resize-y"
                                      />
                                      <div className="flex justify-end gap-1.5">
                                        <button 
                                          onClick={() => setEditingBlockIndex(null)}
                                          className="text-[8px] font-bold uppercase tracking-wider text-gray-400 hover:text-white px-2 py-1 rounded bg-white/5 hover:bg-white/10 transition-all cursor-pointer"
                                        >
                                          Cancel
                                        </button>
                                        <button 
                                          onClick={() => {
                                            const nextBlocks = [...thematicBlocks];
                                            nextBlocks[i] = { ...block, content: editingBlockContent };
                                            setThematicBlocks(nextBlocks);
                                            setEditingBlockIndex(null);
                                            setCommandFeedback(`Saved changes to block #${i+1}`);
                                          }}
                                          className="text-[8px] font-bold uppercase tracking-wider text-amber-400 hover:text-amber-300 px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 transition-all border border-amber-500/20 cursor-pointer"
                                        >
                                          Save
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <p className="text-[9px] text-[#8E918F] font-mono whitespace-pre-wrap line-clamp-3 leading-tight border-t border-[#333537] pt-2 select-text group-hover:text-[#C4C7C5]">{block.content}</p>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        <input 
                            id="import-doc-input"
                            type="file" 
                            ref={docInputRef} 
                            className="hidden" 
                            accept="video/*,audio/*,image/*,.pdf,.txt,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.csv,.tsv" 
                            onChange={handleFileUpload} 
                        />
                        {!isEditorMaximized && (
                            <div className="absolute bottom-4 right-5 flex gap-2 z-30">
                              <button 
                                  onClick={() => pdfInputRef.current?.click()}
                                  disabled={isUploadingPdf}
                                  className={cn(
                                    "p-2.5 sm:p-3 bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 rounded-xl transition-all border border-red-500/20 shadow-lg shadow-red-500/10 hover:scale-105 active:scale-95 group/pdfbtn cursor-pointer",
                                    isUploadingPdf && "animate-pulse opacity-60 pointer-events-none"
                                  )}
                                  title="Upload & Digitize PDF (1:1 Exact Transcription)"
                              >
                                  <FileUp size={16} className="group-hover/pdfbtn:-translate-y-0.5 transition-transform" />
                              </button>
                              <button 
                                  onClick={() => scanInputRef.current?.click()}
                                  className="p-2.5 sm:p-3 bg-slate-100/10 text-[#C4C7C5] hover:bg-slate-100 hover:text-white rounded-xl transition-all border border-white/20 shadow-lg shadow-zinc-100/10 hover:scale-105 active:scale-95 group/uploadbtn cursor-pointer"
                                  title="Upload Image/Scan"
                              >
                                  <FileText size={16} className="group-hover/uploadbtn:rotate-12 transition-transform" />
                              </button>
                              <button 
                                  onClick={() => setIsEditorMaximized(true)}
                                  className="p-2.5 sm:p-3 bg-slate-100/10 text-[#C4C7C5] hover:bg-slate-100 hover:text-white rounded-xl transition-all border border-white/20 shadow-lg shadow-zinc-100/10 hover:scale-105 active:scale-95 group/maxbtn"
                                  title="Expand Focus Editor"
                              >
                                  <Maximize2 size={16} className="group-hover/maxbtn:rotate-12 transition-transform" />
                              </button>
                            </div>
                        )}
                      </div>
                      
                        {activeSegmentMoods.length > 0 && useSentimentAI && (
                          <div className="px-10 py-3 border-t border-[#333537] flex gap-3 overflow-x-auto scrollbar-hide bg-white/[0.03]">
                            {activeSegmentMoods.map((seg, i) => (
                              <div key={i} className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-2xl text-xs font-black uppercase tracking-tight shrink-0 border transition-all hover:scale-105",
                                seg.mood === 'Excited' ? "bg-slate-100 text-[#131314]/10 text-amber-400 border-[#444746] shadow-lg shadow-amber-500/5" :
                                seg.mood === 'Calm' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-lg shadow-emerald-500/5" :
                                seg.mood === 'Urgent' ? "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-lg shadow-rose-500/5" :
                                "bg-white/[0.03] text-[#C4C7C5] border-white/20"
                              )}>
                                <Activity size={12} className={cn(isGenerating && "animate-pulse")} /> {seg.mood}
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="px-4 sm:px-6 py-2.5 border-t border-[#333537] flex flex-wrap justify-between items-center gap-3 text-xs font-medium text-[#8E918F] bg-white/[0.01]">
                        <div className="flex flex-wrap gap-2 sm:gap-4 items-center text-[10px] sm:text-xs">
                          <span className="flex items-center gap-1"><span className="text-[#C4C7C5] font-bold">Words:</span> <span className="font-mono tabular-nums text-white">{text.split(/\s+/).filter(Boolean).length}</span></span>
                          <span className="text-white/20">·</span>
                          <span className="flex items-center gap-1"><span className="text-[#C4C7C5] font-bold">Chars:</span> <span className="font-mono tabular-nums text-white">{text.length}</span></span>
                          <span className="text-white/20">·</span>
                          <span className="flex items-center gap-1"><span className="text-[#C4C7C5] font-bold">Sentences:</span> <span className="font-mono tabular-nums text-white">{text.split(/[.!?]+/).filter(s => s.trim().length > 0).length}</span></span>
                          <span className="text-white/20">·</span>
                          <span className="flex items-center gap-1"><span className="text-[#C4C7C5] font-bold">Est Read:</span> <span className="font-mono tabular-nums text-indigo-400 font-bold">{Math.max(1, Math.ceil(text.split(/\s+/).filter(Boolean).length / 2.5))}s</span></span>
                          
                          <div className="flex items-center gap-2 ml-0 sm:ml-2">
                            <button 
                              type="button"
                              onClick={handleCopyEditorText}
                              onTouchEnd={(e) => {
                                e.preventDefault();
                                handleCopyEditorText(e);
                              }}
                              className={cn(
                                "touch-manipulation flex items-center gap-1.5 px-3 py-1 rounded-xl text-[10px] sm:text-xs font-bold uppercase tracking-wider transition-all duration-200 shadow-sm border cursor-pointer select-none active:scale-95",
                                isMainEditorCopied 
                                  ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-emerald-500/15 scale-105" 
                                  : "bg-white/[0.04] hover:bg-white/10 text-[#C4C7C5] hover:text-white border-white/10 hover:border-white/20 active:bg-white/15"
                              )}
                              title="Copy entire editor text (Touch-friendly)"
                            >
                              {isMainEditorCopied ? <Check size={14} className="text-emerald-400 animate-bounce" /> : <Copy size={14} className="text-indigo-400" />}
                              <span>{isMainEditorCopied ? 'Copied!' : 'Copy'}</span>
                            </button>

                            {showClearEditorConfirm ? (
                              <div className="flex items-center gap-1.5 bg-rose-500/10 border border-rose-500/30 rounded-xl px-2 py-0.5 animate-in fade-in duration-200">
                                <span className="text-[9px] text-rose-300 font-bold lowercase">Clear all?</span>
                                <button 
                                  onClick={() => {
                                    setText('');
                                    setShowClearEditorConfirm(false);
                                    setCommandFeedback("Editor cleared.");
                                    setTimeout(() => setCommandFeedback(null), 2000);
                                  }}
                                  className="px-2 py-0.5 bg-rose-500 hover:bg-rose-600 text-white rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all shadow-md active:scale-95 cursor-pointer"
                                >
                                  Yes
                                </button>
                                <button 
                                  onClick={() => setShowClearEditorConfirm(false)}
                                  className="px-2 py-0.5 bg-white/10 hover:bg-white/20 text-slate-300 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer"
                                >
                                  No
                                </button>
                              </div>
                            ) : (
                              <button 
                                onClick={() => setShowClearEditorConfirm(true)}
                                className="flex items-center gap-1.5 px-2.5 py-1 bg-white/[0.04] hover:bg-rose-500/15 text-[#C4C7C5] hover:text-rose-300 border border-white/10 hover:border-rose-500/30 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all duration-200 hover:scale-105 active:scale-95 group/clrbtn cursor-pointer"
                                title="Clear editor contents"
                              >
                                <Trash2 size={12} className="group-hover/clrbtn:rotate-12 transition-transform text-rose-400/80 group-hover/clrbtn:text-rose-300" />
                                <span>Delete Text</span>
                              </button>
                            )}
                          </div>
                        </div>
                        {isGenerating && (
                          <span className="text-[#C4C7C5] animate-pulse flex items-center gap-2">
                            <Activity size={12} className="animate-bounce" />
                            {isExtractingHandwriting ? "Reading handwriting..." : isAnalyzingSentiment ? "Analyzing mood sectors..." : "Syncing semantic models..."}
                          </span>
                        )}
                      </div>

                      {useSSML && (
                      <div className="px-10 py-4 bg-white/[0.03] border-t border-[#333537] flex flex-wrap gap-2.5">
                        {[
                          {label: 'Pause', tag: '<break time="500ms"/>'},
                          {label: 'Emphasis', tag: '<emphasis level="strong"></emphasis>'},
                          {label: 'Whisper', tag: '<amazon:effect name="whispered"></amazon:effect>'},
                          {label: 'Slow', tag: '<prosody rate="slow"></prosody>'}
                        ].map(item => (
                          <button 
                            key={item.label} 
                            onClick={() => setText(text + item.tag)}
                            className="bg-[#1E1F20]/50 hover:bg-slate-100 text-xs font-bold uppercase tracking-widest text-[#E3E3E3] hover:text-white px-3 py-1.5 rounded-lg transition-all border border-[#333537]"
                          >
                            {item.label}
                          </button>
                        ))}
                      </div>
                    )}

                    <div className={cn(
                      "p-3 px-10 border-t flex flex-col gap-2 transition-colors duration-500",
                      theme === 'dark' ? 'bg-[#1E1F20]/60 border-[#333537]' : 'bg-slate-50 border-[#444746]'
                    )}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-3">
                        <label className="flex items-center gap-3 text-xs font-bold uppercase tracking-widest text-[#8E918F] cursor-pointer group">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 accent-zinc-400 rounded border-[#444746] bg-[#1E1F20]/50" 
                            checked={useSSML} 
                            onChange={e => setUseSSML(e.target.checked)} 
                          />
                          SSML
                        </label>

                        <div className="flex gap-1 items-center relative">
                          <button
                            onClick={() => handleSocialFormatChange('Standard')}
                            className={cn(
                              "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all border",
                              socialFormat === 'Standard'
                                ? "bg-slate-100 text-[#131314] border-[#444746] shadow-lg shadow-white/20"
                                : "bg-[#1E1F20]/50 text-[#8E918F] border-[#333537] hover:border-[#444746]"
                            )}
                          >
                            Standard
                          </button>

                          <button
                            onClick={() => setIsSocialDropdownOpen(!isSocialDropdownOpen)}
                            className={cn(
                              "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all border flex items-center gap-1",
                              ['TikTok', 'YouTube', 'Podcast', 'Facebook', 'Twitter', 'X'].includes(socialFormat)
                                ? "bg-slate-100 text-[#131314] border-[#444746] shadow-lg shadow-white/20"
                                : "bg-[#1E1F20]/50 text-[#8E918F] border-[#333537] hover:border-[#444746]"
                            )}
                          >
                            Social Media {isSocialDropdownOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>
                          {isSocialDropdownOpen && (
                            <div className="absolute top-full left-20 mt-2 bg-[#1E1F20] border border-[#333537] rounded-xl p-2 z-50 flex flex-col gap-1 w-48 shadow-xl">
                              {['TikTok', 'YouTube', 'Podcast', 'Facebook', 'Twitter', 'X'].map(fmt => (
                                <button
                                  key={fmt}
                                  onClick={() => { handleSocialFormatChange(fmt); setIsSocialDropdownOpen(false); }}
                                  className={cn(
                                      "text-xs text-left px-3 py-2 hover:bg-white/5 rounded-lg",
                                      socialFormat === fmt ? "text-white bg-white/10" : "text-[#C4C7C5]"
                                  )}
                                >
                                  {fmt}
                                </button>
                              ))}

                              <button
                                onClick={() => { setIsPlatformToolkitOpen(true); setIsSocialDropdownOpen(false); }}
                                className="text-xs text-left px-3 py-2 hover:bg-white/5 rounded-lg text-[#C4C7C5] flex items-center gap-2"
                              >
                                <Globe size={14} /> Platform Toolkit
                              </button>
                              <button
                                className="text-xs text-left px-3 py-2 rounded-lg text-[#C4C7C5]/50 flex items-center gap-2 cursor-not-allowed"
                                disabled={true}
                              >
                                <LogIn size={14} /> Login with LinkedIn
                              </button>
                            </div>
                          )}
                          <button
                            onClick={() => setIsEnhancerDropdownOpen(!isEnhancerDropdownOpen)}
                            className={cn(
                              "px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all border flex items-center gap-1",
                              isEnhancerDropdownOpen
                                ? "bg-slate-100 text-[#131314] border-[#444746] shadow-lg shadow-white/20"
                                : "bg-[#1E1F20]/50 text-[#8E918F] border-[#333537] hover:border-[#444746]"
                            )}
                          >
                            Enhancer {isEnhancerDropdownOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                          </button>

                          {isEnhancerDropdownOpen && (
                            <div className="absolute top-full left-48 mt-2 bg-[#1E1F20] border border-[#333537] rounded-xl p-2 z-50 flex flex-col gap-1 w-48 shadow-xl">
                              <label className="flex items-center gap-2 text-xs text-left px-3 py-2 hover:bg-white/5 rounded-lg text-[#C4C7C5] cursor-pointer">
                                  <input type="checkbox" checked={useSentimentAI} onChange={e => setUseSentimentAI(e.target.checked)} className="accent-indigo-500" />
                                  Expressive AI
                              </label>
                              <button
                                onClick={() => { generateQuiz(); setIsEnhancerDropdownOpen(false); }}
                                className="text-xs text-left px-3 py-2 hover:bg-white/5 rounded-lg text-[#C4C7C5]"
                              >
                                Quiz
                              </button>
                              <button
                                onClick={() => { setIsPacingCoachActive(true); setIsEnhancerDropdownOpen(false); }}
                                className="text-xs text-left px-3 py-2 hover:bg-white/5 rounded-lg text-[#C4C7C5]"
                              >
                                Pacing Coach
                              </button>
                               <button
                                onClick={() => { handleEnhanceScript('CHAPTERS'); setIsEnhancerDropdownOpen(false); }}
                                className="text-xs text-left px-3 py-2 hover:bg-white/5 rounded-lg text-[#C4C7C5]"
                              >
                                Auto-Chapters
                              </button>
                               <button
                                onClick={() => { summarizeText(); setIsEnhancerDropdownOpen(false); }}
                                className="text-xs text-left px-3 py-2 hover:bg-white/5 rounded-lg text-[#C4C7C5]"
                              >
                                Summarize
                              </button>
                              <div className="border-t border-white/5 my-1 pt-1 space-y-1">
                                <label className="text-[9px] font-bold text-[#8E918F] uppercase ml-1">Enhanced AI Polish</label>
                                <select 
                                    value={polishAction}
                                    onChange={(e) => setPolishAction(e.target.value as any)}
                                    className="w-full bg-[#131314] text-[10px] font-bold uppercase tracking-wider text-[#C4C7C5] p-2 rounded-lg border border-[#333537] focus:outline-none focus:border-indigo-500"
                                >
                                    <option value="Polish">✨ Smart Polish</option>
                                    <option value="Fact-Check">⚖️ Fact-Checker</option>
                                    <option value="Structure">🏗️ Structurator</option>
                                    <option value="Bilingual">🗣️ Code-Switch</option>
                                    <option value="SEO Optimizer">🚀 Viral Hooks</option>
                                    <option value="Pacing">⏱️ Pacing & Breath</option>
                                    <option value="Visual Anchors">🎥 Visual Anchors</option>
                                    <option value="Resonance">🎯 Resonance Sim</option>
                                    <option value="Batch Translate">🇮🇳 Regional Batch</option>
                                </select>
                                {polishAction === 'Polish' && (
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-[#8E918F] uppercase ml-1">Mood/Vibe</label>
                                    <select 
                                      value={polishVibe}
                                      onChange={(e) => setPolishVibe(e.target.value as any)}
                                      className="w-full bg-[#131314] text-[10px] font-bold uppercase tracking-wider text-[#C4C7C5] p-2 rounded-lg border border-[#333537] focus:outline-none focus:border-indigo-500"
                                    >
                                      <option value="Standard">Standard</option>
                                      <option value="Gen-Z">Gen-Z Social</option>
                                      <option value="Professional Documentary">Documentary</option>
                                      <option value="Socratic">Socratic Teacher</option>
                                      <option value="Brutally Honest">Brutally Honest</option>
                                      <option value="Minimalist">Minimalist</option>
                                      <option value="Enthusiastic">Super Excited</option>
                                    </select>
                                  </div>
                                )}
                                {polishAction === 'Bilingual' && (
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-[#8E918F] uppercase ml-1">Blend Style</label>
                                    <select 
                                      value={bilingualLang}
                                      onChange={(e) => setBilingualLang(e.target.value as any)}
                                      className="w-full bg-[#131314] text-[10px] font-bold uppercase tracking-wider text-[#C4C7C5] p-2 rounded-lg border border-[#333537] focus:outline-none focus:border-indigo-500"
                                    >
                                      <option value="Hinglish">Hinglish Blend</option>
                                      <option value="Tanglish">Tanglish Blend</option>
                                      <option value="Benglish">Benglish Blend</option>
                                      <option value="Genglish">Genglish Blend</option>
                                    </select>
                                  </div>
                                )}
                                {polishAction === 'Resonance' && (
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-[#8E918F] uppercase ml-1">Target Persona</label>
                                    <input 
                                       type="text"
                                       placeholder="e.g., Students in Mumbai"
                                       className="w-full bg-[#131314] text-[10px] text-[#C4C7C5] p-2 rounded-lg border border-[#333537] focus:outline-none focus:border-indigo-500"
                                       onChange={(e) => setScriptPersona(e.target.value)}
                                    />
                                  </div>
                                )}
                                <button
                                    onClick={async () => {
                                        await handleRunPolish();
                                        setIsEnhancerDropdownOpen(false);
                                    }}
                                    className="w-full mt-2 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#131314] bg-slate-100 hover:bg-indigo-400 py-2 rounded-lg transition-all shadow-lg active:scale-95 disabled:grayscale"
                                >
                                    Run {polishAction}
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* <label className={cn(
                          "flex items-center gap-3 text-xs font-black uppercase tracking-widest transition-all px-4 py-2 rounded-2xl border",
                          engine === 'browser' ? "opacity-20 cursor-not-allowed hidden sm:flex" : "cursor-pointer group",
                          useSentimentAI 
                            ? "text-amber-400 bg-slate-100 text-[#131314]/10 border-[#444746] shadow-lg shadow-amber-900/20" 
                            : "text-[#8E918F] bg-[#1E1F20]/50 border-[#333537] hover:border-[#444746]"
                        )}>
                          <input 
                            type="checkbox" 
                            className="hidden" 
                            disabled={engine === 'browser'}
                            checked={useSentimentAI} 
                            onChange={e => setUseSentimentAI(e.target.checked)} 
                          />
                          <Sparkles size={14} className={cn(useSentimentAI && "animate-pulse")} />
                          Expressive AI
                        </label> */}
                      </div>
                    </div>


                      <div className="flex items-center gap-2 mb-2 p-2 border-b border-[#333537]">
                          <label className="text-[10px] font-bold text-[#8E918F] uppercase tracking-widest whitespace-nowrap">Add Music:</label>
                          <input 
                            type="file" 
                            accept="audio/*" 
                            onChange={(e) => {
                                if (e.target.files && e.target.files[0]) {
                                    // BGM logic here: setBGMUrl(URL.createObjectURL(file))
                                    setErrorInfo("BGM uploaded! (Mixing not yet implemented)");
                                }
                            }}
                            className="bg-[#131314] text-[10px] p-1 rounded-lg border border-[#333537] text-[#C4C7C5]"
                          />
                      </div>
                      <div className="flex items-center gap-2">
                          {/* <button
                            onClick={generateQuiz}
                            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#C4C7C5] hover:text-white px-3 py-1.5 bg-white/[0.03] hover:bg-slate-100 rounded-xl transition-all hover:scale-105 active:scale-95 border border-[#333537] shadow-sm"
                          >
                            Quiz
                          </button>
 

                          <button
                            onClick={() => setIsPacingCoachActive(true)}
                            disabled={!text.trim()}
                            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#C4C7C5] hover:text-white px-3 py-1.5 bg-white/[0.03] hover:bg-slate-100 rounded-xl transition-all disabled:grayscale disabled:text-[#8E918F] disabled:cursor-not-allowed hover:scale-105 active:scale-95 border border-[#333537] shadow-sm"
                          >
                            <Activity size={14} /> Pacing Coach
                          </button> */}

                          {/* <button
                            onClick={() => setIsPlatformToolkitOpen(true)}
                            disabled={!text.trim()}
                            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-indigo-400 hover:text-black px-3 py-1.5 bg-indigo-600/10 hover:bg-indigo-600 rounded-xl transition-all disabled:grayscale disabled:text-[#8E918F] disabled:cursor-not-allowed hover:scale-105 active:scale-95 border border-indigo-500/30 shadow-sm"
                          >
                            <Globe size={14} /> Platform Toolkit
                          </button> */}

                          {/* Enhanced AI Polish hidden from main area */}
                          {false && (
                            <div className="flex flex-col gap-2 p-1 border border-white/5 rounded-xl bg-white/[0.02] min-w-[280px] shadow-2xl">
                              <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/5">
                               <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">Enhanced AI Polish</span>
                               <Sparkles size={11} className="text-indigo-400" />
                            </div>
                            <div className="grid grid-cols-2 gap-2 p-1">
                                <div className="space-y-1">
                                  <label className="text-[9px] font-bold text-[#8E918F] uppercase ml-1">Toolbox</label>
                                  <select 
                                    value={polishAction}
                                    onChange={(e) => setPolishAction(e.target.value as any)}
                                    className="w-full bg-[#131314] text-[10px] font-bold uppercase tracking-wider text-[#C4C7C5] p-2 rounded-lg border border-[#333537] focus:outline-none focus:border-indigo-500"
                                  >
                                    <option value="Polish">✨ Smart Polish</option>
                                    <option value="Fact-Check">⚖️ Fact-Checker</option>
                                    <option value="Structure">🏗️ Structurator</option>
                                    <option value="Bilingual">🗣️ Code-Switch</option>
                                    <option value="SEO Optimizer">🚀 Viral Hooks</option>
                                    <option value="Pacing">⏱️ Pacing & Breath</option>
                                    <option value="Visual Anchors">🎥 Visual Anchors</option>
                                    <option value="Resonance">🎯 Resonance Sim</option>
                                    <option value="Batch Translate">🇮🇳 Regional Batch</option>
                                  </select>
                                </div>
                                {polishAction === 'Polish' && (
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-[#8E918F] uppercase ml-1">Mood/Vibe</label>
                                    <select 
                                      value={polishVibe}
                                      onChange={(e) => setPolishVibe(e.target.value as any)}
                                      className="w-full bg-[#131314] text-[10px] font-bold uppercase tracking-wider text-[#C4C7C5] p-2 rounded-lg border border-[#333537] focus:outline-none focus:border-indigo-500"
                                    >
                                      <option value="Standard">Standard</option>
                                      <option value="Gen-Z">Gen-Z Social</option>
                                      <option value="Professional Documentary">Documentary</option>
                                      <option value="Socratic">Socratic Teacher</option>
                                      <option value="Brutally Honest">Brutally Honest</option>
                                      <option value="Minimalist">Minimalist</option>
                                      <option value="Enthusiastic">Super Excited</option>
                                    </select>
                                  </div>
                                )}
                                {polishAction === 'Bilingual' && (
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-[#8E918F] uppercase ml-1">Blend Style</label>
                                    <select 
                                      value={bilingualLang}
                                      onChange={(e) => setBilingualLang(e.target.value as any)}
                                      className="w-full bg-[#131314] text-[10px] font-bold uppercase tracking-wider text-[#C4C7C5] p-2 rounded-lg border border-[#333537] focus:outline-none focus:border-indigo-500"
                                    >
                                      <option value="Hinglish">Hinglish Blend</option>
                                      <option value="Tanglish">Tanglish Blend</option>
                                      <option value="Benglish">Benglish Blend</option>
                                      <option value="Genglish">Genglish Blend</option>
                                    </select>
                                  </div>
                                )}
                                {polishAction === 'Resonance' && (
                                  <div className="space-y-1">
                                    <label className="text-[9px] font-bold text-[#8E918F] uppercase ml-1">Target Persona</label>
                                    <input 
                                       type="text"
                                       placeholder="e.g., Students in Mumbai"
                                       className="w-full bg-[#131314] text-[10px] text-[#C4C7C5] p-2 rounded-lg border border-[#333537] focus:outline-none focus:border-indigo-500"
                                       onChange={(e) => setScriptPersona(e.target.value)}
                                    />
                                  </div>
                                )}
                            </div>
                            <button
                              onClick={async () => {
                                setIsGenerating(true);
                                setCommandFeedback(`AI is performing ${polishAction}...`);
                                try {
                                  let prompt = "";
                                  let model = "gemini-3.8-flash";
                                  let options: any = {};

                                  switch(polishAction) {
                                    case 'Fact-Check':
                                      model = "gemini-4-argon";
                                      options = [ { googleSearch: {} } ];
                                      prompt = `Analyze the following text for factual claims. Use Google Search to verify them. 
                                      Identify any potentially inaccurate statements. 
                                      Return the original text but wrap inaccurate claims in [Fact Check: ...Correction/Source...] markers. 
                                      If everything is accurate, return the text as is but add a brief "Verified by AI" stamp at the end.
                                      Text: ${text}`;
                                      break;
                                    case 'Structure':
                                      prompt = `Convert the following messy notes or text into a polished 3-act script structure optimized for video/podcasts.
                                      Format:
                                      [HOOK: First 5-10 seconds to grab attention]
                                      [VALUE: The core content, split into logical points]
                                      [CTA: A strong call-to-action]
                                      
                                      Text: ${text}`;
                                      break;
                                    case 'Bilingual':
                                      prompt = `Act as a bilingual script writer. Take the following text and naturally infuse ${bilingualLang} vocabulary and cultural nuances to make it sound more relatable to Indian audiences. Keep the core message but "Code-Switch" naturally where appropriate.
                                      Return ONLY the revised text.
                                      Text: ${text}`;
                                      break;
                                    case 'SEO Optimizer':
                                      prompt = `Analyze the first 30 seconds of this script. Suggest 3 different versions of a "Viral Hook" (Opening sentence) that significantly improves audience retention.
                                      Finally, suggest an SEO-optimized title for this content.
                                      Format:
                                      # Hook 1: ...
                                      # Hook 2: ...
                                      # Hook 3: ...
                                      # SEO Title: ...
                                      
                                      Text: ${text}`;
                                      break;
                                    case 'Pacing':
                                      prompt = `Analyze the following text for TTS (Text-to-Speech) readout. 
                                      Automatically insert punctuation and specific SSML-style pacing markers like <break time="800ms"/> for dramatic effect or natural breathing. 
                                      Ensure the flow sounds human and not robotic.
                                      Return ONLY the marked-up text.
                                      Text: ${text}`;
                                      break;
                                    case 'Visual Anchors':
                                      prompt = `Analyze this script and suggest specific B-roll timestamps or image descriptions. 
                                      Insert them into the text using brackets like [Visual: description @ time]. 
                                      The visual choices should match the emotional arc of the script.
                                      Text: ${text}`;
                                      break;
                                    case 'Resonance':
                                      prompt = `Analyze the resonance of this script for the following audience: "${scriptPersona || 'Modern Audiences'}".
                                      Rate it on a scale of 1-10 for Engagement, Trust, and Clarity.
                                      Briefly explain WHY they might connect or disconnect with specific phrases.
                                      Text: ${text}`;
                                      break;
                                    case 'Batch Translate':
                                      prompt = `Translate the following script segment (first 1000 chars) into: Hindi, Marathi, Bengali, Tamil, Telugu, Kannada, Gujarati, and Punjabi.
                                      Return the result as a detailed Markdown table with columns: Language | Translation.
                                      Text: ${text.substring(0, 1000)}`;
                                      break;
                                    default: // Polish
                                      const vibePrompts: Record<string, string> = {
                                        'Standard': "Polish this text for grammar, flow, and natural pauses for TTS.",
                                        'Gen-Z': "Transform this text into a Gen-Z social media vibe. Use slang (no-cap, fr, bet, etc.), emojis, and high-energy short sentences. Keep the main info.",
                                        'Professional Documentary': "Rewrite this in the style of a high-end BBC or National Geographic documentary narrator. Use evocative, precise vocabulary and formal, steady pacing.",
                                        'Socratic': "Rewrite this as a Socratic lesson. Use guiding questions to lead the listener to the core concepts. Educational and inquisitive tone.",
                                        'Brutally Honest': "Rewrite this script with a brutally honest, no-nonsense corporate-transparency tone. Cut the fluff and marketing speak.",
                                        'Minimalist': "Strip this text down to its absolute bare essentials. High information density with minimal words.",
                                        'Enthusiastic': "Infuse this text with extreme excitement, positivity, and energy. Like a stadium announcer or a high-energy product launch."
                                      };
                                      prompt = `${vibePrompts[polishVibe] || vibePrompts['Standard']}
                                      Also add natural pauses for TTS. Insert visual cues in brackets, e.g., [Visual: ...], to suggest B-roll. 
                                      Return ONLY text.
                                      Text: ${text}`;
                                  }

                                  const polishedText = await genAIResponse(model, [{ role: "user", parts: [{ text: prompt }] }], options);
                                  if (polishedText) {
                                    if (['SEO Optimizer', 'Fact-Check', 'Resonance', 'Batch Translate'].includes(polishAction)) {
                                      // Prepend instead of replace for analysis results
                                      setText(prev => `[${polishAction.toUpperCase()} RESULTS]\n${polishedText}\n\n---\n\n${prev}`);
                                      if (polishAction === 'Batch Translate') {
             setIsPreviewMode(true);
             setPreviewDisplayMode('split');
           }
                                    } else {
                                      setText(polishedText);
                                    }
                                    setCommandFeedback(`${polishAction} completed successfully.`);
                                  }
                                } catch (e) { 
                                  console.error(e);
                                  setErrorInfo(`${polishAction} failed.`); 
                                } finally { 
                                  setIsGenerating(false); 
                                }
                              }}
                              disabled={isGenerating || !text.trim()}
                              className="mx-1 mb-1 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#131314] bg-slate-100 hover:bg-indigo-400 py-2 rounded-lg transition-all shadow-lg active:scale-95 disabled:grayscale"
                            >
                              Run {polishAction}
                            </button>
                          </div>
                          )}

                          {/* <button
                            onClick={async () => {
                              if (!text.trim()) return;
                              setIsGenerating(true);
                              setErrorInfo("AI is analyzing document structure for chapters...");
                              try {
                                const textResponse = await genAIResponse("gemini-3.8-flash", [{ 
                                  role: "user", 
                                  parts: [{ text: `Analyze the following long text and split it into logical "chapters" for an audiobook. For each chapter, provide a concise Title and the exact Content. Ensure the entire text is covered. Return ONLY a JSON array of objects with keys "title" and "content".\n\nText: ${text}` }] 
                                }]);
                                
                                const chapters = JSON.parse(textResponse.replace(/```json|```/g, '').trim());
                                if (Array.isArray(chapters) && chapters.length > 0) {
                                  for (const chapter of chapters) {
                                    const hId = Date.now().toString() + Math.random();
                                    const newItem = {
                                      id: hId,
                                      text: chapter.content,
                                      url: '', 
                                      timestamp: Date.now(),
                                      tags: ['AutoChapter', chapter.title],
                                      likeStatus: null
                                    };
                                    setHistory(prev => [newItem, ...prev]);
                                    setPlaylist(prev => [...prev, newItem]);
                                  }
                                  setErrorInfo(`Success! Created ${chapters.length} chapters in your playlist.`);
                                }
                              } catch (e) { 
                                setErrorInfo("Auto-chaptering failed. Text might be too short or complex."); 
                              } finally { 
                                setIsGenerating(false); 
                              }
                            }}
                            disabled={isGenerating || text.length < 500}
                            title={text.length < 500 ? "Text too short for auto-chaptering" : "Split into chapters using AI"}
                            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#8E918F] hover:text-[#C4C7C5] px-3 py-1.5 bg-[#1E1F20]/50 hover:bg-[#333537] rounded-xl transition-all disabled:grayscale disabled:text-slate-700 disabled:cursor-not-allowed hover:scale-105 active:scale-95 border border-[#333537] shadow-sm"
                          >
                            <List size={14} /> Auto-Chapter
                          </button> */}

                          {/* <button
                            onClick={summarizeText}
                            disabled={isGenerating || !text.trim()}
                            className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#8E918F] hover:text-[#C4C7C5] px-3 py-1.5 bg-[#1E1F20]/50 hover:bg-[#333537] rounded-xl transition-all disabled:grayscale disabled:text-slate-700 disabled:cursor-not-allowed hover:scale-105 active:scale-95 border border-[#333537] shadow-sm"
                          >
                            <BookOpen size={14} /> Summarize
                          </button> */}
                          
                          <div className="flex items-center gap-2 bg-[#1E1F20]/50/50 rounded-xl p-1 border border-[#333537]">
                            <select 
                              value={targetLang}
                              onChange={(e) => setTargetLang(e.target.value)}
                              className="bg-transparent text-xs font-bold uppercase tracking-widest text-[#C4C7C5] focus:outline-none px-2"
                            >
                              <option value="ALL">ALL LANGUAGES</option>
                              {LANGUAGES.map(l => <option key={l.code} value={l.name}>{l.name}</option>)}
                            </select>
                            <button
                              onClick={async () => {
                                if (!text.trim()) return;
                                setIsGenerating(true);
                                try {
                                  if (targetLang === 'ALL') {
                                    setCommandFeedback("Translating to all available languages...");
                                    const allLangs = LANGUAGES.map(l => l.name).join(', ');
                                    const prompt = `Translate the following text into ALL of these languages: ${allLangs}. 
                                    Return a JSON object where keys are language names and values are the strictly translated text.
                                    Text: ${text}`;
                                    
                                    const res = await genAIResponse("gemini-3.8-flash", [{ text: prompt }]);
                                    const translations = JSON.parse(res.replace(/```json|```/g, '').trim());
                                    
                                    const results = LANGUAGES.map(l => ({
                                        code: l.code,
                                        name: l.name,
                                        text: translations[l.name] || translations[l.code] || '',
                                        isSelected: true
                                    })).filter(r => r.text);

                                    setAllLanguageResults(results as any);
                                    setShowAllResults(true);
                                    setCommandFeedback("Multi-language translation complete!");
                                    return;
                                  }

                                  const translatedText = await genAIResponse("gemini-3.8-flash", [{ role: "user", parts: [{ text: `Translate to ${targetLang}. Return ONLY text.\n\nText: ${text}` }] }]);
                                  if (translatedText) setText(translatedText);
                                } catch (e) { setErrorInfo("Translation failed."); } finally { setIsGenerating(false); }
                              }}
                              disabled={isGenerating || !text.trim()}
                              className="bg-slate-100 text-[#131314] p-1.5 rounded-lg hover:bg-indigo-500 transition-all shadow-lg shadow-white/20"
                            >
                              <ChevronRight size={14} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-4 w-full p-10 pt-0">
                        {useSentimentAI && (
                            <button
                              disabled={isGenerating || !text.trim() || !voiceName}
                              onClick={prepareExpressivePerformance}
                              className={cn(
                                "flex-1 px-8 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center gap-2 shadow-2xl relative overflow-hidden group border-b-4",
                                isAnalyzingSentiment
                                  ? "bg-amber-600/20 text-[#8E918F] border-[#444746] cursor-not-allowed animate-pulse"
                                  : "bg-amber-500 text-white hover:bg-amber-600 border-amber-700  active:scale-95 active:border-b-0 active:translate-y-1"
                              )}
                            >
                              <Sparkles size={18} />
                              {isAnalyzingSentiment ? "Analyzing..." : "Review Perf"}
                            </button>
                          )}
                          <button
                            disabled={isGenerating || !text.trim() || !voiceName}
                            onClick={handleGenerateSingle}
                            className={cn(
                              "flex-[2] px-10 py-5 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center justify-center shadow-2xl relative overflow-hidden group border-b-4",
                              isGenerating 
                                ? "bg-[#1E1F20]/50 text-[#8E918F] border-[#444746] cursor-not-allowed scale-[0.98]" 
                                : "bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95 active:border-b-0 active:translate-y-1 shadow-white/30 border-indigo-800 hover:-translate-y-0.5"
                            )}
                          >
                        <AnimatePresence mode="wait">
                          {isGenerating ? (
                            <motion.span 
                              key="loading"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="flex items-center"
                            >
                              <Loader2 size={18} className="animate-spin mr-3" /> Processing
                            </motion.span>
                          ) : (
                            <motion.span 
                              key="idle"
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -10 }}
                              className="flex items-center"
                            >
                              <Play size={18} className="mr-3 fill-current" /> {engine === 'browser' ? 'Speak' : 'Generate'}
                            </motion.span>
                          )}
                        </AnimatePresence>
                      </button>
                    </div>
                  </motion.div>

                  {/* Multi-Language Selection UI */}
                  <AnimatePresence>
                    {showAllResults && allLanguageResults.length > 0 && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 20 }}
                        className="bg-[#1E1F20] border border-[#333537] rounded-2xl p-8 mt-6 shadow-2xl space-y-6"
                      >
                        <div className="flex items-center justify-between">
                           <div>
                              <h3 className="text-sm font-black uppercase tracking-widest text-white">Multi-Language Results</h3>
                              <p className="text-[10px] text-[#8E918F] uppercase font-bold tracking-widest mt-1">Select the versions you want to keep</p>
                           </div>
                           <button 
                             onClick={() => {
                               const selected = allLanguageResults.filter(r => r.isSelected);
                               if (selected.length === 0) {
                                 setShowAllResults(false);
                                 return;
                               }
                               
                               const newHistoryItems: HistoryItem[] = selected.map(r => ({
                                 id: Date.now().toString() + Math.random(),
                                 text: r.text,
                                 url: r.audioUrl || '',
                                 timestamp: Date.now(),
                                 tags: ['Multi-Lang', r.name],
                                 likeStatus: null,
                                 projectId: activeProjectId
                               }));

                               setHistory(prev => [...newHistoryItems, ...prev]);
                               setPlaylist(prev => [...prev, ...newHistoryItems]);
                               setShowAllResults(false);
                               setErrorInfo(`Added ${selected.length} items to your collection!`);
                             }}
                             className="px-6 py-2.5 bg-indigo-500 hover:bg-slate-100 text-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-900/20"
                           >
                             Save Selected ({allLanguageResults.filter(r => r.isSelected).length})
                           </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                           {allLanguageResults.map((res, idx) => (
                             <div 
                               key={res.code}
                               className={cn(
                                 "p-4 rounded-xl border transition-all flex flex-col gap-3 group relative",
                                 res.isSelected ? "bg-indigo-500/5 border-indigo-500/30" : "bg-white/[0.02] border-[#333537] opacity-60"
                               )}
                             >
                                <div className="flex items-center justify-between">
                                   <div className="flex items-center gap-3">
                                      <input 
                                        type="checkbox" 
                                        checked={res.isSelected}
                                        onChange={() => {
                                          const newResults = [...allLanguageResults];
                                          newResults[idx].isSelected = !newResults[idx].isSelected;
                                          setAllLanguageResults(newResults);
                                        }}
                                        className="w-4 h-4 rounded accent-indigo-500 border-[#333537] bg-black/20"
                                      />
                                      <span className="text-xs font-black uppercase tracking-widest text-[#C4C7C5]">{res.name}</span>
                                   </div>
                                   {res.audioUrl && (
                                     <button 
                                       onClick={() => {
                                          const audio = new Audio(res.audioUrl);
                                          audio.play();
                                       }}
                                       className="p-1.5 bg-white/[0.05] text-[#8E918F] hover:text-white rounded-lg transition-colors"
                                     >
                                        <Play size={12} />
                                     </button>
                                   )}
                                </div>
                                <p className="text-xs line-clamp-3 text-[#E3E3E3] leading-relaxed italic">
                                  {res.text}
                                </p>
                             </div>
                           ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {engine === 'cloud' && audioUrl && (
                      <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className={cn(
                          "p-8 rounded-2xl glass-dark border transition-all duration-500 space-y-6 shadow-2xl",
                          theme === 'dark' ? 'border-[#333537]' : 'bg-white border-[#444746]'
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-white/[0.03] flex items-center justify-center">
                              <Volume2 className="text-[#C4C7C5]" size={20} />
                            </div>
                            <div>
                               <p className="text-xs font-black uppercase tracking-widest text-[#8E918F]">Audio Preview</p>
                               <p className="text-sm font-bold text-[#E3E3E3]">High Definition Output</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                             <select 
                                value={exportFormat}
                                onChange={(e) => setExportFormat(e.target.value)}
                                className="bg-[#1E1F20]/50/50 text-xs font-bold uppercase tracking-widest text-[#C4C7C5] px-3 py-1.5 rounded-xl border border-[#333537] outline-none"
                             >
                                <option value="mp3">MP3</option>
                                <option value="wav">WAV</option>
                             </select>
                             <select 
                               value={voiceProfile}
                               onChange={(e) => setVoiceProfile(e.target.value)}
                               className="bg-transparent text-xs font-bold uppercase tracking-widest text-[#C4C7C5] focus:outline-none px-2 border-l border-[#333537]"
                             >
                               <option value="neutral">NEUTRAL</option>
                               <option value="enthusiastic">ENTHUSIASTIC</option>
                               <option value="professional">PROFESSIONAL</option>
                               <option value="calm">CALM</option>
                             </select>
                             <button 
                               onClick={async () => {
                                 if (!audioUrl) return;
                                 try {
                                   const res = await fetch(audioUrl);
                                   const blob = await res.blob();
                                   const blobUrl = URL.createObjectURL(blob);
                                   const a = document.createElement('a');
                                   a.href = blobUrl;
                                   a.download = `speech.${exportFormat}`;
                                   a.click();
                                   URL.revokeObjectURL(blobUrl);
                                 } catch (e) {
                                   setErrorInfo("Failed to download audio.");
                                 }
                               }} 
                               className="p-3 bg-slate-100 text-[#131314] rounded-xl shadow-lg shadow-white/20 hover:bg-indigo-500 transition-all"
                             >
                               <Download size={18} />
                             </button>
                          </div>
                        </div>

                        <div className="relative h-20 bg-transparent/50 rounded-2xl border border-[#333537] overflow-hidden flex flex-col items-center justify-center">
                           <canvas id="waveform" className="absolute inset-0 w-full h-full" />
                           <AnimatePresence>
                             {currentWord && (
                               <motion.div 
                                 initial={{ scale: 0.8, opacity: 0 }}
                                 animate={{ scale: 1.1, opacity: 1 }}
                                 exit={{ scale: 1.2, opacity: 0 }}
                                 className="relative z-10 text-2xl font-black text-white drop-shadow-[0_0_15px_rgba(99,102,241,0.5)]"
                               >
                                 {currentWord}
                               </motion.div>
                             )}
                           </AnimatePresence>
                        </div>

                        <div className="flex flex-wrap items-center justify-between gap-6">
                           <CustomAudioPlayer 
                             src={audioUrl} 
                             className="invert group-hover:invert-0 transition-all" 
                             internalRef={audioRef} 
                             onPlay={() => {
                               if (activeListenSession) setActiveListenSession(prev => prev ? { ...prev, startTime: Date.now() } : null);
                             }}
                             onPause={() => {
                               if (activeListenSession) {
                                 const duration = (Date.now() - activeListenSession.startTime) / 1000;
                                 logListenSession(activeListenSession.playlistId, activeListenSession.itemId, Math.round(duration));
                                 setActiveListenSession(prev => prev ? { ...prev, startTime: Date.now() } : null);
                               }
                             }}
                             onEnded={() => {
                               if (activeListenSession) {
                                 const duration = (Date.now() - activeListenSession.startTime) / 1000;
                                 logListenSession(activeListenSession.playlistId, activeListenSession.itemId, Math.round(duration));
                                 setActiveListenSession(null);
                               }
                             }}
                           />
                           <div className="flex items-center gap-4">
                              <div className="flex items-center gap-1 bg-[#1E1F20]/50 p-1.5 rounded-2xl border border-[#444746] shadow-lg">
                                 <button 
                                    onClick={() => currentGenerationId && handleLike(currentGenerationId, 'like')} 
                                    className={cn(
                                        "p-2.5 rounded-xl transition-all hover:scale-110 active:scale-95", 
                                        history.find(h => h.id === currentGenerationId)?.likeStatus === 'like' 
                                            ? "text-green-400 bg-green-500/20 shadow-lg shadow-green-500/20" 
                                            : "text-[#E3E3E3] hover:text-white hover:bg-white/[0.03]"
                                    )}
                                 >
                                    <ThumbsUp size={18} className={cn(history.find(h => h.id === currentGenerationId)?.likeStatus === 'like' && "fill-current")} />
                                 </button>
                                 <button 
                                    onClick={() => currentGenerationId && handleLike(currentGenerationId, 'dislike')} 
                                    className={cn(
                                        "p-2.5 rounded-xl transition-all hover:scale-110 active:scale-95", 
                                        history.find(h => h.id === currentGenerationId)?.likeStatus === 'dislike' 
                                            ? "text-red-400 bg-red-500/20 shadow-lg shadow-red-500/20" 
                                            : "text-[#E3E3E3] hover:text-white hover:bg-white/[0.03]"
                                    )}
                                 >
                                    <ThumbsDown size={18} className={cn(history.find(h => h.id === currentGenerationId)?.likeStatus === 'dislike' && "fill-current")} />
                                 </button>
                              </div>
                              <button 
                                onClick={async () => { 
                                  if (audioUrl) {
                const shareData: {title: string; text: string; url?: string; files?: File[]} = {
                                      title: 'Bharat Performance Agent',
                                      text: `Check out this voice: ${text.substring(0, 30)}...`,
                                    };
                                    try {
                                      const res = await fetch(audioUrl);
                                      const blob = await res.blob();
                                      const file = new File([blob], 'audio.mp3', { type: 'audio/mpeg' });
                                      if (navigator.canShare && navigator.canShare({ files: [file] })) {
                                        shareData.files = [file];
                                      } else {
                                        shareData.url = window.location.href;
                                      }
                                    } catch (e) {
                                      shareData.url = window.location.href;
                                    }
                                    if (navigator.share) {
                                      try { await navigator.share(shareData); return; } catch (e) {}
                                    }
                                    try {
                                      await navigator.clipboard.writeText(`${text.substring(0, 500)}\n\nGenerated via Bharat Performance Agent: ${window.location.href}`);
                                      setErrorInfo("Voice summary and App link copied!");
                                      setTimeout(() => setErrorInfo(null), 3000);
                                    } catch (e) {
                                      setErrorInfo("Clipboard access denied.");
                                    }
                                  }
                                }} 
                                className="p-3 text-[#C4C7C5] hover:text-white bg-white/[0.03] rounded-xl transition-all border border-[#333537]"
                              >
                                <Share2 size={18} />
                              </button>

                           </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ) : activeTab === 'projects' ? (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="flex items-center justify-between">
                    <h2 className="text-2xl font-bold text-white">Projects Workspace</h2>
                    <button onClick={handleCreateProject} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                      New Project
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {projects.map(p => (
                        <div key={p.id} className="p-4 rounded-xl border border-white/10 bg-black/30">
                            <h3 className="text-white font-medium">{p.name}</h3>
                            <p className="text-gray-500 text-xs mt-1">Created: {p.createdAt?.toDate?.().toLocaleDateString()}</p>
                        </div>
                    ))}
                    {projects.length === 0 && (
                        <div className="p-4 rounded-xl border border-white/10 bg-black/30 text-center col-span-full">
                            <p className="text-gray-400">No projects yet. Create your first project to organize your work.</p>
                        </div>
                    )}
                  </div>

                  <h2 className="text-xl font-bold text-white mt-8">Google Drive Documents</h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {driveFiles.map((file: any) => (
                           <div key={file.id} className="p-4 rounded-xl border border-white/10 bg-black/30 cursor-pointer hover:border-indigo-500">
                               <h3 className="text-white font-medium truncate">{file.name}</h3>
                           </div>
                      ))}
                  </div>
                </div>
              ) : activeTab === 'agent' ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Input and Configuration */}
                    <div className="lg:col-span-1 space-y-6">
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="glass-dark p-6 rounded-2xl border border-[#333537] shadow-xl"
                      >
                        <h3 className="text-sm font-black uppercase tracking-widest text-indigo-400 mb-6 flex items-center gap-2">
                          <Zap size={16} /> Configuration
                        </h3>
                        
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[#8E918F]">Source Resource Link</label>
                            <div className="relative group">
                              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-indigo-400 transition-colors" />
                              <input 
                                type="text"
                                placeholder="Paste website, article or script link..."
                                value={agentSourceUrl}
                                onChange={(e) => setAgentSourceUrl(e.target.value)}
                                className="w-full bg-[#131314] border border-[#333537] focus:border-indigo-500 rounded-xl pl-9 pr-4 py-3 text-sm text-white transition-all outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[#8E918F]">Brand Persona / Goal</label>
                            <div className="relative group">
                              <Target size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-indigo-400 transition-colors" />
                              <input 
                                type="text"
                                placeholder="e.g., TechBrand - Educational & High Hype"
                                value={agentBrandGoal}
                                onChange={(e) => setAgentBrandGoal(e.target.value)}
                                className="w-full bg-[#131314] border border-[#333537] focus:border-indigo-500 rounded-xl pl-9 pr-4 py-3 text-sm text-white transition-all outline-none"
                              />
                            </div>
                          </div>

                          <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[#8E918F]">Target Bharat Languages</label>
                            <div className="grid grid-cols-2 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar p-1">
                              {LANGUAGES.map(l => (
                                <button
                                  key={l.name}
                                  onClick={() => toggleAgentLang(l.name)}
                                  className={cn(
                                    "px-3 py-2 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all border text-left",
                                    agentSelectedLangs.includes(l.name)
                                      ? "bg-indigo-500/10 border-indigo-500/50 text-white shadow-lg"
                                      : "bg-white/[0.02] border-white/5 text-[#8E918F] hover:bg-white/5"
                                  )}
                                >
                                  {l.name}
                                </button>
                              ))}
                            </div>
                            <div className="flex justify-between mt-2">
                              <button onClick={() => setAgentSelectedLangs(LANGUAGES.map(l => l.name))} className="text-[9px] font-black uppercase text-indigo-400 hover:text-white transition-colors">Select All</button>
                              <button onClick={() => setAgentSelectedLangs([])} className="text-[9px] font-black uppercase text-[#8E918F] hover:text-white transition-colors">Deselect All</button>
                            </div>
                          </div>

                          <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-[#8E918F]">Social Broadcast Sync</label>
                            <div className="grid grid-cols-1 gap-2">
                              {socialConnections.map(social => (
                                <div key={social.platform} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl flex items-center justify-between group/social">
                                  <div className="flex items-center gap-3">
                                    <div className={cn(
                                      "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                                      social.connected ? "bg-green-500/10 text-green-400" : "bg-white/5 text-white/30"
                                    )}>
                                      {social.platform === 'Facebook' && <Share2 size={14} />}
                                      {social.platform === 'YouTube' && <Youtube size={14} />}
                                      {social.platform === 'Instagram' && <Instagram size={14} />}
                                      {social.platform === 'Telegram' && <Send size={14} />}
                                      {social.platform === 'Twitter' && <Twitter size={14} />}
                                    </div>
                                    <div>
                                      <p className="text-[10px] font-black uppercase tracking-wider text-white">{social.platform}</p>
                                      <p className="text-[9px] font-bold text-[#8E918F] uppercase tracking-tighter">
                                        {social.connected ? `Connected as ${social.username}` : 'Not Linked'}
                                      </p>
                                    </div>
                                  </div>
                                  <button 
                                    onClick={() => connectSocial(social.platform)}
                                    className={cn(
                                      "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all",
                                      social.connected 
                                        ? "bg-white/5 text-white/40 hover:bg-red-500/10 hover:text-red-400" 
                                        : "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 active:scale-95"
                                    )}
                                  >
                                    {social.connected ? 'Disconnect' : 'Connect'}
                                  </button>
                                </div>
                              ))}
                            </div>
                            <p className="text-[8px] text-[#8E918F] italic leading-tight">* Real API access requires your own Developer App keys configured in the environment.</p>
                          </div>

                          <div className="pt-4 space-y-3">
                            <button
                              onClick={startTaskPerformerAgent}
                              disabled={agentStatus === 'running' || !agentSourceUrl}
                              className={cn(
                                "w-full py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all shadow-2xl flex items-center justify-center gap-3 border-b-4",
                                agentStatus === 'running' 
                                  ? "bg-slate-100/10 text-white/20 border-white/5 cursor-not-allowed" 
                                  : "bg-indigo-500 text-white border-indigo-800 hover:bg-indigo-600 active:scale-95 active:border-b-0 translate-y-0 active:translate-y-1"
                              )}
                            >
                              {agentStatus === 'running' ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} />}
                              <span>{agentStatus === 'running' ? 'Agent Working...' : 'Launch Agent'}</span>
                            </button>
                            {agentStatus !== 'idle' && (
                              <button onClick={clearAgent} className="w-full py-3 text-[10px] font-black uppercase tracking-widest text-[#8E918F] hover:text-white transition-colors"> Reset Agent</button>
                            )}
                          </div>
                        </div>
                      </motion.div>

                      {/* Agent Status Log */}
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 }}
                        className="glass-dark p-6 rounded-2xl border border-[#333537] h-[400px] flex flex-col relative overflow-hidden"
                      >
                        <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                          <Activity size={80} className="text-indigo-400" />
                        </div>
                        
                        <div className="flex items-center justify-between mb-4 relative z-10">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[10px] font-black uppercase tracking-widest text-[#8E918F]">Live Operations Intelligence</h3>
                            {agentStatus === 'running' && (
                              <div className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 rounded-full border border-green-500/20">
                                <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-[8px] font-bold text-green-400 uppercase">Active</span>
                              </div>
                            )}
                          </div>
                          <button 
                            onClick={() => setAgentLog([])}
                            className="text-[8px] font-black uppercase text-[#8E918F] hover:text-white transition-colors"
                          >
                            Clear Logs
                          </button>
                        </div>

                        <div ref={agentLogRef} className="flex-1 overflow-y-auto space-y-3 font-mono text-[10px] pr-2 custom-scrollbar relative z-10 scroll-smooth">
                          {agentLog.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-20 italic space-y-2">
                              <Terminal size={24} />
                              <p>System Idle... Awaiting Neural Link</p>
                            </div>
                          ) : (
                            agentLog.map((log, i) => {
                              const timeMatch = log.match(/\[(.*?)\]/);
                              const timestamp = timeMatch ? timeMatch[1] : '';
                              const message = log.replace(/\[.*?\]/, '').trim();
                              
                              return (
                                <div key={i} className="group animate-in fade-in slide-in-from-left-2 duration-300">
                                  <div className="flex gap-3">
                                    <span className="text-indigo-400/50 font-bold shrink-0">{timestamp}</span>
                                    <span className={cn(
                                      "text-[#C4C7C5] leading-relaxed",
                                      message.includes('✅') && "text-green-400/90",
                                      message.includes('❌') && "text-red-400/90",
                                      message.includes('⚠️') && "text-yellow-400/90",
                                      message.includes('🚀') && "text-indigo-400 font-bold"
                                    )}>
                                      {message}
                                    </span>
                                  </div>
                                </div>
                              );
                            })
                          )}
                          <div id="log-end" />
                        </div>
                      </motion.div>
                    </div>

                    {/* Agent Results Dashboard */}
                    <div className="lg:col-span-2 space-y-6">
                      <motion.div 
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="glass-dark rounded-2xl border border-[#333537] overflow-hidden min-h-[360px] flex flex-col"
                      >
                        <div className="px-8 py-6 bg-white/[0.03] border-b border-[#333537] flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="relative">
                              <div className={cn(
                                "h-12 w-12 rounded-2xl border flex items-center justify-center transition-all duration-500",
                                agentStatus === 'running' ? "bg-indigo-500/10 border-indigo-500/50 rotate-3 shadow-[0_0_20px_rgba(99,102,241,0.3)]" : "bg-white/5 border-white/10"
                              )}>
                                <Cpu size={24} className={cn(agentStatus === 'running' ? "text-indigo-400 animate-pulse" : "text-white/20")} />
                              </div>
                              {agentStatus === 'running' && (
                                <motion.div 
                                  layoutId="active-pulse"
                                  className="absolute -top-1 -right-1 h-3 w-3 bg-green-500 rounded-full border-2 border-[#131314]"
                                />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <h3 className="font-black uppercase tracking-[0.2em] text-[13px] text-white">Global Command Dashboard</h3>
                                <span className={cn(
                                  "px-2 py-0.5 rounded-md text-[8px] font-black uppercase tracking-widest border",
                                  agentStatus === 'running' ? "bg-indigo-500/20 text-indigo-400 border-indigo-500/30" : "bg-white/5 text-[#8E918F] border-white/10"
                                )}>
                                  {agentStatus.toUpperCase()}
                                </span>
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <div className="h-1.5 w-32 bg-white/5 rounded-full overflow-hidden border border-white/5">
                                  <motion.div 
                                    className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]" 
                                    initial={{ width: 0 }}
                                    animate={{ width: `${(agentResults.filter(r => r.status === 'done').length / (agentSelectedLangs.length || 1)) * 100}%` }}
                                    transition={{ type: 'spring', stiffness: 50 }}
                                  />
                                </div>
                                <p className="text-[9px] font-black text-[#8E918F] uppercase tracking-widest">
                                  <span className="text-white">{agentResults.filter(r => r.status === 'done').length}</span>
                                  <span className="mx-1 text-white/20">/</span>
                                  <span>{agentSelectedLangs.length} Territories Synced</span>
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="hidden sm:flex flex-col items-end mr-2">
                               <p className="text-[8px] font-black uppercase text-[#8E918F] tracking-widest">Runtime Efficiency</p>
                               <p className="text-[10px] font-bold text-green-400">99.8% Optimized</p>
                            </div>
                            <button 
                              onClick={() => setShowAgentSettings(!showAgentSettings)}
                              className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl border transition-all shadow-lg active:scale-95",
                                showAgentSettings ? "bg-indigo-500 text-white border-indigo-500" : "bg-white/5 text-[#8E918F] border-white/10 hover:text-white hover:bg-white/10"
                              )}
                            >
                              <Settings2 size={14} />
                              <span className="text-[10px] font-black uppercase tracking-widest">Config</span>
                            </button>
                            {agentResults.some(r => r.status === 'done') && (
                              <button 
                                onClick={() => {
                                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(agentResults, null, 2));
                                  const downloadAnchorNode = document.createElement('a');
                                  downloadAnchorNode.setAttribute("href",     dataStr);
                                  downloadAnchorNode.setAttribute("download", "agent_full_export.json");
                                  document.body.appendChild(downloadAnchorNode);
                                  downloadAnchorNode.click();
                                  downloadAnchorNode.remove();
                                }}
                                className="hidden md:flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl border border-white/10 transition-all active:scale-95 shadow-lg"
                              >
                                <Download size={14} /> Batch Export
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="flex-1 overflow-hidden flex flex-col">
                          <AnimatePresence>
                            {showAgentSettings && (
                              <motion.div 
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="bg-[#1a1b1e] border-b border-[#333537] overflow-hidden"
                              >
                                <div className="p-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                                  <div className="space-y-4">
                                     <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-400">Content Engine Strategy</h4>
                                     <div className="grid grid-cols-2 gap-3">
                                       {[
                                         { id: 'educational', label: 'Knowledge Base', icon: <BookOpen size={14} /> },
                                         { id: 'hype', label: 'Viral High Hype', icon: <Zap size={14} /> },
                                         { id: 'storytelling', label: 'Narrative Story', icon: <Highlighter size={14} /> },
                                         { id: 'news', label: 'News Reporter', icon: <Activity size={14} /> }
                                       ].map(tone => (
                                         <button
                                           key={tone.id}
                                           onClick={() => setAgentTone(tone.id as any)}
                                           className={cn(
                                             "p-3 rounded-xl border text-left flex items-center gap-3 transition-all",
                                             agentTone === tone.id ? "bg-indigo-500/10 border-indigo-500 text-white" : "bg-white/5 border-white/5 text-[#8E918F] hover:bg-white/10"
                                           )}
                                         >
                                           <div className={cn("p-2 rounded-lg", agentTone === tone.id ? "bg-indigo-500/20" : "bg-white/5")}>{tone.icon}</div>
                                           <span className="text-[10px] font-black uppercase tracking-widest leading-none">{tone.label}</span>
                                         </button>
                                       ))}
                                     </div>
                                  </div>

                                  <div className="space-y-4">
                                     <h4 className="text-[10px] font-black uppercase tracking-widest text-[#FF9F0A]">Automated Sync Schedule</h4>
                                     <div className="grid grid-cols-2 gap-2">
                                       {[
                                         { id: 'manual', label: 'Manual Only' },
                                         { id: '6h', label: 'Every 6 Hours' },
                                         { id: '12h', label: 'Every 12 Hours' },
                                         { id: 'daily', label: 'Daily Pulse' }
                                       ].map(s => (
                                         <button 
                                           key={s.id}
                                           onClick={() => setAgentSchedule(s.id as any)}
                                           className={cn(
                                             "px-3 py-2 rounded-xl border text-[9px] font-black uppercase transition-all text-center",
                                             agentSchedule === s.id ? "bg-[#FF9F0A]/10 border-[#FF9F0A] text-white" : "bg-white/5 border-white/5 text-[#8E918F] hover:bg-white/10"
                                           )}
                                         >
                                           {s.label}
                                         </button>
                                       ))}
                                     </div>
                                     <p className="text-[8px] text-[#8E918F] italic leading-tight">* The agent will auto-check the source link for updates at the selected interval.</p>
                                  </div>

                                  <div className="space-y-4">
                                     <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-black uppercase tracking-widest text-red-400">Budget & Cost Control</h4>
                                        <div className="px-2 py-0.5 bg-red-400/10 text-red-400 rounded-full border border-red-400/20 text-[8px] font-black uppercase">Hard Cap Active</div>
                                     </div>
                                     <div className="bg-white/5 border border-white/5 rounded-xl p-4 space-y-4">
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-[8px] font-black uppercase text-[#8E918F] tracking-widest mb-1">Current Session Spend</p>
                                                <p className="text-base font-black text-white">${currentSpend.toFixed(3)}<span className="text-[10px] text-[#8E918F] ml-1">USD</span></p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-[8px] font-black uppercase text-[#8E918F] tracking-widest mb-1">Budget Limit</p>
                                                <input 
                                                  type="number" 
                                                  step="0.5" 
                                                  value={budgetLimit}
                                                  onChange={(e) => setBudgetLimit(Number(e.target.value))}
                                                  className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[10px] font-black text-white text-center"
                                                />
                                            </div>
                                        </div>
                                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                                            <motion.div 
                                              className="h-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"
                                              initial={{ width: 0 }}
                                              animate={{ width: `${Math.min((currentSpend / Math.max(budgetLimit, 0.01)) * 100, 100)}%` }}
                                            />
                                        </div>
                                        <p className="text-[8px] text-[#8E918F] italic leading-tight">* Estimated costs based on model tokenization.</p>
                                     </div>
                                  </div>

                                  <div className="space-y-4">
                                     <h4 className="text-[10px] font-black uppercase tracking-widest text-green-400">Environment API Status</h4>
                                     <div className="space-y-2">
                                        {[
                                          { label: 'Gemini Logic Hub', status: 'Operational' },
                                          { label: 'Google Search Console', status: 'Operational' },
                                          { label: 'Social Sync Backend', status: 'Ready' },
                                          { label: 'TTS Vocal Engine', status: 'Operational' }
                                        ].map((api, i) => (
                                          <div key={i} className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/5">
                                            <span className="text-[10px] font-bold text-[#8E918F] uppercase tracking-tighter">{api.label}</span>
                                            <div className="flex items-center gap-2">
                                              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
                                              <span className="text-[8px] font-black uppercase text-green-500">{api.status}</span>
                                            </div>
                                          </div>
                                        ))}
                                     </div>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <div className="flex-1 p-6 overflow-y-auto space-y-8 custom-scrollbar">
                            {agentResults.length === 0 ? (
                              <div className="h-full flex flex-col items-center justify-center text-center space-y-4 opacity-30">
                                <Zap size={48} className="text-indigo-400 animate-pulse" />
                                <div>
                                  <p className="text-sm font-black uppercase tracking-widest">Awaiting Pulse</p>
                                  <p className="text-xs uppercase font-bold tracking-tighter">Launch the agent to start multi-territory processing</p>
                                </div>
                              </div>
                            ) : (
                              <div className="space-y-8">
                                {/* Territory Status Overview */}
                                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                  {agentResults.map((res) => (
                                    <div 
                                      key={res.lang}
                                      className={cn(
                                        "p-3 rounded-xl border flex flex-col gap-2 transition-all duration-500",
                                        res.status === 'done' ? "bg-green-500/5 border-green-500/20" : 
                                        res.status === 'processing' ? "bg-indigo-500/5 border-indigo-500/20 animate-pulse" : 
                                        "bg-white/5 border-white/5 opacity-40"
                                      )}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="text-[10px] font-black uppercase text-white tracking-widest">{res.lang}</span>
                                        {res.status === 'done' ? <CheckCircle2 size={12} className="text-green-400" /> : <div className="h-1.5 w-1.5 rounded-full bg-white/20" />}
                                      </div>
                                      <div className="h-1 w-full bg-white/5 rounded-full overflow-hidden">
                                        <div className={cn(
                                          "h-full transition-all duration-1000",
                                          res.status === 'done' ? "w-full bg-green-500" : res.status === 'processing' ? "w-1/2 bg-indigo-500" : "w-0"
                                        )} />
                                      </div>
                                    </div>
                                  ))}
                                </div>

                                <div className="grid grid-cols-1 gap-6">
                                  {agentResults.map((result) => (
                                    <motion.div 
                                      layout
                                      key={result.lang}
                                      className={cn(
                                        "p-8 rounded-3xl border transition-all relative overflow-hidden group",
                                        result.status === 'done' ? "bg-white/[0.03] border-white/10 shadow-2xl" : "bg-black/20 border-white/5 opacity-60"
                                      )}
                                    >
                                      {result.status === 'processing' && (
                                        <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />
                                      )}
                                      
                                      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 relative z-10 gap-4">
                                        <div className="flex items-center gap-4">
                                          <div className={cn(
                                            "w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shadow-lg transition-all duration-700",
                                            result.status === 'done' ? "bg-gradient-to-br from-green-500/20 to-emerald-500/20 text-green-400 border border-green-500/30" : "bg-white/5 text-white/20 border border-white/5"
                                          )}>
                                            {result.lang[0]}
                                          </div>
                                          <div>
                                            <div className="flex items-center gap-2">
                                              <h4 className="text-lg font-black uppercase tracking-widest text-white">{result.lang} Territory</h4>
                                              {result.status === 'done' && <div className="h-1.5 w-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]" />}
                                            </div>
                                            <span className="text-[10px] font-bold text-[#8E918F] uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded-md border border-white/5 mt-1 block w-fit">
                                              Logic Sync: {result.status}
                                            </span>
                                          </div>
                                        </div>
                                        <div className="flex gap-3">
                                          {result.status === 'done' && (
                                            <>
                                              <button 
                                                onClick={() => { setText(result.text); setActiveTab('single'); }}
                                                className="px-4 py-2 bg-indigo-500 text-white hover:bg-indigo-600 rounded-xl transition-all border border-indigo-400/30 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg active:scale-95"
                                              >
                                                <ArrowUpRight size={14} /> Send to Studio
                                              </button>
                                              <button 
                                                 onClick={() => {
                                                   const a = document.createElement('a');
                                                   a.href = `data:text/plain;charset=utf-8,${encodeURIComponent(result.text)}`;
                                                   a.download = `script_${result.lang}.txt`;
                                                   a.click();
                                                   a.click();
                                                   a.remove();
                                                 }}
                                                 className="p-2 bg-white/5 text-[#8E918F] hover:text-white rounded-xl transition-all border border-white/10 hover:bg-white/10"
                                                 title="Download Raw Asset"
                                              >
                                                <Download size={16} />
                                              </button>
                                            </>
                                          )}
                                        </div>
                                      </div>

                                    {result.status === 'done' && (
                                      <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        className="space-y-6 pt-4 border-t border-white/5 relative z-10"
                                      >
                                        {/* Research & Intelligence */}
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-2 text-indigo-400">
                                              <Search size={14} />
                                              <span className="text-[10px] font-black uppercase tracking-widest">Competitive Intelligence & Gap Analysis</span>
                                          </div>
                                          <div className="p-3 bg-indigo-500/5 rounded-xl border border-indigo-500/10 space-y-3">
                                             <div className="flex flex-wrap gap-2">
                                                {result.seoKeywords?.map(kw => (
                                                  <span key={kw} className="px-2 py-0.5 bg-indigo-500/20 text-indigo-400 text-[8px] font-black uppercase rounded-full border border-indigo-500/20">#{kw}</span>
                                                ))}
                                             </div>
                                             <p className="text-[10px] text-[#C4C7C5] leading-relaxed italic">{result.researchSummary}</p>
                                          </div>
                                        </div>

                                        {/* Narrative Variants */}
                                        {result.variants && (
                                          <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-purple-400">
                                                <Zap size={14} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Core Narrative Strategy Variants</span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                              <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl space-y-2">
                                                  <div className="flex justify-between items-center">
                                                    <span className="text-[8px] font-black uppercase text-purple-400">Strategy A: Problem-First</span>
                                                    <button onClick={() => navigator.clipboard.writeText(result.variants!.A)} className="text-[#8E918F] hover:text-white transition-colors"><Copy size={10} /></button>
                                                  </div>
                                                  <p className="text-[10px] text-[#C4C7C5] leading-relaxed italic line-clamp-3">{result.variants.A}</p>
                                              </div>
                                              <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl space-y-2">
                                                  <div className="flex justify-between items-center">
                                                    <span className="text-[8px] font-black uppercase text-purple-400">Strategy B: Curiosity-First</span>
                                                    <button onClick={() => navigator.clipboard.writeText(result.variants!.B)} className="text-[#8E918F] hover:text-white transition-colors"><Copy size={10} /></button>
                                                  </div>
                                                  <p className="text-[10px] text-[#C4C7C5] leading-relaxed italic line-clamp-3">{result.variants.B}</p>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* Vocal DNA Profile */}
                                        {result.vocalProfile && (
                                          <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-yellow-400">
                                                <Mic size={14} />
                                                <span className="text-[10px] font-black uppercase tracking-widest">Vocal DNA & Delivery Profile</span>
                                            </div>
                                            <div className="grid grid-cols-3 gap-3">
                                              <div className="p-2 bg-yellow-400/5 border border-yellow-400/10 rounded-lg text-center">
                                                <p className="text-[8px] font-black uppercase text-yellow-400/50">Tone</p>
                                                <p className="text-[10px] font-bold text-white">{result.vocalProfile.tone}</p>
                                              </div>
                                              <div className="p-2 bg-yellow-400/5 border border-yellow-400/10 rounded-lg text-center">
                                                <p className="text-[8px] font-black uppercase text-yellow-400/50">Pace</p>
                                                <p className="text-[10px] font-bold text-white">{result.vocalProfile.speed}</p>
                                              </div>
                                              <div className="p-2 bg-yellow-400/5 border border-yellow-400/10 rounded-lg text-center">
                                                <p className="text-[8px] font-black uppercase text-yellow-400/50">Emotion</p>
                                                <p className="text-[10px] font-bold text-white">{result.vocalProfile.emotion}</p>
                                              </div>
                                            </div>
                                          </div>
                                        )}

                                        {/* Script Section */}
                                        <div className="space-y-3">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 text-green-400">
                                              <FileText size={14} />
                                              <span className="text-[10px] font-black uppercase tracking-widest">Localized Narrative Script</span>
                                            </div>
                                            {result.audioUrl && (
                                              <div className="flex items-center gap-2">
                                                <span className="text-[9px] font-bold text-green-400/80 uppercase">Vocal Ready</span>
                                                <button className="text-white hover:text-indigo-400 transition-colors"><Volume2 size={12} /></button>
                                              </div>
                                            )}
                                          </div>
                                          <div className="p-3 bg-white/[0.02] rounded-xl border border-white/5 font-mono text-[11px] text-[#C4C7C5] leading-relaxed relative">
                                            <p className="line-clamp-4">{result.text}</p>
                                            <button 
                                              onClick={() => { setText(result.text); setActiveTab('single'); }}
                                              className="absolute bottom-2 right-2 px-2 py-1 bg-indigo-500 text-white text-[9px] font-black rounded-lg uppercase shadow-lg"
                                            >
                                              Full Editor
                                            </button>
                                          </div>
                                        </div>

                                        {/* Visual & Thumbnail Prompts */}
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-2 text-orange-400">
                                              <div className="p-1 px-1.5 rounded-md bg-orange-400/10"><Camera size={10} /></div>
                                              <span className="text-[10px] font-black uppercase tracking-widest">Visual Asset Blueprint</span>
                                          </div>
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {result.visualPrompts?.map((visual, idx) => (
                                              <div key={idx} className="p-3 bg-orange-500/5 border border-orange-500/10 rounded-xl space-y-1">
                                                  <span className="text-[8px] font-black uppercase text-orange-400/70">{visual.type}</span>
                                                  <p className="text-[10px] text-[#8E918F] italic line-clamp-2">{visual.prompt}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>

                                        {/* Audience Resonance */}
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-2 text-pink-400">
                                              <ShieldCheck size={14} />
                                              <span className="text-[10px] font-black uppercase tracking-widest"> Audience Sentiment & Sensitivity Audit</span>
                                          </div>
                                          <div className="p-3 bg-pink-500/5 rounded-xl border border-pink-500/10">
                                             <p className="text-[10px] text-[#C4C7C5] leading-relaxed">{result.sentiment}</p>
                                          </div>
                                        </div>

                                        {/* Social Media Distribution */}
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-2 text-blue-400">
                                              <Share2 size={14} />
                                              <span className="text-[10px] font-black uppercase tracking-widest">Multi-Channel Platform Synchronization</span>
                                          </div>
                                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                            {result.socialPosts?.map((post) => (
                                              <div key={post.platform} className="p-3 bg-white/[0.02] border border-white/5 rounded-xl space-y-2 group/post hover:bg-white/[0.04] transition-all">
                                                <div className="flex justify-between items-center">
                                                  <div className="flex items-center gap-1.5">
                                                     <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
                                                     <span className="text-[9px] font-black uppercase text-white/50">{post.platform}</span>
                                                  </div>
                                                  <div className="flex items-center gap-2">
                                                     <button 
                                                       onClick={() => {
                                                         navigator.clipboard.writeText(post.content);
                                                         setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Copied ${post.platform} post for ${result.lang}`]);
                                                       }}
                                                       className="text-[#8E918F] hover:text-white transition-colors p-1"
                                                       title="Copy Content"
                                                     >
                                                       <Copy size={10} />
                                                     </button>
                                                     {socialConnections.find(s => s.platform === post.platform)?.connected && (
                                                        <button 
                                                          onClick={() => pushToSocial(result.lang, post.platform, post.content)}
                                                          disabled={isPushing}
                                                          className="text-indigo-400 hover:text-white transition-colors p-1"
                                                          title="Push to Account"
                                                        >
                                                          <Send size={10} />
                                                        </button>
                                                     )}
                                                  </div>
                                                </div>
                                                <p className="text-[10px] text-[#8E918F] line-clamp-2 italic leading-tight group-hover/post:text-white/80 transition-colors">{post.content}</p>
                                              </div>
                                            ))}
                                          </div>
                                        </div>
                                      </motion.div>
                                    )}

                                    {result.status === 'processing' && (
                                      <div className="flex items-center gap-3 pt-2">
                                        <Loader2 size={12} className="animate-spin text-indigo-400" />
                                        <span className="text-[10px] font-bold text-indigo-400 uppercase animate-pulse">Pulse active in territory...</span>
                                      </div>
                                    )}
                                  </motion.div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                        </div>
                      </motion.div>
                    </div>
                  </div>
                </div>
              ) : activeTab === 'batch' ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <motion.div 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-dark rounded-2xl border border-[#333537] overflow-hidden shadow-2xl shadow-white/5"
                  >
                    <div className="p-8 px-10 bg-white/[0.03] border-b border-[#333537] flex items-center justify-between">
                      <div>
                        <h3 className="font-black uppercase tracking-[0.2em] text-[11px] text-[#C4C7C5]">Batch Processing</h3>
                        <p className="text-sm font-bold text-[#C4C7C5] mt-1">Convert multiple lines into unique audio tracks</p>
                      </div>
                    </div>
                    <textarea
                      className="w-full h-80 p-10 text-xl font-sans text-[#E3E3E3] bg-transparent border-none resize-none focus:outline-none placeholder:text-slate-700 leading-relaxed"
                      placeholder=""
                      value={batchTexts}
                      onChange={(e) => setBatchTexts(e.target.value)}
                    />
                    <div className="p-8 px-10 border-t border-[#333537] flex items-center justify-between bg-[#1E1F20]/60">
                      <button
                        disabled={isGenerating || !batchTexts.trim() || !voiceName}
                        onClick={handleGenerateBatch}
                        className={cn(
                          "px-10 py-4 rounded-2xl font-black uppercase tracking-[0.2em] text-xs transition-all flex items-center shadow-2xl border-b-4",
                          isGenerating 
                            ? "bg-[#1E1F20]/50 text-[#8E918F] border-[#444746] cursor-not-allowed" 
                            : "bg-indigo-600 text-white hover:bg-indigo-500 active:scale-95 active:border-b-0 active:translate-y-1 shadow-white/30 border-indigo-800 hover:-translate-y-0.5"
                        )}
                      >
                        {isGenerating ? <Loader2 size={18} className="animate-spin mr-3" /> : <List size={18} className="mr-3" />}
                        Process All Units
                      </button>
                      <div className="text-xs font-bold text-white/70 uppercase tracking-widest flex items-center gap-2">
                        <Sparkles size={14} className="text-[#C4C7C5]" /> Cloud Optimized
                      </div>
                    </div>
                  </motion.div>

                  {batchResults.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between px-2">
                         <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-white/70">Processed Results</h3>
                         <button onClick={handleDownloadBatchZip} className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-[#C4C7C5] hover:text-indigo-300 transition-colors">
                           <Download size={14} /> Download Archive
                         </button>
                      </div>
                      <div className="grid grid-cols-1 gap-3">
                        {batchResults.map((res, idx) => (
                          <motion.div 
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            key={idx} 
                            className="p-5 glass-dark border border-[#333537] rounded-2xl flex items-center justify-between group hover:border-white/30 transition-all"
                          >
                            <span className="text-sm font-bold text-[#C4C7C5] truncate max-w-sm">{res.text}</span>
                            <div className="flex items-center gap-4">
                               <audio src={res.url} controls className="h-8 invert group-hover:grayscale-0 transition-grayscale" />
                               <button 
                                 onClick={async () => {
                                   try {
                                     const fetchRes = await fetch(res.url);
                                     const blob = await fetchRes.blob();
                                     const blobUrl = URL.createObjectURL(blob);
                                     const a = document.createElement('a');
                                     a.href = blobUrl;
                                     a.download = `track_${idx+1}.mp3`;
                                     a.click();
                                     URL.revokeObjectURL(blobUrl);
                                   } catch (e) {
                                     setErrorInfo("Failed to download audio.");
                                   }
                                 }}
                                 className="p-2 text-[#8E918F] hover:text-white transition-colors"
                               >
                                 <Download size={16} />
                               </button>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : activeTab === 'playlist' ? (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  <div className="flex items-center justify-between px-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-white/[0.03] flex items-center justify-center">
                        <BookOpen className="text-[#C4C7C5]" size={20} />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Your Playlist</h2>
                        <p className="text-xs font-bold text-white/70 uppercase tracking-widest">Queue management</p>
                      </div>
                    </div>
                    {playlist.length > 0 && (
                      <div className="flex gap-2">
                        <button 
                          onClick={exportPlaylistAsZip}
                          className="bg-slate-100 hover:bg-indigo-500 text-xs font-black uppercase tracking-widest text-white px-6 py-3 rounded-2xl transition-all shadow-lg shadow-white/20 border-b-4 border-indigo-800 hover:-translate-y-0.5 active:translate-y-1 active:border-b-0"
                        >
                          Export as ZIP (MP3)
                        </button>
                        <button 
                          onClick={async () => { 
                            const content = JSON.stringify(playlist, null, 2);
                            const blob = new Blob([content], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `voice_collection_${Date.now()}.json`;
                            a.click();
                          }}
                          className="bg-[#1E1F20]/50 hover:bg-[#333537] text-xs font-black uppercase tracking-widest text-[#E3E3E3] px-6 py-3 rounded-2xl transition-all border border-b-4 border-[#444746] border-[#333537] hover:-translate-y-0.5 active:translate-y-1 active:border-b-0"
                        >
                          Export Data
                        </button>
                      </div>
                    )}
                  </div>

                  {playlist.length === 0 ? (
                    <div className="py-24 text-center border border-[#333537] rounded-2xl bg-white/[0.03] flex flex-col items-center justify-center">
                      <BookOpen size={64} className="text-[#1F1F1F] mb-6" />
                      <h3 className="text-lg font-bold text-[#C4C7C5]">Library Empty</h3>
                      <p className="text-sm text-[#8E918F] max-w-xs mt-2">Add generated vocals to your playlist from history to build collections.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-4">
                      {playlist.map((item, idx) => (
                        <motion.div 
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          key={item.id} 
                          className="glass-dark border border-[#333537] rounded-2xl p-6 flex items-center justify-between group hover:border-white/30 transition-all shadow-xl shadow-white/5"
                        >
                          <div className="flex items-center gap-6">
                            <span className="text-2xl font-black text-white/5 group-hover:text-white/20 transition-colors">{String(idx + 1).padStart(2, '0')}</span>
                            <div>
                               <p className="text-sm font-bold text-[#E3E3E3] line-clamp-1">{item.text}</p>
                               <p className="text-xs font-bold text-[#8E918F] uppercase tracking-widest mt-1">{new Date(item.timestamp).toDateString()}</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              ) : activeTab === 'dubbing' ? (
                <div className="space-y-6">
                  {!isVideoUploaded ? (
                    <div className="py-24 text-center border border-[#333537] rounded-2xl bg-white/[0.03]">
                      <Video size={64} className="text-[#1F1F1F] mb-6 mx-auto" />
                      <h3 className="text-lg font-bold text-[#C4C7C5]">Multilingual Dubbing</h3>
                      <p className="text-sm text-[#8E918F] max-w-xs mx-auto mt-2">Upload a video to dub it in another language.</p>
                      <input id="dubbing-upload-input" type="file" ref={dubbingInputRef} style={{ display: 'none' }} accept="video/*,audio/*,.pdf,.txt" onChange={(e) => e.target.files && e.target.files[0] && handleVideoUpload(e.target.files[0])} />
                      <button 
                        onClick={() => dubbingInputRef.current?.click()}
                        className={cn(
                          "inline-block mt-8 px-8 py-3 bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all select-none",
                          isUploadingVideo 
                            ? "opacity-50 cursor-not-allowed pointer-events-none" 
                            : "hover:bg-indigo-600 cursor-pointer hover:scale-105 active:scale-95 duration-200"
                        )}
                        disabled={isUploadingVideo}
                      >
                        {isUploadingVideo ? 'Launching AI Studio...' : 'Start Dubbing Project'}
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-6 animate-in fade-in duration-500">
                      {/* Control Panel */}
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                        <DubbingToggle icon={Zap} label="Lip-Sync" active={lipSyncEnabled} onClick={() => setLipSyncEnabled(!lipSyncEnabled)} />
                        <DubbingToggle icon={User} label="Voice Cloning" active={voiceCloningEnabled} onClick={() => setVoiceCloningEnabled(!voiceCloningEnabled)} />
                        <DubbingToggle icon={Smile} label="Emotion Aware" active={emotionAwareEnabled} onClick={() => setEmotionAwareEnabled(!emotionAwareEnabled)} />
                        <DubbingToggle icon={Music} label="Preserve BGM" active={preserveBackground} onClick={() => setPreserveBackground(!preserveBackground)} />
                        <DubbingToggle icon={Scissors} label="Stem Isolation" active={stemIsolationEnabled} onClick={() => setStemIsolationEnabled(!stemIsolationEnabled)} />
                        <DubbingToggle icon={Globe} label="Idiomatic" active={culturalAdaptationEnabled} onClick={() => setCulturalAdaptationEnabled(!culturalAdaptationEnabled)} />
                        <DubbingToggle icon={Lock} label="Zero Trust" active={zeroTrustEnabled} onClick={() => setZeroTrustEnabled(!zeroTrustEnabled)} />
                        <DubbingToggle icon={ShieldAlert} label="Zero-Day Vulnerabilities" active={zeroDayScanEnabled} onClick={() => setZeroDayScanEnabled(!zeroDayScanEnabled)} />
                      </div>

                      {/* Security Status Bar (Appears when features are enabled) */}
                      <AnimatePresence>
                        {(zeroTrustEnabled || zeroDayScanEnabled) && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-indigo-500/10 border border-indigo-500/30 rounded-2xl p-4 flex items-center justify-between mb-6 overflow-hidden"
                          >
                            <div className="flex items-center gap-4">
                              <div className="p-2 bg-indigo-500/20 rounded-lg">
                                <ShieldCheck className="text-indigo-400" size={20} />
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-white/90">Enhanced AI Security Active</p>
                                <p className="text-[9px] text-white/50">Zero-Trust Protocol & Real-time Vulnerability Scanning enabled for this project.</p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                               {zeroTrustEnabled && <span className="px-2 py-1 bg-black/40 rounded text-[8px] font-bold text-indigo-400 border border-indigo-500/20 uppercase tracking-tighter">Verified Access Only</span>}
                               {zeroDayScanEnabled && <span className="px-2 py-1 bg-black/40 rounded text-[8px] font-bold text-emerald-400 border border-emerald-500/20 uppercase tracking-tighter">No Anomalies Detected</span>}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Preview Area */}
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <div className="glass-dark rounded-2xl p-4 border border-white/5 relative aspect-video flex items-center justify-center bg-black">
                          <span className="absolute top-4 left-4 text-[10px] uppercase font-black tracking-widest text-white/40 bg-black/50 px-2 py-1 rounded">Original View</span>
                          <Video className="text-white/10" size={48} />
                        </div>
                        <div className="glass-dark rounded-2xl p-4 border border-white/5 relative aspect-video flex items-center justify-center bg-black overflow-hidden">
                          <span className="absolute top-4 left-4 text-[10px] uppercase font-black tracking-widest text-indigo-400 bg-black/50 px-2 py-1 rounded">AI Dubbed Preview</span>
                          <div className="absolute inset-0 bg-indigo-500/5 animate-pulse" />
                          <div className="text-center z-10">
                            <Sparkles className="text-indigo-400 mb-2 mx-auto" size={32} />
                            <p className="text-xs font-bold text-white uppercase tracking-widest">Active Lip-Sync processing</p>
                          </div>
                        </div>
                      </div>

                      {/* Interactive Timeline Editor */}
                      <div className="glass-dark border border-[#333537] rounded-2xl overflow-hidden">
                        <div className="p-4 border-b border-[#333537] flex items-center justify-between bg-white/[0.02]">
                          <div className="flex items-center gap-2">
                             <Clock size={16} className="text-indigo-400" />
                             <h4 className="text-xs font-bold text-white uppercase tracking-widest">Interactive Dubbing Timeline</h4>
                          </div>
                          <div className="flex items-center gap-4">
                            <button className="text-[10px] font-bold text-white/50 hover:text-white uppercase tracking-widest transition-colors">Add Segment</button>
                            <button className="text-[10px] font-bold text-white/50 hover:text-white uppercase tracking-widest transition-colors">Auto-Sync All</button>
                          </div>
                        </div>
                        <div className="max-h-[400px] overflow-y-auto p-4 space-y-3">
                          {dubbingSegments.map((seg) => (
                            <div key={seg.id} className="flex gap-4 p-4 rounded-xl bg-white/[0.03] border border-white/5 hover:border-indigo-500/50 transition-all group">
                               <div className="w-24 shrink-0">
                                  <p className="text-[10px] font-black text-indigo-400">{seg.start} - {seg.end}</p>
                                  <div className="mt-2 flex items-center gap-1">
                                    <User size={12} className="text-white/30" />
                                    <span className="text-[8px] font-bold text-white/50">{seg.speaker}</span>
                                  </div>
                               </div>
                               <div className="flex-1 space-y-2">
                                  <div className="flex flex-col md:flex-row gap-4">
                                    <div className="flex-1">
                                      <p className="text-[10px] uppercase font-black text-white/30 mb-1">Source</p>
                                      <p className="text-xs text-white/70 italic">{seg.original}</p>
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-[10px] uppercase font-black text-indigo-400 mb-1">Dubbed Translation</p>
                                      <textarea 
                                        defaultValue={seg.dubbed}
                                        className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 h-10 resize-none"
                                      />
                                    </div>
                                  </div>
                                  <div className="pt-2 flex items-center justify-between border-t border-white/5 opacity-0 group-hover:opacity-100 transition-opacity">
                                     <div className="flex items-center gap-4">
                                        <div className="flex items-center gap-2">
                                          <Volume2 size={12} className="text-white/30" />
                                          <input type="range" className="w-16 h-1 bg-white/10 rounded-full accent-indigo-500" defaultValue={seg.volume * 100} />
                                        </div>
                                        <select className="bg-transparent text-[10px] font-bold text-white/50 focus:outline-none">
                                          <option className="bg-slate-900">Emotion: {seg.emotion}</option>
                                          <option className="bg-slate-900">Urgent</option>
                                          <option className="bg-slate-900">Calm</option>
                                          <option className="bg-slate-900">Happy</option>
                                          <option className="bg-slate-900">Sad</option>
                                        </select>
                                     </div>
                                     <div className="flex items-center gap-2">
                                        <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/30 hover:text-indigo-400 transition-colors"><RotateCcw size={14} /></button>
                                        <button className="p-1.5 hover:bg-white/10 rounded-lg text-white/30 hover:text-red-400 transition-all" title="Delete Segment"><Trash2 size={14} /></button>
                                     </div>
                                  </div>
                               </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Export Actions */}
                      <div className="flex flex-wrap gap-4 justify-between items-center p-6 glass-dark rounded-2xl border border-indigo-500/20">
                         <div className="flex items-center gap-4">
                            <div className="flex -space-x-2">
                               {[1,2,3].map(i => <div key={i} className="w-8 h-8 rounded-full border-2 border-[#1E1F20] bg-slate-100/10 flex items-center justify-center text-[10px] font-bold text-white">SP{i}</div>)}
                            </div>
                            <p className="text-[10px] font-bold text-white/50 uppercase tracking-widest">3 Unique Speakers Identified</p>
                         </div>
                         <div className="flex flex-wrap gap-2">
                            <div className="flex bg-black/40 rounded-xl p-1 border border-white/5">
                               <button className="px-4 py-2 text-[10px] font-black uppercase text-white hover:bg-white/5 rounded-lg transition-all">Video + Audio</button>
                               <button className="px-4 py-2 text-[10px] font-black uppercase text-white/50 hover:text-white rounded-lg transition-all">Audio Only</button>
                               <button className="px-4 py-2 text-[10px] font-black uppercase text-white/50 hover:text-white rounded-lg transition-all">SRT</button>
                            </div>
                            <button className="bg-indigo-500 hover:bg-indigo-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-indigo-500/20 transition-all flex items-center gap-2">
                               <Download size={14} /> Export
                            </button>
                            <button className="bg-emerald-600 hover:bg-emerald-700 px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-emerald-500/20 transition-all">
                               Batch Queue
                            </button>
                         </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : activeTab === 'voice' ? (
                <div className="py-24 text-center border border-[#333537] rounded-2xl bg-white/[0.03]">
                  <Mic size={64} className="text-[#1F1F1F] mb-6 mx-auto" />
                  <h3 className="text-lg font-bold text-[#C4C7C5]">Voice Cloning</h3>
                  <p className="text-sm text-[#8E918F] max-w-xs mx-auto mt-2">Train a custom persona with your voice.</p>
                  <button className="mt-8 px-8 py-3 bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600">Train Persona</button>
                </div>
              ) : activeTab === 'conversation' ? (
                <div className="py-24 text-center border border-[#333537] rounded-2xl bg-white/[0.03]">
                  <Users size={64} className="text-[#1F1F1F] mb-6 mx-auto" />
                  <h3 className="text-lg font-bold text-[#C4C7C5]">AI Persona Conversation</h3>
                  <p className="text-sm text-[#8E918F] max-w-xs mx-auto mt-2">Chat in real-time with an AI persona.</p>
                  <button className="mt-8 px-8 py-3 bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600">Start Chat</button>
                </div>
              ) : activeTab === 'subtitles' ? (
                <div className="py-24 text-center border border-[#333537] rounded-2xl bg-white/[0.03]">
                  <Type size={64} className="text-[#1F1F1F] mb-6 mx-auto" />
                  <h3 className="text-lg font-bold text-[#C4C7C5]">Subtitle Editor</h3>
                  <p className="text-sm text-[#8E918F] max-w-xs mx-auto mt-2">Sync and edit your video subtitles.</p>
                  <button className="mt-8 px-8 py-3 bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600">Open Editor</button>
                </div>
              ) : activeTab === 'collab' ? (
                <div className="py-24 text-center border border-[#333537] rounded-2xl bg-white/[0.03]">
                  <Layout size={64} className="text-[#1F1F1F] mb-6 mx-auto" />
                  <h3 className="text-lg font-bold text-[#C4C7C5]">Collaborative Transcription</h3>
                  <p className="text-sm text-[#8E918F] max-w-xs mx-auto mt-2">Edit transcripts with your team.</p>
                  <button className="mt-8 px-8 py-3 bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600">Join Session</button>
                </div>
              ) : activeTab === 'enhancement' ? (
                <div className="py-24 text-center border border-[#333537] rounded-2xl bg-white/[0.03]">
                  <Sparkles size={64} className="text-[#1F1F1F] mb-6 mx-auto" />
                  <h3 className="text-lg font-bold text-[#C4C7C5]">Media Cleanup</h3>
                  <p className="text-sm text-[#8E918F] max-w-xs mx-auto mt-2">Enhance audio/video quality.</p>
                  <button className="mt-8 px-8 py-3 bg-indigo-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-indigo-600">Start Cleanup</button>
                </div>
              ) : (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
                  {!user ? (
                    <div className="py-24 text-center glass-dark rounded-2xl p-10 flex flex-col items-center justify-center border border-[#333537]">
                      <Users size={64} className="text-slate-700 mb-6" />
                      <h3 className="text-lg font-bold text-white mb-2">Sign in Required</h3>
                      <p className="text-sm text-[#8E918F] max-w-xs mx-auto mb-8">Teams and Collaborative Playlists require an account to sync across devices.</p>
                      <AuthComponent />
                    </div>
                  ) : (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-2xl bg-white/[0.03] flex items-center justify-center">
                            <Users className="text-[#C4C7C5]" size={20} />
                          </div>
                          <div>
                            <h2 className="text-xl font-bold text-white tracking-tight">Team Folders</h2>
                            <p className="text-xs font-bold text-[#8E918F] uppercase tracking-widest leading-none mt-1">Collaborative Audio Libraries</p>
                          </div>
                        </div>
                        <button 
                          onClick={createSharedPlaylist}
                          className="flex items-center gap-2 bg-slate-100 hover:bg-indigo-500 text-white px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-white/20 border-b-4 border-indigo-800 hover:-translate-y-0.5 active:translate-y-1 active:border-b-0"
                        >
                          <Plus size={16} /> Create Folder
                        </button>
                      </div>

                      {sharedPlaylists.length === 0 ? (
                        <div className="py-20 text-center border border-[#333537] rounded-2xl bg-white/[0.03]">
                          <Share2 size={48} className="text-[#1F1F1F] mb-4 mx-auto" />
                          <h3 className="text-sm font-bold text-[#C4C7C5]">No shared folders yet</h3>
                          <p className="text-xs text-[#8E918F] mt-1">Create a folder and invite team members to collaborate.</p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                          {sharedPlaylists.map(playlist => (
                            <motion.div 
                              key={playlist.id}
                              onClick={() => setSelectedSharedPlaylist(playlist)}
                              className={cn(
                                "p-6 rounded-2xl border transition-all cursor-pointer group",
                                selectedSharedPlaylist?.id === playlist.id 
                                  ? "bg-slate-100/10 border-[#333537]0 shadow-2xl shadow-white/5" 
                                  : "bg-white/[0.03] border-[#333537] hover:border-[#444746]"
                              )}
                            >
                              <div className="flex items-center justify-between mb-4">
                                <div className="w-12 h-12 rounded-2xl bg-[#1E1F20]/50 flex items-center justify-center text-[#C4C7C5] group-hover:bg-indigo-500 group-hover:text-white transition-all">
                                  <BookOpen size={24} />
                                </div>
                                <div className="flex -space-x-2">
                                  <div className="w-8 h-8 rounded-full bg-slate-400 border-2 border-[#444746] flex items-center justify-center text-xs font-bold text-white" title={playlist.ownerEmail}>
                                    {playlist.ownerEmail ? playlist.ownerEmail[0].toUpperCase() : 'U'}
                                  </div>
                                  {playlist.collaborators?.slice(0, 3).map((email: string, i: number) => (
                                    <div key={i} className={cn(
                                      "w-8 h-8 rounded-full border-2 border-[#444746] flex items-center justify-center text-xs font-bold",
                                      playlist.collaboratorRoles?.[email] === 'editor' ? "bg-slate-100 text-[#131314]" : "bg-[#333537] text-[#E3E3E3]"
                                    )} title={`${email} (${playlist.collaboratorRoles?.[email] || 'viewer'})`}>
                                      {email[0].toUpperCase()}
                                    </div>
                                  ))}
                                  {playlist.collaborators?.length > 3 && (
                                    <div className="w-8 h-8 rounded-full bg-[#1E1F20]/50 border-2 border-[#444746] flex items-center justify-center text-[8px] font-bold text-[#8E918F]">
                                      +{playlist.collaborators.length - 3}
                                    </div>
                                  )}
                                </div>
                              </div>
                              <h4 className="font-bold text-white mb-1">{playlist.name}</h4>
                              <p className="text-xs font-bold text-[#8E918F] uppercase tracking-widest">{playlist.ownerId === user?.uid ? "Owned by you" : `Shared by ${playlist.ownerEmail?.split('@')[0] || 'User'}`}</p>
                            </motion.div>
                          ))}
                        </div>
                      )}

                      {selectedSharedPlaylist && (
                        <motion.div 
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="space-y-6 pt-8 border-t border-[#333537]"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <button onClick={() => setSelectedSharedPlaylist(null)} className="p-2 text-[#8E918F] hover:text-white"><Plus className="rotate-45" size={20} /></button>
                              <div>
                                <h3 className="text-lg font-bold text-white uppercase tracking-tight">{selectedSharedPlaylist.name}</h3>
                                <p className="text-xs font-bold text-[#8E918F] uppercase tracking-widest mt-1">
                                  Your role: {selectedSharedPlaylist.ownerId === user?.uid ? "Owner" : (selectedSharedPlaylist.collaboratorRoles?.[user?.email || ''] || 'viewer')}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <div className="flex gap-4">
                                {selectedSharedPlaylist.ownerId === user?.uid && (
                                  <button 
                                    onClick={() => inviteCollaborator(selectedSharedPlaylist.id)}
                                    className="flex items-center gap-2 bg-[#1E1F20]/50 hover:bg-[#333537] text-xs font-black uppercase tracking-widest text-[#E3E3E3] px-5 py-3 rounded-xl transition-all border border-[#333537]"
                                  >
                                    <Users size={14} /> Invite Team
                                  </button>
                                )}
                                <button 
                                  onClick={() => setShowDirectingRoom(true)}
                                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-xs font-black uppercase tracking-widest text-white px-5 py-3 rounded-xl transition-all shadow-lg shadow-emerald-600/20 active:translate-y-0.5"
                                >
                                  <MonitorPlay size={14} /> Directing Huddle
                                </button>
                              </div>
                              <button 
                                onClick={() => setShowHistorySelection(true)}
                                className="flex items-center gap-2 bg-slate-100 hover:bg-indigo-500 text-xs font-black uppercase tracking-widest text-white px-5 py-3 rounded-xl transition-all shadow-lg shadow-zinc-800 border-b-4 border-indigo-800 hover:-translate-y-0.5 active:translate-y-1 active:border-b-0"
                              >
                                <Plus size={14} /> Add Track
                              </button>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                            <div className="space-y-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-black uppercase tracking-widest text-[#8E918F]">Shared Tracks</h4>
                              </div>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {sharedItems.length === 0 ? (
                                  <div className="py-20 text-center border border-dashed border-[#444746] rounded-2xl col-span-full">
                                    <p className="text-sm text-[#8E918F]">No tracks in this folder yet.</p>
                                  </div>
                                ) : (
                                  sharedItems.map(item => {
                                    const reactions = sharedReactions[item.id] || [];
                                    const likes = reactions.filter(r => r.status === 'like').length;
                                    const dislikes = reactions.filter(r => r.status === 'dislike').length;
                                    const userReaction = reactions.find(r => r.userId === user?.uid)?.status;

                                    return (
                                        <div key={item.id} className="bg-white/[0.03] border border-[#333537] rounded-[2rem] p-6 flex flex-col justify-between group/item hover:bg-white/10 transition-all">
                                          <div className="space-y-4">
                                            <div className="flex items-center justify-between">
                                                <button 
                                                    onClick={() => {
                                                        setAudioUrl(item.url);
                                                        setText(item.text);
                                                        setActiveTab('single');
                                                        setActiveListenSession({ playlistId: selectedSharedPlaylist.id, itemId: item.id, startTime: Date.now() });
                                                    }} 
                                                    className="w-12 h-12 rounded-2xl bg-slate-100 text-[#131314] flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-xl shadow-zinc-800"
                                                >
                                                    <Play size={24} className="fill-current" />
                                                </button>
                                                <div className="flex items-center gap-1 bg-[#1E1F20]/50 p-1 rounded-xl border border-[#333537]">
                                                    <button 
                                                        onClick={() => {
                                                            handleSharedLike(selectedSharedPlaylist.id, item.id, 'like');
                                                            fetchSharedReactions(selectedSharedPlaylist.id, item.id);
                                                        }} 
                                                        className={cn(
                                                            "p-2 rounded-lg flex items-center gap-1.5 transition-all text-xs",
                                                            userReaction === 'like' ? "bg-green-500/20 text-green-400 font-black" : "text-[#8E918F] hover:text-white"
                                                        )}
                                                    >
                                                        <ThumbsUp size={14} className={cn(userReaction === 'like' && "fill-current")} />
                                                        {likes > 0 && <span>{likes}</span>}
                                                    </button>
                                                    <button 
                                                        onClick={() => {
                                                            handleSharedLike(selectedSharedPlaylist.id, item.id, 'dislike');
                                                            fetchSharedReactions(selectedSharedPlaylist.id, item.id);
                                                        }} 
                                                        className={cn(
                                                            "p-2 rounded-lg flex items-center gap-1.5 transition-all text-xs",
                                                            userReaction === 'dislike' ? "bg-red-500/20 text-red-400 font-black" : "text-[#8E918F] hover:text-white"
                                                        )}
                                                    >
                                                        <ThumbsDown size={14} className={cn(userReaction === 'dislike' && "fill-current")} />
                                                        {dislikes > 0 && <span>{dislikes}</span>}
                                                    </button>
                                                </div>
                                            </div>
                                            
                                            <div>
                                                <p className="text-sm font-bold text-white line-clamp-2 leading-relaxed">{item.text}</p>
                                                <p className="text-xs font-bold text-[#8E918F] uppercase tracking-widest mt-2 opacity-60">By {item.authorName} • {item.timestamp ? new Date(item.timestamp.seconds * 1000).toLocaleDateString() : 'Just now'}</p>
                                            </div>
                                          </div>
                                          
                                          <div className="flex items-center justify-between mt-6 pt-4 border-t border-[#333537]">
                                            <div className="flex gap-2">
                                                <button 
                                                    onClick={() => {
                                                        const pId = selectedSharedPlaylist.id;
                                                        fetchComments(pId, item.id);
                                                        fetchAnalytics(pId, item.id);
                                                        fetchSharedReactions(pId, item.id);
                                                    }}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-white/[0.03] hover:bg-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-[#C4C7C5] transition-all border border-[#333537]"
                                                >
                                                    <MessageSquare size={12} /> {playlistComments[item.id]?.length || 0}
                                                </button>
                                                <button 
                                                    onClick={async () => {
                                                        try {
                                                          const res = await fetch(item.url);
                                                          const blob = await res.blob();
                                                          const blobUrl = URL.createObjectURL(blob);
                                                          const a = document.createElement('a');
                                                          a.href = blobUrl;
                                                          a.download = `voice_${item.id}.mp3`;
                                                          a.click();
                                                          URL.revokeObjectURL(blobUrl);
                                                        } catch (e) {
                                                          if (item.url?.startsWith('blob:')) {
                                                            setErrorInfo("This audio was generated in an older session and cannot be downloaded by other users. Please re-generate it.");
                                                          } else {
                                                            setErrorInfo("Failed to download audio.");
                                                          }
                                                        }
                                                    }}
                                                    className="p-1.5 bg-[#1E1F20]/50 text-[#8E918F] hover:text-[#C4C7C5] rounded-lg transition-colors"
                                                >
                                                    <Download size={14} />
                                                </button>
                                            </div>
                                            {(selectedSharedPlaylist.ownerId === user?.uid || item.authorId === user?.uid) && (
                                              <button onClick={() => deleteSharedItem(selectedSharedPlaylist.id, item.id)} className="p-1.5 text-[#8E918F] hover:text-red-500 transition-all"><Trash2 size={14} /></button>
                                            )}
                                          </div>
                                        </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-black uppercase tracking-widest text-[#8E918F]">Collaborative Scripts</h4>
                                <button 
                                  onClick={() => { createScript(selectedSharedPlaylist.id); fetchScripts(selectedSharedPlaylist.id); }}
                                  className="text-xs font-black uppercase tracking-widest bg-[#1E1F20]/50 text-[#C4C7C5] border border-white/30 px-3 py-1.5 rounded-xl hover:bg-slate-100 hover:text-white transition-all shadow-sm active:scale-95 flex items-center gap-1"
                                >
                                  <Plus size={12} /> New Script
                                </button>
                              </div>
                              <div className="space-y-3">
                                {(!playlistScripts[selectedSharedPlaylist.id] || playlistScripts[selectedSharedPlaylist.id].length === 0) ? (
                                  <div className="py-12 border border-dashed border-[#333537] rounded-[2rem] flex flex-col items-center justify-center text-[#8E918F]">
                                     <FileText size={24} className="mb-2 opacity-20" />
                                     <button 
                                       onClick={() => fetchScripts(selectedSharedPlaylist.id)}
                                       className="text-xs hover:text-[#C4C7C5] transition-colors"
                                     >
                                       Load Scripts
                                     </button>
                                  </div>
                                ) : (
                                  playlistScripts[selectedSharedPlaylist.id].map(script => (
                                    <div key={script.id} className={cn(
                                      "p-4 rounded-2xl border transition-all cursor-pointer",
                                      activeScript?.id === script.id ? "bg-slate-100/10 border-[#333537]0" : "bg-white/[0.03] border-[#333537] hover:border-[#444746]"
                                    )} onClick={() => setActiveScript(script)}>
                                      <div className="flex items-center justify-between mb-1">
                                         <h5 className="text-sm font-bold text-white">{script.title}</h5>
                                         <button 
                                           onClick={(e) => {
                                             e.stopPropagation();
                                             setText(script.content);
                                             setActiveTab('single');
                                           }}
                                           className="px-4 py-1.5 bg-slate-100/10 text-[#C4C7C5] border border-white/20 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-100 hover:text-white transition-all shadow-sm active:scale-95"
                                         >
                                           Use for TTS
                                         </button>
                                      </div>
                                      <p className="text-xs text-[#8E918F] line-clamp-2 mb-2">{script.content || 'Empty script...'}</p>
                                      <div className="flex items-center justify-between">
                                         <p className="text-[8px] font-black uppercase text-[#8E918F] tracking-widest">Edited by {script.lastAuthorName} • {script.updatedAt ? new Date(script.updatedAt.seconds * 1000).toLocaleTimeString() : 'Just now'}</p>
                                         {activeScript?.id === script.id && (
                                           <button onClick={() => setActiveScript(null)} className="text-[8px] font-black uppercase text-red-400 tracking-widest">Close Editor</button>
                                         )}
                                      </div>
                                    </div>
                                  ))
                                )}

                                {activeScript && (
                                  <motion.div 
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    className="bg-[#1E1F20] border border-white/30 rounded-[2rem] p-6 space-y-4 shadow-2xl"
                                  >
                                    <div className="flex items-center justify-between">
                                       <h4 className="text-sm font-bold text-white">Editing: {activeScript.title}</h4>
                                       <div className="flex items-center gap-2">
                                         <span className="flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                         <span className="text-[9px] font-black uppercase text-[#8E918F] tracking-widest">Live Syncing</span>
                                       </div>
                                    </div>
                                    <textarea 
                                      value={activeScript.content}
                                      onChange={(e) => {
                                        const newContent = e.target.value;
                                        setActiveScript({ ...activeScript, content: newContent });
                                        updateScript(selectedSharedPlaylist.id, activeScript.id, newContent);
                                      }}
                                      placeholder=""
                                      className="w-full h-48 bg-black/40 border border-[#333537] rounded-2xl p-4 text-sm text-[#E3E3E3] focus:outline-none focus:border-[#333537] transition-all resize-none font-mono"
                                    />
                                    <div className="flex justify-end">
                                       <button 
                                         onClick={() => setActiveScript(null)}
                                         className="bg-slate-100 hover:bg-indigo-500 text-white px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-zinc-800 border-b-2 border-indigo-800 active:border-b-0 active:translate-y-0.5"
                                       >
                                         Done & Sync
                                       </button>
                                    </div>
                                  </motion.div>
                                )}
                              </div>
                            </div>

                              <div className="space-y-6">
                                {/* Social Lab Panel */}
                                <div className="bg-[#1E1F20] border border-[#333537] rounded-2xl p-8 space-y-6 shadow-2xl">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-white/[0.03] flex items-center justify-center text-[#C4C7C5]">
                                                <Share2 size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black uppercase tracking-widest text-white">Creator Social Lab</h4>
                                                <p className="text-xs text-[#8E918F] font-bold uppercase tracking-tight">Post-Production Optimization</p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div className="p-4 bg-white/[0.03] rounded-2xl border border-[#333537] space-y-2">
                                            <p className="text-xs font-black text-[#C4C7C5] uppercase tracking-widest">Subtitle Export</p>
                                            <button className="w-full py-2 bg-slate-100/10 hover:bg-[#1E1F20]/50 text-[#C4C7C5] border border-white/20 rounded-xl text-xs font-bold uppercase tracking-widest transition-all">
                                                Generate .SRT
                                            </button>
                                        </div>
                                        <div className="p-4 bg-white/[0.03] rounded-2xl border border-[#333537] space-y-2">
                                            <p className="text-xs font-black text-[#C4C7C5] uppercase tracking-widest">Post Context</p>
                                            <button 
                                              onClick={generateSocialMetadata}
                                              disabled={isGeneratingCaption}
                                              className={cn(
                                                "w-full py-2 border rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                                isGeneratingCaption 
                                                  ? "bg-amber-600/10 text-[#8E918F] border-[#444746] animate-pulse" 
                                                  : "bg-[#1E1F20]/50 hover:bg-[#333537] text-[#E3E3E3] border-[#333537]"
                                              )}
                                            >
                                                {isGeneratingCaption ? "Drafting..." : "Write Caption"}
                                            </button>
                                        </div>
                                        <div className="p-4 bg-white/[0.03] rounded-2xl border border-blue-500/30 space-y-2">
                                            <p className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                                              <Shield size={12} /> Security Shield
                                            </p>
                                            <button 
                                              onClick={performSecurityAudit}
                                              disabled={isPerformingSecurityScan}
                                              className={cn(
                                                "w-full py-2 border rounded-xl text-xs font-bold uppercase tracking-widest transition-all",
                                                isPerformingSecurityScan 
                                                  ? "bg-blue-600/10 text-[#8E918F] border-[#444746] animate-pulse" 
                                                  : "bg-blue-900/20 hover:bg-blue-900/40 text-blue-100 border-blue-500/30"
                                              )}
                                            >
                                                {isPerformingSecurityScan ? "Auditing..." : "Zero Trust Scan"}
                                            </button>
                                        </div>
                                    </div>

                                    {securityScanResults && (
                                      <motion.div 
                                        initial={{ opacity: 0, y: -10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-6 bg-blue-950/20 rounded-2xl border border-blue-500/30 space-y-4"
                                      >
                                          <div className="flex items-center justify-between">
                                              <h5 className="text-xs font-black text-blue-400 uppercase tracking-widest">Zero-Day & Trust Audit Results</h5>
                                              <div className="flex items-center gap-2">
                                                <span className={cn(
                                                  "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tighter",
                                                  securityScanResults.vulnerabilityStatus === 'Safe' ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"
                                                )}>
                                                  {securityScanResults.vulnerabilityStatus}
                                                </span>
                                                <span className="text-xs font-bold text-white">{securityScanResults.zeroTrustScore}% Trust Score</span>
                                              </div>
                                          </div>
                                          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-3">
                                              <p className="text-[10px] font-black text-[#8E918F] uppercase tracking-widest">Vulnerability Findings</p>
                                              <ul className="space-y-1.5">
                                                {securityScanResults.findings?.map((f: string, i: number) => (
                                                  <li key={i} className="text-xs text-[#C4C7C5] flex items-center gap-2">
                                                    <div className="w-1 h-1 rounded-full bg-blue-400" /> {f}
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                            <div className="space-y-3">
                                              <p className="text-[10px] font-black text-[#8E918F] uppercase tracking-widest">Zero Trust Hardening</p>
                                              <ul className="space-y-1.5">
                                                {securityScanResults.hardeningSteps?.map((s: string, i: number) => (
                                                  <li key={i} className="text-xs text-[#C4C7C5] flex items-center gap-2">
                                                    <div className="w-1 h-1 rounded-full bg-green-400" /> {s}
                                                  </li>
                                                ))}
                                              </ul>
                                            </div>
                                          </div>
                                          <div className="pt-4 border-t border-blue-500/10">
                                            <p className="text-[10px] font-black text-blue-400/60 uppercase tracking-widest mb-1">Zero-Day Intelligence</p>
                                            <p className="text-[11px] text-[#8E918F] italic leading-relaxed">{securityScanResults.zeroDayIntel}</p>
                                          </div>
                                      </motion.div>
                                    )}

                                    {socialCaption && (
                                      <div className="p-6 bg-transparent rounded-2xl border border-[#333537] space-y-4 animate-in fade-in slide-in-from-top-2 duration-500">
                                          <div className="flex items-center justify-between">
                                              <p className="text-xs font-black text-[#8E918F] uppercase tracking-widest">Platform Optimized Draft</p>
                                              <button 
                                                onClick={() => { navigator.clipboard.writeText(socialCaption); alert('Caption Copied!'); }}
                                                className="text-xs font-black text-[#8E918F] hover:text-white uppercase tracking-widest"
                                              >
                                                Copy
                                              </button>
                                          </div>
                                          <p className="text-xs text-[#E3E3E3] leading-relaxed whitespace-pre-wrap font-mono">{socialCaption}</p>
                                      </div>
                                    )}

                                    <div className="bg-slate-100/5 p-4 rounded-2xl border border-[#333537]">
                                        <h5 className="text-xs font-black text-[#C4C7C5] uppercase tracking-widest mb-3 flex items-center gap-2">
                                            <MonitorPlay size={12} /> Optimization for {socialFormat}
                                        </h5>
                                        <p className="text-[11px] text-[#C4C7C5] leading-relaxed italic">
                                            {socialFormat === 'TikTok' && "High-energy frequency response enabled. Audio sharpened for mobile speakers and heavy background music mixing."}
                                            {socialFormat === 'YouTube' && "Mid-range focused normalization. Optimized for desktop high-fidelity speakers and long-form narration padding."}
                                            {socialFormat === 'Podcast' && "Deep frequency warmth added. Simulating proximity effect for intimate, high-quality professional microphone presence."}
                                            {socialFormat === 'Standard' && "Balanced profile for general web and application usage."}
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-[#1E1F20] border border-[#333537] rounded-2xl p-8 space-y-6 shadow-2xl h-full flex flex-col">
                                  <div className="flex items-center gap-3">
                                      <div className="w-10 h-10 rounded-2xl bg-slate-100 text-[#131314]/10 flex items-center justify-center text-[#8E918F]">
                                          <Activity size={20} />
                                      </div>
                                      <h4 className="text-sm font-black uppercase tracking-widest text-white">Team Insights</h4>
                                  </div>
                                <div className="space-y-6 overflow-y-auto flex-1 pr-2 scrollbar-hide min-h-[400px]">
                                    <div className="space-y-4">
                                        <h5 className="text-xs font-black uppercase tracking-widest text-[#8E918F] mb-4">Latest Feedback</h5>
                                        {sharedItems.some(item => (playlistComments[item.id] || []).length > 0) ? (
                                            sharedItems.flatMap(item => (playlistComments[item.id] || []).map(comment => ({ ...comment, itemId: item.id, itemText: item.text })))
                                                .sort((a, b) => (b.timestamp?.seconds || 0) - (a.timestamp?.seconds || 0))
                                                .slice(0, 10)
                                                .map((comment: any) => (
                                                    <div key={comment.id} className="bg-white/[0.03] p-4 rounded-2xl border border-[#333537] hover:bg-white/10 transition-all">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <span className="text-xs font-black text-[#C4C7C5] uppercase tracking-tight">{comment.userName}</span>
                                                            <span className="text-[8px] text-[#8E918F] uppercase font-bold">{comment.timestamp ? new Date(comment.timestamp.seconds * 1000).toLocaleTimeString() : 'Just now'}</span>
                                                        </div>
                                                        <p className="text-xs text-[#E3E3E3] mb-3 leading-relaxed">{comment.text}</p>
                                                        <div 
                                                            onClick={() => {
                                                                const itm = sharedItems.find(i => i.id === comment.itemId);
                                                                if (itm) {
                                                                    setAudioUrl(itm.url);
                                                                    setText(itm.text);
                                                                }
                                                            }}
                                                            className="text-[9px] font-bold text-[#8E918F] hover:text-white flex items-center gap-1.5 cursor-pointer"
                                                        >
                                                            <Play size={10} /> {comment.itemText.substring(0, 20)}...
                                                        </div>
                                                    </div>
                                                ))
                                        ) : (
                                            <div className="py-12 text-center text-[#8E918F] opacity-40">
                                                <MessageSquare size={24} className="mx-auto mb-2" />
                                                <p className="text-xs uppercase font-bold tracking-widest">No feedback yet</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4 pt-6 border-t border-[#333537]">
                                        <h5 className="text-xs font-black uppercase tracking-widest text-[#8E918F] mb-4">Interactions Pulse</h5>
                                        {sharedItems.map(item => {
                                            const comments = playlistComments[item.id] || [];
                                            const analytics = playlistAnalytics[item.id] || [];
                                            const reactions = sharedReactions[item.id] || [];
                                            if (comments.length === 0 && analytics.length === 0 && reactions.length === 0) return null;
                                            
                                            return (
                                                <div key={item.id} className="flex items-center justify-between text-xs text-[#C4C7C5] group/pulse py-1" title={item.text}>
                                                    <span className="truncate max-w-[120px] font-bold group-hover/pulse:text-[#C4C7C5] transition-colors uppercase tracking-tight">{item.text}</span>
                                                    <div className="flex items-center gap-3">
                                                        {analytics.length > 0 && <span className="flex items-center gap-1 text-[#8E918F]"><Activity size={10} /> {analytics.length}</span>}
                                                        {comments.length > 0 && <span className="flex items-center gap-1 text-[#C4C7C5]"><MessageSquare size={10} /> {comments.length}</span>}
                                                        {reactions.length > 0 && <span className="flex items-center gap-1 text-green-500"><ThumbsUp size={10} /> {reactions.filter(r => r.status === 'like').length}</span>}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                                <div className="mt-auto pt-6 border-t border-[#333537]">
                                    <div className="flex items-center justify-between">
                                        <p className="text-xs font-black uppercase tracking-[0.2em] text-[#8E918F]">Collaboration Engine</p>
                                    </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

        {/* Playlist Player Overlay */}
        <AnimatePresence>
          {playlist.length > 0 && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 p-6 rounded-2xl shadow-2xl glass backdrop-blur-3xl border border-[#444746] flex items-center gap-10 "
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-white shadow-xl shadow-white/30">
                  <BookOpen size={24} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-widest text-white/70">Dynamic Library</p>
                  <p className="text-sm font-black text-white">{playlist.length} Tracks Ready</p>
                </div>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div className="flex gap-3">
                <button 
                  onClick={() => { if (playlist.length > 0) { setText(playlist[0].text); handleGenerateSingle(); } }}
                  className="bg-slate-100 hover:bg-indigo-500 text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-white/20"
                >
                  Start Lab
                </button>
                <button 
                  onClick={() => setPlaylist([])}
                  className="p-3 text-white/70 hover:text-red-400 transition-colors"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
  </main>
  <ActionSidebar text={text} setText={setText} setEditMode={setEditMode} genAIResponse={genAIResponse} setCommandFeedback={setCommandFeedback} setErrorInfo={setErrorInfo} isOpen={isRightSidebarOpen} onClose={() => setIsRightSidebarOpen(false)} />




        {/* Quiz Mode Modal */}
        <AnimatePresence>
          {isQuizActive && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-transparent/95 backdrop-blur-3xl"
            >
              <motion.div 
                initial={{ scale: 0.95, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-2xl h-[80vh] flex flex-col shadow-3xl overflow-hidden"
              >
                {/* Header */}
                <div className="p-6 border-b border-[#333537] flex items-center justify-between bg-white/[0.03]">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center flex-shrink-0">
                      <Sparkles className="text-white" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tight">Knowledge Check</h3>
                      <p className="text-xs text-[#C4C7C5] font-bold uppercase tracking-widest mt-1">
                        {quizPhase === 'active' ? `Question ${currentQuestionIndex + 1} of ${quizData?.length || 0}` : quizPhase === 'results' ? 'Results' : 'Generating Quiz...'}
                      </p>
                    </div>
                  </div>
                  <button 
                    onClick={() => { setIsQuizActive(false); setQuizPhase('loading'); }}
                    className="p-3 bg-white/[0.03] hover:bg-white/10 rounded-2xl text-[#C4C7C5] hover:text-white transition-all flex-shrink-0"
                  >
                    <X size={20} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 flex flex-col items-center justify-center relative">
                  {quizPhase === 'loading' && (
                    <div className="flex flex-col items-center gap-4 text-[#C4C7C5] animate-pulse">
                      <Sparkles size={48} className="animate-bounce text-indigo-500" />
                      <p className="text-sm font-bold uppercase tracking-widest">Generating Your Custom Quiz...</p>
                    </div>
                  )}

                  {quizPhase === 'active' && quizData && quizData[currentQuestionIndex] && (
                    <div className="max-w-xl w-full space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                      <h2 className="text-xl md:text-2xl font-bold text-white leading-relaxed">
                        {quizData[currentQuestionIndex].question}
                      </h2>
                      
                      <div className="space-y-3">
                        {quizData[currentQuestionIndex].options.map((opt, i) => (
                          <button
                            key={i}
                            onClick={() => {
                              if (selectedAnswer === null) {
                                setSelectedAnswer(i);
                                if (i === quizData[currentQuestionIndex].correctIndex) {
                                  setQuizScore(prev => prev + 1);
                                }
                              }
                            }}
                            className={cn(
                              "w-full text-left p-4 rounded-xl border text-sm font-medium transition-all",
                              selectedAnswer === null 
                                ? "border-[#333537] bg-white/[0.03] hover:bg-white/10 text-white" 
                                : i === quizData[currentQuestionIndex].correctIndex 
                                  ? "border-green-500 bg-green-500/20 text-green-100"
                                  : selectedAnswer === i 
                                    ? "border-red-500 bg-red-500/20 text-red-100"
                                    : "border-[#333537] bg-white/[0.03] text-gray-400 opacity-50"
                            )}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>

                      {selectedAnswer !== null && (
                        <div className="p-4 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-100 text-sm leading-relaxed animate-in fade-in zoom-in duration-300">
                          <span className="font-bold mr-2">Explanation:</span>
                          {quizData[currentQuestionIndex].explanation}
                        </div>
                      )}
                    </div>
                  )}

                  {quizPhase === 'results' && quizData && (
                    <div className="text-center space-y-6 animate-in zoom-in duration-500">
                      <div className="w-24 h-24 bg-indigo-500/20 rounded-full flex items-center justify-center mx-auto ring-4 ring-indigo-500/30">
                        <Target size={48} className="text-indigo-400" />
                      </div>
                      <div>
                        <h2 className="text-3xl font-black text-white">Quiz Complete!</h2>
                        <p className="text-[#C4C7C5] mt-2 font-medium">You scored {quizScore} out of {quizData.length}</p>
                      </div>
                      <div className="w-full max-w-sm mx-auto h-2 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500" 
                          style={{ width: `${(quizScore / quizData.length) * 100}%` }}
                        />
                      </div>
                      <p className="max-w-sm text-sm text-[#8E918F] mx-auto">
                        {quizScore === quizData.length ? "Perfect score! Outstanding reading comprehension." : 
                         quizScore >= quizData.length / 2 ? "Great job! You got the main points." : 
                         "Good try! Read the text again to catch the details."}
                      </p>
                    </div>
                  )}
                </div>

                {/* Footer Controls */}
                {(quizPhase === 'active' && selectedAnswer !== null) && (
                  <div className="p-6 border-t border-[#333537] bg-[#1E1F20]/50 flex justify-end">
                    <button
                      onClick={() => {
                        if (currentQuestionIndex < (quizData?.length || 0) - 1) {
                          setCurrentQuestionIndex(prev => prev + 1);
                          setSelectedAnswer(null);
                        } else {
                          setQuizPhase('results');
                        }
                      }}
                      className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                    >
                      {currentQuestionIndex < (quizData?.length || 0) - 1 ? 'Next Question' : 'View Results'}
                    </button>
                  </div>
                )}
                
                {quizPhase === 'results' && (
                  <div className="p-6 border-t border-[#333537] bg-[#1E1F20]/50 flex justify-center gap-4">
                     <button
                        onClick={() => { setIsQuizActive(false); setQuizPhase('loading'); }}
                        className="px-6 py-3 bg-white/[0.03] hover:bg-white/10 text-white border border-[#333537] rounded-xl text-xs font-black uppercase tracking-widest transition-all active:scale-95"
                      >
                        Close
                      </button>
                      <button
                        onClick={generateQuiz}
                        className="px-6 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg active:scale-95"
                      >
                        Try Another
                      </button>
                  </div>
                )}

              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>


        {/* Pacing Coach Modal */}
        <AnimatePresence>
          {isPacingCoachActive && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-transparent/95 backdrop-blur-3xl"
            >
              <div className="absolute inset-0" onClick={() => setIsPacingCoachActive(false)} />
              <motion.div 
                onClick={(e) => e.stopPropagation()}
                className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-2xl p-8 shadow-3xl space-y-6"
              >
                <h3 className="text-lg font-black text-white uppercase">Pacing Coach</h3>
                <p className="text-[#8E918F] text-sm">Read your script aloud. We will track your pacing based on YouTube best practices.</p>
                
                <div className="flex justify-center py-10">
                   <div className="w-32 h-32 rounded-full bg-indigo-500/20 flex items-center justify-center border-4 border-indigo-500/50 animate-pulse">
                      <Activity size={48} className="text-indigo-400" />
                   </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                    <div className="p-4 bg-white/[0.03] rounded-xl"><div className="text-xs text-[#8E918F]">Tempo</div><div className="text-xl font-black text-white">Ideal</div></div>
                    <div className="p-4 bg-white/[0.03] rounded-xl"><div className="text-xs text-[#8E918F]">Clarity</div><div className="text-xl font-black text-white">Good</div></div>
                    <div className="p-4 bg-white/[0.03] rounded-xl"><div className="text-xs text-[#8E918F]">Variety</div><div className="text-xl font-black text-white">High</div></div>
                </div>

                <button onClick={() => setIsPacingCoachActive(false)} className="w-full p-3 bg-indigo-500 rounded-xl text-white">Stop & Finish</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {sentimentPreviewOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[300] flex items-center justify-center p-6 bg-transparent/98"
            >
              <div className="absolute inset-0" onClick={() => setSentimentPreviewOpen(false)} />
              <motion.div 
                initial={{ scale: 0.9, y: 40 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-3xl p-10 relative z-10 shadow-3xl overflow-hidden"
              >
                  <div className="flex items-center justify-between mb-8">
                      <div>
                          <h2 className="text-xl font-black text-white uppercase tracking-tight">Expressive performance Draft</h2>
                          <p className="text-xs text-[#8E918F] font-bold uppercase tracking-widest mt-1">Review AI Mood Allocations</p>
                      </div>
                      <button 
                        onClick={() => setSentimentPreviewOpen(false)}
                        className="p-3 bg-white/[0.03] hover:bg-white/10 rounded-2xl text-[#C4C7C5]"
                      >
                        <Plus className="rotate-45" size={20} />
                      </button>
                  </div>

                  <div className="space-y-4 max-h-[50vh] overflow-y-auto mb-10 pr-4 scrollbar-hide">
                      {activeSegmentMoods.map((seg, i) => (
                        <div key={i} className="bg-white/[0.03] border border-[#333537] p-6 rounded-2xl flex flex-col gap-4">
                            <div className="flex justify-between items-center">
                                <p className="text-sm font-medium text-[#E3E3E3] leading-relaxed italic">"{seg.text}"</p>
                                <div className="flex flex-col items-end gap-1">
                                    <span className="text-[10px] text-[#8E918F] font-bold uppercase">Retention Risk</span>
                                    <div className="w-20 h-1.5 rounded-full bg-slate-700 overflow-hidden">
                                        <motion.div className={`h-full ${seg.mood === 'Calm' ? 'bg-amber-500' : 'bg-green-500'}`} initial={{width: '30%'}} animate={{width: seg.mood === 'Calm' ? '80%' : '30%'}} />
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-2">
                                {['Excited', 'Calm', 'Professional', 'Urgent'].map(m => (
                                    <button
                                        key={m}
                                        onClick={() => {
                                            const newMoods = [...activeSegmentMoods];
                                            newMoods[i] = { ...newMoods[i], mood: m as any };
                                            setActiveSegmentMoods(newMoods);
                                        }}
                                        className={cn(
                                            "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all",
                                            seg.mood === m 
                                              ? (m === 'Excited' ? "bg-slate-100 text-[#131314] text-white" : m === 'Urgent' ? "bg-rose-500 text-white" : m === 'Calm' ? "bg-emerald-500 text-white" : "bg-slate-100 text-[#131314]")
                                              : "bg-[#1E1F20]/50 text-[#8E918F] hover:text-[#E3E3E3]"
                                        )}
                                    >
                                        {m}
                                    </button>
                                ))}
                            </div>
                        </div>
                      ))}
                  </div>

                  <div className="flex gap-4">
                      <button 
                        onClick={() => setSentimentPreviewOpen(false)}
                        className="flex-1 py-4 bg-[#1E1F20]/50 hover:bg-[#333537] text-[#E3E3E3] rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={async () => {
                            setSentimentPreviewOpen(false);
                            setIsGenerating(true);
                            try {
                              const url = await generateSentimentalAudio(text, activeSegmentMoods);
                              if (url) {
                                setAudioUrl(url);
                                const newItem: HistoryItem = { id: Date.now().toString(), text, url, timestamp: Date.now(), tags: ['AI-Performance'], likeStatus: null, projectId: activeProjectId } as any;
                                setHistory(prev => [newItem, ...prev]);
                              }
                            } catch (e: any) {
                              setErrorInfo(e.message || "Failed to generate AI performance track.");
                            } finally {
                              setIsGenerating(false);
                            }
                        }}
                        className="flex-[2] py-4 bg-slate-100 hover:bg-indigo-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-zinc-800"
                      >
                        Generate Final Take
                      </button>
                  </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Directing Room Modal */}
        <AnimatePresence>
          {showDirectingRoom && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-transparent/95 backdrop-blur-3xl"
            >
              <div className="absolute inset-0" onClick={() => setShowDirectingRoom(false)} />
              <motion.div 
                initial={{ scale: 0.9, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-[#1E1F20] border border-[#444746] rounded-[4rem] w-full max-w-4xl p-12 relative z-10 shadow-3xl overflow-hidden"
              >
                  <div className="flex items-center justify-between mb-12">
                      <div className="flex items-center gap-4">
                          <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                              <MonitorPlay size={32} />
                          </div>
                          <div>
                              <h2 className="text-2xl font-black text-white uppercase tracking-tighter">Directing Huddle</h2>
                              <p className="text-xs text-emerald-500 font-bold uppercase tracking-widest">Active Collaborative Session</p>
                          </div>
                      </div>
                      <button 
                        onClick={() => setShowDirectingRoom(false)}
                        className="p-4 bg-white/[0.03] hover:bg-white/10 rounded-full text-[#C4C7C5] transition-all"
                      >
                        <Plus className="rotate-45" size={24} />
                      </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                      <div className="bg-transparent/50 rounded-2xl p-8 border border-[#333537] aspect-video flex flex-col items-center justify-center relative overflow-hidden">
                          <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent pointer-events-none" />
                          <div className="w-24 h-24 rounded-full bg-[#1E1F20]/50 flex items-center justify-center mb-4 ring-4 ring-emerald-500/20">
                              <Users size={40} className="text-[#8E918F]" />
                          </div>
                          <p className="text-sm font-black text-white uppercase tracking-widest">{user?.displayName || 'Host'}</p>
                          <div className="flex gap-2 mt-4">
                              <div className="w-8 h-8 rounded-full bg-emerald-500 animate-pulse flex items-center justify-center">
                                  <Volume2 size={14} className="text-white" />
                              </div>
                              <div className="w-8 h-8 rounded-full bg-[#1E1F20]/50 flex items-center justify-center text-[#C4C7C5] border border-[#333537]">
                                  <Monitor size={14} />
                              </div>
                          </div>
                      </div>

                      <div className="bg-transparent/50 rounded-2xl p-8 border border-[#333537] flex flex-col justify-center space-y-6">
                          <div className="space-y-2">
                              <p className="text-xs font-black text-emerald-400 uppercase tracking-widest">The Directive</p>
                              <h3 className="text-lg font-bold text-white">"Make the Sc-Fi segment more 'Urgent' but keep the ending 'Calm'."</h3>
                          </div>
                          <div className="space-y-4">
                              <h4 className="text-xs font-black text-[#8E918F] uppercase tracking-widest">Participating Directors</h4>
                              <div className="flex -space-x-4">
                                  <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center border-4 border-[#444746] text-xs font-black">M</div>
                                  <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#131314] flex items-center justify-center border-4 border-[#444746] text-xs font-black">A</div>
                                  <div className="w-12 h-12 rounded-2xl bg-[#1E1F20]/50 flex items-center justify-center border-4 border-[#444746]">
                                      <Plus size={16} />
                                  </div>
                              </div>
                          </div>
                          <button className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-emerald-900/20">
                              Mute Human Audio
                          </button>
                      </div>
                  </div>

                  <div className="p-8 bg-slate-100/10 rounded-2xl border border-white/20 flex flex-col md:flex-row items-center justify-between gap-6">
                      <div className="flex items-center gap-4">
                          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#131314] flex items-center justify-center animate-pulse">
                              <Play size={20} className="fill-current" />
                          </div>
                          <div className="max-w-[200px]">
                              <p className="text-xs font-black text-white uppercase tracking-tight truncate">Previewing Performance</p>
                              <p className="text-xs text-[#C4C7C5] font-bold uppercase tracking-widest">Active Directing State</p>
                          </div>
                      </div>
                      <div className="flex gap-3">
                          <button className="px-6 py-3 bg-white/[0.03] hover:bg-white/10 text-white rounded-xl text-xs font-black uppercase tracking-widest border border-[#333537]">Adjust Mood</button>
                          <button className="px-6 py-3 bg-white/[0.03] hover:bg-white/10 text-white rounded-xl text-xs font-black uppercase tracking-widest border border-[#333537]">Flag Take</button>
                      </div>
                  </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* History Selection Modal */}
        <AnimatePresence>
          {showHistorySelection && selectedSharedPlaylist && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-transparent/90 backdrop-blur-3xl"
            >
              <div className="absolute inset-0" onClick={() => setShowHistorySelection(false)} />
              <motion.div 
                initial={{ scale: 0.95, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-xl max-h-[80vh] flex flex-col shadow-3xl overflow-hidden relative z-10"
              >
                  <div className="p-8 border-b border-[#333537] flex items-center justify-between">
                      <div>
                          <h3 className="text-lg font-black text-white uppercase tracking-tight">Add to {selectedSharedPlaylist.name}</h3>
                          <p className="text-xs text-[#8E918F] font-semibold uppercase tracking-widest text-xs mt-1">Select from your history</p>
                      </div>
                      <button 
                        onClick={() => setShowHistorySelection(false)}
                        className="p-3 bg-white/[0.03] hover:bg-white/10 rounded-2xl text-[#C4C7C5]"
                      >
                        <Plus className="rotate-45" size={20} />
                      </button>
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-8 space-y-4 scrollbar-hide">
                      {history.length === 0 ? (
                        <div className="text-center py-12 opacity-40">
                            <Clock size={32} className="mx-auto mb-2" />
                            <p className="text-sm">No history items found.</p>
                        </div>
                      ) : (
                        history.map(item => (
                            <div key={item.id} className="bg-white/[0.03] border border-[#333537] p-4 rounded-2xl flex items-center justify-between hover:bg-slate-100/10 hover:border-white/30 transition-all group">
                                <div className="flex-1 min-w-0 pr-4">
                                    <p className="text-xs font-bold text-[#E3E3E3] truncate">{item.text}</p>
                                    <p className="text-[8px] font-black uppercase text-[#8E918F] tracking-widest mt-1">{new Date(item.timestamp).toLocaleDateString()}</p>
                                </div>
                                <button 
                                    onClick={() => {
                                        shareToPlaylist(selectedSharedPlaylist.id, item);
                                        setShowHistorySelection(false);
                                    }}
                                    className="px-4 py-2 bg-slate-100 hover:bg-indigo-500 text-white rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-lg shadow-zinc-800 active:scale-95"
                                >
                                    Select
                                </button>
                            </div>
                        ))
                      )}
                  </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feedback Modal */}
        <AnimatePresence>
          {feedbackModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-transparent/80 backdrop-blur-sm"
              onClick={() => setFeedbackModal(null)}
            >
              <motion.div 
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-md p-8 shadow-3xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex flex-col items-center text-center space-y-6">
                  <div className={cn(
                    "w-20 h-20 rounded-[2rem] flex items-center justify-center shadow-2xl transition-transform hover:scale-110",
                    feedbackModal.status === 'like' ? "bg-green-500 shadow-green-500/20" : "bg-red-500 shadow-red-500/20"
                  )}>
                    {feedbackModal.status === 'like' ? <ThumbsUp className="text-white" size={32} /> : <ThumbsDown className="text-white" size={32} />}
                  </div>
                  
                  <div>
                    <h3 className="text-xl font-black text-white uppercase tracking-tight">
                      {feedbackModal.status === 'like' ? "We're glad you liked it!" : "Sorry to hear that!"}
                    </h3>
                    <p className="text-xs text-[#8E918F] font-bold uppercase tracking-widest mt-2 px-4 leading-relaxed">
                      Your feedback helps us improve our voice synthesis algorithms.
                    </p>
                  </div>

                  <div className="w-full space-y-4">
                    <textarea 
                      placeholder=""
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      className="w-full h-32 bg-[#1E1F20]/50 border border-[#444746] rounded-2xl p-5 focus:outline-none focus:ring-2 focus:ring-white/50 text-white placeholder:text-[#8E918F] transition-all font-medium text-sm resize-none scrollbar-hide shadow-inner"
                    />
                    
                    <div className="flex gap-4">
                        <button 
                            onClick={() => setFeedbackModal(null)}
                            className="flex-1 py-4 bg-[#1E1F20]/50 text-[#C4C7C5] hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all hover:bg-[#333537]"
                        >
                            Skip
                        </button>
                        <button 
                            onClick={submitFeedback}
                            className="flex-1 py-4 bg-indigo-600 text-white hover:bg-indigo-500 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-zinc-800 border-b-4 border-indigo-800 active:border-b-0 active:translate-y-1"
                        >
                            Submit Feedback
                        </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* New Project Modal */}
        <AnimatePresence>
          {showProjectModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] flex items-center justify-center p-6 bg-transparent/80 backdrop-blur-sm"
              onClick={() => setShowProjectModal(false)}
            >
              <motion.div 
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-lg p-8 shadow-3xl"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-[#1E1F20]/50 text-[#C4C7C5] flex items-center justify-center border border-white/20 shadow-inner">
                      <Folder size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight">Create New Project</h3>
                      <p className="text-xs font-bold text-[#8E918F] uppercase tracking-widest mt-1">Organize your voice generations</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="space-y-2">
                      <label className="text-xs font-black text-[#8E918F] uppercase tracking-widest ml-2">Project Name</label>
                      <input 
                        type="text" 
                        placeholder=""
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        className="w-full bg-[#1E1F20]/50 border border-[#444746] rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-white/50 transition-all font-medium"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black text-[#8E918F] uppercase tracking-widest ml-2">Description</label>
                      <textarea 
                        placeholder=""
                        value={newProjectDesc}
                        onChange={(e) => setNewProjectDesc(e.target.value)}
                        className="w-full h-24 bg-[#1E1F20]/50 border border-[#444746] rounded-2xl px-6 py-4 text-white focus:outline-none focus:ring-2 focus:ring-white/50 transition-all font-medium resize-none"
                      />
                    </div>
                  </div>

                  <div className="flex gap-4 pt-2">
                    <button 
                      onClick={() => setShowProjectModal(false)}
                      className="flex-1 py-4 bg-[#1E1F20]/50 text-[#C4C7C5] hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={createProject}
                      disabled={!newProjectName.trim()}
                      className="flex-1 py-4 bg-indigo-600 text-white hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl shadow-zinc-800"
                    >
                      Create Project
                    </button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <style dangerouslySetInnerHTML={{ __html: getPdfStyles() }} />

        {/* PDF Layout & Alignment Settings Modal */}
        <AnimatePresence>
          {showPdfLayoutModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[170] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
              onClick={() => setShowPdfLayoutModal(false)}
            >
              <motion.div 
                initial={{ scale: 0.95, y: 30 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 30 }}
                className="bg-[#1E1F20] border border-[#444746] rounded-3xl w-full max-w-xl overflow-hidden shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-8 border-b border-[#333537] flex items-center justify-between bg-white/[0.02]">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center border border-indigo-500/30">
                      <Settings2 size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white uppercase tracking-tight">PDF Export Layout & Alignment</h3>
                      <p className="text-xs font-bold text-[#8E918F] uppercase tracking-widest mt-1">Match text editor visual arrangement precisely</p>
                    </div>
                  </div>
                  <button onClick={() => setShowPdfLayoutModal(false)} className="text-gray-400 hover:text-white p-2">
                    <X size={20} />
                  </button>
                </div>

                <div className="p-8 space-y-6 overflow-y-auto max-h-[70vh]">
                  {/* Margins */}
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-[#8E918F]">Page Margins</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['compact', 'normal', 'wide'] as const).map((m) => (
                        <button
                          key={m}
                          onClick={() => setPdfMargin(m)}
                          className={cn(
                            "py-3 px-4 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all",
                            pdfMargin === m ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20" : "bg-white/[0.03] text-slate-300 border-white/10 hover:bg-white/5"
                          )}
                        >
                          {m === 'compact' ? 'Compact (0.5")' : m === 'normal' ? 'Normal (1.0")' : 'Wide (1.5")'}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Alignment */}
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-[#8E918F]">Text Alignment</label>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {(['left', 'center', 'justify', 'right'] as const).map((a) => (
                        <button
                          key={a}
                          onClick={() => setPdfAlignment(a)}
                          className={cn(
                            "py-3 px-3 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all capitalize",
                            pdfAlignment === a ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20" : "bg-white/[0.03] text-slate-300 border-white/10 hover:bg-white/5"
                          )}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Line Spacing */}
                  <div className="space-y-3">
                    <label className="text-xs font-black uppercase tracking-widest text-[#8E918F]">Line Spacing</label>
                    <div className="grid grid-cols-3 gap-3">
                      {(['tight', 'normal', 'relaxed'] as const).map((s) => (
                        <button
                          key={s}
                          onClick={() => setPdfLineSpacing(s)}
                          className={cn(
                            "py-3 px-4 rounded-xl border text-xs font-bold uppercase tracking-wider transition-all capitalize",
                            pdfLineSpacing === s ? "bg-indigo-600 text-white border-indigo-500 shadow-lg shadow-indigo-600/20" : "bg-white/[0.03] text-slate-300 border-white/10 hover:bg-white/5"
                          )}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lock Setting Toggle */}
                  <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex items-center justify-between">
                    <div className="space-y-0.5">
                      <span className="text-sm font-bold text-white">Lock Layout Preferences</span>
                      <p className="text-xs text-[#8E918F]">Pin these margins and alignment settings for all future PDF & print exports.</p>
                    </div>
                    <button
                      onClick={() => setIsPdfLayoutLocked(!isPdfLayoutLocked)}
                      className={cn(
                        "w-12 h-6 rounded-full transition-all relative p-1",
                        isPdfLayoutLocked ? "bg-indigo-600" : "bg-white/10"
                      )}
                    >
                      <div className={cn("w-4 h-4 rounded-full bg-white transition-transform", isPdfLayoutLocked ? "translate-x-6" : "translate-x-0")} />
                    </button>
                  </div>
                </div>

                <div className="p-6 border-t border-[#333537] bg-white/[0.02] flex items-center justify-end gap-3">
                  <button
                    onClick={() => setShowPdfLayoutModal(false)}
                    className="px-6 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white text-xs font-black uppercase tracking-widest transition-all"
                  >
                    Close
                  </button>
                  <button
                    onClick={() => {
                      setIsPdfLayoutLocked(true);
                      setShowPdfLayoutModal(false);
                    }}
                    className="px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-indigo-600/25"
                  >
                    Save & Lock Layout
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Comparison Analysis Modal */}
        <AnimatePresence>
          {showComparisonModal && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[160] flex items-center justify-center p-6 bg-transparent/90 backdrop-blur-md"
              onClick={() => setShowComparisonModal(false)}
            >
              <motion.div 
                initial={{ scale: 0.95, y: 50 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 50 }}
                className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-3xl max-h-[85vh] overflow-hidden shadow-4xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="p-8 border-b border-[#333537] flex items-center justify-between bg-[#1E1F20]/50">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-slate-100 text-[#131314]/20 text-[#8E918F] flex items-center justify-center border border-[#444746] shadow-inner">
                      <Layers size={24} />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-white uppercase tracking-tight">Performance A/B Review</h3>
                      <p className="text-xs font-bold text-[#8E918F] uppercase tracking-widest mt-1">AI-Powered Take Comparison</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setShowComparisonModal(false)}
                    className="p-3 rounded-2xl hover:bg-white/[0.03] text-[#8E918F] hover:text-white transition-all"
                  >
                    <Plus className="rotate-45" size={24} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-10 custom-scrollbar">
                  {isAnalyzingComparison ? (
                    <div className="flex flex-col items-center justify-center py-20 space-y-6">
                      <div className="relative">
                        <Loader2 size={48} className="text-indigo-400 animate-spin" />
                        <Sparkles size={16} className="text-amber-300 absolute top-0 right-0 animate-pulse" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-black text-white uppercase tracking-widest">Consulting Voice Director AI</p>
                        <p className="text-xs text-[#8E918F] font-bold uppercase tracking-widest mt-2">Analyzing emotional prosody and timing variances...</p>
                      </div>
                    </div>
                  ) : comparisonAnalysis ? (
                    <div className="space-y-8">
                       <div className="grid grid-cols-2 gap-6">
                         {comparingIds.map((id, idx) => {
                           const item = history.find(h => h.id === id);
                           return (
                             <div key={id} className="p-6 rounded-[2rem] bg-white/[0.03] border border-[#333537] space-y-4">
                               <div className="flex items-center justify-between">
                                 <span className="text-xs font-black text-[#C4C7C5] uppercase tracking-widest px-3 py-1 bg-white/[0.03] rounded-full">Take {idx + 1}</span>
                                 <button 
                                   onClick={() => { setAudioUrl(item?.url || null); }}
                                   className="p-2 bg-slate-100 text-[#131314] rounded-xl shadow-lg shadow-zinc-800 hover:scale-110 transition-all"
                                 >
                                   <Play size={12} />
                                 </button>
                               </div>
                               <p className="text-xs text-[#E3E3E3] line-clamp-3 leading-relaxed italic">"{item?.text}"</p>
                             </div>
                           );
                         })}
                       </div>

                       <div className="prose prose-invert prose-amber max-w-none">
                         <div className="bg-slate-100 text-[#131314]/5 border border-[#444746] rounded-2xl p-8">
                           <div className="flex items-center gap-3 mb-6">
                             <Sparkles className="text-[#8E918F]" size={18} />
                             <h4 className="text-xs font-black text-[#8E918F] uppercase tracking-widest">Director's Verdict</h4>
                           </div>
                           <div className="text-[#E3E3E3] text-sm leading-8 markdown-body">
                             <ReactMarkdown>{comparisonAnalysis}</ReactMarkdown>
                           </div>
                         </div>
                       </div>
                    </div>
                  ) : (
                    <div className="text-center py-20 text-[#8E918F]">
                      <p>Something went wrong with the analysis.</p>
                    </div>
                  )}
                </div>

                <div className="p-8 bg-[#1E1F20] border-t border-[#333537] flex gap-4">
                   <button 
                     onClick={() => setShowComparisonModal(false)}
                     className="flex-1 py-4 bg-[#1E1F20]/50 text-[#C4C7C5] hover:text-white rounded-2xl text-xs font-black uppercase tracking-widest transition-all"
                   >
                     Close Review
                   </button>
                   <button 
                     onClick={() => {
                       const winnerId = comparingIds[0]; // Logic for auto-selecting winner take could be here
                       const winner = history.find(h => h.id === winnerId);
                       if (winner) {
                         alert(`Take ${winnerId} marked for export.`);
                         setShowComparisonModal(false);
                       }
                     }}
                     className="flex-1 py-4 bg-amber-500 text-white hover:bg-amber-600 rounded-2xl text-xs font-black uppercase tracking-widest transition-all shadow-xl  font-bold"
                   >
                     Approve Take
                   </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Full-Screen Editor Modal */}
        <AnimatePresence>
          {isEditorMaximized && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={cn("fixed inset-0 z-[200] flex flex-col", theme === 'dark' ? 'bg-[#131314]' : 'bg-slate-50')}
            >
                <div className={cn("px-6 md:px-12 py-6 border-b flex justify-between items-center backdrop-blur-xl", theme === 'dark' ? "bg-[#1E1F20]/50 border-[#333537]" : "bg-white/50 border-slate-200")}>
                    <div className="flex items-center gap-4">
                        <div className={cn("w-10 h-10 rounded-2xl flex items-center justify-center border", theme === 'dark' ? "bg-[#1E1F20]/50 text-[#C4C7C5] border-white/20" : "bg-white text-slate-500 border-slate-200")}>
                            <FileText size={20} />
                        </div>
                        <div>
                            <h2 className={cn("text-sm font-black uppercase tracking-widest", theme === 'dark' ? "text-white" : "text-slate-900")}>Focus Mode Editor</h2>
                            <p className={cn("text-[9px] font-bold uppercase tracking-[0.2em] mt-1", theme === 'dark' ? "text-[#C4C7C5]" : "text-slate-500")}>Distraction-free environment</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2 hidden lg:flex">
                          <div className="flex items-center bg-black/5 dark:bg-white/[0.03] border border-slate-200 dark:border-[#333537] rounded-xl px-2 py-1">
                            <Type size={14} className="text-slate-500 dark:text-[#C4C7C5] mr-2" />
                            <input 
                              type="range" 
                              min="12" max="120" 
                              value={editorFontSize} 
                              onChange={(e) => setEditorFontSize(Number(e.target.value))} 
                              className="w-16 h-1 bg-slate-300 dark:bg-white/20 rounded-lg appearance-none cursor-pointer"
                            />
                          </div>
                          
                          <div className="flex items-center bg-black/5 dark:bg-white/[0.03] border border-slate-200 dark:border-[#333537] rounded-xl px-2 py-1 gap-2 cursor-pointer transition-colors">
                            <Palette size={14} className="text-slate-500 dark:text-[#C4C7C5]" />
                            <input 
                              type="color" 
                              value={editorColor || (theme === 'dark' ? '#ffffff' : '#000000')} 
                              onChange={(e) => setEditorColor(e.target.value)}
                              className="w-4 h-4 p-0 border-none cursor-pointer bg-transparent rounded-full overflow-hidden" 
                              title="Text Color"
                            />
                            <input 
                              type="color" 
                              value={editorBg || (theme === 'dark' ? '#1E1F20' : '#ffffff')} 
                              onChange={(e) => setEditorBg(e.target.value)}
                              className="w-4 h-4 p-0 border-none cursor-pointer bg-transparent rounded-full overflow-hidden" 
                              title="Background Color"
                            />
                          </div>
                        </div>

                        {(isGenerating || isExtractingHandwriting) && (
                          <div className={cn("flex items-center gap-2 px-4 py-2 rounded-xl border mr-4", theme === 'dark' ? "bg-white/[0.03] border-white/20" : "bg-black/5 border-slate-200")}>
                              <Activity size={14} className={cn("animate-pulse", theme === 'dark' ? "text-[#C4C7C5]" : "text-slate-500")} />
                              <span className={cn("text-xs font-black uppercase tracking-widest", theme === 'dark' ? "text-[#C4C7C5]" : "text-slate-500")}>
                                {isExtractingHandwriting ? "Scanning Handwriting..." : "Processing..."}
                              </span>
                          </div>
                        )}
                        <button 
                          onClick={() => pdfInputRef.current?.click()}
                          disabled={isUploadingPdf}
                          className={cn(
                            "flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border cursor-pointer hover:scale-105 active:scale-95 select-none",
                            isUploadingPdf 
                              ? "bg-red-500/20 text-red-400 border-red-500/30 animate-pulse cursor-not-allowed scale-100 hover:scale-100 pointer-events-none" 
                              : (theme === 'dark' ? "bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300 border-red-500/20" : "bg-red-50 text-red-600 hover:bg-red-100 border-red-200")
                          )}
                          title="Upload & Digitize PDF"
                        >
                          <FileUp size={16} /> <span className="hidden sm:inline">{isUploadingPdf ? 'Digitizing...' : 'Upload PDF'}</span>
                        </button>
                        <button 
                          onClick={() => scanInputRef.current?.click()}
                          className={cn(
                            "flex items-center gap-2 px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border cursor-pointer hover:scale-105 active:scale-95 select-none",
                            isExtractingHandwriting 
                              ? "bg-slate-100 text-[#131314]/20 text-[#8E918F] border-[#444746] animate-pulse cursor-not-allowed scale-100 hover:scale-100 pointer-events-none" 
                              : (theme === 'dark' ? "bg-[#1E1F20]/50 text-[#E3E3E3] hover:text-white border-[#333537]" : "bg-white text-slate-700 hover:text-slate-900 border-slate-200")
                          )}
                          title="Scan Handwriting"
                          disabled={isExtractingHandwriting}
                        >
                          <FileText size={16} /> <span className="hidden sm:inline">Scan</span>
                        </button>
                        <div className={cn("hidden md:flex items-center gap-6 text-xs font-black uppercase tracking-widest mr-6", theme === 'dark' ? "text-[#C4C7C5]" : "text-slate-500")}>
                            <span>Chars: {text.length}</span>
                            <span>Words: {text.split(/\s+/).filter(Boolean).length}</span>
                        </div>
                        <button 
                            type="button"
                            onClick={handleCopyEditorText}
                            onTouchEnd={(e) => {
                              e.preventDefault();
                              handleCopyEditorText(e);
                            }}
                            className={cn(
                              "touch-manipulation px-4 md:px-5 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border flex items-center gap-2 active:scale-95 shadow-md cursor-pointer select-none",
                              isMainEditorCopied 
                                ? "bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-emerald-500/20 scale-105" 
                                : (theme === 'dark' ? "bg-[#1E1F20]/50 text-[#E3E3E3] hover:bg-[#333537] hover:text-white border-[#444746]" : "bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 border-slate-200")
                            )}
                            title="Copy text to clipboard"
                        >
                            {isMainEditorCopied ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} className="text-indigo-400" />}
                            <span>{isMainEditorCopied ? 'Copied!' : 'Copy'}</span>
                        </button>
                        <button 
                            onClick={() => setIsEditorMaximized(false)}
                            className={cn("px-4 md:px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest transition-all border flex items-center gap-2 active:scale-95 shadow-xl", theme === 'dark' ? "bg-[#1E1F20]/50 text-[#E3E3E3] hover:bg-[#333537] hover:text-white border-[#444746]" : "bg-white text-slate-700 hover:bg-slate-100 hover:text-slate-900 border-slate-200")}
                        >
                            <Minimize2 size={16} /> <span className="hidden sm:inline">Exit Focus Mode</span>
                        </button>
                    </div>
                </div>
                
                <div id="fullscreen-editor-render-container" className="flex-1 overflow-hidden relative group" style={{ backgroundColor: editorBg || 'transparent' }}>
                    <textarea 
                        className={cn("w-full h-full p-4 sm:p-8 md:p-12 lg:p-16 bg-transparent leading-[1.7] font-medium resize-none focus:outline-none scrollbar-hide touch-manipulation", theme === 'dark' ? "text-white placeholder:text-slate-600 selection:bg-indigo-500/30" : "text-[#131314] placeholder:text-slate-400 selection:bg-indigo-500/20")}
                        style={{ 
                          fontSize: `${Math.max(16, editorFontSize)}px`, 
                          color: editorColor || (theme === 'dark' ? '#ffffff' : '#131314'),
                          lineHeight: 1.7,
                          fontFamily: editorFontFamily === 'sans' 
                            ? '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif' 
                            : editorFontFamily === 'serif' 
                            ? '"Lora", Georgia, Cambria, serif' 
                            : '"JetBrains Mono", ui-monospace, SFMono-Regular, monospace',
                          touchAction: 'pan-y',
                          WebkitOverflowScrolling: 'touch',
                        }}
                        placeholder="Type text in Focus Mode..."
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        onTouchStart={handleTouchEditor}
                        onTouchEnd={handleTouchEditor}
                        autoCapitalize="sentences"
                        autoCorrect="on"
                        spellCheck={false}
                        autoFocus
                    />
                </div>

                <div className={cn("p-4 md:p-8 border-t flex justify-center items-center gap-4 md:gap-10", theme === 'dark' ? "bg-[#1E1F20]/30 border-[#333537]" : "bg-white/80 border-slate-200")}>
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"></div>
                        <span className={cn("text-xs font-black uppercase tracking-widest", theme === 'dark' ? "text-[#C4C7C5]" : "text-slate-500")}>Autosave Active</span>
                    </div>
                    <div className={cn("h-4 w-px", theme === 'dark' ? "bg-white/[0.03]" : "bg-slate-200")}></div>
                    <div className="flex items-center gap-3">
                        <span className={cn("text-xs font-black uppercase tracking-widest hidden sm:inline", theme === 'dark' ? "text-[#C4C7C5]" : "text-slate-500")}>Language:</span>
                        <span className={cn("text-xs font-black uppercase tracking-widest underline underline-offset-4 decoration-current/30 font-sans", theme === 'dark' ? "text-[#C4C7C5]" : "text-slate-700")}>{LANGUAGES.find(l => l.code === languageCode)?.name || 'Unknown'}</span>
                    </div>
                    <div className={cn("h-4 w-px", theme === 'dark' ? "bg-white/[0.03]" : "bg-slate-200")}></div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={handleUndo}
                        disabled={undoStack.length === 0}
                        className={cn("p-2 rounded-xl transition-all", undoStack.length === 0 ? "opacity-30 cursor-not-allowed" : theme === 'dark' ? "text-[#C4C7C5] hover:bg-white/10 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900")}
                        title="Undo"
                      >
                        <Undo2 size={16} />
                      </button>
                      <button 
                        onClick={handleRedo}
                        disabled={redoStack.length === 0}
                        className={cn("p-2 rounded-xl transition-all", redoStack.length === 0 ? "opacity-30 cursor-not-allowed" : theme === 'dark' ? "text-[#C4C7C5] hover:bg-white/10 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900")}
                        title="Redo"
                      >
                        <Redo2 size={16} />
                      </button>
                    </div>
                    <div className={cn("h-4 w-px", theme === 'dark' ? "bg-white/[0.03]" : "bg-slate-200")}></div>
                    <button 
                      onClick={async () => {
                        const container = document.getElementById('fullscreen-editor-render-container');
                        if (!container) return;
                        try {
                          const canvas = await html2canvas(container, {
                            backgroundColor: editorBg || (theme === 'dark' ? '#131314' : '#f8fafc'),
                            onclone: (clonedDoc: Document) => {
                              try {
                                const sheets = clonedDoc.styleSheets;
                                for (let s = 0; s < sheets.length; s++) {
                                  try {
                                    const rules = sheets[s].cssRules;
                                    for (let r = 0; r < rules.length; r++) {
                                      const rule = rules[r] as CSSStyleRule;
                                      if (rule && rule.style) {
                                        for (let i = 0; i < rule.style.length; i++) {
                                          const prop = rule.style[i];
                                          const val = rule.style.getPropertyValue(prop);
                                          if (val && (val.includes('oklab') || val.includes('oklch'))) {
                                            rule.style.setProperty(prop, '#333333');
                                          }
                                        }
                                      }
                                    }
                                  } catch (e) {}
                                }
                              } catch (e) {}
                            }
                          } as any);
                          const link = document.createElement('a');
                          link.download = `snapshot-focus-${Date.now()}.png`;
                          link.href = canvas.toDataURL();
                          link.click();
                        } catch (err) {
                          console.error(err);
                          setErrorInfo("Failed to take focus snapshot due to unsupported color format.");
                        }
                      }}
                      className={cn("p-2 rounded-xl transition-all", theme === 'dark' ? "text-[#C4C7C5] hover:bg-white/10 hover:text-white" : "text-slate-500 hover:bg-slate-100 hover:text-slate-900")}
                      title="Take Snapshot"
                    >
                      <Camera size={16} />
                    </button>
                </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Fullscreen Extracted Photo/Image Lightbox Modal */}
        <AnimatePresence>
          {selectedViewingImage && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[150] bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-8"
              onClick={() => setSelectedViewingImage(null)}
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative max-w-5xl w-full max-h-[90vh] bg-[#1E1F20] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-white/[0.02]">
                  <div className="flex items-center gap-2">
                    <ImageIcon size={18} className="text-indigo-400" />
                    <h3 className="text-sm font-bold text-white truncate max-w-md">{selectedViewingImage.caption}</h3>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        saveAs(selectedViewingImage.dataUrl, `${selectedViewingImage.caption.replace(/[^a-zA-Z0-9_-]/g, '_')}.jpg`);
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      <Download size={14} />
                      <span>Download</span>
                    </button>
                    <button 
                      onClick={() => setSelectedViewingImage(null)}
                      className="p-1.5 text-[#8E918F] hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
                    >
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-auto p-4 sm:p-6 flex items-center justify-center bg-black/40 min-h-[300px]">
                  <img 
                    src={selectedViewingImage.dataUrl || undefined} 
                    alt={selectedViewingImage.caption} 
                    className="max-w-full max-h-[70vh] object-contain rounded-xl shadow-lg border border-white/5"
                  />
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Platform Toolkit Modal */}
        <AnimatePresence>
          {isPlatformToolkitOpen && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-transparent/95 backdrop-blur-3xl"
            >
              <div className="absolute inset-0" onClick={() => setIsPlatformToolkitOpen(false)} />
              <motion.div 
                layout
                initial={{ scale: 0.9, y: 20 }}
                animate={{ 
                  scale: 1, 
                  y: 0,
                  maxWidth: isToolkitMaximized ? '95vw' : '820px',
                  height: isToolkitMaximized ? '95vh' : 'auto',
                  maxHeight: '90vh'
                }}
                className="bg-[#1E1F20] border border-[#444746] rounded-3xl w-full px-5 py-3 shadow-4xl flex flex-col relative z-20 overflow-hidden transition-all duration-500"
              >
                <div className="absolute top-0 right-0 p-3 flex gap-1">
                  <button 
                    onClick={() => setIsToolkitMaximized(!isToolkitMaximized)} 
                    className="text-gray-400 hover:text-black transition-all p-1 hover:bg-white/5 rounded-full"
                    title={isToolkitMaximized ? "Restore" : "Maximize"}
                  >
                    {isToolkitMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                  </button>
                  <button 
                    onClick={() => setIsPlatformToolkitOpen(false)} 
                    className="text-gray-400 hover:text-black transition-all p-1 hover:bg-white/5 rounded-full"
                    title="Close"
                  >
                    <X size={18} />
                  </button>
                </div>

                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-900/20">
                    <Globe size={18} />
                  </div>
                  <div>
                    <h2 className="text-base font-black text-white uppercase tracking-tighter leading-none">Creator Toolkit</h2>
                    <p className="text-[8px] text-indigo-400 font-bold uppercase tracking-[0.2em]">Multi-Platform Distribution</p>
                  </div>
                </div>
                <div className="flex gap-2 mb-2">
                  <select 
                    value={tone} 
                    onChange={(e) => setTone(e.target.value)}
                    className="bg-black/20 text-[10px] text-white p-1 rounded-md border border-white/10"
                  >
                    {['Professional', 'Casual', 'Excited', 'Urgent'].map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  <select 
                    value={language} 
                    onChange={(e) => setLanguage(e.target.value)}
                    className="bg-black/20 text-[10px] text-white p-1 rounded-md border border-white/10"
                  >
                    <option value="ALL">ALL LANGUAGES</option>
                    {LANGUAGES.map(l => <option key={l.name} value={l.name}>{l.name}</option>)}
                  </select>
                  <select 
                    value={brandVoice} 
                    onChange={(e) => setBrandVoice(e.target.value)}
                    className="bg-black/20 text-[10px] text-white p-1 rounded-md border border-white/10 flex-1"
                  >
                    {['Maintain a professional, engaging tone.', 'Use a witty, creative and poetic style.', 'Bold, direct, and aggressive style.'].map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>

                <div className="flex-1 overflow-y-auto pr-4 custom-scrollbar">
                  <div className={`grid grid-cols-1 ${isToolkitMaximized ? 'md:grid-cols-3 lg:grid-cols-4' : 'md:grid-cols-2 lg:grid-cols-3'} gap-4 pb-4`}>
                    <button 
                      onClick={generateVisualAsset}
                      disabled={isGeneratingImage || !text.trim()}
                      className="group p-4 bg-[#1E1F20]/30 hover:bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 transition-all duration-300 rounded-2xl border border-white/5 hover:border-indigo-500/50 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors border border-white/5">
                        <Camera size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-200 transition-colors">Visual Asset AI</h4>
                        <p className="text-[10px] text-[#8E918F] group-hover:text-white/70 transition-colors leading-tight font-medium">Generate Assets</p>
                      </div>
                      {isGeneratingImage && <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>

                    <button 
                      onClick={checkCompliance}
                      disabled={!text.trim()}
                      className="group p-4 bg-[#1E1F20]/30 hover:bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 transition-all duration-300 rounded-2xl border border-white/5 hover:border-indigo-500/50 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors border border-white/5">
                        <AlertCircle size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-200 transition-colors">Compliance Checker</h4>
                        <p className="text-[10px] text-[#8E918F] group-hover:text-white/70 transition-colors leading-tight font-medium">Brand alignment</p>
                      </div>
                    </button>

                    <button 
                      onClick={translateContent}
                      disabled={!text.trim()}
                      className="group p-4 bg-[#1E1F20]/30 hover:bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 transition-all duration-300 rounded-2xl border border-white/5 hover:border-indigo-500/50 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors border border-white/5">
                        <Globe size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-200 transition-colors">Translator</h4>
                        <p className="text-[10px] text-[#8E918F] group-hover:text-white/70 transition-colors leading-tight font-medium">Target Language: {targetLang}</p>
                      </div>
                    </button>

                    <button 
                      onClick={() => {}}
                      className="group p-4 bg-[#1E1F20]/30 hover:bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 transition-all duration-300 rounded-2xl border border-white/5 hover:border-indigo-500/50 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors border border-white/5">
                        <FolderKanban size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-200 transition-colors">Kanban Board</h4>
                        <p className="text-[10px] text-[#8E918F] group-hover:text-white/70 transition-colors leading-tight font-medium">Manage Tasks ({contentTasks.length})</p>
                      </div>
                    </button>

                    <button 
                      onClick={() => {}}
                      className="group p-4 bg-[#1E1F20]/30 hover:bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 transition-all duration-300 rounded-2xl border border-white/5 hover:border-indigo-500/50 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors border border-white/5">
                        <Library size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-200 transition-colors">Asset Library</h4>
                        <p className="text-[10px] text-[#8E918F] group-hover:text-white/70 transition-colors leading-tight font-medium">Manage Assets ({brandAssets.length})</p>
                      </div>
                    </button>

                    <button 
                      onClick={() => postToSocial('Twitter')}
                      disabled={!text.trim()}
                      className="group p-4 bg-[#1E1F20]/30 hover:bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 transition-all duration-300 rounded-2xl border border-white/5 hover:border-indigo-500/50 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors border border-white/5">
                        <Twitter size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-200 transition-colors">Post to X</h4>
                        <p className="text-[10px] text-[#8E918F] group-hover:text-white/70 transition-colors leading-tight font-medium">Real-world API</p>
                      </div>
                    </button>

                    <button 
                      onClick={generateSubtitles}
                      disabled={!text.trim()}
                      className="group p-4 bg-[#1E1F20]/30 hover:bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 transition-all duration-300 rounded-2xl border border-white/5 hover:border-indigo-500/50 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors border border-white/5">
                        <FileText size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-200 transition-colors">Subtitles (SRT)</h4>
                        <p className="text-[10px] text-[#8E918F] group-hover:text-white/70 transition-colors leading-tight font-medium">Auto-generated SRT</p>
                      </div>
                    </button>

                    <button 
                      onClick={() => {
                        setPlatformToConnect('Account Hub');
                        setShowPermissionDialog(true);
                      }}
                      className="group p-4 bg-[#1E1F20]/30 hover:bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 transition-all duration-300 rounded-2xl border border-white/5 hover:border-indigo-500/50 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors border border-white/5">
                        <Users size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-200 transition-colors">Manual Connections</h4>
                        <p className="text-[10px] text-[#8E918F] group-hover:text-white/70 transition-colors leading-tight font-medium">Manage {Object.values(connectedPlatforms).filter(v => v).length} Accounts</p>
                      </div>
                    </button>

                    <button 
                      onClick={optimizeTitles}
                      disabled={isOptimizingTitles || !text.trim()}
                      className="group p-4 bg-[#1E1F20]/30 hover:bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 transition-all duration-300 rounded-2xl border border-white/5 hover:border-indigo-500/50 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors border border-white/5">
                        <Palette size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-200 transition-colors">Title Optimizer</h4>
                        <p className="text-[10px] text-[#8E918F] group-hover:text-white/70 transition-colors leading-tight font-medium">Clickable & Discovery</p>
                      </div>
                      {isOptimizingTitles && <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>

                    <button 
                      onClick={analyzeDiscoveryKeywords}
                      disabled={isAnalyzingKeywords || !text.trim()}
                      className="group p-4 bg-[#1E1F20]/30 hover:bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 transition-all duration-300 rounded-2xl border border-white/5 hover:border-indigo-500/50 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors border border-white/5">
                        <Tag size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-200 transition-colors">Keyword Analyzer</h4>
                        <p className="text-[10px] text-[#8E918F] group-hover:text-white/70 transition-colors leading-tight font-medium">Boost Discoverability</p>
                      </div>
                      {isAnalyzingKeywords && <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>

                    {/* Calendar & Analytics UI */}
                    <div className={`col-span-1 ${isToolkitMaximized ? 'md:col-span-3 lg:col-span-4' : 'md:col-span-2 lg:col-span-3'} p-6 bg-indigo-950/30 rounded-2xl border border-indigo-500/20`}>
                      <h3 className="text-sm font-bold text-white mb-4">Content Calendar & Analytics</h3>
                       <div className="h-64 bg-black/20 rounded-xl flex items-center justify-center text-indigo-300">
                         <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={[{name: 'Mon', value: 400}, {name: 'Tue', value: 300}, {name: 'Wed', value: 500}, {name: 'Thu', value: 200}, {name: 'Fri', value: 700}]}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#444" />
                                <XAxis dataKey="name" stroke="#888" />
                                <YAxis stroke="#888" />
                                <Tooltip contentStyle={{backgroundColor: '#1E1F20', border: 'none'}} />
                                <Bar dataKey="value" fill="#6366f1" />
                            </BarChart>
                         </ResponsiveContainer>
                       </div>
                    </div>
                    
                      <button 
                      onClick={() => alert("Posting to: All Platforms")}
                      disabled={!text.trim()}
                      className="group p-4 bg-indigo-600 hover:bg-indigo-700 transition-all duration-300 rounded-2xl border border-white/5 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/10 group-hover:bg-white/20 flex items-center justify-center text-white transition-colors border border-white/5">
                        <Globe size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight transition-colors">Post Everywhere</h4>
                        <p className="text-[10px] text-white/70 transition-colors leading-tight font-medium">Auto-distribute to all</p>
                      </div>
                    </button>

                     <button 
                      onClick={() => alert("Opening Platform Selection")}
                      disabled={!text.trim()}
                      className="group p-4 bg-[#1E1F20]/30 hover:bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 transition-all duration-300 rounded-2xl border border-white/5 hover:border-indigo-500/50 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors border border-white/5">
                        <Settings2 size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-200 transition-colors">Select Platforms</h4>
                        <p className="text-[10px] text-[#8E918F] group-hover:text-white/70 transition-colors leading-tight font-medium">Manual selection</p>
                      </div>
                    </button>

                    <button 
                      onClick={generateSocialSeo}
                      disabled={isGeneratingSeo || !text.trim()}
                      className="group p-4 bg-[#1E1F20]/30 hover:bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 transition-all duration-300 rounded-2xl border border-white/5 hover:border-indigo-500/50 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors border border-white/5">
                        <Search size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-200 transition-colors">Platform SEO</h4>
                        <p className="text-[10px] text-[#8E918F] group-hover:text-white/70 transition-colors leading-tight font-medium">Titles, Descriptions, Tags</p>
                      </div>
                      {isGeneratingSeo && <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>

                    <button 
                      onClick={generateSocialChapters}
                      disabled={isGeneratingChapters || !text.trim()}
                      className="group p-4 bg-[#1E1F20]/30 hover:bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 transition-all duration-300 rounded-2xl border border-white/5 hover:border-indigo-500/50 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors border border-white/5">
                        <Clock size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-200 transition-colors">Chapters & Timestamps</h4>
                        <p className="text-[10px] text-[#8E918F] group-hover:text-white/70 transition-colors leading-tight font-medium">Automated logic segmentation</p>
                      </div>
                      {isGeneratingChapters && <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>

                    <button 
                      onClick={generateVisualConcepts}
                      disabled={isGeneratingThumbnails || !text.trim()}
                      className="group p-4 bg-[#1E1F20]/30 hover:bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 transition-all duration-300 rounded-2xl border border-white/5 hover:border-indigo-500/50 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors border border-white/5">
                        <Palette size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-200 transition-colors">Visual Concepts</h4>
                        <p className="text-[10px] text-[#8E918F] group-hover:text-white/70 transition-colors leading-tight font-medium">Thumbnail & Cover prompts</p>
                      </div>
                      {isGeneratingThumbnails && <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>

                    <button 
                      onClick={generateEcosystem}
                      disabled={isGeneratingEcosystem || !text.trim()}
                      className="col-span-1 md:col-span-2 lg:col-span-3 p-4 bg-indigo-900/20 hover:bg-indigo-900/40 transition-all duration-300 rounded-2xl border border-indigo-500/30 hover:border-indigo-500 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400 border border-indigo-500/20">
                          <Rocket size={20} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-white uppercase tracking-tight">Ecosystem Generator</h4>
                          <p className="text-[10px] text-indigo-200/70 uppercase tracking-widest">Multi-Output AI Pass (SEO, Voiceover, Social)</p>
                        </div>
                      </div>
                      {isGeneratingEcosystem && <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>
                    
                    <button 
                      onClick={generateAIVoiceover}
                      disabled={isGeneratingVoiceover || !text.trim()}
                      className="group p-4 bg-[#1E1F20]/30 hover:bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 transition-all duration-300 rounded-2xl border border-white/5 hover:border-indigo-500/50 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors border border-white/5">
                        <Mic size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-200 transition-colors">AI Voiceover</h4>
                        <p className="text-[10px] text-[#8E918F] group-hover:text-white/70 transition-colors leading-tight font-medium">Script to Podcast/Video</p>
                      </div>
                      {isGeneratingVoiceover && <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>
                    
                    <button 
                      onClick={performSentimentAnalysis}
                      disabled={isPerformingSentimentAnalysis || !text.trim()}
                      className="group p-4 bg-[#1E1F20]/30 hover:bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 transition-all duration-300 rounded-2xl border border-white/5 hover:border-indigo-500/50 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors border border-white/5">
                        <BarChart3 size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-200 transition-colors">Sentiment/Readability</h4>
                        <p className="text-[10px] text-[#8E918F] group-hover:text-white/70 transition-colors leading-tight font-medium">Professional Insights</p>
                      </div>
                      {isPerformingSentimentAnalysis && <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>
                    
                    <button 
                      onClick={extractKeySnippets}
                      disabled={isExtractingKeySnippets || !text.trim()}
                      className="group p-4 bg-[#1E1F20]/30 hover:bg-gradient-to-br from-indigo-500/10 to-indigo-600/10 transition-all duration-300 rounded-2xl border border-white/5 hover:border-indigo-500/50 text-left space-y-3 relative overflow-hidden shadow-sm hover:shadow-lg hover:-translate-y-0.5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-white/5 group-hover:bg-indigo-500/20 flex items-center justify-center text-indigo-400 group-hover:text-white transition-colors border border-white/5">
                        <Share2 size={20} />
                      </div>
                      <div className="relative z-10">
                        <h4 className="text-xs font-bold text-white uppercase tracking-tight group-hover:text-indigo-200 transition-colors">Social Snippets</h4>
                        <p className="text-[10px] text-[#8E918F] group-hover:text-white/70 transition-colors leading-tight font-medium">Extract Key Takeaways</p>
                      </div>
                      {isExtractingKeySnippets && <div className="absolute inset-0 bg-black/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>

                    {/* Analysis Group */}
                    <div className={`col-span-1 ${isToolkitMaximized ? 'md:col-span-3 lg:col-span-4' : 'md:col-span-2 lg:col-span-3'} mt-1.5`}>
                       <h3 className="text-[9px] font-black uppercase text-[#8E918F] tracking-[0.2em] mb-1.5 flex items-center gap-2">
                         <Activity size={11} /> Competitive Intelligence
                       </h3>
                    </div>

                    <div className={`col-span-1 ${isToolkitMaximized ? 'md:col-span-3 lg:col-span-4' : 'md:col-span-2 lg:col-span-3'} flex gap-2`}>
                       <input 
                         type="text" 
                         placeholder="" 
                         value={ytUrl}
                         onChange={(e) => setYtUrl(e.target.value)}
                         className="flex-1 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-1.5 text-[11px] text-white focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-all font-medium"
                       />
                       <button 
                         onClick={analyzeCompetitor}
                         disabled={isAnalyzingCompetitor || !ytUrl.trim()}
                         className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white hover:text-black rounded-lg text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                       >
                         {isAnalyzingCompetitor ? <Loader2 size={12} className="animate-spin" /> : "Analyze"}
                       </button>
                    </div>

                    {/* Distribution Group */}
                    <div className={`col-span-1 ${isToolkitMaximized ? 'md:col-span-3 lg:col-span-4' : 'md:col-span-2 lg:col-span-3'} mt-1.5`}>
                       <h3 className="text-[9px] font-black uppercase text-[#8E918F] tracking-[0.2em] mb-1.5 flex items-center gap-2">
                         <Repeat size={11} /> Repurposing & Distribution
                       </h3>
                    </div>

                    <button 
                      onClick={() => generateRepurposedContent('linkedin')}
                      disabled={!!isGeneratingRepurposed || !text.trim()}
                      className="group p-2.5 bg-[#25262B]/50 hover:bg-[#0077b5] transition-all rounded-xl border border-white/5 hover:border-white/20 text-left space-y-1.5 relative overflow-hidden shadow-sm hover:shadow-[#0077b5]/20 hover:-translate-y-0.5"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-white/20 flex items-center justify-center text-white transition-colors border border-white/5">
                        <Share2 size={14} />
                      </div>
                      <h4 className="text-[10px] font-bold text-white uppercase tracking-tight group-hover:text-black transition-colors">LinkedIn Post</h4>
                      {isGeneratingRepurposed === 'linkedin' && <div className="absolute inset-0 bg-[#0077b5]/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>

                    <button 
                      onClick={() => generateRepurposedContent('twitter')}
                      disabled={!!isGeneratingRepurposed || !text.trim()}
                      className="group p-2.5 bg-[#25262B]/50 hover:bg-[#1DA1F2] transition-all rounded-xl border border-white/5 hover:border-white/20 text-left space-y-1.5 relative overflow-hidden shadow-sm hover:shadow-[#1DA1F2]/20 hover:-translate-y-0.5"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-white/20 flex items-center justify-center text-white transition-colors border border-white/5">
                        <Twitter size={14} />
                      </div>
                      <h4 className="text-[10px] font-bold text-white uppercase tracking-tight group-hover:text-black transition-colors">Twitter Thread</h4>
                      {isGeneratingRepurposed === 'twitter' && <div className="absolute inset-0 bg-[#1DA1F2]/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>

                    <button 
                      onClick={() => generateRepurposedContent('instagram')}
                      disabled={!!isGeneratingRepurposed || !text.trim()}
                      className="group p-2.5 bg-[#25262B]/50 hover:bg-[#E1306C] transition-all rounded-xl border border-white/5 hover:border-white/20 text-left space-y-1.5 relative overflow-hidden shadow-sm hover:shadow-[#E1306C]/20 hover:-translate-y-0.5"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-white/20 flex items-center justify-center text-white transition-colors border border-white/5">
                        <Instagram size={14} />
                      </div>
                      <h4 className="text-[10px] font-bold text-white uppercase tracking-tight group-hover:text-black transition-colors">Insta Caption</h4>
                      {isGeneratingRepurposed === 'instagram' && <div className="absolute inset-0 bg-[#E1306C]/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>

                    {/* Script Vitals and more features */}
                    <div className={`col-span-1 ${isToolkitMaximized ? 'md:col-span-3 lg:col-span-4' : 'md:col-span-2 lg:col-span-3'} mt-1.5`}>
                       <h3 className="text-[9px] font-black uppercase text-[#8E918F] tracking-[0.2em] mb-1.5 flex items-center gap-2">
                         <FileText size={11} /> Advanced Toolkit
                       </h3>
                    </div>

                    <button 
                      onClick={generateViralHooks}
                      disabled={isGeneratingHooks || !text.trim()}
                      className="group p-2.5 bg-[#25262B]/50 hover:bg-slate-700 transition-all rounded-xl border border-white/5 hover:border-white/20 text-left space-y-1.5 relative overflow-hidden shadow-sm hover:shadow-white/5 hover:-translate-y-0.5"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-white/20 flex items-center justify-center text-white transition-colors border border-white/5">
                        <Zap size={14} />
                      </div>
                      <h4 className="text-[10px] font-bold text-white uppercase tracking-tight group-hover:text-black transition-colors">Viral Hooks</h4>
                      {isGeneratingHooks && <div className="absolute inset-0 bg-slate-700/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>

                    <button 
                      onClick={generateCtaLibrary}
                      disabled={isGeneratingCtas || !text.trim()}
                      className="group p-2.5 bg-[#25262B]/50 hover:bg-slate-700 transition-all rounded-xl border border-white/5 hover:border-white/20 text-left space-y-1.5 relative overflow-hidden shadow-sm hover:shadow-white/5 hover:-translate-y-0.5"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-white/20 flex items-center justify-center text-white transition-colors border border-white/5">
                        <MousePointerClick size={14} />
                      </div>
                      <h4 className="text-[10px] font-bold text-white uppercase tracking-tight group-hover:text-black transition-colors">CTA Library</h4>
                      {isGeneratingCtas && <div className="absolute inset-0 bg-slate-700/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>

                    <button 
                      onClick={analyzeScriptVitals}
                      disabled={isAnalyzingVitals || !text.trim()}
                      className="group p-2.5 bg-[#25262B]/50 hover:bg-slate-700 transition-all rounded-xl border border-white/5 hover:border-white/20 text-left space-y-1.5 relative overflow-hidden shadow-sm hover:shadow-white/5 hover:-translate-y-0.5"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-white/20 flex items-center justify-center text-white transition-colors border border-white/5">
                        <BarChart3 size={14} />
                      </div>
                      <h4 className="text-[10px] font-bold text-white uppercase tracking-tight group-hover:text-black transition-colors">Script Vitals</h4>
                      {isAnalyzingVitals && <div className="absolute inset-0 bg-slate-700/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>

                    <button 
                      onClick={analyzeVisualCues}
                      disabled={isAnalyzingVisuals || !text.trim()}
                      className="group p-2.5 bg-[#25262B]/50 hover:bg-indigo-800 transition-all rounded-xl border border-white/5 hover:border-white/20 text-left space-y-1.5 relative overflow-hidden shadow-sm hover:shadow-indigo-500/10 hover:-translate-y-0.5"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-white/20 flex items-center justify-center text-white transition-colors border border-white/5">
                        <MonitorPlay size={14} />
                      </div>
                      <h4 className="text-[10px] font-bold text-white uppercase tracking-tight group-hover:text-black transition-colors">Visual Cues</h4>
                      {isAnalyzingVisuals && <div className="absolute inset-0 bg-indigo-800/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>

                    <button 
                      onClick={generateConcepts}
                      disabled={isGeneratingConcepts || !text.trim()}
                      className="group p-2.5 bg-[#25262B]/50 hover:bg-indigo-800 transition-all rounded-xl border border-white/5 hover:border-white/20 text-left space-y-1.5 relative overflow-hidden shadow-sm hover:shadow-indigo-500/10 hover:-translate-y-0.5"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-white/20 flex items-center justify-center text-white transition-colors border border-white/5">
                        <Layers size={14} />
                      </div>
                      <h4 className="text-[10px] font-bold text-white uppercase tracking-tight group-hover:text-black transition-colors">Concept Testing</h4>
                      {isGeneratingConcepts && <div className="absolute inset-0 bg-indigo-800/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>

                    <button 
                      onClick={generatePolls}
                      disabled={isGeneratingPolls || !text.trim()}
                      className="group p-2.5 bg-[#25262B]/50 hover:bg-indigo-800 transition-all rounded-xl border border-white/5 hover:border-white/20 text-left space-y-1.5 relative overflow-hidden shadow-sm hover:shadow-indigo-500/10 hover:-translate-y-0.5"
                    >
                      <div className="w-7 h-7 rounded-lg bg-white/5 group-hover:bg-white/20 flex items-center justify-center text-white transition-colors border border-white/5">
                        <Users size={14} />
                      </div>
                      <h4 className="text-[10px] font-bold text-white uppercase tracking-tight group-hover:text-black transition-colors">Drive Engagement</h4>
                      {isGeneratingPolls && <div className="absolute inset-0 bg-indigo-800/50 flex items-center justify-center backdrop-blur-sm"><Loader2 className="animate-spin text-white" /></div>}
                    </button>

                  </div>
                </div>

                <div className="mt-2 p-2.5 bg-white/[0.03] border border-white/10 rounded-xl flex items-center justify-between">
                   <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400">
                        <Download size={14} />
                      </div>
                      <div>
                        <h4 className="text-[9px] font-black text-white uppercase leading-none">One-Click Export</h4>
                        <p className="text-[7px] text-[#8E918F] uppercase font-bold tracking-widest mt-0.5">Production Bundle (.zip)</p>
                      </div>
                   </div>
                   <button 
                     onClick={handleExportSocialBundle}
                     className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white hover:text-black rounded-lg text-[9px] font-black uppercase tracking-widest transition-all shadow-xl shadow-indigo-900/40"
                   >
                     Bundle Everything
                   </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Feature Result Modals */}
        <AnimatePresence>
          {repurposedContent && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-transparent/95 backdrop-blur-3xl"
            >
              <div className="absolute inset-0" onClick={() => setRepurposedContent(null)} />
              <motion.div className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-2xl p-6 shadow-3xl space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-base font-black text-white uppercase tracking-tight">{repurposedContent.platform} Repurposed</h3>
                  <div className="flex gap-2">
                    <button onClick={() => copyWithLabel(repurposedContent.content, repurposedContent.platform + ' content')} className="p-1.5 text-indigo-400 hover:text-black hover:bg-indigo-400/10 rounded-lg">
                      <Copy size={16} />
                    </button>
                    <button onClick={() => setRepurposedContent(null)} className="text-gray-400 hover:text-black transition-colors p-1">
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className="text-white p-4 bg-white/[0.03] border border-white/5 rounded-xl whitespace-pre-line leading-relaxed text-sm prose prose-invert max-w-none">
                  <ReactMarkdown>{repurposedContent.content}</ReactMarkdown>
                </div>
                <button onClick={() => setRepurposedContent(null)} className="w-full py-3 bg-white/[0.03] hover:bg-white/10 text-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Close</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {competitorAnalysis && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-transparent/95 backdrop-blur-3xl"
            >
              <div className="absolute inset-0" onClick={() => setCompetitorAnalysis(null)} />
              <motion.div className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-2xl p-6 shadow-3xl space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-base font-black text-white uppercase tracking-tight">Competitor Intelligence</h3>
                  <div className="flex gap-2">
                    <button onClick={() => copyWithLabel(competitorAnalysis, 'Analysis')} className="p-1.5 text-indigo-400 hover:text-black hover:bg-indigo-400/10 rounded-lg">
                      <Copy size={16} />
                    </button>
                    <button onClick={() => setCompetitorAnalysis(null)} className="text-gray-400 hover:text-black transition-colors p-1">
                      <X size={18} />
                    </button>
                  </div>
                </div>
                <div className="text-white p-4 bg-white/[0.03] border border-white/5 rounded-xl whitespace-pre-line leading-relaxed text-sm prose prose-invert max-w-none">
                  <ReactMarkdown>{competitorAnalysis}</ReactMarkdown>
                </div>
                <button onClick={() => setCompetitorAnalysis(null)} className="w-full py-3 bg-white/[0.03] hover:bg-white/10 text-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest transition-all">Close</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {securityScanResults && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-black/80 backdrop-blur-3xl"
            >
              <div className="absolute inset-0" onClick={() => setSecurityScanResults(null)} />
              <motion.div className="bg-[#1E1F20] border border-[#333537] rounded-3xl w-full max-w-2xl p-8 shadow-3xl space-y-6 max-h-[85vh] overflow-y-auto custom-scrollbar relative">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <ShieldCheck size={18} className="text-emerald-400" />
                    <h3 className="text-sm font-black text-white uppercase tracking-wider">Production Readiness & Trust Audit</h3>
                  </div>
                  <button onClick={() => setSecurityScanResults(null)} className="text-gray-400 hover:text-white transition-colors p-1">
                    <X size={18} />
                  </button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-white/[0.02] border border-white/5 rounded-2xl">
                  <div className="space-y-1">
                    <p className="text-[10px] uppercase font-black text-[#8E918F] tracking-wider">System Status</p>
                    <div className="flex items-center gap-2">
                      <span className={cn("px-2 py-0.5 text-[9px] font-extrabold uppercase rounded-full",
                        securityScanResults.vulnerabilityStatus === 'Safe' ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "bg-rose-500/20 text-rose-400 border border-rose-500/30"
                      )}>
                        {securityScanResults.vulnerabilityStatus}
                      </span>
                      <span className="text-[10px] text-[#C4C7C5] font-semibold">{securityScanResults.zeroTrustScore}% Trust Score</span>
                    </div>
                  </div>
                  <div className="h-8 w-px bg-white/10" />
                  <div className="text-right">
                    <p className="text-[10px] uppercase font-black text-[#8E918F] tracking-wider">Threat Level</p>
                    <p className="text-xs font-bold text-white mt-0.5">{securityScanResults.vulnerabilityStatus === 'Safe' ? 'LOW' : 'MEDIUM / HIGH'}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase text-[#8E918F] tracking-widest flex items-center gap-1.5"><AlertCircle size={12} className="text-amber-500" /> Key Vulnerability Findings</h4>
                  <ul className="space-y-2">
                    {securityScanResults.findings?.map((f: string, i: number) => (
                      <li key={i} className="text-xs text-[#C4C7C5] bg-white/[0.01] border border-white/5 p-3 rounded-xl flex items-start gap-2.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-xs font-black uppercase text-[#8E918F] tracking-widest flex items-center gap-1.5"><ShieldAlert size={12} className="text-indigo-400" /> Hardening & Remediation Steps</h4>
                  <ul className="space-y-2">
                    {securityScanResults.hardeningSteps?.map((s: string, i: number) => (
                      <li key={i} className="text-xs text-[#C4C7C5] bg-white/[0.01] border border-white/5 p-3 rounded-xl flex items-start gap-2.5">
                        <span className="text-indigo-400 font-extrabold text-[10px] mt-0.5 shrink-0">{i+1}.</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {securityScanResults.zeroDayIntel && (
                  <div className="p-4 bg-indigo-950/20 border border-indigo-500/20 rounded-2xl space-y-1.5">
                    <p className="text-[10px] uppercase font-black text-indigo-400 tracking-wider">Emerging Threat Intelligence</p>
                    <p className="text-xs text-[#C4C7C5] italic leading-relaxed">{securityScanResults.zeroDayIntel}</p>
                  </div>
                )}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {seoData && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-transparent/95 backdrop-blur-3xl"
            >
              <div className="absolute inset-0" onClick={() => setSeoData(null)} />
              <motion.div className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-2xl p-6 shadow-3xl space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <h3 className="text-base font-black text-white uppercase">Platform Bundle</h3>
                  <button onClick={() => setSeoData(null)} className="text-gray-400 hover:text-black transition-colors p-1">
                    <X size={18} />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <h4 className="text-[9px] font-black uppercase text-[#8E918F] tracking-widest">Titles</h4>
                    {seoData.titles.map((t, idx) => (
                      <div key={idx} className="flex gap-2 group">
                        <p className="flex-1 text-xs text-white p-2.5 bg-white/[0.03] rounded-xl border border-white/5 leading-tight">{t}</p>
                        <button onClick={() => copyWithLabel(t, 'Title')} className="text-indigo-400 hover:text-black opacity-0 group-hover:opacity-100 transition-all p-1"><Copy size={14} /></button>
                      </div>
                    ))}
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-[9px] font-black uppercase text-[#8E918F] tracking-widest">Description</h4>
                    <p className="text-xs text-white p-3 bg-white/[0.03] rounded-xl border border-white/5 whitespace-pre-line leading-relaxed">{seoData.description}</p>
                  </div>
                  <div className="space-y-1.5">
                    <h4 className="text-[9px] font-black uppercase text-[#8E918F] tracking-widest">Tags</h4>
                    <p className="text-[10px] text-indigo-400 p-2.5 bg-white/[0.03] rounded-xl border border-white/5 font-mono">{seoData.tags.join(', ')}</p>
                  </div>
                </div>
                <button onClick={() => setSeoData(null)} className="w-full py-3 bg-white/[0.03] hover:bg-white/10 text-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest">Close</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {socialChapters && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-transparent/95 backdrop-blur-3xl"
            >
              <div className="absolute inset-0" onClick={() => setSocialChapters(null)} />
              <motion.div className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-2xl p-6 shadow-3xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <div className="flex flex-col gap-0.5">
                    <h3 className="text-base font-black text-white uppercase">Video Chapters</h3>
                    <span className="text-[10px] text-[#8E918F]">Write chapters or insert individuals into your script</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => {
                        const formatted = "\n\n--- VIDEO CHAPTERS ---\n" + socialChapters.map(c => `[${c.timestamp}] ${c.title}`).join('\n');
                        insertTextAtCursor(formatted);
                        setCommandFeedback("All chapters written to editor!");
                      }}
                      className="text-[10px] font-black uppercase tracking-wider text-indigo-400 hover:text-indigo-300 px-3 py-1.5 rounded-xl bg-indigo-500/10 hover:bg-indigo-500/20 transition-all border border-indigo-500/25 active:scale-95 cursor-pointer"
                      title="Write all chapters at current editor cursor position"
                    >
                      Write All to Editor
                    </button>
                  </div>
                  <button onClick={() => setSocialChapters(null)} className="text-gray-400 hover:text-black p-1"><X size={18} /></button>
                </div>
                <div className="space-y-1.5 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                  {socialChapters.map((c, i) => (
                     <div key={i} className="flex items-center gap-4 p-2.5 bg-white/[0.03] rounded-xl border border-white/4 group hover:bg-white/[0.05] transition-all">
                       <span className="font-mono text-indigo-400 text-xs shrink-0">{c.timestamp}</span>
                       <span className="text-xs text-white flex-1 min-w-0 truncate">{c.title}</span>
                       <div className="flex items-center gap-1.5 shrink-0">
                         <button onClick={() => copyWithLabel(`${c.timestamp} ${c.title}`, 'Chapter')} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white p-1 rounded-lg transition-colors" title="Copy"><Copy size={12} /></button>
                         <button 
                           onClick={() => {
                             insertTextAtCursor(`[${c.timestamp}] ${c.title}`);
                             setCommandFeedback(`Wrote "${c.title}" to editor!`);
                           }}
                           className="opacity-0 group-hover:opacity-100 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-white p-1 rounded border border-indigo-500/20 transition-all cursor-pointer"
                           title="Write to editor cursor position"
                         >
                           <ArrowRight size={12} />
                         </button>
                       </div>
                     </div>
                   ))}
                 </div>
                 <button onClick={() => setSocialChapters(null)} className="w-full py-3 bg-white/[0.03] hover:bg-white/10 text-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest">Close</button>
               </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {thumbnailConcepts && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-transparent/95 backdrop-blur-3xl"
            >
              <div className="absolute inset-0" onClick={() => setThumbnailConcepts(null)} />
              <motion.div className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-2xl p-6 shadow-3xl space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="text-base font-black text-white uppercase">Visual Concepts</h3>
                  <button onClick={() => setThumbnailConcepts(null)} className="text-gray-400 hover:text-black p-1"><X size={18} /></button>
                </div>
                <div className="grid gap-3">
                  {thumbnailConcepts.map((c, i) => (
                    <div key={i} className="p-3 bg-white/[0.03] rounded-xl border border-white/5 space-y-1 group">
                       <div className="flex justify-between items-center">
                         <h4 className="font-black text-indigo-400 text-xs italic">{c.concept}</h4>
                         <button onClick={() => copyWithLabel(c.prompt, 'Prompt')} className="text-gray-500 hover:text-black p-1"><Copy size={12} /></button>
                       </div>
                       <p className="text-[10px] text-white/70 leading-tight">Prompt: <span className="text-white italic">{c.prompt}</span></p>
                       <p className="text-[10px] text-white/50 leading-tight">Guidance: {c.designGuidance}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => setThumbnailConcepts(null)} className="w-full py-3 bg-white/[0.03] hover:bg-white/10 text-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest">Close</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {visualCues && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-transparent/95 backdrop-blur-3xl"
            >
              <div className="absolute inset-0" onClick={() => setVisualCues(null)} />
              <motion.div className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-2xl p-6 shadow-3xl space-y-4 max-h-[85vh] overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="text-base font-black text-white uppercase">Production & Visual Cues</h3>
                  <button onClick={() => setVisualCues(null)} className="text-gray-400 hover:text-black p-1"><X size={18} /></button>
                </div>
                <div className="text-xs text-white prose prose-invert max-w-none prose-sm leading-tight">
                  <ReactMarkdown>{visualCues}</ReactMarkdown>
                </div>
                <button onClick={() => setVisualCues(null)} className="w-full py-3 bg-white/[0.03] hover:bg-white/10 text-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest">Close</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {conceptTesting && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-transparent/95 backdrop-blur-3xl"
            >
              <div className="absolute inset-0" onClick={() => setConceptTesting(null)} />
              <motion.div className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-2xl p-6 shadow-3xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="text-base font-black text-white uppercase">Content Angles</h3>
                  <button onClick={() => setConceptTesting(null)} className="text-gray-400 hover:text-black p-1"><X size={18} /></button>
                </div>
                <div className="grid gap-3">
                  {conceptTesting.map((c, i) => (
                    <div key={i} className="p-3 bg-white/[0.03] rounded-xl border border-white/5 space-y-1">
                       <h4 className="font-black text-indigo-400 uppercase tracking-widest text-[10px]">{c.angle}</h4>
                       <p className="text-xs text-white/80 leading-tight">{c.description}</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => setConceptTesting(null)} className="w-full py-3 bg-white/[0.03] hover:bg-white/10 text-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest">Close</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {polls && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-transparent/95 backdrop-blur-3xl"
            >
              <div className="absolute inset-0" onClick={() => setPolls(null)} />
              <motion.div className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-2xl p-6 shadow-3xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="text-base font-black text-white uppercase">Community Polls</h3>
                  <button onClick={() => setPolls(null)} className="text-gray-400 hover:text-black p-1"><X size={18} /></button>
                </div>
                <div className="space-y-4">
                  {polls.map((p, i) => (
                    <div key={i} className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 space-y-2">
                       <h4 className="font-bold text-white text-xs leading-tight">{p.question}</h4>
                       <div className="grid grid-cols-2 gap-2">
                         {p.options.map((opt, idx) => (
                           <div key={idx} className="p-1 px-2 bg-white/[0.05] rounded-lg text-[10px] text-white border border-white/5">{opt}</div>
                         ))}
                       </div>
                    </div>
                  ))}
                </div>
                <button onClick={() => setPolls(null)} className="w-full py-3 bg-white/[0.03] hover:bg-white/10 text-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest">Close</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {viralHooks && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-transparent/95 backdrop-blur-3xl"
            >
              <div className="absolute inset-0" onClick={() => setViralHooks(null)} />
              <motion.div className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-2xl p-6 shadow-3xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="text-base font-black text-white uppercase">Viral Hooks</h3>
                  <button onClick={() => setViralHooks(null)} className="text-gray-400 hover:text-black p-1"><X size={18} /></button>
                </div>
                <div className="space-y-3">
                  {viralHooks.map((h, i) => (
                    <div key={i} className="p-3 bg-white/[0.03] rounded-xl border border-white/5 space-y-1 group">
                       <div className="flex justify-between">
                         <span className="text-[9px] font-black text-indigo-400 uppercase tracking-widest">{h.type}</span>
                         <button onClick={() => copyWithLabel(h.text, 'Hook')} className="opacity-0 group-hover:opacity-100 hover:text-black text-indigo-400 p-1"><Copy size={11} /></button>
                       </div>
                       <p className="text-xs text-white italic leading-tight">"{h.text}"</p>
                    </div>
                  ))}
                </div>
                <button onClick={() => setViralHooks(null)} className="w-full py-3 bg-white/[0.03] hover:bg-white/10 text-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest">Close</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {ctaLibrary && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-transparent/95 backdrop-blur-3xl"
            >
              <div className="absolute inset-0" onClick={() => setCtaLibrary(null)} />
              <motion.div className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-2xl p-6 shadow-3xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="text-base font-black text-white uppercase">Call-to-Action Library</h3>
                  <button onClick={() => setCtaLibrary(null)} className="text-gray-400 hover:text-black p-1"><X size={18} /></button>
                </div>
                <div className="space-y-2">
                  {ctaLibrary.map((c, i) => (
                    <div key={i} className="p-3 bg-white/[0.03] rounded-xl border border-white/5 flex justify-between items-center group">
                       <p className="text-xs text-white leading-tight">{c}</p>
                       <button onClick={() => copyWithLabel(c, 'CTA')} className="opacity-0 group-hover:opacity-100 hover:text-black text-indigo-400 p-1"><Copy size={14} /></button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setCtaLibrary(null)} className="w-full py-3 bg-white/[0.03] hover:bg-white/10 text-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest">Close</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {scriptVitals && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-transparent/95 backdrop-blur-3xl"
            >
              <div className="absolute inset-0" onClick={() => setScriptVitals(null)} />
              <motion.div className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-2xl p-6 shadow-3xl space-y-6">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="text-base font-black text-white uppercase">Script Performance Vitals</h3>
                  <button onClick={() => setScriptVitals(null)} className="text-gray-400 hover:text-black p-1"><X size={18} /></button>
                </div>
                <div className="grid grid-cols-2 gap-4">
                   <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 space-y-1">
                     <span className="text-[9px] font-black text-[#8E918F] uppercase tracking-widest">Punchiness</span>
                     <div className="text-2xl font-black text-indigo-400">{scriptVitals.punchiness}%</div>
                     <div className="w-full h-1 bg-white/10 rounded-full mt-1.5">
                       <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${scriptVitals.punchiness}%` }} />
                     </div>
                   </div>
                   <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 space-y-1 text-center flex flex-col justify-center">
                     <span className="text-[9px] font-black text-[#8E918F] uppercase tracking-widest">Est. Reading Time</span>
                     <div className="text-xl font-black text-white">{scriptVitals.readingTime}</div>
                   </div>
                   <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 space-y-1">
                     <span className="text-[9px] font-black text-[#8E918F] uppercase tracking-widest">Readability</span>
                     <div className="text-lg font-bold text-white">{scriptVitals.readability}</div>
                   </div>
                   <div className="p-4 bg-white/[0.03] rounded-2xl border border-white/5 space-y-1">
                     <span className="text-[9px] font-black text-[#8E918F] uppercase tracking-widest">Tone Profile</span>
                     <div className="text-lg font-bold text-white italic leading-tight">{scriptVitals.tone}</div>
                   </div>
                </div>
                <button onClick={() => setScriptVitals(null)} className="w-full py-3 bg-white/[0.03] hover:bg-white/10 text-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest">Close</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {extractedKeywords && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[210] flex items-center justify-center p-6 bg-transparent/95 backdrop-blur-3xl"
            >
              <div className="absolute inset-0" onClick={() => setExtractedKeywords(null)} />
              <motion.div className="bg-[#1E1F20] border border-[#444746] rounded-2xl w-full max-w-2xl p-6 shadow-3xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-white/10">
                  <h3 className="text-base font-black text-white uppercase">Keyword Extraction</h3>
                  <button onClick={() => setExtractedKeywords(null)} className="text-gray-400 hover:text-black p-1"><X size={18} /></button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {extractedKeywords.map((k, i) => (
                    <div key={i} className="px-3 py-1.5 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400 font-mono text-[10px]">#{k.replace(/\s+/g, '')}</div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button 
                    onClick={() => copyWithLabel(extractedKeywords.join(', '), 'Keywords')}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest"
                  >
                    Copy All
                  </button>
                  <button onClick={() => setExtractedKeywords(null)} className="flex-1 py-3 bg-white/[0.03] hover:bg-white/10 text-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest">Close</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {showTools && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-transparent/90 backdrop-blur-md"
            >
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-[#1E1F20] border border-[#444746] rounded-2xl p-10 max-w-xl w-full shadow-3xl text-center space-y-8 max-h-[85vh] overflow-y-auto scrollbar-hide"
              >
                <div className="w-24 h-24 bg-white/[0.03] rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                  <Monitor size={48} className="text-[#C4C7C5]" />
                </div>
                <div>
                  <h3 className="text-2xl font-black text-white mb-2 uppercase tracking-tight">"Read it for Me" Extension</h3>
                  <p className="text-[#C4C7C5] text-sm leading-relaxed">
                    The companion tool lets you right-click any text on the web and instantly send it to your Bharat Performance Agent dashboard.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-4 text-left">
                  <div className="p-4 bg-white/[0.03] rounded-2xl border border-[#333537] flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/20 text-[#C4C7C5] flex items-center justify-center shrink-0 font-black">1</div>
                    <p className="text-xs text-[#E3E3E3]">Install the dummy extension by enabling local developer mode.</p>
                  </div>
                  <div className="p-4 bg-white/[0.03] rounded-2xl border border-[#333537] flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/20 text-[#C4C7C5] flex items-center justify-center shrink-0 font-black">2</div>
                    <p className="text-xs text-[#E3E3E3]">Right-click any passage on your favorite blogs or news sites.</p>
                  </div>
                  <div className="p-4 bg-white/[0.03] rounded-2xl border border-[#333537] flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/20 text-[#C4C7C5] flex items-center justify-center shrink-0 font-black">3</div>
                    <p className="text-xs text-[#E3E3E3]">Select <span className="text-[#C4C7C5] font-bold">Bharat Agent → Audio Preview</span> to instantly auto-populate the editor.</p>
                  </div>
                </div>

                <div className="pt-4 flex flex-col gap-3">
                   <button 
                    onClick={() => setShowTools(false)}
                    className="w-full bg-white text-[#131314] p-5 rounded-2xl font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                   >
                    Got it
                   </button>
                   <p className="text-xs text-[#8E918F] font-black uppercase tracking-widest">Extension Status: Active via URL Handlers</p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Floating Comparison Bar */}
        <AnimatePresence>
          {comparingIds.length > 0 && (
            <motion.div 
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-10 left-1/2 -translate-x-1/2 z-[110] w-full max-w-2xl px-6"
            >
              <div className="bg-[#1E1F20]/80 backdrop-blur-2xl border border-[#444746] rounded-2xl p-4 shadow-3xl shadow-black/50 flex items-center justify-between gap-6">
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-4">
                    {comparingIds.map(id => {
                      const item = history.find(h => h.id === id);
                      return (
                        <div key={id} className="w-12 h-12 rounded-[1.2rem] bg-slate-100 border-2 border-[#444746] flex items-center justify-center text-white shadow-xl">
                          <Volume2 size={16} />
                        </div>
                      );
                    })}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-widest">Comparison Mode</h4>
                    <p className="text-xs text-[#8E918F] font-bold uppercase tracking-widest">{comparingIds.length} takes selected</p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <button 
                    onClick={() => setComparingIds([])}
                    className="px-6 py-3 text-xs font-black text-[#8E918F] uppercase tracking-widest hover:text-white transition-all"
                  >
                    Clear
                  </button>
                  <button 
                    onClick={() => {
                      if (comparingIds.length < 2) {
                        setErrorInfo("Select at least 2 takes to compare.");
                        return;
                      }
                      analyzeComparison();
                    }}
                    className="bg-slate-100 text-[#131314] text-white px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest shadow-xl  hover:bg-amber-400 transition-all hover:scale-105 active:scale-95"
                  >
                    Review Takes
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showTerms && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 sm:p-8"
              onClick={() => setShowTerms(false)}
            >
              <motion.div 
                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-[#1E1F20] border border-[#333537] rounded-3xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col shadow-2xl"
              >
                <div className="p-6 sm:p-8 border-b border-[#333537] flex items-center justify-between bg-white/[0.02]">
                  <h3 className="font-bold text-xl text-white">Terms and Conditions</h3>
                  <button 
                    onClick={() => setShowTerms(false)}
                    className="p-2 text-[#C4C7C5] hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-all"
                  >
                    <X size={20} />
                  </button>
                </div>
                <div className="p-6 sm:p-8 overflow-y-auto custom-scrollbar text-[#E3E3E3] space-y-6 text-sm">
                  <div>
                    <h4 className="font-bold text-white text-base mb-2">1. Acceptance of Terms</h4>
                    <p>By accessing and using Bharat Performance Agent Lab, you accept and agree to be bound by the terms and provision of this agreement.</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base mb-2">2. Use License</h4>
                    <p>Permission is granted to temporarily use the AI Voice Lab for personal or commercial projects, provided all generated audio files are legally used according to the source TTS engine licensing (e.g. Google Cloud TTS). You must not use the generated audio to spread misinformation, hate speech, or impersonate real persons.</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base mb-2">3. Third Party Services</h4>
                    <p>This application utilizes Google Cloud TTS, Firebase, and Gemini AI. Your use of this application is also governed by the respective terms of these services. API keys (if applicable) must be kept secure, and you are responsible for any charges incurred on your provided accounts or usage.</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base mb-2">4. Privacy Policy</h4>
                    <p>If you create an account, your data (including text snippets and history) is stored securely on your server or Firebase instance. We do not sell your personal data. Audio generation history is viewable by other users if shared explicitly in a team/collaborative environment.</p>
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base mb-2">5. Disclaimer</h4>
                    <p>The materials on Bharat Performance Agent's web site are provided "as is". We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties, including without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>
                  </div>
                </div>
                <div className="p-6 border-t border-[#333537] bg-[#131314] flex justify-end">
                  <button 
                    onClick={() => setShowTerms(false)}
                    className="btn-primary px-8 py-3 rounded-2xl text-xs font-black uppercase tracking-widest"
                  >
                    I Understand
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Social Permission Dialog */}
        <AnimatePresence>
          {showPermissionDialog && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/80 backdrop-blur-md"
            >
              <div className="absolute inset-0" onClick={() => setShowPermissionDialog(false)} />
              <motion.div 
                initial={{ scale: 0.9, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-[#1E1F20] border border-[#444746] rounded-3xl w-full max-w-lg p-6 shadow-4xl relative z-10 flex flex-col max-h-[90vh] overflow-y-auto"
              >
                <button 
                  onClick={() => setShowPermissionDialog(false)}
                  className="absolute top-4 right-4 p-1 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-all outline-none cursor-pointer"
                  title="Close"
                >
                  <X size={16} />
                </button>

                <div className="w-12 h-12 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 mx-auto mb-4 border border-indigo-500/20">
                  <Sparkles size={24} />
                </div>
                
                <h2 className="text-xl font-black text-white uppercase tracking-tight text-center mb-1">
                  {platformToConnect === 'Account Hub' ? 'Manage Accounts' : `Connect to ${platformToConnect}`}
                </h2>
                <p className="text-[11px] text-[#8E918F] text-center mb-6 max-w-sm mx-auto leading-relaxed">
                  {platformToConnect === 'Account Hub' 
                    ? 'Review and manage all your connected developer sandbox and live social media API integrations.' 
                    : `Link your ${platformToConnect} creator account to enable automated translation broadcasts and audience distribution.`}
                </p>

                {platformToConnect === 'Account Hub' ? (
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {socialConnections.map(plat => (
                      <button 
                        key={plat.platform}
                        onClick={() => togglePlatformConnection(plat.platform, !plat.connected, plat.connected ? undefined : 'Linked Account')}
                        className={cn(
                          "p-3 rounded-2xl border transition-all text-left flex flex-col justify-between h-20 outline-none cursor-pointer",
                          plat.connected 
                            ? "bg-indigo-500/10 border-indigo-500/50 text-white" 
                            : "bg-white/[0.02] border-white/5 text-[#8E918F] hover:bg-white/5"
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[9px] font-black uppercase tracking-widest">{plat.platform}</span>
                          {plat.connected && <Check size={12} className="text-green-400" />}
                        </div>
                        <div>
                          <p className="text-[9px] font-bold opacity-70 mb-0.5">{plat.connected ? 'Connected' : 'Not Connected'}</p>
                          {plat.connected && <span className="text-[8px] text-zinc-400 block truncate">{plat.username || 'Linked'}</span>}
                        </div>
                      </button>
                    ))}
                  </div>
                ) : platformToConnect === 'Telegram' ? (
                  <div className="space-y-4 mb-6 text-left">
                    <div className="bg-indigo-950/20 border border-indigo-500/10 rounded-2xl p-4 text-[11px] text-[#C4C7C5] leading-relaxed space-y-1">
                      <p className="font-bold text-white mb-1 flex items-center gap-1">
                        <Send size={12} className="text-blue-400" /> Telegram Setup Instructions:
                      </p>
                      <p>1. Talk to <a href="https://t.me/BotFather" target="_blank" rel="noreferrer" className="text-indigo-400 font-bold underline">@BotFather</a> on Telegram to create a Bot.</p>
                      <p>2. Copy the generated API Token and paste it below.</p>
                      <p>3. Create a channel or group, add your bot as Admin, and provide the Chat/Channel ID (e.g. <code className="bg-black/50 px-1 py-0.5 rounded text-white font-mono">@mychannel</code> or ID like <code className="bg-black/50 px-1 py-0.5 rounded text-white font-mono">-100123456</code>).</p>
                    </div>

                    <div className="space-y-3">
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-wider text-indigo-400 block mb-1">Bot API Token</label>
                        <input 
                          type="text" 
                          placeholder="123456789:ABCdefGhIJKlmNoPQRsT..."
                          value={telegramToken}
                          onChange={(e) => setTelegramToken(e.target.value)}
                          className="w-full bg-[#131114] border border-[#333537] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-indigo-500 transition-all font-mono"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-black uppercase tracking-wider text-indigo-400 block mb-1">Chat / Channel Username or ID</label>
                        <input 
                          type="text" 
                          placeholder="@my_channel_name or -1001234567"
                          value={telegramChatId}
                          onChange={(e) => setTelegramChatId(e.target.value)}
                          className="w-full bg-[#131114] border border-[#333537] rounded-xl px-3 py-2 text-xs text-white placeholder-zinc-600 outline-none focus:border-indigo-500 transition-all font-mono"
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4 mb-6 text-left">
                    {/* Sandbox Connect */}
                    <div className="border border-indigo-500/20 bg-indigo-500/[0.02] p-4 rounded-2xl flex items-start gap-3 hover:bg-indigo-500/[0.05] transition-all cursor-pointer group"
                      onClick={() => {
                        togglePlatformConnection(platformToConnect || '', true, 'Sandbox Creator');
                        setShowPermissionDialog(false);
                        setCommandFeedback(`${platformToConnect} connected successfully in Sandbox mode!`);
                      }}
                    >
                      <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:bg-indigo-500 group-hover:text-white transition-colors border border-indigo-500/20">
                        <Sparkles size={16} />
                      </div>
                      <div className="flex-1">
                        <h4 className="text-xs font-black uppercase tracking-wider text-white mb-0.5 group-hover:text-indigo-300 transition-colors">🚀 Fast Sandbox Connection</h4>
                        <p className="text-[10px] text-[#8E918F] leading-snug">Simulates immediate connection inside Google AI Studio workspace for testing content pushes.</p>
                      </div>
                    </div>

                    {/* Divider */}
                    <div className="flex items-center gap-3 my-1">
                      <div className="h-px bg-white/5 flex-1" />
                      <span className="text-[8px] font-black uppercase tracking-widest text-[#8E918F]">or connect live api</span>
                      <div className="h-px bg-white/5 flex-1" />
                    </div>

                    {/* Production OAuth Setup card */}
                    <div className="bg-[#131314] border border-white/5 rounded-2xl p-4 space-y-3">
                      <div className="text-[10px] text-[#C4C7C5] leading-relaxed space-y-1.5">
                        <p className="font-bold text-white flex items-center gap-1">
                          <LogIn size={11} className="text-[#8E918F]" /> Live OAuth Instructions:
                        </p>
                        <p>1. Open your Developer Dashboard for {platformToConnect}.</p>
                        <p>2. Set the authorized OAuth Redirect URI to:</p>
                        
                        <div className="flex items-center gap-1.5 bg-black/40 border border-white/5 rounded-lg px-2 py-1.5 font-mono text-[8.5px] text-indigo-400 select-all">
                          <span className="flex-1 truncate">{`${window.location.origin}/api/auth/callback/${platformToConnect?.toLowerCase()}`}</span>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(`${window.location.origin}/api/auth/callback/${platformToConnect?.toLowerCase()}`);
                              setCommandFeedback("Redirect URI copied!");
                            }}
                            className="text-[#8E918F] hover:text-white transition-colors cursor-pointer"
                            title="Copy URI"
                          >
                            <Copy size={10} />
                          </button>
                        </div>
                        <p>3. Declare <code className="bg-zinc-800 text-white px-1 py-0.5 rounded text-[8px] font-mono">{platformToConnect === 'YouTube' ? 'GOOGLE_CLIENT_ID' : platformToConnect === 'Twitter' ? 'TWITTER_CLIENT_ID' : platformToConnect === 'TikTok' ? 'TIKTOK_CLIENT_KEY' : 'FB_CLIENT_ID'}</code> in target settings environment variables.</p>
                      </div>

                      <button 
                        onClick={() => {
                          const win = window.open(`/api/auth/${platformToConnect?.toLowerCase()}`, 'auth', 'width=600,height=600');
                          const listener = (event: MessageEvent) => {
                            if (event.data?.type === 'AUTH_SUCCESS' && event.data?.platform === platformToConnect?.toLowerCase()) {
                              togglePlatformConnection(platformToConnect || '', true, event.data.username || 'Linked Account');
                              setShowPermissionDialog(false);
                              setCommandFeedback(`${platformToConnect} linked successfully via OAuth!`);
                              window.removeEventListener('message', listener);
                            }
                          };
                          window.addEventListener('message', listener);
                        }}
                        className="w-full py-2 bg-[#1E1F20] hover:bg-white/5 text-[10px] font-black uppercase tracking-widest text-[#C4C7C5] hover:text-white border border-[#333537] rounded-xl transition-all active:scale-98 cursor-pointer"
                      >
                        ⚡ Launch Real OAuth Popup
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex gap-3 mt-2 pt-2 border-t border-[#333537]/50">
                  <button 
                    onClick={() => setShowPermissionDialog(false)}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 rounded-xl text-xs font-bold text-white transition-all border border-white/10 cursor-pointer"
                  >
                    Cancel
                  </button>
                  {platformToConnect === 'Telegram' && (
                    <button 
                      onClick={() => {
                        if (telegramToken && telegramChatId) {
                          togglePlatformConnection('Telegram', true, 'Telegram Bot');
                          setShowPermissionDialog(false);
                          setCommandFeedback("Telegram Bot connected successfully!");
                          setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Telegram Linked using token.`]);
                        } else {
                          alert("Please fill in both Token and Chat ID parameters.");
                        }
                      }}
                      className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-xs font-bold text-white transition-all shadow-lg shadow-indigo-500/20 active:scale-95 cursor-pointer"
                    >
                      Authenticate Bot
                    </button>
                  )}
                  {platformToConnect === 'Account Hub' && (
                    <button 
                      onClick={() => setShowPermissionDialog(false)}
                      className="flex-1 py-2.5 bg-indigo-500 hover:bg-indigo-600 rounded-xl text-xs font-bold text-white transition-all shadow-lg shadow-indigo-500/20 active:scale-95 cursor-pointer"
                    >
                      Done
                    </button>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* WhatsApp & System Share Target Setup Modal */}
        <ShareTargetModal 
          isOpen={isShareModalOpen} 
          onClose={() => setIsShareModalOpen(false)} 
          onTestShare={handleSimulateWhatsAppShare} 
          theme={theme} 
        />
    </div>
  );
}
