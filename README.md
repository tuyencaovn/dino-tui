# dino-tui 🦖

The Chrome offline dinosaur game (`chrome://dino`), rebuilt for your terminal.
Pure Go, single static binary (~1.7MB), no runtime, no config.

```text
 SPACE/↑ jump · ↓ duck · P pause · Q quit
 LV 1                                               HI 00012  00012

                   ╭──────────────────────────────╮              ▁▄▄▄▁
                   │       G A M E  O V E R       │             ▔▔▔▔▔▔
                   │         Score: 00012         │
                   │SPACE ×2 / R: restart  Q: quit│
                   ╰──────────────────────────────╯

        ▄██▄
    █▄▄███▀▀
     ▀████▄
      ▐▌ ▐▌
──────────────────────────────────────────────────────────────────────
  ·      ·      ·      ·      ·      ·      ·      ·      ·      ·
```

## Features

- Jump over cacti, duck under birds (birds appear from 150 points, at two heights)
- Speed increases every 100 points, capped — always fair: obstacle spawning
  guarantees every pattern is dodgeable, verified by a self-playing bot in tests
- Forgiving Chrome-style hitboxes — grazing a cactus edge doesn't kill you
- 60 FPS with diff rendering (only changed cells are redrawn — smooth over SSH too)
- Pause, session high score, in-game key hints

## Install

With Go installed:

```bash
go install github.com/tuyencaovn/dino-tui@latest
dino-tui
```

Or build from source:

```bash
git clone https://github.com/tuyencaovn/dino-tui
cd dino-tui
make build          # binary for your machine
make release        # cross-compile macOS/Linux, amd64/arm64
```

Binaries are static — copy `dino-tui-linux-amd64` to any Linux box (or a
server, it plays fine over SSH) and run it. No dependencies needed.

## Controls

| Key | Action |
|-----|--------|
| `Space` / `↑` / `W` | Jump (press `↓` mid-air to fast-drop) |
| `↓` / `S` | Duck (hold) |
| `P` | Pause / resume |
| `Space ×2` / `R` | Restart after game over |
| `Q` / `Ctrl-C` | Quit |

Requires a UTF-8 terminal of at least 60×16.

## Development

```bash
make test   # go vet + full test suite
```

The test suite includes a clearability check (every cactus type must have a
humanly-possible jump window) and a 120-second self-playing bot that must
survive into the bird phase without dying.

## License

[MIT](LICENSE)
