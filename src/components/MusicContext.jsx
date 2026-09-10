import { useContext, useEffect, useMemo, useRef, useState } from "react";
import { IoIosClose, IoMdSkipBackward, IoMdSkipForward } from "react-icons/io";
import { PiShuffleBold, PiSpeakerLowFill } from "react-icons/pi";
import { LuRepeat, LuRepeat1 } from "react-icons/lu";
import { FaPlay, FaPause, FaHeart, FaRegHeart } from "react-icons/fa";
import { MdDownload } from "react-icons/md";
import { CiMaximize1 } from "react-icons/ci";
import MusicContext from "../context/MusicContext";
import he from "he";

const formatTime = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "00:00";
  return `${Math.floor(n / 60).toString().padStart(2, "0")}:${Math.floor(n % 60).toString().padStart(2, "0")}`;
};

const Player = () => {
  const {
    currentSong, isPlaying, shuffle, nextSong, prevSong,
    toggleShuffle, repeatMode, toggleRepeatMode, downloadSong,
  } = useContext(MusicContext);

  const audio = currentSong?.audio;
  const progressRef = useRef(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [volume, setVolume] = useState(() => {
    const saved = Number(localStorage.getItem("volume"));
    return Number.isFinite(saved) ? Math.min(100, Math.max(0, saved)) : 100;
  });
  const [maximized, setMaximized] = useState(false);
  const [liked, setLiked] = useState(() => {
    try { return JSON.parse(localStorage.getItem("likedSongs") || "[]"); }
    catch { return []; }
  });

  const songName = useMemo(() => {
    try { return he.decode(String(currentSong?.name || "Unknown Title")); }
    catch { return String(currentSong?.name || "Unknown Title"); }
  }, [currentSong?.name]);

  const artistNames = useMemo(() => {
    const primary = currentSong?.artists?.primary;
    if (Array.isArray(primary) && primary.length) return primary.map((a) => a?.name).filter(Boolean).join(", ");
    if (Array.isArray(currentSong?.artists)) return currentSong.artists.map((a) => typeof a === "string" ? a : a?.name).filter(Boolean).join(", ");
    return "Unknown Artist";
  }, [currentSong?.artists]);

  const duration = audioDuration || Number(currentSong?.duration) || 0;
  const progress = duration ? Math.min(100, Math.max(0, currentTime / duration * 100)) : 0;
  const isLiked = liked.some((x) => String(x?.id) === String(currentSong?.id));

  useEffect(() => {
    if (!audio) {
      setCurrentTime(0); setAudioDuration(0); return;
    }
    const update = () => {
      setCurrentTime(Number(audio.currentTime) || 0);
      if (Number.isFinite(audio.duration) && audio.duration > 0) setAudioDuration(audio.duration);
    };
    const loaded = () => setAudioDuration(Number(audio.duration) || 0);
    audio.addEventListener("timeupdate", update);
    audio.addEventListener("loadedmetadata", loaded);
    audio.addEventListener("durationchange", loaded);
    update(); loaded();
    return () => {
      audio.removeEventListener("timeupdate", update);
      audio.removeEventListener("loadedmetadata", loaded);
      audio.removeEventListener("durationchange", loaded);
    };
  }, [audio]);

  useEffect(() => {
    if (!audio) return;
    audio.volume = volume / 100;
    audio.loop = repeatMode === "one";
  }, [audio, volume, repeatMode]);

  useEffect(() => {
    setCurrentTime(0);
    setAudioDuration(0);
  }, [currentSong?.id]);

  const togglePlay = async () => {
    if (!audio) return;
    try {
      if (audio.paused) await audio.play();
      else audio.pause();
    } catch (error) { console.error("Play/pause failed", error); }
  };

  const seek = (e) => {
    if (!audio || !duration) return;
    const value = Number(e.target.value);
    audio.currentTime = Math.min(duration, Math.max(0, value / 100 * duration));
    setCurrentTime(audio.currentTime);
  };

  const changeVolume = (e) => {
    const value = Math.min(100, Math.max(0, Number(e.target.value)));
    setVolume(value);
    localStorage.setItem("volume", String(value));
    if (audio) audio.volume = value / 100;
  };

  const toggleLike = () => {
    if (!currentSong?.id) return;
    const updated = isLiked ? liked.filter((x) => String(x?.id) !== String(currentSong.id)) : [...liked, {
      id: currentSong.id, name: currentSong.name, duration: currentSong.duration,
      image: currentSong.image, audio: currentSong.url || currentSong.audioUrl,
      artists: currentSong.artists,
    }];
    setLiked(updated);
    localStorage.setItem("likedSongs", JSON.stringify(updated));
  };

  if (!currentSong) return null;

  const progressStyle = { background: `linear-gradient(to right, currentColor ${progress}%, #777 ${progress}%)` };
  const volumeStyle = { background: `linear-gradient(to right, currentColor ${volume}%, #777 ${volume}%)` };

  return (
    <div className="fixed bottom-14 lg:bottom-0 left-0 w-full z-50 flex justify-center">
      <div className={`w-full bg-auto rounded-t-xl shadow-2xl ${maximized ? "min-h-[90vh] max-h-[90vh] overflow-y-auto p-4" : "p-3 lg:p-4"}`}>
        {maximized ? (
          <div className="w-full max-w-4xl mx-auto flex flex-col gap-5">
            <button className="self-end text-4xl" onClick={() => setMaximized(false)} aria-label="Close"><IoIosClose /></button>
            <img src={currentSong.image || "/Unknown.png"} alt={songName} className="w-64 h-64 sm:w-80 sm:h-80 object-cover rounded-xl mx-auto" />
            <div className="text-center">
              <h2 className="text-2xl font-bold break-words">{songName}</h2>
              <p className="opacity-80">{artistNames}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs">{formatTime(currentTime)}</span>
              <input ref={progressRef} className="range flex-1" type="range" min="0" max="100" step="0.1" value={progress} onChange={seek} style={progressStyle} />
              <span className="text-xs">{formatTime(duration)}</span>
            </div>
            <Controls {...{ isPlaying, togglePlay, prevSong, nextSong, shuffle, toggleShuffle, repeatMode, toggleRepeatMode }} />
            <div className="flex justify-center gap-6">
              <button onClick={toggleLike} title={isLiked ? "Unlike" : "Like"}>{isLiked ? <FaHeart className="text-red-500 text-2xl" /> : <FaRegHeart className="text-2xl" />}</button>
              <button onClick={downloadSong} title="Download"><MdDownload className="text-2xl" /></button>
              <PiSpeakerLowFill className="text-2xl self-center" />
              <input className="volume w-24" type="range" min="0" max="100" value={volume} onChange={changeVolume} style={volumeStyle} />
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs">{formatTime(currentTime)}</span>
              <input ref={progressRef} className="range flex-1" type="range" min="0" max="100" step="0.1" value={progress} onChange={seek} style={progressStyle} aria-label="Song progress" />
              <span className="text-xs">{formatTime(duration)}</span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <button className="flex items-center gap-2 min-w-0 text-left" onClick={() => setMaximized(true)}>
                <img src={currentSong.image || "/Unknown.png"} alt="" className="w-12 h-12 rounded object-cover" />
                <span className="min-w-0">
                  <span className="block font-semibold truncate max-w-[35vw] lg:max-w-[18rem]">{songName}</span>
                  <span className="block text-xs opacity-75 truncate max-w-[35vw] lg:max-w-[18rem]">{artistNames}</span>
                </span>
              </button>
              <Controls {...{ isPlaying, togglePlay, prevSong, nextSong, shuffle, toggleShuffle, repeatMode, toggleRepeatMode }} compact />
              <div className="hidden lg:flex items-center gap-3">
                <button onClick={toggleLike}>{isLiked ? <FaHeart className="text-red-500" /> : <FaRegHeart />}</button>
                <button onClick={downloadSong}><MdDownload className="text-xl" /></button>
                <PiSpeakerLowFill />
                <input className="volume w-20" type="range" min="0" max="100" value={volume} onChange={changeVolume} style={volumeStyle} />
                <button onClick={() => setMaximized(true)}><CiMaximize1 className="text-2xl" /></button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

function Controls({ isPlaying, togglePlay, prevSong, nextSong, shuffle, toggleShuffle, repeatMode, toggleRepeatMode, compact }) {
  return (
    <div className={`flex items-center justify-center ${compact ? "gap-4" : "gap-7"}`}>
      <button onClick={toggleRepeatMode} title="Repeat">{repeatMode === "one" ? <LuRepeat1 className="text-xl text-[#ff3448]" /> : <LuRepeat className="text-xl" />}</button>
      <button onClick={prevSong} title="Previous"><IoMdSkipBackward className="text-2xl" /></button>
      <button onClick={togglePlay} className="rounded-full" title={isPlaying ? "Pause" : "Play"}>{isPlaying ? <FaPause className="text-xl" /> : <FaPlay className="text-xl" />}</button>
      <button onClick={nextSong} title="Next"><IoMdSkipForward className="text-2xl" /></button>
      <button onClick={toggleShuffle} title="Shuffle"><PiShuffleBold className={`text-xl ${shuffle ? "text-[#ff3448]" : ""}`} /></button>
    </div>
  );
}

export default Player;
