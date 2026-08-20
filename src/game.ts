import { BIRD, CACTI, DINO_DUCK, DINO_RUN, type Sprite } from "./sprites.ts";

export type GameState = "playing" | "paused" | "dead";

export interface Obstacle {
  x: number; // mép trái, tính bằng cột (float)
  bottom: number; // số hàng phía trên mặt đất
  sprite: Sprite;
  kind: "cactus" | "bird";
}

export interface CloudPos {
  x: number;
  bottom: number;
}

export interface Box {
  x: number;
  y: number; // bottom, hàng phía trên mặt đất
  w: number;
  h: number;
}

export function boxesOverlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && b.x < a.x + a.w &&
    a.y < b.y + b.h && b.y < a.y + a.h;
}

export const DINO_X = 4;
export const BASE_SPEED = 20; // cột/giây
export const SPEED_STEP = 2; // cộng thêm mỗi 100 điểm
export const MAX_SPEED = 44;
// Đỉnh nhảy ≈ v²/2g ≈ 7.5 hàng, airtime ≈ 0.94s. Ràng buộc: thời gian dino
// ở trên đỉnh cactus cao nhất (4 hàng) phải DÀI hơn thời gian hai hitbox
// chồng nhau theo trục ngang ở tốc độ chậm nhất, nếu không cây cao trở thành
// không thể né (đỉnh 5 hàng cho cửa sổ 0.42s < 0.55s chồng ngang → bất khả).
export const JUMP_VELOCITY = 32; // hàng/giây
export const GRAVITY = 68; // hàng/giây²
const BIRD_MIN_SCORE = 150;
// Phải dài hơn initial key-repeat delay của macOS (~500ms), nếu không dino
// đứng dậy giữa lần nhấn ↓ đầu tiên và lúc key-repeat bắt đầu.
const DUCK_HOLD_MS = 600;

export class Game {
  state: GameState = "playing";
  width: number;
  dinoY = 0; // độ cao chân dino so với mặt đất (float)
  velY = 0;
  ducking = false;
  obstacles: Obstacle[] = [];
  clouds: CloudPos[] = [];
  distance = 0;
  score = 0;
  hiScore = 0;
  animT = 0; // đồng hồ animation, giây
  private duckMs = 0;
  private nextKind: "cactus" | "bird" = "cactus";
  private nextGap: number;

  constructor(width: number) {
    this.width = width;
    this.nextGap = this.rollNext();
  }

  get speed(): number {
    return Math.min(BASE_SPEED + Math.floor(this.score / 100) * SPEED_STEP, MAX_SPEED);
  }

  get level(): number {
    return Math.floor(this.score / 100) + 1;
  }

  get dinoSprite(): Sprite {
    const frames = this.ducking ? DINO_DUCK : DINO_RUN;
    // Chỉ đảo chân khi đang chạy trên mặt đất
    const frame = this.dinoY > 0 ? 0 : Math.floor(this.animT / 0.15) % 2;
    return frames[frame];
  }

  // Phím nhảy kiêm restart: khi đã chết, nhấn 2 lần liên tiếp mới chơi lại
  // để tránh restart oan do đang spam space lúc chết
  restartPresses = 0;

  jumpKey(): void {
    if (this.state === "dead") {
      this.restartPresses++;
      if (this.restartPresses >= 2) this.reset();
      return;
    }
    this.jump();
  }

  jump(): void {
    if (this.state !== "playing") return;
    if (this.dinoY === 0) {
      this.velY = JUMP_VELOCITY;
      this.duckMs = 0;
    }
  }

  togglePause(): void {
    if (this.state === "playing") this.state = "paused";
    else if (this.state === "paused") this.state = "playing";
  }

  duck(): void {
    if (this.state !== "playing") return;
    if (this.dinoY > 0) {
      // Đang trên không: nhấn xuống để rơi nhanh như Chrome dino
      this.velY = Math.min(this.velY, -JUMP_VELOCITY * 1.5);
    } else {
      // Terminal không có sự kiện nhả phím; key-repeat khi giữ ↓ sẽ
      // liên tục gia hạn bộ đếm này nên "giữ để cúi" vẫn hoạt động.
      this.duckMs = DUCK_HOLD_MS;
    }
  }

