with open('src/App.tsx', 'r') as f:
    content = f.read()

# 1. Update line 6494 history share button
old1 = """                                 try {
                                   await navigator.clipboard.writeText(`${h.text}\\n\\nGenerated via Bharat Performance Agent: ${window.location.href}`);
                                   setErrorInfo("Text copied to clipboard!");
                                   setTimeout(() => setErrorInfo(null), 2000);
                                 } catch (e) {
                                   setErrorInfo("Clipboard access denied.");
                                 }"""
new1 = """                                 const ok = await copyToClipboard(`${h.text}\\n\\nGenerated via Bharat Performance Agent: ${window.location.href}`);
                                 if (ok) {
                                   setErrorInfo("Text copied to clipboard!");
                                   setTimeout(() => setErrorInfo(null), 2000);
                                 } else {
                                   setErrorInfo("Clipboard access denied.");
                                 }"""
assert old1 in content, 'old1 not found'

# 2. Update line 6529 history copy text button
old2 = """                             <button onClick={async () => { 
                               try {
                                 await navigator.clipboard.writeText(h.text); 
                                 setCommandFeedback("History text copied!");
                                 setTimeout(() => setCommandFeedback(null), 2000);
                               } catch(e) {
                                 setErrorInfo("Failed to copy text.");
                               }
                             }} title="Copy Text" className="p-2.5 text-[#8E918F] hover:text-indigo-300 hover:bg-indigo-500/20 rounded-2xl border border-transparent hover:border-indigo-500/30 transition-all hover:scale-105 active:scale-95 group/hcopy"><Copy size={16} className="group-hover/hcopy:scale-110 transition-transform" /></button>"""
new2 = """                             <button 
                               onClick={async () => { 
                                 const ok = await copyToClipboard(h.text);
                                 if (ok) {
                                   setCommandFeedback("History text copied!");
                                   setTimeout(() => setCommandFeedback(null), 2000);
                                 } else {
                                   setErrorInfo("Failed to copy text.");
                                 }
                               }} 
                               onTouchEnd={async (e) => {
                                 e.preventDefault();
                                 const ok = await copyToClipboard(h.text);
                                 if (ok) {
                                   setCommandFeedback("History text copied!");
                                   setTimeout(() => setCommandFeedback(null), 2000);
                                 } else {
                                   setErrorInfo("Failed to copy text.");
                                 }
                               }}
                               title="Copy Text" 
                               className="p-2.5 text-[#8E918F] hover:text-indigo-300 hover:bg-indigo-500/20 rounded-2xl border border-transparent hover:border-indigo-500/30 transition-all hover:scale-105 active:scale-95 group/hcopy touch-manipulation cursor-pointer"
                             >
                               <Copy size={16} className="group-hover/hcopy:scale-110 transition-transform" />
                             </button>"""
assert old2 in content, 'old2 not found'

# 3. Update line 7656 block copy
old3 = """                                       <button 
                                         onClick={() => {
                                           navigator.clipboard.writeText(block.content);
                                           setCommandFeedback(`Block #${i+1} copied to clipboard!`);
                                         }}
                                         className="text-indigo-400 hover:text-indigo-300 p-1 rounded hover:bg-white/5 cursor-pointer"
                                         title="Copy text"
                                       >
                                         <Copy size={10} />
                                       </button>"""
new3 = """                                       <button 
                                         onClick={async () => {
                                           const ok = await copyToClipboard(block.content);
                                           if (ok) {
                                             setCommandFeedback(`Block #${i+1} copied to clipboard!`);
                                             setTimeout(() => setCommandFeedback(null), 2000);
                                           } else {
                                             setErrorInfo("Failed to copy block.");
                                           }
                                         }}
                                         onTouchEnd={async (e) => {
                                           e.preventDefault();
                                           const ok = await copyToClipboard(block.content);
                                           if (ok) {
                                             setCommandFeedback(`Block #${i+1} copied to clipboard!`);
                                             setTimeout(() => setCommandFeedback(null), 2000);
                                           } else {
                                             setErrorInfo("Failed to copy block.");
                                           }
                                         }}
                                         className="text-indigo-400 hover:text-indigo-300 p-1 rounded hover:bg-white/5 cursor-pointer touch-manipulation active:scale-95"
                                         title="Copy text"
                                       >
                                         <Copy size={10} />
                                       </button>"""
