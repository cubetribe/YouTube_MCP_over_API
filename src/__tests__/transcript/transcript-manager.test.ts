import { describe, it, expect, vi, beforeEach } from 'vitest';
import { TranscriptManager, type TranscriptResult } from '../../transcript/transcript-manager.js';
import { youtube_v3, google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';

// Mock googleapis
vi.mock('googleapis', () => ({
  google: {
    youtube: vi.fn(),
  },
  youtube_v3: {},
}));

// Mock timestamp utils
vi.mock('../../utils/timestamp-utils.js', () => ({
  TimestampFormatter: {
    fromVtt: vi.fn(),
  },
}));

const mockGoogle = google as jest.Mocked<typeof google>;

describe('TranscriptManager', () => {
  let transcriptManager: TranscriptManager;
  let mockOAuthClient: jest.Mocked<OAuth2Client>;
  let mockYouTube: {
    captions: {
      list: ReturnType<typeof vi.fn>;
      download: ReturnType<typeof vi.fn>;
    };
  };

  const mockCaptions: youtube_v3.Schema$Caption[] = [
    {
      id: 'caption-en',
      snippet: {
        videoId: 'test-video-id',
        language: 'en',
        name: 'English',
        audioTrackType: 'primary',
        status: 'serving',
      },
    },
    {
      id: 'caption-de',
      snippet: {
        videoId: 'test-video-id',
        language: 'de',
        name: 'German',
        audioTrackType: 'primary',
        status: 'serving',
      },
    },
  ];

  const mockVttContent = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
Welcome to this video about testing

2
00:00:05.000 --> 00:00:10.000
Today we'll learn about unit testing

3
00:00:10.000 --> 00:00:15.000
Let's start with the basics`;

  const mockSegments = [
    { start: 0, duration: 5, text: 'Welcome to this video about testing' },
    { start: 5, duration: 5, text: "Today we'll learn about unit testing" },
    { start: 10, duration: 5, text: "Let's start with the basics" },
  ];

  beforeEach(() => {
    mockOAuthClient = {} as jest.Mocked<OAuth2Client>;

    mockYouTube = {
      captions: {
        list: vi.fn(),
        download: vi.fn(),
      },
    };

    mockGoogle.youtube.mockReturnValue(mockYouTube as any);

    const { TimestampFormatter } = require('../../utils/timestamp-utils.js');
    TimestampFormatter.fromVtt.mockReturnValue(mockSegments);

    transcriptManager = new TranscriptManager(mockOAuthClient);
  });

  describe('constructor', () => {
    it('should initialize with OAuth client', () => {
      expect(transcriptManager).toBeDefined();
      expect(mockGoogle.youtube).toHaveBeenCalledWith({
        version: 'v3',
        auth: mockOAuthClient,
      });
    });
  });

  describe('getTranscript', () => {
    it('should successfully get transcript for video with captions', async () => {
      mockYouTube.captions.list.mockResolvedValue({
        data: { items: mockCaptions },
      });

      mockYouTube.captions.download.mockResolvedValue({
        data: mockVttContent,
      });

      const result = await transcriptManager.getTranscript('test-video-id');

      expect(result.success).toBe(true);
      expect(result.transcript).toEqual({
        videoId: 'test-video-id',
        language: 'en',
        segments: mockSegments,
      });
      expect(result.raw).toBe(mockVttContent);
      expect(result.track).toEqual(mockCaptions[0]);

      expect(mockYouTube.captions.list).toHaveBeenCalledWith({
        part: ['snippet'],
        videoId: 'test-video-id',
      });

      expect(mockYouTube.captions.download).toHaveBeenCalledWith(
        { id: 'caption-en' },
        { responseType: 'text' }
      );
    });

    it('should return failure when no caption tracks available', async () => {
      mockYouTube.captions.list.mockResolvedValue({
        data: { items: [] },
      });

      const result = await transcriptManager.getTranscript('no-captions-video');

      expect(result.success).toBe(false);
      expect(result.message).toBe('No caption tracks available.');
      expect(result.transcript).toBeUndefined();
      expect(result.raw).toBeUndefined();

      expect(mockYouTube.captions.list).toHaveBeenCalledWith({
        part: ['snippet'],
        videoId: 'no-captions-video',
      });
      expect(mockYouTube.captions.download).not.toHaveBeenCalled();
    });

    it('should return failure when caption track has no ID', async () => {
      const captionsWithoutId = [
        {
          // Missing id field
          snippet: {
            videoId: 'test-video-id',
            language: 'en',
            name: 'English',
          },
        },
      ];

      mockYouTube.captions.list.mockResolvedValue({
        data: { items: captionsWithoutId },
      });

      const result = await transcriptManager.getTranscript('test-video-id');

      expect(result.success).toBe(false);
      expect(result.message).toBe('Unable to determine caption track ID.');
      expect(mockYouTube.captions.download).not.toHaveBeenCalled();
    });

    it('should handle preferred language selection', async () => {
      mockYouTube.captions.list.mockResolvedValue({
        data: { items: mockCaptions },
      });

      mockYouTube.captions.download.mockResolvedValue({
        data: mockVttContent,
      });

      const result = await transcriptManager.getTranscript('test-video-id', 'de');

      expect(result.success).toBe(true);
      expect(result.track).toEqual(mockCaptions[1]); // German caption
      expect(result.transcript?.language).toBe('de');

      expect(mockYouTube.captions.download).toHaveBeenCalledWith(
        { id: 'caption-de' },
        { responseType: 'text' }
      );
    });

    it('should fallback to first track when preferred language not found', async () => {
      mockYouTube.captions.list.mockResolvedValue({
        data: { items: mockCaptions },
      });

      mockYouTube.captions.download.mockResolvedValue({
        data: mockVttContent,
      });

      const result = await transcriptManager.getTranscript('test-video-id', 'fr'); // French not available

      expect(result.success).toBe(true);
      expect(result.track).toEqual(mockCaptions[0]); // Falls back to English
      expect(result.transcript?.language).toBe('en');

      expect(mockYouTube.captions.download).toHaveBeenCalledWith(
        { id: 'caption-en' },
        { responseType: 'text' }
      );
    });

    it('should handle buffer data from download response', async () => {
      mockYouTube.captions.list.mockResolvedValue({
        data: { items: [mockCaptions[0]] },
      });

      const bufferData = Buffer.from(mockVttContent, 'utf8');
      mockYouTube.captions.download.mockResolvedValue({
        data: bufferData,
      });

      const result = await transcriptManager.getTranscript('test-video-id');

      expect(result.success).toBe(true);
      expect(result.raw).toBe(mockVttContent);
    });

    it('should handle captions without language in snippet', async () => {
      const captionWithoutLanguage = [
        {
          id: 'caption-unknown',
          snippet: {
            videoId: 'test-video-id',
            name: 'Unknown Language',
            // language field missing
          },
        },
      ];

      mockYouTube.captions.list.mockResolvedValue({
        data: { items: captionWithoutLanguage },
      });

      mockYouTube.captions.download.mockResolvedValue({
        data: mockVttContent,
      });

      const result = await transcriptManager.getTranscript('test-video-id');

      expect(result.success).toBe(true);
      expect(result.transcript?.language).toBe('unknown');
    });

    it('should handle errors during caption list retrieval', async () => {
      const error = new Error('API quota exceeded');
      mockYouTube.captions.list.mockRejectedValue(error);

      await expect(transcriptManager.getTranscript('test-video-id')).rejects.toThrow('API quota exceeded');

      expect(mockYouTube.captions.list).toHaveBeenCalledWith({
        part: ['snippet'],
        videoId: 'test-video-id',
      });
      expect(mockYouTube.captions.download).not.toHaveBeenCalled();
    });

    it('should handle errors during caption download', async () => {
      mockYouTube.captions.list.mockResolvedValue({
        data: { items: [mockCaptions[0]] },
      });

      const error = new Error('Download failed');
      mockYouTube.captions.download.mockRejectedValue(error);

      await expect(transcriptManager.getTranscript('test-video-id')).rejects.toThrow('Download failed');

      expect(mockYouTube.captions.list).toHaveBeenCalled();
      expect(mockYouTube.captions.download).toHaveBeenCalledWith(
        { id: 'caption-en' },
        { responseType: 'text' }
      );
    });

    it('should pass VTT content to TimestampFormatter', async () => {
      mockYouTube.captions.list.mockResolvedValue({
        data: { items: [mockCaptions[0]] },
      });

      mockYouTube.captions.download.mockResolvedValue({
        data: mockVttContent,
      });

      const { TimestampFormatter } = require('../../utils/timestamp-utils.js');

      await transcriptManager.getTranscript('test-video-id');

      expect(TimestampFormatter.fromVtt).toHaveBeenCalledWith(mockVttContent);
    });
  });

  describe('track selection logic', () => {
    it('should select first track when no preference specified', async () => {
      mockYouTube.captions.list.mockResolvedValue({
        data: { items: mockCaptions },
      });

      mockYouTube.captions.download.mockResolvedValue({
        data: mockVttContent,
      });

      const result = await transcriptManager.getTranscript('test-video-id');

      expect(result.track).toEqual(mockCaptions[0]);
    });

    it('should prioritize exact language match', async () => {
      const multiLanguageCaptions = [
        ...mockCaptions,
        {
          id: 'caption-es',
          snippet: {
            videoId: 'test-video-id',
            language: 'es',
            name: 'Spanish',
          },
        },
      ];

      mockYouTube.captions.list.mockResolvedValue({
        data: { items: multiLanguageCaptions },
      });

      mockYouTube.captions.download.mockResolvedValue({
        data: mockVttContent,
      });

      const result = await transcriptManager.getTranscript('test-video-id', 'es');

      expect(result.track?.snippet?.language).toBe('es');
      expect(mockYouTube.captions.download).toHaveBeenCalledWith(
        { id: 'caption-es' },
        { responseType: 'text' }
      );
    });

    it('should handle single caption track', async () => {
      const singleCaption = [mockCaptions[0]];

      mockYouTube.captions.list.mockResolvedValue({
        data: { items: singleCaption },
      });

      mockYouTube.captions.download.mockResolvedValue({
        data: mockVttContent,
      });

      const result = await transcriptManager.getTranscript('test-video-id', 'fr');

      expect(result.success).toBe(true);
      expect(result.track).toEqual(singleCaption[0]);
    });

    it('should handle captions with undefined snippet', async () => {
      const captionsWithUndefinedSnippet = [
        {
          id: 'caption-undefined',
          snippet: undefined,
        },
        mockCaptions[0],
      ];

      mockYouTube.captions.list.mockResolvedValue({
        data: { items: captionsWithUndefinedSnippet },
      });

      mockYouTube.captions.download.mockResolvedValue({
        data: mockVttContent,
      });

      const result = await transcriptManager.getTranscript('test-video-id', 'en');

      expect(result.success).toBe(true);
      expect(result.track).toEqual(mockCaptions[0]); // Should find the valid one
    });
  });

  describe('edge cases', () => {
    it('should handle empty VTT content', async () => {
      mockYouTube.captions.list.mockResolvedValue({
        data: { items: [mockCaptions[0]] },
      });

      mockYouTube.captions.download.mockResolvedValue({
        data: '',
      });

      const { TimestampFormatter } = require('../../utils/timestamp-utils.js');
      TimestampFormatter.fromVtt.mockReturnValue([]);

      const result = await transcriptManager.getTranscript('test-video-id');

      expect(result.success).toBe(true);
      expect(result.transcript?.segments).toEqual([]);
      expect(result.raw).toBe('');
    });

    it('should handle very long video IDs', async () => {
      const longVideoId = 'a'.repeat(100);

      mockYouTube.captions.list.mockResolvedValue({
        data: { items: [mockCaptions[0]] },
      });

      mockYouTube.captions.download.mockResolvedValue({
        data: mockVttContent,
      });

      const result = await transcriptManager.getTranscript(longVideoId);

      expect(result.success).toBe(true);
      expect(result.transcript?.videoId).toBe(longVideoId);
      expect(mockYouTube.captions.list).toHaveBeenCalledWith({
        part: ['snippet'],
        videoId: longVideoId,
      });
    });

    it('should handle special characters in language codes', async () => {
      const specialLanguageCaptions = [
        {
          id: 'caption-special',
          snippet: {
            videoId: 'test-video-id',
            language: 'zh-CN',
            name: 'Chinese (Simplified)',
          },
        },
      ];

      mockYouTube.captions.list.mockResolvedValue({
        data: { items: specialLanguageCaptions },
      });

      mockYouTube.captions.download.mockResolvedValue({
        data: mockVttContent,
      });

      const result = await transcriptManager.getTranscript('test-video-id', 'zh-CN');

      expect(result.success).toBe(true);
      expect(result.transcript?.language).toBe('zh-CN');
    });

    it('should handle malformed caption response', async () => {
      mockYouTube.captions.list.mockResolvedValue({
        data: {}, // No items field
      });

      const result = await transcriptManager.getTranscript('test-video-id');

      expect(result.success).toBe(false);
      expect(result.message).toBe('No caption tracks available.');
    });

    it('should handle null response data', async () => {
      mockYouTube.captions.list.mockResolvedValue({
        data: { items: null },
      });

      const result = await transcriptManager.getTranscript('test-video-id');

      expect(result.success).toBe(false);
      expect(result.message).toBe('No caption tracks available.');
    });
  });

  describe('integration scenarios', () => {
    it('should handle complete workflow with multiple language preferences', async () => {
      const multiLanguageCaptions = [
        mockCaptions[0], // English
        mockCaptions[1], // German
        {
          id: 'caption-fr',
          snippet: {
            videoId: 'test-video-id',
            language: 'fr',
            name: 'French',
          },
        },
      ];

      mockYouTube.captions.list.mockResolvedValue({
        data: { items: multiLanguageCaptions },
      });

      mockYouTube.captions.download.mockResolvedValue({
        data: mockVttContent,
      });

      // Test sequence: preferred language found
      let result = await transcriptManager.getTranscript('test-video-id', 'fr');
      expect(result.success).toBe(true);
      expect(result.track?.snippet?.language).toBe('fr');

      // Test sequence: preferred language not found, fallback to first
      result = await transcriptManager.getTranscript('test-video-id', 'it');
      expect(result.success).toBe(true);
      expect(result.track?.snippet?.language).toBe('en');

      // Test sequence: no preference, use first
      result = await transcriptManager.getTranscript('test-video-id');
      expect(result.success).toBe(true);
      expect(result.track?.snippet?.language).toBe('en');
    });

    it('should maintain consistent behavior across multiple calls', async () => {
      mockYouTube.captions.list.mockResolvedValue({
        data: { items: [mockCaptions[0]] },
      });

      mockYouTube.captions.download.mockResolvedValue({
        data: mockVttContent,
      });

      const results = await Promise.all([
        transcriptManager.getTranscript('test-video-id'),
        transcriptManager.getTranscript('test-video-id'),
        transcriptManager.getTranscript('test-video-id'),
      ]);

      results.forEach(result => {
        expect(result.success).toBe(true);
        expect(result.transcript?.videoId).toBe('test-video-id');
        expect(result.transcript?.segments).toEqual(mockSegments);
      });

      expect(mockYouTube.captions.list).toHaveBeenCalledTimes(3);
      expect(mockYouTube.captions.download).toHaveBeenCalledTimes(3);
    });
  });
});