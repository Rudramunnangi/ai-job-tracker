"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import * as THREE from "three";

interface Hero3DNetworkProps {
  className?: string;
}

export const Hero3DNetwork: React.FC<Hero3DNetworkProps> = ({ className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [isLowPower, setIsLowPower] = useState(false);

  useEffect(() => {
    // Check reduced motion preference
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mediaQuery.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mediaQuery.addEventListener("change", handler);

    // Check device capability
    if (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) {
      setIsLowPower(true);
    }

    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (reducedMotion || !containerRef.current) return;

    const container = containerRef.current;
    let width = container.clientWidth || window.innerWidth;
    let height = container.clientHeight || 560;

    // Three.js Scene, Camera, Renderer
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 1000);
    camera.position.z = 240;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: "high-performance" });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    container.appendChild(renderer.domElement);

    // Particle nodes configuration
    const isMobile = window.innerWidth < 768;
    const particleCount = isMobile ? 32 : isLowPower ? 44 : 64;
    const maxDistance = isMobile ? 55 : 68;

    const nodePositions: number[] = [];
    const velocities: { x: number; y: number; z: number }[] = [];
    const spreadX = isMobile ? 130 : 210;
    const spreadY = 110;
    const spreadZ = 70;

    for (let i = 0; i < particleCount; i++) {
      nodePositions.push(
        (Math.random() - 0.5) * spreadX,
        (Math.random() - 0.5) * spreadY,
        (Math.random() - 0.5) * spreadZ
      );
      velocities.push({
        x: (Math.random() - 0.5) * 0.18,
        y: (Math.random() - 0.5) * 0.18,
        z: (Math.random() - 0.5) * 0.12,
      });
    }

    // Soft circular radial particle texture
    const textureCanvas = document.createElement("canvas");
    textureCanvas.width = 32;
    textureCanvas.height = 32;
    const ctx = textureCanvas.getContext("2d");
    if (ctx) {
      const grad = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
      grad.addColorStop(0, "rgba(34, 211, 200, 1)");
      grad.addColorStop(0.35, "rgba(91, 95, 239, 0.6)");
      grad.addColorStop(1, "rgba(7, 9, 15, 0)");
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(16, 16, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    const particleTexture = new THREE.CanvasTexture(textureCanvas);

    // Particle points geometry & material
    const pointsGeometry = new THREE.BufferGeometry();
    const posAttribute = new THREE.Float32BufferAttribute(nodePositions, 3);
    pointsGeometry.setAttribute("position", posAttribute);

    const pointsMaterial = new THREE.PointsMaterial({
      size: isMobile ? 4.5 : 5.5,
      map: particleTexture,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const pointsMesh = new THREE.Points(pointsGeometry, pointsMaterial);
    scene.add(pointsMesh);

    // Connecting lines geometry & material
    const maxLines = (particleCount * (particleCount - 1)) / 2;
    const linePositions = new Float32Array(maxLines * 6);
    const lineColors = new Float32Array(maxLines * 6);

    const linesGeometry = new THREE.BufferGeometry();
    linesGeometry.setAttribute("position", new THREE.BufferAttribute(linePositions, 3));
    linesGeometry.setAttribute("color", new THREE.BufferAttribute(lineColors, 3));

    const linesMaterial = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.38,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const linesMesh = new THREE.LineSegments(linesGeometry, linesMaterial);
    scene.add(linesMesh);

    // Mouse parallax tracking
    let targetMouseX = 0;
    let targetMouseY = 0;
    let currentMouseX = 0;
    let currentMouseY = 0;

    const handlePointerMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      targetMouseX = x * 22;
      targetMouseY = y * 16;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: true });

    // Visibility observer to pause when off-screen
    let isVisible = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    // Resize listener
    const handleResize = () => {
      if (!container) return;
      width = container.clientWidth || window.innerWidth;
      height = container.clientHeight || 560;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };
    window.addEventListener("resize", handleResize);

    // Animation Loop
    let animId: number;
    const posArr = pointsGeometry.attributes.position.array as Float32Array;

    const animate = () => {
      animId = requestAnimationFrame(animate);
      if (!isVisible) return;

      // Parallax smooth lerp
      currentMouseX += (targetMouseX - currentMouseX) * 0.045;
      currentMouseY += (targetMouseY - currentMouseY) * 0.045;
      camera.position.x = currentMouseX;
      camera.position.y = currentMouseY;
      camera.lookAt(0, 0, 0);

      // Node movements
      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        posArr[i3] += velocities[i].x;
        posArr[i3 + 1] += velocities[i].y;
        posArr[i3 + 2] += velocities[i].z;

        // Bounce back inside bounded volume
        const boundX = spreadX * 0.55;
        const boundY = spreadY * 0.55;
        const boundZ = spreadZ * 0.55;

        if (Math.abs(posArr[i3]) > boundX) velocities[i].x *= -1;
        if (Math.abs(posArr[i3 + 1]) > boundY) velocities[i].y *= -1;
        if (Math.abs(posArr[i3 + 2]) > boundZ) velocities[i].z *= -1;
      }
      pointsGeometry.attributes.position.needsUpdate = true;

      // Update trajectory connection lines
      let lineIndex = 0;
      let colorIndex = 0;

      for (let i = 0; i < particleCount; i++) {
        const i3 = i * 3;
        for (let j = i + 1; j < particleCount; j++) {
          const j3 = j * 3;
          const dx = posArr[i3] - posArr[j3];
          const dy = posArr[i3 + 1] - posArr[j3 + 1];
          const dz = posArr[i3 + 2] - posArr[j3 + 2];
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

          if (dist < maxDistance) {
            const alpha = 1.0 - dist / maxDistance;
            linePositions[lineIndex++] = posArr[i3];
            linePositions[lineIndex++] = posArr[i3 + 1];
            linePositions[lineIndex++] = posArr[i3 + 2];
            linePositions[lineIndex++] = posArr[j3];
            linePositions[lineIndex++] = posArr[j3 + 1];
            linePositions[lineIndex++] = posArr[j3 + 2];

            // Mix teal (#22D3C8) and primary indigo (#5B5FEF)
            const r = 0.13 * alpha;
            const g = 0.82 * alpha;
            const b = 0.78 * alpha;

            lineColors[colorIndex++] = r;
            lineColors[colorIndex++] = g;
            lineColors[colorIndex++] = b;
            lineColors[colorIndex++] = r;
            lineColors[colorIndex++] = g;
            lineColors[colorIndex++] = b;
          }
        }
      }

      linesGeometry.setDrawRange(0, lineIndex / 3);
      linesGeometry.attributes.position.needsUpdate = true;
      linesGeometry.attributes.color.needsUpdate = true;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("resize", handleResize);
      observer.disconnect();
      if (container && renderer.domElement) {
        container.removeChild(renderer.domElement);
      }
      pointsGeometry.dispose();
      pointsMaterial.dispose();
      linesGeometry.dispose();
      linesMaterial.dispose();
      particleTexture.dispose();
      renderer.dispose();
    };
  }, [reducedMotion, isLowPower]);

  if (reducedMotion) {
    return (
      <div
        className={`absolute inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-surface-elevated/40 via-background to-background ${className}`}
      />
    );
  }

  return (
    <div
      ref={containerRef}
      className={`absolute inset-0 pointer-events-none overflow-hidden ${className}`}
      style={{ zIndex: 0 }}
      aria-hidden="true"
    />
  );
};
