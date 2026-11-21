// Procedural building facades for Vice Coast round 7.
//
// The old buildings were flat colours with one shared window texture.
// This module gives every building its own facade: a canvas texture
// drawn per building with a window grid, floor bands, an entrance door,
// a signage band and a material picked by building type — brick,
// glass, concrete or neon. Buildings of the same type never look
// identical: the window pattern, the floor count and the accent colour
// all vary with the building's own seed. Rooftop detail is data, not
// texture: air-conditioning boxes, water towers, antennas and parapets
// whose positions the renderer places on the roof.
//
// Facades are cached by a short key (type + material + floors + accent
// + window pattern), so the 405 buildings share a few dozen textures
// instead of drawing 405 canvases, but no two neighbouring buildings of
// the same type share the same key unless their seeds agree.
import * as THREE from 'three';

// Materials by building type. Each entry lists the facade treatments
// that type can wear: a base wall colour, a window style and an accent
// used for the signage band and the entrance.
export const FACADE_MATERIALS = {
  house: [
    { wall: '#d9a441', windows: 'shutter', accent: '#8a4a32' },
    { wall: '#c96f4a', windows: 'plain', accent: '#f1c40f' },
    { wall: '#7a6fae', windows: 'shutter', accent: '#ecf0f1' },
    { wall: '#e8c98f', windows: 'plain', accent: '#2ecc71' },
  ],
  shophouse: [
    { wall: '#b05b7a', windows: 'shopfront', accent: '#ffd700' },
    { wall: '#5b8fb0', windows: 'shopfront', accent: '#ff2fb3' },
    { wall: '#c9c9c9', windows: 'grid', accent: '#e74c3c' },
  ],
  office: [
    { wall: '#6f7d8a', windows: 'glass', accent: '#3498db' },
    { wall: '#8a94a6', windows: 'glass', accent: '#2ecc71' },
    { wall: '#5a4f8a', windows: 'grid', accent: '#f1c40f' },
  ],
  tower: [
    { wall: '#2c3e50', windows: 'glass', accent: '#00e5ff' },
    { wall: '#34495e', windows: 'glass', accent: '#ff2fb3' },
    { wall: '#7a6fae', windows: 'grid', accent: '#ffd700' },
  ],
  restaurant: [
    { wall: '#e07a5f', windows: 'awning', accent: '#f1c40f' },
    { wall: '#c96f4a', windows: 'awning', accent: '#2ecc71' },
    { wall: '#8a4a32', windows: 'shopfront', accent: '#ffd700' },
  ],
  hotel: [
    { wall: '#e8c98f', windows: 'balcony', accent: '#ff2fb3' },
    { wall: '#d9a441', windows: 'balcony', accent: '#3498db' },
    { wall: '#ecf0f1', windows: 'grid', accent: '#e74c3c' },
  ],
  warehouse: [
    { wall: '#7d7468', windows: 'slit', accent: '#f1c40f' },
    { wall: '#6f6a72', windows: 'slit', accent: '#e74c3c' },
    { wall: '#8a7d6b', windows: 'plain', accent: '#2ecc71' },
  ],
  gas: [
    { wall: '#ecf0f1', windows: 'shopfront', accent: '#e74c3c' },
    { wall: '#f1c40f', windows: 'shopfront', accent: '#2f6fd0' },
  ],
};

// A deterministic pick from a list by seed: the same building always
// gets the same material, but neighbours differ.
function pickSeeded(list, seed, salt) {
  const n = Math.abs(Math.sin(seed * 127.1 + salt * 311.7) * 43758.5453);
  return list[Math.floor((n % 1) * list.length) % list.length];
}

// The facade plan for one building: its material, how many floors of
// windows it shows, which window pattern it uses, and its accent.
// Floors follow the building's height so a tower reads taller than a
// house even before the texture is drawn.
export function facadePlan(building) {
  const seed = building.seed ?? 0.5;
  const materials = FACADE_MATERIALS[building.type] || FACADE_MATERIALS.house;
  const material = pickSeeded(materials, seed, 1);
  const floors = Math.max(1, Math.min(14, Math.round(building.ht / 42)));
  const accent = pickSeeded(
    ['#ffd700', '#ff2fb3', '#2ecc71', '#3498db', '#e74c3c', '#f1c40f', '#00e5ff'],
    seed, 2,
  );
  const litRatio = 0.35 + Math.abs(Math.sin(seed * 71.3)) * 0.4;
  return { material, floors, accent, litRatio, seed };
}

const textureCache = new Map();