assert old3 in content, 'old3 not found'

# 4. Update line 8665 audio voice share link
old4 = """                                     try {
                                       await navigator.clipboard.writeText(`${text.substring(0, 500)}\\n\\nGenerated via Bharat Performance Agent: ${window.location.href}`);
                                       setErrorInfo("Voice summary and App link copied!");
                                       setTimeout(() => setErrorInfo(null), 3000);
                                     } catch (e) {
                                       setErrorInfo("Clipboard access denied.");
                                     }"""
new4 = """                                     const ok = await copyToClipboard(`${text.substring(0, 500)}\\n\\nGenerated via Bharat Performance Agent: ${window.location.href}`);
                                     if (ok) {
                                       setErrorInfo("Voice summary and App link copied!");
                                       setTimeout(() => setErrorInfo(null), 3000);
                                     } else {
                                       setErrorInfo("Clipboard access denied.");
                                     }"""
assert old4 in content, 'old4 not found'

# 5. Update lines 9237 and 9244 Strategy A and B
old5 = """                                                     <span className="text-[8px] font-black uppercase text-purple-400">Strategy A: Problem-First</span>
                                                     <button onClick={() => navigator.clipboard.writeText(result.variants!.A)} className="text-[#8E918F] hover:text-white transition-colors"><Copy size={10} /></button>
                                                   </div>
                                                   <p className="text-[10px] text-[#C4C7C5] leading-relaxed italic line-clamp-3">{result.variants.A}</p>
                                               </div>
                                               <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl space-y-2">
                                                   <div className="flex justify-between items-center">
                                                     <span className="text-[8px] font-black uppercase text-purple-400">Strategy B: Curiosity-First</span>
                                                     <button onClick={() => navigator.clipboard.writeText(result.variants!.B)} className="text-[#8E918F] hover:text-white transition-colors"><Copy size={10} /></button>"""
new5 = """                                                     <span className="text-[8px] font-black uppercase text-purple-400">Strategy A: Problem-First</span>
                                                     <button 
                                                       onClick={async () => {
                                                         const ok = await copyToClipboard(result.variants!.A);
                                                         if (ok) { setCommandFeedback("Strategy A copied!"); setTimeout(() => setCommandFeedback(null), 2000); }
                                                       }} 
                                                       onTouchEnd={async (e) => {
                                                         e.preventDefault();
                                                         const ok = await copyToClipboard(result.variants!.A);
                                                         if (ok) { setCommandFeedback("Strategy A copied!"); setTimeout(() => setCommandFeedback(null), 2000); }
                                                       }}
                                                       className="text-[#8E918F] hover:text-white transition-colors p-1 rounded hover:bg-white/5 touch-manipulation cursor-pointer active:scale-95"
                                                       title="Copy Strategy A"
                                                     >
                                                       <Copy size={10} />
                                                     </button>
                                                   </div>
                                                   <p className="text-[10px] text-[#C4C7C5] leading-relaxed italic line-clamp-3">{result.variants.A}</p>
                                               </div>
                                               <div className="p-3 bg-purple-500/5 border border-purple-500/10 rounded-xl space-y-2">
                                                   <div className="flex justify-between items-center">
                                                     <span className="text-[8px] font-black uppercase text-purple-400">Strategy B: Curiosity-First</span>
                                                     <button 
                                                       onClick={async () => {
                                                         const ok = await copyToClipboard(result.variants!.B);
                                                         if (ok) { setCommandFeedback("Strategy B copied!"); setTimeout(() => setCommandFeedback(null), 2000); }
                                                       }} 
                                                       onTouchEnd={async (e) => {
                                                         e.preventDefault();
                                                         const ok = await copyToClipboard(result.variants!.B);
                                                         if (ok) { setCommandFeedback("Strategy B copied!"); setTimeout(() => setCommandFeedback(null), 2000); }
                                                       }}
                                                       className="text-[#8E918F] hover:text-white transition-colors p-1 rounded hover:bg-white/5 touch-manipulation cursor-pointer active:scale-95"
                                                       title="Copy Strategy B"
                                                     >
                                                       <Copy size={10} />
                                                     </button>"""
