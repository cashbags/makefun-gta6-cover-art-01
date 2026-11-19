// Neon Sunset Cover Studio — the cover renderer.
//
// Draws the poster on a 2D canvas: the person's photos arranged in a
// multi-panel grid, a sunset or neon colour grade over them, a retro sun
// disc, and bold caption lettering. Everything is drawn from the state
// object, so the editor preview and the exported PNG are the same picture
// at different sizes. No image ever leaves the machine: photos are drawn
// from local files the person picked, or from the bundled samples.

const SIZES = {
  '1080x1080': { w: 1080, h: 1080 },
  '1080x1350': { w: 1080, h: 1350 },
  '1920x1080': { w: 1920, h: 1080 },
};

export function coverSize(name) {
  return SIZES[name] ?? SIZES['1080x1080'];
}

/** Panel rectangles for a layout: gutters of `g` pixels around every panel. */
export function layoutPanels(layout, w, h, g) {
  if (layout === 'solo') {
    return [{ x: g, y: g, w: w - 2 * g, h: h - 2 * g }];
  }
  if (layout === 'hero') {
    const topH = Math.round((h - 3 * g) * 0.62);
    const botY = g + topH + g;
    const botH = h - botY - g;
    const halfW = Math.round((w - 3 * g) / 2);
    return [
      { x: g, y: g, w: w - 2 * g, h: topH },
      { x: g, y: botY, w: halfW, h: botH },
      { x: g + halfW + g, y: botY, w: w - g - (g + halfW + g), h: botH },
    ];
  }
  // trio: three tall panels side by side, the classic poster grid.
  const colW = Math.round((w - 4 * g) / 3);
  return [
    { x: g, y: g, w: colW, h: h - 2 * g },
    { x: g + colW + g, y: g, w: colW, h: h - 2 * g },
    { x: g + 2 * (colW + g), y: g, w: w - g - (g + 2 * (colW + g)), h: h - 2 * g },
  ];
}

/** Cover-fit draw of one photo inside its panel, honouring zoom and pan. */
function drawPanelPhoto(ctx, photo, rect, panel) {
  if (!photo) return;
  const iw = photo.naturalWidth;
  const ih = photo.naturalHeight;
  if (!iw || !ih) return;
  const zoom = panel.zoom || 1;
  const scale = Math.max(rect.w / iw, rect.h / ih) * zoom;
  const dw = iw * scale;
  const dh = ih * scale;
  // Pan is a fraction of the panel; clamp it so the photo always covers.
  const maxOx = Math.max(0, (dw - rect.w) / 2 / rect.w);
  const maxOy = Math.max(0, (dh - rect.h) / 2 / rect.h);
  const ox = Math.max(-maxOx, Math.min(maxOx, panel.ox || 0));
  const oy = Math.max(-maxOy, Math.min(maxOy, panel.oy || 0));
  const dx = rect.x + (rect.w - dw) / 2 + ox * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + oy * rect.h;
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  if (panel.gradeFilter) ctx.filter = panel.gradeFilter;
  ctx.drawImage(photo, dx, dy, dw, dh);
  ctx.restore();
}

/** A retro sun disc with slatted gaps, painted on its own canvas so the
 *  gaps show the photo underneath instead of erasing it. */
function sunDisc(diameter, top, bottom) {
  const d = Math.max(8, Math.round(diameter));
  const c = document.createElement('canvas');
  c.width = d;
  c.height = d;
  const x = c.getContext('2d');
  const r = d / 2;
  const grad = x.createLinearGradient(0, 0, 0, d);
  grad.addColorStop(0, top);
  grad.addColorStop(0.55, '#ff7e5f');
  grad.addColorStop(1, bottom);
  x.beginPath();
  x.arc(r, r, r, 0, Math.PI * 2);
  x.clip();
  x.fillStyle = grad;
  x.fillRect(0, 0, d, d);
  x.globalCompositeOperation = 'destination-out';
  let y = r + d * 0.08;
  let gap = d * 0.035;
  while (y < d) {
    x.fillRect(0, y, d, gap);
    y += d * 0.075;
    gap *= 1.5;
  }
  return c;
}

