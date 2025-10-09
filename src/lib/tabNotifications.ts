// Tab Notification System - Like Telegram!

const originalTitle = "TrackMiner - Multi-Source Music Downloader";
let notificationInterval: number | null = null;
let isBlinking = false;

/**
 * Update tab title with custom message
 */
export const updateTabTitle = (message: string) => {
  document.title = message;
};

/**
 * Reset tab title to original
 */
export const resetTabTitle = () => {
  stopBlinking();
  document.title = originalTitle;
};

/**
 * Blink tab title (like Telegram notifications)
 */
export const blinkTabTitle = (message: string, count: number = 5) => {
  stopBlinking(); // Clear any existing blink
  
  let counter = 0;
  isBlinking = true;
  
  notificationInterval = window.setInterval(() => {
    if (counter >= count * 2) {
      resetTabTitle();
      return;
    }
    
    // Toggle between message and original title
    document.title = counter % 2 === 0 ? message : originalTitle;
    counter++;
  }, 1000); // Blink every second
};

/**
 * Stop blinking animation
 */
export const stopBlinking = () => {
  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }
  isBlinking = false;
};

/**
 * Show download progress in tab title
 */
export const showDownloadProgress = (completed: number, total: number) => {
  const percentage = Math.round((completed / total) * 100);
  const emoji = completed === total ? "🎉" : "⏬";
  document.title = `${emoji} ${completed}/${total} (${percentage}%) - TrackMiner`;
};

/**
 * Show success notification with blinking
 */
export const showSuccessNotification = (tracksCount: number) => {
  const message = `🎉 ${tracksCount} track${tracksCount > 1 ? 's' : ''} downloaded!`;
  blinkTabTitle(message, 3);
  
  // Play success sound if available
  playNotificationSound('success');
};

/**
 * Show error notification with blinking
 */
export const showErrorNotification = (message: string = "Download failed") => {
  blinkTabTitle(`❌ ${message}`, 3);
  playNotificationSound('error');
};

/**
 * Show downloading notification
 */
export const showDownloadingNotification = (trackName: string) => {
  const truncated = trackName.length > 30 ? trackName.substring(0, 30) + '...' : trackName;
  updateTabTitle(`⏬ Downloading: ${truncated}`);
};

/**
 * Play notification sound (using Web Audio API)
 */
const playNotificationSound = (type: 'success' | 'error' | 'info') => {
  try {
    // Create AudioContext
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const audioContext = new AudioContext();
    
    // Create oscillator for beep sound
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    // Set frequency based on notification type
    oscillator.frequency.value = type === 'success' ? 800 : type === 'error' ? 400 : 600;
    oscillator.type = 'sine';
    
    // Set volume
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
    
    // Play sound
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (error) {
    // Silently fail if audio not supported
    console.log('Notification sound not available');
  }
};

/**
 * Request notification permission (for desktop notifications)
 */
export const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

/**
 * Show desktop notification (if permission granted)
 */
export const showDesktopNotification = (title: string, body: string, icon?: string) => {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, {
      body,
      icon: icon || '/favicon.svg',
      badge: '/favicon.svg',
      tag: 'trackminer-download'
    });
  }
};

/**
 * Show complete notification (tab + desktop + sound)
 */
export const showCompleteNotification = (tracksCount: number, playlistName?: string) => {
  const message = `${tracksCount} track${tracksCount > 1 ? 's' : ''} downloaded!`;
  const body = playlistName ? `From: ${playlistName}` : 'Your download is complete';
  
  // Tab notification
  showSuccessNotification(tracksCount);
  
  // Desktop notification
  showDesktopNotification('🎉 Download Complete!', body);
};

