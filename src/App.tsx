'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, PointerEvent } from 'react';
import { ArrowDown, ArrowDownUp, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, Gauge, Heart, Menu, Moon, Mountain, Pause, Play, Plus, Search, SlidersHorizontal, Sparkles, Sun, X, Zap } from 'lucide-react';
import { cars as editorialCars, fuelTypes } from './data/cars';
import type { Car } from './data/cars';
import { filterCars, formatMileage, formatPrice } from './lib/catalog';
import type { CatalogFilters } from './lib/catalog';
import { VehicleDetails } from './components/VehicleDetails';
import { CompareDialog } from './components/CompareDialog';
import { EnquiryDialog } from './components/EnquiryDialog';
import { Modal } from './components/Modal';
import { useInventory } from './lib/useInventory';
import { ThemeToggle } from './components/ThemeToggle';
import type { Vehicle } from './types/dealership';

const initialFilters: CatalogFilters = { query: '', brand: 'all', bodyType: 'all', fuel: 'all', maxPrice: 40000000, sort: 'featured', savedOnly: false };
const editorialHeroCars = [editorialCars[0], editorialCars[1], editorialCars[3]];
const localKey = 'velocity.saved.v1';
const driveMoods = [
  { id: 'all', label: 'Every drive', bodyType: 'all', fuel: 'all', icon: Sparkles },
  { id: 'performance', label: 'Performance', bodyType: 'Coupe', fuel: 'all', icon: Gauge },
  { id: 'escape', label: 'The great escape', bodyType: 'SUV', fuel: 'all', icon: Mountain },
  { id: 'electric', label: 'Electric energy', bodyType: 'all', fuel: 'Electric', icon: Zap },
] as const;
type DriveMood = typeof driveMoods[number]['id'];

function readSaved(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(localKey) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 120))] : [];
  } catch { return []; }
}

function Wordmark({ large = false }: { large?: boolean }) {
  return <span className={`wordmark ${large ? 'wordmark-large' : ''}`}><svg viewBox="0 0 36 30" fill="none" aria-hidden="true"><path d="M2 3h8l8 17L26 3h8L19.5 29h-4L2 3Z" fill="currentColor"/><path d="m0 20 5 9h7l-5-9H0Z" fill="currentColor"/></svg><span>VELOCITY<small>MOTOR CO.</small></span></span>;
}

