'use client';

import { useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowUpRight, Check, ImagePlus, LoaderCircle, Plus, Save, Trash2 } from 'lucide-react';
import { Modal } from '../components/Modal';
import type { BodyType, FuelType } from '../data/cars';
import { adminApi, AdminApiError, describeError } from './api';
import type { AdminVehicle, VehicleStatus } from './types';

type VehicleDraft = Omit<AdminVehicle, 'id' | 'createdAt' | 'updatedAt' | 'version'> & { id?: string; version?: number };
function newDraft(): VehicleDraft {
  return { brand:'',model:'',year:new Date().getFullYear(),price:0,bodyType:'SUV',fuel:'Petrol',transmission:'',drivetrain:'',mileage:0,power:0,acceleration:null,topSpeed:null,engine:'',color:'',colorHex:'#7c8172',seats:5,tagline:'',description:'',features:[],image:'',imageAlt:'',imageNote:'',gallery:[],featured:false,status:'draft',condition:'used',isDemo:false,stockNumber:'' };
}

export function VehicleEditor({vehicle,onClose,onSaved,onReload}: {vehicle:AdminVehicle|null;onClose:()=>void;onSaved:()=>void;onReload:()=>Promise<void>}) {
  const [draft,setDraft]=useState<VehicleDraft>(()=>vehicle?{...vehicle,gallery:[...vehicle.gallery],features:[...vehicle.features]}:newDraft());
  const [featureText,setFeatureText]=useState(()=>vehicle?.features.join('\n')||'');
  const [galleryUrl,setGalleryUrl]=useState('');
  const [busy,setBusy]=useState(false);
  const [uploading,setUploading]=useState(false);
  const [error,setError]=useState('');
  const [conflict,setConflict]=useState(false);
  const [section,setSection]=useState<'details'|'media'|'specs'>('details');
  const [dirty,setDirty]=useState(false);
  function change<K extends keyof VehicleDraft>(key:K,value:VehicleDraft[K]) {setDraft(current=>({...current,[key]:value}));setDirty(true);}
  function closeEditor(){if(busy||uploading)return;if(!dirty||window.confirm('Discard the changes to this vehicle?'))onClose();}
  function numberChange(key:'year'|'price'|'mileage'|'power'|'seats',value:string){change(key,value===''?0:Number(value));}
  async function uploadPhotos(event:ChangeEvent<HTMLInputElement>){
    const selected=[...(event.target.files||[])];event.target.value='';if(!selected.length)return;
    if(selected.length+draft.gallery.length>12){setError('Keep the gallery to 12 photographs or fewer.');return;}
    if(selected.some(file=>!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>8*1024*1024)){setError('Choose JPEG, PNG or WebP photographs up to 8 MB each.');return;}
    setUploading(true);setError('');
    try{for(const file of selected){const body=new FormData();body.append('file',file);const result=await adminApi<{url:string}>('/api/admin/uploads',{method:'POST',body});setDraft(current=>({...current,image:current.image||result.url,gallery:[...new Set([...current.gallery,result.url])]}));setDirty(true);}}
    catch(uploadError){setError(describeError(uploadError));}finally{setUploading(false);}
  }
  function addImageUrl(){const value=galleryUrl.trim();if(!value||!(value.startsWith('https://')||value.startsWith('/images/')||value.startsWith('/api/media/'))){setError('Use an HTTPS photo URL or a photo path from this site.');return;}if(draft.gallery.length>=12){setError('Keep the gallery to 12 photographs or fewer.');return;}setDraft(current=>({...current,image:current.image||value,gallery:[...new Set([...current.gallery,value])]}));setGalleryUrl('');setError('');setDirty(true);}
  function removeImage(url:string){const gallery=draft.gallery.filter(item=>item!==url);setDraft(current=>({...current,gallery,image:current.image===url?gallery[0]||'':current.image}));setDirty(true);}
  async function save(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(busy||uploading)return;setError('');setConflict(false);
    if(!draft.brand.trim()||!draft.model.trim()||!draft.color.trim()||!draft.stockNumber.trim()){setSection('details');setError('Add the make, model, colour and a unique stock number.');return;}
    if(!/^[a-z0-9][a-z0-9_.-]*$/i.test(draft.stockNumber.trim())){setSection('details');setError('Use letters, numbers, dots, dashes or underscores for the stock number.');return;}
    if(!Number.isInteger(draft.year)||draft.year<1950||draft.year>new Date().getUTCFullYear()+1){setSection('details');setError('Enter a model year from 1950 through next year.');return;}
    if(!Number.isInteger(draft.mileage)||draft.mileage<0||draft.mileage>5000000){setSection('details');setError('Enter a whole-number mileage between 0 and 5,000,000 km.');return;}
    if(!draft.image||!draft.imageAlt.trim()){setSection('media');setError('Choose a cover photograph and describe the vehicle shown.');return;}
    if(!Number.isInteger(draft.price)||draft.price<1||draft.price>1000000000){setSection('details');setError('Enter an asking price from KSh 1 to KSh 1,000,000,000, using whole shillings.');return;}
    if(!draft.transmission.trim()||!draft.drivetrain.trim()||!draft.engine.trim()){setSection('specs');setError('Add the transmission, drivetrain and engine or motor details.');return;}
    if(!Number.isFinite(draft.power)||draft.power<1||draft.power>3000||!Number.isInteger(draft.seats)||draft.seats<1||draft.seats>20){setSection('specs');setError('Enter the verified power (1–3,000 PS) and a seat count from 1 to 20.');return;}
    if((draft.acceleration!==null&&(!Number.isFinite(draft.acceleration)||draft.acceleration<0.1||draft.acceleration>120))||(draft.topSpeed!==null&&(!Number.isFinite(draft.topSpeed)||draft.topSpeed<1||draft.topSpeed>600))){setSection('specs');setError('Use an acceleration from 0.1–120 seconds and a top speed from 1–600 km/h, or leave these optional figures blank.');return;}
    const features=featureText.split('\n').map(value=>value.trim()).filter(Boolean);
    if(features.length>30||features.some(value=>value.length>160)){setSection('specs');setError('Add up to 30 features, with no more than 160 characters per line.');return;}
    if(draft.status==='archived'&&vehicle?.status!=='archived'&&!window.confirm('Archive this vehicle and hide it from the showroom? Its history and customer enquiries will be kept.'))return;
    setBusy(true);
    try{await adminApi(vehicle?`/api/admin/vehicles/${encodeURIComponent(vehicle.id)}`:'/api/admin/vehicles',{method:vehicle?'PUT':'POST',body:JSON.stringify({...draft,features,gallery:[...new Set([draft.image,...draft.gallery])],...(vehicle?{version:vehicle.version}:{})})});setDirty(false);onSaved();}
    catch(saveError){setError(describeError(saveError));setConflict(saveError instanceof AdminApiError&&saveError.status===409);}finally{setBusy(false);}
  }
  return <Modal title={vehicle?`Edit ${vehicle.brand} ${vehicle.model}`:'Add a remarkable car'} onClose={closeEditor} wide><form className="ad-editor" onSubmit={save} noValidate>
    <div className="ad-editor-top"><p>Build the listing with verified specifications and photographs of the actual vehicle. Keep it in Draft until you are ready to show it.</p><span className={`ad-pill ${draft.isDemo?'ad-pill-demo':'ad-pill-live'}`}>{draft.isDemo?'Sample listing':'Real inventory'}</span></div>
    <div className="ad-editor-tabs" aria-label="Vehicle form sections">{(['details','media','specs'] as const).map((value,index)=><button key={value} type="button" className={section===value?'active':''} onClick={()=>setSection(value)} aria-pressed={section===value}><span>0{index+1}</span>{value==='details'?'The essentials':value==='media'?'Photography':'Specification'}</button>)}</div>
    {error&&<div className="ad-form-error" role="alert">{error}{conflict&&<button type="button" onClick={async()=>{if(window.confirm('Reload the saved vehicle and discard your unsaved edits?')){try{await onReload();}catch(reloadError){setError(describeError(reloadError));}}}}>Reload the latest vehicle</button>}</div>}
    <div className="ad-editor-section" hidden={section!=='details'}><div className="ad-field-grid">
      <label>Make / brand<input value={draft.brand} onChange={e=>change('brand',e.target.value)} maxLength={60} required placeholder="e.g. Porsche"/></label>
      <label>Model<input value={draft.model} onChange={e=>change('model',e.target.value)} maxLength={100} required placeholder="e.g. 911 GT3"/></label>
      <label>Stock number<input value={draft.stockNumber} onChange={e=>change('stockNumber',e.target.value)} maxLength={40} required placeholder="e.g. VEL-001"/><small>Your unique inventory reference.</small></label>
      <label>Model year<input type="number" min="1950" max={new Date().getUTCFullYear()+1} value={draft.year} onChange={e=>numberChange('year',e.target.value)} required/></label>
      <label>Asking price · KSh<input type="number" min="1" max="1000000000" step="1" value={draft.price||''} onChange={e=>numberChange('price',e.target.value)} required placeholder="Enter the full amount"/></label>
      <label>Mileage · km<input type="number" min="0" max="5000000" step="1" value={draft.mileage} onChange={e=>numberChange('mileage',e.target.value)} required/></label>
      <label>Body type<select value={draft.bodyType} onChange={e=>change('bodyType',e.target.value as BodyType)}><option>Coupe</option><option>SUV</option><option>Sedan</option></select></label>
      <label>Condition<select value={draft.condition} onChange={e=>change('condition',e.target.value as 'new'|'used')}><option value="used">Pre-owned</option><option value="new">New</option></select></label>
      <label>Exterior colour<input value={draft.color} onChange={e=>change('color',e.target.value)} maxLength={60} required placeholder="Actual paint colour"/></label>
      <label>Colour swatch<div className="ad-color-field"><input type="color" value={draft.colorHex} onChange={e=>change('colorHex',e.target.value)} aria-label="Vehicle colour swatch"/><span>{draft.colorHex}</span></div></label>
      <label>Stock status<select value={draft.status} onChange={e=>change('status',e.target.value as VehicleStatus)}><option value="draft">Draft · hidden from showroom</option><option value="available">Available</option><option value="reserved">Reserved</option><option value="sold">Sold</option><option value="archived">Archived · hidden from showroom</option></select></label>
      <label>Card badge<input value={draft.badge||''} onChange={e=>change('badge',e.target.value)} maxLength={50} placeholder="Optional short highlight"/></label>
      <label className="ad-field-wide">Short introduction<input value={draft.tagline} onChange={e=>change('tagline',e.target.value)} maxLength={220} placeholder="What makes this car special?"/></label>
      <label className="ad-field-wide">Vehicle description<textarea value={draft.description} onChange={e=>change('description',e.target.value)} rows={4} maxLength={4000} placeholder="Describe its character, verified equipment and condition."/></label>
    </div><div className="ad-check-row"><label><input type="checkbox" checked={draft.featured} onChange={e=>change('featured',e.target.checked)}/><span>Feature this vehicle in curated picks</span></label><label><input type="checkbox" checked={draft.isDemo} onChange={e=>change('isDemo',e.target.checked)}/><span>Sample vehicle · not actual stock</span></label></div>{vehicle?.isDemo&&!draft.isDemo&&<p className="ad-inline-warning">Only mark this as real stock after replacing the sample details and reference photographs with the dealership’s actual vehicle.</p>}</div>
    <div className="ad-editor-section" hidden={section!=='media'}>
      <label className={`ad-upload ${uploading?'ad-upload-busy':''}`}><input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={uploadPhotos} disabled={uploading||busy}/>{uploading?<LoaderCircle className="ad-spin"/>:<ImagePlus/>}<strong>{uploading?'Uploading photographs…':'Add the vehicle’s photographs'}</strong><span>JPEG, PNG or WebP · up to 8 MB each · maximum 12 photos</span></label>
      <div className="ad-photo-url"><label>Or add a photo URL<input value={galleryUrl} onChange={e=>setGalleryUrl(e.target.value)} placeholder="https://… or /images/…" aria-label="Photo URL"/></label><button type="button" className="ad-secondary" onClick={addImageUrl} disabled={uploading||!galleryUrl.trim()}><Plus size={16}/> Add</button></div>
      {draft.gallery.length>0&&<div className="ad-photo-grid">{draft.gallery.map((url,index)=><div key={url} className={draft.image===url?'ad-photo-cover':''}><img src={url} alt={`Vehicle photograph ${index+1}`}/><div><button type="button" onClick={()=>change('image',url)} aria-label={`Use photograph ${index+1} as cover`}>{draft.image===url?<><Check size={13}/> Cover photo</>:'Set as cover'}</button><button type="button" onClick={()=>removeImage(url)} aria-label={`Remove photograph ${index+1}`} disabled={uploading||busy}><Trash2 size={14}/></button></div></div>)}</div>}
      <div className="ad-field-grid"><label className="ad-field-wide">Photo description / alt text<input value={draft.imageAlt} onChange={e=>change('imageAlt',e.target.value)} maxLength={250} required placeholder="e.g. Silver Porsche 911 GT3, front three-quarter view"/></label><label className="ad-field-wide">Photo context<textarea value={draft.imageNote||''} onChange={e=>change('imageNote',e.target.value)} rows={2} maxLength={500} placeholder="Optional: photograph date, visible options, or reference-photo limitations."/></label></div><p className="ad-help">Use photographs you own or have permission to publish. All gallery photographs should show this same vehicle.</p>
    </div>
    <div className="ad-editor-section" hidden={section!=='specs'}><div className="ad-field-grid">
      <label>Powertrain<select value={draft.fuel} onChange={e=>change('fuel',e.target.value as FuelType)}><option>Petrol</option><option>Diesel</option><option>Electric</option><option>Hybrid</option></select></label>
      <label>Transmission<input value={draft.transmission} onChange={e=>change('transmission',e.target.value)} maxLength={80} placeholder="e.g. 8-speed automatic" required/></label>
      <label>Drivetrain<input value={draft.drivetrain} onChange={e=>change('drivetrain',e.target.value)} maxLength={80} placeholder="e.g. All-wheel drive" required/></label>
      <label>Engine / motor<input value={draft.engine} onChange={e=>change('engine',e.target.value)} maxLength={120} placeholder="e.g. 3.0L twin-turbo inline-six" required/></label>
      <label>Power · PS<input type="number" value={draft.power||''} min="1" max="3000" step="1" onChange={e=>numberChange('power',e.target.value)} placeholder="Verified metric horsepower"/></label>
      <label>Seats<input type="number" value={draft.seats} min="1" max="20" step="1" onChange={e=>numberChange('seats',e.target.value)}/></label>
      <label>0–100 km/h · seconds<input type="number" value={draft.acceleration??''} min="0.1" max="120" step="0.1" onChange={e=>change('acceleration',e.target.value?Number(e.target.value):null)} placeholder="Leave blank if unverified"/></label>
      <label>Top speed · km/h<input type="number" value={draft.topSpeed??''} min="1" max="600" step="1" onChange={e=>change('topSpeed',e.target.value?Number(e.target.value):null)} placeholder="Leave blank if unverified"/></label>
      <label className="ad-field-wide">Power note<input value={draft.powerNote||''} onChange={e=>change('powerNote',e.target.value)} maxLength={250} placeholder="Optional: launch boost or other qualification"/></label>
      <label className="ad-field-wide">Verified features · one per line<textarea value={featureText} onChange={e=>{setFeatureText(e.target.value);setDirty(true);}} rows={6} maxLength={4000} placeholder={'Adaptive suspension\nHeated front seats\n360-degree parking camera'}/></label>
    </div><p className="ad-help">Use the exact variant’s verified specifications. Leave optional performance figures blank when they are unknown.</p></div>
    <div className="ad-editor-footer"><button type="button" className="ad-secondary" onClick={closeEditor} disabled={busy||uploading}>Cancel</button>{section!=='specs'&&<button type="button" className="ad-secondary" onClick={()=>setSection(section==='details'?'media':'specs')}>Next section <ArrowUpRight size={16}/></button>}<button type="submit" className="ad-primary" disabled={busy||uploading}>{busy?<LoaderCircle className="ad-spin" size={16}/>:<Save size={16}/>} {busy?'Saving vehicle…':'Save vehicle'}</button></div>
  </form></Modal>;
}
