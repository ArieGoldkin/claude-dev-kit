import type { BlocksSpec } from "./catalog";

// Runtime invariant checker for BlocksSpec. Catches the classes of bug
// TypeScript can't reach — frame arithmetic drift, duplicate ids, and
// per-kind structural minimums (intro needs ≥2 cards to slide in, etc.).
//
// Called once at mount inside BlockExplainer. Throws SpecError with a
// readable message that names the offending field. Designed for
// LLM-authored specs (planned MR C): a typo or count-off lands here
// rather than rendering silently into broken video.
export class SpecError extends Error {
  constructor(message: string) {
    super(`[BlocksSpec] ${message}`);
    this.name = "SpecError";
  }
}

export function validateSpec(spec: BlocksSpec): void {
  const expectedFrames = spec.durationSeconds * spec.fps;
  const actualFrames = spec.scenes.reduce(
    (sum, s) => sum + s.durationFrames,
    0,
  );
  if (actualFrames !== expectedFrames) {
    throw new SpecError(
      `Scene durations sum to ${actualFrames} frames but ` +
        `durationSeconds (${spec.durationSeconds}) × fps (${spec.fps}) ` +
        `= ${expectedFrames}. Adjust scenes or top-level duration.`,
    );
  }

  const seenIds = new Set<string>();
  for (const scene of spec.scenes) {
    if (seenIds.has(scene.id)) {
      throw new SpecError(`Duplicate scene id: "${scene.id}"`);
    }
    seenIds.add(scene.id);

    if (scene.durationFrames <= 0) {
      throw new SpecError(
        `Scene "${scene.id}" has non-positive durationFrames ` +
          `(${scene.durationFrames}).`,
      );
    }

    if (scene.kind === "intro" && scene.cards.length < 2) {
      throw new SpecError(
        `Scene "${scene.id}" is intro with ${scene.cards.length} cards; ` +
          `needs at least 2 (the slide-in animation depends on it).`,
      );
    }
    if (scene.kind === "flow-row" && scene.boxes.length < 2) {
      throw new SpecError(
        `Scene "${scene.id}" is flow-row with ${scene.boxes.length} boxes; ` +
          `needs at least 2 (or use a different scene kind).`,
      );
    }
    if (scene.kind === "fan-out" && scene.targets.length < 1) {
      throw new SpecError(
        `Scene "${scene.id}" is fan-out with no targets.`,
      );
    }
    if (scene.kind === "recap" && scene.cards.length !== 2) {
      throw new SpecError(
        `Scene "${scene.id}" is recap with ${scene.cards.length} cards; ` +
          `the layout assumes exactly 2.`,
      );
    }
    if (scene.kind === "title-card") {
      if (!scene.line1.trim() || !scene.line2.trim()) {
        throw new SpecError(
          `Scene "${scene.id}" is title-card with empty line1 or line2.`,
        );
      }
      const cpf = scene.charsPerFrame ?? 1;
      if (cpf <= 0 || cpf > 5) {
        throw new SpecError(
          `Scene "${scene.id}" has charsPerFrame=${cpf}; ` +
            `must be in (0, 5].`,
        );
      }
      const gap = scene.gapFrames ?? 12;
      const hold = scene.holdFrames ?? 90;
      if (gap < 0 || hold < 0) {
        throw new SpecError(
          `Scene "${scene.id}" has negative gapFrames or holdFrames.`,
        );
      }
      const typeFrames =
        Math.ceil(scene.line1.length / cpf) +
        Math.ceil(scene.line2.length / cpf) +
        gap +
        hold;
      if (scene.durationFrames < typeFrames) {
        throw new SpecError(
          `Scene "${scene.id}" durationFrames=${scene.durationFrames} ` +
            `is shorter than typing-time + gap + hold (${typeFrames}). ` +
            `Increase durationFrames or reduce holdFrames.`,
        );
      }
    }
    if (scene.kind === "video-clip") {
      if (!scene.src.trim()) {
        throw new SpecError(
          `Scene "${scene.id}" is video-clip with empty src.`,
        );
      }
      for (const [name, f] of [
        ["startFraming", scene.startFraming] as const,
        ["endFraming", scene.endFraming] as const,
      ]) {
        if (f.scale < 0.5 || f.scale > 3) {
          throw new SpecError(
            `Scene "${scene.id}" ${name}.scale=${f.scale}; must be in [0.5, 3].`,
          );
        }
        if (f.focalX < 0 || f.focalX > 1 || f.focalY < 0 || f.focalY > 1) {
          throw new SpecError(
            `Scene "${scene.id}" ${name} focal coords out of [0, 1]: ` +
              `(${f.focalX}, ${f.focalY}).`,
          );
        }
      }
      const hold = scene.holdAtStartFrames ?? 0;
      if (hold < 0 || hold >= scene.durationFrames) {
        throw new SpecError(
          `Scene "${scene.id}" holdAtStartFrames=${hold}; must be in ` +
            `[0, durationFrames=${scene.durationFrames}).`,
        );
      }
    }
  }
}
