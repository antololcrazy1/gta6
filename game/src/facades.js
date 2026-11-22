// Procedural building facades for Vice Coast, drawn on canvases and reused
// as textures. Every building type has its own look: brick houses, glass
// offices, neon shophouses, concrete towers, warm restaurants, bright
// hotels, plain warehouses, small gas stations. Window grids, floor bands,
// entrance doors and signage bands are drawn per building, so two buildings
// of the same type never look identical — but the texture count is capped:
// textures are reused across buildings of the same type and floor count,
// and the factory reports how many it made against the budget.
import { CFG } from './config.js';

const FACADE_STYLE = {
  house: { base: '#c98a5a', band: '#a86a3a', window: '#ffe9a8', lit: 0.25, door: '#5a2a1a' },
  shophouse: { base: '#7a5a9a', band: '#4a2a6a', window: '#9fe8ff', lit: 0.6, door: '#1a1a2a', neon: true },
  office: { base: '#5a7a9a', band: '#3a5a7a', window: '#bfe8ff', lit: 0.45, door: '#223344', glass: true },
  tower: { base: '#8a8a9a', band: '#5a5a6a', window: '#ffe9a8', lit: 0.5, door: '#222233', glass: true },
  restaurant: { base: '#c95a3a', band: '#8a3a2a', window: '#ffd98a', lit: 0.7, door: '#3a1a1a' },
  hotel: { base: '#e8c84a', band: '#a88a2a', window: '#fff2b8', lit: 0.55, door: '#4a3a1a' },
  warehouse: { base: '#9a8a6a', band: '#6a5a4a', window: '#d8d8c8', lit: 0.15, door: '#3a3a3a' },
  gas: { base: '#e8e8e8', band: '#d84a4a', window: '#9fe8ff', lit: 0.8, door: '#222222' },
};

const NEON_SIGNS = ['24H', 'OPEN', 'PIZZA', 'TACOS', 'HOTEL', 'BAR', 'SHOP', 'CAFE', 'NEON', 'VICE'];

