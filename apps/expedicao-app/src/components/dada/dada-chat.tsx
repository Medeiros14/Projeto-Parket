import { useState, useRef, useEffect, useCallback } from "react";
import { useAction } from "convex/react";
import { api } from "@/convex/_generated/api.js";
import { Button } from "@/components/ui/button.tsx";
import { Textarea } from "@/components/ui/textarea.tsx";
import { Spinner } from "@/components/ui/spinner.tsx";
import { cn } from "@/lib/utils.ts";
import { X, Send, ChevronDown, User } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { toast } from "sonner";

type AvatarState = "idle" | "talking1" | "talking2" | "thinking" | "happy";

function TecaAvatar({ className, letterClass }: { className?: string; letterClass?: string }) {
  return (
    <div className={cn("flex items-center justify-center bg-[#050505] border border-[#968473]/50", className)}>
      <span className={cn("font-serif text-[#d8d3c7] leading-none select-none", letterClass)}>P</span>
    </div>
  );
}

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SUGGESTIONS = [
  "Qual o estoque atual dos produtos?",
  "Quais pedidos estão pendentes?",
  "Qual produto está com baixo estoque?",
  "Quais pedidos foram entregues hoje?",
  "Quanto vendemos este mês?",
];

export function DadaChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [avatarState, setAvatarState] = useState<AvatarState>("idle");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const talkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const dadaChat = useAction(api.dada.chat);

  // Animate mouth/gestures while talking
  const startTalkingAnimation = useCallback(() => {
    let frame = 0;
    talkIntervalRef.current = setInterval(() => {
      frame++;
      setAvatarState(frame % 2 === 0 ? "talking1" : "talking2");
    }, 400);
  }, []);

  const stopTalkingAnimation = useCallback((finalState: AvatarState = "idle") => {
    if (talkIntervalRef.current) {
      clearInterval(talkIntervalRef.current);
      talkIntervalRef.current = null;
    }
    setAvatarState(finalState);
    // After showing happy/final state, return to idle
    if (finalState !== "idle") {
      setTimeout(() => setAvatarState("idle"), 3000);
    }
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (talkIntervalRef.current) clearInterval(talkIntervalRef.current);
    };
  }, []);

  // Show thinking while loading
  useEffect(() => {
    if (loading) {
      stopTalkingAnimation();
      setAvatarState("thinking");
    }
  }, [loading, stopTalkingAnimation]);

  useEffect(() => {
    if (open && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            "Olá! Sou a **Teca**, sua assistente operacional da Parket 👋\n\nTenho acesso completo ao sistema em tempo real. Pode me perguntar sobre estoque, pedidos, clientes, entregas, fretes e muito mais!\n\nTambém consigo gerar **etiquetas** e **PDFs** de pedidos pra você.\n\nComo posso te ajudar agora?",
        },
      ]);
      // Welcome animation
      setTimeout(() => {
        startTalkingAnimation();
        setTimeout(() => stopTalkingAnimation("happy"), 2500);
      }, 400);
    }
  }, [open, messages.length, startTalkingAnimation, stopTalkingAnimation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async (text?: string) => {
    const content = (text ?? input).trim();
    if (!content || loading) return;

    const userMsg: Message = { id: Date.now().toString(), role: "user", content };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    const history = [...messages, userMsg]
      .filter((m) => m.id !== "welcome")
      .map((m) => ({ role: m.role, content: m.content }));

    try {
      const response = await dadaChat({ messages: history });
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString() + "-r", role: "assistant", content: response },
      ]);
      // After receiving response, animate talking then smile
      setLoading(false);
      startTalkingAnimation();
      setTimeout(() => stopTalkingAnimation("happy"), 2000 + Math.min(response.length * 10, 4000));
    } catch {
      toast.error("Erro ao consultar a Teca. Tente novamente.");
      setLoading(false);
      setAvatarState("idle");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const renderContent = (text: string) => {
    return text.split("\n").map((line, i) => {
      const parts = line.split(/\*\*(.*?)\*\*/g);
      return (
        <span key={i}>
          {parts.map((part, j) =>
            j % 2 === 1 ? <strong key={j}>{part}</strong> : part
          )}
          {i < text.split("\n").length - 1 && <br />}
        </span>
      );
    });
  };

  return (
    <>
      {/* Floating button */}
      <AnimatePresence>
        {!open && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            whileHover={{ scale: 1.07 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setOpen(true)}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2.5 bg-primary text-primary-foreground pl-1.5 pr-4 py-1.5 rounded-full shadow-2xl cursor-pointer font-semibold text-sm print:hidden"
          >
            <TecaAvatar className="w-9 h-9 rounded-full shadow" letterClass="text-[15px]" />
            Falar com a Teca
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat window */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 40, scale: 0.95 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed bottom-6 right-6 z-50 w-[390px] max-w-[calc(100vw-2rem)] flex flex-col bg-background border border-border rounded-2xl shadow-2xl overflow-hidden"
            style={{ height: "580px" }}
          >
            {/* Header with animated avatar */}
            <div className="relative bg-primary text-primary-foreground overflow-hidden">
              <div className="relative flex items-end justify-between px-4 pt-4 pb-3">
                <div className="flex items-end gap-3">
                  <div className="relative w-24 h-24 shrink-0">
                    <TecaAvatar className="absolute inset-0 rounded-2xl shadow-xl" letterClass="text-4xl" />

                    {/* Bounce when talking */}
                    {(avatarState === "talking1" || avatarState === "talking2") && (
                      <motion.div
                        className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-400 rounded-full border-2 border-primary flex items-center justify-center"
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 0.4, repeat: Infinity }}
                      >
                        <span className="text-[8px]">🎙️</span>
                      </motion.div>
                    )}
                    {avatarState === "thinking" && (
                      <motion.div
                        className="absolute -bottom-1 -right-1 w-5 h-5 bg-yellow-400 rounded-full border-2 border-primary flex items-center justify-center"
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      >
                        <span className="text-[8px]">💭</span>
                      </motion.div>
                    )}
                    {avatarState === "happy" && (
                      <motion.div
                        className="absolute -bottom-1 -right-1 w-5 h-5 bg-pink-400 rounded-full border-2 border-primary flex items-center justify-center"
                        initial={{ scale: 0 }}
                        animate={{ scale: [0, 1.4, 1] }}
                        transition={{ duration: 0.4 }}
                      >
                        <span className="text-[8px]">😊</span>
                      </motion.div>
                    )}
                  </div>

                  <div className="pb-1">
                    <p className="font-bold text-base leading-none">Teca</p>
                    <p className="text-xs opacity-70 mt-1">Assistente Operacional</p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      <motion.div
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className="w-2 h-2 rounded-full bg-green-400"
                      />
                      <span className="text-[10px] opacity-80">
                        {avatarState === "thinking" ? "Consultando dados..." :
                         avatarState === "talking1" || avatarState === "talking2" ? "Falando..." :
                         avatarState === "happy" ? "Aqui pra ajudar!" :
                         "Online"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Controls */}
                <div className="flex items-center gap-1 pb-1">
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors cursor-pointer"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => { setOpen(false); setMessages([]); stopTalkingAnimation(); }}
                    className="p-1.5 rounded-lg hover:bg-primary-foreground/20 transition-colors cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2 }}
                  className={cn(
                    "flex gap-2 items-end",
                    msg.role === "user" ? "flex-row-reverse" : "flex-row"
                  )}
                >
                  {msg.role === "assistant" ? (
                    <TecaAvatar className="w-7 h-7 rounded-full shrink-0" letterClass="text-[11px]" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
                      <User className="w-3.5 h-3.5" />
                    </div>
                  )}

                  <div
                    className={cn(
                      "max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      msg.role === "assistant"
                        ? "bg-muted text-foreground rounded-bl-sm"
                        : "bg-primary text-primary-foreground rounded-br-sm"
                    )}
                  >
                    {renderContent(msg.content)}
                  </div>
                </motion.div>
              ))}

              {/* Loading */}
              {loading && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-2 items-end"
                >
                  <TecaAvatar className="w-7 h-7 rounded-full shrink-0" letterClass="text-[11px]" />
                  <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-2">
                    <Spinner className="w-3.5 h-3.5" />
                    <span className="text-sm text-muted-foreground">Consultando dados...</span>
                  </div>
                </motion.div>
              )}

              {/* Suggestions */}
              {messages.length === 1 && !loading && (
                <div className="space-y-1.5 pt-1">
                  <p className="text-xs text-muted-foreground font-medium px-1">Sugestões:</p>
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      onClick={() => void sendMessage(s)}
                      className="w-full text-left text-xs bg-muted hover:bg-secondary rounded-xl px-3 py-2 transition-colors cursor-pointer text-foreground/80 hover:text-foreground"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              <div ref={bottomRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-border bg-background">
              <div className="flex gap-2 items-end">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Pergunte sobre estoque, pedidos, clientes..."
                  className="flex-1 min-h-[40px] max-h-[100px] text-sm resize-none rounded-xl border-border"
                  rows={1}
                  disabled={loading}
                />
                <Button
                  size="icon"
                  className="shrink-0 rounded-xl cursor-pointer h-10 w-10"
                  onClick={() => void sendMessage()}
                  disabled={!input.trim() || loading}
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-1.5 px-1">
                Enter para enviar · Shift+Enter para nova linha
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
