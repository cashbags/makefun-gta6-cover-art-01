// Neon Sunset Cover Studio — the editor wiring.
//
// State lives in one object: the size, the layout, the grade, the caption
// and one photo slot per panel (an image plus its zoom and pan). Every
// control redraws the same canvas the export reads, so what the person
// sees is exactly the PNG they get. Photos are read on this machine with
// FileReader and object URLs; nothing is uploaded anywhere.
import { renderCover, coverSize, layoutPanels } from './cover.js';
import { runShot } from './shots.js';

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const titleInput = document.getElementById('caption');
const subtitleInput = document.getElementById('subtitle');
const shotImg = document.getElementById('shot-img');

const state = {
  size: '1080x1080',
  layout: 'trio',
  grade: 'sunset',
  title: 'Sunset Heist',
  subtitle: 'Vice City \u2022 2026',
  titlePos: 'bottom',
  gutter: '#f7f1e3',
  // Photos sit high by default (oy 0.55): faces live in the top third of
  // a photo, and a wide panel crops the middle otherwise. The renderer
  // clamps the pan, so tall panels where nothing is cropped are unaffected.
  panels: [
    { image: null, zoom: 1.15, ox: 0, oy: 0.55, label: 'Pier' },
    { image: null, zoom: 1.15, ox: 0, oy: 0.55, label: 'Boulevard' },
    { image: null, zoom: 1.15, ox: 0, oy: 0.55, label: 'Pier' },
  ],
};

function redraw() {
  const { w, h } = coverSize(state.size);
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  renderCover(canvas, state);
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function setPanelPhoto(index, url, label) {
  const image = await loadImage(url);
  state.panels[index] = { image, zoom: 1.15, ox: 0, oy: 0.55, label };
  const zoom = document.querySelector(`input[data-zoom="${index}"]`);
  if (zoom) zoom.value = '1.15';
  redraw();
}

async function loadSample(index, name) {
  await setPanelPhoto(index, `samples/${name}.jpg`, name === 'pier' ? 'Pier' : 'Boulevard');
}

// One card per panel: sample buttons, a file picker, a zoom slider.
document.querySelectorAll('.panel-card').forEach((card) => {
  const index = Number(card.dataset.panel);
  card.querySelectorAll('[data-sample]').forEach((button) => {
    button.addEventListener('click', async () => {
      await loadSample(index, button.dataset.sample);
      statusEl.textContent = `Panel ${index + 1}: ${button.dataset.sample} photo loaded.`;
    });
  });
  card.querySelector('input[type="file"]').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const image = await loadImage(URL.createObjectURL(file));
    state.panels[index] = { image, zoom: 1.15, ox: 0, oy: 0.55, label: file.name };
    const zoom = card.querySelector('input[type="range"]');
    if (zoom) zoom.value = '1.15';
    statusEl.textContent = `Panel ${index + 1}: ${file.name} loaded. Drag the preview to position it.`;
    redraw();
  });
  card.querySelector('input[type="range"]').addEventListener('input', (e) => {
    state.panels[index].zoom = Number(e.target.value);
    redraw();
  });
  card.querySelector('[data-fill-all]').addEventListener('click', async () => {
    const source = state.panels[index];
    if (!source.image) {
      statusEl.textContent = 'Load a photo into this panel first.';
      return;
    }
    state.panels.forEach((panel, i) => {
      if (i !== index) state.panels[i] = { ...source };
    });
    statusEl.textContent = 'Same photo in all three panels.';
    redraw();
  });
});

// Drag the preview to pan the panel under the pointer; the wheel zooms it.
function panelAt(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * canvas.width;
  const y = ((clientY - rect.top) / rect.height) * canvas.height;
  const g = Math.max(6, Math.round(Math.min(canvas.width, canvas.height) * 0.012));
  const rects = layoutPanels(state.layout, canvas.width, canvas.height, g);
  const shown = state.layout === 'solo' ? [0] : [0, 1, 2];
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return { panel: shown[i], rect: r };
  }
  return null;
}

