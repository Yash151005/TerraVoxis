/** Draws the current video frame or still image to a small hidden canvas and reads its pixels. */
export class FrameSource {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.canvas = document.createElement('canvas');
    this.canvas.width = width;
    this.canvas.height = height;
    const ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('This browser cannot create a 2D canvas for analysis.');
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'medium';
    this.ctx = ctx;
  }

  /** Returns null when the media has no frame yet. */
  capture(media: HTMLVideoElement | HTMLImageElement): ImageData | null {
    if (media instanceof HTMLVideoElement && media.readyState < 2) return null;
    if (media instanceof HTMLImageElement && !media.complete) return null;
    this.ctx.drawImage(media, 0, 0, this.width, this.height);
    return this.ctx.getImageData(0, 0, this.width, this.height);
  }
}
