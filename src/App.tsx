import React, { useState, useEffect, useRef } from 'react';
import { Play, Usb, Terminal, ExternalLink, AlertCircle, Square, Blocks, Code, Settings, X, Upload, Save, FolderOpen } from 'lucide-react';
import { motion } from 'motion/react';
import Editor from 'react-simple-code-editor';
import Prism from 'prismjs';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism.css';
import BlocklyEditor, { BlocklyEditorRef } from './components/BlocklyEditor';
// @ts-ignore
import logoStaarr from './LogoStaarr.png';

interface MotorConfig {
  id: number;
  port: string;
  isTraction: boolean;
  isInverted: boolean;
}

interface SensorConfig {
  id: number;
  port: string;
  type: string;
}

const highlightWithBlockly = (code: string) => {
  const html = Prism.highlight(code, Prism.languages.python, 'python');
  
  const startToken = '<span class="token comment"># === START_BLOCKLY_CODE ===</span>';
  const endToken = '<span class="token comment"># === END_BLOCKLY_CODE ===</span>';
  
  let startIndex = html.indexOf(startToken);
  let startLen = startToken.length;
  
  if (startIndex === -1) {
      startIndex = html.indexOf('# === START_BLOCKLY_CODE ===');
      startLen = '# === START_BLOCKLY_CODE ==='.length;
  }
  
  let endIndex = html.indexOf(endToken);
  if (endIndex === -1) {
      endIndex = html.indexOf('# === END_BLOCKLY_CODE ===');
  }
  
  if (startIndex !== -1 && endIndex !== -1 && startIndex < endIndex) {
    const before = html.substring(0, startIndex + startLen);
    const middle = html.substring(startIndex + startLen, endIndex);
    const after = html.substring(endIndex);
    return before + '<span style="background-color: rgba(253, 224, 71, 0.3); display: block; margin: 0 -16px; padding: 0 16px;">' + middle + '</span>' + after;
  }
  
  return html;
};

