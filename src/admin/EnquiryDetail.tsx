'use client';

import { useState, type FormEvent } from 'react';
import { CalendarCheck2, CreditCard, LoaderCircle, Mail, Phone, Save } from 'lucide-react';
import { Modal } from '../components/Modal';
import { adminApi, describeError, displayDate, titleCase } from './api';
import type { AdminEnquiry, AdminVehicle, Appointment, AppointmentSlot, EnquiryStatus } from './types';

export function EnquiryDetail({ enquiry, vehicles, slots, appointments, timezone, onClose, onUpdated }: {
  enquiry: AdminEnquiry; vehicles: AdminVehicle[]; slots: AppointmentSlot[]; appointments: Appointment[];
  timezone: string; onClose: () => void; onUpdated: (message: string) => void;
}) {
  const [notes,setNotes]=useState(enquiry.notes || '');
  const [status,setStatus]=useState<EnquiryStatus>(enquiry.status);
  const [slotId,setSlotId]=useState(enquiry.slotId || '');
  const [busy,setBusy]=useState<'notes'|'appointment'|null>(null);
  const [error,setError]=useState('');
  const vehicle=vehicles.find(item=>item.id===enquiry.vehicleId);
  const booking=appointments.find(item=>item.enquiryId===enquiry.id&&item.status==='confirmed');
  const bookedSlots=new Set(appointments.filter(item=>item.status==='confirmed').map(item=>item.slotId));
  const availableSlots=slots.filter(slot=>slot.status==='open'&&new Date(slot.startsAt).getTime()>Date.now()&&!bookedSlots.has(slot.id));
  const requestedSlot=slots.find(item=>item.id===enquiry.slotId);
  const manualStatuses:EnquiryStatus[]=['new','contacted','closed'];

  async function saveNotes(event:FormEvent<HTMLFormElement>){
    event.preventDefault();setBusy('notes');setError('');
    try{await adminApi(`/api/admin/enquiries/${encodeURIComponent(enquiry.id)}`,{method:'PATCH',body:JSON.stringify({notes,version:enquiry.version,...(manualStatuses.includes(status)?{status}:{})})});onUpdated('Enquiry updated.');}
    catch(error){setError(describeError(error));}finally{setBusy(null);}
  }
  async function confirmAppointment(){
    if(!slotId||!availableSlots.some(slot=>slot.id===slotId)){setError('Choose a currently available test-drive slot.');return;}
    setBusy('appointment');setError('');
    try{await adminApi('/api/admin/appointments',{method:'POST',body:JSON.stringify({enquiryId:enquiry.id,slotId})});onUpdated('Test drive confirmed in the schedule. Contact the customer with the details.');}
    catch(error){setError(describeError(error));}finally{setBusy(null);}
  }

  return <Modal title={enquiry.reference} onClose={()=>{if(!busy)onClose();}} wide>
    <div className="ad-lead-detail"><div className="ad-lead-main">
      <div className="ad-lead-heading"><span className={`ad-status ad-status-${enquiry.status}`}>{titleCase(enquiry.status)}</span>{enquiry.isDemo&&<span className="ad-pill ad-pill-demo">Sample vehicle enquiry</span>}</div>
      <h3>{enquiry.name}</h3><p className="ad-muted">{titleCase(enquiry.requestType)} · Received {displayDate(enquiry.createdAt,timezone)}</p>
      <div className="ad-contact-links"><a href={`mailto:${enquiry.email}`}><Mail size={15}/>{enquiry.email}</a>{enquiry.phone&&<a href={`tel:${enquiry.phone.replace(/[^+\d]/g,'')}`}><Phone size={15}/>{enquiry.phone}</a>}</div>
      <div className="ad-lead-vehicle">{vehicle?.image&&<img src={vehicle.image} alt={vehicle.imageAlt}/>}<div><span>VEHICLE OF INTEREST</span><strong>{vehicle?`${vehicle.brand} ${vehicle.model}`:enquiry.vehicleLabel||'General dealership enquiry'}</strong>{vehicle&&<small>{vehicle.year} · {vehicle.stockNumber} · {titleCase(vehicle.status)}</small>}</div></div>
      <dl className="ad-request-facts"><div><dt>Preferred date</dt><dd>{displayDate(enquiry.preferredDate,timezone,false)}</dd></div><div><dt>Requested slot</dt><dd>{requestedSlot?displayDate(requestedSlot.startsAt,timezone):'No specific slot requested'}</dd></div></dl>
      <h4>Customer message</h4><p className="ad-customer-message">{enquiry.message||'The customer did not include an additional message.'}</p>
      {enquiry.payment&&<section className="ad-booking-panel" aria-label="Reservation payment"><h4 style={{display:'flex',alignItems:'center',gap:8}}><CreditCard size={16}/> Reservation payment</h4><dl className="ad-request-facts" style={{margin:'16px 0'}}><div><dt>Payment reference</dt><dd style={{overflowWrap:'anywhere'}}>{enquiry.payment.reference}</dd></div><div><dt>Provider status</dt><dd><span className={`ad-status ad-status-${enquiry.payment.status}`}>{titleCase(enquiry.payment.status)}</span></dd></div><div><dt>Amount</dt><dd>{enquiry.payment.currency} {new Intl.NumberFormat('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2}).format(enquiry.payment.amountKES)}</dd></div><div><dt>Verified</dt><dd>{enquiry.payment.verifiedAt?displayDate(enquiry.payment.verifiedAt,timezone):'Awaiting verification'}</dd></div><div><dt>Payment created</dt><dd>{displayDate(enquiry.payment.createdAt,timezone)}</dd></div></dl><p className="ad-help">Payment status follows the server’s provider checks. If this payment requires review, check its reference in your Flutterwave dashboard and record the follow-up in private notes. A private note does not change payment verification.</p></section>}
      <p className="ad-help">This request is stored in the dealership inbox. Use the contact details to follow up; saving a note or confirming a slot does not send an email or message.</p>
    </div><aside className="ad-lead-aside">
      {error&&<div className="ad-form-error" role="alert">{error}</div>}
      <form onSubmit={saveNotes}><h4>Keep the conversation moving.</h4><label>Enquiry status<select value={status} onChange={e=>setStatus(e.target.value as EnquiryStatus)} disabled={!!busy||!manualStatuses.includes(enquiry.status)}>{!manualStatuses.includes(enquiry.status)&&<option value={enquiry.status}>{titleCase(enquiry.status)} · managed automatically</option>}<option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select></label>{!manualStatuses.includes(enquiry.status)&&<p className="ad-help">This status follows the appointment or payment record. You can still update the private notes.</p>}<label>Private staff notes<textarea rows={5} maxLength={5000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Record the customer’s preferences and next steps."/></label><p className="ad-help">Only authorised staff can read these notes.</p><button className="ad-primary" disabled={!!busy}>{busy==='notes'?<LoaderCircle className="ad-spin" size={16}/>:<Save size={16}/>} Save update</button></form>
      {booking?<div className="ad-booking-confirmed"><CalendarCheck2/><h4>Test drive confirmed</h4><p>{displayDate(booking.startsAt,timezone)}</p><small>Manage cancellations in the Test drives tab.</small></div>:enquiry.requestType==='test-drive'&&enquiry.status!=='closed'&&<div className="ad-booking-panel"><h4>Confirm a test drive</h4><p>Choose an open slot. The server prevents two appointments from taking the same slot.</p><label>Available appointment<select value={slotId} onChange={e=>setSlotId(e.target.value)} disabled={!!busy}><option value="">Select a time</option>{availableSlots.map(slot=><option key={slot.id} value={slot.id}>{displayDate(slot.startsAt,timezone)}</option>)}</select></label>{availableSlots.length===0&&<p className="ad-help">Add an available slot in the Test drives tab first.</p>}<button type="button" className="ad-primary" disabled={!!busy||!availableSlots.some(slot=>slot.id===slotId)} onClick={confirmAppointment}>{busy==='appointment'?<LoaderCircle className="ad-spin" size={16}/>:<CalendarCheck2 size={16}/>} Confirm test drive</button></div>}
    </aside></div>
  </Modal>;
}
