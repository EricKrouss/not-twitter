import { useEffect, useMemo, useRef, useState } from 'react';
import cn from 'clsx';
import Hls from 'hls.js';
import { formatNumber } from '@lib/date';
import { preventBubbling } from '@lib/utils';
import { Button } from './button';
import type { CSSProperties, SVGProps } from 'react';

type TwitterVideoPlayerProps = {
  src: string;
  poster?: string | null;
  label?: string;
  className?: string;
  videoClassName?: string;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  compact?: boolean;
  viewCount?: number | null;
  objectFit?: 'cover' | 'contain';
  initialVolume?: number;
};

type QualityOption = {
  label: string;
  src: string;
  height: number;
  bandwidth: number;
};

type PlaybackSpeed = 0.5 | 1 | 1.5 | 2;

const playbackSpeeds: readonly PlaybackSpeed[] = [0.5, 1, 1.5, 2];
const lowInitialVolume = 0.04;
const compactSettingsHeight = 390;
const tightControlsWidth = 430;

function formatVideoTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';

  const roundedSeconds = Math.floor(seconds);
  const hours = Math.floor(roundedSeconds / 3600);
  const minutes = Math.floor((roundedSeconds % 3600) / 60);
  const remainingSeconds = roundedSeconds % 60;
  const paddedSeconds = remainingSeconds.toString().padStart(2, '0');

  if (hours)
    return `${hours}:${minutes.toString().padStart(2, '0')}:${paddedSeconds}`;

  return `${minutes}:${paddedSeconds}`;
}

function getSpeedLabel(speed: PlaybackSpeed): string {
  return speed === 1 ? 'Normal' : `${speed}x speed`;
}

function getQualityLabel(height: number, bandwidth: number): string {
  if (height) return `${height}p`;

  return `${Math.max(Math.round(bandwidth / 1000), 1)} kbps`;
}

function normalizeQualityOptions(options: QualityOption[]): QualityOption[] {
  return options
    .filter(
      (variant, index, allVariants) =>
        allVariants.findIndex(({ src }) => src === variant.src) === index
    )
    .sort((first, second) => {
      if (second.height !== first.height) return second.height - first.height;
      return second.bandwidth - first.bandwidth;
    });
}

function parseQualityOptions(
  playlist: string,
  playlistSrc: string
): QualityOption[] {
  const lines = playlist
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const variants: QualityOption[] = [];

  lines.forEach((line, index) => {
    if (!line.startsWith('#EXT-X-STREAM-INF')) return;

    const nextLine = lines[index + 1];
    if (!nextLine || nextLine.startsWith('#')) return;

    const resolution = line.match(/RESOLUTION=(\d+)x(\d+)/);
    const bandwidth = line.match(/BANDWIDTH=(\d+)/);
    const height = resolution ? Number(resolution[2]) : 0;
    const bitrate = bandwidth ? Number(bandwidth[1]) : 0;

    variants.push({
      label: getQualityLabel(height, bitrate),
      src: new URL(nextLine, playlistSrc).toString(),
      height,
      bandwidth: bitrate
    });
  });

  return normalizeQualityOptions(variants);
}

function getHlsQualityOptions(hls: Hls): QualityOption[] {
  return normalizeQualityOptions(
    hls.levels.map(({ bitrate, height, url }) => ({
      label: getQualityLabel(height, bitrate),
      src: url[0],
      height,
      bandwidth: bitrate
    }))
  );
}

