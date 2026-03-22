function lerp(start, end, amount) {
  return start + (end - start) * amount;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function laneY(beat, lane, height) {
  const horizonY = beat.horizon * height;

  if (lane === 'sky') {
    return horizonY - height * 0.22;
  }

  if (lane === 'back') {
    return horizonY + height * 0.04;
  }

  if (lane === 'mid') {
    return horizonY + height * 0.12;
  }

  return horizonY + height * 0.2;
}

function laneScale(lane) {
  if (lane === 'sky') {
    return 0.7;
  }

  if (lane === 'back') {
    return 0.82;
  }

  if (lane === 'mid') {
    return 1;
  }

  return 1.18;
}

function drawGradient(p5, topColor, bottomColor) {
  const top = p5.color(topColor);
  const bottom = p5.color(bottomColor);

  for (let index = 0; index < p5.height; index += 6) {
    const blend = index / Math.max(1, p5.height);
    const shade = p5.lerpColor(top, bottom, blend);
    p5.stroke(shade);
    p5.line(0, index, p5.width, index);
  }
}

function drawCelestialBody(p5, beat, elapsedMs) {
  const pulse = 0.95 + Math.sin(elapsedMs * 0.0002) * 0.05;
  const radius = Math.min(p5.width, p5.height) * 0.16 * pulse;
  const x = p5.width * (beat.locationId === 'palace' ? 0.78 : 0.72);
  const y = p5.height * (beat.locationId === 'forest' ? 0.2 : 0.24);

  p5.noStroke();
  p5.fill(p5.color(beat.palette.glow));
  p5.circle(x, y, radius * 1.12);
  p5.fill(255, 250, 235, 28);
  p5.circle(x, y, radius * 1.6);
}

function drawStars(p5, beat, elapsedMs) {
  const starCount = beat.paletteId === 'sunset' ? 10 : 22;

  p5.noStroke();

  for (let index = 0; index < starCount; index += 1) {
    const offset = index * 97 + beat.beatIndex * 17;
    const x = (offset * 23) % p5.width;
    const y = 40 + ((offset * 41) % Math.floor(p5.height * 0.36));
    const flicker = 110 + Math.sin(elapsedMs * 0.002 + index) * 60;
    const size = 1.8 + (index % 3);

    p5.fill(255, 245, 220, flicker);
    p5.circle(x, y, size);
  }
}

function drawGroundBands(p5, beat) {
  const horizonY = beat.horizon * p5.height;

  p5.noStroke();
  p5.fill(0, 0, 0, 72);
  p5.rect(0, horizonY, p5.width, p5.height - horizonY);

  p5.fill(p5.color(beat.palette.haze));
  p5.rect(0, horizonY - 6, p5.width, 12);
}

function drawDunesBackdrop(p5, beat) {
  const horizonY = beat.horizon * p5.height;

  p5.noStroke();
  p5.fill(0, 0, 0, 70);
  p5.arc(p5.width * 0.18, horizonY + 18, p5.width * 0.4, p5.height * 0.24, p5.PI, p5.TWO_PI);
  p5.arc(p5.width * 0.48, horizonY + 12, p5.width * 0.54, p5.height * 0.22, p5.PI, p5.TWO_PI);
  p5.arc(p5.width * 0.84, horizonY + 24, p5.width * 0.46, p5.height * 0.2, p5.PI, p5.TWO_PI);
}

function drawPalaceBackdrop(p5, beat) {
  const horizonY = beat.horizon * p5.height;
  const fillShade = p5.color(0, 0, 0, 78);

  p5.noStroke();
  p5.fill(fillShade);
  p5.rect(p5.width * 0.08, horizonY - 38, p5.width * 0.78, 48);
  p5.rect(p5.width * 0.18, horizonY - 112, 34, 112);
  p5.rect(p5.width * 0.34, horizonY - 146, 42, 146);
  p5.rect(p5.width * 0.58, horizonY - 124, 38, 124);
  p5.rect(p5.width * 0.76, horizonY - 100, 28, 100);

  p5.arc(p5.width * 0.18, horizonY - 112, 48, 50, p5.PI, p5.TWO_PI);
  p5.arc(p5.width * 0.35, horizonY - 146, 68, 64, p5.PI, p5.TWO_PI);
  p5.arc(p5.width * 0.59, horizonY - 124, 58, 56, p5.PI, p5.TWO_PI);
  p5.arc(p5.width * 0.77, horizonY - 100, 42, 42, p5.PI, p5.TWO_PI);
}

function drawCliffBackdrop(p5, beat) {
  const horizonY = beat.horizon * p5.height;

  p5.noStroke();
  p5.fill(0, 0, 0, 74);

  p5.beginShape();
  p5.vertex(0, horizonY + 18);
  p5.vertex(p5.width * 0.14, horizonY - 86);
  p5.vertex(p5.width * 0.22, horizonY - 42);
  p5.vertex(p5.width * 0.34, horizonY - 112);
  p5.vertex(p5.width * 0.46, horizonY - 26);
  p5.vertex(p5.width * 0.6, horizonY - 74);
  p5.vertex(p5.width * 0.72, horizonY - 30);
  p5.vertex(p5.width * 0.92, horizonY - 92);
  p5.vertex(p5.width, horizonY + 18);
  p5.endShape(p5.CLOSE);

  p5.fill(255, 255, 255, 20);
  p5.rect(0, horizonY + 18, p5.width, 5);
}

function drawForestBackdrop(p5, beat) {
  const horizonY = beat.horizon * p5.height;

  p5.noStroke();
  p5.fill(0, 0, 0, 68);

  for (let index = 0; index < 8; index += 1) {
    const x = p5.width * (0.08 + index * 0.11);
    const trunkWidth = 18 + (index % 3) * 10;
    const trunkHeight = 120 + (index % 4) * 32;

    p5.rect(x, horizonY - trunkHeight, trunkWidth, trunkHeight);
    p5.arc(x + trunkWidth * 0.5, horizonY - trunkHeight, trunkWidth * 4, trunkHeight * 0.8, p5.PI, p5.TWO_PI);
  }
}

function drawBackdrop(p5, beat) {
  if (beat.locationId === 'desert') {
    drawDunesBackdrop(p5, beat);
    return;
  }

  if (beat.locationId === 'palace') {
    drawPalaceBackdrop(p5, beat);
    return;
  }

  if (beat.locationId === 'island') {
    drawCliffBackdrop(p5, beat);
    return;
  }

  drawForestBackdrop(p5, beat);
}

function drawForegroundPalms(p5) {
  p5.noStroke();
  p5.fill(0);

  const positions = [0.04, 0.92];

  positions.forEach((ratio, index) => {
    const x = p5.width * ratio;
    const direction = index === 0 ? 1 : -1;

    p5.rect(x, p5.height * 0.5, 26, p5.height * 0.5);

    for (let frondIndex = 0; frondIndex < 6; frondIndex += 1) {
      const y = p5.height * (0.5 + frondIndex * 0.03);
      p5.arc(x + 10, y, 180, 50, direction === 1 ? p5.PI : 0, direction === 1 ? p5.TWO_PI : p5.PI);
    }
  });
}

function drawForegroundArch(p5) {
  p5.noStroke();
  p5.fill(0);
  p5.rect(0, 0, p5.width, 42);
  p5.rect(0, 0, 58, p5.height);
  p5.rect(p5.width - 58, 0, 58, p5.height);
  p5.arc(p5.width * 0.5, 46, p5.width * 0.48, p5.height * 0.28, p5.PI, p5.TWO_PI);
}

function drawForegroundRocks(p5) {
  p5.noStroke();
  p5.fill(0);

  p5.beginShape();
  p5.vertex(0, p5.height);
  p5.vertex(0, p5.height * 0.72);
  p5.vertex(p5.width * 0.08, p5.height * 0.64);
  p5.vertex(p5.width * 0.16, p5.height * 0.76);
  p5.vertex(p5.width * 0.2, p5.height);
  p5.endShape(p5.CLOSE);

  p5.beginShape();
  p5.vertex(p5.width, p5.height);
  p5.vertex(p5.width, p5.height * 0.66);
  p5.vertex(p5.width * 0.9, p5.height * 0.58);
  p5.vertex(p5.width * 0.82, p5.height * 0.74);
  p5.vertex(p5.width * 0.76, p5.height);
  p5.endShape(p5.CLOSE);
}

function drawForegroundBranches(p5) {
  p5.stroke(0);
  p5.strokeWeight(16);
  p5.noFill();
  p5.beginShape();
  p5.vertex(p5.width * 0.06, p5.height * 0.18);
  p5.bezierVertex(p5.width * 0.2, p5.height * 0.14, p5.width * 0.26, p5.height * 0.26, p5.width * 0.34, p5.height * 0.2);
  p5.endShape();
  p5.beginShape();
  p5.vertex(p5.width * 0.94, p5.height * 0.1);
  p5.bezierVertex(p5.width * 0.76, p5.height * 0.2, p5.width * 0.72, p5.height * 0.28, p5.width * 0.62, p5.height * 0.22);
  p5.endShape();
}

function drawForeground(p5, beat) {
  if (beat.locationId === 'desert') {
    drawForegroundPalms(p5);
    return;
  }

  if (beat.locationId === 'palace') {
    drawForegroundArch(p5);
    return;
  }

  if (beat.locationId === 'island') {
    drawForegroundRocks(p5);
    return;
  }

  drawForegroundBranches(p5);
}

function drawHero(p5, motionPhase) {
  p5.noStroke();
  p5.fill(0);
  p5.circle(0, -58, 18);
  p5.triangle(-6, -50, 26, -20, -16, -20);
  p5.quad(-14, -18, 8, -18, 16, 26, -12, 26);
  p5.rect(-4, 26, 6, 34);
  p5.rect(-20, 26, 6, 32 + Math.sin(motionPhase) * 4);
  p5.rect(14, 26, 6, 32 - Math.sin(motionPhase) * 4);
  p5.triangle(10, -28, 38, -18, 8, -8);
}

function drawGuard(p5, motionPhase) {
  p5.noStroke();
  p5.fill(0);
  p5.circle(0, -60, 16);
  p5.rect(-12, -46, 22, 54);
  p5.rect(-4, 8, 6, 40 + Math.sin(motionPhase) * 3);
  p5.rect(-18, 8, 6, 38 - Math.sin(motionPhase) * 3);
  p5.rect(18, -58, 4, 120);
  p5.triangle(22, -60, 34, -44, 22, -28);
}

function drawWitch(p5, motionPhase) {
  p5.noStroke();
  p5.fill(0);
  p5.circle(0, -66, 16);
  p5.triangle(-10, -58, 8, -92, 20, -56);
  p5.beginShape();
  p5.vertex(-18, -48);
  p5.vertex(20, -50);
  p5.vertex(40 + Math.sin(motionPhase) * 8, 34);
  p5.vertex(-34, 34);
  p5.endShape(p5.CLOSE);
  p5.quad(6, -34, 18, -30, 40, -4 + Math.sin(motionPhase) * 10, 28, 4);
}

function drawHorse(p5, motionPhase) {
  p5.noStroke();
  p5.fill(0);
  p5.ellipse(0, -22, 94, 34);
  p5.ellipse(44, -34, 30, 18);
  p5.rect(34, -42, 12, 24);
  p5.triangle(50, -40, 62, -52, 52, -30);

  const stride = Math.sin(motionPhase) * 10;

  p5.rect(-28, -8, 8, 48 + stride);
  p5.rect(-6, -8, 8, 46 - stride);
  p5.rect(16, -8, 8, 44 + stride);
  p5.rect(36, -8, 8, 42 - stride);

  p5.triangle(-44, -30, -72, -18, -44, -12);
}

function drawRider(p5, motionPhase) {
  drawHorse(p5, motionPhase);

  p5.push();
  p5.translate(-6, -34);
  drawHero(p5, motionPhase * 0.8);
  p5.pop();
}

function drawFlyingRider(p5, motionPhase) {
  p5.push();
  p5.translate(0, Math.sin(motionPhase) * 12);
  drawRider(p5, motionPhase);
  p5.fill(0);
  p5.arc(-12, -28, 86, 34, p5.PI * 0.1, p5.PI * 0.95);
  p5.arc(26, -28, 90, 34, p5.PI * 0.1, p5.PI * 0.95);
  p5.pop();
}

function drawBirdFlock(p5, elapsedMs) {
  p5.noFill();
  p5.stroke(0);
  p5.strokeWeight(3);

  for (let index = 0; index < 4; index += 1) {
    const x = index * 22;
    const flap = Math.sin(elapsedMs * 0.01 + index) * 9;
    p5.arc(x, flap, 18, 12, p5.PI, p5.TWO_PI);
    p5.arc(x + 14, flap, 18, 12, p5.PI, p5.TWO_PI);
  }
}

function computeActorPosition(p5, beat, actor, elapsedMs, durationMs) {
  const timeProgress = clamp(elapsedMs / Math.max(1, durationMs), 0, 1);
  let motionProgress = timeProgress;

  if (actor.kind === 'bird-flock') {
    motionProgress = 0.1 + timeProgress * 0.9;
  }

  const x = p5.width * lerp(actor.xStart, actor.xEnd, motionProgress);
  const baseY = laneY(beat, actor.lane, p5.height);
  const bob = actor.kind === 'bird-flock' || actor.kind === 'flying-rider'
    ? Math.sin(elapsedMs * 0.003 + actor.xStart * 10) * p5.height * 0.024
    : Math.sin(elapsedMs * 0.002 + actor.xStart * 8) * p5.height * 0.008;

  return {
    x,
    y: baseY + bob
  };
}

function drawActor(p5, beat, actor, elapsedMs, durationMs) {
  const { x, y } = computeActorPosition(p5, beat, actor, elapsedMs, durationMs);
  const scale = actor.scale * laneScale(actor.lane);
  const motionPhase = elapsedMs * 0.01 + actor.xStart * 7;

  p5.push();
  p5.translate(x, y);
  p5.scale(actor.direction * scale, scale);

  if (actor.kind === 'hero') {
    drawHero(p5, motionPhase);
  } else if (actor.kind === 'guard') {
    drawGuard(p5, motionPhase);
  } else if (actor.kind === 'witch') {
    drawWitch(p5, motionPhase);
  } else if (actor.kind === 'rider') {
    drawRider(p5, motionPhase);
  } else if (actor.kind === 'flying-rider') {
    drawFlyingRider(p5, motionPhase);
  } else if (actor.kind === 'bird-flock') {
    drawBirdFlock(p5, elapsedMs);
  }

  p5.pop();
}

function drawHazeOverlay(p5, beat, elapsedMs) {
  const glow = p5.color(beat.palette.glow);
  const haze = p5.color(beat.palette.haze);
  const blend = 0.42 + Math.sin(elapsedMs * 0.00025) * 0.06;
  const tint = p5.lerpColor(glow, haze, blend);

  p5.noStroke();
  p5.fill(tint.levels[0], tint.levels[1], tint.levels[2], 22);
  p5.rect(0, 0, p5.width, p5.height);
}

export function renderStoryBeat(p5, beat, storyState, elapsedMs) {
  drawGradient(p5, beat.palette.skyTop, beat.palette.skyBottom);
  drawCelestialBody(p5, beat, elapsedMs);
  drawStars(p5, beat, elapsedMs);
  drawBackdrop(p5, beat);
  drawGroundBands(p5, beat);

  const orderedActors = [...beat.actors].sort((left, right) => {
    const order = ['sky', 'back', 'mid', 'front'];
    return order.indexOf(left.lane) - order.indexOf(right.lane);
  });

  orderedActors.forEach((actor) => {
    drawActor(p5, beat, actor, elapsedMs, storyState.beatDurationMs);
  });

  drawForeground(p5, beat);
  drawHazeOverlay(p5, beat, elapsedMs);
}
