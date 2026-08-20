import type { Game } from "./game.ts";
import { BIRD, CLOUD, type Sprite } from "./sprites.ts";
import { DINO_X } from "./game.ts";

const ESC = "\x1b";
export const ENTER_SCREEN = `${ESC}[?1049h${ESC}[?25l`;
export const LEAVE_SCREEN = `${ESC}[0m${ESC}[?25h${ESC}[?1049l`;

const COLOR = {
  dino: `${ESC}[38;5;40m`,
  cactus: `${ESC}[38;5;28m`,
  bird: `${ESC}[38;5;178m`,
  cloud: `${ESC}[38;5;250m`,
  ground: `${ESC}[38;5;137m`,
  hud: `${ESC}[1;97m`,
  hudDim: `${ESC}[38;5;245m`,
  overTitle: `${ESC}[1;38;5;196m`,
  overText: `${ESC}[97m`,
  reset: `${ESC}[0m`,
};

const encoder = new TextEncoder();

export class Renderer {
  private chars: string[][] = [];
  private colors: string[][] = [];
  private prevChars: string[][] | null = null;
  private prevColors: string[][] | null = null;
  private cols = 0;
  private rows = 0;
  private groundRow = 0;

  frame(game: Game, cols: number, rows: number): void {
    this.lastTooSmall = "";
    this.cols = cols;
    this.rows = rows;
    this.groundRow = rows - 2;
    this.chars = Array.from({ length: rows }, () => Array(cols).fill(" "));
    this.colors = Array.from({ length: rows }, () => Array(cols).fill(""));

    this.drawGround(game.distance);
    for (const c of game.clouds) {
      this.draw(CLOUD, Math.round(c.x), c.bottom, COLOR.cloud);
    }
    for (const o of game.obstacles) {
      const sprite = o.kind === "bird"
        ? BIRD[Math.floor(game.animT / 0.15) % 2]
        : o.sprite;
      this.draw(sprite, Math.round(o.x), o.bottom, o.kind === "bird" ? COLOR.bird : COLOR.cactus);
    }
    this.draw(game.dinoSprite, DINO_X, Math.round(game.dinoY), COLOR.dino);
    this.drawHud(game);
    if (game.state === "dead") this.drawGameOver(game);
    if (game.state === "paused") this.drawPaused();

    this.flush();
  }

  private lastTooSmall = "";

  tooSmall(cols: number, rows: number): void {
    const msg = `Terminal too small (${cols}x${rows}). Minimum: 60x16.`;
    if (msg === this.lastTooSmall) return; // tránh flicker do vẽ lại mỗi frame
    this.lastTooSmall = msg;
    this.prevChars = null; // màn hình bị xóa → frame kế tiếp phải vẽ lại đủ
    Deno.stdout.writeSync(
      encoder.encode(`${ESC}[2J${ESC}[H${COLOR.hud}${msg}${COLOR.reset}`),
    );
  }

  private draw(sprite: Sprite, left: number, bottom: number, color: string): void {
    const top = this.groundRow - bottom - sprite.height;
    for (let r = 0; r < sprite.height; r++) {
      const y = top + r;
      if (y < 0 || y >= this.rows) continue;
      const row = sprite.rows[r];
      for (let c = 0; c < row.length; c++) {
        const x = left + c;
        if (x < 0 || x >= this.cols) continue;
        const ch = row[c];
        if (ch === " ") continue;
        this.chars[y][x] = ch;
        this.colors[y][x] = color;
      }
    }
  }

  private drawGround(distance: number): void {
    for (let x = 0; x < this.cols; x++) {
      this.chars[this.groundRow][x] = "─";
      this.colors[this.groundRow][x] = COLOR.ground;
      // Sỏi đá lăn theo quãng đường để tạo cảm giác chuyển động
      const worldX = x + Math.floor(distance);
      if (worldX % 7 === 0 && this.groundRow + 1 < this.rows) {
        this.chars[this.groundRow + 1][x] = "·";
        this.colors[this.groundRow + 1][x] = COLOR.ground;
      }
    }
  }

