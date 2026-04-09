/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  Send, 
  RefreshCw, 
  Quote, 
  Compass, 
  Lightbulb, 
  HelpCircle,
  ChevronRight,
  Loader2,
  BookOpen,
  Download,
  MessageCircle
} from 'lucide-react';
import { analyzeReflection, chatWithCoach } from './services/gemini';
import { ReflectionResult, ChatMessage } from './types';
import * as XLSX from 'xlsx';

export default function App() {
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<ReflectionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [isChatLoading, setIsChatLoading] = useState(false);
  
  const resultRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const handleAnalyze = async () => {
    if (!input.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setChatMessages([]); // Reset chat when new analysis starts
    try {
      const data = await analyzeReflection(input);
      setResult(data);
      // Scroll to result after a short delay for animation
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : '发生了一些错误，请重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setInput('');
    setResult(null);
    setError(null);
    setChatMessages([]);
  };

  const handleExportExcel = () => {
    if (!result) return;

    const data = [
      { 板块: '内在回响 (One Sentence)', 内容: result.one_sentence },
      { 板块: '深度剖析 (Summary)', 内容: result.summary },
      { 板块: '微小尝试 (Insight)', 内容: result.insight },
      { 板块: '留给你的问题', 内容: result.questions.join('\n') }
    ];

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "复盘结果");
    
    // Set column widths
    const wscols = [
      { wch: 25 },
      { wch: 80 }
    ];
    ws['!cols'] = wscols;

    XLSX.writeFile(wb, `SoulMirror_复盘结果_${new Date().toLocaleDateString()}.xlsx`);
  };

  const handleSendMessage = async () => {
    if (!chatInput.trim() || isChatLoading || !result) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    const newMessages: ChatMessage[] = [...chatMessages, { role: 'user', content: userMessage }];
    setChatMessages(newMessages);
    setIsChatLoading(true);

    try {
      const context = `用户日记：${input}\n\n分析结果：\n一句话：${result.one_sentence}\n总结：${result.summary}\n建议：${result.insight}\n问题：${result.questions.join(', ')}`;
      const response = await chatWithCoach(chatMessages, userMessage, context);
      setChatMessages([...newMessages, { role: 'model', content: response }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : '对话失败');
    } finally {
      setIsChatLoading(false);
    }
  };

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  return (
    <div className="min-h-screen bg-[#FFF5F7] text-[#4A4A4A] font-sans selection:bg-[#FFB7C533]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-[#FFF5F7]/80 backdrop-blur-md border-b border-[#FADADD] px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#FFB7C5] rounded-lg flex items-center justify-center text-white shadow-sm">
              <BookOpen size={18} />
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-[#D27D8F]">SoulMirror</h1>
          </div>
          {result && (
            <div className="flex items-center gap-4">
              <button 
                onClick={handleExportExcel}
                className="text-sm text-[#D27D8F] hover:text-[#B56A7A] transition-colors flex items-center gap-1.5 font-medium"
              >
                <Download size={14} />
                导出 Excel
              </button>
              <button 
                onClick={handleReset}
                className="text-sm text-[#73726E] hover:text-[#4A4A4A] transition-colors flex items-center gap-1.5"
              >
                <RefreshCw size={14} />
                重新开始
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12 md:py-20">
        {/* Intro Section */}
        {!result && (
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-12"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4 tracking-tight text-[#D27D8F]">
              倾听你的内心回响
            </h2>
            <p className="text-lg text-[#8E8E8E] leading-relaxed max-w-2xl">
              在这里放下你的日记、周记或随笔。SoulMirror 会以温和的视角，陪你一起看见那些被忽略的情绪与转机。
            </p>
          </motion.div>
        )}

        {/* Input Section */}
        <motion.div 
          layout
          className="bg-white border border-[#FADADD] rounded-2xl shadow-[0_4px_20px_rgba(250,218,221,0.3)] overflow-hidden transition-all duration-300 focus-within:border-[#FFB7C5] focus-within:ring-4 focus-within:ring-[#FFB7C51A]"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="今天发生了什么？或者，你最近在为什么感到困扰..."
            className="w-full h-64 p-8 bg-transparent resize-none outline-none text-lg leading-relaxed placeholder:text-[#D1D1D1]"
          />
          <div className="px-8 py-5 bg-[#FFF9FA] border-t border-[#FADADD] flex justify-between items-center">
            <span className="text-xs text-[#BDBDBD] font-medium tracking-wider">
              {input.length} 字
            </span>
            <button
              onClick={handleAnalyze}
              disabled={!input.trim() || isLoading}
              className={`
                flex items-center gap-2 px-7 py-2.5 rounded-full font-semibold transition-all shadow-md
                ${!input.trim() || isLoading 
                  ? 'bg-[#F0F0F0] text-[#BDBDBD] cursor-not-allowed shadow-none' 
                  : 'bg-[#FFB7C5] text-white hover:bg-[#FFA4B5] active:scale-95 hover:shadow-lg'}
              `}
            >
              {isLoading ? (
                <>
                  <Loader2 size={18} className="animate-spin" />
                  正在洞察...
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  开始复盘
                </>
              )}
            </button>
          </div>
        </motion.div>

        {error && (
          <motion.p 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-6 text-[#D27D8F] text-sm text-center font-medium bg-[#FFB7C51A] py-2 rounded-lg"
          >
            {error}
          </motion.p>
        )}

        {/* Result Section */}
        <AnimatePresence>
          {result && (
            <motion.div 
              ref={resultRef}
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="mt-16 space-y-16 pb-24"
            >
              {/* One Sentence */}
              <section className="relative py-4">
                <div className="absolute -left-6 -top-2 text-[#FADADD]/60">
                  <Quote size={64} fill="currentColor" />
                </div>
                <h3 className="text-2xl md:text-3xl font-medium italic leading-snug pl-10 text-[#D27D8F] relative z-10">
                  {result.one_sentence}
                </h3>
              </section>

              {/* Summary */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-[#D27D8F] font-bold uppercase tracking-[0.2em] text-[10px]">
                  <Compass size={14} />
                  内在回响
                </div>
                <p className="text-xl leading-relaxed text-[#4A4A4A] font-light">
                  {result.summary}
                </p>
              </section>

              {/* Insight */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-[#D27D8F] font-bold uppercase tracking-[0.2em] text-[10px]">
                  <Lightbulb size={14} />
                  微小尝试
                </div>
                <div className="bg-white border border-[#FADADD] rounded-2xl p-8 shadow-[0_4px_15px_rgba(250,218,221,0.2)]">
                  <p className="text-lg leading-relaxed text-[#4A4A4A]">
                    {result.insight}
                  </p>
                </div>
              </section>

              {/* Questions */}
              <section className="space-y-6">
                <div className="flex items-center gap-2 text-[#D27D8F] font-bold uppercase tracking-[0.2em] text-[10px]">
                  <HelpCircle size={14} />
                  留给你的问题
                </div>
                <div className="grid gap-5">
                  {result.questions.map((q, i) => (
                    <motion.div 
                      key={i}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.3 + i * 0.15 }}
                      className="group flex items-start gap-4 p-5 rounded-2xl bg-white border border-transparent hover:border-[#FADADD] hover:bg-[#FFF9FA] transition-all duration-300 shadow-sm hover:shadow-md"
                    >
                      <div className="mt-1 text-[#FFB7C5]">
                        <ChevronRight size={20} />
                      </div>
                      <p className="text-lg text-[#4A4A4A]/80 group-hover:text-[#4A4A4A] transition-colors leading-relaxed">
                        {q}
                      </p>
                    </motion.div>
                  ))}
                </div>
              </section>

              {/* Export Button */}
              <div className="flex justify-center pt-2">
                <button 
                  onClick={handleExportExcel}
                  className="flex items-center gap-1.5 px-4 py-2 text-[#D27D8F]/60 hover:text-[#D27D8F] transition-all text-sm font-medium"
                >
                  <Download size={14} />
                  保存本次复盘结果
                </button>
              </div>

              {/* Chat Section */}
              <section className="space-y-6 pt-6 border-t border-[#FADADD]">
                <div className="flex items-center gap-2 text-[#D27D8F] font-bold uppercase tracking-[0.2em] text-[10px]">
                  <MessageCircle size={14} />
                  与教练对话
                </div>
                
                <div className="bg-white border border-[#FADADD] rounded-2xl overflow-hidden shadow-[0_4px_15px_rgba(250,218,221,0.1)]">
                  <div className="h-[400px] overflow-y-auto p-6 space-y-4 bg-[#FFF9FA]/30">
                    {chatMessages.length === 0 && (
                      <div className="h-full flex flex-col items-center justify-center text-[#BDBDBD] text-center px-8">
                        <MessageCircle size={32} className="mb-3 opacity-20" />
                        <p className="text-sm">对复盘结果有疑问？或者想聊聊那几个问题？<br/>在这里直接告诉我吧。</p>
                      </div>
                    )}
                    {chatMessages.map((msg, i) => (
                      <motion.div 
                        key={i}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        <div className={`
                          max-w-[85%] p-4 rounded-2xl text-sm leading-relaxed
                          ${msg.role === 'user' 
                            ? 'bg-[#FFB7C5] text-white rounded-tr-none shadow-sm' 
                            : 'bg-white border border-[#FADADD] text-[#4A4A4A] rounded-tl-none shadow-sm'}
                        `}>
                          {msg.content}
                        </div>
                      </motion.div>
                    ))}
                    {isChatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-white border border-[#FADADD] p-4 rounded-2xl rounded-tl-none shadow-sm">
                          <Loader2 size={16} className="animate-spin text-[#FFB7C5]" />
                        </div>
                      </div>
                    )}
                    <div ref={chatEndRef} />
                  </div>
                  
                  <div className="p-4 bg-white border-t border-[#FADADD] flex gap-2">
                    <input 
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                      placeholder="输入你的想法..."
                      className="flex-1 bg-[#FFF9FA] border border-[#FADADD] rounded-full px-5 py-2 text-sm outline-none focus:border-[#FFB7C5] transition-colors"
                    />
                    <button 
                      onClick={handleSendMessage}
                      disabled={!chatInput.trim() || isChatLoading}
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center transition-all
                        ${!chatInput.trim() || isChatLoading 
                          ? 'bg-[#F0F0F0] text-[#BDBDBD]' 
                          : 'bg-[#FFB7C5] text-white hover:bg-[#FFA4B5] shadow-sm'}
                      `}
                    >
                      <Send size={18} />
                    </button>
                  </div>
                </div>
              </section>

              {/* Footer Action */}
              <div className="pt-12 border-t border-[#FADADD] flex flex-col items-center">
                <button 
                  onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                  className="text-xs text-[#BDBDBD] hover:text-[#D27D8F] transition-colors tracking-widest uppercase font-bold"
                >
                  回到顶部
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
}
