package main

type Sprite struct {
	Rows [][]rune
	W, H int
}

func sprite(rows ...string) Sprite {
	rr := make([][]rune, len(rows))
	w := 0
	for i, r := range rows {
		rr[i] = []rune(r)
		if len(rr[i]) > w {
			w = len(rr[i])
		}
	}
	return Sprite{Rows: rr, W: w, H: len(rows)}
}

// Hai frame chạy chỉ khác hàng chân để tạo cảm giác bước
var dinoRun = []Sprite{
	sprite(
		"    ▄██▄",
		"█▄▄███▀▀",
		" ▀████▄ ",
		"  ▐▌ ▐▌ ",
	),
	sprite(
		"    ▄██▄",
		"█▄▄███▀▀",
		" ▀████▄ ",
		"   ▌▐▌  ",
	),
}

var dinoDuck = []Sprite{
	sprite(
		"█▄▄██████▄█▀",
		"  ▐▌  ▐▌    ",
	),
	sprite(
		"█▄▄██████▄█▀",
		"   ▌  ▐▌    ",
	),
}

var cacti = []Sprite{
	sprite(
		"▄█▄",
		" █ ",
	),
	sprite(
		" █ ",
		"▄█▄",
		" █ ",
	),
	sprite(
		"  █  ",
		"█ █ ▄",
		"█▄█▄█",
		"  █  ",
	),
	sprite(
		" █  ▄█▄",
		"▄█▄  █ ",
		" █   █ ",
	),
}

var birdFrames = []Sprite{
	sprite(
		" ▄▄  ",
		"▀███▄",
	),
	sprite(
		"▄███▄",
		" ▀▀  ",
	),
}

var cloudSprite = sprite(
	" ▁▄▄▄▁ ",
	"▔▔▔▔▔▔▔",
)
