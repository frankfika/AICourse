
import React, { useState, useRef, useEffect } from 'react';
import { askAiTutor } from '../services/geminiService';
import { Button } from './Components';
import { MessageSquare, Send, X, Sparkles, Bot } from 'lucide-react';

interface AiTutorProps {
 courseTitle: string;
}

export const AiTutor: React.FC<AiTutorProps> = ({ courseTitle }) => {
 const [isOpen, setIsOpen] = useState(false);
 const [messages, setMessages] = useState<{ role: 'user' | 'model'; text: string }[]>([
 { role: 'model', text: `你好呀！我是你的专属助教。关于 "${courseTitle}"，有什么想问的吗？` }
 ]);
 const [input, setInput] = useState('');
 const [loading, setLoading] = useState(false);
 const scrollRef = useRef<HTMLDivElement>(null);

 useEffect(() => {
 if (scrollRef.current) {
 scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
 }
 }, [messages, isOpen]);

 const handleSend = async () => {
 if (!input.trim() || loading) return;

 const userMsg = input;
 setInput('');
 setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
 setLoading(true);

 const history = messages.map(m => ({
 role: m.role,
 parts: [{ text: m.text }]
 }));

 const response = await askAiTutor(courseTitle, userMsg, history);

 setMessages(prev => [...prev, { role: 'model', text: response }]);
 setLoading(false);
 };

 if (!isOpen) {
 return (
 <button
 onClick={() => setIsOpen(true)}
 className="fixed bottom-8 right-8 bg-[#171717] text-white p-4 z-50 rounded-full group"
 >
 <Bot className="w-7 h-7" />
 <span className="absolute top-0 right-0 flex h-3 w-3">
 <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
 <span className="relative inline-flex rounded-full h-3 w-3 bg-red-400"></span>
 </span>
 </button>
 );
 }

 return (
 <div className="fixed bottom-8 right-8 w-80 md:w-96 h-[550px] bg-white border border-[#EEEDE9] flex flex-col z-50 rounded-2xl overflow-hidden animate-in slide-in-from-bottom-4 fade-in duration-300">
 {/* Header */}
 <div className="p-4 border-b border-[#EEEDE9] flex justify-between items-center bg-[#F5F4F0]/80">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-[#F5F4F0] flex items-center justify-center">
 <Bot className="w-6 h-6 text-[#171717]" />
 </div>
 <div>
 <div className="font-bold text-[#171717]">AI 学习助手</div>
 <div className="text-xs text-[#666666]">OpenCSG Academy</div>
 </div>
 </div>
 <button onClick={() => setIsOpen(false)} className="text-[#999999] hover:text-[#171717] p-1 hover:bg-[#EEEDE9] rounded-full">
 <X className="w-5 h-5" />
 </button>
 </div>

 {/* Messages */}
 <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-[#F5F4F0]" ref={scrollRef}>
 {messages.map((msg, idx) => (
 <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
 <div className={`max-w-[85%] p-3.5 rounded-2xl text-sm leading-relaxed ${
 msg.role === 'user' 
 ? 'bg-[#171717] text-white rounded-br-none' 
 : 'bg-white text-[#171717] border border-[#EEEDE9] rounded-bl-none'
 }`}>
 {msg.text}
 </div>
 </div>
 ))}
 {loading && (
 <div className="flex justify-start">
 <div className="bg-white border border-[#EEEDE9] text-[#666666] text-xs px-3 py-2 rounded-full flex items-center gap-2">
 <Sparkles size={12} className="animate-spin text-[#171717]" /> 正在思考...
 </div>
 </div>
 )}
 </div>

 {/* Input */}
 <div className="p-4 border-t border-[#EEEDE9] bg-white">
 <div className="flex gap-2 bg-[#F5F4F0] rounded-full p-1 pl-4">
 <input
 type="text"
 value={input}
 onChange={(e) => setInput(e.target.value)}
 onKeyDown={(e) => e.key === 'Enter' && handleSend()}
 placeholder="输入问题..."
 className="flex-1 bg-transparent border-none text-[#171717] focus:outline-none text-sm placeholder-[#999999]"
 />
 <button 
 onClick={handleSend}
 disabled={loading}
 className="bg-[#171717] text-white rounded-full w-9 h-9 flex items-center justify-center hover:bg-[#171717] disabled:opacity-50"
 >
 <Send className="w-4 h-4 ml-0.5" />
 </button>
 </div>
 </div>
 </div>
 );
};
