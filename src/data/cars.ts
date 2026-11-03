/**
 * Illustrative inventory for the VELOCITY showroom demonstration.
 * Asking prices, registrations, mileage and stock descriptions are fictional.
 * Reference specifications and their model-year assumptions are documented in
 * docs/VEHICLE_SOURCES.md. Never present these records as live dealer stock.
 */
export type BodyType = 'Coupe' | 'SUV' | 'Sedan';
export type FuelType = 'Petrol' | 'Diesel' | 'Electric' | 'Hybrid';

export interface Car {
  id: string;
  brand: string;
  model: string;
  year: number;
  /** Illustrative asking price in Kenyan shillings, not a market valuation. */
  price: number;
  bodyType: BodyType;
  fuel: FuelType;
  transmission: string;
  drivetrain: string;
  mileage: number;
  /** Metric horsepower (PS), excluding temporary electric launch boost. */
  power: number;
  powerNote?: string;
  /** Manufacturer 0–100 km/h time in seconds; null when not verified. */
  acceleration: number | null;
  /** Manufacturer top speed in km/h; null when not verified. */
  topSpeed: number | null;
  engine: string;
  color: string;
  colorHex: string;
  seats: number;
  badge?: string;
  tagline: string;
  description: string;
  features: string[];
  image: string;
  imageAlt: string;
  /** Photo provenance limitations shown with the vehicle details. */
  imageNote?: string;
  gallery: string[];
  featured: boolean;
}

export const inventoryNotice = 'Demonstration collection. Prices, mileage and availability are illustrative; photographs show reference vehicles.';

