import { Game } from "./game.ts";
import { ENTER_SCREEN, LEAVE_SCREEN, Renderer } from "./render.ts";
import { startInput } from "./input.ts";

const MIN_COLS = 60;
const MIN_ROWS = 16;
const FRAME_MS = 16;

const encoder = new TextEncoder();

function restoreTerminal(): void {
  try {
    Deno.stdin.setRaw(false);
  } catch {
    // stdin có thể không phải TTY; bỏ qua
  }
  Deno.stdout.writeSync(encoder.encode(LEAVE_SCREEN));
}

async function main(): Promise<void> {
  const { columns } = Deno.consoleSize();
  const game = new Game(columns);
  const renderer = new Renderer();
  let quit = false;

  startInput((key) => {
    switch (key) {
      case "jump":
        game.jumpKey();
        break;
      case "duck":
        game.duck();
        break;
      case "restart":
        if (game.state === "dead") game.reset();
        break;
      case "pause":
        game.togglePause();
        break;
      case "quit":
        quit = true;
        break;
    }
  });

  Deno.stdout.writeSync(encoder.encode(ENTER_SCREEN));

  let last = performance.now();
  while (!quit) {
    const now = performance.now();
    // Chặn dt lớn (máy lag, laptop sleep) để dino không xuyên vật cản
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;

    const { columns: cols, rows } = Deno.consoleSize();
    if (cols < MIN_COLS || rows < MIN_ROWS) {
      renderer.tooSmall(cols, rows);
    } else {
      game.width = cols;
      game.tick(dt);
      renderer.frame(game, cols, rows);
    }

    const elapsed = performance.now() - now;
    await new Promise((r) => setTimeout(r, Math.max(0, FRAME_MS - elapsed)));
  }
}

if (import.meta.main) {
  if (!Deno.stdin.isTerminal() || !Deno.stdout.isTerminal()) {
    console.error("This game must run in a real terminal (TTY).");
    Deno.exit(1);
  }
  for (const signal of ["SIGTERM", "SIGHUP"] as const) {
    Deno.addSignalListener(signal, () => {
      restoreTerminal();
      Deno.exit(0);
    });
  }
  try {
    await main();
  } finally {
    restoreTerminal();
  }
  // Pending stdin.read() giữ event loop sống mãi; phải exit tường minh
  Deno.exit(0);
}
