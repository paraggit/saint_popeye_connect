import React, { useState, useCallback, useRef, useEffect } from 'react';
import type { OllamaModel, OllamaPullStatus, OllamaModelInfo } from '../types';
import { OllamaService } from '../services/ollamaService';
import { SpinnerIcon, MoreVerticalIcon } from './icons';

interface SidebarProps {
  ollamaHost: string;
  setOllamaHost: (host: string) => void;
  models: OllamaModel[];
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  refreshModels: () => void;
  isSidebarOpen: boolean;
  selectedModelInfo: OllamaModelInfo | null;
  isModelInfoLoading: boolean;
  onClearChat: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  ollamaHost,
  setOllamaHost,
  models,
  selectedModel,
  setSelectedModel,
  refreshModels,
  isSidebarOpen,
  selectedModelInfo,
  isModelInfoLoading,
  onClearChat,
}) => {
  const [modelToPull, setModelToPull] = useState('');
  const [isPulling, setIsPulling] = useState(false);
  const [pullStatus, setPullStatus] = useState<OllamaPullStatus | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const handlePullModel = useCallback(async () => {
    if (!modelToPull.trim()) return;
    setIsPulling(true);
    setPullStatus({ status: `Initializing pull for ${modelToPull}...` });
    try {
      const service = new OllamaService(ollamaHost);
      await service.pullModel(modelToPull, (status) => {
        setPullStatus(status);
      });
      setModelToPull('');
      refreshModels();
    } catch (error) {
      console.error('Failed to pull model:', error);
      setPullStatus({ status: `Error pulling model: ${(error as Error).message}`, error: (error as Error).message });
    } finally {
      setIsPulling(false);
      // Keep status message for a while
      setTimeout(() => setPullStatus(null), 5000);
    }
  }, [modelToPull, ollamaHost, refreshModels]);
  
  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  }

  const PullProgress: React.FC<{ status: OllamaPullStatus }> = ({ status }) => {
    const percentage = status.total && status.completed ? (status.completed / status.total) * 100 : 0;
    return (
      <div className="mt-2 text-xs text-gray-400">
        <p>{status.status}</p>
        {status.total && status.completed && (
          <div className="w-full bg-gray-600 rounded-full h-2.5 mt-1">
            <div className="bg-cyan-600 h-2.5 rounded-full" style={{ width: `${percentage}%` }}></div>
          </div>
        )}
      </div>
    );
  };

  return (
    <aside className={`absolute md:relative z-20 h-full w-64 bg-gray-800 text-white p-4 transform transition-transform duration-300 ease-in-out ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 flex flex-col`}>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">SaintPopeye Connect</h2>
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="p-1 rounded-full hover:bg-gray-700"
            aria-label="Options menu"
          >
            <MoreVerticalIcon className="w-5 h-5" />
          </button>
          {isMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-gray-700 rounded-md shadow-lg z-10 py-1 border border-gray-600">
              <button
                onClick={() => {
                  onClearChat();
                  setIsMenuOpen(false);
                }}
                className="block w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-600 hover:text-white"
              >
                Clear Chat History
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="mb-4">
        <label htmlFor="ollama-host" className="block text-sm font-medium text-gray-400 mb-1">
          Ollama Host
        </label>
        <input
          id="ollama-host"
          type="text"
          value={ollamaHost}
          onChange={(e) => setOllamaHost(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-cyan-500 focus:border-cyan-500"
          placeholder="http://localhost:11434"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="model-select" className="block text-sm font-medium text-gray-400 mb-1">
          Select Model
        </label>
        <select
          id="model-select"
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-cyan-500 focus:border-cyan-500"
          disabled={models.length === 0}
        >
          {models.length > 0 ? (
            models.map((model) => (
              <option key={model.name} value={model.name}>
                {model.name.replace(':latest', '')} ({formatBytes(model.size)})
              </option>
            ))
          ) : (
            <option>No models found</option>
          )}
        </select>
        <button
          onClick={refreshModels}
          className="w-full mt-2 bg-gray-700 hover:bg-gray-600 text-white font-bold py-2 px-4 rounded-md text-sm"
        >
          Refresh Models
        </button>
      </div>

      <div className="mb-4 border-t border-gray-700 pt-4 text-sm">
        <h3 className="font-medium text-gray-400 mb-2">Model Details</h3>
          {isModelInfoLoading ? (
            <div className="flex items-center justify-center text-gray-500 text-xs py-4">
                <SpinnerIcon className="w-4 h-4 mr-2 animate-spin" />
                <span>Loading details...</span>
            </div>
          ) : selectedModelInfo ? (
            <div className="space-y-2 text-xs text-gray-400">
                <div className="flex justify-between">
                    <span className="font-semibold text-gray-300">Family:</span>
                    <span className="truncate ml-2">{selectedModelInfo.details.family}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-semibold text-gray-300">Parameters:</span>
                    <span>{selectedModelInfo.details.parameter_size}</span>
                </div>
                <div className="flex justify-between">
                    <span className="font-semibold text-gray-300">Quantization:</span>
                    <span>{selectedModelInfo.details.quantization_level}</span>
                </div>
            </div>
          ) : selectedModel ? (
            <div className="text-xs text-gray-500">Could not load model details.</div>
          ) : (
            <div className="text-xs text-gray-500">Select a model to see details.</div>
          )}
      </div>

      <div className="flex-grow"></div>

      <div>
        <label htmlFor="pull-model" className="block text-sm font-medium text-gray-400 mb-1">
          Pull Model
        </label>
        <div className="flex space-x-2">
          <input
            id="pull-model"
            type="text"
            value={modelToPull}
            onChange={(e) => setModelToPull(e.target.value)}
            className="flex-grow bg-gray-700 border border-gray-600 rounded-md p-2 text-sm focus:ring-cyan-500 focus:border-cyan-500"
            placeholder="e.g., llama3"
            disabled={isPulling}
          />
          <button
            onClick={handlePullModel}
            disabled={isPulling || !modelToPull.trim()}
            className="bg-cyan-600 hover:bg-cyan-500 text-white font-bold py-2 px-4 rounded-md disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            {isPulling ? '...' : 'Pull'}
          </button>
        </div>
        {pullStatus && <PullProgress status={pullStatus} />}
      </div>
    </aside>
  );
};

export default Sidebar;