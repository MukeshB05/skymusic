import { useCallback, useEffect, useRef, useState } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import AlbumDetail from "./pages/AlbumDetails";
import Home from "./pages/Home";
import MusicContext from "./context/MusicContext";
import ArtistsDetails from "./pages/ArtistsDetails";
import SearchResult from "./pages/searchResult";
import PlaylistDetails from "./pages/PlaylistDetails";
import Playlist from "./pages/Playlist";
import Favourite from "./pages/Favourite";
import Player from "./components/MusicContext";
import he from "he";
import { Analytics } from "@vercel/analytics/react";
import { SpeedInsights } from "@vercel/speed-insights/react";
import { IoIosCheckmarkCircle } from "react-icons/io";

const getAudioUrl = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    const item = [...value].reverse().find((x) => x?.url || x?.link);
    return item?.url || item?.link || "";
  }
  if (typeof value === "object") return value.url || value.link || "";
  return "";
};

const getImageUrl = (value) => {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return value[2]?.url || value[1]?.url || value[0]?.url || "";
  }
  if (typeof value === "object") return value.url || value.link || "";
  return "";
};

const normalizeSong = (raw = {}) => ({
  ...raw,
  id: raw?.id,
  name: raw?.name || "Unknown Song",
  duration: Number(raw?.duration) || 0,
  image: getImageUrl(raw?.image),
  audioUrl: getAudioUrl(raw?.downloadUrl) || getAudioUrl(raw?.audio) || getAudioUrl(raw?.url),
  artists: raw?.artists || {},
});

