const SILENT_AUDIO_DATA_URI = 'data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQIAAAAAAA==';

let playbackAudioElement: HTMLAudioElement | null = null;
let audioPrimePromise: Promise<void> | null = null;
let isPlaybackAudioPrimed = false;

export function getPlaybackAudioElement(): HTMLAudioElement {
  if (!playbackAudioElement) {
    playbackAudioElement = new Audio();
    playbackAudioElement.preload = 'auto';
    playbackAudioElement.setAttribute('playsinline', 'true');
  }

  return playbackAudioElement;
}

export function primePlaybackAudio(): Promise<void> {
  if (isPlaybackAudioPrimed) {
    return Promise.resolve();
  }

  if (audioPrimePromise) {
    return audioPrimePromise;
  }

  const audio = getPlaybackAudioElement();
  audio.pause();
  audio.currentTime = 0;
  audio.src = SILENT_AUDIO_DATA_URI;
  audio.load();

  audioPrimePromise = audio.play()
    .then(() => {
      isPlaybackAudioPrimed = true;
    })
    .finally(() => {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute('src');
      audio.load();
      audioPrimePromise = null;
    });

  return audioPrimePromise;
}
