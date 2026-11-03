'use client';

import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowUpRight, Check, Clock3, LockKeyhole, RefreshCw, ShieldCheck, TriangleAlert } from 'lucide-react';
import { apiRequest, errorMessage } from '../lib/api';
import { formatPrice } from '../lib/catalog';
import './overlays.css';

type PaymentStatus = 'initiating' | 'pending' | 'paid' | 'review' | 'failed' | 'expired';
interface PaymentRecord { reference: string; status: PaymentStatus; amountKES: number; currency: 'KES'; message: string }
const pendingStatuses = new Set<PaymentStatus>(['initiating', 'pending']);
const validStatuses = new Set<PaymentStatus>(['initiating', 'pending', 'paid', 'review', 'failed', 'expired']);
const statusCopy: Record<PaymentStatus, { label: string; title: string; detail: string }> = {
  initiating: { label: 'CHECKING WITH THE PROVIDER', title: 'Your next chapter is in motion.', detail: 'Your checkout has been started. A payment is only confirmed after the server verifies it with Flutterwave.' },
  pending: { label: 'AWAITING VERIFICATION', title: 'We’re checking your deposit.', detail: 'The payment has not yet been verified. If you have completed checkout, allow a moment for the provider to confirm it.' },
  paid: { label: 'PAYMENT VERIFIED', title: 'Deposit received. Next stop, your drive.', detail: 'Your deposit has been verified with the payment provider. The dealership can follow up on the next steps for your reservation.' },
  review: { label: 'DEALERSHIP REVIEW REQUIRED', title: 'Your payment needs a closer look.', detail: 'The dealership needs to review this transaction before it can confirm the reservation. Keep the reference below and contact the team. Do not submit another payment while this is being reviewed.' },
  failed: { label: 'PAYMENT NOT CONFIRMED', title: 'Let’s get you back on the road.', detail: 'The server has not confirmed a successful deposit for this checkout. If money was deducted, contact the dealership with this reference before trying another payment.' },
  expired: { label: 'CHECKOUT EXPIRED', title: 'A fresh start is a click away.', detail: 'This checkout has expired. Your enquiry remains available to the dealership. Contact the team before starting a new reservation request.' },
};

