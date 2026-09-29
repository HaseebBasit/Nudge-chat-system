import React, { useState, useRef, useEffect } from 'react';
import { getMediaUrl } from '../../services/mediaService.js';
import { formatAudioDuration } from '../../utils/formatTime.js';

export const VoicePlayer = ({ mediaId, totalDuration = 0, isMyMessage = false }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(totalDuration || 0);
  const audioRef = useRef(null);

  const audioUrl = mediaId ? getMediaUrl(mediaId) : '';

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration)) {
        setDuration(audio.duration);
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.error('Playback error:', err);
      });
    }
  };

  const handleSeek = (e) => {
    const seekTime = Number(e.target.value);
    const audio = audioRef.current;
    if (audio) {
      audio.currentTime = seekTime;
      setCurrentTime(seekTime);
    }
  };

  return (
    <div className="nudge-voice-player">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      <button
        type="button"
        className="voice-play-btn"
        onClick={togglePlay}
        title={isPlaying ? 'Pause' : 'Play voice message'}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>

      <input
        type="range"
        className="voice-track-slider"
        min="0"
        max={duration > 0 ? duration : 100}
        value={currentTime}
        onChange={handleSeek}
      />

      <span className="voice-duration">
        {isPlaying ? formatAudioDuration(currentTime) : formatAudioDuration(duration || totalDuration)}
      </span>
    </div>
  );
};
