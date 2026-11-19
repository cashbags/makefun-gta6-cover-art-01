// Fixed scenes for screenshots: ?shot=editor shows the editor with a sample
// photo loaded; ?shot=cover shows a cover the app itself exported, as the
// PNG the app wrote, scaled to the viewport. window.__shotReady is set
// once the scene has painted, so the screenshot never catches a half draw.
export async function runShot(shot, query, api) {
  const photo = query.get('photo') ?? 'pier';
  const caption = query.get('caption') ?? 'Sunset Heist';
  const size = query.get('size') ?? '1080x1080';
  const layout = query.get('layout') ?? 'trio';
  const grade = query.get('grade') ?? 'sunset';
  api.setSize(size);
  api.setLayout(layout);
  api.setGrade(grade);
  api.setCaption(caption);
  // Panel 1 takes the named photo; the other two take the other sample,
  // so every scene shows the multi-panel look with more than one photo.
  const other = photo === 'pier' ? 'boulevard' : 'pier';
  await api.loadSample(0, photo);
  await api.loadSample(1, other);
  await api.loadSample(2, photo);
  api.redraw();
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    api.shotImg.src = api.exportPngDataURL();
    await new Promise((resolve) => {
      api.shotImg.onload = resolve;
      api.shotImg.onerror = resolve;
    });
  }
  requestAnimationFrame(() => requestAnimationFrame(() => { window.__shotReady = true; }));
}