/** A redirect is only a navigation event. All payment outcomes come from server verification. */
export function PaymentReturn() {
  const [reference, setReference] = useState('');
  const [transactionId, setTransactionId] = useState<string | undefined>();
  const [queryReady, setQueryReady] = useState(false);
  const [payment, setPayment] = useState<PaymentRecord | null>(null);
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(true);
  const [autoUpdating, setAutoUpdating] = useState(false);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    const query = new URLSearchParams(window.location.search);
    const value = query.get('reference') || '';
    if (/^velpay_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value)) {
      setReference(value);
      const transaction = query.get('transaction_id');
      if (transaction && /^[1-9][0-9]{0,24}$/.test(transaction)) setTransactionId(transaction);
    } else {
      setError('A valid payment reference was not included. Open the return link from your checkout or contact the dealership with your enquiry receipt.');
      setChecking(false);
    }
    setQueryReady(true);
  }, []);

  useEffect(() => {
    if (!queryReady || !reference) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let verifyError = '';
    setChecking(true); setAutoUpdating(false); setError('');

    async function readStatus(attempt = 0) {
      try {
        const latest = await apiRequest<PaymentRecord>(`/api/payments/status?reference=${encodeURIComponent(reference)}`, { signal: controller.signal });
        if (controller.signal.aborted) return;
        if (!validStatuses.has(latest.status) || latest.reference !== reference || latest.currency !== 'KES' || !Number.isFinite(latest.amountKES) || latest.amountKES <= 0) throw new Error('The payment record could not be read. Please check again.');
        setPayment(latest);
        setError(latest.status === 'paid' ? '' : verifyError);
        setChecking(false);
        if (pendingStatuses.has(latest.status) && attempt < 5) {
          setAutoUpdating(true);
          timer = setTimeout(() => { void readStatus(attempt + 1); }, 3000);
        } else setAutoUpdating(false);
      } catch (reason) {
        if (controller.signal.aborted) return;
        setError(errorMessage(reason)); setChecking(false); setAutoUpdating(false);
      }
    }

    async function verifyAndRead() {
      try {
        await apiRequest<unknown>('/api/payments/verify', {
          method: 'POST', signal: controller.signal,
          body: JSON.stringify({ reference, ...(transactionId ? { transactionId } : {}) }),
        });
      } catch (reason) {
        if (controller.signal.aborted) return;
        verifyError = `Verification could not be completed yet. ${errorMessage(reason)}`;
      }
      if (!controller.signal.aborted) await readStatus();
    }
    void verifyAndRead();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [reference, transactionId, queryReady, revision]);

  const copy = payment ? statusCopy[payment.status] : null;
  const paid = payment?.status === 'paid';
  const needsAttention = payment && ['review', 'failed', 'expired'].includes(payment.status);
  return <main className="payment-page">
    <header className="payment-page__header"><a className="payment-wordmark" href="/" aria-label="Velocity Motor Co. home">V<span>VELOCITY<small>MOTOR CO.</small></span></a><a className="payment-back" href="/"><ArrowLeft size={16}/>Back to the showroom</a></header>
    <section className={`payment-card${paid ? ' payment-card--paid' : ''}`} aria-labelledby="payment-heading">
      <div className="payment-icon" aria-hidden="true">{paid ? <Check size={29}/> : needsAttention ? <TriangleAlert size={29}/> : <Clock3 size={29}/>}</div>
      <span className="ov-eyebrow">{copy?.label || 'YOUR RESERVATION DEPOSIT'}</span>
      <h1 id="payment-heading">{copy?.title || (checking ? 'Let’s check your payment.' : 'Let’s find your payment reference.')}</h1>
      <p className="payment-description">{copy?.detail || (checking ? 'We are checking the payment record directly with the server. This may take a few moments.' : 'Every deposit has a unique reference so the dealership can help with your transaction.')}</p>
      {payment && <dl className="payment-summary"><div><dt>Deposit amount</dt><dd>{formatPrice(payment.amountKES)}</dd></div><div><dt>Reference</dt><dd className="payment-reference">{payment.reference}</dd></div><div><dt>Server status</dt><dd className="ov-capitalize">{payment.status}</dd></div></dl>}
      {!payment && reference && <p className="payment-reference payment-reference--standalone">{reference}</p>}
      {payment?.message && <p className="payment-server-message">{payment.message}</p>}
      {error && <p className="ov-form__error" role="alert">{error}</p>}
      {(checking || autoUpdating) && <p className="payment-checking" role="status"><span/>{checking ? 'Checking the latest server record…' : 'Waiting for confirmation. This page is checking for updates…'}</p>}
      {!checking && !autoUpdating && payment && pendingStatuses.has(payment.status) && <p className="ov-fine-print">Automatic checks have paused. You can check again below. Keep your checkout receipt if you need to contact the dealership.</p>}
      <div className="payment-actions">{reference && <button className="ov-primary" disabled={checking} onClick={() => { setTransactionId(undefined); setRevision(value => value + 1); }}><RefreshCw size={17}/>{checking ? 'Checking…' : 'Check payment again'}</button>}<a className="ov-secondary" href="/#collection">Back to the collection<ArrowUpRight size={17}/></a></div>
      <p className="payment-trust"><ShieldCheck size={17}/><span>Payment status is verified by the server. A return from checkout alone does not confirm a deposit or test-drive appointment.</span></p>
    </section>
    <footer className="payment-page__footer"><LockKeyhole size={14}/> Secure payment processing by Flutterwave. Vehicle enquiries are managed by the dealership.</footer>
  </main>;
}