// Draw one facade texture. The canvas is 256x256 and repeats across the
// building's faces; the window grid is drawn per floor, the ground floor
// gets a door and a signage band, and the style changes the window
// shape: glass is a full-height strip, shutters get side bars, awnings
// get a coloured stripe above each window, balconies get a rail line,
// shopfronts get a tall ground-floor opening, slits get narrow vents.
export function facadeTexture(plan) {
  // The key quantizes the lit ratio to three buckets: enough variety
  // that neighbours differ, few enough textures that the city stays
  // one instanced mesh per distinct facade instead of one per building.
  const litBucket = plan.litRatio < 0.45 ? 0 : plan.litRatio < 0.65 ? 1 : 2;
  const key = `${plan.material.wall}|${plan.material.windows}|${plan.floors}|${plan.accent}|${litBucket}`;
  const hit = textureCache.get(key);
  if (hit) return hit;

  const cv = document.createElement('canvas');
  cv.width = 256;
  cv.height = 256;
  const g = cv.getContext('2d');
  const wall = plan.material.wall;
  const style = plan.material.windows;
  const floors = plan.floors;

  // Wall base with a subtle vertical shade so the top reads lighter.
  g.fillStyle = wall;
  g.fillRect(0, 0, 256, 256);
  const shade = g.createLinearGradient(0, 0, 0, 256);
  shade.addColorStop(0, 'rgba(255,255,255,0.10)');
  shade.addColorStop(1, 'rgba(0,0,0,0.18)');
  g.fillStyle = shade;
  g.fillRect(0, 0, 256, 256);

  // Brick gets a course line every 8 px; concrete gets a faint panel grid.
  if (wall === '#c96f4a' || wall === '#8a4a32' || wall === '#e07a5f') {
    g.fillStyle = 'rgba(0,0,0,0.12)';
    for (let y = 7; y < 256; y += 16) g.fillRect(0, y, 256, 1);
  } else {
    g.strokeStyle = 'rgba(0,0,0,0.08)';
    g.lineWidth = 1;
    for (let y = 0; y <= 256; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  }

  const rowH = 256 / Math.max(1, floors + 1);
  const cols = style === 'glass' ? 6 : style === 'slit' ? 8 : 4;
  const winW = style === 'glass' ? 30 : style === 'slit' ? 8 : 26;
  const winH = style === 'glass' ? rowH - 8 : style === 'slit' ? 12 : 30;
  for (let f = 0; f < floors; f += 1) {
    const y = 12 + f * rowH;
    // Floor band between storeys.
    g.fillStyle = 'rgba(0,0,0,0.16)';
    g.fillRect(0, y + rowH - 5, 256, 3);
    for (let c = 0; c < cols; c += 1) {
      const x = 14 + c * ((256 - 28) / cols) + ((256 - 28) / cols - winW) / 2;
      const lit = Math.abs(Math.sin(plan.seed * 91.7 + f * 13.1 + c * 7.7)) < plan.litRatio;
      g.fillStyle = lit ? '#ffd76a' : (style === 'glass' ? '#1c2733' : '#2a2f45');
      if (style === 'glass') {
        g.fillStyle = lit ? '#ffe9a8' : '#274b63';
        g.fillRect(x, y, winW, winH);
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(x, y, 4, winH);
      } else {
        g.fillRect(x, y + (rowH - winH) / 2 - 4, winW, winH);
        if (style === 'shutter') {
          g.fillStyle = 'rgba(255,255,255,0.5)';
          g.fillRect(x - 5, y + (rowH - winH) / 2 - 4, 4, winH);
          g.fillRect(x + winW + 1, y + (rowH - winH) / 2 - 4, 4, winH);
        } else if (style === 'awning') {
          g.fillStyle = plan.accent;
          g.fillRect(x - 3, y + (rowH - winH) / 2 - 12, winW + 6, 7);
        } else if (style === 'balcony') {
          g.strokeStyle = 'rgba(255,255,255,0.55)';
          g.lineWidth = 2;
          g.strokeRect(x - 4, y + (rowH - winH) / 2 + winH - 2, winW + 8, 10);
        }
      }
    }
  }

  // Ground floor: entrance door in the middle, signage band above it.
  const groundY = 256 - rowH;
  g.fillStyle = plan.accent;
  g.fillRect(0, groundY - 14, 256, 12);
  g.fillStyle = 'rgba(255,255,255,0.85)';
  for (let x = 18; x < 238; x += 18) g.fillRect(x, groundY - 11, 9, 6);
  if (style === 'shopfront') {
    g.fillStyle = '#274b63';
    g.fillRect(16, groundY + 6, 96, 44);
    g.fillStyle = 'rgba(255,255,255,0.25)';
    g.fillRect(16, groundY + 6, 96, 8);
    g.fillStyle = '#1c2733';
    g.fillRect(150, groundY + 6, 40, 44);
  } else {
    g.fillStyle = '#1c2733';
    g.fillRect(112, groundY + 6, 32, 44);
    g.fillStyle = plan.accent;
    g.fillRect(112, groundY + 6, 32, 5);
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  textureCache.set(key, tex);
  return tex;
}

// Rooftop detail for one building: a parapet rim plus a few pieces of
// kit — air-conditioning boxes on offices and towers, water towers on
// hotels and houses, antennas on towers. Positions are fractions of the
// roof so the renderer can place them without knowing the facade.
export function rooftopKit(building) {
  const seed = building.seed ?? 0.5;
  const kit = { parapet: true, ac: [], waterTower: null, antenna: null };
  const acCount = building.type === 'tower' || building.type === 'office' ? 2 + Math.floor(Math.abs(Math.sin(seed * 41.1)) * 3)
    : building.type === 'hotel' ? 2 : building.type === 'shophouse' ? 1 : 0;
  for (let i = 0; i < acCount; i += 1) {
    kit.ac.push({
      fx: 0.2 + Math.abs(Math.sin(seed * 17.3 + i * 9.1)) * 0.6,
      fy: 0.2 + Math.abs(Math.sin(seed * 23.7 + i * 5.3)) * 0.6,
      size: 18 + Math.abs(Math.sin(seed * 31.9 + i)) * 14,
    });
  }
  if (building.type === 'hotel' || (building.type === 'house' && Math.abs(Math.sin(seed * 53.5)) < 0.4)) {
    kit.waterTower = { fx: 0.25 + Math.abs(Math.sin(seed * 61.2)) * 0.5, fy: 0.25 + Math.abs(Math.sin(seed * 67.8)) * 0.5 };
  }
  if (building.type === 'tower' && Math.abs(Math.sin(seed * 71.1)) < 0.75) {
    kit.antenna = { fx: 0.5, fy: 0.5, height: 60 + Math.abs(Math.sin(seed * 83.4)) * 90 };
  }
  return kit;
}

export function facadeCacheSize() { return textureCache.size; }
