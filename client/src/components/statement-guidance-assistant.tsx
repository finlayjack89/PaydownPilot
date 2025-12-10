import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, MessageCircle, Send, Sparkles, FileText, HelpCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface StatementGuidanceAssistantProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  bankName: string;
}

export function StatementGuidanceAssistant({ open, onOpenChange, bankName }: StatementGuidanceAssistantProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isInitialized, setIsInitialized] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const initialGuidanceMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest("POST", "/api/statement-guidance", { bankName });
    },
    onSuccess: (data: any) => {
      setMessages([{
        role: 'assistant',
        content: data.guidance
      }]);
      setIsInitialized(true);
    },
    onError: () => {
      setMessages([{
        role: 'assistant',
        content: `I can help you find your balance breakdown on your ${bankName} statement. However, I encountered an issue getting started. Please try asking me a specific question about your statement.`
      }]);
      setIsInitialized(true);
    }
  });

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const conversationHistory = messages.map(m => ({
        role: m.role,
        content: m.content
      }));
      return await apiRequest("POST", "/api/statement-guidance/chat", {
        bankName,
        message,
        conversationHistory
      });
    },
    onSuccess: (data: any) => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.response
      }]);
    },
    onError: () => {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "I'm sorry, I couldn't process your question. Please try again."
      }]);
    }
  });

  useEffect(() => {
    if (open && bankName && !isInitialized) {
      initialGuidanceMutation.mutate();
    }
  }, [open, bankName]);

  useEffect(() => {
    if (!open) {
      setMessages([]);
      setIsInitialized(false);
      setInputValue("");
    }
  }, [open]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim() || chatMutation.isPending) return;
    
    const userMessage = inputValue.trim();
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setInputValue("");
    chatMutation.mutate(userMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const suggestedQuestions = [
    "Where is the Interest Summary on my statement?",
    "How do I find my promotional 0% balance?",
    "What section shows my balance transfer amount?",
    "How do I find when my promo rate expires?"
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Statement Guide for {bankName}
          </DialogTitle>
          <DialogDescription>
            I'll help you find the balance breakdown on your credit card statement
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 flex flex-col min-h-0">
          <ScrollArea className="flex-1 pr-4" ref={scrollAreaRef}>
            <div className="space-y-4 pb-4">
              {initialGuidanceMutation.isPending && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Researching {bankName} statements...</span>
                </div>
              )}

              {messages.map((message, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex gap-3",
                    message.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === 'assistant' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <Card className={cn(
                    "max-w-[85%] p-3",
                    message.role === 'user' 
                      ? "bg-primary text-primary-foreground" 
                      : "bg-muted/50"
                  )}>
                    <div className="text-sm whitespace-pre-wrap">
                      {message.content}
                    </div>
                  </Card>
                  {message.role === 'user' && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <MessageCircle className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}

              {chatMutation.isPending && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Sparkles className="h-4 w-4 text-primary" />
                  </div>
                  <Card className="bg-muted/50 p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span className="text-sm">Thinking...</span>
                    </div>
                  </Card>
                </div>
              )}
            </div>
          </ScrollArea>

          {messages.length === 1 && isInitialized && (
            <div className="py-3 border-t">
              <p className="text-xs text-muted-foreground mb-2">Quick questions:</p>
              <div className="flex flex-wrap gap-2">
                {suggestedQuestions.map((question, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    className="text-xs h-auto py-1 px-2"
                    onClick={() => {
                      setMessages(prev => [...prev, { role: 'user', content: question }]);
                      chatMutation.mutate(question);
                    }}
                    disabled={chatMutation.isPending}
                    data-testid={`button-suggested-question-${index}`}
                  >
                    {question}
                  </Button>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-3 border-t">
            <Input
              placeholder="Ask about your statement..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={chatMutation.isPending || initialGuidanceMutation.isPending}
              className="flex-1"
              data-testid="input-statement-guidance-message"
            />
            <Button
              onClick={handleSend}
              disabled={!inputValue.trim() || chatMutation.isPending}
              size="icon"
              data-testid="button-send-statement-guidance"
            >
              {chatMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>

          <div className="flex items-center gap-2 pt-3 text-xs text-muted-foreground">
            <FileText className="h-3 w-3" />
            <span>Based on UK credit card statement standards</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface StatementGuidanceButtonProps {
  bankName: string;
  className?: string;
}

export function StatementGuidanceButton({ bankName, className }: StatementGuidanceButtonProps) {
  const [open, setOpen] = useState(false);

  if (!bankName) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className={cn("gap-2", className)}
        data-testid="button-statement-guidance"
      >
        <HelpCircle className="h-4 w-4" />
        Help me find this on my statement
      </Button>
      <StatementGuidanceAssistant
        open={open}
        onOpenChange={setOpen}
        bankName={bankName}
      />
    </>
  );
}
