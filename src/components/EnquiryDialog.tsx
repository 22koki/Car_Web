'use client';

import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, CalendarDays, Check, Download, FileText, LockKeyhole, RefreshCw } from 'lucide-react';
import type { AppointmentSlot, DealerConfig, EnquiryReceipt, Vehicle } from '../types/dealership';
import { ApiError, apiRequest, errorMessage, safeCheckoutUrl } from '../lib/api';
import { formatPrice } from '../lib/catalog';
import { Modal } from './Modal';
import './overlays.css';

type RequestType = 'test-drive' | 'details' | 'reservation';
type Submission = {
  vehicleId?: string; name: string; email: string; phone?: string;
  requestType: RequestType; slotId?: string; preferredDate?: string;
  message?: string; consent: true; website: string; idempotencyKey: string;
};
const requestLabels: Record<RequestType, string> = { 'test-drive': 'Test drive', details: 'More details', reservation: 'Reserve this car' };

function localDateString(timezone = 'Africa/Nairobi', daysAhead = 0) {
  const date = new Date(Date.now() + daysAhead * 86400000);
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const value = (kind: string) => parts.find(part => part.type === kind)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
function slotLabel(slot: AppointmentSlot, timezone = 'Africa/Nairobi') {
  try { return new Intl.DateTimeFormat('en-KE', { timeZone: timezone, weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(slot.startsAt)); }
  catch { return new Intl.DateTimeFormat('en-KE', { timeZone: 'Africa/Nairobi', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(slot.startsAt)); }
}

export function EnquiryDialog({ car, onClose, onAvailabilityChanged }: { car?: Vehicle; onClose: () => void; onAvailabilityChanged?: () => void }) {
  const prefix = useId();
  const [receipt, setReceipt] = useState<EnquiryReceipt | null>(null);
  const [receiptText, setReceiptText] = useState('');
  const [error, setError] = useState('');
  const [requestType, setRequestType] = useState<RequestType>(car && car.status === 'available' ? 'test-drive' : 'details');
  const [config, setConfig] = useState<DealerConfig | null>(null);
  const [configError, setConfigError] = useState(false);
  const [availabilityChanged, setAvailabilityChanged] = useState(false);
  const [alreadyRecorded, setAlreadyRecorded] = useState(false);
  const [slots, setSlots] = useState<AppointmentSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [slotsError, setSlotsError] = useState('');
  const [selectedSlot, setSelectedSlot] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [pendingRetry, setPendingRetry] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [slotRevision, setSlotRevision] = useState(0);
  const pending = useRef<Submission | null>(null);
  const inFlight = useRef(false);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);
  const canRequestDrive = !availabilityChanged && (!car || car.status === 'available');
  const canRequestReservation = Boolean(!availabilityChanged && car && car.status === 'available');
  const timezone = config?.dealer.timezone || 'Africa/Nairobi';
  const canPay = Boolean(receipt && !receipt.isDemo && car && !car.isDemo && canRequestReservation && config?.payments.enabled && config.payments.depositKES > 0 && config.payments.depositKES <= car.price && ['new', 'contacted'].includes(receipt.status) && requestType === 'reservation');

  useEffect(() => {
    const controller = new AbortController();
    apiRequest<DealerConfig>('/api/config', { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setConfig(data); })
      .catch(() => { if (!controller.signal.aborted) setConfigError(true); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setSlotsLoading(true); setSlotsError('');
    apiRequest<{ slots: AppointmentSlot[] }>('/api/slots', { signal: controller.signal })
      .then(data => { if (!controller.signal.aborted) setSlots(data.slots.filter(slot => slot.status === 'open' && Date.parse(slot.startsAt) > Date.now())); })
      .catch(reason => { if (!controller.signal.aborted) setSlotsError(errorMessage(reason)); })
      .finally(() => { if (!controller.signal.aborted) setSlotsLoading(false); });
    return () => controller.abort();
  }, [slotRevision]);
  useEffect(() => { if (receipt) confirmationHeading.current?.focus(); }, [receipt]);

  async function submitEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || alreadyRecorded) return;
    const form = event.currentTarget;
    if (!pending.current) {
      if (!form.reportValidity()) return;
      const values = new FormData(form);
      const name = String(values.get('name') ?? '').trim();
      const email = String(values.get('email') ?? '').trim();
      const phone = String(values.get('phone') ?? '').trim();
      const date = String(values.get('date') ?? '');
      const message = String(values.get('message') ?? '').trim();
      if (name.length < 2) { setError('Please enter your name using at least two characters.'); return; }
      if (phone && (!/^\+?[\d ()-]{7,32}$/.test(phone) || phone.replace(/\D/g, '').length < 7)) { setError('Enter a phone number with at least seven digits, or leave it blank.'); return; }
      if (date && (date < localDateString(timezone) || date > localDateString(timezone, 366) || !/^\d{4}-\d{2}-\d{2}$/.test(date))) { setError('Please choose today or a date within the next year in the dealership timezone.'); return; }
      if (values.get('consent') !== 'on') { setError('Please agree to share your enquiry details with the dealership.'); return; }
      pending.current = {
        ...(car ? { vehicleId: car.id } : {}), name, email, ...(phone ? { phone } : {}), requestType,
        ...(requestType === 'test-drive' && selectedSlot ? { slotId: selectedSlot } : {}),
        ...(requestType === 'test-drive' && !selectedSlot && date ? { preferredDate: date } : {}),
        ...(message ? { message } : {}), consent: true, website: String(values.get('website') ?? ''), idempotencyKey: crypto.randomUUID(),
      };
    }
    inFlight.current = true; setSubmitting(true); setError(''); setPendingRetry(true);
    try {
      const submitted = pending.current;
      const result = await apiRequest<EnquiryReceipt>('/api/enquiries', { method: 'POST', body: JSON.stringify(submitted) });
      const slot = slots.find(item => item.id === submitted.slotId);
      setReceiptText([
        `${config?.dealer.name || 'VELOCITY MOTOR CO.'} — ENQUIRY RECEIPT`, '',
        `Reference: ${result.reference}`, `Status: ${result.status}`, `Request: ${requestLabels[submitted.requestType]}`,
        `Vehicle: ${car ? `${car.year} ${car.brand} ${car.model}` : 'Help me find my next car'}`,
        ...(car ? [`${car.isDemo ? 'Sample' : 'Listed'} asking price: ${formatPrice(car.price)}`] : []),
        `Name: ${submitted.name}`, `Email: ${submitted.email}`, ...(submitted.phone ? [`Phone: ${submitted.phone}`] : []),
        ...(slot ? [`Requested slot: ${slotLabel(slot, timezone)} (${timezone})`] : []),
        ...(submitted.preferredDate ? [`Preferred date: ${submitted.preferredDate}`] : []),
        ...(submitted.message ? ['', 'Message:', submitted.message] : []), '',
        result.isDemo ? 'This is an enquiry about a demonstration vehicle. No car is offered for sale by this sample listing.' : 'Your enquiry has been saved in the dealership inbox.',
        'A test-drive request is not a confirmed appointment. The dealership must confirm the slot.',
        'An enquiry or reservation request is not a payment confirmation.',
      ].join('\n'));
      setReceipt(result); setPendingRetry(false); pending.current = null;
    } catch (reason) {
      setError(errorMessage(reason));
      if (reason instanceof ApiError) {
        if (reason.code === 'receipt_key_rotated') setAlreadyRecorded(true);
        else if ([400, 404, 409, 422].includes(reason.status)) { pending.current = null; setPendingRetry(false); }
        if (['slot_unavailable', 'availability_changed'].includes(reason.code || '')) { setSelectedSlot(''); setSlotRevision(value => value + 1); }
        if (['vehicle_unavailable', 'vehicle_not_found'].includes(reason.code || '')) { setAvailabilityChanged(true); setRequestType('details'); setSelectedSlot(''); onAvailabilityChanged?.(); }
      }
    } finally { inFlight.current = false; setSubmitting(false); }
  }

  async function checkout() {
    if (!receipt || checkingOut || !canPay) return;
    setCheckingOut(true); setError('');
    try {
      const result = await apiRequest<{ checkoutUrl: string; reference: string }>('/api/checkout', { method: 'POST', body: JSON.stringify({ enquiryId: receipt.id, receiptToken: receipt.receiptToken }) });
      window.location.assign(safeCheckoutUrl(result.checkoutUrl));
    } catch (reason) { setError(errorMessage(reason)); setCheckingOut(false); }
  }

  function downloadReceipt() {
    const url = URL.createObjectURL(new Blob([receiptText], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `velocity-enquiry-${receipt?.reference || 'receipt'}.txt`;
    document.body.appendChild(anchor); anchor.click(); anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <Modal title={receipt ? 'Your next chapter has a reference.' : 'Let’s put you in the driver’s seat.'} onClose={onClose}>
    <div className="ov-enquiry">
      {receipt ? <div className="ov-enquiry__success">
        <div className="ov-success-icon"><Check size={29}/></div><h3 ref={confirmationHeading} tabIndex={-1}>Enquiry received.</h3>
        <p className="ov-muted">Your enquiry is in the dealership inbox. Keep reference <strong className="ov-reference">{receipt.reference}</strong> for follow-up.</p>
        {receipt.isDemo && <div className="ov-enquiry__notice"><FileText size={19}/><p>This request is recorded as a demo enquiry. Sample vehicles cannot be purchased or paid for.</p></div>}
        <p className="ov-fine-print">{receipt.message || 'A team member will review your request. A preferred test-drive time is not booked until the dealership confirms it.'}</p>
        {canPay && <div className="ov-checkout-panel"><LockKeyhole size={22}/><h4>Ready to request a reservation?</h4><p>A reservation deposit is {formatPrice(config!.payments.depositKES)}. Continue to Flutterwave to review and pay. Stock and payment are checked by the server before a reservation is confirmed.</p><button className="ov-primary" onClick={checkout} disabled={checkingOut}>{checkingOut ? 'Opening secure checkout…' : `Continue to pay ${formatPrice(config!.payments.depositKES)}`}<ArrowUpRight size={18}/></button></div>}
        {!receipt.isDemo && requestType === 'reservation' && !canPay && <p className="ov-fine-print">{configError ? 'Online deposit details could not be loaded.' : 'Online deposits are not available for this request.'} Your reservation enquiry is saved. Contact the dealership to discuss the next step.</p>}
        {error && <p className="ov-form__error" role="alert">{error}</p>}
        <pre className="ov-draft">{receiptText}</pre><button className="ov-secondary" onClick={downloadReceipt}><Download size={18}/>Download enquiry receipt</button>
        {config?.dealer.phone && <a className="ov-text-button" href={`tel:${config.dealer.phone.replace(/[^+\d]/g,'')}`}>Call {config.dealer.phone}</a>}
        {config?.dealer.email && <a className="ov-text-button" href={`mailto:${config.dealer.email}?subject=${encodeURIComponent(`Enquiry ${receipt.reference}`)}`}>Email the dealership</a>}
        <button className="ov-text-button" onClick={() => { setReceipt(null); setReceiptText(''); setError(''); setSelectedSlot(''); setAlreadyRecorded(false); setRequestType(canRequestDrive && car ? 'test-drive' : 'details'); window.requestAnimationFrame(() => nameInput.current?.focus()); }}>Start a new enquiry</button>
      </div> : <>
        {car && <div className="ov-enquiry__car"><img src={car.image} alt={car.imageAlt}/><div><span className="ov-eyebrow">{car.year} / {car.brand}</span><h3>{car.model}</h3><p>{formatPrice(car.price)} <small>· {car.isDemo ? 'demo vehicle' : availabilityChanged ? 'availability changed' : car.status}</small></p></div></div>}
        <div className="ov-enquiry__notice"><FileText size={19}/><p>{car?.isDemo ? 'This is a sample listing. You can submit a demo enquiry to try the workflow; it does not reserve or purchase a real car.' : 'Send your details directly to the dealership inbox. Test drives are requests until a team member confirms an available appointment.'}</p></div>
        <form className="ov-form" onSubmit={submitEnquiry}>
          <fieldset className="ov-form-fields" disabled={submitting || pendingRetry}>
            <fieldset className="ov-request-types"><legend>I’m interested in</legend>{(['details', ...(canRequestDrive ? ['test-drive'] : []), ...(canRequestReservation ? ['reservation'] : [])] as RequestType[]).map(type => <label key={type} className={requestType === type ? 'is-selected' : ''}><input type="radio" name="requestType" value={type} checked={requestType === type} onChange={() => { setRequestType(type); setSelectedSlot(''); }}/><span>{requestLabels[type]}</span></label>)}</fieldset>
            <label htmlFor={`${prefix}-name`}>Your name <span aria-hidden="true">*</span><input ref={nameInput} id={`${prefix}-name`} name="name" autoComplete="name" placeholder="First and last name" required minLength={2} maxLength={100}/></label>
            <label htmlFor={`${prefix}-email`}>Email address <span aria-hidden="true">*</span><input id={`${prefix}-email`} name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254}/></label>
            <label htmlFor={`${prefix}-phone`}>Phone <small>optional</small><input id={`${prefix}-phone`} name="phone" type="tel" autoComplete="tel" placeholder="+254 …" maxLength={32}/></label>
            {requestType === 'test-drive' && <div className="ov-slot-picker"><span className="ov-slot-heading"><CalendarDays size={16}/>PREFERRED TEST DRIVE</span>{slotsLoading ? <p className="ov-fine-print" role="status">Checking available times…</p> : slotsError ? <div><p className="ov-fine-print">Available times could not be loaded. You can still request a preferred date.</p><button type="button" className="ov-text-button" onClick={() => setSlotRevision(value => value + 1)}><RefreshCw size={12}/>Reload times</button></div> : slots.length > 0 ? <label htmlFor={`${prefix}-slot`}>Available times <small>{timezone}</small><select id={`${prefix}-slot`} value={selectedSlot} onChange={event => setSelectedSlot(event.target.value)}><option value="">Let the dealership arrange a time</option>{slots.map(slot => <option key={slot.id} value={slot.id}>{slotLabel(slot, timezone)}</option>)}</select></label> : <p className="ov-fine-print">No test-drive slots are published yet. Suggest a date and the dealership can arrange it with you.</p>}{!selectedSlot && <label htmlFor={`${prefix}-date`}>Preferred date <small>optional</small><input id={`${prefix}-date`} name="date" type="date" min={localDateString(timezone)} max={localDateString(timezone, 366)}/></label>}<p className="ov-fine-print">Selecting a time requests it. Your appointment is confirmed separately by the dealership.</p></div>}
            <label htmlFor={`${prefix}-message`}>Anything we should know? <small>optional</small><textarea id={`${prefix}-message`} name="message" rows={3} placeholder="Your ideal car, budget, or a question about this model…" maxLength={2000}/></label>
            <label className="ov-honeypot" aria-hidden="true">Website<input name="website" type="text" tabIndex={-1} autoComplete="off"/></label>
            <label className="ov-consent" htmlFor={`${prefix}-consent`}><input id={`${prefix}-consent`} name="consent" type="checkbox" required/><span>I agree to share these details with the dealership so it can respond to my enquiry. <span aria-hidden="true">*</span></span></label>
          </fieldset>
          {error && <p className="ov-form__error" role="alert">{error}</p>}
          {pendingRetry && !submitting && !alreadyRecorded && <p className="ov-fine-print">Your details are kept ready for a safe retry. Retry sends the same request reference and will not create a second enquiry.</p>}
          <p className="ov-fine-print">Required fields are marked *. Submitted contact details and messages are stored for authorised dealership staff. No payment is taken by this form.</p>
          <button className="ov-primary" type="submit" disabled={submitting || alreadyRecorded || config?.enquiriesEnabled === false}>{alreadyRecorded ? 'Enquiry already received' : submitting ? 'Sending your enquiry…' : pendingRetry ? 'Retry the same enquiry' : 'Send my enquiry'}<ArrowUpRight size={19}/></button>
          {config?.enquiriesEnabled === false && <p className="ov-form__error" role="alert">Online enquiries are currently paused. Please contact the dealership.</p>}
        </form>
      </>}
    </div>
  </Modal>;
}
