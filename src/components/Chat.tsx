import React, { useState, useRef, useEffect } from 'react';
import type { ChatMessage } from '../types';
import { SendIcon, BotIcon, UserIcon, PaperclipIcon, XIcon, ClipboardIcon, CheckIcon } from './icons';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// FIX: Corrected the import name from atomOneDark to atomDark.
import { atomDark } from 'react-syntax-highlighter/dist/esm/styles/prism';


interface ChatProps {
  messages: ChatMessage[];
  onSendMessage: (message: string, images?: string[]) => void;
  isLoading: boolean;
}

const CodeBlock = ({ language, code }: { language: string, code: string }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        if (copied) return;
        navigator.clipboard.writeText(code).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }).catch(err => {
            console.error('Failed to copy code: ', err);
        });
    };

    return (
        <div className="my-2 bg-gray-900 rounded-md overflow-hidden border border-gray-700">
            <div className="flex justify-between items-center px-4 py-1 bg-gray-800 text-xs text-gray-400">
                <span>{language}</span>
                <button onClick={handleCopy} className="flex items-center gap-1.5 p-1 rounded-md hover:bg-gray-700">
                    {copied ? <CheckIcon className="w-4 h-4 text-green-400" /> : <ClipboardIcon className="w-4 h-4" />}
                    <span className="text-xs">{copied ? 'Copied!' : 'Copy code'}</span>
                </button>
            </div>
            <SyntaxHighlighter
                language={language}
                // FIX: Used the corrected style name 'atomDark'.
                style={atomDark}
                customStyle={{ margin: 0, padding: '1rem', backgroundColor: '#1E1E1E' }}
                codeTagProps={{ style: { fontSize: '0.875rem' } }}
            >
                {code}
            </SyntaxHighlighter>
        </div>
    );
};


const Message: React.FC<{ message: ChatMessage }> = ({ message }) => {
  const isUser = message.role === 'user';
  
  const renderContent = () => {
    if (isUser) {
        return <p className="whitespace-pre-wrap">{message.content}</p>;
    }
    
    const parts = message.content.split(/(```[\s\S]*?```)/g);
    
    return (
      <div>
        {parts.map((part, index) => {
          const codeBlockMatch = part.match(/^```(\w*)\n([\s\S]*?)```$/);
          if (codeBlockMatch) {
            const language = codeBlockMatch[1] || 'text';
            const code = codeBlockMatch[2].trim();
            return <CodeBlock key={index} language={language} code={code} />;
          }
          if (part.trim()) {
            return <p key={index} className="whitespace-pre-wrap">{part}</p>;
          }
          return null;
        })}
      </div>
    );
  };
  
  return (
    <div className={`flex items-start gap-4 my-4 ${isUser ? 'justify-end' : ''}`}>
      {!isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
          <BotIcon className="w-5 h-5 text-cyan-500" />
        </div>
      )}
      <div className={`max-w-xl p-3 md:p-4 rounded-lg shadow ${isUser ? 'bg-cyan-600 text-white' : 'bg-gray-700'}`}>
        {message.images && message.images.length > 0 && (
            <div className="mb-2 grid gap-2 grid-cols-2">
                {message.images.map((imgData, index) => (
                    <img key={index} src={`data:image/jpeg;base64,${imgData}`} alt={isUser ? "User upload" : "Generated image"} className="rounded-lg max-w-full max-h-64 object-contain" />
                ))}
            </div>
        )}
        {renderContent()}
      </div>
       {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-600 flex items-center justify-center">
          <UserIcon className="w-5 h-5" />
        </div>
      )}
    </div>
  );
};

const Chat: React.FC<ChatProps> = ({ messages, onSendMessage, isLoading }) => {
  const [input, setInput] = useState('');
  const [image, setImage] = useState<string | null>(null); // base64 string
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);
  
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result?.toString().split(',')[1];
        if (base64String) {
          setImage(base64String);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if ((input.trim() || image) && !isLoading) {
      onSendMessage(input.trim(), image ? [image] : undefined);
      setInput('');
      setImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  return (
    <div className="flex flex-col flex-1 bg-gray-900 overflow-hidden">
      <div className="flex-1 overflow-y-auto p-6">
        {messages.length === 0 && !isLoading && (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <BotIcon className="w-16 h-16 mb-4"/>
                <h1 className="text-2xl font-semibold">SaintPopeye Connect</h1>
                <p>Select a model and start chatting.</p>
            </div>
        )}
        {messages.map((msg, index) => (
          <Message key={index} message={msg} />
        ))}
        {isLoading && messages[messages.length - 1]?.role === 'user' && (
          <div className="flex items-start gap-4 my-4">
             <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center">
                <BotIcon className="w-5 h-5 text-cyan-500" />
            </div>
            <div className="max-w-xl p-4 rounded-lg shadow bg-gray-700">
              <div className="flex items-center space-x-2">
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse"></div>
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse [animation-delay:0.2s]"></div>
                <div className="w-2 h-2 bg-cyan-500 rounded-full animate-pulse [animation-delay:0.4s]"></div>
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-700">
        {image && (
            <div className="p-2 relative w-24">
                <img src={`data:image/jpeg;base64,${image}`} alt="Preview" className="rounded-md w-full h-auto" />
                <button
                    onClick={() => {
                        setImage(null)
                        if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-0 right-0 -mt-2 -mr-2 bg-gray-700 rounded-full p-1 text-white hover:bg-red-500"
                    aria-label="Remove image"
                >
                    <XIcon className="w-4 h-4" />
                </button>
            </div>
        )}
        <form onSubmit={handleSubmit} className="flex items-center space-x-2">
           <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading || !!image}
              className="p-3 text-gray-400 hover:text-white rounded-full hover:bg-gray-700 disabled:text-gray-600 disabled:cursor-not-allowed"
              aria-label="Attach image"
            >
              <PaperclipIcon className="w-6 h-6" />
            </button>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={image ? "Describe the image..." : "Type your message..."}
            className="flex-1 bg-gray-700 border border-gray-600 rounded-lg p-3 focus:ring-cyan-500 focus:border-cyan-500"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || (!input.trim() && !image)}
            className="bg-cyan-600 text-white p-3 rounded-full hover:bg-cyan-500 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
          >
            <SendIcon className="w-6 h-6" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default Chat;