export const cars: Car[] = [
  {
    id: 'porsche-911-gt3', brand: 'Porsche', model: '911 GT3', year: 2023,
    price: 28900000, bodyType: 'Coupe', fuel: 'Petrol',
    transmission: '7-speed PDK', drivetrain: 'Rear-wheel drive', mileage: 4200,
    power: 510, acceleration: 3.4, topSpeed: 318, engine: '4.0L naturally aspirated flat-six',
    color: 'Black', colorHex: '#242628', seats: 2, badge: 'Driver’s choice',
    tagline: 'Some cars get you there. This one makes you feel it.',
    description: 'The road becomes the occasion. A high-revving flat-six, a purposeful rear wing and the unmistakable 911 silhouette make every detail feel connected to the drive. This sample represents a 992.1 GT3 with PDK.',
    features: ['9,000 rpm redline', 'Double-wishbone front axle', 'Rear-axle steering', 'Swan-neck rear wing', 'Sport and Track driving modes', '7-speed dual-clutch PDK'],
    image: '/images/porsche-911-gt3.webp', imageAlt: 'Black Porsche 911 GT3 in side profile on a racetrack',
    imageNote: 'Reference photo of a 992-generation GT3. Transmission, model year and fitted options are not verified from the photograph.',
    gallery: ['/images/porsche-911-gt3.webp'], featured: true,
  },
  {
    id: 'bmw-m4-competition', brand: 'BMW', model: 'M4 Competition', year: 2022,
    price: 14950000, bodyType: 'Coupe', fuel: 'Petrol',
    transmission: '8-speed automatic', drivetrain: 'M xDrive AWD', mileage: 8600,
    power: 510, acceleration: 3.5, topSpeed: 250, engine: '3.0L twin-turbo inline-six',
    color: 'Lime yellow', colorHex: '#ccdf61', seats: 4, badge: 'Everyday adrenaline',
    tagline: 'Your weekday. With a weekend state of mind.',
    description: 'A confident coupe with room to bring someone along. The M4 combines an expressive shape with a twin-turbo straight-six and an adaptable all-wheel-drive system. Reference specification: pre-facelift Competition Coupe with M xDrive.',
    features: ['M xDrive all-wheel drive', 'Adaptive M suspension', 'Carbon-fibre roof', 'Active M differential', 'M-specific driving modes', '8-speed M Steptronic'],
    image: '/images/bmw-m4-competition.webp', imageAlt: 'Lime-yellow BMW M4 Competition G82 seen from the front three-quarter angle on a street',
    imageNote: 'Reference photo identified as a 2021 M4 Competition. The sample uses a 2022 xDrive specification; the photographed car’s drivetrain and options are not verified.',
    gallery: ['/images/bmw-m4-competition.webp'], featured: true,
  },
  {
    id: 'mercedes-amg-g63', brand: 'Mercedes-Benz', model: 'AMG G 63', year: 2023,
    price: 33500000, bodyType: 'SUV', fuel: 'Petrol',
    transmission: '9-speed automatic', drivetrain: '4MATIC AWD', mileage: 12400,
    power: 585, acceleration: 4.5, topSpeed: 220, engine: '4.0L twin-turbo V8',
    color: 'Blue', colorHex: '#438bb2', seats: 5, badge: 'Presence, perfected',
    tagline: 'An icon with absolutely nothing to prove.',
    description: 'Upright lines. A commanding stance. An unmistakable presence. The G 63 brings a V8 soundtrack to the classic G-Class shape. This demonstration uses the pre-2024-facelift petrol model as its reference.',
    features: ['AMG Performance 4MATIC', 'Three differential locks', 'AMG Ride Control suspension', 'Low-range gearing', 'AMG Dynamic Select', '9-speed AMG Speedshift'],
    image: '/images/mercedes-amg-g63.webp', imageAlt: 'Blue Mercedes-AMG G 63 in side profile beside ornamental grass',
    imageNote: 'Reference G 63 photograph. Model year, individual equipment and condition are not verified from the image.',
    gallery: ['/images/mercedes-amg-g63.webp'], featured: true,
  },
  {
    id: 'audi-rs-etron-gt', brand: 'Audi', model: 'RS e-tron GT', year: 2023,
    price: 17950000, bodyType: 'Sedan', fuel: 'Electric',
    transmission: '2-speed rear axle', drivetrain: 'quattro AWD', mileage: 7100,
    power: 598, powerNote: 'Up to 646 PS temporarily with Launch Control',
    acceleration: 3.3, topSpeed: 250, engine: 'Dual electric motors',
    color: 'Silver grey', colorHex: '#a0a4a7', seats: 5, badge: 'Electric instinct',
    tagline: 'Quiet on arrival. Unforgettable on the way.',
    description: 'A low-slung electric grand tourer that makes a statement without raising its voice. Sculpted proportions meet quattro traction in this first-generation RS e-tron GT reference specification.',
    features: ['Electric quattro all-wheel drive', '800-volt electrical architecture', 'Adaptive air suspension', 'Two-speed rear transmission', '93.4 kWh gross battery', 'Launch Control'],
    image: '/images/audi-rs-etron-gt.webp', imageAlt: 'Silver-grey Audi RS e-tron GT seen from the front three-quarter angle on a wooded road',
    imageNote: 'Reference photograph of a 2022 RS e-tron GT. The sample year and mileage are illustrative; individual options are not verified.',
    gallery: ['/images/audi-rs-etron-gt.webp'], featured: true,
  },
  {
    id: 'range-rover-sport', brand: 'Range Rover', model: 'Sport D300', year: 2023,
    price: 24900000, bodyType: 'SUV', fuel: 'Hybrid',
    transmission: '8-speed automatic', drivetrain: 'All-wheel drive', mileage: 15800,
    power: 300, acceleration: 6.6, topSpeed: 218, engine: '3.0L diesel inline-six mild hybrid',
    color: 'Metallic grey', colorHex: '#747674', seats: 5, badge: 'The grand escape',
    tagline: 'Make the long way home your favourite route.',
    description: 'Modern, restrained and ready for a change of scenery. The Range Rover Sport pairs a refined cabin with an athletic silhouette. This sample uses the 2023 D300 diesel mild-hybrid specification; it does not plug in.',
    features: ['Dynamic air suspension', '650 Nm diesel torque', 'Diesel mild-hybrid powertrain', 'Pivi Pro infotainment', '13.1-inch curved touchscreen', '8-speed automatic'],
    image: '/images/range-rover-sport.webp', imageAlt: 'Metallic-grey Range Rover Sport D300 L461 seen from the front three-quarter angle on a city street',
    imageNote: 'Reference photograph identified as an L461 D300. Individual trim, options and model year are not verified from the photograph.',
    gallery: ['/images/range-rover-sport.webp'], featured: false,
  },
  {
    id: 'defender-110', brand: 'Land Rover', model: 'Defender 110', year: 2024,
    price: 16900000, bodyType: 'SUV', fuel: 'Hybrid',
    transmission: '8-speed automatic', drivetrain: 'All-wheel drive', mileage: 19200,
    power: 400, acceleration: 6.1, topSpeed: 191, engine: '3.0L inline-six mild hybrid',
    color: 'Blue grey', colorHex: '#697d98', seats: 5, badge: 'Beyond the ordinary',
    tagline: 'The best stories begin where the tarmac ends.',
    description: 'Purposeful proportions and a spirit made for exploring. The Defender 110 brings familiar adventure character into a contemporary cabin. Reference variant: P400 petrol mild hybrid; it does not plug in.',
    features: ['P400 mild-hybrid powertrain', 'Twin-speed transfer box', 'Terrain Response', 'All-wheel drive', 'Pivi Pro infotainment', 'Five-seat reference layout'],
    image: '/images/defender-110.webp', imageAlt: 'Blue-grey Land Rover Defender 110 L663 seen from the front three-quarter angle at an outdoor display',
    imageNote: 'Reference photograph of a Defender 110. The P400 powertrain, seating and other sample specifications are not verified for the photographed vehicle.',
    gallery: ['/images/defender-110.webp'], featured: false,
  },
  {
    id: 'toyota-land-cruiser', brand: 'Toyota', model: 'Land Cruiser 300', year: 2024,
    price: 18500000, bodyType: 'SUV', fuel: 'Diesel',
    transmission: '10-speed automatic', drivetrain: 'Full-time 4WD', mileage: 23700,
    power: 309, acceleration: null, topSpeed: null, engine: '3.3L twin-turbo V6 diesel',
    color: 'White', colorHex: '#e6e4df', seats: 7, badge: 'Go further',
    tagline: 'For the journeys that become family legends.',
    description: 'A familiar name for ambitious journeys. The 300 Series keeps its body-on-frame foundation and pairs it with a twin-turbo diesel V6. Reference figures use the international 227 kW diesel specification; regional equipment differs.',
    features: ['700 Nm diesel torque', '10-speed automatic', 'Body-on-frame architecture', 'Full-time four-wheel drive', 'Low-range transfer case', 'Seven-seat reference layout'],
    image: '/images/toyota-land-cruiser.webp', imageAlt: 'White Toyota Land Cruiser 300 seen from the front three-quarter angle in a showroom',
    imageNote: 'Reference photograph of a Land Cruiser 300. The diesel powertrain and seven-seat sample specification are not verified for the photographed vehicle.',
    gallery: ['/images/toyota-land-cruiser.webp'], featured: false,
  },
  {
    id: 'porsche-taycan', brand: 'Porsche', model: 'Taycan 4S', year: 2022,
    price: 15900000, bodyType: 'Sedan', fuel: 'Electric',
    transmission: '2-speed rear axle', drivetrain: 'All-wheel drive', mileage: 11600,
    power: 435, powerNote: 'Up to 530 PS temporarily with Launch Control',
    acceleration: 4.0, topSpeed: 250, engine: 'Dual electric motors',
    color: 'Metallic grey', colorHex: '#85888b', seats: 4, badge: 'A different energy',
    tagline: 'A new kind of electric connection.',
    description: 'A Porsche perspective on the electric sports saloon: a low driving position, flowing lines and an unmistakable sense of occasion. This sample uses the original 4S with the standard Performance Battery.',
    features: ['800-volt architecture', 'Electric all-wheel drive', '79.2 kWh gross battery', 'Two-speed rear transmission', 'Adaptive air suspension', 'Launch Control'],
    image: '/images/porsche-taycan.webp', imageAlt: 'Metallic-grey Porsche Taycan seen from the rear three-quarter angle on a street',
    imageNote: 'Reference photograph of the original Taycan shape. The 4S trim, battery specification and model year are not verified for the photographed vehicle.',
    gallery: ['/images/porsche-taycan.webp'], featured: false,
  },
];

export const brands = [...new Set(cars.map((car) => car.brand))].sort();
export const bodyTypes: BodyType[] = ['Coupe', 'SUV', 'Sedan'];
export const fuelTypes: FuelType[] = ['Petrol', 'Diesel', 'Electric', 'Hybrid'];