function App() {
  const { vehicles, mode, loading: inventoryLoading, error: inventoryError, reload: reloadInventory } = useInventory();
  const brands = useMemo(() => [...new Set(vehicles.map(car => car.brand))].sort(), [vehicles]);
  const [filters, setFilters] = useState<CatalogFilters>(initialFilters);
  const [saved, setSaved] = useState<string[]>([]);
  const [savedReady, setSavedReady] = useState(false);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Vehicle | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [enquiry, setEnquiry] = useState<Vehicle | 'general' | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPreviewId, setHeroPreviewId] = useState<string | null>(null);
  const [driveMood, setDriveMood] = useState<DriveMood | null>('all');
  const [toast, setToast] = useState('');
  const [reducedMotion, setReducedMotion] = useState(false);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const collectionRef = useRef<HTMLElement>(null);
  const heroCars = useMemo(() => {
    const picks = vehicles.filter(car => car.status === 'available').sort((a,b) => Number(b.featured) - Number(a.featured));
    const spotlight = picks.find(car => car.id === heroPreviewId) ?? picks[0];
    const next = picks.find(car => car.id !== spotlight?.id);
    return [editorialHeroCars[0], spotlight ?? editorialHeroCars[1], next ?? editorialHeroCars[2]];
  }, [vehicles, heroPreviewId]);
  const discoveryChoices = useMemo(() => driveMoods.map(mood => ({ ...mood, matches: filterCars(vehicles, { bodyType: mood.bodyType, fuel: mood.fuel }) as Vehicle[] })), [vehicles]);
  const activeDiscovery = discoveryChoices.find(choice => choice.id === driveMood) ?? discoveryChoices[0];
  const discoveryLoading = inventoryLoading && vehicles.length === 0;
  const discoveryError = Boolean(inventoryError && vehicles.length === 0);
  const heroCar = heroCars[heroIndex];
  const heroListing = heroIndex > 0 && 'status' in heroCar ? heroCar as Vehicle : undefined;

  useEffect(() => { setSaved(readSaved()); setSavedReady(true); }, []);
  useEffect(() => { if (!savedReady) return; try { localStorage.setItem(localKey, JSON.stringify(saved)); } catch { /* Saving can be disabled by the browser. */ } }, [saved, savedReady]);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('reduce-motion', reducedMotion);
    return () => document.documentElement.classList.remove('reduce-motion');
  }, [reducedMotion]);
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }, { threshold: 0.08 });
    document.querySelectorAll('[data-reveal]').forEach(el => { el.classList.add('will-reveal'); observer.observe(el); });
    return () => { observer.disconnect(); clearTimeout(toastTimer.current); };
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenuOpen(false); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menuOpen]);

  const result = useMemo(() => filterCars(vehicles, { ...filters, maxPrice: filters.maxPrice === undefined || filters.maxPrice >= 40000000 ? undefined : filters.maxPrice, savedIds: saved }) as Vehicle[], [vehicles, filters, saved]);
  const visible = showAll ? result : result.slice(0, 6);
  const compared = vehicles.filter(car => compareIds.includes(car.id));
  const isFiltered = Boolean(filters.query || filters.brand !== 'all' || filters.bodyType !== 'all' || filters.fuel !== 'all' || (filters.maxPrice !== undefined && filters.maxPrice < 40000000) || filters.savedOnly);

  function notify(message: string) { clearTimeout(toastTimer.current); setToast(message); toastTimer.current = setTimeout(() => setToast(''), 3500); }
  function updateFilters(patch: CatalogFilters) {
    const next = { ...filters, ...patch };
    setFilters(next); setShowAll(false);
    const custom = Boolean(next.query || next.brand !== 'all' || next.savedOnly || (next.maxPrice !== undefined && next.maxPrice < 40000000));
    const matching = driveMoods.find(mood => mood.bodyType === next.bodyType && mood.fuel === next.fuel);
    setDriveMood(custom ? null : matching?.id ?? null);
  }
  function resetCollection() { setFilters(initialFilters); setDriveMood('all'); setShowAll(false); }
  function toggleSave(id: string) {
    const wasSaved = saved.includes(id);
    setSaved(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]);
    const car = vehicles.find(vehicle => vehicle.id === id);
    notify(`${car ? `${car.brand} ${car.model}` : 'Car'} ${wasSaved ? 'removed from your garage.' : 'saved to your garage.'}`);
  }
  function toggleCompare(id: string) {
    if (compareIds.includes(id)) setCompareIds(current => current.filter(value => value !== id));
    else if (compareIds.length >= 3) notify('Your comparison has 3 cars. Remove one to add another.');
    else setCompareIds(current => [...current, id]);
  }
  function openEnquiry(car?: Car) { setSelected(null); setCompareOpen(false); setEnquiry(car ? vehicles.find(vehicle => vehicle.id === car.id) ?? 'general' : 'general'); }
  function browseSaved() { updateFilters({ ...initialFilters, savedOnly: true }); setMenuOpen(false); collectionRef.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' }); }
  function changeHero(direction: number) { setHeroIndex(value => (value + direction + heroCars.length) % heroCars.length); }
  function chooseDrive(id: DriveMood) {
    const choice = discoveryChoices.find(item => item.id === id)!;
    setDriveMood(id); setFilters({ ...initialFilters, bodyType: choice.bodyType, fuel: choice.fuel }); setShowAll(false);
    const preview = choice.matches.find(car => car.status === 'available');
    setHeroPreviewId(preview?.id ?? null); setHeroIndex(preview ? 1 : 0);
  }
  function exploreDrive() {
    if (discoveryError) { reloadInventory(); return; }
    if (activeDiscovery.matches.length === 0) { openEnquiry(); return; }
    chooseDrive(driveMood ?? 'all');
    window.requestAnimationFrame(() => collectionRef.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' }));
  }

  return <>
    <a className="skip-link" href="#collection">Skip to the collection</a>
    <header className="site-header">
      <a href="#home" className="logo-link" aria-label="Velocity Motor Co. home"><Wordmark /></a>
      <nav className="desktop-nav" aria-label="Main navigation"><a href="#collection">The collection</a><a href="#experience">The experience</a><a href="#approach">Our approach</a></nav>
      <div className="header-actions"><button className={`header-save ${saved.length ? 'has-saved' : ''}`} aria-label={`View ${saved.length} saved cars`} onClick={browseSaved}><Heart size={19} fill={saved.length ? 'currentColor' : 'none'}/>{saved.length > 0 && <span>{saved.length}</span>}</button><ThemeToggle/><button className="button button-outline header-cta" onClick={() => openEnquiry()}>Let’s talk cars <ArrowUpRight size={16}/></button><button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="mobile-menu">{menuOpen ? <X/> : <Menu/>}</button></div>
      {menuOpen && <nav id="mobile-menu" className="mobile-nav" aria-label="Mobile navigation"><a href="#collection" onClick={() => setMenuOpen(false)}>The collection <ArrowUpRight/></a><a href="#experience" onClick={() => setMenuOpen(false)}>The experience <ArrowUpRight/></a><a href="#approach" onClick={() => setMenuOpen(false)}>Our approach <ArrowUpRight/></a><button onClick={() => { setMenuOpen(false); openEnquiry(); }}>Let’s talk cars <ArrowUpRight/></button></nav>}
    </header>

    <main>
      <section id="home" className="hero" aria-label="Featured vehicles">
        <div className="hero-photo" key={`${heroIndex}-${heroCar.id}`} style={{ backgroundImage: `url(${heroIndex === 0 ? '/images/hero.webp' : heroCar.image})` }} role="img" aria-label={heroIndex === 0 ? "Black Porsche Panamera Turbo driving on an open road" : heroCar.imageAlt}/>
        <div className="hero-shade"/>
        <div className="hero-grid" aria-hidden="true"><span/><span/><span/><span/></div>
        <div className="hero-content">
          <div className="eyebrow hero-eyebrow"><span className="status-dot"/> FOR THE LOVE OF THE DRIVE</div>
          <h1>LIFE’S TOO SHORT<br/>FOR <span className="outline-text">BORING</span><br/><em>DRIVES.</em></h1>
          <p>Some cars take you places.<br/>The right one takes you somewhere else.</p>
          <div className="hero-buttons"><a href="#collection" className="button button-lime">Find your next drive <ArrowUpRight size={19}/></a><button className="hero-match" onClick={() => setMatchOpen(true)}>Find my match <span><ArrowRight size={16}/></span></button></div>
        </div>
        <div className="hero-side-label" aria-hidden="true">NOT JUST A CAR. A FEELING.</div>
        <button className="hero-car-label" onClick={() => heroListing ? setSelected(heroListing) : collectionRef.current?.scrollIntoView({behavior:reducedMotion?"instant":"smooth"})} aria-label={heroIndex === 0 ? "Explore the collection" : `Explore ${heroCar.brand} ${heroCar.model}`}><span className="hero-car-kicker">{heroIndex === 0 ? "THE ART OF THE DRIVE" : heroListing ? (heroListing.isDemo ? "DEMO SPOTLIGHT" : "IN THE SPOTLIGHT") : "REFERENCE PHOTOGRAPHY"} <span>0{heroIndex + 1}</span></span><strong>{heroIndex === 0 ? "Porsche Panamera Turbo" : `${heroCar.brand} ${heroCar.model}`}</strong>{heroListing && <span className="hero-car-price">{formatPrice(heroListing.price)}<small>{heroListing.isDemo ? 'Sample asking price' : 'Asking price'}</small></span>}<span className="hero-car-spec">{heroIndex === 0 ? "An extraordinary point of view." : `${heroCar.power} PS${heroCar.acceleration === null ? '' : `  /  ${heroCar.acceleration.toFixed(1)}s 0–100 km/h`}`} <ArrowUpRight size={21}/></span></button>
        <div className="hero-footer"><a href="#collection" className="scroll-hint"><span><ArrowDown size={15}/></span> SCROLL TO DISCOVER</a><div className="hero-pagination"><span className="slide-number">0{heroIndex + 1}<small> / 03</small></span><div className="slide-track">{heroCars.map((car, i) => <button key={`${i}-${car.id}`} aria-label={i === 0 ? "Show Porsche Panamera Turbo editorial" : `Show ${car.brand} ${car.model}`} aria-pressed={heroIndex === i} onClick={() => setHeroIndex(i)}/>)}</div><button className="circle-button" aria-label="Previous featured car" onClick={() => changeHero(-1)}><ArrowLeft size={17}/></button><button className="circle-button" aria-label="Next featured car" onClick={() => changeHero(1)}><ArrowRight size={17}/></button></div></div>
      </section>

      <section className="drive-discovery" aria-label="Choose your kind of drive">
        <div className="drive-discovery__intro"><span className="eyebrow">FIND YOUR FEELING</span><h2>What moves you?</h2></div>
        <div className="drive-discovery__choices">{discoveryChoices.map(choice => { const Icon = choice.icon; return <button key={choice.id} className="drive-choice" aria-pressed={driveMood === choice.id} aria-controls="collection" disabled={discoveryLoading || discoveryError || choice.matches.length === 0} onClick={() => chooseDrive(choice.id)}><Icon size={19} aria-hidden="true"/><span className="drive-choice__label">{choice.label}</span><span className="drive-choice__count">{discoveryLoading || discoveryError ? '—' : choice.matches.length.toString().padStart(2,'0')}<span className="sr-only"> cars in the collection</span></span></button>; })}</div>
        <button className="drive-discovery__action" onClick={exploreDrive} disabled={discoveryLoading}><span>{discoveryLoading ? 'Loading your next drive…' : discoveryError ? 'Retry the collection' : activeDiscovery.matches.length === 0 ? 'Tell us your ideal car' : `Explore ${driveMood === null ? 'all ' : ''}${activeDiscovery.matches.length} ${activeDiscovery.matches.length === 1 ? 'car' : 'cars'}`}</span><ArrowUpRight size={20} aria-hidden="true"/></button>
      </section>

      <div className="marque-strip"><span className="marque-intro">EXTRAORDINARY<br/>BY DESIGN.</span><div className="marque-name marque-porsche">PORSCHE</div><div className="marque-name marque-bmw">BMW</div><div className="marque-name marque-mercedes">Mercedes-Benz</div><div className="marque-name marque-audi">Audi</div><div className="marque-name marque-rover">RANGE ROVER</div></div>

      <section className="collection section-pad" id="collection" ref={collectionRef}>
        <div className="section-top"><span className="eyebrow">01 / THE COLLECTION</span><span className="tiny-label">GREAT CARS. EVEN BETTER POSSIBILITIES.</span></div>
        <div className="collection-heading" data-reveal><h2>MEET YOUR NEXT<br/><span>OBSESSION.</span></h2><div><p>For the city. For the escape.<br/>For the sheer joy of getting there.</p><button className="text-link" onClick={() => setMatchOpen(true)}>Need a little inspiration? <ArrowUpRight size={17}/></button></div></div>
        <div className="discovery-bar"><div className="category-tabs" aria-label="Vehicle categories">{[{label:'All cars', bodyType:'all', fuel:'all', icon:null}, {label:'Performance',bodyType:'Coupe',fuel:'all',icon:<Gauge size={16}/>}, {label:'SUVs',bodyType:'SUV',fuel:'all',icon:<Mountain size={16}/>}, {label:'Electric',bodyType:'all',fuel:'Electric',icon:<Zap size={16}/>}].map((category, i) => <button key={category.label} className={filters.bodyType === category.bodyType && filters.fuel === category.fuel && !filters.savedOnly ? 'active' : ''} aria-pressed={filters.bodyType === category.bodyType && filters.fuel === category.fuel && !filters.savedOnly} onClick={() => updateFilters({bodyType:category.bodyType,fuel:category.fuel,savedOnly:false})}>{category.icon}{category.label}{i===0 && <sup>{inventoryLoading && vehicles.length === 0 ? '—' : vehicles.length.toString().padStart(2,'0')}</sup>}</button>)}</div><button className={`filter-toggle ${moreFilters ? 'active' : ''}`} aria-expanded={moreFilters} aria-controls="advanced-filters" onClick={() => setMoreFilters(!moreFilters)}><SlidersHorizontal size={17}/> Filters <span>{moreFilters ? '−' : '+'}</span></button></div>
        <div className="search-sort-row"><label className="search-field"><Search size={18}/><input aria-label="Search cars" type="search" placeholder="Your dream car is a search away…" value={filters.query} onChange={e => updateFilters({query:e.target.value})}/></label><label className="sort-field"><ArrowDownUp size={15}/><span className="sr-only">Sort cars</span><select value={filters.sort} onChange={e => updateFilters({sort:e.target.value})}><option value="featured">Curated picks</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="newest">Newest year</option><option value="mileage-asc">Lowest mileage</option></select><ChevronDown size={15}/></label></div>
        {moreFilters && <div id="advanced-filters" className="advanced-filters"><label>Brand<select value={filters.brand} onChange={e=>updateFilters({brand:e.target.value})}><option value="all">All brands</option>{brands.map(brand=><option key={brand}>{brand}</option>)}</select></label><label>Powertrain<select value={filters.fuel} onChange={e=>updateFilters({fuel:e.target.value})}><option value="all">Any powertrain</option>{fuelTypes.map(type=><option key={type}>{type}</option>)}</select></label><label className="budget-filter"><span>Budget <strong>{Number(filters.maxPrice) >= 40000000 ? 'Any price' : `Up to ${formatPrice(Number(filters.maxPrice),true)}`}</strong></span><input aria-label="Maximum price" type="range" min="0" max="40000000" step="500000" value={filters.maxPrice} onChange={e=>updateFilters({maxPrice:Number(e.target.value)})}/></label><button className={`saved-filter ${filters.savedOnly ? 'active' : ''}`} onClick={()=>updateFilters({savedOnly:!filters.savedOnly})} aria-pressed={filters.savedOnly}><Heart size={16}/> Saved cars ({saved.length})</button></div>}
        <div className="results-line"><p aria-live="polite">{inventoryLoading && vehicles.length === 0 ? 'Loading the collection…' : inventoryError && vehicles.length === 0 ? 'Collection unavailable' : `${result.length} ${result.length === 1 ? 'car' : 'cars'} to fall for${filters.savedOnly ? ' · Your saved collection' : ''}`}</p>{isFiltered ? <button onClick={resetCollection}>Clear filters <X size={13}/></button> : <span>{inventoryLoading ? 'UPDATING COLLECTION' : mode === 'demo' ? 'DEMO COLLECTION · SAMPLE PRICES' : mode === 'mixed' ? 'DEMO VEHICLES ARE LABELLED' : 'DEALER INVENTORY'}</span>}</div>
        {inventoryLoading && vehicles.length === 0 ? <div className="inventory-state" role="status"><span className="inventory-loading-dot"/><h3>BRINGING YOUR NEXT DRIVE INTO VIEW.</h3><p>Loading the dealership’s current collection…</p></div> : inventoryError && vehicles.length === 0 ? <div className="inventory-state inventory-state--error" role="alert"><h3>LET’S RECONNECT.</h3><p>{inventoryError}</p><button className="button button-dark" onClick={reloadInventory}>Try again <ArrowRight size={17}/></button></div> : visible.length ? <div className="car-grid">{visible.map((car, index) => <CarCard key={car.id} car={car} index={index} saved={saved.includes(car.id)} compared={compareIds.includes(car.id)} onOpen={()=>setSelected(car)} onSave={()=>toggleSave(car.id)} onCompare={()=>toggleCompare(car.id)} onEnquire={()=>openEnquiry(car)} reducedMotion={reducedMotion}/>)}</div> : <div className="empty-state"><Search size={34}/><h3>{filters.savedOnly && saved.length === 0 ? 'YOUR GARAGE STARTS HERE.' : 'LET’S OPEN UP THE ROAD.'}</h3><p>{filters.savedOnly && saved.length === 0 ? 'Tap the heart on any car to keep it in your personal collection.' : vehicles.length === 0 ? 'The dealership is preparing its collection. Send us an enquiry and tell us what you’re looking for.' : filters.savedOnly ? 'Your saved cars are not currently published in the collection. Explore the latest inventory to find something new.' : 'No cars match those filters yet. Try another brand or a wider budget.'}</p><button className="button button-dark" onClick={()=>{if(vehicles.length === 0) openEnquiry(); else resetCollection();}}>{vehicles.length === 0 ? 'Start a conversation' : 'Explore all cars'} <ArrowRight size={17}/></button></div>}
        {inventoryError && vehicles.length > 0 && <p className="inventory-refresh-error" role="alert">The collection could not be refreshed. <button onClick={reloadInventory}>Try again</button></p>}<div className="collection-bottom"><p>{mode === 'demo' ? 'Sample vehicles are for exploring the showroom. Prices and availability are illustrative.' : mode === 'mixed' ? 'Demo vehicles are labelled. Contact the dealership to confirm details and availability of live listings.' : 'Inventory is managed by the dealership. Confirm equipment and final availability before purchase.'}</p>{!showAll && result.length > 6 && <button className="button button-line-dark" onClick={()=>setShowAll(true)}>Explore all {result.length} cars <Plus size={17}/></button>}{showAll && result.length > 6 && <button className="button button-line-dark" onClick={()=>{setShowAll(false);collectionRef.current?.scrollIntoView({behavior:reducedMotion?'instant':'smooth'});}}>Show curated picks <ArrowUpRight size={17}/></button>}</div>
      </section>

      <section className="experience section-pad" id="experience">
        <div className="section-top"><span className="eyebrow">02 / THE FEELING</span><span className="tiny-label">GO AHEAD. TAKE THE LONG WAY.</span></div>
        <div className="experience-heading" data-reveal><h2>LESS ORDINARY.<br/><span>MORE OPEN ROAD.</span></h2><p>It’s the first turn. The open stretch.<br/>That smile you didn’t plan on.<br/><strong>Some things are meant to move you.</strong></p></div>
        <DrivingScene reducedMotion={reducedMotion}/>
        <div className="experience-foot"><span>DESIGNED TO MOVE YOU.</span><span><span className="status-dot"/> A LITTLE TASTE OF WHAT’S AHEAD</span></div>
      </section>

      <section className="approach section-pad" id="approach">
        <div className="approach-visual" data-reveal><img src="/images/detail.webp" alt="Green Porsche GT3 bodywork and gold alloy wheel with raindrops" loading="lazy"/><div className="approach-photo-shade"/><span className="photo-caption">IT’S ALL IN THE DETAILS.</span><div className="photo-stamp"><span>THE DRIVE<br/>IS THE<br/><em>DESTINATION.</em></span><ArrowUpRight size={40}/></div></div>
        <div className="approach-copy" data-reveal><span className="eyebrow">03 / A BETTER WAY TO DISCOVER</span><h2>GREAT TASTE.<br/><span>ZERO GUESSWORK.</span></h2><p className="approach-intro">A great car deserves more than a listing. Get a feel for the details, make a shortlist, and find the one that feels like you.</p><div className="approach-step"><span>01</span><div><h3>Discover your kind of different.</h3><p>From sculpted sports cars to go-anywhere SUVs. Follow your instinct, or let the filters guide you.</p></div><ArrowUpRight size={19}/></div><div className="approach-step"><span>02</span><div><h3>Get into the details.</h3><p>Explore the specifications. Compare your favourites. Work out a budget that makes sense for you.</p></div><ArrowUpRight size={19}/></div><div className="approach-step"><span>03</span><div><h3>Make your next move.</h3><p>Send a test-drive request with your preferred car and time. A great conversation starts with a great car.</p></div><ArrowUpRight size={19}/></div><button className="text-link" onClick={()=>openEnquiry()}>Let’s find your drive <ArrowUpRight size={19}/></button></div>
      </section>

      <section className="next-chapter section-pad"><div><span className="eyebrow">THE ROAD DOESN’T END HERE.</span><h2>FIRST, THE CAR.<br/>THEN, <em>EVERYTHING ELSE.</em></h2></div><div className="future-list"><span><span>01</span> Remarkable cars <span className="live-label">EXPLORE NOW <ArrowUpRight size={14}/></span></span><span><span>02</span> Parts & accessories <small>COMING LATER</small></span><span><span>03</span> Garage & care <small>COMING LATER</small></span></div></section>

      <section className="final-cta section-pad"><span className="eyebrow">THAT NEXT-CHAPTER FEELING.</span><div><h2>YOUR NEXT DRIVE<br/>STARTS <span>HERE.</span></h2><button onClick={()=>openEnquiry()} className="cta-circle" aria-label="Send a car enquiry"><ArrowUpRight size={54}/></button></div><p>Let’s make the everyday a little more extraordinary.</p></section>
    </main>

    <footer className="site-footer section-pad"><div className="footer-top"><a href="#home" className="logo-link" aria-label="Back to top"><Wordmark large/></a><p>Good cars.<br/>Great stories.<br/><strong>Go make yours.</strong></p><div className="footer-links"><a href="#collection">The collection <ArrowUpRight size={14}/></a><a href="#experience">The experience <ArrowUpRight size={14}/></a><button onClick={()=>openEnquiry()}>Start a conversation <ArrowUpRight size={14}/></button><a href="/admin">Dealer workspace <ArrowUpRight size={14}/></a></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} VELOCITY Motor Co. · For the love of the drive</span><div><button onClick={()=>setPrivacyOpen(true)}>Privacy & showroom info</button><a className="credits-link" href="/credits.html" target="_blank" rel="noreferrer">Photo credits <ArrowUpRight size={11}/></a><button className="motion-toggle" onClick={()=>{if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setReducedMotion(true);notify("Reduced motion is enabled in your device settings.");}else setReducedMotion(value=>!value);}} aria-pressed={!reducedMotion}>{reducedMotion ? <Pause size={12}/> : <Play size={12}/>} Motion {reducedMotion ? 'off' : 'on'}</button><a href="#home">BACK TO TOP <ArrowUpRight size={13}/></a></div></div></footer>

    {compareIds.length > 0 && !compareOpen && <aside className="compare-dock" aria-label="Selected cars for comparison"><div className="compare-thumbnails">{compared.map(car=><img key={car.id} src={car.image} alt={`${car.brand} ${car.model}`}/>)}</div><span><strong>{compareIds.length} / 3</strong> <span className="compare-dock-label">in your shortlist</span></span><button onClick={()=>setCompareOpen(true)} className="button button-lime">Compare cars <ArrowRight size={16}/></button><button className="dock-clear" onClick={()=>setCompareIds([])} aria-label="Clear comparison"><X size={17}/></button></aside>}
    <div className={`toast ${toast ? 'visible' : ''}`} role="status">{toast}</div>
    {selected && <VehicleDetails car={selected} onClose={()=>setSelected(null)} onEnquire={openEnquiry} onToggleSave={toggleSave} isSaved={saved.includes(selected.id)} onToggleCompare={toggleCompare} isCompared={compareIds.includes(selected.id)} compareLimitReached={compareIds.length >= 3 && !compareIds.includes(selected.id)}/>}
    {compareOpen && <CompareDialog cars={compared} onClose={()=>setCompareOpen(false)} onRemove={id=>setCompareIds(current=>current.filter(value=>value!==id))} onEnquire={openEnquiry}/>}
    {enquiry && <EnquiryDialog car={enquiry==='general'?undefined:enquiry} onClose={()=>setEnquiry(null)} onAvailabilityChanged={reloadInventory}/>}
    {matchOpen && <MatchFinder vehicles={vehicles} loading={inventoryLoading} inventoryError={inventoryError} onClose={()=>setMatchOpen(false)} onApply={patch=>{updateFilters({...initialFilters,...patch});setShowAll(true);setMatchOpen(false);setTimeout(()=>collectionRef.current?.scrollIntoView({behavior:reducedMotion?'instant':'smooth'}),80);}}/>}
    {privacyOpen && <Modal title="Privacy & this showroom" onClose={()=>setPrivacyOpen(false)}><div className="privacy-copy"><span className="eyebrow">A FEW USEFUL DETAILS</span><h3>Built for discovery.</h3><p>Listings are maintained by the dealership. Vehicles marked Demo use sample prices and reference photography and are not offered for purchase. Check a live vehicle’s exact specification and availability with the dealership.</p><h4>Your enquiry reaches the dealership.</h4><p>Saved favourites and your light or dark appearance preference stay in this browser. When you submit an enquiry, your contact details, vehicle interest, preferred date and message are stored in a private inbox for authorised dealership staff to manage. A test-drive request becomes an appointment only after staff confirm an available slot. Payment details are entered with the payment provider, never in this website’s forms.</p><h4>A little perspective on finance.</h4><p>The calculator uses the price, deposit, interest rate and term you choose. Estimates exclude fees, insurance and taxes. They are not lender offers.</p><h4>You stay in control.</h4><p>Contact the dealership to update or ask about removal of your enquiry information. Your enquiry receipt records your reference and can be downloaded. Reservation payments are available only when merchant payment processing is enabled and the selected vehicle is a live listing. Parts and garage services are planned for a later release.</p></div></Modal>}
  </>;
}

