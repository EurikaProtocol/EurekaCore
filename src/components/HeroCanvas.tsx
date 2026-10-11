import { useEffect, useRef } from 'react';

type Particle = { x: number; y: number; vx: number; vy: number };

export function HeroCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let frame = 0;
    let running = true;
    let particles: Particle[] = [];

    function resize() {
      if (!canvas || !context) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = width * ratio;
      canvas.height = height * ratio;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.max(18, Math.min(60, Math.round((width * height) / 18000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      }));
    }

    function draw() {
      if (!context) return;
      context.clearRect(0, 0, width, height);
      const linkDistance = 130;
      for (let i = 0; i < particles.length; i += 1) {
        const a = particles[i];
        if (!reduceMotion) {
          a.x += a.vx;
          a.y += a.vy;
          if (a.x < 0 || a.x > width) a.vx *= -1;
          if (a.y < 0 || a.y > height) a.vy *= -1;
        }
        for (let j = i + 1; j < particles.length; j += 1) {
          const b = particles[j];
          const distance = Math.hypot(a.x - b.x, a.y - b.y);
          if (distance < linkDistance) {
            context.strokeStyle = `rgba(21, 208, 201, ${0.22 * (1 - distance / linkDistance)})`;
            context.lineWidth = 1;
            context.beginPath();
            context.moveTo(a.x, a.y);
            context.lineTo(b.x, b.y);
            context.stroke();
          }
        }
        context.fillStyle = 'rgba(127, 243, 238, 0.75)';
        context.beginPath();
        context.arc(a.x, a.y, 1.6, 0, Math.PI * 2);
        context.fill();
      }
      if (running && !reduceMotion) frame = requestAnimationFrame(draw);
    }

    function onVisibility() {
      running = !document.hidden;
      if (running && !reduceMotion) {
        cancelAnimationFrame(frame);
        frame = requestAnimationFrame(draw);
      }
    }

    resize();
    draw();
    window.addEventListener('resize', resize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas aria-hidden='true' className='absolute inset-0 h-full w-full' ref={canvasRef} />;
}
