import React, { useState, useEffect } from 'react';
import { FiX, FiMonitor, FiSpeaker, FiMic, FiSettings, FiBell, FiCamera } from 'react-icons/fi';
import ModalCloseButton from '@/components/ui/ModalCloseButton';
import { useEscapeToClose } from '@/hooks/useEscapeToClose';
import { useEscapeCapture } from '@/hooks/useEscapeCapture';

interface ChatSettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    prefs: { typing: boolean; sound: boolean };
    onSave: (prefs: { typing: boolean; sound: boolean }) => void;
}

export default function ChatSettingsModal({ isOpen, onClose, prefs, onSave }: ChatSettingsModalProps) {
    const [activeTab, setActiveTab] = useState<'interface' | 'audio'>('interface');
    const [localPrefs, setLocalPrefs] = useState(prefs);
    const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([]);
    const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([]);
    const [selectedAudioDevice, setSelectedAudioDevice] = useState('');
    const [selectedVideoDevice, setSelectedVideoDevice] = useState('');

    useEscapeToClose(isOpen, onClose);
    useEscapeCapture(isOpen, onClose);

    useEffect(() => {
        setLocalPrefs(prefs);
    }, [prefs]);

    useEffect(() => {
        if (isOpen && activeTab === 'audio') {
            loadDevices();
        }
    }, [isOpen, activeTab]);

    const loadDevices = async () => {
        try {
            // Request permission first to get device labels
            await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(stream => {
                stream.getTracks().forEach(t => t.stop());
            }).catch(() => { });

            const devices = await navigator.mediaDevices.enumerateDevices();
            setAudioDevices(devices.filter(d => d.kind === 'audioinput'));
            setVideoDevices(devices.filter(d => d.kind === 'videoinput'));
        } catch (err) {
            console.error('Error loading devices:', err);
        }
    };

    if (!isOpen) return null;

    const handleSave = () => {
        // Save device preferences to localStorage
        if (selectedAudioDevice) localStorage.setItem('preferredAudioDevice', selectedAudioDevice);
        if (selectedVideoDevice) localStorage.setItem('preferredVideoDevice', selectedVideoDevice);

        onSave(localPrefs);
        onClose();
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm max-md:p-4"
            onClick={onClose}
        >
            <div
                data-modal-panel=""
                className="relative bg-zinc-900 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col h-[550px] max-md:h-auto max-md:max-h-[100dvh] border border-white/10 animate-in fade-in zoom-in duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between bg-zinc-900/80">
                    <div className="flex items-center gap-3 max-md:min-w-0">
                        <div className="w-9 h-9 rounded-lg bg-violet-500/10 flex items-center justify-center max-md:shrink-0">
                            <FiSettings className="w-5 h-5 text-violet-400" />
                        </div>
                        <h3 className="font-semibold text-lg text-white max-md:truncate">Configurações do Chat</h3>
                    </div>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-white/5 rounded-lg transition-colors text-zinc-400 hover:text-white max-md:hidden">
                        <FiX className="w-5 h-5" />
                    </button>
                    <ModalCloseButton onClick={onClose} mobileOnly mountOnlyWhenMobile className="text-zinc-400 hover:text-white hover:bg-white/5" />
                </div>

                {/* Sidebar + Content Layout */}
                <div className="flex flex-1 overflow-hidden max-md:flex-col">
                    {/* Sidebar */}
                    <div className="w-44 max-md:w-full max-md:flex max-md:flex-row max-md:space-y-0 max-md:gap-2 bg-zinc-950/50 border-r max-md:border-r-0 max-md:border-b border-white/5 p-3 space-y-1">
                        <button
                            onClick={() => setActiveTab('interface')}
                            className={`w-full max-md:min-h-11 text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2.5 transition-all ${activeTab === 'interface' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                        >
                            <FiMonitor className="w-4 h-4" />
                            Interface
                        </button>
                        <button
                            onClick={() => setActiveTab('audio')}
                            className={`w-full max-md:min-h-11 text-left px-3 py-2.5 rounded-lg text-sm font-medium flex items-center gap-2.5 transition-all ${activeTab === 'audio' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' : 'text-zinc-400 hover:bg-white/5 hover:text-zinc-200'}`}
                        >
                            <FiSpeaker className="w-4 h-4" />
                            Áudio e Vídeo
                        </button>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar">
                        {activeTab === 'interface' && (
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-medium text-zinc-200 mb-4 flex items-center gap-2">
                                        <span className="w-1 h-4 bg-violet-500 rounded-full"></span>
                                        Geral
                                    </h4>
                                    <div className="space-y-3">
                                        <label className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-lg border border-white/5 cursor-pointer hover:border-white/10 transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                                                    <FiMonitor className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-medium text-zinc-200 block">Indicador de Digitação</span>
                                                    <span className="text-xs text-zinc-500">Mostrar quando outros estão digitando</span>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={localPrefs.typing}
                                                    onChange={e => setLocalPrefs(prev => ({ ...prev, typing: e.target.checked }))}
                                                />
                                                <div className="w-11 h-6 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-500"></div>
                                            </div>
                                        </label>

                                        <label className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-lg border border-white/5 cursor-pointer hover:border-white/10 transition-colors group">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                                                    <FiBell className="w-4 h-4" />
                                                </div>
                                                <div>
                                                    <span className="text-sm font-medium text-zinc-200 block">Sons de Notificação</span>
                                                    <span className="text-xs text-zinc-500">Reproduzir som ao receber mensagens</span>
                                                </div>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={localPrefs.sound}
                                                    onChange={e => setLocalPrefs(prev => ({ ...prev, sound: e.target.checked }))}
                                                />
                                                <div className="w-11 h-6 bg-zinc-800 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-violet-500"></div>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'audio' && (
                            <div className="space-y-6">
                                <div>
                                    <h4 className="font-medium text-zinc-200 mb-4 flex items-center gap-2">
                                        <span className="w-1 h-4 bg-violet-500 rounded-full"></span>
                                        Dispositivos de Entrada
                                    </h4>
                                    <div className="space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide flex items-center gap-2">
                                                <FiMic className="w-3.5 h-3.5" /> Microfone
                                            </label>
                                            <select
                                                value={selectedAudioDevice}
                                                onChange={e => setSelectedAudioDevice(e.target.value)}
                                                className="w-full bg-zinc-950/50 border border-white/5 rounded-lg px-4 py-2.5 text-zinc-200 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
                                            >
                                                <option value="">Padrão do Sistema</option>
                                                {audioDevices.map(device => (
                                                    <option key={device.deviceId} value={device.deviceId}>
                                                        {device.label || `Microfone ${device.deviceId.slice(0, 8)}`}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="space-y-2">
                                            <label className="text-xs font-medium text-zinc-400 uppercase tracking-wide flex items-center gap-2">
                                                <FiCamera className="w-3.5 h-3.5" /> Câmera
                                            </label>
                                            <select
                                                value={selectedVideoDevice}
                                                onChange={e => setSelectedVideoDevice(e.target.value)}
                                                className="w-full bg-zinc-950/50 border border-white/5 rounded-lg px-4 py-2.5 text-zinc-200 focus:outline-none focus:border-violet-500/50 focus:ring-1 focus:ring-violet-500/50 transition-all"
                                            >
                                                <option value="">Padrão do Sistema</option>
                                                {videoDevices.map(device => (
                                                    <option key={device.deviceId} value={device.deviceId}>
                                                        {device.label || `Câmera ${device.deviceId.slice(0, 8)}`}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-violet-500/5 border border-violet-500/10 rounded-lg p-4">
                                    <h5 className="text-sm font-medium text-violet-400 flex items-center gap-2 mb-2">
                                        <FiBell className="w-4 h-4" />
                                        Dica
                                    </h5>
                                    <p className="text-xs text-zinc-400 leading-relaxed">
                                        Durante uma chamada, você pode clicar nos ícones de microfone e câmera para ativar ou desativar seus dispositivos instantaneamente.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-white/5 bg-zinc-950/50 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 max-md:min-h-11 rounded-lg bg-white/5 hover:bg-white/10 text-zinc-300 font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 max-md:min-h-11 bg-violet-600 hover:bg-violet-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-violet-500/10"
                    >
                        Salvar Alterações
                    </button>
                </div>
            </div>
        </div>
    );
}