function CarCard({ car, index, saved, compared, onOpen, onSave, onCompare, onEnquire, reducedMotion }: { car: Vehicle; index: number; saved: boolean; compared: boolean; onOpen: ()=>void; onSave: ()=>void; onCompare: ()=>void; onEnquire: ()=>void; reducedMotion: boolean }) {
  function moveSpotlight(event: PointerEvent<HTMLElement>) {
    if (reducedMotion || event.pointerType !== 'mouse') return;
    const surface = event.currentTarget.querySelector<HTMLElement>('.car-info') ?? event.currentTarget;
    const bounds = surface.getBoundingClientRect();
    event.currentTarget.style.setProperty('--card-pointer-x', `${((event.clientX - bounds.left) / bounds.width * 100).toFixed(1)}%`);
    event.currentTarget.style.setProperty('--card-pointer-y', `${((event.clientY - bounds.top) / bounds.height * 100).toFixed(1)}%`);
  }
  return <article className={`car-card${saved ? ' is-saved' : ''}${compared ? ' is-compared' : ''}`} onPointerMove={moveSpotlight} style={{'--card-delay':`${Math.min(index,5)*45}ms`} as CSSProperties}>
    <div className="car-photo-wrap"><button className="car-image-button" onClick={onOpen} aria-label={`Explore ${car.brand} ${car.model}`}><img src={car.image} alt={car.imageAlt} loading="lazy" width="800" height="560"/><span className="image-open"><ArrowUpRight size={23}/></span></button>{car.badge && <span className={`car-badge ${car.fuel==='Electric'?'badge-electric':''}`}>{car.fuel==='Electric' && <Zap size={11}/>} {car.badge}</span>}<button className={`save-car ${saved?'is-saved':''}`} aria-label={`${saved?'Unsave':'Save'} ${car.brand} ${car.model}`} aria-pressed={saved} onClick={onSave}><Heart size={18} fill={saved?'currentColor':'none'}/></button><span className="car-image-count">{car.bodyType.toUpperCase()} <span> / </span> {car.year}</span></div>
    <div className="car-info"><div className="vehicle-stock-row"><span className={`vehicle-stock-status vehicle-stock-status--${car.status}`}>{car.status}</span><span>{car.isDemo ? 'DEMO · ' : ''}{car.condition === 'new' ? 'NEW' : 'PRE-OWNED'}</span></div><div className="car-title-row"><div><p className="car-brand">{car.brand}</p><h3><button onClick={onOpen}>{car.model}</button></h3></div><span className="car-color" style={{backgroundColor:car.colorHex}} title={car.color} aria-label={`Colour: ${car.color}`}/></div><div className="car-specs"><span><Gauge size={13}/>{formatMileage(car.mileage)}</span><span>{car.fuel==='Electric'?<Zap size={13}/>:<span className="spec-dot"/>}{car.fuel}</span><span>{/PDK/i.test(car.transmission)?'PDK':/manual/i.test(car.transmission)?'Manual':/auto|dct|tronic|single-speed/i.test(car.transmission)?'Auto':car.transmission}</span></div><div className="car-price-row"><div><span className="price-caption">{car.isDemo ? 'ILLUSTRATIVE ASKING PRICE' : car.status === 'available' ? 'MAKE IT YOUR NEXT CHAPTER' : 'LISTED ASKING PRICE'}</span><strong>{formatPrice(car.price)}</strong></div><button className="card-details-cta" onClick={onOpen} aria-label={`View ${car.brand} ${car.model} details`}><span>View details</span><ArrowUpRight size={17}/></button></div><div className="card-bottom-actions"><button className={`compare-car ${compared?'is-compared':''}`} onClick={onCompare} aria-pressed={compared}>{compared?<Check size={13}/>:<Plus size={13}/>} {compared?'In your comparison':'Compare'}</button><button className="card-enquire" onClick={onEnquire} aria-label={`Enquire about ${car.brand} ${car.model}`}>{car.status === 'available' ? 'Enquire' : 'Ask a question'}<ArrowRight size={14}/></button></div></div>
  </article>;
}

