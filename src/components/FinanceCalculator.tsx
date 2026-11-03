import { useId, useState } from 'react';
import { ArrowUpRight, Calculator } from 'lucide-react';
import { calculateFinance, formatPrice } from '../lib/catalog';
import './overlays.css';

export function FinanceCalculator({ price }: { price: number }) {
  const [deposit, setDeposit] = useState(30);
  const [months, setMonths] = useState(48);
  const [rate, setRate] = useState(14);
  const prefix = useId();
  const estimate = calculateFinance(price, deposit, rate, months);

  return (
    <section className="ov-finance" aria-labelledby={`${prefix}-title`}>
      <div className="ov-section-label"><Calculator size={17} /><h3 id={`${prefix}-title`}>Make the numbers work.</h3><ArrowUpRight size={18} /></div>
      <p className="ov-muted">Explore an illustrative repayment plan.</p>
      <div className="ov-finance__payment"><span>{formatPrice(estimate.payment)}</span><small>/ month</small></div>
      <div className="ov-range-label"><label htmlFor={`${prefix}-deposit`}>Your deposit</label><strong>{deposit}% · {formatPrice(estimate.deposit)}</strong></div>
      <input id={`${prefix}-deposit`} type="range" min="10" max="80" step="5" value={deposit} onChange={(event) => setDeposit(Number(event.target.value))} aria-valuetext={`${deposit} percent, ${formatPrice(estimate.deposit)}`} />
      <div className="ov-finance__controls">
        <label htmlFor={`${prefix}-term`}>Loan term<select id={`${prefix}-term`} value={months} onChange={(event) => setMonths(Number(event.target.value))}>{[12, 24, 36, 48, 60, 72].map((term) => <option key={term} value={term}>{term} months</option>)}</select></label>
        <label htmlFor={`${prefix}-rate`}>Annual interest (%)<input id={`${prefix}-rate`} type="number" min="0" max="30" step="0.1" value={rate} onChange={(event) => setRate(Math.min(30, Math.max(0, Number(event.target.value) || 0)))} /></label>
      </div>
      <dl className="ov-finance__breakdown"><div><dt>Amount financed</dt><dd>{formatPrice(estimate.loan)}</dd></div><div><dt>Total interest</dt><dd>{formatPrice(estimate.totalInterest)}</dd></div><div><dt>Total incl. deposit</dt><dd>{formatPrice(estimate.totalPayable)}</dd></div></dl>
      <p className="ov-fine-print">Estimate only, using a fixed annual rate and monthly repayments. Excludes fees, insurance and taxes. No finance offer or approval is implied.</p>
    </section>
  );
}
