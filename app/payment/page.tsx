import type { Metadata } from 'next';
import { PaymentReturn } from '../../src/components/PaymentReturn';

export const metadata: Metadata = { title: 'Your deposit — VELOCITY Motor Co.', robots: { index: false, follow: false } };
export default function PaymentPage() { return <PaymentReturn />; }
