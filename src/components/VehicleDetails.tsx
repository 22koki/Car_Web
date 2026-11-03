import { useState } from 'react';
import { ArrowUpRight, Check, ChevronLeft, ChevronRight, Gauge, GitCompareArrows, Heart, Settings2, Zap } from 'lucide-react';
import type { Vehicle } from '../types/dealership';
import { formatMileage, formatPrice } from '../lib/catalog';
import { FinanceCalculator } from './FinanceCalculator';
import { Modal } from './Modal';
import './overlays.css';

interface VehicleDetailsProps {
  car: Vehicle;
  onClose: () => void;
  onEnquire: (car: Vehicle) => void;
  onToggleSave: (id: string) => void;
  isSaved: boolean;
  onToggleCompare: (id: string) => void;
  isCompared: boolean;
  compareLimitReached?: boolean;
}

export function VehicleDetails({ car, onClose, onEnquire, onToggleSave, isSaved, onToggleCompare, isCompared, compareLimitReached = false }: VehicleDetailsProps) {
  const photos = [...new Set([car.image, ...car.gallery])];
  const [photo, setPhoto] = useState(0);
  const currentPhoto = photos[photo] ?? car.image;
  const nextPhoto = (direction: number) => setPhoto((index) => (index + direction + photos.length) % photos.length);

  return (
    <Modal title={`${car.brand} ${car.model}`} onClose={onClose} wide>
      <div className="ov-vehicle">
        <div className="ov-gallery">
          <img src={currentPhoto} alt={photo === 0 ? car.imageAlt : `${car.brand} ${car.model} — gallery photo ${photo + 1}`} className="ov-gallery__main" />
          <div className="ov-gallery__top"><span className="ov-tag">{car.year} / {car.bodyType}</span><button className={`ov-icon-button${isSaved ? ' is-active' : ''}`} onClick={() => onToggleSave(car.id)} aria-label={isSaved ? 'Remove from saved cars' : 'Save car'} aria-pressed={isSaved}><Heart size={20} fill={isSaved ? 'currentColor' : 'none'} /></button></div>
          {photos.length > 1 && <><div className="ov-gallery__arrows"><button className="ov-icon-button" onClick={() => nextPhoto(-1)} aria-label="Previous vehicle photo"><ChevronLeft /></button><span>{String(photo + 1).padStart(2, '0')} / {String(photos.length).padStart(2, '0')}</span><button className="ov-icon-button" onClick={() => nextPhoto(1)} aria-label="Next vehicle photo"><ChevronRight /></button></div><div className="ov-thumbnails" aria-label="Vehicle photos">{photos.map((src, index) => <button key={src} className={photo === index ? 'is-active' : ''} onClick={() => setPhoto(index)} aria-label={`Show photo ${index + 1}`} aria-pressed={photo === index}><img src={src} alt="" loading="lazy" /></button>)}</div></>}
        </div>
        {car.imageNote && <p className="ov-fine-print ov-gallery-note">{car.imageNote}</p>}
        <div className="ov-vehicle__body">
          <div className="ov-vehicle__story">
            <div className="ov-price-heading"><div><span className="ov-eyebrow">{car.isDemo ? 'SAMPLE ASKING PRICE / DEMO' : 'THE ASKING PRICE'}</span><h3>{formatPrice(car.price)}</h3></div><span className="ov-color"><i style={{ background: car.colorHex }} />{car.color}</span></div>
            <div className="ov-stock-line"><span className={`vehicle-stock-status vehicle-stock-status--${car.status}`}>{car.status}</span><span>{car.condition === 'new' ? 'New vehicle' : 'Pre-owned'}</span>{car.isDemo && <span className="ov-demo-tag">Demo vehicle</span>}</div><p className="ov-vehicle__tagline">{car.tagline}</p><p className="ov-muted ov-description">{car.description}</p>
            <div className="ov-performance"><div><Zap size={18} /><strong>{car.power}<small> PS</small></strong><span>Power</span></div><div><Gauge size={18} /><strong>{car.acceleration === null ? '—' : car.acceleration.toFixed(1)}<small>{car.acceleration === null ? '' : ' s'}</small></strong><span>{car.acceleration === null ? '0–100 not published' : '0–100 km/h'}</span></div><div><Settings2 size={18} /><strong>{car.topSpeed ?? '—'}<small>{car.topSpeed === null ? '' : ' km/h'}</small></strong><span>{car.topSpeed === null ? 'Top speed not published' : 'Top speed'}</span></div></div>
            {car.powerNote && <p className="ov-fine-print">{car.powerNote}. Acceleration figures use Launch Control where applicable.</p>}
            <h4 className="ov-subheading">Every detail matters.</h4>
            <dl className="ov-specs"><div><dt>Stock number</dt><dd>{car.stockNumber || 'On request'}</dd></div><div><dt>Availability</dt><dd className="ov-capitalize">{car.status}</dd></div><div><dt>Model year</dt><dd>{car.year}</dd></div><div><dt>Body type</dt><dd>{car.bodyType}</dd></div><div><dt>Mileage</dt><dd>{formatMileage(car.mileage)}</dd></div><div><dt>Transmission</dt><dd>{car.transmission}</dd></div><div><dt>Fuel</dt><dd>{car.fuel}</dd></div><div><dt>Drive</dt><dd>{car.drivetrain}</dd></div><div><dt>Engine / motor</dt><dd>{car.engine}</dd></div><div><dt>Seats</dt><dd>{car.seats}</dd></div></dl>
            <h4 className="ov-subheading">The highlights.</h4><ul className="ov-features">{car.features.map((feature) => <li key={feature}><Check size={16} /><span>{feature}</span></li>)}</ul>
            <p className="ov-fine-print ov-demo-notice">{car.isDemo ? 'Illustrative showroom listing. Price, mileage, colour and availability are sample data. Photography shows the model, not a vehicle offered for sale.' : 'Listing details are supplied by the dealership. Confirm the exact specification, final price and current availability before purchase.'}</p>
          </div>
          <aside className="ov-vehicle__aside"><div className="ov-vehicle__actions"><button className="ov-primary" onClick={() => onEnquire(car)}>{car.status === 'available' ? 'Arrange your next move' : 'Ask for more details'} <ArrowUpRight size={19} /></button><button className="ov-secondary" onClick={() => onToggleCompare(car.id)} aria-pressed={isCompared} disabled={compareLimitReached && !isCompared}><GitCompareArrows size={18} />{isCompared ? 'Remove from comparison' : 'Add to comparison'}</button>{compareLimitReached && !isCompared && <p className="ov-fine-print">Your comparison already has three cars. Remove one from your shortlist to add this vehicle.</p>}</div><FinanceCalculator price={car.price} /></aside>
        </div>
      </div>
    </Modal>
  );
}