assert old5 in content, 'old5 not found'

# 6. Update line 9345 post copy
old6 = """                                                      <button 
                                                        onClick={() => {
                                                          navigator.clipboard.writeText(post.content);
                                                          setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Copied ${post.platform} post for ${result.lang}`]);
                                                        }}
                                                        className="text-[#8E918F] hover:text-white transition-colors p-1"
                                                        title="Copy Content"
                                                      >
                                                        <Copy size={10} />
                                                      </button>"""
new6 = """                                                      <button 
                                                        onClick={async () => {
                                                          const ok = await copyToClipboard(post.content);
                                                          if (ok) {
                                                            setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Copied ${post.platform} post for ${result.lang}`]);
                                                            setCommandFeedback(`Copied ${post.platform} post!`);
                                                            setTimeout(() => setCommandFeedback(null), 2000);
                                                          }
                                                        }}
                                                        onTouchEnd={async (e) => {
                                                          e.preventDefault();
                                                          const ok = await copyToClipboard(post.content);
                                                          if (ok) {
                                                            setAgentLog(prev => [...prev, `[${new Date().toLocaleTimeString()}] Copied ${post.platform} post for ${result.lang}`]);
                                                            setCommandFeedback(`Copied ${post.platform} post!`);
                                                            setTimeout(() => setCommandFeedback(null), 2000);
                                                          }
                                                        }}
                                                        className="text-[#8E918F] hover:text-white transition-colors p-1 rounded hover:bg-white/5 touch-manipulation cursor-pointer active:scale-95"
                                                        title="Copy Content"
                                                      >
                                                        <Copy size={10} />
                                                      </button>"""
assert old6 in content, 'old6 not found'

# 7. Update line 10170 socialCaption
old7 = """                                               <button 
                                                 onClick={() => { navigator.clipboard.writeText(socialCaption); alert('Caption Copied!'); }}
                                                 className="text-xs font-black text-[#8E918F] hover:text-white uppercase tracking-widest"
                                               >
                                                 Copy
                                               </button>"""
new7 = """                                               <button 
                                                 onClick={async () => {
                                                   const ok = await copyToClipboard(socialCaption);
                                                   if (ok) {
                                                     setCommandFeedback('Caption Copied!');
                                                     setTimeout(() => setCommandFeedback(null), 2000);
                                                   }
                                                 }}
                                                 onTouchEnd={async (e) => {
                                                   e.preventDefault();
                                                   const ok = await copyToClipboard(socialCaption);
                                                   if (ok) {
                                                     setCommandFeedback('Caption Copied!');
                                                     setTimeout(() => setCommandFeedback(null), 2000);
                                                   }
                                                 }}
                                                 className="text-xs font-black text-[#8E918F] hover:text-white uppercase tracking-widest touch-manipulation cursor-pointer active:scale-95 py-1 px-2.5 rounded-lg hover:bg-white/5 transition-all"
                                               >
                                                 Copy
                                               </button>"""
assert old7 in content, 'old7 not found'

# 8. Update lines 12155, 12195, 12310, 12340, 12412 (copyWithLabel calls)
old8_1 = "<button onClick={() => copyToClipboard(`${c.timestamp} ${c.title}`, 'Chapter')} className=\"opacity-0 group-hover:opacity-100 text-gray-400 hover:text-white p-1 rounded-lg transition-colors\" title=\"Copy\"><Copy size={12} /></button>"
new8_1 = "<button onClick={() => copyWithLabel(`${c.timestamp} ${c.title}`, 'Chapter')} onTouchEnd={(e) => { e.preventDefault(); copyWithLabel(`${c.timestamp} ${c.title}`, 'Chapter'); }} className=\"opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-gray-400 hover:text-white p-1 rounded-lg transition-colors touch-manipulation cursor-pointer active:scale-95\" title=\"Copy\"><Copy size={12} /></button>"
assert old8_1 in content, 'old8_1 not found'

old8_2 = "<button onClick={() => copyToClipboard(c.prompt, 'Prompt')} className=\"text-gray-500 hover:text-black p-1\"><Copy size={12} /></button>"
new8_2 = "<button onClick={() => copyWithLabel(c.prompt, 'Prompt')} onTouchEnd={(e) => { e.preventDefault(); copyWithLabel(c.prompt, 'Prompt'); }} className=\"text-gray-500 hover:text-black p-1 rounded-lg transition-colors touch-manipulation cursor-pointer active:scale-95\" title=\"Copy Prompt\"><Copy size={12} /></button>"
assert old8_2 in content, 'old8_2 not found'

