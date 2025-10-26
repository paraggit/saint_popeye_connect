import React, { useState, useEffect, useCallback } from 'react';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import { MenuIcon, AlertTriangleIcon, ClipboardIcon, CheckIcon, TerminalIcon, DockerIcon, DesktopIcon } from './components/icons';
import { OllamaService } from './services/ollamaService';
import type { OllamaModel, ChatMessage, OllamaModelInfo } from './types';

function useLocalStorage<T,>(key: string, initialValue: T): [T, (value: T) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.error(error);
      return initialValue;
    }
  });

  const setValue = (value: T) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
    }
  };

  return [storedValue, setValue];
}


const App: React.FC = () => {
  // Get default Ollama host from config or fallback to localhost
  const defaultOllamaHost = (window as any).APP_CONFIG?.ollamaHost || 'http://localhost:11434';
  const [ollamaHost, setOllamaHost] = useLocalStorage<string>('ollamaHost', defaultOllamaHost);
  const [models, setModels] = useState<OllamaModel[]>([]);
  const [selectedModel, setSelectedModel] = useLocalStorage<string>('selectedModel', '');
  const [selectedModelInfo, setSelectedModelInfo] = useState<OllamaModelInfo | null>(null);
  const [isModelInfoLoading, setIsModelInfoLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = useCallback(async () => {
    setError(null);
    try {
      const service = new OllamaService(ollamaHost);
      const data = await service.listModels();
      setModels(data.models);
      if (data.models.length > 0 && !data.models.some(m => m.name === selectedModel)) {
        setSelectedModel(data.models[0].name);
      } else if (data.models.length === 0) {
        setSelectedModel('');
      }
    } catch (err) {
      setError(`Failed to connect to Ollama at '${ollamaHost}'.`);
      console.error(err);
      setModels([]);
      setSelectedModel('');
    }
  }, [ollamaHost, selectedModel, setSelectedModel]);

  useEffect(() => {
    fetchModels();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ollamaHost]);
  
  useEffect(() => {
    if (!selectedModel) {
        setSelectedModelInfo(null);
        return;
    }

    const fetchModelInfo = async () => {
        setIsModelInfoLoading(true);
        try {
            const service = new OllamaService(ollamaHost);
            const info = await service.getModelInfo(selectedModel);
            setSelectedModelInfo(info);
        } catch (err) {
            console.error("Failed to fetch model info:", err);
            setSelectedModelInfo(null); // Clear info on error
        } finally {
            setIsModelInfoLoading(false);
        }
    };

    fetchModelInfo();
  }, [selectedModel, ollamaHost]);

  const handleSendMessage = useCallback(async (message: string, images?: string[]) => {
    if (!selectedModel) {
      const tempError = { role: 'assistant' as const, content: 'Error: Please select a model from the sidebar first.' };
      setMessages(prev => [...prev, tempError]);
      return;
    }
    
    const newUserMessage: ChatMessage = { role: 'user', content: message };
    if (images) {
      newUserMessage.images = images;
    }

    const newMessages: ChatMessage[] = [...messages, newUserMessage];
    setMessages(newMessages);
    setIsLoading(true);
    setError(null);

    try {
      const service = new OllamaService(ollamaHost);
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);

      await service.streamChat(selectedModel, newMessages, (chunk) => {
        setMessages(prev => {
          const lastMsgIndex = prev.length - 1;
          const updatedMessages = [...prev];
          updatedMessages[lastMsgIndex] = {
            ...updatedMessages[lastMsgIndex],
            content: updatedMessages[lastMsgIndex].content + chunk,
          };
          return updatedMessages;
        });
      });
    } catch (err) {
      console.error(err);
      let errorMessage = (err instanceof Error) ? err.message : 'An unknown error occurred';
      if (err instanceof TypeError && err.message.toLowerCase().includes('failed to fetch')) {
        errorMessage = `Could not connect to Ollama. Please verify the host is running and reachable, and that CORS is configured correctly.`;
      }
      
      setMessages(prev => {
        const lastMsg = prev[prev.length - 1];
        if (lastMsg?.role === 'assistant' && lastMsg.content === '') {
           const updated = [...prev];
           updated[prev.length - 1].content = `Error: ${errorMessage}`;
           return updated;
        }
        return [...prev, { role: 'assistant', content: `Error: ${errorMessage}` }];
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedModel, messages, ollamaHost]);

  const handleClearChat = () => {
    setMessages([]);
  };

  const ErrorDisplay = () => {
    type TabID = 'mac' | 'win' | 'linux' | 'docker';
    const [copied, setCopied] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabID>('linux');

    useEffect(() => {
      const platform = navigator.platform.toUpperCase();
      if (platform.indexOf('WIN') >= 0) {
        setActiveTab('win');
      } else if (platform.indexOf('MAC') >= 0) {
        setActiveTab('mac');
      } else {
        setActiveTab('linux');
      }
    }, []);

    const copyToClipboard = (text: string, id: string) => {
        navigator.clipboard.writeText(text).then(() => {
            setCopied(id);
            setTimeout(() => setCopied(null), 2000);
        });
    };

    const CodeBlock = ({ command, id, description }: { command: string; id: string, description?: string }) => (
      <div className="bg-gray-700/50 p-3 rounded-md my-2">
        {description && <p className="text-xs text-gray-400 mb-2">{description}</p>}
        <div className="flex items-center justify-between">
            <code className="text-white text-xs sm:text-sm select-all font-mono">{command}</code>
            <button onClick={() => copyToClipboard(command, id)} className="text-gray-400 hover:text-white flex-shrink-0 ml-4 p-1 rounded-md hover:bg-gray-600">
                {copied === id ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
            </button>
        </div>
      </div>
    );
    
    const MultiLineCodeBlock = ({ lines, id, description }: { lines: string[], id: string, description?: string }) => (
      <div className="bg-gray-700/50 p-3 rounded-md my-2">
        {description && <p className="text-xs text-gray-400 mb-2">{description}</p>}
        <div className="flex items-start justify-between">
            <pre><code className="text-white text-xs sm:text-sm select-all font-mono whitespace-pre-wrap">{lines.join('\n')}</code></pre>
            <button onClick={() => copyToClipboard(lines.join('\n'), id)} className="text-gray-400 hover:text-white flex-shrink-0 ml-4 p-1 rounded-md hover:bg-gray-600">
                {copied === id ? <CheckIcon className="w-5 h-5 text-green-400" /> : <ClipboardIcon className="w-5 h-5" />}
            </button>
        </div>
      </div>
    );

    const TabButton = ({ tabId, currentTab, setTab, children }: {tabId: TabID, currentTab: string, setTab: (tab: TabID) => void, children: React.ReactNode}) => (
        <button
            onClick={() => setTab(tabId)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors ${
                currentTab === tabId
                    ? 'border-cyan-500 text-white'
                    : 'border-transparent text-gray-400 hover:border-gray-500 hover:text-gray-300'
            }`}
        >
            {children}
        </button>
    )

    const SubSection: React.FC<{title: string; icon: React.ReactNode; children: React.ReactNode}> = ({title, icon, children}) => (
      <div className="mb-4">
        <h5 className="font-semibold text-gray-200 flex items-center gap-2 mb-2">
          {icon}
          {title}
        </h5>
        <div className="pl-6 border-l-2 border-gray-700">{children}</div>
      </div>
    );

    return (
      <div className="m-auto max-w-3xl w-full bg-gray-800 text-gray-300 p-4 sm:p-6 rounded-lg border border-yellow-600/50 shadow-lg">
        <div className="flex items-center mb-4">
          <AlertTriangleIcon className="h-10 w-10 mr-4 text-yellow-400 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-xl text-yellow-300">Connection to Ollama Failed</h3>
            <p className="text-sm text-gray-400">This is a common Cross-Origin (CORS) issue that needs to be fixed on your Ollama server.</p>
          </div>
        </div>
        
        <div className="space-y-6 text-sm">
            <div className="p-4 bg-gray-900/50 rounded-lg">
                <h4 className="font-semibold text-lg text-gray-200 mb-2 flex items-center">
                    <span className="bg-cyan-500 text-gray-900 rounded-full h-6 w-6 text-sm font-bold flex items-center justify-center mr-3">1</span>
                    Configure Ollama Server
                </h4>
                <p className="text-gray-400 mb-3 text-xs sm:text-sm">Choose your setup below and run the command to allow this web app to connect to Ollama.</p>
                
                <div className="border-b border-gray-700">
                    <nav className="-mb-px flex space-x-2" aria-label="Tabs">
                        <TabButton tabId="mac" currentTab={activeTab} setTab={setActiveTab}>macOS</TabButton>
                        <TabButton tabId="win" currentTab={activeTab} setTab={setActiveTab}>Windows</TabButton>
                        <TabButton tabId="linux" currentTab={activeTab} setTab={setActiveTab}>Linux</TabButton>
                        <TabButton tabId="docker" currentTab={activeTab} setTab={setActiveTab}>Docker</TabButton>
                    </nav>
                </div>

                <div className="pt-4">
                    {activeTab === 'mac' && (
                        <div>
                          <SubSection title="For the Ollama Desktop App" icon={<DesktopIcon className="w-4 h-4" />}>
                              <p className="text-gray-400 text-xs mb-2">1. Open the Terminal app and run this command:</p>
                              <CodeBlock command="launchctl setenv OLLAMA_ORIGINS '*'" id="mac_launchctl" />
                              <p className="text-gray-400 text-xs mt-3">2. Find the Ollama icon in your menu bar, click it, and select <span className="font-bold">"Quit Ollama"</span>.</p>
                              <p className="text-gray-400 text-xs mt-1">3. Re-open the Ollama app from your Applications folder.</p>
                          </SubSection>
                           <SubSection title="For Command-Line Users (ollama serve)" icon={<TerminalIcon className="w-4 h-4" />}>
                              <p className="text-gray-400 text-xs mb-2">Run this in your terminal <span className="font-bold">before</span> starting the Ollama server.</p>
                              <CodeBlock command="export OLLAMA_ORIGINS='*'" id="mac_export" description="This is temporary for the current terminal session."/>
                           </SubSection>
                        </div>
                    )}
                    {activeTab === 'win' && (
                        <div>
                          <SubSection title="For the Ollama Desktop App (Permanent)" icon={<DesktopIcon className="w-4 h-4" />}>
                              <p className="text-gray-400 text-xs mb-2">1. Open <span className="font-bold">Command Prompt</span> (not PowerShell) as Administrator and run:</p>
                              <CodeBlock command='setx OLLAMA_ORIGINS "*"' id="windows_setx" />
                              <p className="text-gray-400 text-xs mt-3">2. Close the terminal, then <span className="font-bold">restart your computer</span> to apply the change.</p>
                              <p className="text-gray-400 text-xs mt-1">3. Ensure the Ollama application is restarted.</p>
                          </SubSection>
                           <SubSection title="For Command-Line Users (Temporary)" icon={<TerminalIcon className="w-4 h-4" />}>
                              <CodeBlock command="$env:OLLAMA_ORIGINS = '*'" id="windows_ps" description="For PowerShell:"/>
                              <CodeBlock command='set OLLAMA_ORIGINS=*' id="windows_cmd" description="For Command Prompt:" />
                           </SubSection>
                        </div>
                    )}
                     {activeTab === 'linux' && (
                        <div>
                           <SubSection title="Temporary (current session)" icon={<TerminalIcon className="w-4 h-4" />}>
                              <p className="text-gray-400 text-xs mb-2">Run this in your terminal before `ollama serve`:</p>
                              <CodeBlock command="export OLLAMA_ORIGINS='*'" id="linux_export" />
                           </SubSection>
                           <SubSection title="Permanent (systemd)" icon={<DesktopIcon className="w-4 h-4" />}>
                              <p className="text-gray-400 text-xs mb-2">1. Edit the systemd service for Ollama:</p>
                              <CodeBlock command="sudo systemctl edit ollama.service" id="linux_systemctl_edit" />
                              <p className="text-gray-400 text-xs mt-3 mb-2">2. Add these lines in the editor, then save and close:</p>
                              <MultiLineCodeBlock lines={['[Service]', 'Environment="OLLAMA_ORIGINS=*"']} id="linux_systemd_conf" />
                              <p className="text-gray-400 text-xs mt-3 mb-2">3. Reload systemd and restart Ollama:</p>
                              <CodeBlock command="sudo systemctl daemon-reload && sudo systemctl restart ollama" id="linux_systemctl_restart" />
                           </SubSection>
                        </div>
                    )}
                    {activeTab === 'docker' && (
                        <div>
                           <SubSection title="For Docker Users" icon={<DockerIcon className="w-4 h-4" />}>
                            <p className="text-gray-400 mb-2 text-xs sm:text-sm">Add the environment variable flag <code className="bg-gray-700 px-1 py-0.5 rounded mx-1">-e OLLAMA_ORIGINS='*'</code> to your `docker run` command.</p>
                            <CodeBlock command="docker run -d --gpus=all -v ollama:/root/.ollama -p 11434:11434 -e OLLAMA_ORIGINS='*' --name ollama ollama/ollama" id="docker" description="Example Docker Run Command:" />
                           </SubSection>
                        </div>
                    )}
                </div>
                 <p className="text-xs text-gray-500 mt-4">
                  Using <code className="bg-gray-700 px-1 py-0.5 rounded">'*'</code> is for development. See the <a href="https://github.com/ollama/ollama/blob/main/docs/faq.md#how-can-i-allow-additional-origins-to-access-ollama" target="_blank" rel="noopener noreferrer" className="underline hover:text-white text-cyan-400">Ollama docs</a> for more secure options.
                </p>
            </div>

            <div className="p-4 bg-gray-900/50 rounded-lg border-2 border-yellow-500/50">
                <h4 className="font-semibold text-lg text-yellow-300 mb-2 flex items-center">
                  <span className="bg-yellow-500 text-gray-900 rounded-full h-6 w-6 text-sm font-bold flex items-center justify-center mr-3">2</span>
                  CRITICAL: Restart the Ollama Server
                </h4>
                <p className="text-yellow-200 font-bold text-sm sm:text-base">THIS IS THE MOST COMMON MISTAKE.</p>
                <p className="text-gray-400 text-xs sm:text-sm">The change will not take effect until you have completely quit and restarted your Ollama server. If you started Ollama from your terminal, you must restart it from the <span className="font-bold">same terminal window</span> where you set the variable.</p>
            </div>

            <div className="p-4 bg-gray-900/50 rounded-lg">
                <h4 className="font-semibold text-lg text-gray-200 mb-2 flex items-center">
                    <span className="bg-cyan-500 text-gray-900 rounded-full h-6 w-6 text-sm font-bold flex items-center justify-center mr-3">3</span>
                    Verify Host & Retry
                </h4>
                <p className="text-gray-400 mb-3 text-xs sm:text-sm">Make sure the Ollama Host in the sidebar is correct, then click retry.</p>
                <button
                    onClick={fetchModels}
                    className="w-full bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-gray-800"
                >
                    Retry Connection
                </button>
            </div>

            <details className="bg-gray-900/30 p-3 rounded-lg text-xs">
                <summary className="cursor-pointer font-semibold text-gray-400 hover:text-white">Still having trouble?</summary>
                <ul className="list-disc list-inside space-y-2 mt-3 text-gray-400 pl-2">
                    <li>Is the Ollama application actually installed and running on your computer?</li>
                    <li>Is there a firewall or other software that could be blocking the connection to port <code className="bg-gray-700 px-1 py-0.5 rounded">11434</code>?</li>
                    <li><span className="font-bold">[Advanced]</span> For temporary testing, you can use a browser extension that disables CORS protection, like "Allow CORS". <span className="text-yellow-500">Warning: This disables important security features. Only use it for local development and disable it right after.</span></li>
                </ul>
            </details>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen w-screen font-sans">
      <Sidebar
        ollamaHost={ollamaHost}
        setOllamaHost={setOllamaHost}
        models={models}
        selectedModel={selectedModel}
        setSelectedModel={setSelectedModel}
        refreshModels={fetchModels}
        isSidebarOpen={isSidebarOpen}
        selectedModelInfo={selectedModelInfo}
        isModelInfoLoading={isModelInfoLoading}
        onClearChat={handleClearChat}
      />
      <main className="flex-1 flex flex-col relative">
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="md:hidden absolute top-4 left-4 z-30 p-2 bg-gray-800 rounded-md"
        >
          <MenuIcon className="w-6 h-6" />
        </button>

        <div className="flex-1 flex flex-col overflow-hidden">
          {error ? (
              <div className="flex-1 overflow-y-auto p-4 flex items-center justify-center">
                  <ErrorDisplay />
              </div>
          ) : (
            <Chat
              messages={messages}
              onSendMessage={handleSendMessage}
              isLoading={isLoading}
            />
          )}
        </div>

      </main>
    </div>
  );
};

export default App;