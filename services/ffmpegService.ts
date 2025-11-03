import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile } from '@ffmpeg/util';

const ffmpeg = new FFmpeg();
let ffmpegLoadPromise: Promise<void> | null = null;

async function loadFFmpeg(onProgress: (message: string) => void) {
  if (ffmpegLoadPromise) {
    return ffmpegLoadPromise;
  }
  
  onProgress('Loading FFMPEG Core...');
  ffmpeg.setLogger(({ type, message }) => {
    console.log(`FFMPEG [${type}]:`, message);
  });

  const baseURL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';

  ffmpegLoadPromise = ffmpeg.load({
    coreURL: `${baseURL}/ffmpeg-core.js`,
    wasmURL: `${baseURL}/ffmpeg-core.wasm`,
    workerURL: `${baseURL}/ffmpeg-core.worker.js`,
  });

  return ffmpegLoadPromise;
}

interface FfmpegProcessOptions {
  file: File;
  loopCount: number;
  onProgress: (message: string, ratio: number) => void;
}

export async function processAudio({ file, loopCount, onProgress }: FfmpegProcessOptions): Promise<{ data: Uint8Array }> {
  await loadFFmpeg((message) => onProgress(message, 0));
  
  ffmpeg.setProgress(({ ratio }) => {
    const clampedRatio = Math.max(0, Math.min(1, ratio));
    onProgress('Looping audio...', clampedRatio);
  });

  const extension = file.name.split('.').pop() || 'audio';
  const inputFile = `input.${extension}`;
  const outputFile = 'output.mp3';
  const listFile = 'mylist.txt';

  onProgress('Preparing file in memory...', 0);
  await ffmpeg.FS.writeFile(inputFile, await fetchFile(file));

  const listContent = `file '${inputFile}'\n`.repeat(loopCount);
  ffmpeg.FS.writeFile(listFile, listContent);

  onProgress('Starting loop process...', 0);
  
  await ffmpeg.run(
    '-f', 'concat',
    '-safe', '0',
    '-i', listFile,
    '-c:a', 'libmp3lame',
    '-q:a', '2',
    outputFile
  );

  onProgress('Finalizing result...', 1);
  // FIX: Corrected typo `Uint8Aray` to `Uint8Array`.
  const data = ffmpeg.FS.readFile(outputFile) as Uint8Array;

  onProgress('Cleaning up memory...', 1);
  ffmpeg.FS.unlink(inputFile);
  ffmpeg.FS.unlink(listFile);
  ffmpeg.FS.unlink(outputFile);
  
  return { data };
}