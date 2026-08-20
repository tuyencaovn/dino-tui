import {
  BASE_SPEED,
  boxesOverlap,
  DINO_X,
  Game,
  JUMP_VELOCITY,
  MAX_SPEED,
  type Obstacle,
} from "./game.ts";
import { CACTI } from "./sprites.ts";

function assert(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg);
}

Deno.test("boxesOverlap: chồng lấn và tách rời", () => {
  const a = { x: 0, y: 0, w: 4, h: 4 };
  assert(boxesOverlap(a, { x: 2, y: 2, w: 4, h: 4 }), "chồng lấn phải trả true");
  assert(!boxesOverlap(a, { x: 4, y: 0, w: 4, h: 4 }), "chạm mép không tính là va chạm");
  assert(!boxesOverlap(a, { x: 10, y: 0, w: 2, h: 2 }), "tách rời phải trả false");
  assert(!boxesOverlap(a, { x: 0, y: 4, w: 4, h: 4 }), "tách theo trục dọc phải trả false");
});

Deno.test("nhảy: dino bay lên rồi rơi về mặt đất", () => {
  const game = new Game(80);
  game.obstacles = [];
  game.jump();
  let peak = 0;
  let landed = false;
  for (let i = 0; i < 100; i++) {
    game.tick(0.033);
    game.obstacles = []; // cô lập physics khỏi spawn ngẫu nhiên
    peak = Math.max(peak, game.dinoY);
    if (i > 5 && game.dinoY === 0) {
      landed = true;
      break;
    }
  }
  assert(peak >= 6.5, `đỉnh nhảy phải ≥ 6.5 hàng để dư sức qua cactus 4 hàng, được ${peak}`);
  assert(landed, "dino phải rơi về mặt đất");
});

Deno.test("mọi loại cactus đều nhảy qua được với cửa sổ thời gian đủ rộng", () => {
  for (const sprite of CACTI) {
    let survivors = 0;
    for (let delay = 0; delay <= 1.4; delay += 0.016) {
      const game = new Game(100);
      const target: Obstacle = { x: 30, bottom: 0, sprite, kind: "cactus" };
      game.obstacles = [target];
      let jumped = false;
      let dead = false;
      for (let t = 0; t < 3; t += 0.016) {
        if (t >= delay && !jumped) {
          game.jump();
          jumped = true;
        }
        game.tick(0.016);
        // Cô lập kịch bản: bỏ vật cản spawn ngẫu nhiên, chỉ giữ mục tiêu
        game.obstacles = game.obstacles.filter((o) => o === target);
        if (game.state === "dead") {
          dead = true;
          break;
        }
        if (target.x + sprite.width < DINO_X - 1) break; // đã vượt qua
      }
      if (!dead) survivors++;
    }
    // ≥ 6 nhịp 16ms sống sót ⇒ cửa sổ né ≥ ~0.1s, con người bấm được
    assert(
      survivors >= 6,
      `cactus ${sprite.width}x${sprite.height}: chỉ ${survivors} thời điểm nhảy sống sót — gần như không thể né`,
    );
  }
});

Deno.test("bot tự chơi 120 giây: sống qua giai đoạn có chim", () => {
  const game = new Game(100);
  let deaths = 0;
  for (let t = 0; t < 120; t += 0.016) {
    let nearest: Obstacle | null = null;
    for (const o of game.obstacles) {
      if (o.x + o.sprite.width < DINO_X) continue;
      if (!nearest || o.x < nearest.x) nearest = o;
    }
    if (nearest) {
      const closing = game.speed * (nearest.kind === "bird" ? 1.15 : 1);
      // tti tính theo mép hitbox (vật cản thu 1 cột, dino thu 2 cột)
      const tti = (nearest.x + 1 - (DINO_X + 2 + 4)) / closing;
      if (tti <= 0.2) {
        if (nearest.kind === "bird" && nearest.bottom >= 3) game.duck();
        else game.jump();
      }
    }
    game.tick(0.016);
    if (game.state === "dead") {
      deaths++;
      game.reset();
    }
  }
  const best = Math.max(game.hiScore, game.score); // hiScore chỉ ghi lúc chết
  assert(
    best >= 300,
    `bot phải đạt ≥ 300 điểm (chim xuất hiện từ 150), được ${best}`,
  );
  assert(deaths <= 1, `bot phản xạ 0.25s chết ${deaths} lần — game không công bằng`);
});