function isHlsPlaylist(videoSrc: string): boolean {
  return /\.m3u8(?:$|[?#])/.test(videoSrc);
}

type TwitterVideoIconName =
  | 'check'
  | 'fullscreen'
  | 'fullscreen-exit'
  | 'pause'
  | 'play'
  | 'settings'
  | 'volume'
  | 'volume-muted';

function TwitterVideoIcon({
  iconName,
  className
}: SVGProps<SVGSVGElement> & {
  iconName: TwitterVideoIconName;
}): JSX.Element {
  const commonProps = {
    className,
    viewBox: '0 0 24 24',
    'aria-hidden': true
  };

  switch (iconName) {
    case 'check':
      return (
        <svg {...commonProps} fill='none'>
          <path
            d='m5.5 12.5 4.1 4.1 8.9-9.2'
            stroke='currentColor'
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth='2.1'
          />
        </svg>
      );
    case 'fullscreen':
      return (
        <svg {...commonProps} fill='currentColor'>
          <path d='M14.2 3.5H21v6.8h-2V6.9l-5.1 5.1-1.4-1.4 5.1-5.1h-3.4v-2zM10.1 12l1.4 1.4-5.1 5.1h3.4v2H3v-6.8h2v3.4l5.1-5.1z' />
        </svg>
      );
    case 'fullscreen-exit':
      return (
        <svg {...commonProps} fill='currentColor'>
          <path d='M12.8 5.7h3.4l-5.1 5.1 1.4 1.4 5.1-5.1v3.4h2V3.7h-6.8v2zM11.2 18.3H7.8l5.1-5.1-1.4-1.4-5.1 5.1v-3.4h-2v6.8h6.8v-2z' />
        </svg>
      );
    case 'pause':
      return (
        <svg {...commonProps} fill='currentColor'>
          <path d='M7 5.2h3.2v13.6H7V5.2zm6.8 0H17v13.6h-3.2V5.2z' />
        </svg>
      );
    case 'play':
      return (
        <svg {...commonProps} fill='currentColor'>
          <path d='M8 5.1v13.8L18.8 12 8 5.1z' />
        </svg>
      );
    case 'settings':
      return (
        <svg {...commonProps} fill='none'>
          <path
            d='M12 8.9a3.1 3.1 0 1 1 0 6.2 3.1 3.1 0 0 1 0-6.2z'
            stroke='currentColor'
            strokeWidth='1.8'
          />
          <path
            d='m19.1 13.4 1.5 1.1-1.7 3-1.8-.7a7.1 7.1 0 0 1-1.4.8l-.3 1.9H8.6l-.3-1.9a7.1 7.1 0 0 1-1.4-.8l-1.8.7-1.7-3 1.5-1.1a7.6 7.6 0 0 1 0-2.8L3.4 9.5l1.7-3 1.8.7a7.1 7.1 0 0 1 1.4-.8l.3-1.9h6.8l.3 1.9c.5.2 1 .5 1.4.8l1.8-.7 1.7 3-1.5 1.1a7.6 7.6 0 0 1 0 2.8z'
            stroke='currentColor'
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth='1.8'
          />
        </svg>
      );
    case 'volume':
      return (
        <svg {...commonProps} fill='none'>
          <path
            d='M4 9.2h4.1L13 5v14l-4.9-4.2H4V9.2zM16.2 8.4a5.3 5.3 0 0 1 0 7.2M18.9 5.8a8.9 8.9 0 0 1 0 12.4'
            stroke='currentColor'
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth='1.9'
          />
        </svg>
      );
    case 'volume-muted':
      return (
        <svg {...commonProps} fill='none'>
          <path
            d='M4 9.2h4.1L13 5v14l-4.9-4.2H4V9.2zM16.6 9.2l4.2 4.2M20.8 9.2l-4.2 4.2'
            stroke='currentColor'
            strokeLinecap='round'
            strokeLinejoin='round'
            strokeWidth='1.9'
          />
        </svg>
      );
  }
}

function TwitterVideoInitialPlayIcon(): JSX.Element {
  return (
    <svg
      className='h-[50px] w-[50px] translate-x-[2px]'
      viewBox='0 0 24 24'
      aria-hidden='true'
    >
      <path fill='currentColor' d='M6.7 2.7v18.6L21 12 6.7 2.7z' />
    </svg>
  );
}

export function TwitterVideoPlayer({
  src,
  poster,
  label = 'Video',
  className,
  videoClassName,
  autoPlay,
  loop,
  muted = true,
  compact,
  viewCount,
  objectFit = 'cover',
  initialVolume = lowInitialVolume
}: TwitterVideoPlayerProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const pendingSeekRef = useRef<number | null>(null);
  const resumeAfterSourceChangeRef = useRef(false);
  const mutedRef = useRef(muted);
  const playbackRateRef = useRef<PlaybackSpeed>(1);
  const volumeRef = useRef(lowInitialVolume);

  const [playing, setPlaying] = useState(!!autoPlay);
  const [hasStarted, setHasStarted] = useState(!!autoPlay);
  const [isMuted, setIsMuted] = useState(muted);
  const [hlsSupported, setHlsSupported] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [playerSize, setPlayerSize] = useState({ width: 0, height: 0 });
  const [playbackRate, setPlaybackRate] = useState<PlaybackSpeed>(1);
  const [qualities, setQualities] = useState<QualityOption[]>([]);
  const [selectedQualitySrc, setSelectedQualitySrc] = useState<string | null>(
    null
  );

  const activeSrc = selectedQualitySrc ?? src;
  const useHlsJs = hlsSupported && isHlsPlaylist(activeSrc);
  const nativeVideoSrc = useHlsJs ? undefined : activeSrc;
  const safeInitialVolume = useMemo(
    () => Math.max(0, Math.min(initialVolume, 1)),
    [initialVolume]
  );
  const progressPercent = useMemo(
    () => (duration ? Math.min((currentTime / duration) * 100, 100) : 0),
    [currentTime, duration]
  );
  const scrubberStyle = {
    '--twitter-video-progress': `${progressPercent}%`
  } as CSSProperties;
  const viewCountLabel =
    viewCount !== null && viewCount !== undefined
      ? `${formatNumber(viewCount)} views`
      : null;
  const showInitialPlayButton = !autoPlay && !hasStarted && !playing;
  const compactSettings =
    playerSize.height > 0 && playerSize.height < compactSettingsHeight;
  const tightControls =
    playerSize.width > 0 && playerSize.width < tightControlsWidth;
  const showViewCount = !!viewCountLabel && !tightControls;
  const showVolumeButton = !compact && !tightControls;

  useEffect(() => {
    setHlsSupported(Hls.isSupported());
  }, []);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return undefined;

    const updatePlayerSize = (): void => {
      const { width, height } = frame.getBoundingClientRect();
      setPlayerSize({ width, height });
    };

    updatePlayerSize();

    const observer = new ResizeObserver(updatePlayerSize);
    observer.observe(frame);

    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    volumeRef.current = safeInitialVolume;

    const video = videoRef.current;
    if (!video) return;

    video.volume = safeInitialVolume;
  }, [safeInitialVolume]);

  useEffect(() => {
    mutedRef.current = isMuted;

    const video = videoRef.current;
    if (!video) return;

    video.muted = isMuted;
  }, [isMuted]);

  useEffect(() => {
    playbackRateRef.current = playbackRate;

    const video = videoRef.current;
    if (!video) return;

    video.playbackRate = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    const video = videoRef.current;

    if (!video || !useHlsJs) return undefined;

    hlsRef.current?.destroy();

    const hls = new Hls({
      enableWorker: true
    });

    hlsRef.current = hls;
    hls.attachMedia(video);

    hls.on(Hls.Events.MEDIA_ATTACHED, () => {
      hls.loadSource(activeSrc);
    });

    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      const hlsQualities = getHlsQualityOptions(hls);

      if (hlsQualities.length) setQualities(hlsQualities);

      video.muted = mutedRef.current;
      video.volume = volumeRef.current;
      video.playbackRate = playbackRateRef.current;

      if (autoPlay || resumeAfterSourceChangeRef.current)
        void video
          .play()
          .then(() => {
            setHasStarted(true);
            setPlaying(true);
          })
          .catch(() => setPlaying(false));
    });

    hls.on(Hls.Events.ERROR, (eventName, data) => {
      if (eventName !== Hls.Events.ERROR || !data.fatal) return;

      if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
        hls.startLoad();
        return;
      }

      if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
        hls.recoverMediaError();
        return;
      }

      hls.destroy();
    });

    return () => {
      hls.destroy();
      if (hlsRef.current === hls) hlsRef.current = null;
    };
  }, [activeSrc, autoPlay, useHlsJs]);

  useEffect(() => {
    const controller = new AbortController();

    setQualities([]);
    setSelectedQualitySrc(null);
    setPlaying(!!autoPlay);
    setHasStarted(!!autoPlay);

    if (!src.includes('.m3u8')) return undefined;

    void fetch(src, { signal: controller.signal })
      .then((response) => (response.ok ? response.text() : ''))
      .then((playlist) => {
        if (!controller.signal.aborted)
          setQualities(parseQualityOptions(playlist, src));
      })
      .catch(() => undefined);

    return () => controller.abort();
  }, [src, autoPlay]);

  useEffect(() => {
    const handleFullscreenChange = (): void => {
      setFullscreen(document.fullscreenElement === frameRef.current);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const syncMetadata = (): void => {
    const video = videoRef.current;
    if (!video) return;

    video.volume = volumeRef.current;
    setDuration(video.duration || 0);

    if (pendingSeekRef.current !== null) {
      video.currentTime = Math.min(pendingSeekRef.current, video.duration || 0);
      pendingSeekRef.current = null;
    }

    if (resumeAfterSourceChangeRef.current) {
      resumeAfterSourceChangeRef.current = false;
      void video
        .play()
        .then(() => {
          setHasStarted(true);
          setPlaying(true);
        })
        .catch(() => setPlaying(false));
    }

    setCurrentTime(video.currentTime || 0);
  };

  const syncTime = (): void => {
    const video = videoRef.current;
    if (video) setCurrentTime(video.currentTime || 0);
  };

  const playVideo = async (): Promise<void> => {
    const video = videoRef.current;
    if (!video) return;

    try {
      await video.play();
      setHasStarted(true);
      setPlaying(true);
    } catch {
      setPlaying(false);
    }
  };

  const pauseVideo = (): void => {
    const video = videoRef.current;
    if (!video) return;

    video.pause();
    setPlaying(false);
  };

  const togglePlay = (): void => {
    const video = videoRef.current;
    if (!video) return;

    if (video.paused) void playVideo();
    else pauseVideo();
  };

  const handleSeek = (value: string): void => {
    const video = videoRef.current;
    if (!video) return;

    const nextTime = Number(value);
    video.currentTime = nextTime;
    setCurrentTime(nextTime);
  };

  const handlePlaybackRate = (speed: PlaybackSpeed): void => {
    setPlaybackRate(speed);
  };

  const handleQualityChange = (qualitySrc: string | null): void => {
    const video = videoRef.current;
    const wasPlaying = !!video && !video.paused;

    pendingSeekRef.current = video?.currentTime ?? null;
    resumeAfterSourceChangeRef.current = wasPlaying;
    setSelectedQualitySrc(qualitySrc);
  };

  const toggleFullscreen = async (): Promise<void> => {
    const frame = frameRef.current;
    if (!frame) return;

    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }

    await frame.requestFullscreen();
  };

  return (
    <div
      className={cn(
        'group/video relative h-full w-full overflow-hidden bg-black text-white outline-none',
        className
      )}
      ref={frameRef}
      onClick={preventBubbling(togglePlay)}
      onDoubleClick={preventBubbling(() => void toggleFullscreen())}
      onKeyDown={(event): void => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          event.stopPropagation();
          togglePlay();
        }
      }}
      role='button'
      tabIndex={0}
      aria-label={playing ? `Pause ${label}` : `Play ${label}`}
    >
      <video
        ref={videoRef}
        className={cn(
          'h-full w-full bg-black',
          objectFit === 'contain' ? 'object-contain' : 'object-cover',
          videoClassName
        )}
        src={nativeVideoSrc}
        poster={poster ?? undefined}
        autoPlay={autoPlay}
        loop={loop}
        muted={isMuted}
        playsInline
        onLoadedMetadata={syncMetadata}
        onTimeUpdate={syncTime}
        onPlay={(): void => {
          setHasStarted(true);
          setPlaying(true);
        }}
        onPause={(): void => setPlaying(false)}
      >
        {nativeVideoSrc && <source src={nativeVideoSrc} type='video/*' />}
      </video>
      <span
        className={cn(
          `pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10
           to-black/10 opacity-0 transition-opacity duration-200`,
          (!playing || settingsOpen) && 'opacity-100',
          'group-focus-within/video:opacity-100 group-hover/video:opacity-100'
        )}
      />
      {showInitialPlayButton && (
        <span
          className='pointer-events-none absolute left-1/2 top-1/2 flex h-16 w-16
                     -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full
                     bg-main-accent text-white shadow-[0_0_0_5px_rgba(255,255,255,0.95),0_1px_5px_rgba(0,0,0,0.35)]'
          aria-hidden='true'
        >
          <TwitterVideoInitialPlayIcon />
        </span>
      )}
      <div
        className={cn(
          `absolute inset-x-0 bottom-0 z-10 flex flex-col gap-1 px-3 pb-2 pt-8
           text-white opacity-0 transition-opacity duration-200`,
          (!playing || settingsOpen) && 'opacity-100',
          'group-focus-within/video:opacity-100 group-hover/video:opacity-100'
        )}
        onClick={preventBubbling(null, true)}
      >
        <input
          className='twitter-video-scrubber w-full cursor-pointer'
          type='range'
          min={0}
          max={duration || 0}
          step='0.1'
          value={Math.min(currentTime, duration || currentTime)}
          aria-label='Seek video'
          onChange={({ target: { value } }): void => handleSeek(value)}
          style={scrubberStyle}
        />
        <div className='flex h-8 min-w-0 items-center gap-1.5 text-[13px] font-medium leading-none sm:gap-2'>
          <Button
            className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 text-white
                       hover:bg-white/10 focus-visible:ring-white/70 active:bg-white/20'
            aria-label={playing ? 'Pause' : 'Play'}
            onClick={preventBubbling(togglePlay)}
          >
            <TwitterVideoIcon
              className='h-[22px] w-[22px]'
              iconName={playing ? 'pause' : 'play'}
            />
          </Button>
          {showViewCount && (
            <span className='hidden whitespace-nowrap text-[15px] font-bold sm:inline'>
              {viewCountLabel}
            </span>
          )}
          <span className='min-w-0 flex-1' />
          <span className='min-w-[78px] shrink-0 whitespace-nowrap text-right text-[15px] font-bold tabular-nums'>
            {formatVideoTime(currentTime)} / {formatVideoTime(duration)}
          </span>
          {showVolumeButton && (
            <Button
              className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 text-white
                         hover:bg-white/10 focus-visible:ring-white/70 active:bg-white/20'
              aria-label={isMuted ? 'Unmute' : 'Mute'}
              onClick={preventBubbling(() => setIsMuted(!isMuted))}
            >
              <TwitterVideoIcon
                className='h-[23px] w-[23px]'
                iconName={isMuted ? 'volume-muted' : 'volume'}
              />
            </Button>
          )}
          <div className='relative'>
            <Button
              className={cn(
                `flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 text-white
                 hover:bg-white/10 focus-visible:ring-white/70 active:bg-white/20`,
                settingsOpen && 'bg-white/10'
              )}
              aria-label='Settings'
              aria-expanded={settingsOpen}
              onClick={preventBubbling(() => setSettingsOpen(!settingsOpen))}
            >
              <TwitterVideoIcon
                className='h-[23px] w-[23px]'
                iconName='settings'
              />
            </Button>
          </div>
          <Button
            className='flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-0 text-white
                       hover:bg-white/10 focus-visible:ring-white/70 active:bg-white/20'
            aria-label={fullscreen ? 'Exit full screen' : 'Full screen'}
            onClick={preventBubbling(() => void toggleFullscreen())}
          >
            <TwitterVideoIcon
              className='h-[23px] w-[23px]'
              iconName={fullscreen ? 'fullscreen-exit' : 'fullscreen'}
            />
          </Button>
        </div>
      </div>
      {settingsOpen && (
        <div
          className={cn(
            'absolute z-20 w-[calc(100%-24px)] max-w-[516px]',
            compactSettings
              ? 'right-3 bottom-[46px] max-h-[calc(100%-54px)]'
              : 'right-3 bottom-[54px] max-h-[calc(100%-72px)]'
          )}
          onClick={preventBubbling(null, true)}
        >
          <span
            className={cn(
              'absolute -bottom-[9px] h-[20px] w-[20px] rotate-45 bg-white',
              tightControls ? 'right-[34px]' : 'right-[55px]'
            )}
            aria-hidden='true'
          />
          <div
            className={cn(
              `twitter-video-settings-scroll relative z-10 max-h-[inherit] overflow-y-auto
               overscroll-contain rounded-[22px] bg-white text-[#0f1419]
               shadow-[0_2px_14px_rgba(0,0,0,0.18)] ring-1 ring-black/5`,
              compactSettings
                ? 'px-5 py-3.5'
                : 'px-[22px] py-[20px] sm:px-[36px] sm:pt-[34px] sm:pb-[31px]'
            )}
            role='menu'
            aria-label='Video settings'
          >
            <h2
              className={cn(
                'text-left font-extrabold',
                compactSettings
                  ? 'text-[22px] leading-7'
                  : 'text-[24px] leading-[30px] sm:text-[28px] sm:leading-[34px]'
              )}
            >
              Playback speed
            </h2>
            <p
              className={cn(
                'mt-[2px] text-left leading-5 text-[#536471]',
                compactSettings ? 'text-[14px]' : 'text-[15px] sm:text-[16px]'
              )}
            >
              Press the speed you would like to watch the video in.
            </p>
            <div
              className={cn(
                'flex flex-col',
                compactSettings ? 'mt-2' : 'mt-3 sm:mt-[22px]'
              )}
            >
              {playbackSpeeds.map((speed) => (
                <button
                  className={cn(
                    'flex items-center justify-between text-left',
                    compactSettings
                      ? 'h-7 text-[18px] leading-6'
                      : 'h-9 text-[19px] leading-6 sm:h-[41px] sm:text-[22px] sm:leading-7'
                  )}
                  type='button'
                  role='menuitemradio'
                  aria-checked={playbackRate === speed}
                  onClick={preventBubbling(() => handlePlaybackRate(speed))}
                  key={speed}
                >
                  <span>{getSpeedLabel(speed)}</span>
                  <span
                    className={cn(
                      `flex items-center justify-center rounded-full border-2
                       border-[#536471]`,
                      compactSettings ? 'h-7 w-7' : 'h-7 w-7 sm:h-8 sm:w-8',
                      playbackRate === speed &&
                        'border-main-accent bg-main-accent text-white'
                    )}
                    aria-hidden='true'
                  >
                    {playbackRate === speed && (
                      <TwitterVideoIcon
                        className={cn(
                          compactSettings ? 'h-4 w-4' : 'h-4 w-4 sm:h-5 sm:w-5'
                        )}
                        iconName='check'
                      />
                    )}
                  </span>
                </button>
              ))}
            </div>
            {!!qualities.length && (
              <>
                <div
                  className={cn(
                    'h-px bg-[#eff3f4]',
                    compactSettings ? 'my-2' : 'my-3 sm:my-5'
                  )}
                />
                <h3
                  className={cn(
                    'text-left font-extrabold leading-6',
                    compactSettings ? 'text-[16px]' : 'text-[18px]'
                  )}
                >
                  Quality
                </h3>
                <div
                  className={cn(
                    'flex flex-col',
                    compactSettings ? 'mt-1' : 'mt-2'
                  )}
                >
                  <button
                    className={cn(
                      'flex items-center justify-between text-left leading-6',
                      compactSettings
                        ? 'h-7 text-[16px]'
                        : 'h-[34px] text-[17px]'
                    )}
                    type='button'
                    role='menuitemradio'
                    aria-checked={!selectedQualitySrc}
                    onClick={preventBubbling(() => handleQualityChange(null))}
                  >
                    <span>Auto</span>
                    <span
                      className={cn(
                        `flex h-7 w-7 items-center justify-center rounded-full border-2
                         border-[#536471]`,
                        !selectedQualitySrc &&
                          'border-main-accent bg-main-accent text-white'
                      )}
                      aria-hidden='true'
                    >
                      {!selectedQualitySrc && (
                        <TwitterVideoIcon
                          className='h-4 w-4'
                          iconName='check'
                        />
                      )}
                    </span>
                  </button>
                  {qualities.map((quality) => (
                    <button
                      className={cn(
                        'flex items-center justify-between text-left leading-6',
                        compactSettings
                          ? 'h-7 text-[16px]'
                          : 'h-[34px] text-[17px]'
                      )}
                      type='button'
                      role='menuitemradio'
                      aria-checked={selectedQualitySrc === quality.src}
                      onClick={preventBubbling(() =>
                        handleQualityChange(quality.src)
                      )}
                      key={quality.src}
                    >
                      <span>{quality.label}</span>
                      <span
                        className={cn(
                          `flex h-7 w-7 items-center justify-center rounded-full border-2
                           border-[#536471]`,
                          selectedQualitySrc === quality.src &&
                            'border-main-accent bg-main-accent text-white'
                        )}
                        aria-hidden='true'
                      >
                        {selectedQualitySrc === quality.src && (
                          <TwitterVideoIcon
                            className='h-4 w-4'
                            iconName='check'
                          />
                        )}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}
            {viewCountLabel && (
              <>
                <div
                  className={cn(
                    'h-px bg-[#eff3f4]',
                    compactSettings ? 'my-2' : 'my-3 sm:my-5'
                  )}
                />
                <div
                  className={cn(
                    'flex items-center justify-between leading-6',
                    compactSettings ? 'text-[16px]' : 'text-[17px]'
                  )}
                >
                  <span className='font-bold'>Views</span>
                  <span>{viewCountLabel}</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
