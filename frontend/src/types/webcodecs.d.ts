/**
 * MediaStreamTrackProcessor is Chromium-only and missing from TypeScript's DOM lib
 * (it is only declared in lib.webworker). Declare the minimal surface we use.
 */
interface MediaStreamTrackProcessorInit {
  track: MediaStreamTrack;
  maxBufferSize?: number;
}

interface MediaStreamTrackProcessor {
  readonly readable: ReadableStream<VideoFrame>;
}

declare const MediaStreamTrackProcessor:
  | {
      prototype: MediaStreamTrackProcessor;
      new (init: MediaStreamTrackProcessorInit): MediaStreamTrackProcessor;
    }
  | undefined;
