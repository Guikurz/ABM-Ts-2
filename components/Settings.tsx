import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, AppSettings } from '../types';
import { supabase } from '../services/supabaseClient';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';

interface SettingsProps {
  userProfile: UserProfile | null;
  appSettings?: AppSettings;
  onProfileUpdate: () => void;
  onAppSettingsUpdate?: () => void;
}

const Settings: React.FC<SettingsProps> = ({ userProfile, appSettings, onProfileUpdate, onAppSettingsUpdate }) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'customization'>('profile');
  const [loading, setLoading] = useState(false);
  
  // Profile Form Data
  const [formData, setFormData] = useState<Partial<UserProfile>>({
    full_name: '',
    email: '',
    role: '',
    company: '',
  });

  // App Settings Form Data
  const [appFormData, setAppFormData] = useState({
      app_name: 'Hard Sales',
      logo_url: ''
  });
  
  // Crop & Upload States
  const [uploading, setUploading] = useState(false);
  const [isCropping, setIsCropping] = useState(false);
  const [croppingTarget, setCroppingTarget] = useState<'avatar' | 'logo'>('avatar'); 
  const [imageFile, setImageFile] = useState<string | null>(null); // Base64 preview
  const [rawFile, setRawFile] = useState<File | null>(null); // Original file
  
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  useEffect(() => {
    if (userProfile) {
      setFormData({
        full_name: userProfile.full_name || '',
        email: userProfile.email || '',
        role: userProfile.role || '',
        company: userProfile.company || '',
      });
    }
  }, [userProfile]);

  // Sync state with props, but use specific fields to avoid unnecessary resets
  useEffect(() => {
      if (appSettings) {
          setAppFormData(prev => ({
              ...prev,
              app_name: appSettings.app_name || 'Hard Sales',
              logo_url: appSettings.logo_url || ''
          }));
      }
  }, [appSettings?.app_name, appSettings?.logo_url]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleAppChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setAppFormData(prev => ({
          ...prev,
          [e.target.name]: e.target.value
      }));
  };

  const handleRemoveLogo = (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      // Remover logo imediatamente sem confirmação para melhor UX na pré-visualização
      setAppFormData(prev => ({ ...prev, logo_url: '' }));
  };

  const handleSaveProfile = async () => {
    if (!userProfile) return;
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: {
            full_name: formData.full_name,
            role: formData.role,
            company: formData.company,
        }
      });
      if (authError) throw authError;

      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userProfile.id,
          full_name: formData.full_name,
          role: formData.role,
          company: formData.company,
          updated_at: new Date(),
        });

      if (profileError) throw profileError;

      alert('Perfil atualizado com sucesso!');
      onProfileUpdate();
    } catch (error: any) {
      console.error("Profile update error:", error);
      alert(`Erro ao atualizar perfil: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAppSettings = async () => {
      if (!userProfile) return;
      setLoading(true);
      try {
          const { error } = await supabase.from('app_settings').upsert({
              user_id: userProfile.id, 
              app_name: appFormData.app_name,
              logo_url: appFormData.logo_url || null, 
              updated_at: new Date()
          }, { onConflict: 'user_id' });

          if (error) throw error;

          alert('Personalização salva com sucesso!');
          if (onAppSettingsUpdate) onAppSettingsUpdate();

      } catch (error: any) {
          console.error("App settings error", error);
          alert(`Erro ao salvar configurações: ${error.message}`);
      } finally {
          setLoading(false);
      }
  };

  const readFile = (file: File) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result), false);
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>, target: 'avatar' | 'logo') => {
    if (event.target.files && event.target.files.length > 0) {
      const file = event.target.files[0];
      setRawFile(file); // Save raw file for "Skip Crop"
      const imageDataUrl = await readFile(file);
      setImageFile(imageDataUrl as string);
      setCroppingTarget(target);
      setIsCropping(true);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    }
    event.target.value = '';
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  // Common upload function
  const performUpload = async (fileToUpload: Blob | File) => {
      if (!userProfile) return;

      const timestamp = Date.now();
      // Default to png if blob, else use file type
      const contentType = fileToUpload instanceof File ? fileToUpload.type : 'image/png'; 
      const ext = contentType.split('/')[1] || 'png';

      if (croppingTarget === 'avatar') {
            const fileName = `${userProfile.id}/${timestamp}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(fileName, fileToUpload, { contentType, upsert: true });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('avatars').getPublicUrl(fileName);
            
            await supabase.from('profiles').upsert({ 
                id: userProfile.id,
                avatar_url: data.publicUrl,
                updated_at: new Date()
            });
            
            await supabase.auth.updateUser({ data: { avatar_url: data.publicUrl } });
            onProfileUpdate();

      } else {
            // Logo Upload
            const fileName = `logos/${userProfile.id}-${timestamp}.${ext}`;
            const { error: uploadError } = await supabase.storage
                .from('app-assets')
                .upload(fileName, fileToUpload, { contentType, upsert: true });
            
            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('app-assets').getPublicUrl(fileName);
            setAppFormData(prev => ({ ...prev, logo_url: data.publicUrl }));
      }
  };

  // Upload Cropped
  const handleCropSave = async () => {
    try {
        setUploading(true);
        if (!imageFile || !croppedAreaPixels) return;
        const croppedBlob = await getCroppedImg(imageFile, croppedAreaPixels);
        if (!croppedBlob) throw new Error('Falha ao recortar imagem');
        
        await performUpload(croppedBlob);
        
        setIsCropping(false);
        setImageFile(null);
        setRawFile(null);
    } catch (e: any) {
        console.error("Save image error:", e);
        alert("Erro ao salvar imagem: " + (e.message || e.error_description || e));
    } finally {
        setUploading(false);
    }
  };

  // Upload Original (Skip Crop)
  const handleUseOriginal = async () => {
      try {
          setUploading(true);
          if (!rawFile) return;
          
          await performUpload(rawFile);

          setIsCropping(false);
          setImageFile(null);
          setRawFile(null);
      } catch (e: any) {
          console.error("Upload original error:", e);
          alert("Erro ao salvar imagem original: " + (e.message || e.error_description || e));
      } finally {
          setUploading(false);
      }
  };

  if (!userProfile) {
      return <div className="p-6">Carregando perfil...</div>;
  }

  const getInitials = (name?: string) => {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className="p-4 lg:p-6 w-full flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Configurações</h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Gerencie seu perfil e personalização da conta.</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-6 border-b border-slate-200 dark:border-slate-800">
          <button 
            onClick={() => setActiveTab('profile')}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'profile' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
              <span className="material-symbols-outlined text-[18px]">person</span>
              Meu Perfil
          </button>
          <button 
            onClick={() => setActiveTab('customization')}
            className={`pb-3 text-sm font-bold border-b-2 transition-colors flex items-center gap-2 ${
                activeTab === 'customization' 
                ? 'border-primary text-primary' 
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
              <span className="material-symbols-outlined text-[18px]">brush</span>
              Personalização
          </button>
      </div>

      <div className="bg-white dark:bg-[#151b2b] rounded border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden max-w-3xl">
        
        {activeTab === 'profile' ? (
            <div className="p-6 space-y-6">
                <div className="flex items-center gap-4">
                    {userProfile.avatar_url ? (
                        <div 
                            className="size-20 rounded-full bg-slate-200 bg-cover bg-center border-2 border-white dark:border-slate-800 shadow-sm" 
                            style={{ backgroundImage: `url("${userProfile.avatar_url}")` }}
                        ></div>
                    ) : (
                        <div className="size-20 rounded-full bg-primary flex items-center justify-center text-white text-2xl font-bold border-2 border-white dark:border-slate-800 shadow-sm">
                            {getInitials(userProfile.full_name || userProfile.email)}
                        </div>
                    )}
                    <div>
                        <label className="cursor-pointer px-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-xs font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors inline-block text-center min-w-[100px]">
                            {uploading ? 'Processando...' : 'Alterar Foto'}
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                onChange={(e) => handleFileSelect(e, 'avatar')}
                                disabled={uploading}
                            />
                        </label>
                        <p className="text-[10px] text-slate-400 mt-1">Recomendado: 400x400px</p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Nome Completo</span>
                        <input 
                            name="full_name"
                            className="w-full h-10 px-3 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white" 
                            type="text" 
                            value={formData.full_name}
                            onChange={handleChange}
                            placeholder="Seu nome"
                        />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Email</span>
                        <input 
                            name="email"
                            className="w-full h-10 px-3 rounded border border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 text-sm text-slate-500 dark:text-slate-400 cursor-not-allowed" 
                            type="email" 
                            value={formData.email}
                            disabled
                            title="O email não pode ser alterado."
                        />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Cargo</span>
                        <input 
                            name="role"
                            className="w-full h-10 px-3 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white" 
                            type="text" 
                            value={formData.role}
                            onChange={handleChange}
                            placeholder="Ex: SDR Manager"
                        />
                    </label>
                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">Empresa (Perfil Pessoal)</span>
                        <input 
                            name="company"
                            className="w-full h-10 px-3 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white" 
                            type="text" 
                            value={formData.company}
                            onChange={handleChange}
                            placeholder="Nome da sua empresa"
                        />
                    </label>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button 
                        onClick={handleSaveProfile}
                        disabled={loading}
                        className="px-5 py-2.5 bg-primary text-white text-sm font-bold rounded shadow-sm hover:bg-blue-700 transition-colors disabled:opacity-70 flex items-center gap-2"
                    >
                        {loading && <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>}
                        Salvar Alterações
                    </button>
                </div>
            </div>
        ) : (
            <div className="p-6 space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
                
                <div className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Logo da Empresa</span>
                    <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 bg-slate-50 dark:bg-slate-800/50 p-6 rounded-lg border border-slate-100 dark:border-slate-700/50">
                        {/* Larger Logo Container */}
                        <div className="size-40 sm:size-48 bg-white dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg flex items-center justify-center overflow-hidden shadow-sm shrink-0 relative group">
                            {appFormData.logo_url ? (
                                <>
                                    <img src={appFormData.logo_url} alt="Logo" className="w-full h-full object-contain p-4" />
                                    {/* Overlay para remover quando tem logo */}
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer" onClick={handleRemoveLogo}>
                                        <button 
                                            type="button"
                                            className="bg-red-500 text-white p-2 rounded-full shadow-lg hover:bg-red-600 transition-colors z-20"
                                            title="Remover Logo"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">delete</span>
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div className="flex flex-col items-center text-slate-400 gap-2">
                                    <span className="material-symbols-outlined text-[48px] opacity-30">image</span>
                                    <span className="text-xs font-medium">Sem Logo</span>
                                </div>
                            )}
                        </div>
                        <div className="flex flex-col gap-3 items-center sm:items-start">
                            <div className="flex gap-2">
                                <label className="cursor-pointer px-5 py-2.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors inline-flex items-center gap-2 shadow-sm">
                                    <span className="material-symbols-outlined text-[20px]">upload</span>
                                    {uploading && croppingTarget === 'logo' ? 'Carregando...' : 'Carregar Nova Logo'}
                                    <input
                                        type="file"
                                        className="hidden"
                                        accept="image/*"
                                        onChange={(e) => handleFileSelect(e, 'logo')}
                                        disabled={uploading}
                                    />
                                </label>
                                
                                {appFormData.logo_url && (
                                    <button 
                                        type="button"
                                        onClick={handleRemoveLogo}
                                        className="px-4 py-2.5 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 rounded text-sm font-bold hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors z-10"
                                    >
                                        Remover
                                    </button>
                                )}
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs text-center sm:text-left leading-relaxed">
                                Recomendado: Imagem PNG com fundo transparente. Tamanho ideal: 500x500px ou retangular de alta resolução.
                            </p>
                        </div>
                    </div>
                </div>

                <label className="flex flex-col gap-2">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Nome da Aplicação</span>
                    <input 
                        name="app_name"
                        className="w-full h-11 px-4 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm text-slate-900 dark:text-white focus:ring-1 focus:ring-primary focus:border-primary shadow-sm transition-all" 
                        type="text" 
                        value={appFormData.app_name}
                        onChange={handleAppChange}
                        placeholder="Ex: Minha Empresa CRM"
                    />
                    <p className="text-xs text-slate-500 dark:text-slate-400">Este nome aparecerá no cabeçalho, no menu e na aba do navegador.</p>
                </label>

                <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end">
                    <button 
                        onClick={handleSaveAppSettings}
                        disabled={loading}
                        className="px-6 py-3 bg-primary text-white text-sm font-bold rounded shadow-lg shadow-primary/30 hover:bg-blue-700 transition-colors disabled:opacity-70 flex items-center gap-2"
                    >
                        {loading && <span className="material-symbols-outlined text-[18px] animate-spin">sync</span>}
                        Salvar Personalização
                    </button>
                </div>
            </div>
        )}
      </div>

       {/* Cropper Modal */}
       {isCropping && imageFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-in fade-in zoom-in duration-200">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                      <h3 className="font-bold text-slate-900 dark:text-white">Ajustar {croppingTarget === 'avatar' ? 'Foto' : 'Logo'}</h3>
                      <button onClick={() => setIsCropping(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"><span className="material-symbols-outlined">close</span></button>
                  </div>
                  
                  <div className="relative h-64 w-full bg-slate-900">
                    <Cropper
                        image={imageFile}
                        crop={crop}
                        zoom={zoom}
                        aspect={croppingTarget === 'avatar' ? 1 : undefined} // Allow free cropping for Logo
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
                        objectFit="contain" 
                    />
                  </div>

                  <div className="p-6 flex flex-col gap-5">
                      <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-center">
                            <span className="text-xs font-bold text-slate-500 uppercase flex items-center gap-1">
                                <span className="material-symbols-outlined text-[16px]">zoom_in</span> Zoom
                            </span>
                            <span className="text-xs font-medium text-slate-400">{zoom.toFixed(1)}x</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                            <button 
                                onClick={() => setZoom(Math.max(1, zoom - 0.1))} 
                                className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-primary hover:text-white transition-colors flex items-center justify-center shrink-0"
                            >
                                <span className="material-symbols-outlined text-[18px]">remove</span>
                            </button>
                            
                            <div className="flex-1 relative h-6 flex items-center">
                                <input 
                                    type="range" 
                                    value={zoom} 
                                    min={1} 
                                    max={3} 
                                    step={0.1} 
                                    onChange={(e) => setZoom(Number(e.target.value))}
                                    className="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-primary focus:outline-none focus:ring-2 focus:ring-primary/30"
                                />
                            </div>

                            <button 
                                onClick={() => setZoom(Math.min(3, zoom + 0.1))}
                                className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-primary hover:text-white transition-colors flex items-center justify-center shrink-0"
                            >
                                <span className="material-symbols-outlined text-[18px]">add</span>
                            </button>
                        </div>
                      </div>

                      <div className="flex flex-col sm:flex-row justify-end gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
                        <button 
                            onClick={() => setIsCropping(false)} 
                            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        >
                            Cancelar
                        </button>
                        
                        {/* Botão Pular Recorte */}
                        <button 
                            onClick={handleUseOriginal} 
                            disabled={uploading}
                            className="px-4 py-2 text-sm font-bold text-slate-700 dark:text-white border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            {uploading ? 'Enviando...' : 'Usar Original (Sem Recorte)'}
                        </button>

                        <button 
                            onClick={handleCropSave} 
                            disabled={uploading}
                            className="px-5 py-2 bg-primary text-white text-sm font-bold rounded shadow-lg shadow-primary/30 hover:bg-blue-700 transition-all transform hover:-translate-y-0.5 flex items-center gap-2 justify-center"
                        >
                            {uploading && <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>}
                            Aplicar Recorte
                        </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Settings;