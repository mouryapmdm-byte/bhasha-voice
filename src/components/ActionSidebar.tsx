import React, { useState } from 'react';
import { Sparkles, Brain, Clock, Users, Search, BookOpen, Image, ArrowRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { listFiles } from '../services/GoogleWorkspaceService';
import { containsTable } from '../lib/utils';

interface ActionSidebarProps {
  text: string;
  setText: (text: string) => void;
  setEditMode: (mode: 'text' | 'grid') => void;
  genAIResponse: (modelName: string, contents: any, optionsOrTools?: any) => Promise<string | null>;
  setCommandFeedback: (feedback: string | null) => void;
  setErrorInfo: (error: any) => void;
  isOpen: boolean;
  onClose: () => void;
}

export const ActionSidebar = ({ text, setText, setEditMode, genAIResponse, setCommandFeedback, setErrorInfo, isOpen, onClose }: ActionSidebarProps) => {
  const [isProcessing, setIsProcessing] = useState(false);

  const actions = [
    { name: 'Summarize', icon: Brain, prompt: 'Summarize the following content concisely.' },
    { name: 'Formalize', icon: Sparkles, prompt: 'Rewrite the following content to be more professional and formal.' },
    { name: 'Semantic Search', icon: Search, prompt: 'Search Drive (Simulated)' },
    { name: 'Citation Helper', icon: BookOpen, prompt: 'Identify key topics and suggest references from Drive.' },
    { name: 'Image Analysis', icon: Image, prompt: 'Analyze dropped image (Simulated)' },
  ];

  const handleAction = async (action: { name: string, prompt: string }) => {
    if (!text.trim() && action.name !== 'Semantic Search') return;
    setIsProcessing(true);
    setCommandFeedback(`Running ${action.name}...`);
    try {
      if (action.name === 'Semantic Search') {
           const files = await listFiles();
           setCommandFeedback(`Found ${files.files?.length || 0} documents in Drive.`);
      } else if (action.name === 'Citation Helper') {
           const result = await genAIResponse("gemini-3.8-flash", [{ text: `Identify key topics in this document and suggest relevant documents or research data from Google Drive. Document: ${text.substring(0, 5000)}` }]);
           setCommandFeedback("Citations suggested: " + (result || "None."));
      } else {
           const result = await genAIResponse("gemini-3.8-flash", [{ text: `${action.prompt}\n\nContent: ${text.substring(0, 10000)}` }]);
           if (result) {
             setText(result);
             if (containsTable(result)) {
               setEditMode('grid');
             } else {
               setEditMode('text');
             }
           }
           setCommandFeedback(`${action.name} applied!`);
      }
    } catch (e) {
      setErrorInfo(`${action.name} failed.`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay for mobile */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.6 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 md:hidden"
          />
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            className="fixed top-0 right-0 h-full w-80 bg-slate-900 border-l border-slate-800 shadow-2xl z-50 p-4"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-white font-bold flex items-center gap-2">
                <Sparkles className="text-indigo-400" /> AI Actions
              </h2>
              <button onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer select-none">X</button>
            </div>
            
            <div className="space-y-4">
              {actions.map((action) => (
                <button
                  key={action.name}
                  onClick={() => handleAction(action)}
                  disabled={isProcessing}
                  className="flex items-center gap-3 w-full p-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 transition-all font-medium cursor-pointer"
                >
                  <action.icon size={18} />
                  {action.name}
                </button>
              ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