Deno.test("nhảy đôi bị chặn: không nhảy khi đang trên không", () => {
  const game = new Game(80);
  game.jump();
  game.tick(0.033);
  const velBefore = game.velY;
  game.jump();
  assert(game.velY === velBefore, "jump giữa không trung không được đổi vận tốc");
  assert(game.velY < JUMP_VELOCITY, "vận tốc phải đã giảm do trọng lực");
});

Deno.test("tốc độ tăng theo điểm và có trần", () => {
  const game = new Game(80);
  assert(game.speed === BASE_SPEED, "tốc độ khởi đầu phải là BASE_SPEED");
  game.score = 100;
  const atLevel2 = game.speed;
  assert(atLevel2 > BASE_SPEED, "tốc độ phải tăng ở mốc 100 điểm");
  game.score = 99999;
  assert(game.speed === MAX_SPEED, "tốc độ phải bị chặn ở MAX_SPEED");
});

Deno.test("cúi: hitbox thấp hơn và tự đứng dậy khi hết giữ phím", () => {
  const game = new Game(80);
  const standing = game.dinoBox().h;
  game.duck();
  game.tick(0.033);
  assert(game.ducking, "phải ở trạng thái cúi ngay sau khi nhấn");
  assert(game.dinoBox().h < standing, "hitbox cúi phải thấp hơn đứng");
  game.tick(0.7); // quá thời hạn giữ phím (DUCK_HOLD_MS = 600)
  assert(!game.ducking, "phải đứng dậy khi không còn nhấn ↓");
});

Deno.test("spawn: khoảng cách giữa các vật cản đủ để né", () => {
  const game = new Game(120);
  for (let i = 0; i < 3000; i++) {
    game.tick(0.033);
    if (game.state === "dead") game.reset();
    for (let j = 1; j < game.obstacles.length; j++) {
      const prev = game.obstacles[j - 1];
      const cur = game.obstacles[j];
      const gap = cur.x - prev.x;
      // Bird-safe-gap khi spawn đã bù phần chim bay nhanh hơn nền
      const tolerance = 2;
      assert(
        gap >= game.minGap() - tolerance,
        `khoảng cách ${gap.toFixed(1)} nhỏ hơn tối thiểu ${game.minGap()}`,
      );
    }
  }
});

Deno.test("game over: space 2 lần mới restart, 1 lần thì chưa", () => {
  const game = new Game(80);
  game.jumpKey();
  assert(game.velY === JUMP_VELOCITY, "đang chơi thì phím space phải là nhảy");

  game.state = "dead";
  game.jumpKey();
  assert((game.state as string) === "dead", "nhấn space 1 lần chưa được restart");
  assert(game.restartPresses === 1, "phải ghi nhận lần nhấn đầu");
  game.jumpKey();
  assert((game.state as string) === "playing", "nhấn space lần 2 phải restart");
  assert(game.restartPresses === 0, "bộ đếm phải về 0 sau restart");
});

Deno.test("pause: đóng băng game, resume chạy tiếp, không pause khi chết", () => {
  const game = new Game(80);
  game.togglePause();
  assert(game.state === "paused", "P phải chuyển sang paused");
  const distBefore = game.distance;
  game.tick(0.5);
  game.jump();
  assert(game.distance === distBefore, "khi pause quãng đường không được tăng");
  assert(game.velY === 0, "khi pause không được nhảy");
  game.togglePause();
  assert((game.state as string) === "playing", "P lần nữa phải resume");
  game.state = "dead";
  game.togglePause();
  assert((game.state as string) === "dead", "chết rồi thì không pause được");
});

Deno.test("reset: giữ hi-score, đưa game về trạng thái đầu", () => {
  const game = new Game(80);
  game.score = 250;
  game.hiScore = 250;
  game.state = "dead";
  game.reset();
  assert((game.state as string) === "playing", "reset phải quay lại playing");
  assert(game.score === 0, "điểm phải về 0");
  assert(game.hiScore === 250, "hi-score phải được giữ qua các ván");
  assert(game.obstacles.length === 0, "vật cản phải bị xóa");
});
