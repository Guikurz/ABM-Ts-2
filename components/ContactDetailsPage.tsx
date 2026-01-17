import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Contact, UserProfile, Company, CampaignData } from '../types';
import { supabase } from '../services/supabaseClient';
import Cropper from 'react-easy-crop';
import getCroppedImg from '../utils/cropImage';

interface ContactDetailsPageProps {
  contact: Contact;
  onBack: () => void;
  onCompanyClick: (companyName: string) => void;
}

interface TimelineItem {
    id: string;
    type: 'creation' | 'campaign' | 'job_change' | 'note';
    date: Date;
    title: string;
    description?: string;
    icon: string;
    color: string;
}

const ContactDetailsPage: React.FC<ContactDetailsPageProps> = ({ contact, onBack, onCompanyClick }) => {
  // Initialize state with props + empty defaults for "not defined" appearance
  const initialData = {
    ...contact,
    phone: contact.phone || '',
    linkedin: contact.linkedin || '',
    instagram: contact.instagram || '',
    children: contact.children || '',
    sportsTeam: contact.sportsTeam || '',
    activeCampaign: contact.activeCampaign || '',
    address: contact.address || '',
    personalEmail: contact.personalEmail || '',
    hobbies: contact.hobbies || '',
    pets: contact.pets || '',
    maritalStatus: contact.maritalStatus || '',
    age: contact.age || '',
    notes: contact.notes || "",
    owners: contact.owners || []
  };

  const [isEditing, setIsEditing] = useState(false);
  const [isOwnerModalOpen, setIsOwnerModalOpen] = useState(false);
  const [data, setData] = useState(initialData); 
  const [formData, setFormData] = useState(initialData); 
  
  // Real users state
  const [availableUsers, setAvailableUsers] = useState<UserProfile[]>([]);
  // Available Companies state
  const [availableCompanies, setAvailableCompanies] = useState<Company[]>([]);
  // Contact Campaigns History
  const [relatedCampaigns, setRelatedCampaigns] = useState<CampaignData[]>([]);

  // Avatar Upload States
  const [avatarFile, setAvatarFile] = useState<string | null>(null);
  const [rawFile, setRawFile] = useState<File | null>(null);
  const [isCropping, setIsCropping] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
        const { data } = await supabase.from('profiles').select('*');
        if (data) {
            setAvailableUsers(data);
        }
    };

    const fetchCompanies = async () => {
        const { data } = await supabase.from('companies').select('*').order('name');
        if (data) {
            const mapped = data.map((c: any) => ({
                id: c.id,
                name: c.name,
                industry: c.industry || '',
                size: c.size || '',
                domain: c.domain || '',
                contactsCount: 0,
                deals: 0
            }));
            setAvailableCompanies(mapped);
        }
    };

    fetchUsers();
    fetchCompanies();
  }, []);

  // Fetch campaigns related to this contact's company
  useEffect(() => {
      const fetchRelatedCampaigns = async () => {
          if (!data.company) return;
          const { data: campaigns } = await supabase
            .from('campaigns')
            .select('*')
            .eq('target_company', data.company);
          
          if (campaigns) {
              setRelatedCampaigns(campaigns.map((c: any) => ({
                  id: c.id,
                  name: c.name,
                  status: c.status,
                  created_at: c.created_at,
                  objective: c.objective,
                  steps: c.steps // Include steps for history parsing
              })));
          }
      };
      fetchRelatedCampaigns();
  }, [data.company]);

  const handleEditClick = () => {
    setFormData(data); 
    setIsEditing(true);
  };

  const handleSave = async () => {
    try {
        let updatedNotes = formData.notes || '';
        let companyChanged = false;

        // Detect Company Change
        if (data.company && formData.company && data.company !== formData.company) {
            companyChanged = true;
            const dateStr = new Date().toISOString();
            updatedNotes += `\n[HISTORY:MOVED:${dateStr}] Mudou da empresa ${data.company} para ${formData.company}`;
        }

        const payload: any = {
            name: formData.name,
            role: formData.role,
            company: formData.company,
            email: formData.email,
            phone: formData.phone,
            linkedin: formData.linkedin,
            instagram: formData.instagram,
            avatar: formData.avatar, // Ensure avatar URL is saved
            notes: updatedNotes,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase
            .from('contacts')
            .update(payload)
            .eq('id', contact.id);

        if (error) throw error;

        const newData = { ...formData, notes: updatedNotes };
        setData(newData);
        setFormData(newData);
        setIsEditing(false);

        if (companyChanged) {
            alert(`Contato movido para ${formData.company} com sucesso!`);
        }

    } catch (e: any) {
        console.error("Error updating contact:", e);
        alert(`Erro ao salvar alterações: ${e.message || e.details || JSON.stringify(e)}`);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setAvatarFile(null); // Clear any pending avatar upload
  };

  const handleChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const toggleOwner = (userName: string) => {
    const currentOwners = data.owners || [];
    let newOwners;
    if (currentOwners.includes(userName)) {
      newOwners = currentOwners.filter(o => o !== userName);
    } else {
      newOwners = [...currentOwners, userName];
    }
    const newData = { ...data, owners: newOwners };
    setData(newData);
    setFormData(newData);
  };

  // --- Avatar Upload Logic ---
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

  const performUpload = async (fileToUpload: Blob | File) => {
      setUploadingAvatar(true);
      try {
          const contentType = fileToUpload instanceof File ? fileToUpload.type : 'image/png';
          const ext = contentType.split('/')[1] || 'png';
          const timestamp = Date.now();
          const fileName = `${contact.id}/${timestamp}.${ext}`;

          // 1. Upload to Storage
          const { error: uploadError } = await supabase.storage
              .from('contact-avatars')
              .upload(fileName, fileToUpload, { contentType, upsert: true });

          if (uploadError) throw uploadError;

          // 2. Get Public URL
          const { data: urlData } = supabase.storage.from('contact-avatars').getPublicUrl(fileName);
          const publicUrl = urlData.publicUrl;
          
          // 3. Update Database IMMEDIATELY
          const { error: dbError } = await supabase
              .from('contacts')
              .update({ avatar: publicUrl, updated_at: new Date().toISOString() })
              .eq('id', contact.id);

          if (dbError) throw dbError;

          // 4. Update UI States
          setFormData(prev => ({ ...prev, avatar: publicUrl }));
          setData(prev => ({ ...prev, avatar: publicUrl })); // Update non-edit view as well
          
          setIsCropping(false);
          setAvatarFile(null);
          setRawFile(null);

      } catch (error: any) {
          console.error("Upload error:", error);
          alert("Erro ao enviar imagem: " + error.message);
      } finally {
          setUploadingAvatar(false);
      }
  };

  const handleCropSave = async () => {
      if (!avatarFile || !croppedAreaPixels) return;
      try {
          const croppedBlob = await getCroppedImg(avatarFile, croppedAreaPixels);
          if (croppedBlob) {
              await performUpload(croppedBlob);
          }
      } catch (e) {
          console.error(e);
          alert("Erro ao recortar imagem.");
      }
  };

  const handleUseOriginal = async () => {
      if (rawFile) {
          await performUpload(rawFile);
      }
  };

  // --- Timeline Logic ---
  const timelineItems: TimelineItem[] = useMemo(() => {
      const items: TimelineItem[] = [];

      items.push({
          id: 'creation',
          type: 'creation',
          date: new Date(), 
          title: 'Contato Criado',
          description: 'Adicionado à plataforma',
          icon: 'person_add',
          color: 'bg-slate-200 text-slate-600'
      });

      relatedCampaigns.forEach(camp => {
          items.push({
              id: `camp-${camp.id}`,
              type: 'campaign',
              date: camp.created_at ? new Date(camp.created_at) : new Date(),
              title: `Ingressou na Campanha: ${camp.name}`,
              description: `Objetivo: ${camp.objective}`,
              icon: 'rocket_launch',
              color: 'bg-blue-100 text-blue-600'
          });

          if (camp.steps && Array.isArray(camp.steps)) {
              const startDate = camp.created_at ? new Date(camp.created_at) : new Date();
              camp.steps.forEach(step => {
                  const isTarget = !step.targetContactName || step.targetContactName === data.name;
                  if (step.completed && isTarget) {
                      const completeDate = new Date(startDate);
                      completeDate.setDate(startDate.getDate() + Number(step.day));
                      items.push({
                          id: `task-${step.id}`,
                          type: 'campaign',
                          date: completeDate,
                          title: `Tarefa Concluída: ${step.title}`,
                          description: `Executado por: ${step.owner || 'Sistema'}`,
                          icon: 'check_circle',
                          color: 'bg-green-100 text-green-600'
                      });
                  }
              });
          }
      });

      if (data.notes) {
          const historyRegex = /\[HISTORY:MOVED:(.*?)\] (.*)/g;
          let match;
          while ((match = historyRegex.exec(data.notes)) !== null) {
              const dateStr = match[1];
              const message = match[2];
              items.push({
                  id: `hist-${dateStr}`,
                  type: 'job_change',
                  date: new Date(dateStr),
                  title: 'Mudança de Empresa',
                  description: message,
                  icon: 'domain_disabled', 
                  color: 'bg-orange-100 text-orange-600'
              });
          }
      }

      return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [data.notes, relatedCampaigns, data.name]);


  const renderField = (field: keyof typeof initialData, label: string, type: string = 'text', fullWidth: boolean = false) => {
    if (isEditing) {
      return (
        <input
          type={type}
          value={formData[field] as string | number}
          onChange={(e) => handleChange(field as string, e.target.value)}
          className={`px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm focus:ring-1 focus:ring-primary focus:border-primary ${fullWidth ? 'w-full' : 'w-full'}`}
          placeholder={`Adicionar ${label}`}
        />
      );
    }
    const val = data[field];
    if (!val) {
        return <p className="text-sm text-slate-400 italic">Não informado</p>;
    }
    return <p className="text-base font-semibold text-slate-900 dark:text-white truncate" title={String(val)}>{val}</p>;
  };

  const PersonalItem = ({ icon, label, field, colorClass = "text-slate-400" }: { icon: string, label: string, field: keyof typeof initialData, colorClass?: string }) => (
    <div className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
        <div className={`size-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0 ${colorClass}`}>
            <span className="material-symbols-outlined text-[20px]">{icon}</span>
        </div>
        <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 mb-0.5">{label}</p>
            {isEditing ? (
                <input 
                    type="text" 
                    value={formData[field] as string} 
                    onChange={(e) => handleChange(field as string, e.target.value)} 
                    className="w-full px-2 py-1 h-7 text-xs rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900"
                    placeholder="—"
                />
            ) : (
                <p className={`text-sm font-bold truncate ${!data[field] ? 'text-slate-300 dark:text-slate-600 font-normal' : 'text-slate-800 dark:text-slate-200'}`} title={String(data[field])}>
                    {data[field] || '—'}
                </p>
            )}
        </div>
    </div>
  );

  const displayNotes = isEditing 
    ? formData.notes 
    : (data.notes || '').replace(/\[HISTORY:.*?\] .*/g, '').trim();

  const currentAvatar = isEditing ? formData.avatar : data.avatar;

  return (
    <div className="p-4 lg:p-6 w-full flex flex-col gap-6 h-full pb-10 relative">
      <div>
          <button onClick={onBack} className="flex items-center gap-1 text-slate-500 hover:text-primary transition-colors text-sm font-medium mb-4">
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
              Voltar
          </button>
      </div>

      <div className="bg-white dark:bg-[#151b2b] rounded-lg border border-slate-200 dark:border-slate-800 p-6 lg:p-8 shadow-sm">
        <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-6">
            <div className="flex items-center gap-6 flex-1">
                {/* Avatar Section */}
                <div className="relative group shrink-0">
                    {currentAvatar ? (
                        <div 
                            className="size-24 rounded-full bg-slate-200 bg-cover bg-center border-4 border-white dark:border-slate-700 shadow-sm" 
                            style={{ backgroundImage: `url("${currentAvatar}")` }}
                        ></div>
                    ) : (
                        <div className="size-24 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-3xl font-bold border-4 border-white dark:border-slate-700 shadow-sm">
                            {data.name.charAt(0)}
                        </div>
                    )}
                    
                    {/* Upload Overlay (Only in Edit Mode) */}
                    {isEditing && (
                        <label className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="material-symbols-outlined text-white text-[28px]">add_a_photo</span>
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                onChange={onFileChange}
                            />
                        </label>
                    )}
                </div>
                
                <div className="flex-1 min-w-0">
                    {isEditing ? (
                        <div className="flex flex-col gap-3 max-w-md">
                            <input 
                                type="text" 
                                value={formData.name} 
                                onChange={(e) => handleChange('name', e.target.value)}
                                className="text-3xl font-bold text-slate-900 dark:text-white bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-primary focus:outline-none px-1"
                            />
                             <div className="flex items-center gap-2">
                                <input 
                                    type="text" 
                                    value={formData.role} 
                                    onChange={(e) => handleChange('role', e.target.value)}
                                    placeholder="Cargo"
                                    className="text-base font-medium text-slate-500 dark:text-slate-400 bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-primary focus:outline-none px-1 w-1/3"
                                />
                                <span className="text-slate-400">@</span>
                                <select 
                                    value={formData.company} 
                                    onChange={(e) => handleChange('company', e.target.value)}
                                    className="text-base font-medium text-primary bg-transparent border-b border-slate-300 dark:border-slate-700 focus:border-primary focus:outline-none px-1 w-1/2 cursor-pointer"
                                >
                                    <option value="" disabled>Selecione a empresa</option>
                                    {availableCompanies.map(c => (
                                        <option key={c.id} value={c.name}>{c.name}</option>
                                    ))}
                                </select>
                             </div>
                        </div>
                    ) : (
                        <>
                            <h1 className="text-3xl font-bold text-slate-900 dark:text-white mb-1">{data.name}</h1>
                            <p className="text-lg text-slate-500 dark:text-slate-400 font-medium flex items-center gap-2">
                                {data.role} 
                                <span className="text-slate-300">•</span>
                                <button 
                                    onClick={() => onCompanyClick(data.company)}
                                    className="text-primary hover:underline hover:text-blue-700 font-bold transition-colors flex items-center gap-1"
                                >
                                    <span className="material-symbols-outlined text-[18px]">domain</span>
                                    {data.company}
                                </button>
                            </p>
                        </>
                    )}
                    
                    <div className="flex flex-wrap items-center gap-3 mt-4">
                         <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                            data.priority === 'Alta' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                            data.priority === 'Média' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                            'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                         }`}>
                            Prioridade {data.priority}
                         </span>
                         
                         <div className="flex items-center gap-2 ml-2 pl-4 border-l border-slate-200 dark:border-slate-700">
                            <span className="text-[10px] uppercase font-bold text-slate-400">Responsáveis:</span>
                            <div className="flex -space-x-2">
                                {data.owners && data.owners.length > 0 ? (
                                    data.owners.map((owner: string, idx: number) => {
                                        const userInitials = owner.split(' ').map((n: string) => n[0]).join('').slice(0, 2);
                                        return (
                                            <div key={idx} className="size-8 rounded-full bg-slate-700 text-white text-xs font-bold flex items-center justify-center border-2 border-white dark:border-slate-800 ring-1 ring-slate-100 dark:ring-slate-700" title={owner}>
                                                {userInitials}
                                            </div>
                                        );
                                    })
                                ) : (
                                    <span className="text-xs text-slate-400 italic px-2">Nenhum</span>
                                )}
                                <button 
                                    onClick={() => setIsOwnerModalOpen(true)}
                                    className="size-8 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary hover:bg-slate-200 dark:hover:bg-slate-700 border-2 border-white dark:border-slate-800 flex items-center justify-center transition-colors"
                                    title="Editar Responsáveis"
                                >
                                    <span className="material-symbols-outlined text-[16px]">edit</span>
                                </button>
                            </div>
                         </div>
                    </div>
                </div>
            </div>

            <div className="flex gap-3 w-full xl:w-auto">
                {isEditing ? (
                    <>
                         <button 
                            onClick={handleCancel}
                            className="flex-1 xl:flex-none px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button 
                            onClick={handleSave}
                            className="flex-1 xl:flex-none px-6 py-2.5 bg-green-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-[20px]">check</span>
                            Salvar Perfil
                        </button>
                    </>
                ) : (
                    <button 
                        onClick={handleEditClick}
                        className="flex-1 xl:flex-none px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-bold rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-[20px]">edit</span>
                        Editar Perfil
                    </button>
                )}
            </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Info & Personal (Width 7/12) */}
        <div className="lg:col-span-7 flex flex-col gap-6">
            
            {/* Contact Info - EXPANDED */}
            <div className="bg-white dark:bg-[#151b2b] rounded-lg border border-slate-200 dark:border-slate-800 p-8 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-800">
                    <span className="material-symbols-outlined text-primary text-[24px]">contact_phone</span>
                    Informações de Contato
                </h3>
                
                <div className="space-y-6">
                    {/* Primary Email */}
                    <div className="flex items-start gap-4 group">
                         <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg text-primary">
                            <span className="material-symbols-outlined text-[24px]">mail</span>
                         </div>
                         <div className="flex-1 overflow-hidden">
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wide mb-1">Email Corporativo</p>
                            {renderField('email', 'Email')}
                         </div>
                    </div>

                    {/* Phone */}
                    <div className="flex items-start gap-4">
                         <div className="bg-green-50 dark:bg-green-900/20 p-3 rounded-lg text-green-600">
                            <span className="material-symbols-outlined text-[24px]">call</span>
                         </div>
                         <div className="flex-1">
                            <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wide mb-1">Telefone / WhatsApp</p>
                            {renderField('phone', 'Telefone')}
                         </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Personal Email */}
                        <div className="flex items-start gap-4">
                            <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg text-slate-500">
                                <span className="material-symbols-outlined text-[20px]">alternate_email</span>
                            </div>
                            <div className="flex-1 overflow-hidden">
                                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wide mb-1">Email Pessoal</p>
                                {renderField('personalEmail', 'Email Pessoal')}
                            </div>
                        </div>

                         {/* Address */}
                         <div className="flex items-start gap-4">
                            <div className="bg-slate-100 dark:bg-slate-800 p-2.5 rounded-lg text-slate-500">
                                <span className="material-symbols-outlined text-[20px]">pin_drop</span>
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wide mb-1">Endereço</p>
                                {renderField('address', 'Endereço')}
                            </div>
                        </div>
                    </div>

                    {/* Socials */}
                    <div className="pt-6 mt-2 border-t border-slate-100 dark:border-slate-800">
                         {isEditing ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs font-bold text-slate-500">LinkedIn URL</span>
                                    <div className="relative">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 material-symbols-outlined text-[18px]">link</span>
                                        <input type="text" value={formData.linkedin} onChange={(e) => handleChange('linkedin', e.target.value)} className="w-full pl-9 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" placeholder="URL do perfil" />
                                    </div>
                                </label>
                                <label className="flex flex-col gap-1.5">
                                    <span className="text-xs font-bold text-slate-500">Instagram Handle</span>
                                    <div className="relative">
                                         <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs font-bold">@</span>
                                        <input type="text" value={formData.instagram} onChange={(e) => handleChange('instagram', e.target.value)} className="w-full pl-8 px-3 py-2 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm" placeholder="usuario" />
                                    </div>
                                </label>
                            </div>
                         ) : (
                             <div className="flex gap-4">
                                {data.linkedin ? (
                                    <a href={`https://${data.linkedin}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#0077b5]/10 hover:bg-[#0077b5]/20 text-[#0077b5] transition-colors border border-[#0077b5]/20">
                                        <span className="font-bold text-xl">in</span>
                                        <span className="text-sm font-bold">LinkedIn Profile</span>
                                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                    </a>
                                ) : (
                                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed">
                                        <span className="font-bold text-xl opacity-50">in</span>
                                        <span className="text-sm font-bold opacity-50">LinkedIn</span>
                                    </div>
                                )}
                                {data.instagram ? (
                                    <a href={`https://${data.instagram}`} target="_blank" rel="noreferrer" className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-[#E1306C]/10 hover:bg-[#E1306C]/20 text-[#E1306C] transition-colors border border-[#E1306C]/20">
                                        <span className="font-bold text-xl">IG</span>
                                        <span className="text-sm font-bold">Instagram</span>
                                        <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                                    </a>
                                ) : (
                                    <div className="flex items-center gap-3 px-4 py-2.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-400 border border-slate-200 dark:border-slate-700 cursor-not-allowed">
                                        <span className="font-bold text-xl opacity-50">IG</span>
                                        <span className="text-sm font-bold opacity-50">Instagram</span>
                                    </div>
                                )}
                             </div>
                         )}
                    </div>
                </div>
            </div>

            {/* Personal Info */}
            <div className="bg-white dark:bg-[#151b2b] rounded-lg border border-slate-200 dark:border-slate-800 p-6 shadow-sm">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                    <span className="material-symbols-outlined text-pink-500 text-[24px]">favorite</span>
                    Pessoal & Interesses
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <PersonalItem icon="cake" label="Idade" field="age" colorClass="text-pink-500" />
                     <PersonalItem icon="favorite" label="Estado Civil" field="maritalStatus" colorClass="text-red-500" />
                     <PersonalItem icon="child_care" label="Filhos" field="children" colorClass="text-blue-500" />
                     <PersonalItem icon="pets" label="Pets" field="pets" colorClass="text-orange-500" />
                     <PersonalItem icon="sports_soccer" label="Time do Coração" field="sportsTeam" colorClass="text-green-600" />
                     <PersonalItem icon="palette" label="Hobbies" field="hobbies" colorClass="text-purple-500" />
                </div>
            </div>

        </div>

        {/* Right Column: Context & Campaigns (Width 5/12) */}
        <div className="lg:col-span-5 flex flex-col gap-6">
            
            {/* Notes - COMPACT */}
            <div className="bg-yellow-50 dark:bg-yellow-900/10 rounded-lg border border-yellow-200 dark:border-yellow-900/30 p-4 shadow-sm relative group transition-all hover:shadow-md">
                 <div className="absolute top-0 right-0 size-8 bg-yellow-100 dark:bg-yellow-900/50 rounded-bl-xl border-l border-b border-yellow-200 dark:border-yellow-900/30 z-10"></div>
                 <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-800 dark:text-yellow-100 flex items-center gap-2 text-sm">
                        <span className="material-symbols-outlined text-yellow-600 dark:text-yellow-400 text-[18px]">sticky_note_2</span>
                        Anotações Rápidas
                    </h3>
                    <span className="text-[10px] uppercase font-bold text-yellow-600/60 dark:text-yellow-400/60">
                        {isEditing ? 'Editando...' : 'Salvo'}
                    </span>
                 </div>
                 <textarea 
                    className={`w-full h-32 p-3 rounded bg-white/50 dark:bg-black/20 border border-yellow-200/50 dark:border-yellow-900/30 text-slate-700 dark:text-slate-300 text-sm focus:ring-1 focus:ring-yellow-400 focus:border-yellow-400 resize-none leading-relaxed ${isEditing ? 'bg-white dark:bg-slate-900 ring-1 ring-yellow-400' : ''}`}
                    value={isEditing ? formData.notes : displayNotes}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    readOnly={!isEditing}
                    placeholder="Adicione contexto aqui..."
                 ></textarea>
            </div>

             {/* Journey / Timeline */}
             <div className="bg-white dark:bg-[#151b2b] rounded-lg border border-slate-200 dark:border-slate-800 p-6 shadow-sm flex-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3">
                    <span className="material-symbols-outlined text-primary text-[24px]">history_edu</span>
                    Jornada & Histórico
                </h3>
                
                <div className="flex flex-col relative">
                    <div className="absolute top-4 bottom-4 left-4 w-0.5 bg-slate-100 dark:bg-slate-800"></div>
                    
                    {timelineItems.length > 0 ? timelineItems.map((item, i) => (
                        <div key={item.id} className="flex gap-4 mb-6 last:mb-0 relative z-10 group">
                            <div className={`size-8 rounded-full flex items-center justify-center shrink-0 border-2 border-white dark:border-[#151b2b] shadow-sm ${item.color}`}>
                                <span className="material-symbols-outlined text-[16px]">{item.icon}</span>
                            </div>
                            <div className="flex-1 bg-slate-50 dark:bg-slate-900/50 p-3 rounded-lg border border-slate-100 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
                                <div className="flex justify-between items-start mb-1">
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{item.title}</p>
                                    <span className="text-[10px] text-slate-400 whitespace-nowrap">
                                        {item.date.toLocaleDateString('pt-BR')}
                                    </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                                    {item.description}
                                </p>
                            </div>
                        </div>
                    )) : (
                        <div className="text-center py-8 text-slate-400 pl-8">
                            <p className="text-sm">Nenhum histórico disponível.</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
      </div>

      {/* Owners Modal */}
      {isOwnerModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-in fade-in duration-200">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-sm overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <h3 className="font-bold text-slate-900 dark:text-white">Gerenciar Responsáveis</h3>
                    <button onClick={() => setIsOwnerModalOpen(false)} className="text-slate-400 hover:text-slate-600"><span className="material-symbols-outlined">close</span></button>
                </div>
                <div className="p-2 max-h-[300px] overflow-y-auto">
                    {availableUsers.map(user => {
                        const userName = user.full_name || user.email;
                        const isSelected = (data.owners || []).includes(userName);
                        return (
                            <div 
                                key={user.id} 
                                onClick={() => toggleOwner(userName)}
                                className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-primary/5 border border-primary/20' : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'}`}
                            >
                                <div className={`size-8 rounded-full flex items-center justify-center font-bold text-xs ${isSelected ? 'bg-primary text-white' : 'bg-slate-200 text-slate-600'} overflow-hidden`}>
                                    {user.avatar_url ? (
                                        <img src={user.avatar_url} alt="" className="w-full h-full object-cover" />
                                    ) : (
                                        userName.charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className={`text-sm font-bold ${isSelected ? 'text-primary' : 'text-slate-700 dark:text-slate-300'}`}>{userName}</p>
                                    <p className="text-xs text-slate-400 truncate">{user.email}</p>
                                </div>
                                {isSelected && <span className="material-symbols-outlined text-primary text-[20px]">check_circle</span>}
                            </div>
                        );
                    })}
                    {availableUsers.length === 0 && (
                        <div className="p-4 text-center text-sm text-slate-400">
                            Nenhum usuário encontrado.
                        </div>
                    )}
                </div>
                <div className="p-3 border-t border-slate-100 dark:border-slate-800 text-center">
                    <button onClick={() => setIsOwnerModalOpen(false)} className="text-xs font-bold text-primary hover:underline">Concluído</button>
                </div>
            </div>
        </div>
      )}

      {/* Cropper Modal for Avatar */}
      {isCropping && avatarFile && (
          <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
              <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-xl overflow-hidden flex flex-col max-h-[90vh] shadow-2xl animate-in fade-in zoom-in duration-200">
                  <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800">
                      <h3 className="font-bold text-slate-900 dark:text-white">Recortar Foto do Contato</h3>
                      <button onClick={() => { setIsCropping(false); setAvatarFile(null); }} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors"><span className="material-symbols-outlined">close</span></button>
                  </div>
                  
                  <div className="relative h-64 w-full bg-slate-900">
                    <Cropper
                        image={avatarFile}
                        crop={crop}
                        zoom={zoom}
                        aspect={1}
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
                        
                        {/* Zoom Controls Buttons Added */}
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
                            onClick={() => { setIsCropping(false); setAvatarFile(null); }} 
                            className="px-4 py-2 text-sm font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                        >
                            Cancelar
                        </button>
                        
                        <button 
                            onClick={handleUseOriginal} 
                            disabled={uploadingAvatar}
                            className="px-4 py-2 text-sm font-bold text-slate-700 dark:text-white border border-slate-300 dark:border-slate-600 rounded hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                        >
                            {uploadingAvatar ? 'Enviando...' : 'Sem Recorte'}
                        </button>

                        <button 
                            onClick={handleCropSave} 
                            disabled={uploadingAvatar}
                            className="px-5 py-2 bg-primary text-white text-sm font-bold rounded shadow-lg shadow-primary/30 hover:bg-blue-700 transition-all flex items-center gap-2 justify-center"
                        >
                            {uploadingAvatar && <span className="material-symbols-outlined text-[16px] animate-spin">sync</span>}
                            Salvar Foto
                        </button>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default ContactDetailsPage;