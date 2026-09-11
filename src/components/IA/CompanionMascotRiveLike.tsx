'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import type { AICompanionStatus } from './companion-logo-motion';
import {
  lipSyncIntervalMs,
  MASCOT_BLINK,
  MASCOT_BODY,
  MASCOT_FACE_CROSSFADE_MS,
  MASCOT_FACE_OVERLAY,
  MASCOT_STATUS_BLEND_MS,
  MASCOT_STATUS_CYCLES,
  MASCOT_USE_FACE_OVERLAY,
  MASCOT_VISEMES,
  type MascotBodyId,
  type MascotFaceId,
  mascotFaceSrc,
  mascotFrameSrc,
  visemeIdAt,
} from './companion-mascot-frames';

export interface CompanionMascotRiveLikeProps {
  status: AICompanionStatus;
  size: number;
  reducedMotion?: boolean;
  className?: string;
  /** Optional external viseme index (TTS); when omitted, fake lip-sync drives it. */
  visemeIndex?: number;
}

type LayerSlot = {
  src: string;
  key: string;
};

type BlendFn = (nextSlot: LayerSlot, fadeMs: number) => void;

/**
 * Sprite state machine (Rive-like): smooth body crossfades.
 * Face overlays OFF by default (body PNGs already have faces).
 */
