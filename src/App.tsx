import { useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { ArrowDown, ArrowDownUp, ArrowLeft, ArrowRight, ArrowUpRight, Check, ChevronDown, Gauge, Heart, Menu, Moon, Mountain, Pause, Play, Plus, Search, SlidersHorizontal, Sparkles, Sun, X, Zap } from 'lucide-react';
import { brands, cars, fuelTypes } from './data/cars';
import type { Car } from './data/cars';
import { filterCars, formatMileage, formatPrice } from './lib/catalog';
import type { CatalogFilters } from './lib/catalog';
import { VehicleDetails } from './components/VehicleDetails';
import { CompareDialog } from './components/CompareDialog';
import { EnquiryDialog } from './components/EnquiryDialog';
import { Modal } from './components/Modal';

const initialFilters: CatalogFilters = { query: '', brand: 'all', bodyType: 'all', fuel: 'all', maxPrice: 40000000, sort: 'featured', savedOnly: false };
const heroCars = [cars[0], cars[1], cars[3]];
const localKey = 'velocity.saved.v1';

function readSaved(): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(localKey) || '[]');
    return Array.isArray(value) ? [...new Set(value.filter((id): id is string => typeof id === 'string' && cars.some(car => car.id === id)))] : [];
  } catch { return []; }
}

function Wordmark({ large = false }: { large?: boolean }) {
  return <span className={`wordmark ${large ? 'wordmark-large' : ''}`}><svg viewBox="0 0 36 30" fill="none" aria-hidden="true"><path d="M2 3h8l8 17L26 3h8L19.5 29h-4L2 3Z" fill="currentColor"/><path d="m0 20 5 9h7l-5-9H0Z" fill="currentColor"/></svg><span>VELOCITY<small>MOTOR CO.</small></span></span>;
}