// The factory: one per game. Textures are cached by type + floors +
// variant, and the cache never grows past the budget.
export function createFacadeFactory(THREE) {
  const cache = new Map();
  const size = CFG.FACADE_SIZE;

  function drawFacade(type, floors, variant, rng) {
    const st = FACADE_STYLE[type] || FACADE_STYLE.house;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const g = canvas.getContext('2d');
    // Base wall.
    g.fillStyle = st.base;
    g.fillRect(0, 0, size, size);
    // Subtle vertical shading so the wall is not flat.
    const shade = g.createLinearGradient(0, 0, size, 0);
    shade.addColorStop(0, 'rgba(0,0,0,0.18)');
    shade.addColorStop(0.5, 'rgba(255,255,255,0.06)');
    shade.addColorStop(1, 'rgba(0,0,0,0.18)');
    g.fillStyle = shade;
    g.fillRect(0, 0, size, size);
    const floorH = size / Math.max(1, floors);
    for (let f = 0; f < floors; f += 1) {
      const y = f * floorH;
      // Floor band.
      g.fillStyle = st.band;
      g.fillRect(0, y, size, Math.max(2, floorH * 0.08));
      // Window row for this floor.
      const cols = type === 'tower' || type === 'office' ? 8 : 5;
      const winW = size / cols * 0.55;
      const winH = floorH * 0.55;
      for (let c = 0; c < cols; c += 1) {
        const x = (c + 0.5) * (size / cols) - winW / 2;
        const wy = y + floorH * 0.25;
        const lit = rng() < st.lit;
        if (st.glass) {
          // Glass curtain: a tall reflective pane.
          const grad = g.createLinearGradient(x, wy, x, wy + winH);
          grad.addColorStop(0, lit ? '#ffe9a8' : '#9fc8e8');
          grad.addColorStop(1, lit ? '#c98a2a' : '#3a6a8a');
          g.fillStyle = grad;
        } else {
          g.fillStyle = lit ? st.window : '#2a2a3a';
        }
        g.fillRect(x, wy, winW, winH);
        // Window frame.
        g.strokeStyle = 'rgba(0,0,0,0.35)';
        g.lineWidth = 1;
        g.strokeRect(x, wy, winW, winH);
        g.beginPath();
        g.moveTo(x + winW / 2, wy);
        g.lineTo(x + winW / 2, wy + winH);
        g.stroke();
      }
    }
    // Ground floor: entrance door in the middle.
    const doorW = size * 0.14;
    const doorH = floorH * 0.9;
    g.fillStyle = st.door;
    g.fillRect(size / 2 - doorW / 2, size - doorH, doorW, doorH);
    g.strokeStyle = 'rgba(255,255,255,0.25)';
    g.strokeRect(size / 2 - doorW / 2, size - doorH, doorW, doorH);
    // Signage band above the door for shops, restaurants and hotels.
    if (type === 'shophouse' || type === 'restaurant' || type === 'hotel' || type === 'gas') {
      const signY = size - floorH - size * 0.09;
      g.fillStyle = st.neon ? '#1a0a2a' : '#222222';
      g.fillRect(size * 0.08, signY, size * 0.84, size * 0.07);
      g.fillStyle = st.neon ? '#ff5ad8' : '#ffd94a';
      g.font = `bold ${Math.round(size * 0.055)}px sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(NEON_SIGNS[variant % NEON_SIGNS.length], size / 2, signY + size * 0.035);
    }
    // Brick speckle for houses and warehouses.
    if (type === 'house' || type === 'warehouse') {
      g.fillStyle = 'rgba(0,0,0,0.08)';
      for (let i = 0; i < 90; i += 1) {
        g.fillRect(rng() * size, rng() * size, 3, 2);
      }
    }
    return canvas;
  }

  return {
    // The texture for a building of this type and floor count. Variant
    // keeps same-type buildings from looking identical; when the budget
    // is spent, an existing texture is reused instead of making a new
    // one — the count never grows past the budget.
    textureFor(type, floors, variant, seedFn) {
      const key = `${type}|${floors}|${variant}`;
      const hit = cache.get(key);
      if (hit) return hit;
      if (cache.size >= CFG.FACADE_TEXTURE_BUDGET) {
        for (const [k, tex] of cache) {
          if (k.startsWith(`${type}|`)) return tex;
        }
        return cache.values().next().value;
      }
      const rng = seedFn || Math.random;
      const canvas = drawFacade(type, floors, variant, rng);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 2;
      cache.set(key, tex);
      return tex;
    },
    // How many unique facade textures exist right now.
    count() {
      return cache.size;
    },
    budget() {
      return CFG.FACADE_TEXTURE_BUDGET;
    },
    // A name-sign texture for the big signs on hotels and shops.
    signTexture(text, color) {
      const canvas = document.createElement('canvas');
      canvas.width = 512;
      canvas.height = 128;
      const g = canvas.getContext('2d');
      g.fillStyle = '#14101f';
      g.fillRect(0, 0, 512, 128);
      g.strokeStyle = color || '#ff5ad8';
      g.lineWidth = 6;
      g.strokeRect(4, 4, 504, 120);
      g.fillStyle = color || '#ff5ad8';
      g.font = 'bold 64px sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(text.slice(0, 14), 256, 66);
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      return tex;
    },
  };
}

// Rooftop props: air-conditioning units, water towers, antennas and
// parapets, so flat roofs are not bare slabs. Props are added to the
// building's group in the renderer; this helper only decides what goes
// where, deterministically from the building's own seed.
export function rooftopProps(building, rng) {
  const props = [];
  if (building.pitched) return props;
  const n = building.type === 'tower' || building.type === 'office' ? 4 : 2;
  for (let i = 0; i < n; i += 1) {
    const roll = rng();
    if (roll < 0.45) {
      props.push({ kind: 'ac', x: rng() * 0.7 - 0.35, z: rng() * 0.7 - 0.35, s: 0.5 + rng() * 0.5 });
    } else if (roll < 0.65) {
      props.push({ kind: 'tank', x: rng() * 0.7 - 0.35, z: rng() * 0.7 - 0.35, s: 0.8 + rng() * 0.5 });
    } else if (roll < 0.85) {
      props.push({ kind: 'antenna', x: rng() * 0.7 - 0.35, z: rng() * 0.7 - 0.35, s: 1 + rng() });
    } else {
      props.push({ kind: 'parapet', x: 0, z: 0, s: 1 });
    }
  }
  return props;
}
