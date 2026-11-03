import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { ArrowUpRight, Check, Download, FileText } from 'lucide-react';
import type { Car } from '../data/cars';
import { formatPrice } from '../lib/catalog';
import { Modal } from './Modal';
import './overlays.css';

function localDateString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
}

export function EnquiryDialog({ car, onClose }: { car?: Car; onClose: () => void }) {
  const prefix = useId();
  const [draft, setDraft] = useState('');
  const [error, setError] = useState('');
  const [requestType, setRequestType] = useState('Test drive');
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const nameInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (draft) confirmationHeading.current?.focus();
  }, [draft]);

  function prepareEnquiry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    if (!form.reportValidity()) return;
    const values = new FormData(form);
    const name = String(values.get('name') ?? '').trim();
    const email = String(values.get('email') ?? '').trim();
    const phone = String(values.get('phone') ?? '').trim();
    const date = String(values.get('date') ?? '');
    const message = String(values.get('message') ?? '').trim();
    if (name.length < 2) { setError('Please enter your name using at least two characters.'); return; }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError('Please enter a valid email address.'); return; }
    if (phone && (!/^[+\d\s().-]{7,25}$/.test(phone) || phone.replace(/\D/g, '').length < 7)) { setError('Enter a phone number with at least seven digits, or leave it blank.'); return; }
    if (date && (date < localDateString() || !/^\d{4}-\d{2}-\d{2}$/.test(date))) { setError('Please choose today or a future date.'); return; }
    setError('');
    setDraft([
      'VELOCITY MOTOR CO. — ENQUIRY DRAFT',
      '',
      'This draft has not been sent. Share it with your chosen dealer.',
      '',
      `Request: ${requestType}`,
      `Vehicle: ${car ? `${car.year} ${car.brand} ${car.model}` : 'Help me find my next car'}`,
      ...(car ? [`Illustrative asking price: ${formatPrice(car.price)}`] : []),
      `Name: ${name}`,
      `Email: ${email}`,
      ...(phone ? [`Phone: ${phone}`] : []),
      ...(date ? [`Preferred date (not booked): ${date}`] : []),
      ...(message ? ['', 'Message:', message] : []),
      '',
      'Prepared in the VELOCITY demo showroom. No booking, reservation or purchase has been made.',
    ].join('\n'));
  }

  function downloadEnquiry() {
    const url = URL.createObjectURL(new Blob([draft], { type: 'text/plain;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `velocity-enquiry-${car?.id ?? 'collection'}.txt`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <Modal title={draft ? 'Your next chapter, prepared.' : 'Let’s put you in the driver’s seat.'} onClose={onClose}>
      <div className="ov-enquiry">
        {draft ? <div className="ov-enquiry__success"><div className="ov-success-icon"><Check size={29} /></div><h3 ref={confirmationHeading} tabIndex={-1}>Enquiry prepared.</h3><p className="ov-muted">Download and share with your dealer. This demo does not send or book requests.</p><pre className="ov-draft">{draft}</pre><button className="ov-primary" onClick={downloadEnquiry}><Download size={18} />Download enquiry</button><button className="ov-text-button" onClick={() => { setDraft(''); window.requestAnimationFrame(() => nameInput.current?.focus()); }}>Create another enquiry</button><p className="ov-fine-print">Your contact details are held only in this open dialog. They are not saved to browser storage or sent to a server.</p></div> : <>
          {car && <div className="ov-enquiry__car"><img src={car.image} alt={car.imageAlt} /><div><span className="ov-eyebrow">{car.year} / {car.brand}</span><h3>{car.model}</h3><p>{formatPrice(car.price)} <small>· demo price</small></p></div></div>}
          <div className="ov-enquiry__notice"><FileText size={19} /><p>Prepare an enquiry to download and share. No request is sent and no test drive is booked in this demo.</p></div>
          <form className="ov-form" onSubmit={prepareEnquiry}>
            <fieldset className="ov-request-types"><legend>I’m interested in</legend>{['Test drive', 'More details', 'Finding a car'].map((type) => <label key={type} className={requestType === type ? 'is-selected' : ''}><input type="radio" name="requestType" value={type} checked={requestType === type} onChange={() => setRequestType(type)} /><span>{type}</span></label>)}</fieldset>
            <label htmlFor={`${prefix}-name`}>Your name <span aria-hidden="true">*</span><input ref={nameInput} id={`${prefix}-name`} name="name" autoComplete="name" placeholder="First and last name" required minLength={2} maxLength={80} /></label>
            <label htmlFor={`${prefix}-email`}>Email address <span aria-hidden="true">*</span><input id={`${prefix}-email`} name="email" type="email" autoComplete="email" placeholder="you@example.com" required maxLength={254} /></label>
            <div className="ov-form__row"><label htmlFor={`${prefix}-phone`}>Phone <small>optional</small><input id={`${prefix}-phone`} name="phone" type="tel" autoComplete="tel" placeholder="+254 …" maxLength={25} /></label><label htmlFor={`${prefix}-date`}>Preferred date <small>optional</small><input id={`${prefix}-date`} name="date" type="date" min={localDateString()} /></label></div>
            <label htmlFor={`${prefix}-message`}>Anything we should know? <small>optional</small><textarea id={`${prefix}-message`} name="message" rows={3} placeholder="Your ideal car, budget, or a question about this model…" maxLength={1000} /></label>
            {error && <p className="ov-form__error" role="alert">{error}</p>}
            <p className="ov-fine-print">Required fields are marked *. Your details stay in this dialog until you download the draft. Closing it clears them.</p>
            <button className="ov-primary" type="submit">Prepare my enquiry <ArrowUpRight size={19} /></button>
          </form>
        </>}
      </div>
    </Modal>
  );
}