  private drawHud(game: Game): void {
    const hi = String(game.hiScore).padStart(5, "0");
    const score = String(game.score).padStart(5, "0");
    this.writeText(0, 1, "SPACE/↑ jump · ↓ duck · P pause · Q quit", COLOR.hudDim);
    this.writeText(1, 1, `LV ${game.level}`, COLOR.hudDim);
    this.writeText(1, this.cols - 18, `HI ${hi}`, COLOR.hudDim);
    this.writeText(1, this.cols - 8, score, COLOR.hud);
  }

  private drawGameOver(game: Game): void {
    const armed = game.restartPresses === 1;
    this.overlayBox([
      { text: "G A M E  O V E R", color: COLOR.overTitle },
      { text: `Score: ${String(game.score).padStart(5, "0")}`, color: COLOR.overText },
      {
        text: armed ? "press SPACE again to restart" : "SPACE ×2 / R: restart  Q: quit",
        color: armed ? COLOR.overTitle : COLOR.overText,
      },
    ]);
  }

  private drawPaused(): void {
    this.overlayBox([
      { text: "P A U S E D", color: COLOR.overTitle },
      { text: "P: resume  Q: quit", color: COLOR.overText },
    ]);
  }

  private overlayBox(content: { text: string; color: string }[]): void {
    const inner = 30;
    const center = (text: string): string => {
      const pad = Math.max(0, inner - [...text].length);
      const left = Math.floor(pad / 2);
      return `│${" ".repeat(left)}${text}${" ".repeat(pad - left)}│`;
    };
    const lines = [
      { text: `╭${"─".repeat(inner)}╮`, color: COLOR.overText },
      ...content.map((c) => ({ text: center(c.text), color: c.color })),
      { text: `╰${"─".repeat(inner)}╯`, color: COLOR.overText },
    ];
    const left = Math.max(0, Math.floor((this.cols - inner - 2) / 2));
    const top = Math.max(0, Math.floor((this.rows - lines.length) / 2));
    lines.forEach((line, i) => {
      this.writeText(top + i, left, line.text, line.color, true);
    });
  }

  private writeText(
    y: number,
    x: number,
    text: string,
    color: string,
    overwriteSpaces = false,
  ): void {
    if (y < 0 || y >= this.rows) return;
    const glyphs = [...text];
    for (let i = 0; i < glyphs.length; i++) {
      const px = x + i;
      if (px < 0 || px >= this.cols) continue;
      if (glyphs[i] === " " && !overwriteSpaces) continue;
      this.chars[y][px] = glyphs[i];
      this.colors[y][px] = color;
    }
  }

  // Chỉ gửi những cell thay đổi so với frame trước; vẽ lại toàn màn hình
  // mỗi frame khiến terminal không kịp xử lý và gây giật/tearing.
  private flush(): void {
    const full = this.prevChars === null ||
      this.prevChars.length !== this.rows ||
      this.prevChars[0].length !== this.cols;
    let out = "";
    let current = "\0"; // sentinel: luôn set màu ở cell đầu tiên

    if (full) {
      out = `${ESC}[2J${ESC}[H`;
      for (let y = 0; y < this.rows; y++) {
        for (let x = 0; x < this.cols; x++) {
          const color = this.colors[y][x];
          if (color !== current) {
            out += color === "" ? COLOR.reset : color;
            current = color;
          }
          out += this.chars[y][x];
        }
        if (y < this.rows - 1) out += "\r\n";
      }
    } else {
      const prevChars = this.prevChars!;
      const prevColors = this.prevColors!;
      for (let y = 0; y < this.rows; y++) {
        let x = 0;
        while (x < this.cols) {
          if (
            this.chars[y][x] === prevChars[y][x] &&
            this.colors[y][x] === prevColors[y][x]
          ) {
            x++;
            continue;
          }
          out += `${ESC}[${y + 1};${x + 1}H`;
          while (
            x < this.cols &&
            (this.chars[y][x] !== prevChars[y][x] ||
              this.colors[y][x] !== prevColors[y][x])
          ) {
            const color = this.colors[y][x];
            if (color !== current) {
              out += color === "" ? COLOR.reset : color;
              current = color;
            }
            out += this.chars[y][x];
            x++;
          }
        }
      }
    }

    this.prevChars = this.chars;
    this.prevColors = this.colors;
    if (out !== "") {
      Deno.stdout.writeSync(encoder.encode(out + COLOR.reset));
    }
  }
}