function DrivingScene({ reducedMotion }: { reducedMotion: boolean }) {
  const [driving,setDriving] = useState(false);
  const [night,setNight] = useState(false);
  const [pace,setPace] = useState(2);
  const scene = useRef<HTMLDivElement>(null);
  useEffect(()=>{ if(reducedMotion) setDriving(false); },[reducedMotion]);
  useEffect(()=>{ const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)setDriving(false);},{threshold:0.1}); if(scene.current)observer.observe(scene.current);return()=>observer.disconnect();},[]);
  return <div className={`drive-scene ${driving && !reducedMotion?'is-driving':''} ${night?'is-night':''}`} ref={scene} style={{'--drive-duration':`${14-pace*3}s`,'--road-duration':`${1.25-pace*.25}s`} as CSSProperties}>
    <div className="drive-backdrop"/><div className="drive-horizon"/><div className="drive-sun"/><div className="drive-mountain drive-mountain-far"/><div className="drive-mountain drive-mountain-near"/>
    <div className="drive-overlay-top"><span className="drive-live"><span/>{driving?'ENJOY THE RIDE':'YOUR MOMENT AWAITS'}</span><div className="day-night" aria-label="Scene lighting"><button onClick={()=>setNight(false)} className={!night?'active':''} aria-pressed={!night} aria-label="Day scene"><Sun size={15}/></button><button onClick={()=>setNight(true)} className={night?'active':''} aria-pressed={night} aria-label="Night scene"><Moon size={15}/></button></div></div>
    <div className="drive-big-type" aria-hidden="true">JUST. DRIVE.</div>
    <div className="drive-road"><div className="road-line road-line-far"/><div className="road-line road-line-near"/></div>
    <div className="moving-car"><img src="/images/concept-car.webp" alt="Silver concept sports car in an interactive driving scene"/><div className="car-ground-shadow"/></div>
    <div className="drive-controls"><button className="drive-play" onClick={()=>setDriving(!driving)} aria-pressed={driving} disabled={reducedMotion}>{driving?<Pause size={19}/>:<Play size={19} fill="currentColor"/>}<span>{reducedMotion?'Motion is turned off':driving?'Pause the drive':'Take it for a spin'}</span><ArrowRight size={17}/></button><label className="pace-control"><span>SET THE PACE <strong>{['','CRUISE','OPEN ROAD','SPORT'][pace]}</strong></span><input aria-label="Driving animation pace" type="range" min="1" max="3" step="1" value={pace} onChange={e=>setPace(Number(e.target.value))}/></label><span className="concept-caption">AN INTERACTIVE CONCEPT.<br/>PURELY FOR THE FEELING.</span></div>
  </div>;
}

