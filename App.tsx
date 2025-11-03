import React, { useState, useCallback, useMemo } from 'react';
import { Toaster, toast } from 'react-hot-toast';
import { UploadCloud, FileAudio, Download, X, Music, Clock, HardDrive, Zap, Github, Heart } from 'lucide-react';
import { useDropzone } from 'react-dropzone';

import ThemeToggle from './components/ThemeToggle';
import { useTheme } from './hooks/useTheme';
import { formatBytes, formatDuration } from './utils/format';
import { processAudio } from './services/ffmpegService';
import { ProcessResult } from './types';

const MAX_FILE_SIZE = 30 * 1024 * 1024; // 30 MB

const getAudioDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContext.decodeAudioData(reader.result as ArrayBuffer, 
        (buffer) => {
          resolve(buffer.duration);
        },
        (error) => {
          reject(`Error decoding audio data: ${error.message}`);
        }
      );
    };
    reader.onerror = (error) => {
      reject(`File reading error: ${error}`);
    };
    reader.readAsArrayBuffer(file);
  });
};


const App: React.FC = () => {
  const [theme, toggleTheme] = useTheme();
  const [file, setFile] = useState<File | null>(null);
  const [loopCount, setLoopCount] = useState<number>(3);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [progress, setProgress] = useState({ message: '', ratio: 0 });
  const [result, setResult] = useState<ProcessResult | null>(null);

  const handleFileDrop = useCallback((acceptedFiles: File[], fileRejections: any[]) => {
    if (fileRejections.length > 0) {
      const error = fileRejections[0].errors[0];
      if (error.code === 'file-too-large') {
        toast.error(`File is too large. Max size is ${formatBytes(MAX_FILE_SIZE)}.`);
      } else if (error.code === 'file-invalid-type') {
        toast.error('Invalid file type. Please upload MP3 or WAV.');
      } else {
        toast.error('File error: ' + error.message);
      }
      return;
    }
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
      setResult(null); // Reset result when new file is uploaded
      toast.success(`${acceptedFiles[0].name} selected!`);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: handleFileDrop,
    accept: { 'audio/mpeg': ['.mp3'], 'audio/wav': ['.wav'] },
    maxSize: MAX_FILE_SIZE,
    multiple: false,
  });
  
  const handleGenerate = async () => {
    if (!file) {
      toast.error('Please upload an audio file first.');
      return;
    }

    setIsProcessing(true);
    setProgress({ message: 'Initializing...', ratio: 0 });
    setResult(null);

    try {
      const onProgress = (message: string, ratio: number) => {
        setProgress({ message, ratio: Math.round(ratio * 100) });
      };
      
      onProgress('Analyzing audio...', 0);
      const originalDuration = await getAudioDuration(file);
      
      const { data, duration } = await processAudio({ file, loopCount, onProgress, originalDuration });

      const blob = new Blob([data.buffer], { type: 'audio/mp3' });
      const url = URL.createObjectURL(blob);
      
      const originalName = file.name.substring(0, file.name.lastIndexOf('.'));
      const fileName = `${originalName}_looped_${loopCount}x.mp3`;

      setResult({
        url,
        fileName,
        size: blob.size,
        duration,
      });

      toast.success('Loop generated successfully!');
    } catch (error) {
      console.error(error);
      toast.error(
        "An error occurred during processing. This can happen with unsupported audio codecs or if the browser's security policy blocks the core library. Please try again or use a different file.",
        { duration: 6000 }
      );
    } finally {
      setIsProcessing(false);
    }
  };
  
  const clearFile = () => {
    setFile(null);
    setResult(null);
  };

  const MemoizedFileDisplay = useMemo(() => {
    if (!file) return null;
    return (
       <div className="mt-4 bg-gray-100 dark:bg-gray-700 p-3 rounded-lg flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
              <FileAudio className="w-6 h-6 text-indigo-500" />
              <div className="text-sm text-left">
                  <p className="font-medium text-gray-800 dark:text-gray-200 truncate max-w-[200px] sm:max-w-xs">{file.name}</p>
                  <p className="text-gray-500 dark:text-gray-400">{formatBytes(file.size)}</p>
              </div>
          </div>
          <button onClick={clearFile} className="p-1 rounded-full text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600">
              <X className="w-5 h-5" />
          </button>
      </div>
    );
  }, [file]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-gray-100 font-sans antialiased">
      <div className="absolute inset-0 -z-10 h-full w-full bg-white dark:bg-gray-900 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"><div className="absolute left-0 right-0 top-0 -z-10 m-auto h-[310px] w-[310px] rounded-full bg-indigo-400 opacity-20 blur-[100px]"></div></div>

      <Toaster position="top-center" toastOptions={{
          className: 'dark:bg-gray-700 dark:text-white',
      }} />

      <header className="p-4 flex justify-between items-center max-w-7xl mx-auto">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <Music className="text-indigo-500"/> ManaoLoop
        </h1>
        <ThemeToggle theme={theme} toggleTheme={toggleTheme} />
      </header>

      <main className="flex flex-col items-center justify-center p-4 text-center">
        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight mt-8 bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-purple-500">
          Free Online Audio Looper
        </h2>
        <p className="mt-4 max-w-xl text-lg text-gray-600 dark:text-gray-300">
          Loop your audio files seamlessly, right in your browser. All processing is done locally for privacy and speed.
        </p>

        <div className="w-full max-w-lg mt-10 p-6 md:p-8 bg-white/50 dark:bg-gray-800/50 backdrop-blur-lg border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg">
          {!isProcessing && !result && (
            <div className="space-y-6 animate-fade-in">
              <div>
                <div {...getRootProps()} className={`p-10 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${isDragActive ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-900/50' : 'border-gray-300 dark:border-gray-600 hover:border-indigo-400'}`}>
                  <input {...getInputProps()} />
                  <div className="flex flex-col items-center gap-2 text-gray-500 dark:text-gray-400">
                    <UploadCloud className="w-10 h-10" />
                    <p className="font-semibold">{isDragActive ? "Drop the file here..." : "Drag & drop audio file here"}</p>
                    <p className="text-sm">or click to select file</p>
                    <p className="text-xs mt-2 text-gray-400">MP3, WAV accepted (Max {formatBytes(MAX_FILE_SIZE)})</p>
                  </div>
                </div>
                {MemoizedFileDisplay}
              </div>
            
              <div>
                <label htmlFor="loop-count" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Loop Count (2-50)
                </label>
                <input
                  type="number"
                  id="loop-count"
                  value={loopCount}
                  onChange={(e) => setLoopCount(Math.max(2, Math.min(50, parseInt(e.target.value, 10) || 2)))}
                  className="w-full p-3 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-center focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  min="2"
                  max="50"
                  disabled={!file}
                />
              </div>

              <button
                onClick={handleGenerate}
                disabled={!file || isProcessing}
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-indigo-400 dark:disabled:bg-indigo-800 disabled:cursor-not-allowed transition-all transform hover:scale-105"
              >
                <Zap className="w-5 h-5" />
                Generate Loop
              </button>
            </div>
          )}

          {isProcessing && (
            <div className="flex flex-col items-center justify-center space-y-4 h-64 animate-fade-in">
                <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="font-semibold text-lg">{progress.message}</p>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                    <div className="bg-indigo-600 h-2.5 rounded-full" style={{ width: `${progress.ratio}%`, transition: 'width 0.3s ease-in-out' }}></div>
                </div>
                <p className="text-sm text-gray-500">{progress.ratio}%</p>
            </div>
          )}
          
          {result && !isProcessing && (
            <div className="animate-fade-in space-y-6">
              <h3 className="text-xl font-bold text-green-500">Loop Ready!</h3>
              <div className="bg-gray-100 dark:bg-gray-700 p-4 rounded-lg space-y-3 text-left">
                <p className="font-medium truncate text-gray-800 dark:text-gray-200 flex items-center gap-2"><Music className="w-5 h-5 text-indigo-400"/> {result.fileName}</p>
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300"><HardDrive className="w-4 h-4"/> Size: <strong className="text-gray-800 dark:text-gray-100">{formatBytes(result.size)}</strong></span>
                  <span className="flex items-center gap-1 text-gray-600 dark:text-gray-300"><Clock className="w-4 h-4"/> Duration: <strong className="text-gray-800 dark:text-gray-100">{formatDuration(result.duration)}</strong></span>
                </div>
              </div>

              <a
                href={result.url}
                download={result.fileName}
                className="w-full flex items-center justify-center gap-2 bg-green-600 text-white font-semibold py-3 px-4 rounded-lg shadow-md hover:bg-green-700 transition-all transform hover:scale-105"
              >
                <Download className="w-5 h-5" />
                Download Looped Audio
              </a>
              <button
                onClick={() => { setFile(null); setResult(null); }}
                className="w-full text-indigo-600 dark:text-indigo-400 hover:underline font-medium mt-2"
              >
                Start Over
              </button>
            </div>
          )}
        </div>
      </main>

      <footer className="text-center p-6 text-sm text-gray-500 dark:text-gray-400 mt-12">
        <p className="flex items-center justify-center gap-1.5">
          Built with <Heart className="w-4 h-4 text-red-500"/> by Manao Tools
        </p>
        <a href="https://github.com/your-repo" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 hover:text-indigo-500 transition-colors mt-2">
            <Github className="w-4 h-4" />
            View on GitHub
        </a>
      </footer>
    </div>
  );
};

export default App;
