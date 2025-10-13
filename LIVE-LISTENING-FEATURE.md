# 🎧 Live Listening Feature - Documentation

## Overview

The **Live Listening** feature allows users to create synchronized music listening sessions where a host can play music and share it in real-time with friends. Listeners join via a unique link and hear the same music at the same moment, creating a shared listening experience.

## 🌟 Key Features

### E1. Create & Share Room (Host Mode)

- **Start Live Listening Button**: Located in the mini-player (both minimized and expanded views)
- **Unique Room ID Generation**: Each session gets a unique ID (e.g., `trackminer.app/live/ABCD1234`)
- **Share Dialog**: 
  - Copy Link button
  - Share via WhatsApp/Telegram/Messenger
  - Display current listener count
  - Room management controls

### E2. Join via Link (Listener Mode)

- **Automatic Join**: Friends click the shared link and enter Listener View
- **Synchronized Playback**: 
  - Same song at the same second
  - Real-time sync updates every 5 seconds
  - Automatic sync when track changes
- **Listener Controls**:
  - **Cannot** control: Play/Pause/Next/Previous (host-only)
  - **Can** control: Volume (independent)
- **Visual Feedback**:
  - "🎧 Listening Live with [HostName]" header
  - Current listener count display
  - "🔄 Syncing..." indicator during updates

### 🌟 Additional Enhancements

#### Sync System
- **Initial Join**: Server sends `currentTrack`, `currentTime`, and `isPlaying` to new listeners
- **Periodic Updates**: Host broadcasts state every 5 seconds during playback
- **Track Changes**: Immediate sync when host changes songs
- **Play/Pause**: Real-time sync to all listeners

#### UI/UX Design
- **Top Corner Display**: Host name and listener count
- **Sync Feedback**: Loading indicator during synchronization
- **Host UI**: 
  - Normal player controls + queue
  - Live indicator (pulsing green radio icon)
  - Listener count badge
- **Listener UI**: 
  - Read-only player display
  - Independent volume control
  - Beautiful gradient background
  - Album artwork display

### 🔐 E3. Room Lifecycle

- **Host Leaves**: Session automatically ends, all listeners notified
- **Listener Leaves**: Count updates, session continues
- **Private Rooms**: Join only via unique link
- **Auto-Cleanup**: Room deleted when host disconnects

## 📁 Technical Architecture

### Backend (Server)

**File**: `server/index.js`

- **Room Management**: In-memory Map storing active rooms
- **WebSocket Events**:
  - `create-live-room`: Host creates a new session
  - `join-live-room`: Listener joins via room ID
  - `update-playback-state`: Host broadcasts playback changes
  - `end-live-room`: Host ends the session
  - `leave-live-room`: Listener leaves
  - `disconnect`: Automatic cleanup

**Room Structure**:
```javascript
{
  roomId: string,
  hostSocketId: string,
  hostName: string,
  listeners: [{ socketId, userName, joinedAt }],
  currentTrack: Track | null,
  currentTime: number,
  isPlaying: boolean,
  createdAt: number
}
```

### Frontend

#### Core Services

**File**: `src/services/liveListening.ts`

- `LiveListeningService` class manages WebSocket connections
- Methods:
  - `createRoom()`: Host creates session
  - `joinRoom()`: Listener joins session
  - `updatePlaybackState()`: Host updates state
  - `endRoom()`: Host ends session
  - `leaveRoom()`: Listener leaves

#### Pages

**File**: `src/pages/LiveListening.tsx`

- Listener-only page rendered at `/live/:roomId`
- Beautiful immersive UI with:
  - Large album artwork
  - Synchronized playback display
  - Independent volume control
  - Visual sync indicators

#### Components

**File**: `src/components/LiveListeningDialog.tsx`

- `LiveListeningDialog`: Host enters name to start session
- `ShareLiveRoomDialog`: Share link and manage active session

**File**: `src/components/TrackList.tsx`

- Integrated Live Listening button in mini-player
- State management for host/listener mode
- Automatic playback sync logic
- Event handlers for room management

#### Types

**File**: `src/types/index.ts`

```typescript
interface LiveRoom {
  roomId: string;
  hostName: string;
  hostSocketId: string;
  listeners: LiveListener[];
  currentTrack: Track | null;
  currentTime: number;
  isPlaying: boolean;
  createdAt: number;
}

interface LiveListener {
  socketId: string;
  userName: string;
  joinedAt: number;
}

interface LiveSessionState {
  isHost: boolean;
  isListener: boolean;
  roomId: string | null;
  hostName?: string;
  listenerCount: number;
}
```

#### Routing

**File**: `src/App.tsx`

- Route added: `/live/:roomId` → `<LiveListening />`

## 🚀 How It Works

### Host Flow

1. **Start Session**:
   - User clicks the Radio icon in mini-player
   - Enters their name in dialog
   - Server creates unique room ID
   - Share dialog opens with link

2. **During Session**:
   - Host controls music normally
   - Playback state synced to server every 5 seconds
   - Listener count displayed in real-time
   - Green pulsing icon indicates active session

3. **End Session**:
   - Click "End Session" in share dialog
   - OR close the tab/disconnect
   - All listeners notified and redirected

