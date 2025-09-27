import { describe, it, expect } from 'vitest';
import { TimestampFormatter, type TimestampSegment } from '../../utils/timestamp-utils.js';

describe('TimestampFormatter', () => {
  describe('toTimestamp', () => {
    it('should format seconds-only timestamps', () => {
      expect(TimestampFormatter.toTimestamp(0)).toBe('0:00');
      expect(TimestampFormatter.toTimestamp(5)).toBe('0:05');
      expect(TimestampFormatter.toTimestamp(30)).toBe('0:30');
      expect(TimestampFormatter.toTimestamp(59)).toBe('0:59');
    });

    it('should format minutes and seconds', () => {
      expect(TimestampFormatter.toTimestamp(60)).toBe('1:00');
      expect(TimestampFormatter.toTimestamp(65)).toBe('1:05');
      expect(TimestampFormatter.toTimestamp(125)).toBe('2:05');
      expect(TimestampFormatter.toTimestamp(600)).toBe('10:00');
      expect(TimestampFormatter.toTimestamp(3599)).toBe('59:59');
    });

    it('should format hours, minutes, and seconds', () => {
      expect(TimestampFormatter.toTimestamp(3600)).toBe('1:00:00');
      expect(TimestampFormatter.toTimestamp(3661)).toBe('1:01:01');
      expect(TimestampFormatter.toTimestamp(7200)).toBe('2:00:00');
      expect(TimestampFormatter.toTimestamp(7323)).toBe('2:02:03');
      expect(TimestampFormatter.toTimestamp(36000)).toBe('10:00:00');
    });

    it('should handle decimal seconds by flooring', () => {
      expect(TimestampFormatter.toTimestamp(65.7)).toBe('1:05');
      expect(TimestampFormatter.toTimestamp(125.9)).toBe('2:05');
      expect(TimestampFormatter.toTimestamp(3661.5)).toBe('1:01:01');
    });

    it('should handle zero and negative values', () => {
      expect(TimestampFormatter.toTimestamp(0)).toBe('0:00');
      expect(TimestampFormatter.toTimestamp(-1)).toBe('-1:00'); // Math.floor of negative
      expect(TimestampFormatter.toTimestamp(-65)).toBe('-2:-5'); // Negative handling
    });

    it('should handle very large values', () => {
      expect(TimestampFormatter.toTimestamp(359999)).toBe('99:59:59');
      expect(TimestampFormatter.toTimestamp(360000)).toBe('100:00:00');
    });
  });

  describe('pad', () => {
    it('should pad single digit numbers', () => {
      expect(TimestampFormatter.pad(0)).toBe('00');
      expect(TimestampFormatter.pad(1)).toBe('01');
      expect(TimestampFormatter.pad(5)).toBe('05');
      expect(TimestampFormatter.pad(9)).toBe('09');
    });

    it('should not pad double digit numbers', () => {
      expect(TimestampFormatter.pad(10)).toBe('10');
      expect(TimestampFormatter.pad(25)).toBe('25');
      expect(TimestampFormatter.pad(59)).toBe('59');
      expect(TimestampFormatter.pad(99)).toBe('99');
    });

    it('should handle triple digit numbers', () => {
      expect(TimestampFormatter.pad(100)).toBe('100');
      expect(TimestampFormatter.pad(999)).toBe('999');
    });

    it('should handle negative numbers', () => {
      expect(TimestampFormatter.pad(-1)).toBe('-1');
      expect(TimestampFormatter.pad(-10)).toBe('-10');
    });
  });

  describe('parseTime', () => {
    it('should parse HH:MM:SS.mmm format', () => {
      expect(TimestampFormatter.parseTime('00:00:00.000')).toBe(0);
      expect(TimestampFormatter.parseTime('00:00:05.000')).toBe(5);
      expect(TimestampFormatter.parseTime('00:01:00.000')).toBe(60);
      expect(TimestampFormatter.parseTime('01:00:00.000')).toBe(3600);
      expect(TimestampFormatter.parseTime('01:01:01.000')).toBe(3661);
    });

    it('should parse milliseconds correctly', () => {
      expect(TimestampFormatter.parseTime('00:00:00.500')).toBe(0.5);
      expect(TimestampFormatter.parseTime('00:00:01.250')).toBe(1.25);
      expect(TimestampFormatter.parseTime('00:00:05.750')).toBe(5.75);
      expect(TimestampFormatter.parseTime('01:01:01.999')).toBe(3661.999);
    });

    it('should parse MM:SS format (without hours)', () => {
      expect(TimestampFormatter.parseTime('00:00.000')).toBe(0);
      expect(TimestampFormatter.parseTime('00:30.000')).toBe(30);
      expect(TimestampFormatter.parseTime('01:00.000')).toBe(60);
      expect(TimestampFormatter.parseTime('05:30.500')).toBe(330.5);
    });

    it('should handle missing milliseconds', () => {
      expect(TimestampFormatter.parseTime('00:00:00')).toBe(0);
      expect(TimestampFormatter.parseTime('00:01:30')).toBe(90);
      expect(TimestampFormatter.parseTime('01:00:00')).toBe(3600);
    });

    it('should handle edge cases', () => {
      expect(TimestampFormatter.parseTime('00:00:00.0')).toBe(0);
      expect(TimestampFormatter.parseTime('00:00:00.00')).toBe(0);
      expect(TimestampFormatter.parseTime('23:59:59.999')).toBe(86399.999);
    });
  });

  describe('fromVtt', () => {
    it('should parse simple VTT content', () => {
      const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
Hello world

2
00:00:05.000 --> 00:00:10.000
This is a test`;

      const segments = TimestampFormatter.fromVtt(vtt);

      expect(segments).toHaveLength(2);
      expect(segments[0]).toEqual({
        start: 0,
        duration: 5,
        text: 'Hello world',
      });
      expect(segments[1]).toEqual({
        start: 5,
        duration: 5,
        text: 'This is a test',
      });
    });

    it('should parse VTT content with multi-line text', () => {
      const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
This is line one
and this is line two

2
00:00:05.000 --> 00:00:08.000
Single line`;

      const segments = TimestampFormatter.fromVtt(vtt);

      expect(segments).toHaveLength(2);
      expect(segments[0]).toEqual({
        start: 0,
        duration: 5,
        text: 'This is line one and this is line two',
      });
      expect(segments[1]).toEqual({
        start: 5,
        duration: 3,
        text: 'Single line',
      });
    });

    it('should handle different line endings', () => {
      const vttCRLF = "WEBVTT\r\n\r\n1\r\n00:00:00.000 --> 00:00:05.000\r\nHello\r\n\r\n";
      const vttLF = "WEBVTT\n\n1\n00:00:00.000 --> 00:00:05.000\nHello\n\n";

      const segmentsCRLF = TimestampFormatter.fromVtt(vttCRLF);
      const segmentsLF = TimestampFormatter.fromVtt(vttLF);

      expect(segmentsCRLF).toHaveLength(1);
      expect(segmentsLF).toHaveLength(1);
      expect(segmentsCRLF[0].text).toBe('Hello');
      expect(segmentsLF[0].text).toBe('Hello');
    });

    it('should handle VTT with timestamps in different formats', () => {
      const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.500
First segment

2
00:01:30.250 --> 00:01:35.750
Second segment`;

      const segments = TimestampFormatter.fromVtt(vtt);

      expect(segments).toHaveLength(2);
      expect(segments[0]).toEqual({
        start: 0,
        duration: 5.5,
        text: 'First segment',
      });
      expect(segments[1]).toEqual({
        start: 90.25,
        duration: 5.5,
        text: 'Second segment',
      });
    });

    it('should handle empty VTT content', () => {
      expect(TimestampFormatter.fromVtt('')).toEqual([]);
      expect(TimestampFormatter.fromVtt('WEBVTT')).toEqual([]);
      expect(TimestampFormatter.fromVtt('WEBVTT\n\n')).toEqual([]);
    });

    it('should handle malformed VTT content gracefully', () => {
      const malformedVtt = `WEBVTT

Not a timestamp line
Some random text

1
Invalid timestamp format
Some text

2
00:00:00.000 --> 00:00:05.000
Valid segment`;

      const segments = TimestampFormatter.fromVtt(malformedVtt);

      expect(segments).toHaveLength(1);
      expect(segments[0]).toEqual({
        start: 0,
        duration: 5,
        text: 'Valid segment',
      });
    });

    it('should handle segments with no text', () => {
      const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000

2
00:00:05.000 --> 00:00:10.000
Valid text`;

      const segments = TimestampFormatter.fromVtt(vtt);

      expect(segments).toHaveLength(2);
      expect(segments[0]).toEqual({
        start: 0,
        duration: 5,
        text: '',
      });
      expect(segments[1]).toEqual({
        start: 5,
        duration: 5,
        text: 'Valid text',
      });
    });

    it('should handle overlapping or invalid duration segments', () => {
      const vtt = `WEBVTT

1
00:00:05.000 --> 00:00:03.000
Backwards segment

2
00:00:05.000 --> 00:00:05.000
Zero duration

3
00:00:10.000 --> 00:00:15.000
Normal segment`;

      const segments = TimestampFormatter.fromVtt(vtt);

      expect(segments).toHaveLength(3);
      expect(segments[0]).toEqual({
        start: 5,
        duration: 0, // Math.max(0, 3 - 5)
        text: 'Backwards segment',
      });
      expect(segments[1]).toEqual({
        start: 5,
        duration: 0,
        text: 'Zero duration',
      });
      expect(segments[2]).toEqual({
        start: 10,
        duration: 5,
        text: 'Normal segment',
      });
    });

    it('should handle VTT with cue settings and styling', () => {
      const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000 align:center
<c.yellow>Yellow text</c>

2
00:00:05.000 --> 00:00:10.000 position:50%
Regular text`;

      const segments = TimestampFormatter.fromVtt(vtt);

      expect(segments).toHaveLength(2);
      expect(segments[0]).toEqual({
        start: 0,
        duration: 5,
        text: '<c.yellow>Yellow text</c>',
      });
      expect(segments[1]).toEqual({
        start: 5,
        duration: 5,
        text: 'Regular text',
      });
    });

    it('should handle very long VTT files', () => {
      const segments: string[] = ['WEBVTT\n'];

      // Generate 100 segments
      for (let i = 0; i < 100; i++) {
        const start = i * 5;
        const end = (i + 1) * 5;
        segments.push(`${i + 1}`);
        segments.push(`00:${TimestampFormatter.pad(Math.floor(start / 60))}:${TimestampFormatter.pad(start % 60)}.000 --> 00:${TimestampFormatter.pad(Math.floor(end / 60))}:${TimestampFormatter.pad(end % 60)}.000`);
        segments.push(`Segment ${i + 1} text`);
        segments.push('');
      }

      const vtt = segments.join('\n');
      const parsed = TimestampFormatter.fromVtt(vtt);

      expect(parsed).toHaveLength(100);
      expect(parsed[0]).toEqual({
        start: 0,
        duration: 5,
        text: 'Segment 1 text',
      });
      expect(parsed[99]).toEqual({
        start: 495,
        duration: 5,
        text: 'Segment 100 text',
      });
    });

    it('should handle VTT with special characters and Unicode', () => {
      const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.000
Text with émojis 🎬 and spëcial chars

2
00:00:05.000 --> 00:00:10.000
Iñtërnâtiônàlizætiøn tëst`;

      const segments = TimestampFormatter.fromVtt(vtt);

      expect(segments).toHaveLength(2);
      expect(segments[0].text).toBe('Text with émojis 🎬 and spëcial chars');
      expect(segments[1].text).toBe('Iñtërnâtiônàlizætiøn tëst');
    });
  });

  describe('integration tests', () => {
    it('should work correctly in round-trip scenario', () => {
      const originalSeconds = [0, 65, 3661, 7323];

      originalSeconds.forEach(seconds => {
        const timestamp = TimestampFormatter.toTimestamp(seconds);
        expect(timestamp).toBeDefined();
        expect(typeof timestamp).toBe('string');

        // Verify format consistency
        if (seconds >= 3600) {
          expect(timestamp.split(':').length).toBe(3);
        } else {
          expect(timestamp.split(':').length).toBe(2);
        }
      });
    });

    it('should handle complete VTT processing workflow', () => {
      const vtt = `WEBVTT

1
00:00:00.000 --> 00:00:05.500
Welcome to the video

2
00:01:30.250 --> 00:01:35.750
This is the middle part

3
00:02:45.000 --> 00:02:50.000
Thank you for watching`;

      const segments = TimestampFormatter.fromVtt(vtt);

      // Verify parsing worked correctly
      expect(segments).toHaveLength(3);

      // Convert each segment start time back to timestamp format
      const timestamps = segments.map(segment =>
        TimestampFormatter.toTimestamp(segment.start)
      );

      expect(timestamps).toEqual(['0:00', '1:30', '2:45']);

      // Verify durations are positive
      segments.forEach(segment => {
        expect(segment.duration).toBeGreaterThanOrEqual(0);
      });
    });

    it('should handle edge cases consistently', () => {
      const edgeCases = [
        { seconds: 0, expected: '0:00' },
        { seconds: 59, expected: '0:59' },
        { seconds: 60, expected: '1:00' },
        { seconds: 3599, expected: '59:59' },
        { seconds: 3600, expected: '1:00:00' },
      ];

      edgeCases.forEach(({ seconds, expected }) => {
        expect(TimestampFormatter.toTimestamp(seconds)).toBe(expected);
      });
    });
  });
});