let drag = null;
canvas.addEventListener('pointerdown', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (!hit) return;
  drag = { ...hit, startX: e.clientX, startY: e.clientY, ox: state.panels[hit.panel].ox, oy: state.panels[hit.panel].oy };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rect = canvas.getBoundingClientRect();
  const dx = ((e.clientX - drag.startX) / rect.width) * (canvas.width / drag.rect.w);
  const dy = ((e.clientY - drag.startY) / rect.height) * (canvas.height / drag.rect.h);
  state.panels[drag.panel].ox = drag.ox + dx;
  state.panels[drag.panel].oy = drag.oy + dy;
  redraw();
});
canvas.addEventListener('pointerup', () => { drag = null; });
canvas.addEventListener('wheel', (e) => {
  const hit = panelAt(e.clientX, e.clientY);
  if (!hit) return;
  e.preventDefault();
  const panel = state.panels[hit.panel];
  panel.zoom = Math.max(0.8, Math.min(2.5, panel.zoom * (e.deltaY < 0 ? 1.08 : 0.93)));
  const zoom = document.querySelector(`input[data-zoom="${hit.panel}"]`);
  if (zoom) zoom.value = String(panel.zoom);
  redraw();
}, { passive: false });

// Caption, layout, grade, size and title position.
titleInput.addEventListener('input', () => { state.title = titleInput.value; redraw(); });
subtitleInput.addEventListener('input', () => { state.subtitle = subtitleInput.value; redraw(); });

document.querySelectorAll('[data-layout]').forEach((button) => {
  button.addEventListener('click', () => {
    state.layout = button.dataset.layout;
    document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b === button));
    redraw();
  });
});
document.querySelectorAll('[data-grade]').forEach((button) => {
  button.addEventListener('click', () => {
    state.grade = button.dataset.grade;
    document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b === button));
    redraw();
  });
});
document.getElementById('size').addEventListener('change', (e) => {
  state.size = e.target.value;
  redraw();
});
document.getElementById('title-pos').addEventListener('change', (e) => {
  state.titlePos = e.target.value;
  redraw();
});
document.getElementById('gutter').addEventListener('change', (e) => {
  state.gutter = e.target.value;
  redraw();
});

// Export: render the same state at full size and download the PNG.
document.getElementById('export').addEventListener('click', () => {
  const { w, h } = coverSize(state.size);
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  renderCover(off, state);
  off.toBlob((blob) => {
    if (!blob) {
      statusEl.textContent = 'Export failed in this browser.';
      return;
    }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `neon-sunset-cover-${w}x${h}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    statusEl.textContent = `Saved neon-sunset-cover-${w}x${h}.png (${Math.round(blob.size / 1024)} KiB).`;
  }, 'image/png');
});

/** Renders the current state at full size and returns it as a PNG data URL. */
export function exportPngDataURL() {
  const { w, h } = coverSize(state.size);
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  renderCover(off, state);
  return off.toDataURL('image/png');
}

// A `?shot=` query sets up a fixed scene for a screenshot instead.
const query = new URLSearchParams(location.search);
if (query.get('shot')) {
  runShot(query.get('shot'), query, {
    loadSample,
    setCaption: (title, subtitle) => {
      state.title = title;
      titleInput.value = title;
      if (subtitle !== undefined) {
        state.subtitle = subtitle;
        subtitleInput.value = subtitle;
      }
    },
    setSize: (size) => { state.size = size; document.getElementById('size').value = size; },
    setLayout: (layout) => {
      state.layout = layout;
      document.querySelectorAll('[data-layout]').forEach((b) => b.classList.toggle('active', b.dataset.layout === layout));
    },
    setGrade: (grade) => {
      state.grade = grade;
      document.querySelectorAll('[data-grade]').forEach((b) => b.classList.toggle('active', b.dataset.grade === grade));
    },
    redraw,
    exportPngDataURL,
    shotImg,
  });
} else {
  // First paint: the bundled samples, so the app opens on a finished cover.
  loadSample(0, 'pier');
  loadSample(1, 'boulevard');
  loadSample(2, 'pier');
}