function App() {
  const [filters, setFilters] = useState<CatalogFilters>(initialFilters);
  const [saved, setSaved] = useState<string[]>(readSaved);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [selected, setSelected] = useState<Car | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [enquiry, setEnquiry] = useState<Car | 'general' | null>(null);
  const [matchOpen, setMatchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreFilters, setMoreFilters] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [toast, setToast] = useState('');
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const collectionRef = useRef<HTMLElement>(null);
  const heroCar = heroCars[heroIndex];

  useEffect(() => { try { localStorage.setItem(localKey, JSON.stringify(saved)); } catch { /* Saving can be disabled by the browser. */ } }, [saved]);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(query.matches);
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

  const result = useMemo(() => filterCars(cars, { ...filters, savedIds: saved }), [filters, saved]);
  const visible = showAll ? result : result.slice(0, 6);
  const compared = cars.filter(car => compareIds.includes(car.id));
  const isFiltered = Boolean(filters.query || filters.brand !== 'all' || filters.bodyType !== 'all' || filters.fuel !== 'all' || (filters.maxPrice || 40000000) < 40000000 || filters.savedOnly);

  function notify(message: string) { clearTimeout(toastTimer.current); setToast(message); toastTimer.current = setTimeout(() => setToast(''), 3500); }
  function updateFilters(patch: CatalogFilters) { setFilters(current => ({ ...current, ...patch })); setShowAll(false); }
  function toggleSave(id: string) { setSaved(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]); }
  function toggleCompare(id: string) {
    if (compareIds.includes(id)) setCompareIds(current => current.filter(value => value !== id));
    else if (compareIds.length >= 3) notify('Your comparison has 3 cars. Remove one to add another.');
    else setCompareIds(current => [...current, id]);
  }
  function openEnquiry(car?: Car) { setSelected(null); setCompareOpen(false); setEnquiry(car || 'general'); }
  function browseSaved() { updateFilters({ ...initialFilters, savedOnly: true }); setMenuOpen(false); collectionRef.current?.scrollIntoView({ behavior: reducedMotion ? 'instant' : 'smooth' }); }
  function changeHero(direction: number) { setHeroIndex(value => (value + direction + heroCars.length) % heroCars.length); }

  return <>
    <a className="skip-link" href="#collection">Skip to the collection</a>
    <header className="site-header">
      <a href="#home" className="logo-link" aria-label="Velocity Motor Co. home"><Wordmark /></a>
      <nav className="desktop-nav" aria-label="Main navigation"><a href="#collection">The collection</a><a href="#experience">The experience</a><a href="#approach">Our approach</a></nav>
      <div className="header-actions"><button className={`header-save ${saved.length ? 'has-saved' : ''}`} aria-label={`View ${saved.length} saved cars`} onClick={browseSaved}><Heart size={19} fill={saved.length ? 'currentColor' : 'none'}/>{saved.length > 0 && <span>{saved.length}</span>}</button><button className="button button-outline header-cta" onClick={() => openEnquiry()}>Let’s talk cars <ArrowUpRight size={16}/></button><button className="menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} aria-controls="mobile-menu">{menuOpen ? <X/> : <Menu/>}</button></div>
      {menuOpen && <nav id="mobile-menu" className="mobile-nav" aria-label="Mobile navigation"><a href="#collection" onClick={() => setMenuOpen(false)}>The collection <ArrowUpRight/></a><a href="#experience" onClick={() => setMenuOpen(false)}>The experience <ArrowUpRight/></a><a href="#approach" onClick={() => setMenuOpen(false)}>Our approach <ArrowUpRight/></a><button onClick={() => { setMenuOpen(false); openEnquiry(); }}>Let’s talk cars <ArrowUpRight/></button></nav>}
    </header>

    <main>
      <section id="home" className="hero" aria-label="Featured vehicles">
        <div className="hero-photo" key={heroCar.id} style={{ backgroundImage: `url(${heroIndex === 0 ? '/images/hero.webp' : heroCar.image})` }} role="img" aria-label={heroIndex === 0 ? "Black Porsche Panamera Turbo driving on an open road" : heroCar.imageAlt}/>
        <div className="hero-shade"/>
        <div className="hero-grid" aria-hidden="true"><span/><span/><span/><span/></div>
        <div className="hero-content">
          <div className="eyebrow hero-eyebrow"><span className="status-dot"/> FOR THE LOVE OF THE DRIVE</div>
          <h1>LIFE’S TOO SHORT<br/>FOR <span className="outline-text">BORING</span><br/><em>DRIVES.</em></h1>
          <p>Some cars take you places.<br/>The right one takes you somewhere else.</p>
          <div className="hero-buttons"><a href="#collection" className="button button-lime">Find your next drive <ArrowUpRight size={19}/></a><button className="hero-match" onClick={() => setMatchOpen(true)}>Find my match <span><ArrowRight size={16}/></span></button></div>
        </div>
        <div className="hero-side-label" aria-hidden="true">NOT JUST A CAR. A FEELING.</div>
        <button className="hero-car-label" onClick={() => heroIndex === 0 ? collectionRef.current?.scrollIntoView({behavior:reducedMotion?"instant":"smooth"}) : setSelected(heroCar)} aria-label={heroIndex === 0 ? "Explore the collection" : `Explore ${heroCar.brand} ${heroCar.model}`}><span className="hero-car-kicker">{heroIndex === 0 ? "THE ART OF THE DRIVE" : "IN THE SPOTLIGHT"} <span>0{heroIndex + 1}</span></span><strong>{heroIndex === 0 ? "Porsche Panamera Turbo" : `${heroCar.brand} ${heroCar.model}`}</strong><span className="hero-car-spec">{heroIndex === 0 ? "An extraordinary point of view." : `${heroCar.power} PS  /  ${heroCar.acceleration?.toFixed(1)}s 0–100 km/h`} <ArrowUpRight size={21}/></span></button>
        <div className="hero-footer"><a href="#collection" className="scroll-hint"><span><ArrowDown size={15}/></span> SCROLL TO DISCOVER</a><div className="hero-pagination"><span className="slide-number">0{heroIndex + 1}<small> / 03</small></span><div className="slide-track">{heroCars.map((car, i) => <button key={car.id} aria-label={i === 0 ? "Show Porsche Panamera Turbo editorial" : `Show ${car.brand} ${car.model}`} aria-pressed={heroIndex === i} onClick={() => setHeroIndex(i)}/>)}</div><button className="circle-button" aria-label="Previous featured car" onClick={() => changeHero(-1)}><ArrowLeft size={17}/></button><button className="circle-button" aria-label="Next featured car" onClick={() => changeHero(1)}><ArrowRight size={17}/></button></div></div>
      </section>

      <div className="marque-strip"><span className="marque-intro">EXTRAORDINARY<br/>BY DESIGN.</span><div className="marque-name marque-porsche">PORSCHE</div><div className="marque-name marque-bmw">BMW</div><div className="marque-name marque-mercedes">Mercedes-Benz</div><div className="marque-name marque-audi">Audi</div><div className="marque-name marque-rover">RANGE ROVER</div></div>

      <section className="collection section-pad" id="collection" ref={collectionRef}>
        <div className="section-top"><span className="eyebrow">01 / THE COLLECTION</span><span className="tiny-label">GREAT CARS. EVEN BETTER POSSIBILITIES.</span></div>
        <div className="collection-heading" data-reveal><h2>MEET YOUR NEXT<br/><span>OBSESSION.</span></h2><div><p>For the city. For the escape.<br/>For the sheer joy of getting there.</p><button className="text-link" onClick={() => setMatchOpen(true)}>Need a little inspiration? <ArrowUpRight size={17}/></button></div></div>
        <div className="discovery-bar"><div className="category-tabs" aria-label="Vehicle categories">{[{label:'All cars', bodyType:'all', fuel:'all', icon:null}, {label:'Performance',bodyType:'Coupe',fuel:'all',icon:<Gauge size={16}/>}, {label:'SUVs',bodyType:'SUV',fuel:'all',icon:<Mountain size={16}/>}, {label:'Electric',bodyType:'all',fuel:'Electric',icon:<Zap size={16}/>}].map((category, i) => <button key={category.label} className={filters.bodyType === category.bodyType && filters.fuel === category.fuel && !filters.savedOnly ? 'active' : ''} aria-pressed={filters.bodyType === category.bodyType && filters.fuel === category.fuel && !filters.savedOnly} onClick={() => updateFilters({bodyType:category.bodyType,fuel:category.fuel,savedOnly:false})}>{category.icon}{category.label}{i===0 && <sup>{cars.length.toString().padStart(2,'0')}</sup>}</button>)}</div><button className={`filter-toggle ${moreFilters ? 'active' : ''}`} aria-expanded={moreFilters} aria-controls="advanced-filters" onClick={() => setMoreFilters(!moreFilters)}><SlidersHorizontal size={17}/> Filters <span>{moreFilters ? '−' : '+'}</span></button></div>
        <div className="search-sort-row"><label className="search-field"><Search size={18}/><input aria-label="Search cars" type="search" placeholder="Your dream car is a search away…" value={filters.query} onChange={e => updateFilters({query:e.target.value})}/></label><label className="sort-field"><ArrowDownUp size={15}/><span className="sr-only">Sort cars</span><select value={filters.sort} onChange={e => updateFilters({sort:e.target.value})}><option value="featured">Curated picks</option><option value="price-asc">Price: low to high</option><option value="price-desc">Price: high to low</option><option value="newest">Newest year</option><option value="mileage-asc">Lowest mileage</option></select><ChevronDown size={15}/></label></div>
        {moreFilters && <div id="advanced-filters" className="advanced-filters"><label>Brand<select value={filters.brand} onChange={e=>updateFilters({brand:e.target.value})}><option value="all">All brands</option>{brands.map(brand=><option key={brand}>{brand}</option>)}</select></label><label>Powertrain<select value={filters.fuel} onChange={e=>updateFilters({fuel:e.target.value})}><option value="all">Any powertrain</option>{fuelTypes.map(type=><option key={type}>{type}</option>)}</select></label><label className="budget-filter"><span>Budget <strong>{Number(filters.maxPrice) >= 40000000 ? 'Any price' : `Up to ${formatPrice(Number(filters.maxPrice),true)}`}</strong></span><input aria-label="Maximum price" type="range" min="10000000" max="40000000" step="500000" value={filters.maxPrice} onChange={e=>updateFilters({maxPrice:Number(e.target.value)})}/></label><button className={`saved-filter ${filters.savedOnly ? 'active' : ''}`} onClick={()=>updateFilters({savedOnly:!filters.savedOnly})} aria-pressed={filters.savedOnly}><Heart size={16}/> Saved cars ({saved.length})</button></div>}
        <div className="results-line"><p aria-live="polite">{result.length} {result.length === 1 ? 'car' : 'cars'} to fall for{filters.savedOnly ? ' · Your saved collection' : ''}</p>{isFiltered ? <button onClick={()=>{setFilters(initialFilters);setShowAll(false);}}>Clear filters <X size={13}/></button> : <span>CONCEPT COLLECTION · SAMPLE PRICES</span>}</div>
        {visible.length ? <div className="car-grid">{visible.map((car, index) => <CarCard key={car.id} car={car} index={index} saved={saved.includes(car.id)} compared={compareIds.includes(car.id)} onOpen={()=>setSelected(car)} onSave={()=>toggleSave(car.id)} onCompare={()=>toggleCompare(car.id)}/>)}</div> : <div className="empty-state"><Search size={34}/><h3>{filters.savedOnly && saved.length === 0 ? 'YOUR GARAGE STARTS HERE.' : 'LET’S OPEN UP THE ROAD.'}</h3><p>{filters.savedOnly && saved.length === 0 ? 'Tap the heart on any car to keep it in your personal collection.' : 'No cars match those filters yet. Try another brand or a wider budget.'}</p><button className="button button-dark" onClick={()=>{setFilters(initialFilters);setShowAll(false);}}>Explore all cars <ArrowRight size={17}/></button></div>}
        <div className="collection-bottom"><p>Reference vehicles shown. Prices, mileage and availability<br className="desktop-break"/> are illustrative. Your next favourite? That part is real.</p>{!showAll && result.length > 6 && <button className="button button-line-dark" onClick={()=>setShowAll(true)}>Explore all {result.length} cars <Plus size={17}/></button>}{showAll && result.length > 6 && <button className="button button-line-dark" onClick={()=>{setShowAll(false);collectionRef.current?.scrollIntoView({behavior:reducedMotion?'instant':'smooth'});}}>Show curated picks <ArrowUpRight size={17}/></button>}</div>
      </section>

      <section className="experience section-pad" id="experience">
        <div className="section-top"><span className="eyebrow">02 / THE FEELING</span><span className="tiny-label">GO AHEAD. TAKE THE LONG WAY.</span></div>
        <div className="experience-heading" data-reveal><h2>LESS ORDINARY.<br/><span>MORE OPEN ROAD.</span></h2><p>It’s the first turn. The open stretch.<br/>That smile you didn’t plan on.<br/><strong>Some things are meant to move you.</strong></p></div>
        <DrivingScene reducedMotion={reducedMotion}/>
        <div className="experience-foot"><span>DESIGNED TO MOVE YOU.</span><span><span className="status-dot"/> A LITTLE TASTE OF WHAT’S AHEAD</span></div>
      </section>

      <section className="approach section-pad" id="approach">
        <div className="approach-visual" data-reveal><img src="/images/detail.webp" alt="Green Porsche GT3 bodywork and gold alloy wheel with raindrops" loading="lazy"/><div className="approach-photo-shade"/><span className="photo-caption">IT’S ALL IN THE DETAILS.</span><div className="photo-stamp"><span>THE DRIVE<br/>IS THE<br/><em>DESTINATION.</em></span><ArrowUpRight size={40}/></div></div>
        <div className="approach-copy" data-reveal><span className="eyebrow">03 / A BETTER WAY TO DISCOVER</span><h2>GREAT TASTE.<br/><span>ZERO GUESSWORK.</span></h2><p className="approach-intro">A great car deserves more than a listing. Get a feel for the details, make a shortlist, and find the one that feels like you.</p><div className="approach-step"><span>01</span><div><h3>Discover your kind of different.</h3><p>From sculpted sports cars to go-anywhere SUVs. Follow your instinct, or let the filters guide you.</p></div><ArrowUpRight size={19}/></div><div className="approach-step"><span>02</span><div><h3>Get into the details.</h3><p>Explore the specifications. Compare your favourites. Work out a budget that makes sense for you.</p></div><ArrowUpRight size={19}/></div><div className="approach-step"><span>03</span><div><h3>Make your next move.</h3><p>Prepare a test-drive enquiry with your preferred car and date. A great conversation starts with a great car.</p></div><ArrowUpRight size={19}/></div><button className="text-link" onClick={()=>openEnquiry()}>Let’s find your drive <ArrowUpRight size={19}/></button></div>
      </section>

      <section className="next-chapter section-pad"><div><span className="eyebrow">THE ROAD DOESN’T END HERE.</span><h2>FIRST, THE CAR.<br/>THEN, <em>EVERYTHING ELSE.</em></h2></div><div className="future-list"><span><span>01</span> Remarkable cars <span className="live-label">EXPLORE NOW <ArrowUpRight size={14}/></span></span><span><span>02</span> Parts & accessories <small>COMING LATER</small></span><span><span>03</span> Garage & care <small>COMING LATER</small></span></div></section>

      <section className="final-cta section-pad"><span className="eyebrow">THAT NEXT-CHAPTER FEELING.</span><div><h2>YOUR NEXT DRIVE<br/>STARTS <span>HERE.</span></h2><button onClick={()=>openEnquiry()} className="cta-circle" aria-label="Prepare a car enquiry"><ArrowUpRight size={54}/></button></div><p>Let’s make the everyday a little more extraordinary.</p></section>
    </main>

    <footer className="site-footer section-pad"><div className="footer-top"><a href="#home" className="logo-link" aria-label="Back to top"><Wordmark large/></a><p>Good cars.<br/>Great stories.<br/><strong>Go make yours.</strong></p><div className="footer-links"><a href="#collection">The collection <ArrowUpRight size={14}/></a><a href="#experience">The experience <ArrowUpRight size={14}/></a><button onClick={()=>openEnquiry()}>Start a conversation <ArrowUpRight size={14}/></button></div></div><div className="footer-bottom"><span>© {new Date().getFullYear()} VELOCITY Motor Co. · Concept showroom</span><div><button onClick={()=>setPrivacyOpen(true)}>Privacy & demo info</button><a className="credits-link" href="/credits.html" target="_blank" rel="noreferrer">Photo credits <ArrowUpRight size={11}/></a><button className="motion-toggle" onClick={()=>{if(window.matchMedia("(prefers-reduced-motion: reduce)").matches){setReducedMotion(true);notify("Reduced motion is enabled in your device settings.");}else setReducedMotion(value=>!value);}} aria-pressed={!reducedMotion}>{reducedMotion ? <Pause size={12}/> : <Play size={12}/>} Motion {reducedMotion ? 'off' : 'on'}</button><a href="#home">BACK TO TOP <ArrowUpRight size={13}/></a></div></div></footer>

    {compareIds.length > 0 && !compareOpen && <aside className="compare-dock" aria-label="Selected cars for comparison"><div className="compare-thumbnails">{compared.map(car=><img key={car.id} src={car.image} alt={`${car.brand} ${car.model}`}/>)}</div><span><strong>{compareIds.length} / 3</strong> <span className="compare-dock-label">in your shortlist</span></span><button onClick={()=>setCompareOpen(true)} className="button button-lime">Compare cars <ArrowRight size={16}/></button><button className="dock-clear" onClick={()=>setCompareIds([])} aria-label="Clear comparison"><X size={17}/></button></aside>}
    <div className={`toast ${toast ? 'visible' : ''}`} role="status">{toast}</div>
    {selected && <VehicleDetails car={selected} onClose={()=>setSelected(null)} onEnquire={openEnquiry} onToggleSave={toggleSave} isSaved={saved.includes(selected.id)} onToggleCompare={toggleCompare} isCompared={compareIds.includes(selected.id)} compareLimitReached={compareIds.length >= 3 && !compareIds.includes(selected.id)}/>}
    {compareOpen && <CompareDialog cars={compared} onClose={()=>setCompareOpen(false)} onRemove={id=>setCompareIds(current=>current.filter(value=>value!==id))} onEnquire={openEnquiry}/>}
    {enquiry && <EnquiryDialog car={enquiry==='general'?undefined:enquiry} onClose={()=>setEnquiry(null)}/>}
    {matchOpen && <MatchFinder onClose={()=>setMatchOpen(false)} onApply={patch=>{setFilters({...initialFilters,...patch});setShowAll(true);setMatchOpen(false);setTimeout(()=>collectionRef.current?.scrollIntoView({behavior:reducedMotion?'instant':'smooth'}),80);}}/>}
    {privacyOpen && <Modal title="Privacy & this showroom" onClose={()=>setPrivacyOpen(false)}><div className="privacy-copy"><span className="eyebrow">A FEW USEFUL DETAILS</span><h3>Built for discovery.</h3><p>This is a concept showroom, not a live dealer inventory. Vehicle prices, mileage, colours and availability are sample data. Photos show reference vehicles; exact trims and equipment may differ.</p><h4>Your information stays with you.</h4><p>Saved car IDs are stored in this browser only. Enquiry details stay in memory while the form is open and can be downloaded as a text draft. No enquiries, bookings or payments are sent or processed by this demo.</p><h4>A little perspective on finance.</h4><p>The calculator uses the price, deposit, interest rate and term you choose. Estimates exclude fees, insurance and taxes. They are not lender offers.</p><h4>Real stock comes next.</h4><p>A dealership can connect its live inventory, verified photographs, contact details and enquiry service before accepting customer requests. Parts and garage services are planned for a later release.</p></div></Modal>}
  </>;
}

