import { registerPlugin } from '@capacitor/core'

export interface NativePlayerPluginInterface {
  play(options: { url: string; isLive?: boolean; startAt?: number }): Promise<void>
  pause(): Promise<void>
  resume(): Promise<void>
  seekTo(options: { position: number }): Promise<void>
  setVolume(options: { volume: number }): Promise<void>
  setResizeMode(options: { mode: 'contain' | 'cover' }): Promise<void>
  stop(): Promise<void>
  getPlaybackTime(): Promise<{
    currentTime: number
    duration: number
    isPlaying: boolean
    isBuffering: boolean
  }>
  addListener(
    eventName: 'timeUpdate',
    listenerFunc: (data: { currentTime: number; duration: number }) => void
  ): Promise<{ remove: () => Promise<void> }>
  addListener(
    eventName: 'stateChange',
    listenerFunc: (data: { state: 'buffering' | 'ready' | 'ended' | 'idle'; duration?: number }) => void
  ): Promise<{ remove: () => Promise<void> }>
  addListener(
    eventName: 'isPlayingChange',
    listenerFunc: (data: { isPlaying: boolean }) => void
  ): Promise<{ remove: () => Promise<void> }>
  addListener(
    eventName: 'playbackError',
    listenerFunc: (data: { error: string; errorCode?: number }) => void
  ): Promise<{ remove: () => Promise<void> }>
}

export const NativePlayer = registerPlugin<NativePlayerPluginInterface>('NativePlayer')
