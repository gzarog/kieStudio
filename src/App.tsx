import { useState, useEffect } from "react";
import { BrowserRouter, Routes, Route, NavLink, useLocation } from "react-router-dom";
import { ChatPage } from "./pages/ChatPage";
import { ImagePage } from "./pages/ImagePage";
import { MusicPage } from "./pages/MusicPage";
import { VideoPage } from "./pages/VideoPage";
import { SpeechPage } from "./pages/SpeechPage";
import { KeyModal } from "./components/shared/KeyModal";
import { Toaster } from "./components/shared/Toaster";
import { TaskQueueIndicator } from "./components/shared/TaskQueueIndicator";
import { SessionSidebar } from "./components/shared/SessionSidebar";
import { hasApiKey } from "./lib/apiKey";
import { subscribeKeyRequests } from "./lib/ui";
import { subscribeCredits, refreshCredits } from "./lib/credits";

const NAV = [
  { path: "/", label: "Chat", icon: "💬" },
  { path: "/image", label: "Image", icon: "🖼️" },
  { path: "/music", label: "Music", icon: "🎵" },
  { path: "/video", label: "Video", icon: "🎬" },
  { path: "/speech", label: "Speech", icon: "🗣️" },
];

function pageFromPath(pathname: string): string {
  return pathname.replace(/^\//, "") || "chat";
}

function AppShell() {
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [credits, setCreditsState] = useState<number | null>(null);
  const location = useLocation();
  const activePage = pageFromPath(location.pathname);

  useEffect(() => {
    if (!hasApiKey()) setShowKeyModal(true);
    else refreshCredits();
  }, []);

  useEffect(() => subscribeKeyRequests(() => setShowKeyModal(true)), []);
  useEffect(() => subscribeCredits(setCreditsState), []);

  return (
    <div className="flex flex-col h-screen bg-base text-white font-sans">
      {/* Top bar */}
      <header className="flex items-center gap-1 px-4 py-2 bg-surface/80 border-b border-edge shrink-0">
        <span className="text-sky-400 font-bold text-lg tracking-tight mr-4 hidden sm:block">KIE Studio</span>
        <nav className="flex items-center gap-1 overflow-x-auto">
          {NAV.map(({ path, label, icon }) => (
            <NavLink key={path} to={path} end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  isActive ? "bg-sky-600 text-white" : "text-gray-400 hover:text-white hover:bg-white/5"
                }`}>
              <span className="hidden sm:inline">{icon} </span>{label}
            </NavLink>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <TaskQueueIndicator />
          {credits !== null && (
            <span data-testid="credits-badge"
              className="px-2 py-1 rounded-lg bg-white/5 text-gray-300 text-xs font-medium whitespace-nowrap">
              ⚡ {credits} credits
            </span>
          )}
          <button onClick={() => setShowKeyModal(true)}
            aria-label="API key settings"
            className="px-2 py-1.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-sky-400">
            ⚙️<span className="hidden sm:inline"> Key</span>
          </button>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* Session sidebar (desktop) */}
        <SessionSidebar page={activePage} />

        {/* Main */}
        <main className="flex-1 flex flex-col min-w-0 overflow-auto pb-16 md:pb-0">
          <Routes>
            <Route path="/" element={<ChatPage />} />
            <Route path="/image" element={<ImagePage />} />
            <Route path="/music" element={<MusicPage />} />
            <Route path="/video" element={<VideoPage />} />
            <Route path="/speech" element={<SpeechPage />} />
          </Routes>
        </main>
      </div>

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
      </nav>

      {showKeyModal && <KeyModal onClose={() => setShowKeyModal(false)} />}
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
