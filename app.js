// ═══════════════════════════════════════════
// STATE
// ═══════════════════════════════════════════

let walkRadiusCircle  = null;
let visibleCollegeSet = new Set();
let synthDarkOverlay  = null;

// ═══════════════════════════════════════════
// MAP SETUP
// ═══════════════════════════════════════════

const map = L.map("map", { scrollWheelZoom: false, zoomControl: true, attributionControl: true });

L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
  attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: "abcd", maxZoom: 20
}).addTo(map);

map.createPane("ucsdPane");
const ucsdPane = map.getPane("ucsdPane");
ucsdPane.style.zIndex        = 250;
ucsdPane.style.filter        = "brightness(0.72) saturate(0.88)";
ucsdPane.style.pointerEvents = "none";

L.tileLayer("https://assets.concept3d.com/assets/1005/1005_Map_Nov2025_693328374dd8f/{z}/{x}/{y}", {
  pane: "ucsdPane", tms: true, minZoom: 11, maxZoom: 20,
  attribution: "Map © UC San Diego / Concept3D",
  errorTileUrl: "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7"
}).addTo(map);

map.fitBounds([[32.8710, -117.2460], [32.8920, -117.2300]]);

// ── College markers ──
const collegeMarkers = {};
Object.entries(COLLEGES).forEach(([id, c]) => {
  collegeMarkers[id] = L.marker([c.lat, c.lng], {
    icon: L.divIcon({
      className: "college-icon",
      html: `<div class="college-wrap"><img src="logos/${id}.png" alt="${c.name}" /></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    })
  }).bindTooltip(c.name, { direction: "top", offset: [0, -18], className: "ucsd-tooltip" }).addTo(map);
  const el = collegeMarkers[id].getElement();
  if (el) { el.style.opacity = 0; el.style.pointerEvents = 'none'; }
});

// ── Gravity centre markers ──
const centerMarkers = {};
Object.entries(GRAVITY_CENTERS).forEach(([id, c]) => {
  centerMarkers[id] = L.marker([c.lat, c.lng], {
    icon: L.divIcon({
      className: "center-icon",
      html: `
        <div class="center-wrap" style="--color:${c.color}; --glow:${c.color}">
          <div class="center-inner">
            <span style="font-size:1.4em">${centerIcons[id]}</span>
          </div>
        </div>`,
      iconSize: [44, 44],
      iconAnchor: [22, 22]
    })
  }).bindTooltip(`${c.name} — ${c.label}`, { direction: "top", offset: [0, -18], className: "ucsd-tooltip" }).addTo(map);
  const el = centerMarkers[id].getElement();
  if (el) { el.style.opacity = 0; el.style.pointerEvents = 'none'; }
});

// ── DOM refs ──
const infoBox    = document.getElementById("info-box");
const ibTitle    = document.getElementById("ib-title");
const ibNear     = document.getElementById("ib-near");
const ibNearName = document.getElementById("ib-near-name");
const ibFar      = document.getElementById("ib-far");
const ibFarName  = document.getElementById("ib-far-name");
const ibNote     = document.getElementById("ib-note");
const legend     = document.getElementById("map-legend");

// ═══════════════════════════════════════════
// INFO BOX + LEGEND
// ═══════════════════════════════════════════

function showCenterInfo(centerId) {
  const c      = GRAVITY_CENTERS[centerId];
  const times  = WALK_TIMES[centerId];
  const sorted = Object.entries(times).sort((a, b) => a[1] - b[1]);
  const [nearId, nearTime] = sorted[0];
  const [farId,  farTime]  = sorted[sorted.length - 1];
  const avg = Math.round(Object.values(times).reduce((s, v) => s + v, 0) / Object.values(times).length);

  ibTitle.textContent    = c.name;
  ibTitle.style.color    = c.color;
  ibNear.textContent     = nearTime;
  ibNear.style.color     = c.color;
  ibNearName.textContent = COLLEGES[nearId].name;
  ibFar.textContent      = farTime;
  ibFar.style.color      = "#ef4444";
  ibFarName.textContent  = COLLEGES[farId].name;
  ibNote.textContent     = `${c.label} · avg walk: ${avg} min to all 8 colleges`;
  infoBox.classList.add("visible");
}

function hideInfo() { infoBox.classList.remove("visible"); }

function updateLegend(ids) {
  if (!ids || ids.length === 0) {
    legend.classList.remove("visible");
    legend.innerHTML = "";
    return;
  }
  legend.innerHTML = ids.map(id => {
    const c = GRAVITY_CENTERS[id];
    return `<div class="legend-row">
      <div class="legend-icon-outer" style="background:${c.color}">
        <div class="legend-icon-inner">${centerIcons[id]}</div>
      </div>
      <span class="legend-name" style="color:${c.color}">${c.name}</span>
    </div>`;
  }).join("");
  legend.classList.add("visible");
}

// ═══════════════════════════════════════════
// MARKER HELPERS
// ═══════════════════════════════════════════

function clearGravityState() {
  if (walkRadiusCircle) { map.removeLayer(walkRadiusCircle); walkRadiusCircle = null; }
  visibleCollegeSet.clear();
  hideInfo();
}

function updateCenterAnimations(activeId) {
  Object.entries(centerMarkers).forEach(([id, marker]) => {
    const el   = marker.getElement?.();
    const wrap = el?.querySelector(".center-wrap");
    if (!wrap) return;
    wrap.classList.toggle("center-active", id === activeId);
  });
}

function distanceMeters(a, b) {
  const R    = 6371000;
  const toRad = d => d * Math.PI / 180;
  const dLat  = toRad(b.lat - a.lat);
  const dLng  = toRad(b.lng - a.lng);
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function updateWalkableRadius(centerId) {
  const center = GRAVITY_CENTERS[centerId];
  const radius = 500;

  if (walkRadiusCircle) map.removeLayer(walkRadiusCircle);
  walkRadiusCircle = L.circle([center.lat, center.lng], {
    radius, color: center.color, weight: 2, fillOpacity: 0.08, opacity: 0.6
  }).addTo(map);

  visibleCollegeSet.clear();
  Object.entries(COLLEGES).forEach(([id, c]) => {
    const el = collegeMarkers[id].getElement();
    if (distanceMeters(center, c) <= radius) {
      visibleCollegeSet.add(id);
      if (el) el.style.opacity = 1;
    } else {
      if (el) el.style.opacity = 0.35;
    }
  });
}

function updateMarkers(cfg) {
  const showColleges = cfg.showColleges !== false;
  const isSynth      = cfg.gravity?.startsWith('synthesis-');

  if (!isSynth) {
    Object.values(collegeMarkers).forEach(m => {
      const el = m.getElement?.();
      if (!el) return;
      el.style.opacity       = showColleges ? 1 : 0;
      el.style.pointerEvents = showColleges ? '' : 'none';
    });
  }

  Object.entries(centerMarkers).forEach(([id, m]) => {
    const show = cfg.showAllCenters || (cfg.gravity && !isSynth && id === cfg.gravity);
    const el   = m.getElement?.();
    if (!el) return;
    el.style.opacity       = show ? 1 : 0;
    el.style.pointerEvents = show ? '' : 'none';
  });
}

// ═══════════════════════════════════════════
// LINE DRAWING
// ═══════════════════════════════════════════

let gravityLines = [];

function clearGravityLines() {
  gravityLines.forEach(l => map.hasLayer(l) && map.removeLayer(l));
  gravityLines = [];
}

function addLine(coords, opts) {
  const poly = L.polyline(coords, { lineCap: "round", ...opts }).addTo(map);
  gravityLines.push(poly);
  if (opts.flow) {
    const el = poly.getElement?.();
    if (el) el.classList.add("flow-line");
  }
  return poly;
}

function drawAfterMove(drawFn) {
  const expectedKey = activeKey;
  const handler = () => {
    pendingDraw = null;
    if (activeKey !== expectedKey) return;
    drawFn();
  };
  pendingDraw = handler;
  map.once("moveend", handler);
}

// Stroke-dasharray draw-on animation.
// getBoundingClientRect() forces a synchronous reflow so the CSS transition
// restarts from the hidden state rather than being skipped by the browser.
function animateLine(poly, delayMs = 0, flow = false, duration = 1.4) {
  const start = () => {
    const el = poly.getElement();
    if (!el || typeof el.getTotalLength !== "function") { requestAnimationFrame(start); return; }
    const len = el.getTotalLength();
    if (!len) return;
    el.style.strokeDasharray = len;
    if (flow) {
      let offset = len;
      el.style.strokeDashoffset = offset;
      const speed = 3.2;
      (function loop() {
        offset -= speed;
        if (offset < 0) offset = len;
        el.style.strokeDashoffset = offset;
        requestAnimationFrame(loop);
      })();
    } else {
      el.style.strokeDashoffset = len;
      void el.getBoundingClientRect();
      el.style.transition       = `stroke-dashoffset ${duration}s ease`;
      el.style.strokeDashoffset = "0";
    }
  };
  const run = () => requestAnimationFrame(start);
  delayMs ? setTimeout(run, delayMs) : run();
}

function drawGravityCenter(centerId) {
  const center   = GRAVITY_CENTERS[centerId];
  const allTimes = WALK_TIMES[centerId];
  const times    = Object.fromEntries(
    Object.entries(allTimes).filter(([cid]) => visibleCollegeSet.has(cid))
  );
  if (Object.keys(times).length === 0) return;
  Object.entries(times).forEach(([cid]) => {
    const coords = [[center.lat, center.lng], [COLLEGES[cid].lat, COLLEGES[cid].lng]];
    addLine(coords, { color: center.color, weight: LINE_WEIGHT * 2.2, opacity: 0.13 });
    const poly = addLine(coords, { color: center.color, weight: LINE_WEIGHT, opacity: 0.9, dashArray: '0 10000' });
    animateLine(poly, 0, false, 1.25);
  });
}

function drawSynthesisUpTo(centerId) {
  const ORDER    = ['geisel', 'rimac', 'price', 'trolley'];
  const upTo     = ORDER.indexOf(centerId);
  const revealed = ORDER.slice(0, upTo + 1);

  clearGravityLines();
  updateLegend(revealed);

  if (!synthDarkOverlay) { synthDarkOverlay = new SynthDarkLayer(); synthDarkOverlay.addTo(map); }
  synthDarkOverlay.setIds(revealed);

  Object.values(collegeMarkers).forEach(m => {
    const el = m.getElement?.();
    if (el) { el.style.opacity = 0.35; el.style.pointerEvents = 'none'; }
  });
  revealed.forEach(cid => {
    const center = GRAVITY_CENTERS[cid];
    Object.entries(COLLEGES).forEach(([colId, col]) => {
      if (distanceMeters(center, col) <= 500) {
        const el = collegeMarkers[colId].getElement?.();
        if (el) { el.style.opacity = 1; el.style.pointerEvents = ''; }
      }
    });
  });

  revealed.forEach((cid, i) => {
    const isNew  = i === upTo;
    const center = GRAVITY_CENTERS[cid];

    const circle = L.circle([center.lat, center.lng], {
      radius: 500, color: center.color, weight: 1.5, fillOpacity: 0.06, opacity: 0.5
    }).addTo(map);
    gravityLines.push(circle);

    const el = centerMarkers[cid].getElement?.();
    if (el) { el.style.opacity = 1; el.style.pointerEvents = ''; }

    const inCircle = Object.entries(WALK_TIMES[cid]).filter(([cId]) =>
      distanceMeters(center, COLLEGES[cId]) <= 500
    );
    if (inCircle.length === 0) return;

    inCircle.forEach(([cId]) => {
      const coords = [[center.lat, center.lng], [COLLEGES[cId].lat, COLLEGES[cId].lng]];
      addLine(coords, { color: center.color, weight: LINE_WEIGHT * 2.2, opacity: 0.13 });
      if (isNew) {
        const poly = addLine(coords, { color: center.color, weight: LINE_WEIGHT, opacity: 0.9, dashArray: '0 10000' });
        animateLine(poly, 0, false, 1.0);
      } else {
        addLine(coords, { color: center.color, weight: LINE_WEIGHT, opacity: 0.9 });
      }
    });
  });
}

// ═══════════════════════════════════════════
// SYNTHESIS DARK OVERLAY
// Canvas attached directly to the map container (not a pane) so it is unaffected
// by Leaflet's CSS transforms during flyTo zoom animations.
// Listens to 'move' so the spotlight tracks smoothly during animation.
// ═══════════════════════════════════════════

const SynthDarkLayer = L.Layer.extend({
  initialize() { this._ids = []; },

  onAdd(map) {
    this._canvas = document.createElement('canvas');
    this._canvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;z-index:450;';
    map.getContainer().appendChild(this._canvas);
    this._ctx = this._canvas.getContext('2d');
    this._redraw();
    map.on('move moveend resize', this._redraw, this);
    return this;
  },

  onRemove(map) {
    this._canvas.remove();
    map.off('move moveend resize', this._redraw, this);
  },

  setIds(ids) { this._ids = ids; if (this._canvas) this._redraw(); return this; },

  _redraw() {
    const map  = this._map;
    const size = map.getSize();
    const cv   = this._canvas;
    cv.width  = size.x;
    cv.height = size.y;

    const ctx = this._ctx;
    ctx.fillStyle = 'rgba(24,35,48,0.78)';
    ctx.fillRect(0, 0, size.x, size.y);

    ctx.globalCompositeOperation = 'destination-out';
    this._ids.forEach(cid => {
      const c  = GRAVITY_CENTERS[cid];
      const cp = map.latLngToContainerPoint([c.lat, c.lng]);
      const ep = map.latLngToContainerPoint([c.lat + (500 / 6371000) * (180 / Math.PI), c.lng]);
      ctx.beginPath();
      ctx.arc(cp.x, cp.y, Math.abs(cp.y - ep.y), 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalCompositeOperation = 'source-over';
  }
});

function removeSynthOverlay() {
  if (synthDarkOverlay) { map.removeLayer(synthDarkOverlay); synthDarkOverlay = null; }
}

// ═══════════════════════════════════════════
// STEP HANDLER
// ═══════════════════════════════════════════

let activeKey      = null;
let pendingDraw    = null;
let lastGravityKey = null;

function cancelPendingDraw() {
  if (pendingDraw) { map.off("moveend", pendingDraw); pendingDraw = null; }
}

function applyStep(key) {
  const cfg = STEP_CFG[key];
  if (!cfg) return;

  const isSynth = cfg.gravity?.startsWith('synthesis-');
  activeKey = key;
  cancelPendingDraw();

  const gravityChanged = cfg.gravity !== lastGravityKey;
  if (gravityChanged) clearGravityLines();

  if (!cfg.gravity) clearGravityState();

  if (gravityChanged) {
    if (!cfg.gravity) removeSynthOverlay();
    hideInfo();
    lastGravityKey = cfg.gravity;
  }

  updateMarkers(cfg);

  if (cfg.showAllCenters) {
    updateLegend(Object.keys(GRAVITY_CENTERS));
  } else if (cfg.gravity && !isSynth) {
    updateLegend([cfg.gravity]);
  } else if (!isSynth) {
    updateLegend([]);
  }

  updateCenterAnimations(isSynth ? null : cfg.gravity);

  if (isSynth) {
    // Always redraw — updateMarkers hides all centre icons for synth steps and relies on
    // drawSynthesisUpTo to restore them. Without this, re-entering the same synthesis step
    // (gravityChanged = false) leaves all icons hidden.
    drawSynthesisUpTo(cfg.gravity.replace('synthesis-', ''));
  } else if (gravityChanged && cfg.gravity) {
    updateWalkableRadius(cfg.gravity);
    // Show overlay immediately so it's present during the flyTo, not after
    if (!synthDarkOverlay) { synthDarkOverlay = new SynthDarkLayer(); synthDarkOverlay.addTo(map); }
    synthDarkOverlay.setIds([cfg.gravity]);
    // Register handler before flyTo — flyTo's internal stop() may fire moveend synchronously
    // for short hops (e.g. price→trolley), swallowing the event before map.once registers.
    drawAfterMove(() => drawGravityCenter(cfg.gravity));
  }

  const zoomTarget = (cfg.gravity && !isSynth) ? BASE_ZOOM + 1 : BASE_ZOOM;
  map.flyTo(cfg.center, zoomTarget, { duration: 0.9, easeLinearity: 0.25 });

  document.getElementById("map-panel").classList.toggle("map-faded", key === "map-release");
}

// ═══════════════════════════════════════════
// SCROLLAMA
// ═══════════════════════════════════════════

const scroller = scrollama();
scroller.setup({ step: ".step", offset: 0.48 })
  .onStepEnter(({ element }) => applyStep(element.dataset.step));
window.addEventListener("resize", scroller.resize);

map.setView([32.8810, -117.2375], BASE_ZOOM);

// ═══════════════════════════════════════════
// PROFILES HEATMAP
// ═══════════════════════════════════════════

const PROFILE_STEPS  = ['geisel', 'rimac', 'price', 'trolley', 'average', 'reorder', 'ranked'];
const COLUMN_STEPS   = ['geisel', 'rimac', 'price', 'trolley', 'average'];

function showColumnAnimated(id) {
  document.querySelectorAll('.col-' + id).forEach(el => {
    el.classList.remove('col-hidden');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('visible')));
  });
}

function hideColumn(id) {
  document.querySelectorAll('.col-' + id).forEach(el => {
    el.classList.remove('visible');
    setTimeout(() => { if (!el.classList.contains('visible')) el.classList.add('col-hidden'); }, 450);
  });
}

function hideAllProfileColumns() { PROFILE_STEPS.forEach(hideColumn); }

let hasReordered = false;

function reorderByAverage() {
  if (hasReordered) return;
  hasReordered = true;

  const tbody = document.querySelector('.profile-table tbody');
  if (!tbody) return;
  const rows = Array.from(tbody.querySelectorAll('tr'));

  // FLIP — First: snapshot each row's current position
  const firstTop = new Map(rows.map(r => [r, r.getBoundingClientRect().top]));

  // Sort and reorder in the DOM
  rows.sort((a, b) => {
    const av = parseFloat(a.querySelector('.col-average')?.textContent) || 999;
    const bv = parseFloat(b.querySelector('.col-average')?.textContent) || 999;
    return av - bv;
  });
  rows.forEach(r => tbody.appendChild(r));

  // Stamp rank numbers while rows are still invisible to the eye
  rows.forEach((r, i) => {
    const cell = r.querySelector('.col-rank');
    if (cell) cell.textContent = i + 1;
  });

  // FLIP — Invert: push each row back to where it was
  rows.forEach(r => {
    const delta = firstTop.get(r) - r.getBoundingClientRect().top;
    r.style.transition = 'none';
    r.style.transform  = `translateY(${delta}px)`;
  });

  // Force reflow so the inverted positions are painted before we release them
  tbody.getBoundingClientRect();

  // FLIP — Play: let each row slide to its final position
  rows.forEach((r, i) => {
    r.style.transition = `transform 0.55s cubic-bezier(0.25, 0.46, 0.45, 0.94) ${i * 18}ms`;
    r.style.transform  = 'translateY(0)';
    r.addEventListener('transitionend', () => {
      r.style.transition = '';
      r.style.transform  = '';
    }, { once: true });
  });
}

function updateProfileStep(step) {
  const isRanked  = step === 'ranked';
  const isReorder = step === 'reorder';
  const isDimmed  = step === 'average' || step === 'reorder';
  // 'reorder' shows the same columns as 'average'
  const displayIdx = COLUMN_STEPS.indexOf(step === 'reorder' ? 'average' : step);

  if (isRanked) {
    ['geisel', 'rimac', 'price', 'trolley'].forEach((s, i) => {
      setTimeout(() => hideColumn(s), i * 150);
    });
    document.querySelectorAll('.col-average').forEach(el => el.classList.remove('col-dimmed'));
    setTimeout(() => {
      showColumnAnimated('rank');
      document.querySelector('.profile-table')?.classList.add('table-ranked');
    }, 300);
  } else {
    hideColumn('rank');
    document.querySelector('.profile-table')?.classList.remove('table-ranked');
    COLUMN_STEPS.forEach((s, i) => { if (i <= displayIdx) showColumnAnimated(s); else hideColumn(s); });
    ['geisel', 'rimac', 'price', 'trolley'].forEach(s => {
      document.querySelectorAll('.col-' + s).forEach(el => el.classList.toggle('col-dimmed', isDimmed));
    });
    if (isReorder) reorderByAverage();
  }
}

const profileScroller = scrollama();
profileScroller.setup({ step: '.profile-step', offset: 0.6 })
  .onStepEnter(({ element }) => updateProfileStep(element.dataset.profile))
  .onStepExit(({ element, direction }) => {
    if (direction === 'up' && element.dataset.profile === 'geisel') hideAllProfileColumns();
  });

const colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([25, 6]);

function buildProfiles() {
  const container     = document.getElementById("profiles-chart");
  const COLLEGE_ORDER = ['revelle','muir','marshall','warren','erc','sixth','seventh','eighth'];
  const colleges      = COLLEGE_ORDER.map(id => [id, COLLEGES[id]]);
  const centers       = Object.entries(GRAVITY_CENTERS);

  const table = d3.select(container).append("table").attr("class", "profile-table");

  const thead = table.append("thead").append("tr");
  thead.append("th").attr("class", "col-header col-rank");
  thead.append("th");
  centers.forEach(([centerId, c]) => {
    thead.append("th")
      .attr("class", "col-header col-" + centerId)
      .html(`
        <div class="header-icon-wrap">
          <div class="center-wrap-sm" style="background:${c.color}">
            <div class="center-inner-sm">${centerIcons[centerId]}</div>
          </div>
          <div class="header-label" style="color:${c.color}">${c.name.split(" ")[0]}</div>
        </div>`);
  });
  thead.append("th")
    .attr("class", "col-header col-average")
    .html(`
      <div class="header-icon-wrap">
        <div class="center-wrap-sm" style="background:#fff; box-shadow:0 0 0 1px rgba(255,255,255,0.12), 0 3px 8px rgba(0,0,0,0.5)">
          <span style="font-size:14px;line-height:1">📊</span>
        </div>
        <div class="header-label" style="color:rgba(255,255,255,0.8)">Avg</div>
      </div>`);

  const tbody = table.append("tbody");
  colleges.forEach(([collegeId, college]) => {
    const tr = tbody.append("tr");
    tr.append("td")
      .attr("class", "profile-cell col-rank")
      .style("background", "none")
      .style("color", "rgba(255,255,255,0.65)")
      .style("font-size", "0.8rem")
      .text("—");

    tr.append("td")
      .attr("class", "profile-name")
      .html(`
        <div class="college-label-wrap">
          <div class="college-wrap-sm">
            <img src="logos/${collegeId}.png" alt="${college.name}" />
          </div>
          <span>${collegeId === 'erc' ? 'ERC' : college.name.replace(' College', '')}</span>
        </div>`);

    centers.forEach(([centerId]) => {
      const t      = WALK_TIMES[centerId][collegeId];
      const bg     = colorScale(t);
      const txtCol = t < 18 ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.92)";
      tr.append("td")
        .attr("class", "profile-cell col-" + centerId)
        .style("background", bg)
        .style("color", txtCol)
        .text(t + " min");
    });

    const vals   = Object.values(WALK_TIMES).map(c => c[collegeId]);
    const avg    = Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
    const avgBg  = colorScale(avg);
    const avgTxt = avg < 18 ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.92)";
    tr.append("td")
      .attr("class", "profile-cell col-average")
      .style("background", avgBg)
      .style("color", avgTxt)
      .text(avg + " min");
  });

  document.querySelectorAll(".profile-cell, .col-header").forEach(el => el.classList.add('col-hidden'));
}

new IntersectionObserver((entries, obs) => {
  if (entries[0].isIntersecting) { buildProfiles(); obs.disconnect(); updateProfileStep('geisel'); }
}, { threshold: 0.15 }).observe(document.getElementById("profiles-wrapper"));
