import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();

let ffmpegLoaded = false;

interface FfmpegProcessOptions {
  file: File;
  loopCount: number;
  onProgress: (message: string, ratio: number) => void;
}

export async function processAudio({ file, loopCount, onProgress }: FfmpegProcessOptions): Promise<{ data: Uint8Array, duration: number }> {
  if (!ffmpegLoaded) {
    onProgress('Loading FFMPEG Core...', 0);
    await ffmpeg.load({
      coreURL: 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd/ffmpeg-core.js'
    });
    ffmpegLoaded = true;
  }

  ffmpeg.setLogger(({ type, message }) => {
    console.log(`FFMPEG [${type}]:`, message);
  });

  ffmpeg.setProgress(({ ratio }) => {
    onProgress('Looping audio...', Math.max(0, ratio));
  });

  const inputFile = 'input.audio';
  const outputFile = 'output.mp3';
  const listFile = 'mylist.txt';

  onProgress('Writing file to memory...', 0);
  ffmpeg.FS('writeFile', inputFile, await fetchFile(file));

  onProgress('Analyzing audio...', 0);
  // Run ffprobe to get duration, this is a separate command
  let duration = 0;
  let durationLogs = '';
  const ffprobeLogger = ({message}: {message: string}) => { durationLogs += message + '\n' };
  ffmpeg.setLogger(ffprobeLogger);
  
  await ffmpeg.run('-v', 'error', '-i', inputFile, '-f', 'null', '-');
  const durationMatch = durationLogs.match(/Duration: (\d{2}):(\d{2}):(\d{2})\.(\d{2})/);
  if (durationMatch) {
      const [, hours, minutes, seconds, centiseconds] = durationMatch;
      duration = parseInt(hours) * 3600 + parseInt(minutes) * 60 + parseInt(seconds) + parseInt(centiseconds) / 100;
  }
  
  // Reset logger for main process
  ffmpeg.setLogger(({ type, message }) => {
    console.log(`FFMPEG [${type}]:`, message);
  });

  const listContent = `file '${inputFile}'\n`.repeat(loopCount);
  ffmpeg.FS('writeFile', listFile, listContent);

  onProgress('Starting loop process...', 0);
  
  await ffmpeg.run(
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile,
    '-c:a', 'libmp3lame', // Re-encode to ensure compatibility and seamlessness
    '-q:a', '2', // VBR quality setting, 0 is best, 9 is worst. 2 is very good.
    outputFile
  );

  onProgress('Reading result...', 1);
  const data = ffmpeg.FS('readFile', outputFile);

  onProgress('Cleaning up...', 1);
  ffmpeg.FS('unlink', inputFile);
  ffmpeg.FS('unlink', listFile);
  ffmpeg.FS('unlink', outputFile);
  
  return { data, duration: duration * loopCount };
}