import React, { useState, useRef, useEffect } from "react";
import { GoogleGenAI } from "@google/genai";
import { 
  Send, 
  Image as ImageIcon, 
  User, 
  Lock, 
  LogOut, 
  Bot, 
  Loader2, 
  X,
  MessageSquare,
  Sparkles,
  Plus,
  Menu
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

interface Message {
  id: string;
  role: "user" | "bot";
  content: string;
  image?: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
}

interface UserData {
  username: string;
}

export default function App() {
  const [user, setUser] = useState<UserData | null>(null);
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, chatLoading]);

  useEffect(() => {
    if (user) {
      try {
        const saved = localStorage.getItem(`chats_${user.username}`);
        if (saved) {
          setSessions(JSON.parse(saved));
        }
      } catch (e) {
        console.error("Failed to parse chat sessions", e);
      }
    }
  }, [user]);

  useEffect(() => {
    if (user && sessions.length > 0) {
      localStorage.setItem(`chats_${user.username}`, JSON.stringify(sessions));
    }
  }, [sessions, user]);

  const createNewChat = () => {
    setCurrentSessionId(null);
    setMessages([]);
    setIsSidebarOpen(false);
  };

  const loadSession = (id: string) => {
    const session = sessions.find(s => s.id === id);
    if (session) {
      setCurrentSessionId(id);
      setMessages(session.messages || []);
    }
    setIsSidebarOpen(false);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const endpoint = isLogin ? "/api/login" : "/api/register";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Something went wrong");
      }

      if (isLogin) {
        setUser(data.user);
      } else {
        setSuccess("Registration successful! Please login.");
        setIsLogin(true);
        setPassword("");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    setUser(null);
    setMessages([]);
    setSessions([]);
    setCurrentSessionId(null);
    setUsername("");
    setPassword("");
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!input.trim() && !selectedImage) || chatLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
      image: selectedImage || undefined,
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    
    let activeSessionId = currentSessionId;
    if (!activeSessionId) {
      activeSessionId = Date.now().toString();
      setCurrentSessionId(activeSessionId);
      setSessions(prev => [
        {
          id: activeSessionId as string,
          title: input.slice(0, 30) + (input.length > 30 ? "..." : "") || "เรื่องที่ไม่สบายใจ",
          messages: newMessages,
          updatedAt: Date.now()
        },
        ...prev
      ]);
    } else {
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId 
          ? { ...s, messages: newMessages, updatedAt: Date.now() } 
          : s
      ));
    }

    const currentInput = input;
    const currentImage = selectedImage;
    
    setInput("");
    setSelectedImage(null);
    setChatLoading(true);

    try {
      const parts: any[] = [{ text: currentInput || "ช่วยวิเคราะห์ข้อมูลนี้หน่อย" }];
      
      if (currentImage) {
        const base64Data = currentImage.split(",")[1];
        const mimeType = currentImage.split(";")[0].split(":")[1];
        parts.push({
          inlineData: {
            data: base64Data,
            mimeType: mimeType,
          },
        });
      }

      const response = await ai.models.generateContent({
        model: "gemini-flash-latest",
        contents: { parts },
        config: {
          systemInstruction: "คุณคือนักจิตวิทยาชื่อว่า 'Safe Zone' (เซฟโซน) หน้าที่ของคุณคือการรับฟัง ให้คำปรึกษา และสร้างพื้นที่ปลอดภัยให้กับผู้ใช้ ตอบกลับด้วยความเห็นอกเห็นใจ เข้าใจ และให้กำลังใจเสมอ ใช้ภาษาที่เป็นมิตรและอบอุ่น",
        }
      });

      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        content: response.text || "I couldn't generate a response.",
      };

      const finalMessages = [...newMessages, botMessage];
      setMessages(finalMessages);
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId 
          ? { ...s, messages: finalMessages, updatedAt: Date.now() } 
          : s
      ));
    } catch (err: any) {
      console.error(err);
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        content: "Error: " + err.message,
      };
      
      const finalMessages = [...newMessages, errorMsg];
      setMessages(finalMessages);
      setSessions(prev => prev.map(s => 
        s.id === activeSessionId 
          ? { ...s, messages: finalMessages, updatedAt: Date.now() } 
          : s
      ));
    } finally {
      setChatLoading(false);
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-organic-base">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-organic-surface card-shadow border border-border-soft rounded-[32px] overflow-hidden relative z-10"
        >
          <div className="p-8 pb-4">
            <div className="font-serif italic text-3xl text-accent-olive mb-8 tracking-wider">Safe Zone</div>
            <h1 className="text-3xl font-serif text-text-primary">
              {isLogin ? "ยินดีต้อนรับกลับมา" : "สร้างพื้นที่ปลอดภัย"}
            </h1>
            <p className="text-text-secondary mt-2 text-sm">
              {isLogin ? "เข้าสู่ระบบเพื่อพูดคุยและเยียวยาจิตใจกับนักจิตวิทยา" : "เริ่มต้นเยียวยาจิตใจกับนักจิตวิทยา Safe Zone"}
            </p>
          </div>

          <form onSubmit={handleAuth} className="p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-[2px] text-text-secondary font-medium">Username</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input 
                  type="text" 
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full bg-[#FCFBF8] border border-border-soft rounded-full py-3.5 pl-11 pr-4 text-text-primary focus:ring-1 focus:ring-accent-olive focus:bg-white outline-none transition-all placeholder:text-text-secondary/60 input-shadow"
                  placeholder="ชื่อผู้ใช้ของคุณ"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[11px] uppercase tracking-[2px] text-text-secondary font-medium">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
                <input 
                  type="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#FCFBF8] border border-border-soft rounded-full py-3.5 pl-11 pr-4 text-text-primary focus:ring-1 focus:ring-accent-olive focus:bg-white outline-none transition-all placeholder:text-text-secondary/60 input-shadow"
                  placeholder="••••••••"
                  required
                />
              </div>
            </div>

            {error && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-red-600 text-sm text-center bg-red-50 p-3 rounded-xl border border-red-100">{error}</motion.p>
            )}

            {success && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-accent-olive text-sm text-center bg-[#f4f6ec] p-3 rounded-xl border border-accent-olive/20">{success}</motion.p>
            )}

            <button 
              type="submit" 
              disabled={loading}
              className="w-full bg-accent-olive text-white font-medium py-3.5 rounded-full hover:bg-accent-olive/90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? "เข้าสู่ระบบ" : "สมัครสมาชิก")}
            </button>

            <div className="text-center pt-2">
              <button 
                type="button" 
                onClick={() => {
                  setIsLogin(!isLogin);
                  setError("");
                  setSuccess("");
                }}
                className="text-sm text-text-secondary hover:text-accent-olive transition-colors underline-offset-4 hover:underline"
              >
                {isLogin ? "ไม่มีบัญชีหรือเปล่า? สร้างบัญชี" : "มีบัญชีอยู่แล้ว? เข้าสู่ระบบ"}
              </button>
            </div>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen flex bg-organic-base font-sans overflow-hidden">
      {/* Mobile Sidebar Overlay */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 w-[300px] flex-shrink-0 bg-organic-surface border-r border-border-soft p-6 flex flex-col z-50 shadow-2xl lg:shadow-[4px_0_24px_rgba(0,0,0,0.02)] lg:relative transition-transform duration-300 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
        <div className="flex items-center justify-between mb-12">
          <div className="font-serif text-3xl tracking-wide text-accent-olive">Safe Zone.</div>
          <button 
            className="lg:hidden p-1 text-text-secondary hover:text-text-primary transition-colors"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="flex-1 space-y-8 overflow-y-auto pr-2">
          <div>
            <button 
              onClick={createNewChat}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-border-soft rounded-full text-sm text-text-primary bg-organic-base hover:bg-[#EAE7D9] transition-colors mb-8 shadow-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              พูดคุยเรื่องใหม่
            </button>
            <span className="text-[11px] uppercase tracking-[2px] text-text-secondary block mb-4 font-medium">เรื่องราวที่ผ่านมา</span>
            <div className="space-y-2">
              {[...sessions].sort((a,b) => b.updatedAt - a.updatedAt).map(session => (
                <div 
                  key={session.id}
                  onClick={() => loadSession(session.id)}
                  className={`text-sm cursor-pointer truncate transition-all p-3 rounded-2xl ${currentSessionId === session.id ? 'bg-[#F2EFE5] text-accent-olive font-medium' : 'text-text-secondary hover:bg-organic-base hover:text-text-primary'}`}
                >
                  {session.title}
                </div>
              ))}
              {sessions.length === 0 && (
                <div className="text-text-secondary/60 text-xs italic p-2">ยังไม่มีประวัติการพูดคุย</div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-border-soft flex items-center gap-3">
          <div className="w-10 h-10 bg-accent-olive/10 text-accent-olive rounded-full flex items-center justify-center text-sm font-bold uppercase">
            {user.username.substring(0, 2)}
          </div>
          <div className="flex-1 overflow-hidden">
            <div className="text-sm font-medium text-text-primary truncate">{user.username}</div>
            <div className="text-[11px] text-text-secondary font-medium tracking-tight">สมาชิกพื้นที่ปลอดภัย</div>
          </div>
          <button 
            onClick={handleLogout}
            className="p-2 text-text-secondary hover:text-accent-terracotta hover:bg-accent-terracotta/10 rounded-full transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative p-4 md:p-10 overflow-hidden bg-organic-base w-full">
        <div className="relative z-10 mb-4 md:mb-8 border-b border-border-soft pb-4 flex items-center gap-3 md:gap-4 mt-2 md:mt-0">
          <button 
            className="lg:hidden p-2 text-text-secondary hover:text-text-primary transition-colors rounded-full card-shadow bg-white"
            onClick={() => setIsSidebarOpen(true)}
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="w-10 h-10 md:w-12 md:h-12 bg-white card-shadow rounded-full flex items-center justify-center text-accent-olive shrink-0">
            <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
          </div>
          <div className="flex-1 overflow-hidden">
            <h1 className="font-serif text-2xl md:text-3xl text-text-primary md:mb-1 truncate">พื้นที่ปลอดภัย</h1>
            <p className="text-text-secondary text-xs md:text-sm truncate">พร้อมรับฟังทุกเรื่องราวของคุณ เล่าให้ฟังได้เลย</p>
          </div>
        </div>

        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-8 pr-4 relative z-10 scrollbar-hide py-4"
        >
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center">
              <div className="w-24 h-24 bg-white card-shadow rounded-[32px] flex items-center justify-center mb-6 text-accent-olive rotating">
                <Bot className="w-10 h-10" />
              </div>
              <p className="text-2xl font-serif text-text-primary mb-2">สวัสดีครับ ผม Safe Zone</p>
              <p className="text-text-secondary">มีเรื่องหนักใจอะไร วันนี้ให้ผมรับฟังและช่วยดูแลความรู้สึกนะครับ?</p>
            </div>
          )}

          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${msg.role === "user" ? "items-end text-right" : "items-start"}`}
              >
                {msg.image && (
                   <div className="relative group mb-3 card-shadow rounded-2xl overflow-hidden border border-border-soft">
                    <img 
                      src={msg.image} 
                      className="w-36 h-36 object-cover"
                      alt="Thumbnail"
                      referrerPolicy="no-referrer"
                    />
                   </div>
                )}
                <div className={`max-w-[85%] px-7 py-5 text-[16px] leading-relaxed relative card-shadow ${
                  msg.role === "bot" 
                    ? "bg-organic-surface border border-border-soft rounded-[32px] rounded-tl-sm text-text-primary" 
                    : "bg-[#EAE7D9] text-text-primary rounded-[32px] rounded-tr-sm"
                }`}>
                  {msg.content}
                </div>
                {msg.role === "bot" && (
                  <div className="mt-3 text-[12px] text-text-secondary">
                    Safe Zone
                  </div>
                )}
              </motion.div>
            ))}
            {chatLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                <div className="bg-organic-surface border border-border-soft card-shadow px-6 py-5 rounded-[32px] rounded-tl-sm flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <span className="w-2 h-2 bg-accent-olive/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                    <span className="w-2 h-2 bg-accent-olive/60 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                    <span className="w-2 h-2 bg-accent-olive rounded-full animate-bounce"></span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Input Area */}
        <div className="relative z-10 mt-4 md:mt-6 shrink-0 max-w-4xl mx-auto w-full pb-2 md:pb-0">
          <AnimatePresence>
            {selectedImage && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute -top-20 left-4 bg-white p-2 rounded-2xl flex items-center gap-3 card-shadow border border-border-soft"
              >
                <img src={selectedImage} className="w-14 h-14 object-cover rounded-xl" alt="Preview" />
                <button onClick={() => setSelectedImage(null)} className="p-1.5 hover:bg-[#F2EFE5] rounded-full text-text-secondary transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          <form 
            onSubmit={sendMessage}
            className="bg-organic-surface shadow-[0_8px_30px_rgb(0,0,0,0.06)] border border-border-soft rounded-[32px] p-2 pl-4 md:pl-6 flex items-center gap-2 md:gap-4 group focus-within:border-accent-olive/40 transition-all duration-300"
          >
            <button 
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-text-secondary hover:text-accent-olive transition-colors font-light ml-1"
            >
              <ImageIcon className="w-6 h-6" />
            </button>
            <input 
              type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" className="hidden" 
            />
            <input 
              type="text" 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="พิมพ์ความรู้สึกของคุณ..."
              className="flex-1 bg-transparent border-none focus:ring-0 text-[14px] md:text-[16px] py-3 outline-none text-text-primary placeholder:text-text-secondary/70 h-[56px]"
            />
            <button 
              type="submit"
              disabled={(!input.trim() && !selectedImage) || chatLoading}
              className="bg-accent-olive text-white px-5 md:px-8 py-3 md:py-4 rounded-[24px] font-medium text-[15px] hover:bg-accent-olive/90 disabled:opacity-40 transition-all flex items-center gap-2 shrink-0"
            >
              <Send className="w-4 h-4 md:ml-1" />
            </button>
          </form>
        </div>
      </main>
      
      <style>{`
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>
    </div>
  );
}