old8_3 = "<button onClick={() => copyToClipboard(h.text, 'Hook')} className=\"opacity-0 group-hover:opacity-100 hover:text-black text-indigo-400 p-1\"><Copy size={11} /></button>"
new8_3 = "<button onClick={() => copyWithLabel(h.text, 'Hook')} onTouchEnd={(e) => { e.preventDefault(); copyWithLabel(h.text, 'Hook'); }} className=\"opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-black text-indigo-400 p-1 rounded-lg transition-colors touch-manipulation cursor-pointer active:scale-95\" title=\"Copy Hook\"><Copy size={11} /></button>"
assert old8_3 in content, 'old8_3 not found'

old8_4 = "<button onClick={() => copyToClipboard(c, 'CTA')} className=\"opacity-0 group-hover:opacity-100 hover:text-black text-indigo-400 p-1\"><Copy size={14} /></button>"
new8_4 = "<button onClick={() => copyWithLabel(c, 'CTA')} onTouchEnd={(e) => { e.preventDefault(); copyWithLabel(c, 'CTA'); }} className=\"opacity-100 sm:opacity-0 sm:group-hover:opacity-100 hover:text-black text-indigo-400 p-1 rounded-lg transition-colors touch-manipulation cursor-pointer active:scale-95\" title=\"Copy CTA\"><Copy size={14} /></button>"
assert old8_4 in content, 'old8_4 not found'

old8_5 = """                  <button 
                    onClick={() => copyToClipboard(extractedKeywords.join(', '), 'Keywords')}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white hover:text-black rounded-xl text-[10px] font-black uppercase tracking-widest"
                  >
                    Copy All
                  </button>"""
new8_5 = """                  <button 
                    onClick={() => copyWithLabel(extractedKeywords.join(', '), 'Keywords')}
                    onTouchEnd={(e) => { e.preventDefault(); copyWithLabel(extractedKeywords.join(', '), 'Keywords'); }}
                    className="flex-1 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest touch-manipulation cursor-pointer active:scale-95 transition-all"
                  >
                    Copy All
                  </button>"""
assert old8_5 in content, 'old8_5 not found'

# 9. Update line 12721 redirect URI copy
old9 = """                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              navigator.clipboard.writeText(`${window.location.origin}/api/auth/callback/${platformToConnect?.toLowerCase()}`);
                              setCommandFeedback("Redirect URI copied!");
                            }}
                            className="text-[#8E918F] hover:text-white transition-colors cursor-pointer"
                            title="Copy URI"
                          >
                            <Copy size={10} />
                          </button>"""
new9 = """                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              const ok = await copyToClipboard(`${window.location.origin}/api/auth/callback/${platformToConnect?.toLowerCase()}`);
                              if (ok) {
                                setCommandFeedback("Redirect URI copied!");
                                setTimeout(() => setCommandFeedback(null), 2000);
                              }
                            }}
                            onTouchEnd={async (e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              const ok = await copyToClipboard(`${window.location.origin}/api/auth/callback/${platformToConnect?.toLowerCase()}`);
                              if (ok) {
                                setCommandFeedback("Redirect URI copied!");
                                setTimeout(() => setCommandFeedback(null), 2000);
                              }
                            }}
                            className="text-[#8E918F] hover:text-white transition-colors cursor-pointer touch-manipulation active:scale-95 p-1"
                            title="Copy URI"
                          >
                            <Copy size={10} />
                          </button>"""
assert old9 in content, 'old9 not found'

content = content.replace(old1, new1).replace(old2, new2).replace(old3, new3).replace(old4, new4).replace(old5, new5).replace(old6, new6).replace(old7, new7).replace(old8_1, new8_1).replace(old8_2, new8_2).replace(old8_3, new8_3).replace(old8_4, new8_4).replace(old8_5, new8_5).replace(old9, new9)

with open('src/App.tsx', 'w') as f:
    f.write(content)
print("Updated src/App.tsx successfully!")
