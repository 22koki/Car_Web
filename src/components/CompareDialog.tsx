import { useRef, useState } from 'react';
import { ArrowUpRight, GitCompareArrows, X } from 'lucide-react';
import type { Vehicle } from '../types/dealership';
import { formatMileage, formatPrice } from '../lib/catalog';
import { Modal } from './Modal';
import './overlays.css';

interface CompareDialogProps {
  cars: Vehicle[];
  onClose: () => void;
  onRemove: (id: string) => void;
  onEnquire: (car: Vehicle) => void;
}

const rows: { label: string; value: (car: Vehicle) => string | number }[] = [
  { label: 'Asking price', value: (car) => formatPrice(car.price) },
  { label: 'Availability', value: (car) => car.status.charAt(0).toUpperCase() + car.status.slice(1) },
  { label: 'Condition', value: (car) => car.condition === 'new' ? 'New' : 'Pre-owned' },
  { label: 'Listing', value: (car) => car.isDemo ? 'Demo vehicle' : 'Dealer inventory' },
  { label: 'Stock number', value: (car) => car.stockNumber || 'On request' },
  { label: 'Model year', value: (car) => car.year },
  { label: 'Body type', value: (car) => car.bodyType },
  { label: 'Colour', value: (car) => car.color },
  { label: 'Mileage', value: (car) => formatMileage(car.mileage) },
  { label: 'Fuel', value: (car) => car.fuel },
  { label: 'Transmission', value: (car) => car.transmission },
  { label: 'Drive', value: (car) => car.drivetrain },
  { label: 'Power', value: (car) => `${car.power} PS` },
  { label: '0–100 km/h', value: (car) => car.acceleration === null ? 'Not published' : `${car.acceleration.toFixed(1)} s` },
  { label: 'Top speed', value: (car) => car.topSpeed === null ? 'Not published' : `${car.topSpeed} km/h` },
  { label: 'Engine / motor', value: (car) => car.engine },
  { label: 'Seats', value: (car) => car.seats },
];

export function CompareDialog({ cars, onClose, onRemove, onEnquire }: CompareDialogProps) {
  const selection = cars.slice(0, 3);
  const content = useRef<HTMLDivElement>(null);
  const [update, setUpdate] = useState('');
  function removeCar(car: Vehicle) {
    onRemove(car.id);
    setUpdate(`${car.brand} ${car.model} removed from comparison.`);
    window.requestAnimationFrame(() => content.current?.focus());
  }
  return (
    <Modal title="Good choices. Great decisions." onClose={onClose} wide>
      <div className="ov-compare" ref={content} tabIndex={-1}>
        <p className="ov-sr-only" role="status">{update}</p>
        {selection.length === 0 ? <div className="ov-empty"><GitCompareArrows size={42} /><h3>Your shortlist starts here.</h3><p>Select the compare icon on up to three cars to see their details side by side.</p><button className="ov-primary" onClick={onClose}>Explore the collection <ArrowUpRight size={18} /></button></div> : <><p className="ov-muted">{selection.length === 1 ? 'Add another car from the collection to compare it here.' : `Your ${selection.length} contenders, side by side.`} <span className="ov-scroll-hint">Swipe the table to see every car.</span></p><div className="ov-compare__scroll" tabIndex={0} role="region" aria-label="Scrollable vehicle comparison"><table><caption className="ov-sr-only">Vehicle comparison. Asking prices, availability and specifications.</caption><thead><tr><th scope="col" className="ov-compare__label"><span className="ov-eyebrow">THE DETAILS</span></th>{selection.map((car) => <th scope="col" key={car.id}><div className="ov-compare__car"><button className="ov-icon-button ov-compare__remove" onClick={() => removeCar(car)} aria-label={`Remove ${car.brand} ${car.model} from comparison`}><X size={16} /></button><img src={car.image} alt={car.imageAlt} /><span>{car.brand}</span><h3>{car.model}</h3></div></th>)}</tr></thead><tbody>{rows.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{selection.map((car) => <td key={car.id}>{row.value(car)}</td>)}</tr>)}<tr className="ov-compare__cta"><th scope="row"><span className="ov-sr-only">Enquire</span></th>{selection.map((car) => <td key={car.id}><button className="ov-primary" onClick={() => onEnquire(car)}>Enquire <ArrowUpRight size={17} /></button></td>)}</tr></tbody></table></div><p className="ov-fine-print">{selection.some(car => car.isDemo) ? 'Demo listings show sample prices and reference photography. ' : ''}Model specifications vary by year, market and options. Confirm the exact vehicle, asking price and availability with the dealership.</p></>}
      </div>
    </Modal>
  );
}
