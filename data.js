const BASE_ZOOM   = 15.4;
const LINE_WEIGHT = 6;

const COLLEGES = {
  revelle:  { name: "Revelle College",          lat: 32.8752, lng: -117.2420 },
  muir:     { name: "Muir College",              lat: 32.8790, lng: -117.2431 },
  marshall: { name: "Marshall College",          lat: 32.8824, lng: -117.2404 },
  sixth:    { name: "Sixth College",             lat: 32.8804, lng: -117.2422 },
  erc:      { name: "Eleanor Roosevelt College", lat: 32.8852, lng: -117.2429 },
  seventh:  { name: "Seventh College",           lat: 32.8881, lng: -117.2425 },
  warren:   { name: "Warren College",            lat: 32.8822, lng: -117.2340 },
  eighth:   { name: "Eighth College",            lat: 32.8728, lng: -117.2425 }
};

const GRAVITY_CENTERS = {
  geisel:  { name: "Geisel Library",         label: "Academic Core",          lat: 32.8811, lng: -117.2376, color: "#38bdf8" },
  rimac:   { name: "RIMAC Arena",             label: "Athletic North Pole",    lat: 32.8853, lng: -117.2400, color: "#fb923c" },
  price:   { name: "Price Center",            label: "Social & Transit Core",  lat: 32.8797, lng: -117.2365, color: "#a78bfa" },
  trolley: { name: "Trolley Station",  label: "External Transit Ingress", lat: 32.8783, lng: -117.2318, color: "#ffcd00" }
};

const WALK_TIMES = {
  geisel:  { revelle:12, muir:10,  marshall:5,  sixth:7,  erc:10,  seventh:15, warren:7,  eighth:16 },
  price:   { revelle:11, muir:11,  marshall:7,  sixth:8,  erc:12, seventh:17, warren:5,  eighth:15 },
  rimac:   { revelle:17, muir:12, marshall:4,  sixth:7,  erc:4,  seventh:6,  warren:12,  eighth:21  },
  trolley: { revelle:19, muir:20, marshall:16, sixth:18, erc:23, seventh:26, warren:8,  eighth:23 }
};

const STEP_CFG = {
  "campus-origins": {
    center: [32.8810, -117.2375],
    zoom: BASE_ZOOM,
    showColleges: true,
    showAllCenters: false,
    gravity: null
  },
  "gravity-intro": {
    center: [32.8810, -117.2375],
    zoom: BASE_ZOOM,
    showColleges: false,
    showAllCenters: true,
    gravity: null
  },
  "geisel-gravity":  { center: [32.8811, -117.2376], zoom: BASE_ZOOM + 1.5, showColleges: true, gravity: "geisel"  },
  "price-gravity":   { center: [32.8797, -117.2365], zoom: BASE_ZOOM + 1.5, showColleges: true, gravity: "price"   },
  "rimac-gravity":   { center: [32.8853, -117.2396], zoom: BASE_ZOOM + 1.5, showColleges: true, gravity: "rimac"   },
  "trolley-gravity": { center: [32.8783, -117.2318], zoom: BASE_ZOOM + 1.5, showColleges: true, gravity: "trolley" },
  "map-release":     { center: [32.8810, -117.2375], zoom: BASE_ZOOM,       gravity: null, showColleges: false, showAllCenters: false },
  "synthesis-1":     { center: [32.8810, -117.2375], showColleges: true, gravity: "synthesis-geisel"  },
  "synthesis-2":     { center: [32.8810, -117.2375], showColleges: true, gravity: "synthesis-rimac"   },
  "synthesis-3":     { center: [32.8810, -117.2375], showColleges: true, gravity: "synthesis-price"   },
  "synthesis-4":     { center: [32.8810, -117.2375], showColleges: true, gravity: "synthesis-trolley" }
};

const centerIcons = {
  geisel:  "📚",
  price:   "🍽️",
  rimac:   "🏋️",
  trolley: "🚆"
};
