'use client';

import { useState, type FormEvent } from 'react';
import { BadgeCheck, CreditCard, LoaderCircle, Save, ShieldCheck } from 'lucide-react';
import { adminApi, describeError } from './api';
import type { DealerSettings } from './types';

export function SettingsPanel({settings,onSaved}:{settings:DealerSettings;onSaved:()=>void}){
  const [draft,setDraft]=useState({...settings.dealer,depositKES:settings.payments.depositKES});
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const zones=[...new Set(['Africa/Nairobi','UTC','Africa/Johannesburg','Europe/London','America/New_York','America/Los_Angeles','Asia/Dubai','Asia/Singapore','Asia/Tokyo',settings.dealer.timezone])];
  async function save(event:FormEvent<HTMLFormElement>){event.preventDefault();setError('');setBusy(true);try{await adminApi('/api/admin/settings',{method:'PATCH',body:JSON.stringify(draft)});onSaved();}catch(error){setError(describeError(error));}finally{setBusy(false);}}
  return <div className="ad-settings-grid"><form className="ad-panel ad-settings-form" onSubmit={save}><div className="ad-panel-heading"><div><span className="ad-kicker">YOUR DEALERSHIP</span><h3>Make it yours.</h3></div><BadgeCheck size={22}/></div><p className="ad-muted">These details appear in the showroom and help customers reach the right team. Use verified business information.</p>{error&&<div className="ad-form-error" role="alert">{error}</div>}<div className="ad-field-grid">
    <label className="ad-field-wide">Dealership name<input value={draft.name} maxLength={100} required onChange={e=>setDraft({...draft,name:e.target.value})}/></label>
    <label className="ad-field-wide">Location / address<textarea value={draft.location} rows={2} maxLength={250} onChange={e=>setDraft({...draft,location:e.target.value})} placeholder="Your showroom’s actual location"/></label>
    <label>Business telephone<input type="tel" value={draft.phone} maxLength={32} onChange={e=>setDraft({...draft,phone:e.target.value})} placeholder="e.g. +254…"/></label>
    <label>WhatsApp number<input type="tel" value={draft.whatsapp} maxLength={32} onChange={e=>setDraft({...draft,whatsapp:e.target.value})} placeholder="International number"/></label>
    <label className="ad-field-wide">Customer contact email<input type="email" value={draft.email} maxLength={254} onChange={e=>setDraft({...draft,email:e.target.value})} placeholder="Your dealership’s email address"/><small>Shown as a contact address. This does not configure outgoing email delivery.</small></label>
    <label>Dealership time zone<select value={draft.timezone} onChange={e=>setDraft({...draft,timezone:e.target.value})}>{zones.filter(Boolean).map(zone=><option key={zone}>{zone}</option>)}</select></label>
    <label>Reservation deposit · KSh<input type="number" min="0" max="10000000" step="1" value={draft.depositKES} onChange={e=>setDraft({...draft,depositKES:Number(e.target.value)})}/><small>Set to 0 to keep reservation payments disabled.</small></label>
  </div><button className="ad-primary" type="submit" disabled={busy}>{busy?<LoaderCircle className="ad-spin" size={16}/>:<Save size={16}/>} {busy?'Saving settings…':'Save dealership settings'}</button></form><aside className="ad-settings-aside"><div className="ad-panel ad-payment-readiness"><CreditCard/><span className="ad-kicker">RESERVATION PAYMENTS</span><h3>{settings.payments.enabled?'Ready for real inventory.':'Finish payment setup.'}</h3><span className={`ad-status ${settings.payments.enabled?'ad-status-available':'ad-status-draft'}`}>{settings.payments.enabled?'Provider configured':'Payments not active'}</span><p>{settings.payments.enabled?'Customers can continue to the payment provider for eligible real vehicles. Reservations are updated only after the server verifies the payment.':'Set a reservation deposit above KSh 0 and ask your developer to connect the dealership’s merchant credentials. Both are needed before customers can pay.'}</p><dl><div><dt>Provider</dt><dd>Flutterwave</dd></div><div><dt>Currency</dt><dd>KES</dd></div></dl><p className="ad-help">Sample vehicles cannot accept payments. Merchant credentials are kept on the server.</p></div><div className="ad-panel ad-security-note"><ShieldCheck/><h4>Staff access stays controlled.</h4><p>Only signed-in accounts on the dealership’s staff allowlist can access this workspace. Contact the site owner to add or remove authorised staff.</p></div></aside></div>;
}