export default function App() {
  const [port, setPort] = useState<any>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [logs, setLogs] = useState<string>('');
  const [customCode, setCustomCode] = useState<string>('from hub import light_matrix\nlight_matrix.write("CIAO")');
  const [blocklyCode, setBlocklyCode] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'blocks' | 'python'>('blocks');
  const [isExecuting, setIsExecuting] = useState(false);
  const [isSerialSupported, setIsSerialSupported] = useState(true);
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [showTerminal, setShowTerminal] = useState(false);
  
  const [motors, setMotors] = useState<MotorConfig[]>(() => {
    const saved = localStorage.getItem('spike_motors');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Errore nel parsing dei motori salvati:", e);
      }
    }
    return [
      { id: 1, port: '', isTraction: false, isInverted: false },
      { id: 2, port: '', isTraction: false, isInverted: false },
      { id: 3, port: '', isTraction: false, isInverted: false },
      { id: 4, port: '', isTraction: false, isInverted: false },
    ];
  });

  const [sensors, setSensors] = useState<SensorConfig[]>(() => {
    const saved = localStorage.getItem('spike_sensors');
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error("Errore nel parsing dei sensori salvati:", e);
      }
    }
    return [
      { id: 1, port: '', type: '' },
      { id: 2, port: '', type: '' },
      { id: 3, port: '', type: '' },
      { id: 4, port: '', type: '' },
    ];
  });

  const [wheelDiameter, setWheelDiameter] = useState<number>(() => {
    const saved = localStorage.getItem('spike_wheel_diameter');
    return saved ? parseFloat(saved) : 5.6;
  });

  const [wheelDistance, setWheelDistance] = useState<number>(() => {
    const saved = localStorage.getItem('spike_wheel_distance');
    return saved ? parseFloat(saved) : 11.5;
  });

  const [maxMotorSpeed, setMaxMotorSpeed] = useState<number>(() => {
    const saved = localStorage.getItem('spike_max_motor_speed');
    return saved ? parseInt(saved) : 100;
  });

  const handleMaxMotorSpeedChange = (val: number) => {
    setMaxMotorSpeed(val);
    localStorage.setItem('spike_max_motor_speed', val.toString());
  };

  const handleWheelDiameterChange = (val: number) => {
    setWheelDiameter(val);
    localStorage.setItem('spike_wheel_diameter', val.toString());
  };

  const handleWheelDistanceChange = (val: number) => {
    setWheelDistance(val);
    localStorage.setItem('spike_wheel_distance', val.toString());
  };

  const handleMotorChange = (id: number, field: keyof MotorConfig, value: any) => {
    setMotors(prev => {
      const updated = prev.map(m => m.id === id ? { ...m, [field]: value } : m);
      localStorage.setItem('spike_motors', JSON.stringify(updated));
      return updated;
    });
  };

  const handleSensorChange = (id: number, field: keyof SensorConfig, value: any) => {
    setSensors(prev => {
      const updated = prev.map(s => s.id === id ? { ...s, [field]: value } : s);
      localStorage.setItem('spike_sensors', JSON.stringify(updated));
      return updated;
    });
  };

  const blocklyEditorRef = useRef<BlocklyEditorRef>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fileBlockInputRef = useRef<HTMLInputElement>(null);

  const handleSaveProgram = () => {
    let workspaceData = null;
    if (blocklyEditorRef.current) {
      workspaceData = blocklyEditorRef.current.saveWorkspace();
    }
    
    const fileData = {
      type: 'spike-program',
      version: 1,
      motors,
      sensors,
      wheelDiameter,
      wheelDistance,
      maxMotorSpeed,
      workspace: workspaceData,
      pythonCode: customCode
    };
    
    const blob = new Blob([JSON.stringify(fileData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'programma_spike.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadProgramClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        
        if (data.type !== 'spike-program') {
          alert("Il file selezionato non è un programma Spike valido.");
          return;
        }
        
        setActiveTab('blocks');
        
        setTimeout(() => {
          if (data.workspace && blocklyEditorRef.current) {
            blocklyEditorRef.current.loadWorkspace(data.workspace);
          }
        }, 100);
        
        if (data.motors) {
          setMotors(data.motors);
          localStorage.setItem('spike_motors', JSON.stringify(data.motors));
        }
        if (data.sensors) {
          setSensors(data.sensors);
          localStorage.setItem('spike_sensors', JSON.stringify(data.sensors));
        }
        if (data.wheelDiameter !== undefined) {
          setWheelDiameter(data.wheelDiameter);
          localStorage.setItem('spike_wheel_diameter', data.wheelDiameter.toString());
        }
        if (data.wheelDistance !== undefined) {
          setWheelDistance(data.wheelDistance);
          localStorage.setItem('spike_wheel_distance', data.wheelDistance.toString());
        }
        if (data.maxMotorSpeed !== undefined) {
          setMaxMotorSpeed(data.maxMotorSpeed);
          localStorage.setItem('spike_max_motor_speed', data.maxMotorSpeed.toString());
        }
        if (data.pythonCode !== undefined) {
          setCustomCode(data.pythonCode);
        }
        
        alert("Programma caricato con successo!");
      } catch (err) {
        console.error("Errore nel caricamento del file:", err);
        alert("Errore nel caricamento del file. Assicurati che sia un file JSON valido.");
      }
      
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const handleSaveBlock = () => {
    if (!blocklyEditorRef.current) return;
    const blockData = blocklyEditorRef.current.saveSelectedBlock();
    if (!blockData) {
      alert("Nessun blocco selezionato. Clicca su un blocco per selezionarlo e riprova.");
      return;
    }
    
    const fileData = {
      type: 'spike-block',
      version: 1,
      blockData
    };
    
    const blob = new Blob([JSON.stringify(fileData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'blocco_spike.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleLoadBlockClick = () => {
    if (fileBlockInputRef.current) {
      fileBlockInputRef.current.click();
    }
  };

  const handleBlockFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const data = JSON.parse(content);
        
        if (data.type !== 'spike-block') {
          alert("Il file selezionato non è un blocco Spike valido.");
          return;
        }
        
        setActiveTab('blocks');
        
        setTimeout(() => {
          if (data.blockData && blocklyEditorRef.current) {
            blocklyEditorRef.current.appendBlock(data.blockData);
          }
        }, 100);
        
      } catch (err) {
        console.error("Errore nel caricamento del file:", err);
        alert("Errore nel caricamento del file. Assicurati che sia un file JSON valido.");
      }
      
      if (fileBlockInputRef.current) {
        fileBlockInputRef.current.value = '';
      }
    };
    reader.readAsText(file);
  };

  const terminalRef = useRef<HTMLDivElement>(null);
  const readerRef = useRef<any>(null);
  const keepReadingRef = useRef<boolean>(false);
  const readLoopPromiseRef = useRef<Promise<void> | null>(null);

  useEffect(() => {
    if (!('serial' in navigator)) {
      setIsSerialSupported(false);
    }
  }, []);

  useEffect(() => {
    if (!port) return;
    
    keepReadingRef.current = true;

    async function readLoop() {
      while (port && port.readable && keepReadingRef.current) {
        try {
          const reader = port.readable.getReader();
          readerRef.current = reader;
          try {
            while (keepReadingRef.current) {
              const { value, done } = await reader.read();
              if (done) {
                break;
              }
              if (value) {
                const text = new TextDecoder().decode(value);
                setLogs(prev => {
                  const newLogs = prev + text;
                  // Keep only last 5000 characters to prevent memory issues
                  return newLogs.length > 5000 ? newLogs.slice(-5000) : newLogs;
                });
              }
            }
          } catch (error: any) {
            if (keepReadingRef.current) {
              console.error("Errore di lettura:", error);
              if (error.message && error.message.includes("The device has been lost")) {
                setLogs(prev => prev + "\n[Disconnesso: Il dispositivo è stato rimosso]\n");
                keepReadingRef.current = false;
                setIsConnected(false);
                setPort(null);
                break;
              }
            }
          } finally {
            readerRef.current = null;
            try {
              reader.releaseLock();
            } catch (e) {
              // Ignore release errors
            }
          }
        } catch (err) {
          if (keepReadingRef.current) {
            console.error("Errore nell'ottenere il reader:", err);
          }
          break;
        }
      }
    }

    readLoopPromiseRef.current = readLoop();

    return () => {
      keepReadingRef.current = false;
      if (readerRef.current) {
        readerRef.current.cancel().catch(() => {});
      }
    };
  }, [port]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  const connect = async () => {
    try {
      const p = await (navigator as any).serial.requestPort();
      await p.open({ baudRate: 115200 });
      setPort(p);
      setIsConnected(true);
      setLogs(prev => prev + "Connesso a LEGO Spike Prime.\n");
      // Svuota lo schermo del robot alla connessione
      try {
        const writer = p.writable.getWriter();
        const encoder = new TextEncoder();
        // Invia Ctrl+C per sicurezza e poi il comando clear
        await writer.write(encoder.encode('\x03\r\nfrom hub import light_matrix\r\nlight_matrix.clear()\r\n'));
        writer.releaseLock();
      } catch (e) {
        console.error("Errore nel reset iniziale dello schermo:", e);
      }
    } catch (err: any) {
      console.error(err);
      setLogs(prev => prev + `Errore di connessione: ${err.message}\n`);
    }
  };

  const disconnect = async () => {
    if (port) {
      try {
        // 1. Interrompi il ciclo impostando keepReadingRef su false
        keepReadingRef.current = false;

        // 2. Cancella il reader attivo per sbloccare la porta
        if (readerRef.current) {
          try {
            await readerRef.current.cancel();
          } catch (e) {
            console.error("Errore nella cancellazione del reader:", e);
          }
        }

        // 3. Attendi che il ciclo di lettura termini in sicurezza e rilasci i lock
        if (readLoopPromiseRef.current) {
          try {
            await readLoopPromiseRef.current;
          } catch (e) {
            console.error("Errore nell'attesa della chiusura del ciclo di lettura:", e);
          }
        }

        // 4. Chiudi la porta seriale
        await port.close();
        setPort(null);
        setIsConnected(false);
        setLogs(prev => prev + "Disconnesso.\n");
      } catch (err: any) {
        console.error(err);
        setLogs(prev => prev + `Errore durante la disconnessione: ${err.message}\n`);
      }
    }
  };

  const executeCode = async (code: string, waitForButton: boolean = false) => {
    if (!port || !port.writable) {
      setLogs(prev => prev + "Errore: Porta seriale non disponibile.\n");
      return;
    }

    if (isExecuting) {
      setLogs(prev => prev + "Invio in corso, attendi...\n");
      return;
    }

    if (port.writable.locked) {
      setLogs(prev => prev + "Porta seriale bloccata. Prova a ricollegare.\n");
      return;
    }

    setIsExecuting(true);
    let writer = null;

    let finalCode = code;
    if (waitForButton) {
      setLogs(prev => prev + "\n[Attesa avvio: Premi il tasto CENTRALE (o Sinistro/Destro) sul robot per avviare il codice. In seguito, premi il tasto Centrale per interrompere!]\n");
      finalCode = finalCode.replace('_WAIT_FIRST_TIME = False', '_WAIT_FIRST_TIME = True');
    }

    try {
      writer = port.writable.getWriter();
      const encoder = new TextEncoder();
      
      // Stop current running program (Ctrl+C)
      await writer.write(encoder.encode('\x03'));
      await new Promise(r => setTimeout(r, 100));
      
      // Enter Paste Mode (Ctrl+E)
      await writer.write(encoder.encode('\x05'));
      await new Promise(r => setTimeout(r, 100));
      
      // Write the code
      await writer.write(encoder.encode(finalCode + '\r\n'));
      await new Promise(r => setTimeout(r, 100));
      
      // Execute (Ctrl+D)
      await writer.write(encoder.encode('\x04'));
    } catch (err: any) {
      console.error(err);
      setLogs(prev => prev + `Errore di esecuzione: ${err.message}\n`);
    } finally {
      if (writer) {
        try {
          writer.releaseLock();
        } catch (e) {}
      }
      setIsExecuting(false);
    }
  };

  const stopExecution = async () => {
    if (!port || !port.writable) return;
    
    // Non blocchiamo se isExecuting è true, perché stopExecution è il tasto di emergenza.
    // Tuttavia, se port.writable.locked è true, getWriter fallirà.
    if (port.writable.locked) {
        setLogs(prev => prev + "Impossibile interrompere: porta seriale bloccata.\n");
        return;
    }

    let writer = null;
    try {
      writer = port.writable.getWriter();
      const encoder = new TextEncoder();
      
      // Send multiple Ctrl+C to ensure we break out of loops
      await writer.write(encoder.encode('\x03\x03\r\n'));
      
      // Wait for REPL to become responsive
      await new Promise(r => setTimeout(r, 300));
      
      // Attempt to stop all motors
      const stopCode = `
try:
    import motor_pair
    motor_pair.stop(motor_pair.PAIR_1)
except: pass
try:
    import motor, port
    for p in [port.A, port.B, port.C, port.D, port.E, port.F]:
        try: motor.stop(p)
        except: pass
except: pass
`;
      // Enter Paste Mode
      await writer.write(encoder.encode('\x05'));
      await new Promise(r => setTimeout(r, 100));
      
      // Write the code
      await writer.write(encoder.encode(stopCode + '\r\n'));
      await new Promise(r => setTimeout(r, 100));
      
      // Execute
      await writer.write(encoder.encode('\x04'));

      setLogs(prev => prev + "Esecuzione interrotta. Motori fermati.\n");
    } catch (err: any) {
      console.error(err);
    } finally {
        if (writer) {
            try {
                writer.releaseLock();
            } catch (e) {}
        }
        setIsExecuting(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 text-neutral-900 font-sans selection:bg-yellow-300 selection:text-neutral-900">
      {/* Header */}
      <header className="bg-neutral-200 border-b border-neutral-300 sticky top-0 z-10">
        <div className="w-full px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-md flex items-center justify-center shadow-sm overflow-hidden bg-white border-2 border-black">
              <img src={logoStaarr} alt="Logo Staarr" className="w-full h-full object-contain" />
            </div>
            <h1 className="font-semibold tracking-tight text-3xl">Lego Spike a Blocchi <span className="text-xl">(e Pyton)</span></h1>
          </div>
          <div className="flex items-center gap-4">
            <button
              onClick={() => setShowTerminal(!showTerminal)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors border-2 ${showTerminal ? 'bg-neutral-300 text-neutral-900 border-black shadow-inner' : 'bg-neutral-200 hover:bg-neutral-300 text-neutral-900 border-black shadow-sm'}`}
              title="Monitor Seriale"
            >
              <Terminal className="w-4 h-4" />
              Monitor seriale
            </button>
            <button 
              onClick={() => setIsSetupOpen(true)} 
              className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 transition-colors"
              title="Setup Robot"
            >
              <Settings className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsSaveModalOpen(true)}
              className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition-colors"
              title="Salva"
            >
              <Save className="w-5 h-5" />
            </button>
            <button 
              onClick={() => setIsLoadModalOpen(true)}
              className="p-1.5 rounded-md hover:bg-neutral-100 text-neutral-500 hover:text-neutral-800 transition-colors"
              title="Carica"
            >
              <FolderOpen className="w-5 h-5" />
            </button>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              className="hidden" 
              accept=".json" 
            />
            <input 
              type="file" 
              ref={fileBlockInputRef} 
              onChange={handleBlockFileChange} 
              className="hidden" 
              accept=".json" 
            />
            <div className="w-px h-6 bg-neutral-200 mx-1"></div>
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {isConnected && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isConnected ? 'bg-emerald-500' : 'bg-neutral-300'}`}></span>
              </span>
              <span className="text-xs font-medium text-neutral-500 uppercase tracking-wider">
                {isConnected ? 'Online' : 'Offline'}
              </span>
            </div>
            {!isConnected ? (
              <button
                onClick={connect}
                disabled={!isSerialSupported}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors border-2 bg-neutral-200 hover:bg-neutral-300 text-black border-black shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Usb className="w-4 h-4" />
                Connetti
              </button>
            ) : (
              <button
                onClick={disconnect}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-bold transition-colors border-2 bg-neutral-200 hover:bg-neutral-300 text-black border-black shadow-sm"
              >
                Disconnetti
              </button>
            )}
          </div>
        </div>
      </header>

      <main className="w-full h-[calc(100vh-4rem)] p-2 flex flex-col gap-2">
        {!isSerialSupported && (
          <div className="bg-orange-50 border border-orange-200 text-orange-800 rounded-xl p-4 flex gap-3 text-sm max-w-6xl mx-auto w-full">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-medium mb-1">Web Serial non supportata</p>
              <p>Il tuo browser non supporta la connessione seriale, oppure l'app è in un iframe restrittivo. Prova ad aprirla in una nuova scheda usando Chrome o Edge.</p>
              <a href={window.location.href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-2 font-medium text-orange-900 hover:underline">
                Apri in nuova scheda <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        )}

        <div className={`grid grid-cols-1 ${showTerminal ? 'lg:grid-cols-12' : 'lg:grid-cols-1'} gap-2 flex-1 min-h-0`}>
          
          {/* Left Column: Terminal */}
          {showTerminal && (
            <div className="lg:col-span-4 flex flex-col h-full min-h-0">
              <section className="bg-neutral-900 rounded-xl shadow-xl flex flex-col h-full overflow-hidden border border-neutral-800">
                <div className="bg-neutral-950 px-4 py-3 border-b border-neutral-800 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Terminal className="w-4 h-4 text-neutral-400" />
                    <span className="text-sm font-medium text-neutral-300">Terminale Seriale</span>
                  </div>
                  <button 
                    onClick={() => setLogs('')}
                    className="text-xs text-neutral-500 hover:text-neutral-300 font-medium transition-colors"
                  >
                    Pulisci
                  </button>
                </div>
                <div 
                  ref={terminalRef}
                  className="flex-1 p-4 overflow-y-auto font-mono text-xs sm:text-sm text-neutral-300 whitespace-pre-wrap break-all"
                >
                  {logs || <span className="text-neutral-600 italic">In attesa di connessione...</span>}
                </div>
              </section>
            </div>
          )}

          {/* Right Column: Editor (Blockly / Python) */}
          <div className={`${showTerminal ? 'lg:col-span-8' : 'lg:col-span-1'} flex flex-col h-full min-h-0`}>
            <section className="bg-white border border-neutral-200 rounded-xl shadow-sm flex flex-col h-full overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-neutral-50">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('blocks')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border-2 ${activeTab === 'blocks' ? 'bg-neutral-200 shadow-sm border-black text-neutral-900' : 'bg-neutral-200 border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300'}`}
                >
                  <Blocks className="w-4 h-4" />
                  Blocchi
                </button>
                <button
                  onClick={() => setActiveTab('python')}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors border-2 ${activeTab === 'python' ? 'bg-neutral-200 shadow-sm border-black text-neutral-900' : 'bg-neutral-200 border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-300'}`}
                >
                  <Code className="w-4 h-4" />
                  Python
                </button>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => executeCode(activeTab === 'blocks' ? blocklyCode : customCode, true)}
                  disabled={!isConnected || isExecuting}
                  className="flex items-center gap-2 bg-neutral-200 hover:bg-neutral-300 text-neutral-900 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  title="Carica il codice e attendi. Premi il tasto CENTRALE (o Sinistra/Destra) per avviare, e premi in seguito il tasto Centrale per interrompere."
                >
                  <Upload className="w-4 h-4" />
                  Carica Codice
                </button>
                <button
                  onClick={() => executeCode(activeTab === 'blocks' ? blocklyCode : customCode, false)}
                  disabled={!isConnected || isExecuting}
                  className="flex items-center gap-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-900 px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Esegui codice
                </button>
                <button
                  onClick={stopExecution}
                  disabled={!isConnected}
                  className="flex items-center gap-2 bg-red-500 hover:bg-red-600 text-white px-4 py-1.5 rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                  title="Interrompi l'esecuzione"
                >
                  <Square className="w-4 h-4 fill-current" />
                  Stop
                </button>
              </div>
            </div>
            
            <div className="flex-1 relative bg-neutral-50 overflow-hidden">
              <div className={`absolute inset-0 w-full h-full ${activeTab === 'blocks' ? 'block' : 'pointer-events-none opacity-0 invisible h-0 overflow-hidden'}`}>
                <BlocklyEditor 
                  ref={blocklyEditorRef}
                  motors={motors}
                  wheelDiameter={wheelDiameter}
                  wheelDistance={wheelDistance}
                  maxMotorSpeed={maxMotorSpeed}
                  isVisible={activeTab === 'blocks'}
                  onCodeChange={(code) => {
                    setBlocklyCode(code);
                    setCustomCode(code);
                  }} 
                />
              </div>
              <div className={`absolute inset-0 w-full h-full ${activeTab === 'python' ? 'block' : 'pointer-events-none opacity-0 invisible h-0 overflow-hidden'} bg-white overflow-y-auto`}>
                <Editor
                  value={customCode}
                  onValueChange={(code) => setCustomCode(code)}
                  highlight={(code) => highlightWithBlockly(code)}
                  padding={16}
                  style={{
                    fontFamily: 'monospace',
                    fontSize: 14,
                    minHeight: '100%',
                  }}
                  textareaClassName="focus:outline-none"
                  className="w-full font-mono text-sm"
                />
              </div>
            </div>
          </section>
        </div>
        </div>
      </main>

      {/* Setup Modal */}
      {isSetupOpen && (
        <div className="fixed inset-0 bg-neutral-900/50 z-[9999] flex items-center justify-center p-4">
          <div className="bg-neutral-200 rounded-2xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col relative z-[10000]">
            <div className="flex items-center justify-between p-4 border-b border-neutral-300 bg-neutral-200">
              <h2 className="font-semibold text-lg text-neutral-800">Setup Robot</h2>
              <button onClick={() => setIsSetupOpen(false)} className="p-1 hover:bg-neutral-300 rounded-md text-neutral-500 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto bg-neutral-200">
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-8">
                {/* Motori */}
                <div>
                  <h3 className="font-bold text-neutral-800 mb-4 flex items-center gap-2">Motori</h3>
                  <div className="space-y-4">
                    {motors.map(motor => (
                      <div key={`motor-${motor.id}`} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-neutral-700">Motore {motor.id}</span>
                          <select 
                            value={motor.port}
                            onChange={(e) => handleMotorChange(motor.id, 'port', e.target.value)}
                            className="text-sm border border-neutral-200 rounded-md p-1 bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400"
                          >
                            <option value="">Porta...</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                            <option value="E">E</option>
                            <option value="F">F</option>
                          </select>
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <label className="flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={motor.isTraction}
                              onChange={(e) => handleMotorChange(motor.id, 'isTraction', e.target.checked)}
                              className="rounded border-neutral-300 text-yellow-500 focus:ring-yellow-500" 
                            />
                            Trazione
                          </label>
                          <label className="flex items-center gap-2 text-sm text-neutral-600 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={motor.isInverted}
                              onChange={(e) => handleMotorChange(motor.id, 'isInverted', e.target.checked)}
                              className="rounded border-neutral-300 text-yellow-500 focus:ring-yellow-500" 
                            />
                            Inverti
                          </label>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sensori */}
                <div>
                  <h3 className="font-bold text-neutral-800 mb-4 flex items-center gap-2">Sensori</h3>
                  <div className="space-y-4">
                    {sensors.map(sensor => (
                      <div key={`sensor-${sensor.id}`} className="p-3 bg-neutral-50 rounded-xl border border-neutral-200 space-y-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-bold text-neutral-700">Sensore {sensor.id}</span>
                          <select 
                            value={sensor.port}
                            onChange={(e) => handleSensorChange(sensor.id, 'port', e.target.value)}
                            className="text-sm border border-neutral-200 rounded-md p-1 bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400"
                          >
                            <option value="">Porta...</option>
                            <option value="A">A</option>
                            <option value="B">B</option>
                            <option value="C">C</option>
                            <option value="D">D</option>
                            <option value="E">E</option>
                            <option value="F">F</option>
                          </select>
                        </div>
                        <select 
                          value={sensor.type}
                          onChange={(e) => handleSensorChange(sensor.id, 'type', e.target.value)}
                          className="w-full text-sm border border-neutral-200 rounded-md p-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400"
                        >
                          <option value="">Tipo sensore...</option>
                          <option value="color">Colore</option>
                          <option value="distance">Distanza (Ultrasuoni)</option>
                          <option value="force">Forza</option>
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dimensioni Robot */}
                <div>
                  <h3 className="font-bold text-neutral-800 mb-4 flex items-center gap-2">Dimensioni Robot</h3>
                  <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-neutral-700">
                        Diametro ruota (cm)
                      </label>
                      <div className="relative rounded-md shadow-sm">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={wheelDiameter}
                          onChange={(e) => handleWheelDiameterChange(parseFloat(e.target.value) || 0)}
                          className="w-full text-sm border border-neutral-200 rounded-md p-2 bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400 pr-12"
                          placeholder="es. 5.6"
                        />
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                          <span className="text-neutral-500 text-xs font-mono">cm</span>
                        </div>
                      </div>
                      <p className="text-xs text-neutral-500">Usato per calcolare la distanza percorsa.</p>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-neutral-200">
                      <label className="block text-sm font-bold text-neutral-700">
                        Distanza tra le ruote (cm)
                      </label>
                      <div className="relative rounded-md shadow-sm">
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={wheelDistance}
                          onChange={(e) => handleWheelDistanceChange(parseFloat(e.target.value) || 0)}
                          className="w-full text-sm border border-neutral-200 rounded-md p-2 bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400 pr-12"
                          placeholder="es. 11.5"
                        />
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                          <span className="text-neutral-500 text-xs font-mono">cm</span>
                        </div>
                      </div>
                      <p className="text-xs text-neutral-500">Usata per calcolare i gradi di sterzata nelle curve.</p>
                    </div>
                  </div>
                </div>

                {/* Velocità massima motori */}
                <div>
                  <h3 className="font-bold text-neutral-800 mb-4 flex items-center gap-2">Velocità massima motori</h3>
                  <div className="p-4 bg-neutral-50 rounded-xl border border-neutral-200 space-y-6">
                    <div className="space-y-2">
                      <label className="block text-sm font-bold text-neutral-700">
                        Valore massimo (0-1000)
                      </label>
                      <div className="relative rounded-md shadow-sm">
                        <input
                          type="number"
                          min="0"
                          max="1000"
                          value={maxMotorSpeed}
                          onChange={(e) => handleMaxMotorSpeedChange(parseInt(e.target.value) || 0)}
                          className="w-full text-sm border border-neutral-200 rounded-md p-2 bg-white focus:outline-none focus:ring-1 focus:ring-yellow-400"
                          placeholder="es. 100"
                        />
                      </div>
                      <input 
                        type="range"
                        min="0"
                        max="1000"
                        value={maxMotorSpeed}
                        onChange={(e) => handleMaxMotorSpeedChange(parseInt(e.target.value))}
                        className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-yellow-400"
                      />
                      <p className="text-xs text-neutral-500">Valore di riferimento per la velocità dei motori (default LEGO: 100).</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-neutral-200 bg-neutral-50 flex justify-end">
              <button 
                onClick={() => setIsSetupOpen(false)} 
                className="px-4 py-2 bg-yellow-400 hover:bg-yellow-500 text-neutral-900 rounded-lg font-medium transition-colors text-sm"
              >
                Salva e Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Salva */}
      {isSaveModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsSaveModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-neutral-800">Cosa vuoi salvare?</h2>
              <button 
                onClick={() => setIsSaveModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-3">
              <button 
                onClick={() => {
                  handleSaveProgram();
                  setIsSaveModalOpen(false);
                }}
                className="w-full flex items-center gap-3 p-4 border border-neutral-200 rounded-xl hover:bg-yellow-50 hover:border-yellow-400 transition-colors text-left"
              >
                <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600">
                  <Save className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-neutral-800">Salva Intero Programma</div>
                  <div className="text-xs text-neutral-500">Salva tutti i blocchi, il codice Python e la configurazione del robot.</div>
                </div>
              </button>
              <button 
                onClick={() => {
                  handleSaveBlock();
                  setIsSaveModalOpen(false);
                }}
                className="w-full flex items-center gap-3 p-4 border border-neutral-200 rounded-xl hover:bg-yellow-50 hover:border-yellow-400 transition-colors text-left"
              >
                <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600">
                  <Blocks className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-neutral-800">Salva Blocco Selezionato</div>
                  <div className="text-xs text-neutral-500">Salva solo il blocco o gruppo di blocchi attualmente selezionato.</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modale Carica */}
      {isLoadModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsLoadModalOpen(false)}>
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-neutral-100 flex justify-between items-center bg-white">
              <h2 className="text-lg font-bold text-neutral-800">Cosa vuoi caricare?</h2>
              <button 
                onClick={() => setIsLoadModalOpen(false)}
                className="p-1.5 rounded-full hover:bg-neutral-100 text-neutral-500 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 flex flex-col gap-3">
              <button 
                onClick={() => {
                  handleLoadProgramClick();
                  setIsLoadModalOpen(false);
                }}
                className="w-full flex items-center gap-3 p-4 border border-neutral-200 rounded-xl hover:bg-yellow-50 hover:border-yellow-400 transition-colors text-left"
              >
                <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600">
                  <FolderOpen className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-neutral-800">Carica Programma</div>
                  <div className="text-xs text-neutral-500">Sostituisce il progetto attuale con uno salvato precedentemente.</div>
                </div>
              </button>
              <button 
                onClick={() => {
                  handleLoadBlockClick();
                  setIsLoadModalOpen(false);
                }}
                className="w-full flex items-center gap-3 p-4 border border-neutral-200 rounded-xl hover:bg-yellow-50 hover:border-yellow-400 transition-colors text-left"
              >
                <div className="bg-yellow-100 p-2 rounded-lg text-yellow-600">
                  <Blocks className="w-5 h-5" />
                </div>
                <div>
                  <div className="font-bold text-neutral-800">Carica Blocco</div>
                  <div className="text-xs text-neutral-500">Aggiunge un blocco salvato al progetto attuale.</div>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
