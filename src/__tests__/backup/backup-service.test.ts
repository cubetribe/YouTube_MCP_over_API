import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { BackupService } from '../../backup/backup-service.js';
import type { YouTubeVideo } from '../../types/index.js';
import fs from 'fs/promises';
import path from 'path';

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    mkdir: vi.fn(),
    writeFile: vi.fn(),
    readdir: vi.fn(),
    readFile: vi.fn(),
  },
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('BackupService', () => {
  let backupService: BackupService;
  let mockVideo: YouTubeVideo;
  let originalDateNow: typeof Date.now;

  beforeEach(() => {
    backupService = new BackupService();

    mockVideo = {
      id: 'test-video-id',
      title: 'Test Video Title',
      description: 'Test video description',
      publishedAt: '2024-01-01T00:00:00Z',
      duration: 'PT5M30S',
      viewCount: 1000,
      likeCount: 50,
      commentCount: 10,
      tags: ['test', 'video'],
      privacyStatus: 'public',
      channelId: 'test-channel-id',
      channelTitle: 'Test Channel',
      thumbnails: {
        default: { url: 'https://example.com/thumb.jpg' },
      },
    };

    // Mock Date.now to return a fixed timestamp
    originalDateNow = Date.now;
    Date.now = vi.fn(() => new Date('2024-01-15T12:00:00Z').getTime());

    vi.clearAllMocks();
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  describe('backupVideo', () => {
    it('should backup video to date-based directory', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await backupService.backupVideo(mockVideo);

      expect(mockFs.mkdir).toHaveBeenCalledWith(
        path.join(process.cwd(), 'backups', '2024-01-15'),
        { recursive: true }
      );

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'backups', '2024-01-15', 'test-video-id.json'),
        JSON.stringify(mockVideo, null, 2),
        'utf-8'
      );

      expect(result).toBe(
        path.join(process.cwd(), 'backups', '2024-01-15', 'test-video-id.json')
      );
    });

    it('should handle directory creation errors', async () => {
      const dirError = new Error('Permission denied');
      mockFs.mkdir.mockRejectedValue(dirError);

      await expect(backupService.backupVideo(mockVideo)).rejects.toThrow('Permission denied');

      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).not.toHaveBeenCalled();
    });

    it('should handle file writing errors', async () => {
      mockFs.mkdir.mockResolvedValue(undefined);
      const writeError = new Error('Disk full');
      mockFs.writeFile.mockRejectedValue(writeError);

      await expect(backupService.backupVideo(mockVideo)).rejects.toThrow('Disk full');

      expect(mockFs.mkdir).toHaveBeenCalled();
      expect(mockFs.writeFile).toHaveBeenCalled();
    });

    it('should backup video with minimal data', async () => {
      const minimalVideo: YouTubeVideo = {
        id: 'minimal-video',
        title: 'Minimal Video',
        description: '',
        publishedAt: '2024-01-01T00:00:00Z',
        duration: 'PT1M',
        viewCount: 0,
        likeCount: 0,
        commentCount: 0,
        tags: [],
        privacyStatus: 'private',
        channelId: 'channel-id',
        channelTitle: 'Channel',
        thumbnails: {},
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const result = await backupService.backupVideo(minimalVideo);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('minimal-video.json'),
        JSON.stringify(minimalVideo, null, 2),
        'utf-8'
      );
      expect(result).toContain('minimal-video.json');
    });

    it('should backup video with complex data', async () => {
      const complexVideo: YouTubeVideo = {
        ...mockVideo,
        tags: ['tag1', 'tag2', 'tag with spaces', 'special-chars!@#'],
        description: 'Description with\nmultiple\nlines and special chars: äöü',
        thumbnails: {
          default: { url: 'https://example.com/default.jpg', width: 120, height: 90 },
          medium: { url: 'https://example.com/medium.jpg', width: 320, height: 180 },
          high: { url: 'https://example.com/high.jpg', width: 480, height: 360 },
        },
        customMetadata: {
          category: 'Education',
          language: 'en',
          customFields: { priority: 'high' },
        },
      } as any;

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await backupService.backupVideo(complexVideo);

      expect(mockFs.writeFile).toHaveBeenCalledWith(
        expect.stringContaining('test-video-id.json'),
        JSON.stringify(complexVideo, null, 2),
        'utf-8'
      );
    });

    it('should use correct date format for directory', async () => {
      // Test different dates
      const testDates = [
        '2024-01-01T00:00:00Z',
        '2024-12-31T23:59:59Z',
        '2023-06-15T12:30:45Z',
      ];

      for (const dateStr of testDates) {
        Date.now = vi.fn(() => new Date(dateStr).getTime());

        mockFs.mkdir.mockResolvedValue(undefined);
        mockFs.writeFile.mockResolvedValue(undefined);

        await backupService.backupVideo(mockVideo);

        const expectedDate = dateStr.split('T')[0];
        expect(mockFs.mkdir).toHaveBeenCalledWith(
          path.join(process.cwd(), 'backups', expectedDate),
          { recursive: true }
        );
      }
    });
  });

  describe('listBackups', () => {
    it('should list backup summaries for valid date directories', async () => {
      mockFs.readdir
        .mockResolvedValueOnce(['2024-01-15', '2024-01-14', 'invalid-dir', '.hidden'] as any)
        .mockResolvedValueOnce(['video1.json', 'video2.json'] as any)
        .mockResolvedValueOnce(['video3.json'] as any);

      const summaries = await backupService.listBackups();

      expect(summaries).toHaveLength(2);
      expect(summaries).toEqual([
        {
          date: '2024-01-15',
          videoCount: 2,
          files: ['video1.json', 'video2.json'],
        },
        {
          date: '2024-01-14',
          videoCount: 1,
          files: ['video3.json'],
        },
      ]);

      expect(mockFs.readdir).toHaveBeenCalledTimes(3);
      expect(mockFs.readdir).toHaveBeenNthCalledWith(1, path.join(process.cwd(), 'backups'));
      expect(mockFs.readdir).toHaveBeenNthCalledWith(2, path.join(process.cwd(), 'backups', '2024-01-15'));
      expect(mockFs.readdir).toHaveBeenNthCalledWith(3, path.join(process.cwd(), 'backups', '2024-01-14'));
    });

    it('should return empty array when backup directory does not exist', async () => {
      mockFs.readdir.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      const summaries = await backupService.listBackups();

      expect(summaries).toEqual([]);
      expect(mockFs.readdir).toHaveBeenCalledWith(path.join(process.cwd(), 'backups'));
    });

    it('should handle empty backup directory', async () => {
      mockFs.readdir.mockResolvedValue([]);

      const summaries = await backupService.listBackups();

      expect(summaries).toEqual([]);
      expect(mockFs.readdir).toHaveBeenCalledWith(path.join(process.cwd(), 'backups'));
    });

    it('should filter out non-date directories', async () => {
      mockFs.readdir.mockResolvedValue([
        '2024-01-15',
        'not-a-date',
        '2024-13-45', // Invalid date
        '24-01-15',   // Wrong format
        '2024-1-15',  // Missing zero padding
        '2024-01-1',  // Missing zero padding
        'temp',
        '.DS_Store',
      ] as any);

      mockFs.readdir.mockResolvedValueOnce(['video1.json'] as any);

      const summaries = await backupService.listBackups();

      expect(summaries).toHaveLength(1);
      expect(summaries[0].date).toBe('2024-01-15');
      expect(mockFs.readdir).toHaveBeenCalledTimes(2); // Main dir + one valid date dir
    });

    it('should handle errors when reading individual date directories', async () => {
      mockFs.readdir
        .mockResolvedValueOnce(['2024-01-15', '2024-01-14'] as any)
        .mockResolvedValueOnce(['video1.json'] as any)
        .mockRejectedValueOnce(new Error('Permission denied'));

      const summaries = await backupService.listBackups();

      // Should still return successful directories
      expect(summaries).toHaveLength(1);
      expect(summaries[0].date).toBe('2024-01-15');
    });

    it('should handle directories with mixed file types', async () => {
      mockFs.readdir
        .mockResolvedValueOnce(['2024-01-15'] as any)
        .mockResolvedValueOnce([
          'video1.json',
          'video2.json',
          'not-a-video.txt',
          '.hidden-file',
          'subdirectory',
        ] as any);

      const summaries = await backupService.listBackups();

      expect(summaries).toHaveLength(1);
      expect(summaries[0]).toEqual({
        date: '2024-01-15',
        videoCount: 5, // Counts all files, not just .json
        files: ['video1.json', 'video2.json', 'not-a-video.txt', '.hidden-file', 'subdirectory'],
      });
    });
  });

  describe('restoreVideo', () => {
    it('should restore video from backup file', async () => {
      const backupData = JSON.stringify(mockVideo, null, 2);
      mockFs.readFile.mockResolvedValue(backupData);

      const restored = await backupService.restoreVideo('2024-01-15', 'test-video-id');

      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'backups', '2024-01-15', 'test-video-id.json'),
        'utf-8'
      );
      expect(restored).toEqual(mockVideo);
    });

    it('should handle file not found errors', async () => {
      mockFs.readFile.mockRejectedValue(new Error('ENOENT: no such file or directory'));

      await expect(
        backupService.restoreVideo('2024-01-15', 'non-existent-video')
      ).rejects.toThrow('ENOENT: no such file or directory');

      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'backups', '2024-01-15', 'non-existent-video.json'),
        'utf-8'
      );
    });

    it('should handle invalid JSON in backup file', async () => {
      mockFs.readFile.mockResolvedValue('invalid json content');

      await expect(
        backupService.restoreVideo('2024-01-15', 'test-video-id')
      ).rejects.toThrow(); // JSON.parse will throw

      expect(mockFs.readFile).toHaveBeenCalled();
    });

    it('should restore video with complex data structure', async () => {
      const complexVideo = {
        ...mockVideo,
        customData: {
          metadata: { key: 'value' },
          arrays: [1, 2, 3],
          nested: { deep: { structure: true } },
        },
      };

      const backupData = JSON.stringify(complexVideo, null, 2);
      mockFs.readFile.mockResolvedValue(backupData);

      const restored = await backupService.restoreVideo('2024-01-15', 'test-video-id');

      expect(restored).toEqual(complexVideo);
      expect(restored.customData.nested.deep.structure).toBe(true);
    });

    it('should handle different date formats in path', async () => {
      const testCases = [
        '2024-01-15',
        '2023-12-31',
        '2024-06-01',
      ];

      for (const date of testCases) {
        mockFs.readFile.mockResolvedValue(JSON.stringify(mockVideo));

        await backupService.restoreVideo(date, 'test-video-id');

        expect(mockFs.readFile).toHaveBeenCalledWith(
          path.join(process.cwd(), 'backups', date, 'test-video-id.json'),
          'utf-8'
        );
      }
    });

    it('should handle video IDs with special characters', async () => {
      const specialVideoId = 'video-with_special.chars-123';
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockVideo));

      await backupService.restoreVideo('2024-01-15', specialVideoId);

      expect(mockFs.readFile).toHaveBeenCalledWith(
        path.join(process.cwd(), 'backups', '2024-01-15', `${specialVideoId}.json`),
        'utf-8'
      );
    });

    it('should preserve data types when restoring', async () => {
      const videoWithTypes = {
        ...mockVideo,
        viewCount: 1000,
        likeCount: 50,
        isPublic: true,
        publishedAt: '2024-01-01T00:00:00Z',
        tags: ['tag1', 'tag2'],
        metadata: null,
        rating: 4.5,
      };

      const backupData = JSON.stringify(videoWithTypes);
      mockFs.readFile.mockResolvedValue(backupData);

      const restored = await backupService.restoreVideo('2024-01-15', 'test-video-id');

      expect(typeof restored.viewCount).toBe('number');
      expect(typeof restored.isPublic).toBe('boolean');
      expect(Array.isArray(restored.tags)).toBe(true);
      expect(restored.metadata).toBeNull();
      expect(typeof restored.rating).toBe('number');
    });
  });

  describe('integration scenarios', () => {
    it('should handle backup and restore cycle', async () => {
      // Setup backup
      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      const backupPath = await backupService.backupVideo(mockVideo);

      // Setup restore
      mockFs.readFile.mockResolvedValue(JSON.stringify(mockVideo, null, 2));

      const restored = await backupService.restoreVideo('2024-01-15', 'test-video-id');

      expect(restored).toEqual(mockVideo);
      expect(backupPath).toContain('test-video-id.json');
    });

    it('should handle multiple videos in same day', async () => {
      const video1 = { ...mockVideo, id: 'video-1' };
      const video2 = { ...mockVideo, id: 'video-2', title: 'Second Video' };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);

      await backupService.backupVideo(video1);
      await backupService.backupVideo(video2);

      // Should create same directory but different files
      expect(mockFs.mkdir).toHaveBeenCalledTimes(2);
      expect(mockFs.writeFile).toHaveBeenCalledTimes(2);

      expect(mockFs.writeFile).toHaveBeenNthCalledWith(
        1,
        expect.stringContaining('video-1.json'),
        expect.any(String),
        'utf-8'
      );

      expect(mockFs.writeFile).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('video-2.json'),
        expect.any(String),
        'utf-8'
      );
    });

    it('should handle edge case file system paths', async () => {
      const edgeVideo = {
        ...mockVideo,
        id: 'video_with.special-chars&symbols!',
      };

      mockFs.mkdir.mockResolvedValue(undefined);
      mockFs.writeFile.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(edgeVideo));

      const backupPath = await backupService.backupVideo(edgeVideo);
      const restored = await backupService.restoreVideo('2024-01-15', edgeVideo.id);

      expect(backupPath).toContain(edgeVideo.id);
      expect(restored).toEqual(edgeVideo);
    });
  });
});