export default function CompanionMascotRiveLike({
  status,
  size,
  reducedMotion = false,
  className = '',
  visemeIndex: visemeIndexProp,
}: CompanionMascotRiveLikeProps) {
  const cycle = MASCOT_STATUS_CYCLES[status];
  const [bodyIdx, setBodyIdx] = useState(0);
  const [visemeIdx, setVisemeIdx] = useState(0);
  const [blink, setBlink] = useState(false);
  const [front, setFront] = useState<LayerSlot>(() => slotFromCycle(cycle, 0));
  const [back, setBack] = useState<LayerSlot | null>(null);
  const [frontOpacity, setFrontOpacity] = useState(1);
  const [faceFront, setFaceFront] = useState<LayerSlot>(() =>
    faceSlot('face_neutral')
  );
  const [faceBack, setFaceBack] = useState<LayerSlot | null>(null);
  const [faceOpacity, setFaceOpacity] = useState(1);
  const crossfadeTimer = useRef<number | null>(null);
  const faceFadeTimer = useRef<number | null>(null);
  const bodyIdxRef = useRef(0);
  const frontRef = useRef(front);
  const faceFrontRef = useRef(faceFront);
  const statusRef = useRef(status);
  const blendBodyRef = useRef<BlendFn>(() => {});
  const blendFaceRef = useRef<BlendFn>(() => {});
  frontRef.current = front;
  faceFrontRef.current = faceFront;

  blendBodyRef.current = (nextSlot, fadeMs) => {
    if (frontRef.current.src === nextSlot.src) {
      setFront(nextSlot);
      frontRef.current = nextSlot;
      setFrontOpacity(1);
      setBack(null);
      return;
    }
    setBack(frontRef.current);
    setFront(nextSlot);
    frontRef.current = nextSlot;
    setFrontOpacity(0);
    requestAnimationFrame(() => {
      setFrontOpacity(1);
    });
    if (crossfadeTimer.current != null) {
      window.clearTimeout(crossfadeTimer.current);
    }
    crossfadeTimer.current = window.setTimeout(() => {
      setBack(null);
      crossfadeTimer.current = null;
    }, fadeMs + 40);
  };

  blendFaceRef.current = (nextSlot, fadeMs) => {
    if (faceFrontRef.current.src === nextSlot.src) {
      setFaceFront(nextSlot);
      faceFrontRef.current = nextSlot;
      setFaceOpacity(1);
      setFaceBack(null);
      return;
    }
    setFaceBack(faceFrontRef.current);
    setFaceFront(nextSlot);
    faceFrontRef.current = nextSlot;
    setFaceOpacity(0);
    requestAnimationFrame(() => {
      setFaceOpacity(1);
    });
    if (faceFadeTimer.current != null) {
      window.clearTimeout(faceFadeTimer.current);
    }
    faceFadeTimer.current = window.setTimeout(() => {
      setFaceBack(null);
      faceFadeTimer.current = null;
    }, fadeMs + 40);
  };

  // Status change: keep previous frame visible and blend into new cycle (no hard-cut)
  useEffect(() => {
    const prevStatus = statusRef.current;
    statusRef.current = status;
    bodyIdxRef.current = 0;
    setBodyIdx(0);
    setVisemeIdx(0);
    setBlink(false);

    const initial = slotFromCycle(cycle, 0);
    if (reducedMotion) {
      setFront(initial);
      frontRef.current = initial;
      setBack(null);
      setFrontOpacity(1);
      return;
    }

    const fadeMs =
      prevStatus === status
        ? cycle.crossfadeMs
        : Math.max(cycle.crossfadeMs, MASCOT_STATUS_BLEND_MS);
    blendBodyRef.current(initial, fadeMs);
  }, [status, cycle, reducedMotion]);

  // Body pose cycle with crossfade
  useEffect(() => {
    if (reducedMotion || cycle.fps <= 0 || cycle.frames.length <= 1) {
      return;
    }
    const ms = Math.max(280, Math.round(1000 / cycle.fps));
    const id = window.setInterval(() => {
      const next = (bodyIdxRef.current + 1) % cycle.frames.length;
      bodyIdxRef.current = next;
      setBodyIdx(next);
      blendBodyRef.current(slotFromCycle(cycle, next), cycle.crossfadeMs);
    }, ms);
    return () => {
      window.clearInterval(id);
    };
  }, [cycle, reducedMotion, status]);

  // Lip-sync only when overlays on + speaking — never drive open-A on idle/wait
  useEffect(() => {
    if (
      !MASCOT_USE_FACE_OVERLAY ||
      cycle.face !== 'lipSync' ||
      status !== 'speaking' ||
      reducedMotion
    ) {
      // Rest index = last MASCOT_VISEMES entry (face_neutral), not 0 (open A)
      setVisemeIdx(MASCOT_VISEMES.length - 1);
      return;
    }
    if (typeof visemeIndexProp === 'number') {
      setVisemeIdx(visemeIndexProp);
      return;
    }
    setVisemeIdx(1); // start on E, not A
    const id = window.setInterval(() => {
      setVisemeIdx(i => {
        if (Math.random() > 0.72) return MASCOT_VISEMES.length - 1;
        return (i + 1) % MASCOT_VISEMES.length;
      });
    }, lipSyncIntervalMs());
    return () => window.clearInterval(id);
  }, [cycle.face, reducedMotion, visemeIndexProp, status]);

  // Idle blink (face overlay path only)
  useEffect(() => {
    if (!MASCOT_USE_FACE_OVERLAY || reducedMotion || cycle.face !== 'blink') {
      setBlink(false);
      return;
    }
    let blinkOff: number | null = null;
    const schedule = (): number => {
      const wait =
        MASCOT_BLINK.idleMsMin +
        Math.random() * Math.max(1, MASCOT_BLINK.idleMsMax - MASCOT_BLINK.idleMsMin);
      return window.setTimeout(() => {
        setBlink(true);
        blinkOff = window.setTimeout(() => {
          setBlink(false);
          timer = schedule();
        }, MASCOT_BLINK.holdMs);
      }, wait);
    };
    let timer = schedule();
    return () => {
      window.clearTimeout(timer);
      if (blinkOff != null) window.clearTimeout(blinkOff);
    };
  }, [cycle.face, reducedMotion]);

  // Resolve + blend face layer (disabled when MASCOT_USE_FACE_OVERLAY is false)
  useEffect(() => {
    if (
      !MASCOT_USE_FACE_OVERLAY ||
      reducedMotion ||
      cycle.face === 'none' ||
      cycle.face === undefined
    ) {
      return;
    }
    let faceId: MascotFaceId = 'face_neutral';
    if (cycle.face === 'blink') {
      faceId = blink ? 'face_blink' : 'face_neutral';
    } else if (cycle.face === 'lipSync') {
      faceId = MASCOT_VISEMES[visemeIdx] ?? visemeIdAt(visemeIdx);
    } else if (cycle.face === 'neutral') {
      faceId = 'face_neutral';
    } else {
      const _exhaustive: never = cycle.face;
      void _exhaustive;
      return;
    }
    const fadeMs =
      cycle.face === 'lipSync'
        ? MASCOT_FACE_CROSSFADE_MS
        : Math.max(80, Math.round(cycle.crossfadeMs / 2));
    blendFaceRef.current(faceSlot(faceId), reducedMotion ? 0 : fadeMs);
  }, [cycle.face, blink, visemeIdx, reducedMotion, cycle.crossfadeMs]);

  useEffect(() => {
    return () => {
      if (crossfadeTimer.current != null) {
        window.clearTimeout(crossfadeTimer.current);
      }
      if (faceFadeTimer.current != null) {
        window.clearTimeout(faceFadeTimer.current);
      }
    };
  }, []);

  const showFace =
    MASCOT_USE_FACE_OVERLAY &&
    !reducedMotion &&
    cycle.face !== 'none' &&
    cycle.face !== undefined;
  const fadeMs = reducedMotion ? 0 : cycle.crossfadeMs;
  const faceFadeMs = reducedMotion
    ? 0
    : cycle.face === 'lipSync'
      ? MASCOT_FACE_CROSSFADE_MS
      : Math.max(80, Math.round(fadeMs / 2));
  const faceLeft = Math.round(size * MASCOT_FACE_OVERLAY.x);
  const faceTop = Math.round(size * MASCOT_FACE_OVERLAY.y);
  const faceW = Math.max(1, Math.round(size * MASCOT_FACE_OVERLAY.w));
  const faceH = Math.max(1, Math.round(size * MASCOT_FACE_OVERLAY.h));

  return (
    <div
      className={`relative overflow-hidden ${className}`}
      style={{ width: size, height: size }}
      data-mascot-runtime="rive-like"
      data-mascot-status={status}
      data-mascot-viseme={visemeIdx}
      data-mascot-body={cycle.frames[Math.min(bodyIdx, cycle.frames.length - 1)]}
    >
      {back && (
        <Image
          src={back.src}
          alt=""
          width={size}
          height={size}
          className="absolute inset-0 object-contain select-none pointer-events-none drop-shadow-md"
          style={{ opacity: 1, transition: `opacity ${fadeMs}ms ease-in-out` }}
          draggable={false}
          unoptimized
          aria-hidden
        />
      )}
      <Image
        key={front.key}
        src={front.src}
        alt="Companion ABZ"
        width={size}
        height={size}
        className="absolute inset-0 object-contain select-none pointer-events-none drop-shadow-md"
        style={{
          opacity: frontOpacity,
          transition: `opacity ${fadeMs}ms ease-in-out`,
        }}
        priority
        draggable={false}
        unoptimized
      />

      {showFace && faceBack && (
        <Image
          src={faceBack.src}
          alt=""
          width={faceW}
          height={faceH}
          className="absolute select-none pointer-events-none object-fill"
          style={{
            left: faceLeft,
            top: faceTop,
            width: faceW,
            height: faceH,
            opacity: 1,
            transition: `opacity ${faceFadeMs}ms ease-in-out`,
          }}
          aria-hidden
          draggable={false}
          unoptimized
        />
      )}
      {showFace && (
        <Image
          key={faceFront.key}
          src={faceFront.src}
          alt=""
          width={faceW}
          height={faceH}
          className="absolute select-none pointer-events-none object-fill"
          style={{
            left: faceLeft,
            top: faceTop,
            width: faceW,
            height: faceH,
            opacity: faceOpacity,
            transition: `opacity ${faceFadeMs}ms ease-in-out`,
          }}
          aria-hidden
          draggable={false}
          unoptimized
        />
      )}
    </div>
  );
}

function slotFromCycle(
  cycle: (typeof MASCOT_STATUS_CYCLES)[AICompanionStatus],
  idx: number
): LayerSlot {
  const frameId = cycle.frames[Math.min(idx, cycle.frames.length - 1)] ?? 'idle_stand';
  const safeId: MascotBodyId = frameId in MASCOT_BODY ? frameId : 'idle_stand';
  return {
    src: mascotFrameSrc(safeId),
    key: `${safeId}-${idx}`,
  };
}

function faceSlot(faceId: MascotFaceId): LayerSlot {
  return {
    src: mascotFaceSrc(faceId),
    key: faceId,
  };
}