export default function App() {
  const [songs, setSongs] = useState([]);
  const [song, setSong] = useState([]);
  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState("none");
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const audioRef = useRef(null);
  const songsRef = useRef([]);
  const shuffleRef = useRef(false);
  const repeatRef = useRef("none");

  useEffect(() => { songsRef.current = songs; }, [songs]);
  useEffect(() => { shuffleRef.current = shuffle; }, [shuffle]);
  useEffect(() => { repeatRef.current = repeatMode; }, [repeatMode]);

  const saveToLocalStorage = useCallback((raw) => {
    const item = normalizeSong(raw);
    if (!item.id) return;
    try {
      const old = JSON.parse(localStorage.getItem("playedSongs") || "[]");
      const updated = [item, ...old.filter((x) => x?.id !== item.id)].slice(0, 20);
      localStorage.setItem("playedSongs", JSON.stringify(updated));
    } catch (error) {
      console.error("Could not save recently played song", error);
    }
  }, []);

  const playNormalizedSong = useCallback(async (raw, queue = songsRef.current) => {
    const item = normalizeSong(raw);
    if (!item.audioUrl) {
      console.error("No playable audio URL:", raw);
      return false;
    }

    const oldAudio = audioRef.current;
    if (oldAudio) {
      oldAudio.pause();
      oldAudio.removeAttribute("src");
      oldAudio.load();
    }

    const audio = new Audio();
    audio.preload = "metadata";
    audio.volume = Number(localStorage.getItem("volume") ?? 100) / 100;
    audio.src = item.audioUrl;
    audioRef.current = audio;

    const current = {
      ...item,
      audio,
      url: item.audioUrl,
      downloadUrl: item.audioUrl,
    };

    setCurrentSong(current);
    setSongs((prev) => (queue?.length ? queue : prev));
    saveToLocalStorage(item);

    audio.onplay = () => setIsPlaying(true);
    audio.onpause = () => setIsPlaying(false);
    audio.onerror = () => {
      console.error("Audio failed to load:", audio.error, item.audioUrl);
      setIsPlaying(false);
    };
    audio.onended = () => {
      if (repeatRef.current === "one") {
        audio.currentTime = 0;
        audio.play().catch((error) => console.error("Repeat play failed", error));
        return;
      }

      const queueNow = songsRef.current.filter(Boolean);
      if (!queueNow.length) {
        setIsPlaying(false);
        return;
      }

      const currentIndex = queueNow.findIndex((x) => String(x?.id) === String(item.id));
      let nextIndex;

      if (shuffleRef.current) {
        if (queueNow.length === 1) nextIndex = 0;
        else {
          do { nextIndex = Math.floor(Math.random() * queueNow.length); }
          while (nextIndex === currentIndex);
        }
      } else {
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % queueNow.length;
      }

      const next = queueNow[nextIndex];
      if (next) playNormalizedSong(next, queueNow);
    };

    try {
      await audio.play();
      return true;
    } catch (error) {
      console.error("Audio play failed:", error);
      setIsPlaying(false);
      return false;
    }
  }, [saveToLocalStorage]);

  const playMusic = useCallback(async (downloadUrl, name, duration, image, id, artists, songList) => {
    const raw = {
      ...(typeof songList === "object" && !Array.isArray(songList) ? songList : {}),
      id,
      name,
      duration,
      image,
      artists,
      downloadUrl,
    };

    const normalized = normalizeSong(raw);
    const queue = Array.isArray(songList) ? songList.filter(Boolean) : songsRef.current;

    if (currentSong?.id != null && String(currentSong.id) === String(id) && audioRef.current) {
      if (audioRef.current.paused) {
        try { await audioRef.current.play(); } catch (error) { console.error(error); }
      } else {
        audioRef.current.pause();
      }
      return;
    }

    await playNormalizedSong(normalized, queue);
  }, [currentSong?.id, playNormalizedSong]);

  const nextSong = useCallback(async () => {
    const queue = songsRef.current.filter(Boolean);
    if (!queue.length) return;
    const currentId = currentSong?.id;
    const currentIndex = queue.findIndex((x) => String(x?.id) === String(currentId));
    let nextIndex;

    if (shuffleRef.current) {
      if (queue.length === 1) nextIndex = 0;
      else {
        do { nextIndex = Math.floor(Math.random() * queue.length); }
        while (nextIndex === currentIndex);
      }
    } else {
      nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % queue.length;
    }
    await playNormalizedSong(queue[nextIndex], queue);
  }, [currentSong?.id, playNormalizedSong]);

  const prevSong = useCallback(async () => {
    const audio = audioRef.current;
    if (audio && audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }

    const queue = songsRef.current.filter(Boolean);
    if (!queue.length) return;
    const currentIndex = queue.findIndex((x) => String(x?.id) === String(currentSong?.id));
    let prevIndex;

    if (shuffleRef.current) {
      if (queue.length === 1) prevIndex = 0;
      else {
        do { prevIndex = Math.floor(Math.random() * queue.length); }
        while (prevIndex === currentIndex);
      }
    } else {
      prevIndex = currentIndex <= 0 ? queue.length - 1 : currentIndex - 1;
    }
    await playNormalizedSong(queue[prevIndex], queue);
  }, [currentSong?.id, playNormalizedSong]);

  const toggleShuffle = useCallback(() => setShuffle((value) => !value), []);
  const toggleRepeatMode = useCallback(() => setRepeatMode((value) => value === "none" ? "one" : "none"), []);

  const downloadSong = useCallback(async () => {
    const url = audioRef.current?.currentSrc || currentSong?.audioUrl || currentSong?.url;
    if (!url) return alert("Download URL is not available!");

    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `${he.decode(String(currentSong?.name || "song"))}.mp3`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 2500);
    } catch (error) {
      console.error("Download failed", error);
      // Fallback for servers that do not allow CORS blob downloads.
      const link = document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    }
  }, [currentSong]);

  useEffect(() => () => {
    audioRef.current?.pause();
    audioRef.current = null;
  }, []);

  const contextValue = {
    songs,
    song,
    setSongs,
    setSong,
    playMusic,
    setIsPlaying,
    isPlaying,
    currentSong,
    nextSong,
    prevSong,
    shuffle,
    toggleShuffle,
    downloadSong,
    toggleRepeatMode,
    repeatMode,
  };

  return (
    <MusicContext.Provider value={contextValue}>
      <SpeedInsights />
      <Analytics />
      <Router>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/artists/:id" element={<ArtistsDetails />} />
          <Route path="/albums/:id" element={<AlbumDetail />} />
          <Route path="/search/:query" element={<SearchResult />} />
          <Route path="/playlists/:id" element={<PlaylistDetails />} />
          <Route path="/Playlist" element={<Playlist />} />
          <Route path="/Favourite" element={<Favourite />} />
        </Routes>
        <Player />
      </Router>
      {showSuccessPopup && (
        <div className="fixed flex justify-center items-center w-full z-[100] top-6 pointer-events-none">
          <div className="flex bg-[#2c2c2c] text-white p-3 rounded shadow-xl gap-3">
            <IoIosCheckmarkCircle className="self-center text-xl" />
            <h2 className="font-semibold">Downloaded</h2>
          </div>
        </div>
      )}
    </MusicContext.Provider>
  );
}
