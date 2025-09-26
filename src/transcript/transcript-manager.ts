import { youtube_v3, google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library';
import { TimestampFormatter } from '../utils/timestamp-utils.js';

export interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

export interface ParsedTranscript {
  videoId: string;
  language: string;
  segments: TranscriptSegment[];
}

export interface TranscriptResult {
  success: boolean;
  transcript?: ParsedTranscript;
  raw?: string;
  message?: string;
  track?: youtube_v3.Schema$Caption;
}

export class TranscriptManager {
  private youtube: youtube_v3.Youtube;

  constructor(oauthClient: OAuth2Client) {
    this.youtube = google.youtube({ version: 'v3', auth: oauthClient });
  }

  async getTranscript(videoId: string, preferredLanguage?: string): Promise<TranscriptResult> {
    const tracks = await this.listTracks(videoId);
    if (tracks.length === 0) {
      return { success: false, message: 'No caption tracks available.' };
    }

    const selected = this.selectTrack(tracks, preferredLanguage);
    if (!selected?.id) {
      return { success: false, message: 'Unable to determine caption track ID.' };
    }

    const download = await this.youtube.captions.download({ id: selected.id }, { responseType: 'text' });
    const rawText = typeof download.data === 'string' ? download.data : download.data.toString();

    return {
      success: true,
      raw: rawText,
      track: selected,
      transcript: {
        videoId,
        language: selected.snippet?.language || 'unknown',
        segments: TimestampFormatter.fromVtt(rawText),
      },
    };
  }

  private async listTracks(videoId: string): Promise<youtube_v3.Schema$Caption[]> {
    const response = await this.youtube.captions.list({ part: ['snippet'], videoId });
    return response.data.items || [];
  }

  private selectTrack(tracks: youtube_v3.Schema$Caption[], preferredLanguage?: string) {
    if (!preferredLanguage) return tracks[0];
    return tracks.find(track => track.snippet?.language === preferredLanguage) || tracks[0];
  }
}
