/**
 * Gallery Module
 * Stores and organizes captured media (photos, videos, audio clips),
 * manages Object URLs, generates thumbnails, handles downloads and previews.
 */

export class GalleryManager {
  constructor() {
    this.items = []; // Array of { id, type, blob, url, thumbnailUrl, timestamp, filename, size, duration }
    this.onItemsChange = null;
  }

  /**
   * Add a new captured item to the gallery
   * @param {Object} item 
   */
  addItem(item) {
    const id = 'media_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
    const dateStr = this._formatTimestamp(new Date());
    
    let defaultFilename = '';
    if (item.type === 'photo') {
      defaultFilename = `hiCam_photo_${dateStr}.png`;
    } else if (item.type === 'video') {
      defaultFilename = `hiCam_video_${dateStr}.${item.extension || 'webm'}`;
    } else if (item.type === 'audio') {
      defaultFilename = `hiCam_audio_${dateStr}.${item.extension || 'webm'}`;
    }

    const url = URL.createObjectURL(item.blob);
    const mediaItem = {
      id,
      type: item.type, // 'photo' | 'video' | 'audio'
      blob: item.blob,
      url,
      thumbnailUrl: item.thumbnailUrl || url,
      timestamp: new Date(),
      filename: item.filename || defaultFilename,
      size: item.blob.size,
      duration: item.duration || 0,
    };

    this.items.unshift(mediaItem);

    if (this.onItemsChange) {
      this.onItemsChange(this.items);
    }

    return mediaItem;
  }

  /**
   * Get all items
   */
  getItems() {
    return this.items;
  }

  /**
   * Get item by id
   */
  getItem(id) {
    return this.items.find(item => item.id === id);
  }

  /**
   * Get the most recently captured item
   */
  getLatestItem() {
    return this.items[0] || null;
  }

  /**
   * Delete an item and revoke its URL to avoid memory leaks
   */
  deleteItem(id) {
    const index = this.items.findIndex(item => item.id === id);
    if (index !== -1) {
      const item = this.items[index];
      URL.revokeObjectURL(item.url);
      if (item.thumbnailUrl && item.thumbnailUrl !== item.url && item.thumbnailUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.thumbnailUrl);
      }
      this.items.splice(index, 1);

      if (this.onItemsChange) {
        this.onItemsChange(this.items);
      }
      return true;
    }
    return false;
  }

  /**
   * Triggers download of an item to user's local disk
   */
  downloadItem(id) {
    const item = this.getItem(id);
    if (!item) return;

    const a = document.createElement('a');
    a.href = item.url;
    a.download = item.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  /**
   * Helper to format file size in human-readable units
   */
  formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  _formatTimestamp(date) {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
  }

  /**
   * Clean up all object URLs when tearing down
   */
  destroy() {
    this.items.forEach(item => {
      URL.revokeObjectURL(item.url);
      if (item.thumbnailUrl && item.thumbnailUrl !== item.url && item.thumbnailUrl.startsWith('blob:')) {
        URL.revokeObjectURL(item.thumbnailUrl);
      }
    });
    this.items = [];
  }
}
