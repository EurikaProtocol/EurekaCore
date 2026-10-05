import { useEffect, useRef } from 'react';

type Particle = { x: number; y: number; vx: number; vy: number };

export function ParticleField({ className }: { className?: string }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return undefined;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let width = 0;
    let height = 0;
    let particles: Particle[] = [];
    let frame = 0;
    let running = true;

    function resize() {
      const rect = canvas!.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      width = rect.width;
      height = rect.height;
      canvas!.width = Math.max(1, Math.floor(width * ratio));
      canvas!.height = Math.max(1, Math.floor(height * ratio));
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      const count = Math.min(70, Math.max(18, Math.floor((width * height) / 16000)));
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      }));
    }

    function draw() {
      context!.clearRect(0, 0, width, height);
      for (const p of particles) {
        if (!reduceMotion) {
          p.x += p.vx;
          p.y += p.vy;
          if (p.x < 0 || p.x > width) p.vx *= -1;
          if (p.y < 0 || p.y > height) p.vy *= -1;
        }
      }
      for (let i = 0; i < particles.length; i += 1) {
        for (let j = i + 1; j < particles.length; j += 1) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.hypot(dx, dy);
          if (distance < 130) {
            context!.strokeStyle = `rgba(21, 208, 201, ${0.16 * (1 - distance / 130)})`;
            context!.lineWidth = 1;
            context!.beginPath();
            context!.moveTo(particles[i].x, particles[i].y);
            context!.lineTo(particles[j].x, particles[j].y);
            context!.stroke();
          }
        }
      }
      context!.fillStyle = 'rgba(21, 208, 201, 0.8)';
      for (const p of particles) {
        context!.beginPath();
        context!.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
        context!.fill();
      }
      if (running && !reduceMotion) frame = requestAnimationFrame(draw);
    }

    function onVisibility() {
      if (reduceMotion) return;
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(frame);
      } else if (!running) {
        running = true;
        draw();
      }
    }

    resize();
    draw();
    const onResize = () => { resize(); if (reduceMotion) draw(); };
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      running = false;
      cancelAnimationFrame(frame);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return <canvas aria-hidden='true' className={className} ref={canvasRef} />;
}
