export interface Sprite {
  rows: string[];
  width: number;
  height: number;
}

function sprite(rows: string[]): Sprite {
  return {
    rows,
    width: Math.max(...rows.map((r) => r.length)),
    height: rows.length,
  };
}

// Hai frame chạy chỉ khác hàng chân để tạo cảm giác bước
export const DINO_RUN: Sprite[] = [
  sprite([
    "    ▄██▄",
    "█▄▄███▀▀",
    " ▀████▄ ",
    "  ▐▌ ▐▌ ",
  ]),
  sprite([
    "    ▄██▄",
    "█▄▄███▀▀",
    " ▀████▄ ",
    "   ▌▐▌  ",
  ]),
];

export const DINO_DUCK: Sprite[] = [
  sprite([
    "█▄▄██████▄█▀",
    "  ▐▌  ▐▌    ",
  ]),
  sprite([
    "█▄▄██████▄█▀",
    "   ▌  ▐▌    ",
  ]),
];

export const CACTI: Sprite[] = [
  sprite([
    "▄█▄",
    " █ ",
  ]),
  sprite([
    " █ ",
    "▄█▄",
    " █ ",
  ]),
  sprite([
    "  █  ",
    "█ █ ▄",
    "█▄█▄█",
    "  █  ",
  ]),
  sprite([
    " █  ▄█▄",
    "▄█▄  █ ",
    " █   █ ",
  ]),
];

export const BIRD: Sprite[] = [
  sprite([
    " ▄▄  ",
    "▀███▄",
  ]),
  sprite([
    "▄███▄",
    " ▀▀  ",
  ]),
];

export const CLOUD: Sprite = sprite([
  " ▁▄▄▄▁ ",
  "▔▔▔▔▔▔▔",
]);