function CarCard({ car, index, saved, compared, onOpen, onSave, onCompare }: { car: Car; index: number; saved: boolean; compared: boolean; onOpen: ()=>void; onSave: ()=>void; onCompare: ()=>void }) {
  return <article className="car-card" style={{'--card-delay':`${Math.min(index,5)*45}ms`} as CSSProperties}>
    <div className="car-photo-wrap"><button className="car-image-button" onClick={onOpen} aria-label={`Explore ${car.brand} ${car.model}`}><img src={car.image} alt={car.imageAlt} loading="lazy" width="800" height="560"/><span className="image-open"><ArrowUpRight size={23}/></span></button><span className={`car-badge ${car.fuel==='Electric'?'badge-electric':''}`}>{car.fuel==='Electric' && <Zap size={11}/>} {car.badge}</span><button className={`save-car ${saved?'is-saved':''}`} aria-label={`${saved?'Unsave':'Save'} ${car.brand} ${car.model}`} aria-pressed={saved} onClick={onSave}><Heart size={18} fill={saved?'currentColor':'none'}/></button><span className="car-image-count">{car.bodyType.toUpperCase()} <span> / </span> {car.year}</span></div>
    <div className="car-info"><div className="car-title-row"><div><p className="car-brand">{car.brand}</p><h3><button onClick={onOpen}>{car.model}</button></h3></div><span className="car-color" style={{backgroundColor:car.colorHex}} title={car.color} aria-label={`Colour: ${car.color}`}/></div><div className="car-specs"><span><Gauge size={13}/>{formatMileage(car.mileage)}</span><span>{car.fuel==='Electric'?<Zap size={13}/>:<span className="spec-dot"/>}{car.fuel}</span><span>{car.transmission.includes('PDK')?'PDK':car.fuel==='Electric'?'Automatic':'Auto'}</span></div><div className="car-price-row"><div><span className="price-caption">MAKE IT YOUR NEXT CHAPTER</span><strong>{formatPrice(car.price)}</strong></div><button className="card-arrow" onClick={onOpen} aria-label={`View ${car.brand} ${car.model} details`}><ArrowUpRight size={22}/></button></div><button className={`compare-car ${compared?'is-compared':''}`} onClick={onCompare} aria-pressed={compared}>{compared?<Check size={13}/>:<Plus size={13}/>} {compared?'Added to comparison':'Add to compare'}</button></div>
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

function MatchFinder({onClose,onApply}:{onClose:()=>void;onApply:(filters:CatalogFilters)=>void}) {
  const [style,setStyle]=useState('all');
  const [budget,setBudget]=useState('40000000');
  const choices=[{id:'performance',icon:<Gauge/>,title:'A little adrenaline',detail:'Low, sculpted and built for the drive.'},{id:'SUV',icon:<Mountain/>,title:'The great escape',detail:'Room for your people. And your plans.'},{id:'electric',icon:<Zap/>,title:'A different energy',detail:'Quiet confidence. Electric character.'},{id:'all',icon:<Sparkles/>,title:'Surprise me',detail:'I’ll know it when I see it.'}];
  return <Modal title="Find your kind of drive" onClose={onClose}><div className="match-content"><span className="eyebrow">FOLLOW YOUR INSTINCT.</span><h3>WHAT MOVES YOU?</h3><p>A few pointers. A collection that feels more like you.</p><div className="match-choices">{choices.map(choice=><button key={choice.id} className={style===choice.id?'selected':''} aria-pressed={style===choice.id} onClick={()=>setStyle(choice.id)}>{choice.icon}<strong>{choice.title}</strong><span>{choice.detail}</span>{style===choice.id && <Check size={15} className="match-check"/>}</button>)}</div><label className="match-budget">AND YOUR COMFORT ZONE?<select value={budget} onChange={e=>setBudget(e.target.value)}><option value="40000000">Let me explore everything</option><option value="15000000">Up to KSh 15 million</option><option value="20000000">Up to KSh 20 million</option><option value="25000000">Up to KSh 25 million</option><option value="30000000">Up to KSh 30 million</option></select></label><button className="button button-lime match-submit" onClick={()=>onApply({bodyType:style==='performance'?'Coupe':style==='SUV'?'SUV':'all',fuel:style==='electric'?'Electric':'all',maxPrice:Number(budget)})}>Show me my kind of cars <ArrowUpRight size={18}/></button></div></Modal>;
}

export default App;
