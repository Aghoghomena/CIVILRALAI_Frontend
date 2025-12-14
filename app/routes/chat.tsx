"use client";

import { useState, useRef, type FormEvent } from "react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "~/components/ui/card";
import { ScrollArea } from "~/components/ui/scroll-area";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { Avatar, AvatarFallback } from "~/components/ui/avatar";
import { cn } from "~/lib/utils";

type Role = "user" | "assistant";

type Message = {
  id: number;
  role: Role;
  content: string;
};

type ChatBotProps = {
  title?: string;
  description?: string;
  /**
   * Optional hook to send the message to your backend / LLM.
   * If provided, should return the assistant reply text.
   */
  onSend?: (message: string, history: Message[]) => Promise<string> | string;
};

export function ChatBot({
  title = "AI Assistant",
  description = "Ask anything and I’ll do my best to help.",
  onSend,
}: ChatBotProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      role: "assistant",
      content: "Hi! How can I help you today?",
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const nextId = useRef(2);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isSending) return;

    const userMsg: Message = {
      id: nextId.current++,
      role: "user",
      content: trimmed,
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setInput("");
    setIsSending(true);

    try {
      let replyText: string;

      if (onSend) {
        // Call your backend / API
        const result = await onSend(trimmed, newHistory);
        replyText = result || "Sorry, I couldn’t generate a response.";
      } else {
        // Fallback dummy reply (for local testing)
        replyText = `You said: "${trimmed}"`;
      }

      const botMsg: Message = {
        id: nextId.current++,
        role: "assistant",
        content: replyText,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      const errorMsg: Message = {
        id: nextId.current++,
        role: "assistant",
        content: "Oops, something went wrong. Please try again.",
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <Card className="flex h-full max-h-[600px] flex-col">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      <CardContent className="flex-1 overflow-hidden">
        <ScrollArea className="h-full pr-4">
          <div className="flex flex-col gap-4">
            {messages.map((m) => (
              <ChatMessage key={m.id} message={m} />
            ))}
          </div>
        </ScrollArea>
      </CardContent>

      <CardFooter>
        <form onSubmit={handleSubmit} className="flex w-full gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={isSending}
          />
          <Button type="submit" disabled={!input.trim() || isSending}>
            {isSending ? "Sending..." : "Send"}
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}

function ChatMessage({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn(
        "flex items-start gap-3",
        isUser ? "justify-end" : "justify-start"
      )}
    >
      {!isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback>AI</AvatarFallback>
        </Avatar>
      )}

      <div
        className={cn(
          "max-w-[80%] rounded-2xl px-3 py-2 text-sm",
          isUser
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted rounded-bl-sm"
        )}
      >
        {message.content}
      </div>

      {isUser && (
        <Avatar className="h-8 w-8">
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
      )}
    </div>
  );
}
