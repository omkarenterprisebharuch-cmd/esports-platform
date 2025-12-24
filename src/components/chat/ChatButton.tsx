"use client";

import React, { useState, useEffect } from "react";

interface ChatButtonProps {
  tournamentId: number | string;
  registrationStartDate: string;
  tournamentEndDate: string;
  isRegistered: boolean;
  onClick: () => void;
}

export default function ChatButton({
  registrationStartDate,
  tournamentEndDate,
  isRegistered,
  onClick,
}: ChatButtonProps) {
  const [canChat, setCanChat] = useState(false);
  const [chatStatus, setChatStatus] = useState<string>("");

  useEffect(() => {
    const checkChatAvailability = () => {
      const now = new Date();
      const regStart = new Date(registrationStartDate);
      const tournamentEnd = new Date(tournamentEndDate);

      if (!isRegistered) {
        setChatStatus("Register to access chat");
        setCanChat(false);
        return;
      }

      if (now < regStart) {
        setChatStatus("Chat opens after registration starts");
        setCanChat(false);
        return;
      }

      if (now > tournamentEnd) {
        setChatStatus("Tournament ended - Chat closed");
        setCanChat(false);
        return;
      }

      setChatStatus("Chat with other participants");
      setCanChat(true);
    };

    checkChatAvailability();
    const interval = setInterval(checkChatAvailability, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [registrationStartDate, tournamentEndDate, isRegistered]);

  if (!isRegistered) {
    return null;
  }

  return (
    <div className="w-full">
      <button
        onClick={onClick}
        disabled={!canChat}
        className={`w-full py-3 px-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition ${
          canChat
            ? "bg-blue-600 text-white hover:bg-blue-700"
            : "bg-gray-200 text-gray-500 cursor-not-allowed"
        }`}
      >
        <span className="text-xl">💬</span>
        <span>{canChat ? "Chat Now" : chatStatus}</span>
      </button>
      {canChat && (
        <p className="text-xs text-gray-500 text-center mt-1">
          {chatStatus}
        </p>
      )}
    </div>
  );
}