  reset(): void {
    this.state = "playing";
    this.restartPresses = 0;
    this.dinoY = 0;
    this.velY = 0;
    this.ducking = false;
    this.duckMs = 0;
    this.obstacles = [];
    this.clouds = [];
    this.distance = 0;
    this.score = 0;
    this.animT = 0;
    this.nextGap = this.rollNext();
  }

  tick(dt: number): void {
    if (this.state !== "playing") return;
    this.animT += dt;
    this.distance += this.speed * dt;
    this.score = Math.floor(this.distance / 5);

    if (this.dinoY > 0 || this.velY > 0) {
      this.dinoY += this.velY * dt;
      this.velY -= GRAVITY * dt;
      if (this.dinoY <= 0) {
        this.dinoY = 0;
        this.velY = 0;
      }
    }
    this.duckMs = Math.max(0, this.duckMs - dt * 1000);
    this.ducking = this.duckMs > 0 && this.dinoY === 0;

    for (const o of this.obstacles) {
      // Chim bay nhanh hơn nền một chút cho giống Chrome
      o.x -= this.speed * dt * (o.kind === "bird" ? 1.15 : 1);
    }
    this.obstacles = this.obstacles.filter((o) => o.x + o.sprite.width > -2);
    this.maybeSpawnObstacle();

    for (const c of this.clouds) c.x -= this.speed * dt * 0.25;
    this.clouds = this.clouds.filter((c) => c.x > -8);
    this.maybeSpawnCloud();

    if (this.hitsObstacle()) {
      this.state = "dead";
      this.hiScore = Math.max(this.hiScore, this.score);
    }
  }

  minGap(): number {
    // Khoảng cách tối thiểu scale theo tốc độ: airtime 0.94s + quỹ phản xạ
    // ~0.4s để hai vật cản liên tiếp luôn né được
    return this.speed * 1.35;
  }

  // Quyết định loại vật cản KẾ TIẾP ngay khi roll gap: chim bay nhanh hơn
  // nền 15% nên thu hẹp khoảng cách với vật cản phía trước tối đa
  // ~0.13 × bề rộng màn hình — nếu là chim thì đòi gap dài hơn từ đầu,
  // tránh tạo cặp vật cản không thể né.
  private rollNext(): number {
    this.nextKind = this.score >= BIRD_MIN_SCORE && Math.random() < 0.25
      ? "bird"
      : "cactus";
    const birdMargin = this.nextKind === "bird" ? this.width * 0.15 : 0;
    return this.minGap() + birdMargin + Math.random() * 40;
  }

  private maybeSpawnObstacle(): void {
    const last = this.obstacles[this.obstacles.length - 1];
    const gapNow = last ? this.width - last.x : Infinity;
    if (gapNow < this.nextGap) return;

    if (this.nextKind === "bird") {
      // bottom 1: chim thấp phải nhảy; bottom 3: chim ngang đầu phải cúi
      const bottom = Math.random() < 0.5 ? 1 : 3;
      this.obstacles.push({ x: this.width, bottom, sprite: BIRD[0], kind: "bird" });
    } else {
      const sprite = CACTI[Math.floor(Math.random() * CACTI.length)];
      this.obstacles.push({ x: this.width, bottom: 0, sprite, kind: "cactus" });
    }
    this.nextGap = this.rollNext();
  }

  private maybeSpawnCloud(): void {
    if (this.clouds.length >= 3 || Math.random() > 0.01) return;
    this.clouds.push({
      x: this.width,
      bottom: 7 + Math.floor(Math.random() * 6),
    });
  }

  dinoBox(): Box {
    const s = this.dinoSprite;
    // Thu hẹp 2 cột mỗi bên: hitbox khoan dung kiểu Chrome, đồng thời nới
    // cửa sổ thời gian để nhảy qua cactus cao/rộng ở tốc độ chậm
    return {
      x: DINO_X + 2,
      y: Math.round(this.dinoY),
      w: s.width - 4,
      h: s.height,
    };
  }

  private hitsObstacle(): boolean {
    const dino = this.dinoBox();
    // Vật cản cũng thu 1 cột mỗi bên: sượt mép gai không tính chết,
    // tránh kiểu "đáp trúng đuôi cactus rộng" ức chế
    return this.obstacles.some((o) =>
      boxesOverlap(dino, {
        x: o.x + 1,
        y: o.bottom,
        w: o.sprite.width - 2,
        h: o.sprite.height,
      })
    );
  }
}
