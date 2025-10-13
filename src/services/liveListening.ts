import { Socket } from 'socket.io-client';
import { Track, LiveRoom, LiveSessionState } from '@/types';
import { getSocket } from '@/services/api';

// ============================================================
// 🎧 LIVE LISTENING SERVICE - Client-side WebSocket management
// ============================================================

export class LiveListeningService {
  private socket: Socket | null = null;
  private currentRoomId: string | null = null;
  private isHost: boolean = false;

  // Callbacks for various events
  private onRoomCreatedCallback: ((data: { roomId: string; room: LiveRoom }) => void) | null = null;
  private onRoomJoinedCallback: ((data: any) => void) | null = null;
  private onPlaybackUpdatedCallback: ((data: { currentTrack: Track; currentTime: number; isPlaying: boolean; queue?: Track[] }) => void) | null = null;
  private onListenerCountUpdatedCallback: ((data: { listenerCount: number }) => void) | null = null;
  private onRoomEndedCallback: ((data: { message: string }) => void) | null = null;
  private onRoomErrorCallback: ((data: { message: string }) => void) | null = null;
  private onListenerJoinedCallback: ((data: { userName: string; listenerCount: number }) => void) | null = null;

  constructor() {
    this.socket = getSocket();
  }

  // Initialize socket connection
  public init(socket: Socket) {
    this.socket = socket;
    this.setupListeners();
  }

  // Setup WebSocket event listeners
  private setupListeners() {
    if (!this.socket) return;

    // Room created (for host)
    this.socket.on('room-created', (data) => {
      console.log('🎧 Room created:', data);
      this.currentRoomId = data.roomId;
      this.isHost = true;
      if (this.onRoomCreatedCallback) this.onRoomCreatedCallback(data);
    });

    // Room joined (for listener)
    this.socket.on('room-joined', (data) => {
      console.log('👥 Joined room:', data);
      this.currentRoomId = data.roomId;
      this.isHost = false;
      if (this.onRoomJoinedCallback) this.onRoomJoinedCallback(data);
    });

    // Playback state updated
    this.socket.on('playback-state-updated', (data) => {
      console.log('🎵 Playback updated:', data);
      if (this.onPlaybackUpdatedCallback) this.onPlaybackUpdatedCallback(data);
    });

    // Listener count updated
    this.socket.on('listener-count-updated', (data) => {
      console.log('👥 Listener count:', data.listenerCount);
      if (this.onListenerCountUpdatedCallback) this.onListenerCountUpdatedCallback(data);
    });

    // Listener joined (for host)
    this.socket.on('listener-joined', (data) => {
      console.log('👋 Listener joined:', data.userName);
      if (this.onListenerJoinedCallback) this.onListenerJoinedCallback(data);
    });

    // Room ended
    this.socket.on('room-ended', (data) => {
      console.log('🛑 Room ended:', data.message);
      this.currentRoomId = null;
      this.isHost = false;
      if (this.onRoomEndedCallback) this.onRoomEndedCallback(data);
    });

    // Room error
    this.socket.on('room-error', (data) => {
      console.error('❌ Room error:', data.message);
      if (this.onRoomErrorCallback) this.onRoomErrorCallback(data);
    });
  }

  // ========== HOST METHODS ==========

  public createRoom(hostName: string, currentTrack: Track | null, currentTime: number, isPlaying: boolean, queue: Track[] = []) {
    if (!this.socket) {
      console.error('❌ Socket not initialized');
      return;
    }

    this.socket.emit('create-live-room', {
      hostName,
      currentTrack,
      currentTime,
      isPlaying,
      queue,
    });
  }

  public updatePlaybackState(currentTrack: Track | null, currentTime: number, isPlaying: boolean, queue: Track[] = []) {
    if (!this.socket || !this.currentRoomId || !this.isHost) {
      console.error('❌ Not authorized to update playback state');
      return;
    }

    this.socket.emit('update-playback-state', {
      roomId: this.currentRoomId,
      currentTrack,
      currentTime,
      isPlaying,
      queue,
    });
  }

  public endRoom() {
    if (!this.socket || !this.currentRoomId || !this.isHost) {
      console.error('❌ Not authorized to end room');
      return;
    }

    this.socket.emit('end-live-room', {
      roomId: this.currentRoomId,
    });

    this.currentRoomId = null;
    this.isHost = false;
  }

  // ========== LISTENER METHODS ==========

  public joinRoom(roomId: string, userName: string) {
    if (!this.socket) {
      console.error('❌ Socket not initialized');
      return;
    }

    this.socket.emit('join-live-room', {
      roomId,
      userName,
    });
  }

  public leaveRoom() {
    if (!this.socket || !this.currentRoomId) {
      console.error('❌ Not in a room');
      return;
    }

    this.socket.emit('leave-live-room', {
      roomId: this.currentRoomId,
    });

    this.currentRoomId = null;
    this.isHost = false;
  }

  // ========== CALLBACK SETTERS ==========

  public onRoomCreated(callback: (data: { roomId: string; room: LiveRoom }) => void) {
    this.onRoomCreatedCallback = callback;
  }

  public onRoomJoined(callback: (data: any) => void) {
    this.onRoomJoinedCallback = callback;
  }

  public onPlaybackUpdated(callback: (data: { currentTrack: Track; currentTime: number; isPlaying: boolean }) => void) {
    this.onPlaybackUpdatedCallback = callback;
  }

  public onListenerCountUpdated(callback: (data: { listenerCount: number }) => void) {
    this.onListenerCountUpdatedCallback = callback;
  }

  public onListenerJoined(callback: (data: { userName: string; listenerCount: number }) => void) {
    this.onListenerJoinedCallback = callback;
  }

  public onRoomEnded(callback: (data: { message: string }) => void) {
    this.onRoomEndedCallback = callback;
  }

  public onRoomError(callback: (data: { message: string }) => void) {
    this.onRoomErrorCallback = callback;
  }

  // ========== GETTERS ==========

  public getCurrentRoomId(): string | null {
    return this.currentRoomId;
  }

  public getIsHost(): boolean {
    return this.isHost;
  }

  public getSessionState(): LiveSessionState {
    return {
      isHost: this.isHost,
      isListener: !this.isHost && !!this.currentRoomId,
      roomId: this.currentRoomId,
      listenerCount: 0, // Will be updated via callbacks
    };
  }

  // Cleanup
  public cleanup() {
    if (this.socket) {
      this.socket.off('room-created');
      this.socket.off('room-joined');
      this.socket.off('playback-state-updated');
      this.socket.off('listener-count-updated');
      this.socket.off('listener-joined');
      this.socket.off('room-ended');
      this.socket.off('room-error');
    }
    this.currentRoomId = null;
    this.isHost = false;
  }
}

// Singleton instance
export const liveListeningService = new LiveListeningService();

