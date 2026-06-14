import { useState, useRef, useEffect } from 'react';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { 
  UploadCloud, FileVideo, Loader2, Download, AlertCircle, Trash2, 
  Settings, HelpCircle, ShieldCheck, Play, Pause, Square, MoreVertical, Plus, Info, X, FolderUp, Edit3, Archive, Type, RefreshCw
} from 'lucide-react';
import JSZip from 'jszip';
import './App.css';

// Komponen FileCard untuk merender tiap item dalam grid
function FileCard({ f, isConverting, removeFile, onOpenFullscreen, onRename, isSelected, toggleSelect, onRetry }) {
  const isVideo = f.file.type.includes('video') || f.file.name.endsWith('.webm');
  const typeTag = isVideo ? 'WEBM' : 'APNG';
  const sizeMB = (f.file.size / (1024 * 1024)).toFixed(2) + ' MB';
  const resolution = f.metadata?.resolution || '-';
  const fps = f.metadata?.fps && f.metadata?.fps !== 'N/A' ? `${f.metadata.fps} FPS` : '-';
  
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(f.customName || f.file.name);

  const handleRenameSubmit = () => {
    setIsEditing(false);
    if (editName.trim() && editName !== (f.customName || f.file.name)) {
      onRename(f.id, editName.trim());
    } else {
      setEditName(f.customName || f.file.name);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleRenameSubmit();
    if (e.key === 'Escape') {
      setIsEditing(false);
      setEditName(f.customName || f.file.name);
    }
  };

  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return "00:00";
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = Math.floor(seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const durationStr = formatTime(f.metadata?.duration);
  const mediaSrc = f.status === 'success' ? f.url : f.previewUrl;
  const showVideo = isVideo && f.status !== 'success';

  const displayName = f.customName || f.file.name;

  return (
    <div className={`file-card status-${f.status} ${isSelected ? 'selected' : ''}`}>
      <input 
        type="checkbox" 
        className="file-card-checkbox" 
        checked={isSelected}
        onChange={() => toggleSelect(f.id)}
      />
      <div className="file-card-header">
        <div className="file-card-icon">
          <FileVideo size={20} />
        </div>
        <div className="file-card-title-group">
          <div className="file-card-name-edit">
            {isEditing ? (
              <input 
                type="text" 
                className="file-card-name-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            ) : (
              <>
                <div className="file-card-name" title={displayName} onClick={() => setIsEditing(true)}>
                  {displayName}
                </div>
                <button className="btn-icon-footer" onClick={() => setIsEditing(true)} style={{ padding: '2px' }} title="Rename">
                  <Edit3 size={14} />
                </button>
              </>
            )}
          </div>
          <div className="file-card-meta">
            <span className="file-card-meta-tag">{typeTag}</span>
            <span>{sizeMB}</span>
            <span>{resolution}</span>
            <span>{fps}</span>
          </div>
        </div>
        <button className="btn-icon-footer" style={{ padding: '0', color: '#d1d5db' }}>
          <MoreVertical size={18} />
        </button>
      </div>

      <div className="file-card-media" onClick={() => onOpenFullscreen(mediaSrc, isVideo)} title="Klik untuk layar penuh">
        {showVideo ? (
          <video src={mediaSrc} autoPlay loop muted playsInline />
        ) : (
          <img src={mediaSrc} alt="thumbnail" />
        )}
      </div>

      {/* Timeline Controls (Visual Only for now) */}
      <div className="file-card-timeline">
        <button className="timeline-play-btn">
          <Play size={16} fill="currentColor" />
        </button>
        <div className="timeline-progress">
          {f.status === 'converting' ? (
            <div className="timeline-progress-fill" style={{ width: `${f.progress}%` }}></div>
          ) : (
            <div className="timeline-progress-fill" style={{ width: '30%' }}></div>
          )}
        </div>
        <div className="timeline-time">
          00:00 / {durationStr}
        </div>
      </div>

      <div className="file-card-footer">
        {f.status === 'pending' && <span className="status-badge pending">Siap dikonversi</span>}
        {f.status === 'converting' && (
          <span className="status-badge converting">
            <Loader2 className="spinner" size={12} /> Konversi {f.progress}%
          </span>
        )}
        {f.status === 'success' && <span className="status-badge success">Selesai</span>}
        {f.status === 'error' && (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <span className="status-badge error" title={f.errorMessage}>Gagal</span>
            <button className="btn-icon-footer" onClick={onRetry} title="Coba Ulang" disabled={isConverting} style={{ padding: '4px' }}>
              <RefreshCw size={14} />
            </button>
          </div>
        )}

        {f.status === 'success' ? (
          <a href={f.url} download={(f.customName || f.file.name).replace(/\.[^/.]+$/, '') + '_converted.webp'} className="btn-download-small" title="Download WebP">
            <Download size={14} /> <span style={{ marginLeft: '4px', fontSize: '12px', fontWeight: '500' }}>Simpan</span>
          </a>
        ) : (
          <button 
            className="btn-icon-footer" 
            onClick={() => removeFile(f.id)} 
            disabled={isConverting}
            title="Hapus"
          >
            <Trash2 size={16} />
          </button>
        )}
      </div>
    </div>
  );
}

function App() {
  const [loaded, setLoaded] = useState(false);
  const [conversionState, setConversionState] = useState('idle'); // 'idle' | 'running' | 'paused'
  const conversionStateRef = useRef('idle');
  const [error, setError] = useState('');
  
  const updateConversionState = (newState) => {
    setConversionState(newState);
    conversionStateRef.current = newState;
  };
  
  const isConverting = conversionState !== 'idle';
  
  const [files, setFiles] = useState([]);
  
  const [settings, setSettings] = useState({
    quality: 80,
    loop: '0',
    preset: 'default',
    preserveTransparency: true,
    conversionTimeout: 120,  // seconds per file before skipping
    conversionInterval: 200, // ms delay between files (browser breathing room)
  });

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [isZipping, setIsZipping] = useState(false);
  const [bulkRename, setBulkRename] = useState({ prefix: '', suffix: '', search: '', replace: '' });

  const ffmpegRef = useRef(new FFmpeg());
  const activeFileIdRef = useRef(null);
  const activeProbeIdRef = useRef(null);
  const probeInfoRef = useRef({});
  const probeQueueRef = useRef([]);
  const conversionLogRef = useRef('');
  const [isProbing, setIsProbing] = useState(false);
  
  // Fullscreen State
  const [fullscreenMedia, setFullscreenMedia] = useState(null); // { url, isVideo }

  const CORE_BASE_URL = 'https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm';

  const attachFFmpegListeners = (ffmpeg) => {
    ffmpeg.on('progress', ({ progress }) => {
      if (activeFileIdRef.current) {
        setFiles(prev => prev.map(f => 
          f.id === activeFileIdRef.current 
            ? { ...f, progress: Math.max(0, Math.min(100, Math.round(progress * 100))) } 
            : f
        ));
      }
    });
    ffmpeg.on('log', ({ message }) => {
      if (activeProbeIdRef.current) {
        const id = activeProbeIdRef.current;
        if (!probeInfoRef.current[id]) probeInfoRef.current[id] = { resolution: '', fps: 0, duration: 0 };
        if (message.includes('Video:')) {
          const resMatch = message.match(/(\d{2,})x(\d{2,})/);
          if (resMatch && !probeInfoRef.current[id].resolution) probeInfoRef.current[id].resolution = resMatch[0];
          const fpsMatch = message.match(/([\d.]+)\s+fps/);
          if (fpsMatch && !probeInfoRef.current[id].fps) probeInfoRef.current[id].fps = parseFloat(fpsMatch[1]);
        }
        if (message.includes('Duration:')) {
          const durMatch = message.match(/Duration:\s+(\d{2}):(\d{2}):([\d.]+)/);
          if (durMatch && !probeInfoRef.current[id].duration) {
            probeInfoRef.current[id].duration =
              parseInt(durMatch[1]) * 3600 + parseInt(durMatch[2]) * 60 + parseFloat(durMatch[3]);
          }
        }
      }
      if (activeFileIdRef.current && conversionLogRef.current !== undefined) {
        conversionLogRef.current += message + '\n';
      }
    });
  };

  const loadFFmpegCore = async (ffmpeg) => {
    await ffmpeg.load({
      coreURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
      wasmURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
      workerURL: await toBlobURL(`${CORE_BASE_URL}/ffmpeg-core.worker.js`, 'text/javascript'),
    });
  };

  // Run ffmpeg.exec with a timeout; on timeout, terminates and reloads FFmpeg
  const execWithTimeout = async (ffmpeg, args, timeoutMs = 25000) => {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error('TIMEOUT'));
      }, timeoutMs);
      ffmpeg.exec(args)
        .then(code => { clearTimeout(timer); resolve(code); })
        .catch(err => { clearTimeout(timer); reject(err); });
    });
  };

  const load = async () => {
    try {
      const ffmpeg = ffmpegRef.current;
      attachFFmpegListeners(ffmpeg);
      await loadFFmpegCore(ffmpeg);
      setLoaded(true);
    } catch (err) {
      console.error(err);
      setError('Gagal memuat FFmpeg. Pastikan browser mendukung Wasm dan SharedArrayBuffer.');
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const addFiles = (newFiles) => {
    const fileObjects = Array.from(newFiles).map(file => ({
      id: Math.random().toString(36).substring(7),
      file,
      customName: file.name,
      status: 'pending',
      progress: 0,
      url: null,
      previewUrl: URL.createObjectURL(file),
      errorMessage: '',
      metadata: null
    }));
    
    setFiles(prev => [...prev, ...fileObjects]);
    
    fileObjects.forEach(f => probeQueueRef.current.push(f));
    processProbeQueue();
  };

  const processProbeQueue = async () => {
    if (isProbing || probeQueueRef.current.length === 0 || !ffmpegRef.current.loaded) return;
    setIsProbing(true);
    
    const ffmpeg = ffmpegRef.current;
    
    while (probeQueueRef.current.length > 0) {
      if (activeFileIdRef.current) {
        await new Promise(r => setTimeout(r, 1000));
        continue;
      }
      
      const currentFile = probeQueueRef.current.shift();
      activeProbeIdRef.current = currentFile.id;
      probeInfoRef.current[currentFile.id] = { resolution: 'N/A', fps: 0, duration: 0, frames: 0 };
      
      try {
        const name = `probe_${currentFile.id}_${currentFile.file.name}`;
        await ffmpeg.writeFile(name, await fetchFile(currentFile.file));
        await ffmpeg.exec(['-i', name]); 
      } catch (err) {
        console.error(err);
      } finally {
        const name = `probe_${currentFile.id}_${currentFile.file.name}`;
        try { await ffmpeg.deleteFile(name); } catch(err) { console.error('Cleanup error:', err); }
      }
      
      const info = probeInfoRef.current[currentFile.id];
      const frames = info.fps * info.duration;
      info.frames = frames > 0 ? Math.round(frames) : (info.fps ? 'Unknown' : 'N/A');
      if (!info.fps) info.fps = 'N/A';
      
      setFiles(prev => prev.map(f => 
        f.id === currentFile.id ? { ...f, metadata: info } : f
      ));
      
      activeProbeIdRef.current = null;
    }
    
    setIsProbing(false);
  };

  const handleFileChange = (e) => {
    if (e.target.files.length > 0) {
      // Basic validation for image/video types
      const validFiles = Array.from(e.target.files).filter(f => f.name.match(/\.(apng|png|webm)$/i));
      if (validFiles.length > 0) {
        addFiles(validFiles);
      }
    }
    e.target.value = null;
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const getFilesFromEntry = async (entry) => {
    if (entry.isFile) {
      return new Promise((resolve) => {
        entry.file(file => {
          if (file.name.match(/\.(apng|png|webm)$/i)) {
            resolve([file]);
          } else {
            resolve([]);
          }
        });
      });
    } else if (entry.isDirectory) {
      const dirReader = entry.createReader();
      
      const readEntries = () => {
        return new Promise((resolve, reject) => {
          dirReader.readEntries(async (entries) => {
            if (entries.length === 0) {
              resolve([]);
            } else {
              let files = [];
              for (const child of entries) {
                const childFiles = await getFilesFromEntry(child);
                files = files.concat(childFiles);
              }
              const nextFiles = await readEntries();
              resolve(files.concat(nextFiles));
            }
          }, reject);
        });
      };
      
      return await readEntries();
    }
    return [];
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    let allExtractedFiles = [];
    
    if (e.dataTransfer.items) {
      const items = Array.from(e.dataTransfer.items);
      for (const item of items) {
        const entry = item.webkitGetAsEntry();
        if (entry) {
          const files = await getFilesFromEntry(entry);
          allExtractedFiles = allExtractedFiles.concat(files);
        }
      }
    } else if (e.dataTransfer.files.length > 0) {
       const validFiles = Array.from(e.dataTransfer.files).filter(f => f.name.match(/\.(apng|png|webm)$/i));
       allExtractedFiles = validFiles;
    }
    
    if (allExtractedFiles.length > 0) {
       addFiles(allExtractedFiles);
    }
  };

  const removeFile = (id) => {
    if (isConverting) return;
    setFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file && file.previewUrl) URL.revokeObjectURL(file.previewUrl);
      if (file && file.url) URL.revokeObjectURL(file.url);
      return prev.filter(f => f.id !== id);
    });
  };

  const clearAll = () => {
    if (isConverting) return;
    files.forEach(file => {
      if (file.previewUrl) URL.revokeObjectURL(file.previewUrl);
      if (file.url) URL.revokeObjectURL(file.url);
    });
    setFiles([]);
    setSelectedIds(new Set());
  };

  const retryFailed = () => {
    if (isConverting) return;
    setFiles(prev => prev.map(f => f.status === 'error' ? { ...f, status: 'pending', errorMessage: '' } : f));
  };

  const retrySingle = (id) => {
    if (isConverting) return;
    setFiles(prev => prev.map(f => f.id === id ? { ...f, status: 'pending', errorMessage: '' } : f));
  };

  const handleRename = (id, newName) => {
    setFiles(prev => prev.map(f => f.id === id ? { ...f, customName: newName } : f));
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === files.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(files.map(f => f.id)));
    }
  };

  const downloadSelectedZip = async () => {
    const filesToZip = files.filter(f => 
      f.status === 'success' && f.url && (selectedIds.size === 0 || selectedIds.has(f.id))
    );

    if (filesToZip.length === 0 || isZipping) return;
    setIsZipping(true);
    try {
      const zip = new JSZip();
      
      for (const f of filesToZip) {
        const response = await fetch(f.url);
        const blob = await response.blob();
        const baseName = (f.customName || f.file.name).replace(/\.[^/.]+$/, '');
        zip.file(`${baseName}_converted.webp`, blob);
      }
      
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `konverter_webp_batch_${new Date().getTime()}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error creating zip', err);
      setError('Gagal membuat file ZIP.');
    }
    setIsZipping(false);
  };

  const applyBulkRename = () => {
    const hasPrefix = !!bulkRename.prefix;
    const hasSuffix = !!bulkRename.suffix;
    const hasSearch = !!bulkRename.search;
    if (!hasPrefix && !hasSuffix && !hasSearch) return;

    setFiles(prev => prev.map(f => {
      if (selectedIds.size > 0 && !selectedIds.has(f.id)) return f;

      const lastDot = f.customName.lastIndexOf('.');
      const base = lastDot !== -1 ? f.customName.substring(0, lastDot) : f.customName;
      const ext = lastDot !== -1 ? f.customName.substring(lastDot) : '';

      let newBase = base;
      // Apply search & replace first
      if (hasSearch) {
        newBase = newBase.split(bulkRename.search).join(bulkRename.replace);
      }
      // Then apply prefix/suffix
      newBase = `${bulkRename.prefix}${newBase}${bulkRename.suffix}`;

      return { ...f, customName: `${newBase}${ext}` };
    }));
    setBulkRename({ prefix: '', suffix: '', search: '', replace: '' });
  };

  const convertFiles = async () => {
    if (files.length === 0 || !loaded || isConverting) return;
    updateConversionState('running');
    setError('');
    
    for (let i = 0; i < files.length; i++) {
      if (conversionStateRef.current === 'idle') break; // Stopped
      
      while (conversionStateRef.current === 'paused') {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      if (conversionStateRef.current === 'idle') break; // Stopped during pause

      const currentFile = files[i];
      if (currentFile.status !== 'pending') continue;
      
      // Add interval delay between files to give browser GC room to breathe
      if (i > 0 && settings.conversionInterval > 0) {
        await new Promise(resolve => setTimeout(resolve, settings.conversionInterval));
      }
      
      // ⚠️ Read ffmpegRef.current INSIDE the loop - it may be replaced after a timeout+reload
      let ffmpeg = ffmpegRef.current;
      
      activeFileIdRef.current = currentFile.id;
      conversionLogRef.current = '';
      
      setFiles(prev => prev.map(f => 
        f.id === currentFile.id ? { ...f, status: 'converting', progress: 0 } : f
      ));
      
      const ext = currentFile.file.name.split('.').pop().toLowerCase();
      const safeName = `input_${currentFile.id}.${ext}`;
      const outputName = `out_${currentFile.id}.webp`;
      
      try {
        await ffmpeg.writeFile(safeName, await fetchFile(currentFile.file));
        
        // Build transparency args - yuva420p is native for webp alpha
        const pixFmtArgs = settings.preserveTransparency ? ['-pix_fmt', 'yuva420p'] : [];

        const isWebm = ext === 'webm';
        const baseArgs = [
          ...pixFmtArgs,
          '-loop', settings.loop,
          '-lossless', '0',
          '-q:v', settings.quality.toString(),
          '-preset', settings.preset
        ];

        const strategies = [];
        
        if (isWebm) {
          // WebM files often need explicit decoders to extract the alpha channel properly
          strategies.push({
            name: 'WebM VP9 Decoder',
            args: ['-vcodec', 'libvpx-vp9', '-i', safeName, '-c:v', 'libwebp_anim', ...baseArgs, '-an', outputName]
          });
          strategies.push({
            name: 'WebM VP8 Decoder',
            args: ['-vcodec', 'libvpx', '-i', safeName, '-c:v', 'libwebp_anim', ...baseArgs, '-an', outputName]
          });
        }
        
        // Standard strategies
        strategies.push({
          name: 'libwebp_anim (Default)',
          args: ['-i', safeName, '-c:v', 'libwebp_anim', ...baseArgs, '-an', outputName]
        });
        
        strategies.push({
          name: 'libwebp_anim (Without -an)',
          args: ['-i', safeName, '-c:v', 'libwebp_anim', ...baseArgs, outputName]
        });
        
        strategies.push({
          name: 'libwebp (Single-frame fallback)',
          args: [
            '-i', safeName, 
            '-vcodec', 'libwebp', 
            '-pix_fmt', 'yuv420p', 
            '-loop', settings.loop, 
            '-lossless', '0', 
            '-q:v', settings.quality.toString(), 
            '-preset', settings.preset, 
            '-an', 
            outputName
          ]
        });

        let exitCode = -1;
        
        for (const strategy of strategies) {
          let strategyFailed = false;
          try {
            console.log(`Trying strategy: ${strategy.name}`);
            exitCode = await execWithTimeout(ffmpeg, strategy.args, settings.conversionTimeout * 1000);
          } catch (err) {
            strategyFailed = true;
            console.error(`Strategy ${strategy.name} failed with error:`, err);
            
            // Reload FFmpeg on ANY error (timeout or WASM crash) to prevent cascade failures
            try { ffmpeg.terminate(); } catch { /* ignore */ }
            const newFFmpeg = new FFmpeg();
            ffmpegRef.current = newFFmpeg;
            attachFFmpegListeners(newFFmpeg);
            await loadFFmpegCore(newFFmpeg);
            ffmpeg = newFFmpeg;
            
            // CRITICAL: Re-write the input file because the new FFmpeg instance has an empty memory filesystem!
            await ffmpeg.writeFile(safeName, await fetchFile(currentFile.file));
          }
          
          if (!strategyFailed && exitCode === 0) {
            console.log(`Strategy ${strategy.name} succeeded!`);
            break;
          }
        }
        
        if (exitCode !== 0) {
          const logSnippet = conversionLogRef.current.split('\n').slice(-5).join(' | ');
          throw new Error(`Semua strategi gagal. Last log: ${logSnippet.substring(0, 100)}`);
        }
        
        const data = await ffmpegRef.current.readFile(outputName);
        const url = URL.createObjectURL(new Blob([data.buffer], { type: 'image/webp' }));
        
        setFiles(prev => prev.map(f => 
          f.id === currentFile.id ? { ...f, status: 'success', progress: 100, url } : f
        ));
        
      } catch (err) {
        console.error('Conversion error:', err.message);
        const shortMsg = err.message.substring(0, 120);
        setFiles(prev => prev.map(f => 
          f.id === currentFile.id ? { ...f, status: 'error', errorMessage: shortMsg } : f
        ));
      } finally {
        // Use ffmpegRef.current in finally - it's the most current instance
        const currentFFmpeg = ffmpegRef.current;
        try { await currentFFmpeg.deleteFile(safeName); } catch { /* cleanup best-effort */ }
        try { await currentFFmpeg.deleteFile(outputName); } catch { /* cleanup best-effort */ }
      }
    }
    
    activeFileIdRef.current = null;
    updateConversionState('idle');
  };

  const hasPendingFiles = files.some(f => f.status === 'pending');
  const successCount = files.filter(f => f.status === 'success').length;
  const failCount = files.filter(f => f.status === 'error').length;
  const selectedSuccessCount = files.filter(f => selectedIds.has(f.id) && f.status === 'success').length;

  return (
    <div className="app-wrapper">
      {error && (
        <div className="alert error">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {!loaded ? (
        <div className="loading-core">
          <Loader2 className="spinner" size={40} />
          <p>Memuat Engine Konversi...</p>
        </div>
      ) : (
        <div className="main-content">
          {/* Left Sidebar: Controls */}
          <div className="sidebar">
            <div className="card" style={{ padding: '0', overflow: 'hidden', border: 'none', background: 'transparent', boxShadow: 'none' }}>
              <h3 style={{ color: 'var(--primary)', marginBottom: '1rem', fontSize: '1rem' }}>1. Upload File</h3>
              <div 
                className="dropzone"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <div className="dropzone-label">
                  <div className="upload-icon-circle">
                    <UploadCloud size={28} />
                  </div>
                  <h3 style={{ fontSize: '0.9rem' }}>Drag & drop APNG / WEBM</h3>
                  <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0' }}>ataupun pilih langsung dari Folder</p>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', flexDirection: 'column' }}>
                    <label className="btn-choose" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', cursor: 'pointer', margin: 0, justifyContent: 'center' }}>
                      <FileVideo size={16} /> Pilih File
                      <input 
                        type="file" 
                        accept="image/apng,image/png,video/webm" 
                        multiple
                        onChange={handleFileChange}
                        disabled={isConverting}
                        style={{ display: 'none' }}
                      />
                    </label>
                    <label className="btn-choose" style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', cursor: 'pointer', margin: 0, justifyContent: 'center', backgroundColor: '#4f46e5' }}>
                      <FolderUp size={16} /> Pilih Folder
                      <input 
                        type="file" 
                        webkitdirectory="" 
                        directory=""
                        multiple
                        onChange={handleFileChange}
                        disabled={isConverting}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>
                  
                  <p style={{ marginTop: '0.25rem', fontSize: '0.7rem', color: '#9ca3af' }}>Maks. 100MB per file</p>
                </div>
              </div>
            </div>

            <div className="card">
              <h3 className="card-title"><Settings size={18} /> Pengaturan Konversi</h3>
              
              <div className="settings-group" style={{ marginTop: '1.5rem' }}>
                <label>Kualitas <span className="help-icon"> <HelpCircle size={14} /></span> <span style={{color: 'var(--primary)'}}>{settings.quality}%</span></label>
                <div className="slider-container">
                  <input 
                    type="range" 
                    min="1" 
                    max="100" 
                    value={settings.quality} 
                    onChange={(e) => setSettings({...settings, quality: parseInt(e.target.value)})} 
                    disabled={isConverting}
                  />
                  <div className="slider-labels">
                    <span>Rendah</span>
                    <span>Seimbang</span>
                    <span>Tinggi</span>
                  </div>
                </div>
              </div>

              <div className="settings-group">
                <label>Loop <span className="help-icon"> <HelpCircle size={14} /></span></label>
                <select 
                  value={settings.loop} 
                  onChange={(e) => setSettings({...settings, loop: e.target.value})}
                  disabled={isConverting}
                >
                  <option value="0">Loop (Ulang terus)</option>
                  <option value="1">Satu Kali</option>
                </select>
              </div>

              <div className="settings-group">
                <label>Metode <span className="help-icon"> <HelpCircle size={14} /></span></label>
                <select 
                  value={settings.preset} 
                  onChange={(e) => setSettings({...settings, preset: e.target.value})}
                  disabled={isConverting}
                >
                  <option value="default">Default (Rekomendasi)</option>
                  <option value="picture">Picture</option>
                  <option value="drawing">Drawing</option>
                  <option value="icon">Icon</option>
                  <option value="text">Text</option>
                </select>
              </div>

              <div className="settings-group">
                <label className="checkbox-group">
                  <input 
                    type="checkbox" 
                    checked={settings.preserveTransparency} 
                    onChange={(e) => setSettings({...settings, preserveTransparency: e.target.checked})}
                    disabled={isConverting}
                  />
                  <span>Pertahankan transparansi</span>
                </label>
              </div>

              <div className="settings-group" style={{ marginTop: '0.75rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Timeout per file <span className="help-icon"><HelpCircle size={14} /></span></span>
                  <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{settings.conversionTimeout}s</span>
                </label>
                <input 
                  type="range" 
                  min="10" 
                  max="300" 
                  step="10"
                  value={settings.conversionTimeout} 
                  onChange={(e) => setSettings({...settings, conversionTimeout: parseInt(e.target.value)})} 
                  disabled={isConverting}
                />
                <div className="slider-labels">
                  <span>10s</span>
                  <span>2 menit</span>
                  <span>5 menit</span>
                </div>
              </div>

              <div className="settings-group" style={{ marginTop: '0.75rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Jeda antar file <span className="help-icon"><HelpCircle size={14} /></span></span>
                  <span style={{ color: 'var(--primary)', fontWeight: 700 }}>{settings.conversionInterval}ms</span>
                </label>
                <input 
                  type="range" 
                  min="0" 
                  max="2000" 
                  step="50"
                  value={settings.conversionInterval} 
                  onChange={(e) => setSettings({...settings, conversionInterval: parseInt(e.target.value)})} 
                  disabled={isConverting}
                />
                <div className="slider-labels">
                  <span>0ms</span>
                  <span>1 detik</span>
                  <span>2 detik</span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1.5rem' }}>
                {conversionState === 'idle' && (
                  <button 
                    className="btn-primary"
                    onClick={convertFiles}
                    disabled={!hasPendingFiles}
                    style={{ flex: 1 }}
                  >
                    <Play size={18} fill="currentColor" /> Konversi ke WEBP
                  </button>
                )}
                
                {conversionState === 'running' && (
                  <button 
                    className="btn-primary"
                    onClick={() => updateConversionState('paused')}
                    style={{ flex: 1, backgroundColor: '#f59e0b', color: '#fff' }}
                  >
                    <Pause size={18} fill="currentColor" /> Jeda
                  </button>
                )}

                {conversionState === 'paused' && (
                  <button 
                    className="btn-primary"
                    onClick={() => updateConversionState('running')}
                    style={{ flex: 1, backgroundColor: '#10b981', color: '#fff' }}
                  >
                    <Play size={18} fill="currentColor" /> Lanjutkan
                  </button>
                )}

                {conversionState !== 'idle' && (
                  <button 
                    className="btn-primary"
                    onClick={() => updateConversionState('idle')}
                    style={{ flex: 1, backgroundColor: '#ef4444', color: '#fff', border: 'none' }}
                  >
                    <Square size={18} fill="currentColor" /> Berhenti
                  </button>
                )}
              </div>
              <div style={{ textAlign: 'center', fontSize: '0.7rem', color: '#9ca3af', marginTop: '0.75rem' }}>
                <ShieldCheck size={14} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                File aman. Tidak disimpan di server.
              </div>
            </div>

            <div className="card">
              <h3 className="card-title"><Type size={18} /> Bulk Rename</h3>
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.5rem 0' }}>
                Terapkan pada {selectedIds.size > 0 ? `${selectedIds.size} file terpilih` : 'semua file'}.
              </p>
              
              <div className="settings-group" style={{ marginTop: '0.75rem' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Awalan (Prefix)</label>
                <input 
                  type="text" 
                  className="file-card-name-input" 
                  style={{ border: '1px solid #e2e8f0', padding: '0.4rem 0.5rem', width: '100%', marginBottom: '0.5rem', borderRadius: '6px' }}
                  placeholder="stiker_"
                  value={bulkRename.prefix}
                  onChange={(e) => setBulkRename({...bulkRename, prefix: e.target.value})}
                  disabled={isConverting}
                />
                
                <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Akhiran (Suffix)</label>
                <input 
                  type="text" 
                  className="file-card-name-input" 
                  style={{ border: '1px solid #e2e8f0', padding: '0.4rem 0.5rem', width: '100%', marginBottom: '1rem', borderRadius: '6px' }}
                  placeholder="_v2"
                  value={bulkRename.suffix}
                  onChange={(e) => setBulkRename({...bulkRename, suffix: e.target.value})}
                  disabled={isConverting}
                />

                <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '0.75rem', marginBottom: '0.5rem' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Cari teks</label>
                  <input 
                    type="text" 
                    className="file-card-name-input" 
                    style={{ border: '1px solid #e2e8f0', padding: '0.4rem 0.5rem', width: '100%', marginBottom: '0.5rem', borderRadius: '6px' }}
                    placeholder="CAACAgIA..."
                    value={bulkRename.search}
                    onChange={(e) => setBulkRename({...bulkRename, search: e.target.value})}
                    disabled={isConverting}
                  />
                  <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#374151', display: 'block', marginBottom: '0.25rem' }}>Ganti dengan</label>
                  <input 
                    type="text" 
                    className="file-card-name-input" 
                    style={{ border: '1px solid #e2e8f0', padding: '0.4rem 0.5rem', width: '100%', borderRadius: '6px' }}
                    placeholder="nama_baru"
                    value={bulkRename.replace}
                    onChange={(e) => setBulkRename({...bulkRename, replace: e.target.value})}
                    disabled={isConverting}
                  />
                </div>
              </div>

              <button 
                className="btn-outline" 
                onClick={applyBulkRename} 
                disabled={isConverting || files.length === 0 || (!bulkRename.prefix && !bulkRename.suffix && !bulkRename.search)}
                style={{ width: '100%', marginTop: '0.5rem', justifyContent: 'center' }}
              >
                Terapkan Rename
              </button>
            </div>
          </div>

          {/* Right Main Area: Grid */}
          <div className="right-content">
            <div className="content-header">
              <div>
                <h2>
                  File yang diimpor ({files.length})
                  {(successCount > 0 || failCount > 0) && (
                    <div className="stats-badges">
                      {successCount > 0 && <span className="stat-badge success">Selesai: {successCount}</span>}
                      {failCount > 0 && <span className="stat-badge error">Gagal: {failCount}</span>}
                    </div>
                  )}
                </h2>
                <p>Atur, preview, dan konversi file Anda ke WEBP.</p>
              </div>
              <div className="header-actions">
                {files.length > 0 && (
                  <label className="btn-outline">
                    <input 
                      type="checkbox" 
                      checked={files.length > 0 && selectedIds.size === files.length}
                      onChange={toggleSelectAll}
                      style={{ marginRight: '4px' }}
                    />
                    Pilih Semua
                  </label>
                )}
                {failCount > 0 && (
                  <button className="btn-outline error" onClick={retryFailed} disabled={isConverting}>
                    <RefreshCw size={14} /> Ulangi yang Gagal ({failCount})
                  </button>
                )}
                {successCount > 0 && (
                  <button className="btn-outline primary-outline" onClick={downloadSelectedZip} disabled={isZipping}>
                    {isZipping ? <Loader2 className="spinner" size={16} /> : <Archive size={16} />}
                    {selectedIds.size > 0 ? `Unduh Terpilih (${selectedSuccessCount})` : `Unduh Semua (${successCount})`}
                  </button>
                )}
                <label htmlFor="file-upload-header" className="btn-outline">
                  <Plus size={16} /> Tambah File
                  <input 
                    type="file" 
                    id="file-upload-header" 
                    accept="image/apng,video/webm" 
                    multiple
                    onChange={handleFileChange}
                    disabled={isConverting}
                    style={{ display: 'none' }}
                  />
                </label>
                {files.length > 0 && !isConverting && (
                  <button className="btn-outline danger" onClick={clearAll}>
                    <Trash2 size={16} /> Hapus semua
                  </button>
                )}
              </div>
            </div>

            {files.length > 0 ? (
              <div className="file-grid">
                {files.map(f => (
                  <FileCard 
                    key={f.id} 
                    f={f} 
                    isConverting={isConverting} 
                    removeFile={removeFile} 
                    onOpenFullscreen={(url, isVideo) => setFullscreenMedia({ url, isVideo: isVideo && f.status !== 'success' })}
                    onRename={handleRename}
                    isSelected={selectedIds.has(f.id)}
                    toggleSelect={toggleSelect}
                    onRetry={() => retrySingle(f.id)}
                  />
                ))}
                
                {/* Empty slot / Add More button */}
                <label htmlFor="file-upload-grid" className="add-more-card">
                  <div className="add-icon-circle">
                    <Plus size={24} color="var(--primary)" />
                  </div>
                  <span>Tambah file lainnya</span>
                  <small>atau drag & drop di sini</small>
                  <input 
                    type="file" 
                    webkitdirectory=""
                    directory=""
                    multiple
                    onChange={handleFileChange}
                    disabled={isConverting}
                  />
                </label>
              </div>
            ) : (
              <div style={{ padding: '4rem 2rem', textAlign: 'center', background: 'white', borderRadius: '12px', border: '1px dashed #c7d2fe' }}>
                <FileVideo size={48} color="#c7d2fe" style={{ marginBottom: '1rem' }} />
                <h3 style={{ color: '#4b5563', marginBottom: '0.5rem' }}>Belum ada file</h3>
                <p style={{ color: '#9ca3af', fontSize: '0.9rem' }}>Silakan unggah file dari sidebar kiri untuk memulai.</p>
              </div>
            )}

            {files.length > 0 && (
              <div className="info-box">
                <Info size={18} className="icon" />
                <div>
                  <strong>Tips:</strong> Semakin tinggi kualitas, semakin besar ukuran file WEBP. Gunakan kualitas seimbang untuk hasil optimal.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Fullscreen Modal */}
      {fullscreenMedia && (
        <div className="fullscreen-modal" onClick={() => setFullscreenMedia(null)}>
          <button className="close-btn" onClick={() => setFullscreenMedia(null)}>
            <X size={24} />
          </button>
          <div onClick={(e) => e.stopPropagation()} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {fullscreenMedia.isVideo ? (
              <video src={fullscreenMedia.url} autoPlay loop controls style={{ maxWidth: '100%', maxHeight: '100%' }} />
            ) : (
              <img src={fullscreenMedia.url} alt="Fullscreen preview" />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
