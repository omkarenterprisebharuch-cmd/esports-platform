"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useChat } from "@/contexts/ChatContext";
import { ChatMessage } from "@/lib/socket-client";

interface TournamentChatRoomProps {
  tournamentId: number | string;
  tournamentName: string;
  registeredUserIds: (number | string)[];
  tournamentEndTime: string;
  currentUserId: number | string;
  isOpen: boolean;
  onClose: () => void;
}

export default function TournamentChatRoom({
  tournamentId,
  tournamentName,
  registeredUserIds,
  tournamentEndTime,
  currentUserId,
  isOpen,
  onClose,
}: TournamentChatRoomProps) {
  const {
    isConnected,
    messages,
    activeUserCount,
    error,
    isChatClosed,
    connect,
    joinChat,
    leaveChat,
    send,
    clearError,
  } = useChat();

  const [inputMessage, setInputMessage] = useState("");
  const [hasJoined, setHasJoined] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Connect and join chat when modal opens
  useEffect(() => {
    if (isOpen && !hasJoined) {
      const token = localStorage.getItem("token");
      if (token) {
        connect(token);
      }
    }
  }, [isOpen, hasJoined, connect]);

  // Join chat room once connected
  useEffect(() => {
    if (isOpen && isConnected && !hasJoined) {
      joinChat(tournamentId, registeredUserIds, tournamentEndTime);
      setHasJoined(true);
    }
  }, [isOpen, isConnected, hasJoined, tournamentId, registeredUserIds, tournamentEndTime, joinChat]);

  // Leave chat when modal closes
  useEffect(() => {
    if (!isOpen && hasJoined) {
      leaveChat(tournamentId);
      setHasJoined(false);
    }
  }, [isOpen, hasJoined, tournamentId, leaveChat]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen && hasJoined) {
      inputRef.current?.focus();
    }
  }, [isOpen, hasJoined]);

  const handleSend = useCallback(() => {
    if (inputMessage.trim()) {
      send(tournamentId, inputMessage);
      setInputMessage("");
    }
  }, [tournamentId, inputMessage, send]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const formatTime = (timestamp: Date) => {
    return new Date(timestamp).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-gray-900 to-gray-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-2xl">💬</span>
            <div>
              <h2 className="font-semibold text-lg leading-tight">{tournamentName}</h2>
              <p className="text-xs text-gray-300">Tournament Chat</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {/* Active Users Count */}
            {activeUserCount > 0 && (
              <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full">
                <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                <span className="text-sm font-medium">{activeUserCount}</span>
              </div>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
            >
              <span className="text-xl">×</span>
            </button>
          </div>
        </div>

        {/* Connection Status */}
        {!isConnected && !isChatClosed && (
          <div className="px-4 py-2 bg-yellow-50 border-b border-yellow-200 text-yellow-700 text-sm flex items-center gap-2">
            <div className="animate-spin w-4 h-4 border-2 border-yellow-600 border-t-transparent rounded-full"></div>
            Connecting to chat...
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-red-600 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button onClick={clearError} className="text-red-500 hover:text-red-700">
              ×
            </button>
          </div>
        )}

        {/* Chat Closed Notice */}
        {isChatClosed && (
          <div className="px-4 py-8 text-center text-gray-500">
            <span className="text-4xl block mb-2">🏁</span>
            <p className="font-medium">Tournament has ended</p>
            <p className="text-sm">Chat history has been cleared</p>
          </div>
        )}

        {/* Messages */}
        {!isChatClosed && (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 min-h-[300px]">
            {/* Chat Messages */}
            {messages.length === 0 && !isChatClosed && (
              <div className="text-center text-gray-500 py-8">
                <span className="text-4xl block mb-2">👋</span>
                <p>No messages yet. Be the first to say hello!</p>
              </div>
            )}

            {messages.map((msg: ChatMessage) => {
              const isOwnMessage = String(msg.userId) === String(currentUserId);
              return (
                <div
                  key={msg.id}
                  className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2 ${
                      isOwnMessage
                        ? "bg-gray-900 text-white rounded-br-md"
                        : "bg-white border border-gray-200 rounded-bl-md"
                    }`}
                  >
                    {!isOwnMessage && (
                      <p className="text-xs font-semibold text-gray-600 mb-1">
                        {msg.username}
                      </p>
                    )}
                    <p className={`text-sm ${isOwnMessage ? "text-white" : "text-gray-800"}`}>
                      {msg.message}
                    </p>
                    <p
                      className={`text-xs mt-1 ${
                        isOwnMessage ? "text-gray-400" : "text-gray-400"
                      }`}
                    >
                      {formatTime(msg.timestamp)}
                    </p>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}

        {/* Input */}
        {!isChatClosed && (
          <div className="p-4 bg-white border-t border-gray-200">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type a message..."
                maxLength={500}
                disabled={!isConnected}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-full focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSend}
                disabled={!isConnected || !inputMessage.trim()}
                className="px-6 py-2 bg-gray-900 text-white rounded-full font-medium hover:bg-gray-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Send
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
              Messages are temporary and will be deleted when the tournament ends
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
