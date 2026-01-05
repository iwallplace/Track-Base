'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Sparkles, X, MessageSquare, Bot, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Message {
    role: 'user' | 'model';
    text: string;
}

const SUGGESTED_QUESTIONS = [
    "Stok durumu ne?",
    "Kritik ürünler hangileri?",
    "En çok hangi firma işlem yaptı?",
    "Ölü stok var mı?"
];

export function PatronChat() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
        { role: 'model', text: 'Merhaba! Ben stok asistanın. Bugün verilerle ilgili ne bilmek istersin?' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async (text: string) => {
        if (!text.trim()) return;

        const userMsg: Message = { role: 'user', text };
        setMessages(prev => [...prev, userMsg]);
        setInput('');
        setLoading(true);

        try {
            // Prepare history for API (excluding the last user message we just added locally)
            // Mapping to Gemini format if needed, but our API expects simple array or just works with context
            const history = messages.map(m => ({
                role: m.role,
                parts: [{ text: m.text }]
            }));

            const res = await fetch('/api/ai/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    history: history
                })
            });

            const data = await res.json();

            if (res.ok) {
                setMessages(prev => [...prev, { role: 'model', text: data.text }]);
            } else {
                setMessages(prev => [...prev, { role: 'model', text: data.message || "Bir hata oluştu." }]);
            }

        } catch (error) {
            console.error(error);
            setMessages(prev => [...prev, { role: 'model', text: "Bağlantı hatası." }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            {/* Floating Action Button */}
            {!isOpen && (
                <button
                    onClick={() => setIsOpen(true)}
                    className="fixed bottom-6 right-6 h-14 w-14 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-105 transition-transform z-50 animate-in fade-in zoom-in duration-300"
                >
                    <Sparkles className="h-6 w-6" />
                </button>
            )}

            {/* Chat Window */}
            {isOpen && (
                <div className="fixed bottom-6 right-6 w-[350px] md:w-[400px] h-[500px] bg-card border border-border rounded-2xl shadow-2xl z-50 flex flex-col overflow-hidden animate-in slide-in-from-bottom-10 fade-in duration-300">
                    {/* Header */}
                    <div className="flex items-center justify-between p-4 bg-muted/20 border-b border-border">
                        <div className="flex items-center gap-2">
                            <Bot className="h-5 w-5 text-blue-400" />
                            <div>
                                <h3 className="text-sm font-bold text-foreground">Intra Arc</h3>
                                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                    Axiom Systems Online
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {messages.map((msg, idx) => (
                            <div
                                key={idx}
                                className={cn(
                                    "flex gap-2 max-w-[85%]",
                                    msg.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                                )}
                            >
                                <div className={cn(
                                    "h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0",
                                    msg.role === 'user' ? "bg-muted" : "bg-blue-600/20"
                                )}>
                                    {msg.role === 'user' ? <User className="h-4 w-4 text-muted-foreground" /> : <Bot className="h-4 w-4 text-blue-400" />}
                                </div>
                                <div className={cn(
                                    "p-3 rounded-2xl text-sm",
                                    msg.role === 'user'
                                        ? "bg-blue-600 text-white rounded-br-none"
                                        : "bg-muted/50 text-foreground rounded-bl-none border border-border"
                                )}>
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex gap-2 mr-auto max-w-[85%]">
                                <div className="h-8 w-8 rounded-full bg-blue-600/20 flex items-center justify-center flex-shrink-0">
                                    <Bot className="h-4 w-4 text-blue-400" />
                                </div>
                                <div className="p-3 rounded-2xl bg-muted/50 border border-border rounded-bl-none flex gap-1 items-center">
                                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                                    <span className="w-2 h-2 bg-muted-foreground rounded-full animate-bounce"></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Suggested Chips */}
                    {messages.length === 1 && (
                        <div className="px-4 pb-2 flex gap-2 overflow-x-auto no-scrollbar">
                            {SUGGESTED_QUESTIONS.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSend(q)}
                                    className="whitespace-nowrap px-3 py-1.5 bg-muted/50 hover:bg-muted border border-border rounded-full text-xs text-blue-500 hover:text-blue-600 transition-colors"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div className="p-4 border-t border-border bg-card">
                        <div className="flex gap-2">
                            <input
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleSend(input)}
                                placeholder="Bir soru sor..."
                                className="flex-1 bg-background border border-input rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:border-blue-500"
                                disabled={loading}
                            />
                            <button
                                onClick={() => handleSend(input)}
                                disabled={loading || !input.trim()}
                                className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white p-2 rounded-xl transition-colors"
                            >
                                <Send className="h-5 w-5" />
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
