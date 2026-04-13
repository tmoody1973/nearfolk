// Nearfolk share card — postcard-style PNG capture
//
// After settle: captures the scene at the final dusk frame,
// overlays score + story caption + date, generates a PNG.
//
// Uses a temporary renderer with preserveDrawingBuffer: true
// for the capture, then disposes it. Keeps gameplay renderer fast.

import { WebGLRenderer, PCFShadowMap } from 'three';

// Capture the current scene as a PNG data URL
export function captureShareCard(scene, camera, width = 1200, height = 675) {
  // Create temporary renderer with preserveDrawingBuffer
  const tempRenderer = new WebGLRenderer({
    antialias: true,
    preserveDrawingBuffer: true,
  });
  tempRenderer.setSize(width, height);
  tempRenderer.setPixelRatio(1);
  tempRenderer.shadowMap.enabled = true;
  tempRenderer.shadowMap.type = PCFShadowMap;

  // Render one frame
  tempRenderer.render(scene, camera);

  // Capture
  const dataUrl = tempRenderer.domElement.toDataURL('image/png');

  // Cleanup
  tempRenderer.dispose();

  return dataUrl;
}

// Create the full postcard with text overlay
export function generatePostcard(sceneDataUrl, beatName, caption, score, date) {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 675;
    const ctx = canvas.getContext('2d');

    const img = new Image();
    img.onload = () => {
      // Draw scene screenshot as background
      ctx.drawImage(img, 0, 0, 1200, 675);

      // Semi-transparent overlay at bottom for text
      const gradient = ctx.createLinearGradient(0, 450, 0, 675);
      gradient.addColorStop(0, 'rgba(107, 78, 58, 0)');
      gradient.addColorStop(0.3, 'rgba(107, 78, 58, 0.6)');
      gradient.addColorStop(1, 'rgba(107, 78, 58, 0.85)');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 450, 1200, 225);

      // Caption (italic serif)
      ctx.fillStyle = '#f5efe6';
      ctx.font = 'italic 22px Georgia, serif';
      ctx.textAlign = 'center';

      // Word-wrap caption
      const words = caption.split(' ');
      let line = '';
      let y = 540;
      for (const word of words) {
        const test = line + word + ' ';
        if (ctx.measureText(test).width > 900) {
          ctx.fillText(line.trim(), 600, y);
          line = word + ' ';
          y += 30;
        } else {
          line = test;
        }
      }
      ctx.fillText(line.trim(), 600, y);

      // Score (large, right side)
      ctx.font = 'bold 48px Georgia, serif';
      ctx.textAlign = 'right';
      ctx.fillText(score, 1140, 520);

      // Score label
      ctx.font = '14px sans-serif';
      ctx.fillStyle = 'rgba(245, 239, 230, 0.6)';
      ctx.fillText('Neighborliness', 1140, 485);

      // Beat name (small, left)
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = 'rgba(245, 239, 230, 0.5)';
      ctx.fillText(beatName.toUpperCase(), 60, 500);

      // Date stamp (bottom right corner)
      ctx.font = '12px sans-serif';
      ctx.textAlign = 'right';
      ctx.fillStyle = 'rgba(245, 239, 230, 0.4)';
      ctx.fillText(date, 1140, 650);

      // Nearfolk watermark (bottom left)
      ctx.textAlign = 'left';
      ctx.font = 'bold 14px Georgia, serif';
      ctx.fillStyle = 'rgba(245, 239, 230, 0.4)';
      ctx.fillText('nearfolk', 60, 650);

      resolve(canvas.toDataURL('image/png'));
    };
    img.src = sceneDataUrl;
  });
}

// Trigger download of the share card
export function downloadShareCard(dataUrl, filename = 'nearfolk-postcard.png') {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// Share via native share API (mobile) or fallback to download
export async function sharePostcard(dataUrl, caption) {
  // Try native share API first
  if (navigator.share && navigator.canShare) {
    try {
      const blob = await (await fetch(dataUrl)).blob();
      const file = new File([blob], 'nearfolk-postcard.png', { type: 'image/png' });
      if (navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'Nearfolk',
          text: caption,
          files: [file],
        });
        return;
      }
    } catch {
      // Fallback to download
    }
  }
  downloadShareCard(dataUrl);
}
