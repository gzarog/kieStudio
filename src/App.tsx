import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink } from "react-router-dom";
import { ChatPage } from "./pages/ChatPage";
import { ImagePage } from "./pages/ImagePage";
import { MusicPage } from "./pages/MusicPage";
import { VideoPage } from "./pages/VideoPage";
import { KeyModal } from "./components/shared/KeyModal";
import { Toaster } from "./components/shared/Toaster";
import { hasApiKey } from "./lib/apiKey";
import { subscribeKeyRequests } from "./lib/ui";

const NAV = [
  { path: "/", label: "Chat", icon: "💬" },
  { path: "/image", label: "Image", icon: "🖼️" },
  { path: "/music", label: "Music", icon: "🎵" },
  { path: "/video", label: "Video", icon: "🎬" },
];

export default function App() {
  const [showKeyModal, setShowKeyModal] = useState(false);

  // First visit: prompt for key
  useEffect(() => { if (!hasApiKey()) setShowKeyModal(true); }, []);

  // Any page can ask the shell to open the key modal (e.g. an action with no key).
  useEffect(() => subscribeKeyRequests(() => setShowKeyModal(true)), []);

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-base text-white font-sans">
        {/* Sidebar (desktop) */}
        <nav className="hidden md:flex w-52 bg-surface/50 border-r border-edge flex-col p-3 gap-1">
          <p className="text-sky-400 font-bold px-3 py-3 text-lg tracking-tight">KIE Studio</p>
          {NAV.map(({ path, label, icon }) => (
            <NavLink key={path} to={path} end
              className={({ isActive }) =>
                `px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive ? "bg-sky-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}>
              {icon} {label}
            </NavLink>
          ))}
          <button onClick={() => setShowKeyModal(true)}
            className="mt-auto px-3 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-white/5 text-left">
            ⚙️ API Key
          </button>
        </nav>

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0 pb-16 md:pb-0">
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/image" element={<ImagePage />} />
            <Route path="/music" element={<MusicPage />} />
            <Route path="/video" element={<VideoPage />} />
          </Routes>
        </main>

        {/* Bottom tab bar (mobile) */}
        <nav className="md:hidden fixed bottom-0 inset-x-0 bg-surface border-t border-edge flex justify-around py-2 z-40">
          {NAV.map(({ path, icon, label }) => (
            <NavLink key={path} to={path} end
              className={({ isActive }) =>
                `flex flex-col items-center text-xs px-3 py-1 rounded-lg ${
                  isActive ? "text-sky-400" : "text-gray-400"
                }`}>
              <span className="text-lg">{icon}</span>{label}
            </NavLink>
          ))}
          <button onClick={() => setShowKeyModal(true)} className="flex flex-col items-center text-xs px-3 py-1 text-gray-400">
            <span className="text-lg">⚙️</span>Key
          </button>
        </nav>

        {showKeyModal && <KeyModal onClose={() => setShowKeyModal(false)} />}
        <Toaster />
      </div>
    </BrowserRouter>
  );
}
