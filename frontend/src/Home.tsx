"use client";
import React, { useState, useRef, useEffect } from "react";
import {
  Send,
  Plus,
  MessageSquare,
  Book,
  Upload,
  X,
  Menu,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// ← set this to your backend origin
const API_BASE = "http://localhost:8000";

const SUBJECTS = [
  "Mathematics 2",
  "Theory of Computation",
  "Data Structures",
  "IOT",
  "DBMS"
];

const MarkdownRenderer = ({ content }) => {
  const renderContent = (text) => {
    // Bold
    text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    // Italic
    text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
    // Code blocks
    text = text.replace(
      /```(\w+)?\n([\s\S]+?)```/g,
      '<pre class="bg-gray-800 text-gray-100 p-4 rounded-lg overflow-x-auto my-2"><code>$2</code></pre>'
    );
    // Inline code
    text = text.replace(
      /`(.+?)`/g,
      '<code class="bg-gray-200 px-1.5 py-0.5 rounded text-sm">$1</code>'
    );
    // Headers
    text = text.replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>');
    text = text.replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>');
    text = text.replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>');
    // Lists
    text = text.replace(/^\* (.+)$/gm, '<li class="ml-4">$1</li>');
    text = text.replace(/(<li.*<\/li>)/s, '<ul class="list-disc my-2">$1</ul>');
    // Line breaks
    text = text.replace(/\n/g, "<br/>");
    return text;
  };

  return (
    <div
      className="prose prose-sm max-w-none"
      dangerouslySetInnerHTML={{ __html: renderContent(content) }}
    />
  );
};

export default function Home() {
  const [conversations, setConversations] = useState([]);
  const [activeConvId, setActiveConvId] = useState(null);
  const [activeConvMeta, setActiveConvMeta] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [newConvTitle, setNewConvTitle] = useState("");
  const [newConvSubject, setNewConvSubject] = useState("");
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadConversations();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingMessage]);

  // Load list of conversations and auto-open first
  const loadConversations = async () => {
    try {
      const res = await fetch(`${API_BASE}/historys/`);
      const data = await res.json();
      const convs = (data || []).map((c) => ({
        id: c.conversation_id?.toString() ?? String(c.id ?? Date.now()),
        title: c.title,
        subject: c.subject,
      }));
      setConversations(convs);

      if (convs.length > 0) {
        const first = convs[0];
        setActiveConvId(first.id);
        setActiveConvMeta(first);
        await loadHistory(first.id);
      } else {
        setActiveConvId(null);
        setActiveConvMeta(null);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to load conversations", err);
    }
  };

  // Load messages for a conversation
  const loadHistory = async (conversationId) => {
    try {
      const res = await fetch(`${API_BASE}/history/${conversationId}`);
      const data = await res.json();
      if (data?.messages) {
        const msgs = data.messages.map((m) => ({
          id: m.message_id?.toString() ?? Math.random().toString(),
          role: m.role,
          content: m.content,
        }));
        setMessages(msgs);
        setStreamingMessage("");
        setActiveConvMeta({ conversation_id: data.conversation_id?.toString(), title: data.title, subject: data.subject });
      } else if (data?.error) {
        console.error(data.error);
        setMessages([]);
      }
    } catch (err) {
      console.error("Failed to load history", err);
      setMessages([]);
    }
  };

  const handleCreateConversation = async () => {
    if (!newConvTitle.trim() || !newConvSubject) return;

    try {
      const form = new FormData();
      form.append("title", newConvTitle);
      form.append("subject", newConvSubject);
      uploadedFiles.slice(0, 5).forEach((f) => form.append("files", f, f.name));

      const res = await fetch(`${API_BASE}/create`, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Create failed: ${res.status}`);
      const data = await res.json();
      const newId = data.conversation_id?.toString();

      const newConv = { id: newId, title: newConvTitle, subject: newConvSubject };
      setConversations((prev) => [newConv, ...prev]);
      setActiveConvId(newId);
      setActiveConvMeta(newConv);
      setMessages([]);
      setNewConvTitle("");
      setNewConvSubject("");
      setUploadedFiles([]);
      setIsDialogOpen(false);

      // load history (likely empty)
      await loadHistory(newId);
    } catch (err) {
      console.error("Failed to create conversation", err);
      alert("Failed to create conversation. See console for details.");
    }
  };

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || []);
    const pdfFiles = files.filter((f) => f.type === "application/pdf");
    if (uploadedFiles.length + pdfFiles.length > 5) {
      alert("Maximum 5 PDFs allowed");
      return;
    }
    setUploadedFiles((prev) => [...prev, ...pdfFiles.slice(0, 5 - prev.length)]);
  };

  const removeFile = (index) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleConversationClick = async (conv) => {
    setActiveConvId(conv.id);
    setActiveConvMeta(conv);
    await loadHistory(conv.id);
  };

  const deleteConversation = async (id) => {
    try {
      await fetch(`${API_BASE}/${id}/delete`, { method: "DELETE" });
    } catch (err) {
      console.error("Delete failed", err);
    }
    // refresh and auto-open first
    await loadConversations();
  };

  // Send message and stream assistant response; streaming content passed to MarkdownRenderer
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !activeConvId) return;

    const userMessage = { id: Date.now().toString(), role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);
    setStreamingMessage("");

    try {
      const url = `${API_BASE}/${activeConvId}/get?query=${encodeURIComponent(userMessage.content)}`;
      const res = await fetch(url);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Response not ok: ${res.status}`);
      }
      if (!res.body) throw new Error("ReadableStream not supported by this environment");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantContent = "";

      // Add a temporary assistant message so UI shows something while streaming
      setMessages((prev) => [...prev, { id: `assistant-temp-${Date.now()}`, role: "assistant", content: "" }]);

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          const chunk = decoder.decode(value);
          assistantContent += chunk;
          setStreamingMessage(assistantContent);
          // update the temp assistant message in messages array for live preview
          setMessages((prev) => {
            const copy = [...prev];
            const idx = copy.findIndex((m) => m.id && String(m.id).startsWith("assistant-temp-"));
            if (idx !== -1) {
              copy[idx] = { ...copy[idx], content: assistantContent };
            } else {
              copy.push({ id: `assistant-temp-${Date.now()}`, role: "assistant", content: assistantContent });
            }
            return copy;
          });
        }
      }

      // Once streaming complete, clear streamingMessage and refresh history from backend (backend saved assistant message)
      setStreamingMessage("");
      await loadHistory(activeConvId);
    } catch (err) {
      console.error("Send message failed", err);
      alert("Failed to get AI response. See console for details.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50">
      {/* Sidebar */}
      <div
        className={`${sidebarOpen ? "w-80" : "w-0"} transition-all duration-300 bg-white border-r border-gray-200 flex flex-col overflow-hidden shadow-lg`}
      >
        <div className="p-4 border-b border-gray-200 bg-gradient-to-r from-indigo-600 to-purple-600">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 text-white">
              <Book className="w-6 h-6" />
              <h1 className="text-xl font-bold">Study Helper</h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden text-white hover:bg-white/20"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="w-full bg-white text-indigo-600 hover:bg-gray-100 font-semibold shadow-md">
                <Plus className="w-4 h-4 mr-2" />
                New Conversation
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-white">
              <DialogHeader>
                <DialogTitle className="text-2xl font-bold text-gray-800">
                  Create New Conversation
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Title
                  </label>
                  <Input
                    placeholder="e.g., Calculus Chapter 5"
                    value={newConvTitle}
                    onChange={(e) => setNewConvTitle(e.target.value)}
                    className="border-gray-300"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Subject
                  </label>
                  <Select value={newConvSubject} onValueChange={setNewConvSubject}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select a subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUBJECTS.map((subject) => (
                        <SelectItem key={subject} value={subject}>
                          {subject}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700 mb-2 block">
                    Upload PDFs (Max 5)
                  </label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    accept=".pdf"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full"
                    disabled={uploadedFiles.length >= 5}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose PDFs ({uploadedFiles.length}/5)
                  </Button>

                  {uploadedFiles.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {uploadedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                        >
                          <span className="text-sm truncate flex-1">{file.name}</span>
                          <Button size="sm" variant="ghost" onClick={() => removeFile(index)} className="ml-2">
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Button
                  onClick={handleCreateConversation}
                  disabled={!newConvTitle.trim() || !newConvSubject}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold"
                >
                  Create Conversation
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
            Recent Conversations
          </h2>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className={`group p-3 rounded-lg cursor-pointer transition-all ${
                activeConvId === conv.id
                  ? "bg-gradient-to-r from-indigo-100 to-purple-100 shadow-md"
                  : "hover:bg-gray-50"
              }`}
              onClick={() => handleConversationClick(conv)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <MessageSquare className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                    <h3 className="font-medium text-gray-900 truncate">{conv.title}</h3>
                  </div>
                  <p className="text-xs text-gray-500">{conv.subject}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(conv.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 transition-opacity ml-2"
                >
                  <Trash2 className="w-4 h-4 text-red-500" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        <div className="bg-white border-b border-gray-200 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!sidebarOpen && (
                <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(true)}>
                  <Menu className="w-5 h-5" />
                </Button>
              )}
              <div>
                <h2 className="text-xl font-bold text-gray-800">{activeConvMeta?.title ?? "No conversation"}</h2>
                <p className="text-sm text-gray-500">{activeConvMeta?.subject}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <Book className="w-16 h-16 text-indigo-300 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-700 mb-2">Start Learning!</h3>
                <p className="text-gray-500">Ask me anything about {activeConvMeta?.subject}</p>
              </div>
            </div>
          )}

          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-3xl rounded-2xl px-6 py-4 ${
                  message.role === "user"
                    ? "bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg"
                    : "bg-white text-gray-800 shadow-md border border-gray-100"
                }`}
              >
                {message.role === "user" ? (
                  <p className="whitespace-pre-wrap">{message.content}</p>
                ) : (
                  <MarkdownRenderer content={message.content} />
                )}
              </div>
            </div>
          ))}

          {streamingMessage && (
            <div className="flex justify-start">
              <div className="max-w-3xl rounded-2xl px-6 py-4 bg-white text-gray-800 shadow-md border border-gray-100">
                <MarkdownRenderer content={streamingMessage} />
                <span className="inline-block w-2 h-5 bg-indigo-600 ml-1 animate-pulse"></span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="border-t border-gray-200 bg-white p-4 shadow-lg">
          <div className="max-w-4xl mx-auto">
            <div className="flex gap-3">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && !e.shiftKey && handleSendMessage()}
                placeholder={`Ask about ${activeConvMeta?.subject ?? "..."}...`}
                className="flex-1 border-gray-300 focus:ring-2 focus:ring-indigo-500 rounded-xl px-4 py-6 text-base"
                disabled={isLoading}
              />
              <Button
                onClick={handleSendMessage}
                disabled={isLoading || !input.trim()}
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white px-8 rounded-xl shadow-lg disabled:opacity-50"
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