function MatchFinder({vehicles,loading,inventoryError,onClose,onApply}:{vehicles:Vehicle[];loading:boolean;inventoryError:string;onClose:()=>void;onApply:(filters:CatalogFilters)=>void}) {
  const [style,setStyle]=useState('all');
  const [budget,setBudget]=useState('40000000');
  function matchCount(choice: string) { return filterCars(vehicles,{bodyType:choice==='performance'?'Coupe':choice==='SUV'?'SUV':'all',fuel:choice==='electric'?'Electric':'all',maxPrice:Number(budget)>=40000000?undefined:Number(budget)}).length; }
  const choices=[{id:'performance',icon:<Gauge/>,title:'A little adrenaline',detail:'Low, sculpted and built for the drive.'},{id:'SUV',icon:<Mountain/>,title:'The great escape',detail:'Room for your people. And your plans.'},{id:'electric',icon:<Zap/>,title:'A different energy',detail:'Quiet confidence. Electric character.'},{id:'all',icon:<Sparkles/>,title:'Surprise me',detail:'I’ll know it when I see it.'}];
  return <Modal title="Find your kind of drive" onClose={onClose}><div className="match-content"><span className="eyebrow">FOLLOW YOUR INSTINCT.</span><h3>WHAT MOVES YOU?</h3><p>A few pointers. A collection that feels more like you.</p><div className="match-choices">{choices.map(choice=><button key={choice.id} className={style===choice.id?'selected':''} aria-pressed={style===choice.id} onClick={()=>setStyle(choice.id)}>{choice.icon}<strong>{choice.title}</strong><span>{choice.detail}<small className="match-inventory-count">{loading && vehicles.length === 0 ? 'Loading collection…' : inventoryError && vehicles.length === 0 ? 'Collection unavailable' : `${matchCount(choice.id)} ${matchCount(choice.id)===1?'car':'cars'} within your budget`}</small></span>{style===choice.id && <Check size={15} className="match-check"/>}</button>)}</div><label className="match-budget">AND YOUR COMFORT ZONE?<select value={budget} onChange={e=>setBudget(e.target.value)}><option value="40000000">Let me explore everything</option><option value="15000000">Up to KSh 15 million</option><option value="20000000">Up to KSh 20 million</option><option value="25000000">Up to KSh 25 million</option><option value="30000000">Up to KSh 30 million</option></select></label><button className="button button-lime match-submit" onClick={()=>onApply({bodyType:style==='performance'?'Coupe':style==='SUV'?'SUV':'all',fuel:style==='electric'?'Electric':'all',maxPrice:Number(budget)})}>Show me my kind of cars <ArrowUpRight size={18}/></button></div></Modal>;
}

export default App;