/** The colour grade: translucent washes laid over the photos. */
function gradeWash(ctx, grade, w, h) {
  ctx.save();
  if (grade === 'neon') {
    let g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, 'rgba(34, 211, 238, 0.30)');
    g.addColorStop(0.5, 'rgba(255, 46, 136, 0.12)');
    g.addColorStop(1, 'rgba(124, 58, 237, 0.34)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
    g = ctx.createLinearGradient(0, h * 0.55, 0, h);
    g.addColorStop(0, 'rgba(255, 46, 136, 0)');
    g.addColorStop(1, 'rgba(255, 46, 136, 0.38)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  } else if (grade === 'palm') {
    let g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(13, 148, 136, 0.22)');
    g.addColorStop(0.6, 'rgba(245, 158, 11, 0.10)');
    g.addColorStop(1, 'rgba(249, 115, 22, 0.42)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  } else if (grade === 'mono') {
    ctx.fillStyle = 'rgba(20, 16, 29, 0.18)';
    ctx.fillRect(0, 0, w, h);
  } else {
    // sunset: warm sky above, hot magenta dusk below.
    let g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(90, 20, 120, 0.20)');
    g.addColorStop(0.45, 'rgba(255, 110, 60, 0.06)');
    g.addColorStop(1, 'rgba(200, 40, 120, 0.42)');
    ctx.globalCompositeOperation = 'overlay';
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'source-over';
  }
  // A soft vignette pulls the eye to the middle of the poster.
  const v = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  v.addColorStop(0, 'rgba(0, 0, 0, 0)');
  v.addColorStop(1, 'rgba(10, 5, 20, 0.38)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

/** Bold poster lettering: heavy caps, thick dark outline, a warm fill
 *  gradient and a hard drop shadow, shrunk until it fits the width. */
function drawTitle(ctx, text, cx, baseline, maxWidth, size) {
  const family = '"Arial Black", "Noto Sans", "Liberation Sans", Arial, sans-serif';
  let s = size;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.max(1, Math.round(s * 0.03))}px`;
  const measure = (n) => {
    ctx.font = `900 ${n}px ${family}`;
    return ctx.measureText(text).width;
  };
  while (measure(s) > maxWidth && s > 12) s -= 2;
  ctx.font = `900 ${s}px ${family}`;
  const grad = ctx.createLinearGradient(0, baseline - s, 0, baseline);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(0.55, '#fff3c4');
  grad.addColorStop(1, '#ffb347');
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1c0b2e';
  ctx.lineWidth = Math.max(2, s * 0.09);
  ctx.shadowColor = 'rgba(10, 2, 24, 0.65)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = Math.max(2, s * 0.06);
  ctx.strokeText(text, cx, baseline);
  ctx.fillStyle = grad;
  ctx.fillText(text, cx, baseline);
  ctx.shadowOffsetY = 0;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  return s;
}

/** The subtitle on a slanted ribbon, letterspaced capitals. */
function drawSubtitle(ctx, text, cx, top, maxWidth, height) {
  const family = '"Noto Sans", "Liberation Sans", Arial, sans-serif';
  let s = Math.round(height * 0.52);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${Math.max(1, Math.round(s * 0.22))}px`;
  const measure = (n) => {
    ctx.font = `800 ${n}px ${family}`;
    return ctx.measureText(text).width;
  };
  while (measure(s) > maxWidth * 0.92 && s > 8) s -= 1;
  ctx.font = `800 ${s}px ${family}`;
  const tw = measure(s);
  const pad = s * 0.9;
  const bw = tw + pad * 2;
  const bh = height;
  const slant = bh * 0.35;
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(cx - bw / 2 + slant, top);
  ctx.lineTo(cx + bw / 2 + slant, top);
  ctx.lineTo(cx + bw / 2 - slant, top + bh);
  ctx.lineTo(cx - bw / 2 - slant, top + bh);
  ctx.closePath();
  ctx.fillStyle = '#ff2e88';
  ctx.shadowColor = 'rgba(10, 2, 24, 0.55)';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = Math.max(2, bh * 0.12);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = '#ffffff';
  ctx.fillText(text, cx, top + bh / 2 + s * 0.04);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

/** Draws the whole cover for `state` onto `canvas` at its own size. */
export function renderCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const { width: w, height: h } = canvas;
  const g = Math.max(6, Math.round(Math.min(w, h) * 0.012));
  const rects = layoutPanels(state.layout, w, h, g);
  ctx.fillStyle = state.gutter || '#f7f1e3';
  ctx.fillRect(0, 0, w, h);
  const shown = state.layout === 'solo' ? [0] : [0, 1, 2];
  shown.forEach((pi, i) => {
    const panel = state.panels[pi];
    const photo = panel ? panel.image : null;
    if (state.grade === 'mono') {
      const filtered = panel ? { ...panel, gradeFilter: 'grayscale(1) contrast(1.12) brightness(1.04)' } : panel;
      drawPanelPhoto(ctx, photo, rects[i], filtered);
    } else {
      drawPanelPhoto(ctx, photo, rects[i], panel || {});
    }
  });
  // The sun hangs in the first panel's top corner on the warm and neon
  // grades: a corner never covers the face at the photo's centre.
  if ((state.grade === 'sunset' || state.grade === 'neon') && rects.length) {
    const first = rects[0];
    const r = Math.min(first.w, first.h) * 0.16;
    const disc = sunDisc(r * 2, '#ffe259', state.grade === 'neon' ? '#ff2e88' : '#ff5e3a');
    ctx.drawImage(disc, first.x + first.w - r * 1.9, first.y + r * 0.1, r * 2, r * 2);
  }
  gradeWash(ctx, state.grade, w, h);
  // Crisp gutters over the wash.
  ctx.strokeStyle = state.gutter || '#f7f1e3';
  ctx.lineWidth = g;
  rects.forEach((r) => ctx.strokeRect(r.x - g / 2, r.y - g / 2, r.w + g, r.h + g));
  const title = (state.title || '').trim().toUpperCase();
  const subtitle = (state.subtitle || '').trim().toUpperCase();
  const band = state.titlePos === 'top' ? { y: h * 0.055 } : { y: h - h * 0.185 };
  if (title) {
    const size = Math.round(h * 0.115);
    const baseline = band.y + size;
    drawTitle(ctx, title, w / 2, baseline, w * 0.92, size);
    if (subtitle) {
      const rh = Math.round(h * 0.038);
      drawSubtitle(ctx, subtitle, w / 2, baseline + rh * 0.45, w * 0.8, rh);
    }
  } else if (subtitle) {
    const rh = Math.round(h * 0.038);
    drawSubtitle(ctx, subtitle, w / 2, band.y, w * 0.8, rh);
  }
}
