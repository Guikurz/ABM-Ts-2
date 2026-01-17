import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';

const Login: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  
  // Branding State (Whitelabel)
  const [appName, setAppName] = useState('Hard Sales');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  // Image Upload & Crop State
  const [avatarFile, setAvatarFile] = useState<string | null>(null); // Base64
  const [rawFile, setRawFile] = useState<File | null>(null); // Original file for skipping crop
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isCropping, setIsCropping] = useState(false);
  
  // Final blob to upload (Cropped or Original)
  const [finalAvatarBlob, setFinalAvatarBlob] = useState<Blob | File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Fetch Global App Settings (Whitelabel) on Mount
  useEffect(() => {
    const fetchBranding = async () => {
        try {
            // Busca a configuração mais recente atualizada para usar como branding global
            const { data } = await supabase
                .from('app_settings')
                .select('app_name, logo_url')
                .order('updated_at', { ascending: false })
                .limit(1)
                .single();
            
            if (data) {
                if (data.app_name) setAppName(data.app_name);
                if (data.logo_url) setLogoUrl(data.logo_url);
            }
        } catch (e) {
            console.log("Usando branding padrão (Hard Sales).");
        }
    };
    fetchBranding();
  }, []);

  const onFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setRawFile(file);
      const imageDataUrl = await readFile(file);
      setAvatarFile(imageDataUrl as string);
      setIsCropping(true);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    }
    e.target.value = '';
  };

  const readFile = (file: File) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.addEventListener('load', () => resolve(reader.result), false);
      reader.readAsDataURL(file);
    });
  };

  const onCropComplete = useCallback((croppedArea: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const handleCropSave = async () => {
    try {
        if (!avatarFile || !croppedAreaPixels) return;
        const croppedImage = await getCroppedImg(avatarFile, croppedAreaPixels);
        if (croppedImage) {
            setFinalAvatarBlob(croppedImage);
            setPreviewUrl(URL.createObjectURL(croppedImage));
            setIsCropping(false);
        }
    } catch (e) {
        console.error(e);
        setError("Erro ao cortar imagem.");
    }
  };

  // Skip Crop / Use Original
  const handleUseOriginal = () => {
      if (rawFile) {
          setFinalAvatarBlob(rawFile);
          setPreviewUrl(URL.createObjectURL(rawFile));
          setIsCropping(false);
      }
  };

  const uploadAvatar = async (userId: string): Promise<string | null> => {
    if (!finalAvatarBlob) return null;
    
    // Determine extension/mime
    const contentType = finalAvatarBlob instanceof File ? finalAvatarBlob.type : 'image/png';
    const ext = contentType.split('/')[1] || 'png';
    const fileName = `${userId}/${Date.now()}.${ext}`;

    const { data, error } = await supabase.storage
        .from('avatars')
        .upload(fileName, finalAvatarBlob, {
            contentType: contentType,
            upsert: true
        });

    if (error) {
        console.error("Upload error:", error);
        return null;
    }

    const { data: publicUrlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        // 1. Sign Up Standard
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
             data: { full_name: fullName }
          }
        });

        if (signUpError) throw signUpError;
        
        if (data.user) {
             let avatarUrl = null;
             // 2. Upload Image if exists
             if (finalAvatarBlob) {
                 avatarUrl = await uploadAvatar(data.user.id);
             }

             // 3. Update Profile with Avatar
             if (avatarUrl) {
                 await supabase.auth.updateUser({
                     data: { avatar_url: avatarUrl }
                 });
                 
                 try {
                     await supabase.from('profiles').upsert({ 
                         id: data.user.id,
                         avatar_url: avatarUrl,
                         full_name: fullName,
                         updated_at: new Date()
                     });
                 } catch (e) {
                     console.warn("Could not sync profile table:", e);
                 }
             }
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-full items-center justify-center bg-background-light dark:bg-background-dark relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 rounded-full blur-[120px]"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[30%] h-[30%] bg-blue-500/20 rounded-full blur-[100px]"></div>
      </div>

      <div className="w-full max-w-md bg-white dark:bg-[#151b2b] p-8 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xl relative z-10 animate-in fade-in zoom-in duration-300">
        <div className="flex flex-col items-center mb-6">
          {logoUrl && (
              <img src={logoUrl} alt="Logo" className="h-16 w-auto object-contain mb-4 rounded-lg bg-transparent" />
          )}
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white text-center">{appName}</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm">ABM Platform</p>
        </div>

        <form onSubmit={handleAuth} className="flex flex-col gap-4">
          {error && (
            <div className="p-3 rounded bg-red-50 dark:bg-red-900/20 text-red-600 text-xs font-bold border border-red-200 dark:border-red-800 flex items-center gap-2">
              <span className="material-symbols-outlined text-[16px]">error</span>
              {error}
            </div>
          )}

          {isSignUp && (
            <>
                <div className="flex justify-center mb-2">
                    <div className="relative group cursor-pointer">
                        <div className="size-20 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-dashed border-slate-300 dark:border-slate-600 flex items-center justify-center overflow-hidden">
                            {previewUrl ? (
                                <img src={previewUrl} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                                <span className="material-symbols-outlined text-slate-400 text-[24px]">add_a_photo</span>
                            )}
                        </div>
                        <input 
                            type="file" 
                            accept="image/*" 
                            onChange={onFileChange} 
                            className="absolute inset-0 opacity-0 cursor-pointer" 
                        />
                        <div className="absolute bottom-0 right-0 bg-primary text-white rounded-full p-1 shadow-sm">
                            <span className="material-symbols-outlined text-[14px] block">edit</span>
                        </div>
                    </div>
                </div>

                <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Nome Completo</label>
                    <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[18px]">person</span>
                    <input
                        type="text"
                        required
                        className="w-full h-11 pl-10 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-slate-400 text-sm"
                        placeholder="Seu nome"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                    />
                    </div>
                </div>
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Email</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[18px]">mail</span>
              <input
                type="email"
                required
                className="w-full h-11 pl-10 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-slate-400 text-sm"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Senha</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[18px]">lock</span>
              <input
                type="password"
                required
                className="w-full h-11 pl-10 pr-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all placeholder:text-slate-400 text-sm"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="mt-2 w-full h-11 bg-primary text-white font-bold rounded-lg shadow-lg shadow-primary/20 hover:bg-blue-700 hover:shadow-primary/40 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="material-symbols-outlined animate-spin text-[20px]">sync</span>
            ) : (
              <span className="material-symbols-outlined text-[20px]">{isSignUp ? 'person_add' : 'login'}</span>
            )}
            {isSignUp ? 'Criar Conta e Entrar' : 'Entrar na Plataforma'}
          </button>
        </form>

        <div className="mt-6 pt-6 border-t border-slate-100 dark:border-slate-800 text-center">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {isSignUp ? 'Já tem uma conta?' : 'Ainda não tem acesso?'}
            <button
              onClick={() => setIsSignUp(!isSignUp)}
              className="ml-1 text-primary font-bold hover:underline focus:outline-none"
            >
              {isSignUp ? 'Fazer Login' : 'Criar conta'}
            </button>
          </p>
        </div>
      </div>

      {/* Cropper Modal */}
      {isCropping && avatarFile && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-in fade-in zoom-in duration-200">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                      <h3 className="font-bold text-slate-900 dark:text-white">Ajustar Foto</h3>
                      <button onClick={() => setIsCropping(false)} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"><span className="material-symbols-outlined">close</span></button>
                  </div>
                  
                  <div className="relative h-64 w-full bg-slate-900">
                    <Cropper
                        image={avatarFile}
                        crop={crop}
                        zoom={zoom}
                        aspect={1} // Default square for Avatar
                        onCropChange={setCrop}
                        onCropComplete={onCropComplete}
                        onZoomChange={setZoom}
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
                        
                        {/* Botão Usar Original */}
                        <button 
                            onClick={handleUseOriginal} 
                            className="px-4 py-2 text-sm font-bold text-slate-700 dark:text-white border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            Usar Original (Sem Recorte)
                        </button>

                        <button 
                            onClick={handleCropSave} 
                            className="px-5 py-2 bg-primary text-white text-sm font-bold rounded shadow-lg shadow-primary/30 hover:bg-blue-700 transition-all transform hover:-translate-y-0.5"
                        >
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

export default Login;