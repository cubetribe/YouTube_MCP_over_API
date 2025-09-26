export interface TimestampSegment {
  start: number;
  duration: number;
  text: string;
}

export class TimestampFormatter {
  static toTimestamp(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) {
      return [hours, minutes, secs].map(TimestampFormatter.pad).join(':');
    }
    return [minutes, secs].map(TimestampFormatter.pad).join(':');
  }

  static pad(value: number): string {
    return value.toString().padStart(2, '0');
  }

  static fromVtt(vtt: string): TimestampSegment[] {
    const segments: TimestampSegment[] = [];
    const lines = vtt.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\d{2}:\d{2}:\d{2}\.\d{3} -->/.test(line)) {
        const [startStr, endStr] = line.split(' --> ');
        const textLines: string[] = [];
        i += 1;
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i]);
          i += 1;
        }
        const start = TimestampFormatter.parseTime(startStr);
        const end = TimestampFormatter.parseTime(endStr);
        segments.push({
          start,
          duration: Math.max(0, end - start),
          text: textLines.join(' ').trim(),
        });
      }
    }
    return segments;
  }

  static parseTime(timestamp: string): number {
    const [hms, milli] = timestamp.split('.');
    const parts = hms.split(':').map(Number);
    const [hours, minutes, seconds] = parts.length === 3 ? parts : [0, parts[0], parts[1]];
    return hours * 3600 + minutes * 60 + seconds + Number(`0.${milli || '0'}`);
  }
}