### Listener Flow

1. **Join Session**:
   - Click shared link (e.g., `app.com/live/1234567890-abc`)
   - Automatically join room
   - Receive current track, time, and play state

2. **During Session**:
   - Music plays in sync with host
   - Periodic sync updates (every 5s)
   - Can adjust own volume
   - See listener count

3. **Session Ends**:
   - Notified when host ends session
   - Redirected to home page after 2 seconds

## 🔄 Synchronization Logic

### Initial Sync (Listener Joins)
```typescript
// Server sends current state
socket.emit('room-joined', {
  roomId,
  hostName,
  currentTrack,
  currentTime,
  isPlaying,
  listenerCount
});

// Client loads track and seeks to correct time
loadTrackAndSync(currentTrack, currentTime, isPlaying);
```

### Periodic Sync (During Playback)
```typescript
// Host: Every 5 seconds if playing
setInterval(() => {
  liveListeningService.updatePlaybackState(
    currentTrack,
    currentTime,
    isPlaying
  );
}, 5000);

// Listeners: Receive and apply updates
socket.on('playback-state-updated', (data) => {
  setCurrentTrack(data.currentTrack);
  setCurrentTime(data.currentTime);
  setIsPlaying(data.isPlaying);
  audioRef.current.currentTime = data.currentTime;
});
```

### Track Change Sync
```typescript
// Host: Immediate update when track changes
useEffect(() => {
  if (isLiveHost && liveRoomId) {
    liveListeningService.updatePlaybackState(
      currentPlayingTrack,
      currentTime,
      isPlaying
    );
  }
}, [currentPlayingTrack?.id, isPlaying]);
```

## 🎨 UI Components

### Mini-Player Button
- **Inactive**: Gray radio icon
- **Active (Host)**: Green pulsing radio icon + listener count badge
- Positioned next to fullscreen toggle

### Share Dialog (Host)
- Room link with copy button
- Social share buttons (WhatsApp, Telegram, Messenger)
- Current listener count
- Session info
- "End Session" button

### Listener Page
- Full-page immersive experience
- Purple/blue gradient background
- Large album artwork (80x80)
- Track info (name, artist, album)
- Progress bar (read-only)
- Volume slider (active)
- Playback controls (disabled/display-only)
- "Leave Session" button

## 🧩 Future Enhancements (Not Implemented)

### E4. Planned Features

- **Queue Collaboration**: Guests suggest songs
- **Live Chat**: Real-time messaging
- **Emoji Reactions**: React to songs
- **Multiple Hosts / DJ Mode**: Shared control
- **Listening History**: Track session history
- **Room Settings**: 
  - Temporary rooms (1 hour auto-close)
  - Public/Private toggle
  - Password protection

## 📝 Usage Example

### Starting a Session

```typescript
// 1. User clicks Radio button
<Button onClick={() => setShowLiveDialog(true)}>
  <Radio className="w-4 h-4" />
</Button>

// 2. Enter name and create room
handleStartLiveSession("John Doe");

// 3. Share link with friends
// Copy: https://trackminer.app/live/1760308000000-xyz123
```

### Joining a Session

```typescript
// 1. Friend clicks link: /live/1760308000000-xyz123

// 2. Auto-join room
liveListeningService.joinRoom(roomId, userName);

// 3. Receive sync data and start playback
socket.on('room-joined', (data) => {
  loadTrackAndSync(data.currentTrack, data.currentTime, data.isPlaying);
});
```

## 🔧 Configuration

### Environment Variables

No additional environment variables needed - uses existing WebSocket connection.

### CORS Configuration

Already configured in `server/index.js`:
```javascript
const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});
```

## 🐛 Troubleshooting

### Issue: Listeners not syncing
- **Solution**: Check WebSocket connection, ensure periodic sync is running

### Issue: Room not found
- **Solution**: Room may have expired (host disconnected), generate new link

### Issue: Audio not playing
- **Solution**: Check browser autoplay policy, user must interact first

### Issue: Out of sync
- **Solution**: Automatic re-sync happens every 5 seconds, or on track change

## ✅ Testing Checklist

- [x] Host can create room
- [x] Share dialog displays correctly
- [x] Link can be copied
- [x] Listener can join via link
- [x] Playback syncs on join
- [x] Periodic sync works (5s interval)
- [x] Track changes sync immediately
- [x] Play/Pause syncs
- [x] Listener count updates
- [x] Volume control works independently
- [x] Host can end session
- [x] Listeners notified when session ends
- [x] Room cleanup on host disconnect

## 📄 Summary

The Live Listening feature is now fully implemented with:

✅ **Complete WebSocket infrastructure** for real-time sync
✅ **Room management system** with unique IDs
✅ **Host Mode UI** with share dialog and controls  
✅ **Listener Mode UI** with synchronized playback
✅ **Synchronization logic** for tracks, time, and playback state
✅ **Routing** for `/live/:roomId`
✅ **Listener count display** and visual feedback
✅ **Beautiful, immersive UI** with gradient backgrounds

The feature is production-ready and provides a seamless shared listening experience! 🎉

