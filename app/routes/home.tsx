import type { Route } from "./+types/home";
import { Welcome } from "../welcome/welcome";
import { ChatBot } from "./chat";


export default function ChatPage() {
  return (
    <div className="mx-auto flex h-[80vh] max-w-3xl flex-col p-4">
      <ChatBot
        title="CiviralAI Welfare Assistant"
        description="Lets help you with all your welfare quereies."
        onSend={async (message, history) => {
          try {
            // Call your backend API
            const response = await fetch("http://localhost:8000/api/chat", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                message: message,
                history: history,  // Optional: pass history if needed
              }),
            });

            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.reply || "Sorry, I couldn't generate a response.";
          } catch (error) {
            console.error("Error calling API:", error);
            return `Sorry, there was an error: ${error instanceof Error ? error.message : "Unknown error"}`;
          }
        }}
      />
    </div>
  );
}

