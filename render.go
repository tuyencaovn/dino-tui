package main

import (
	"fmt"
	"os"
	"strings"
)

const (
	esc         = "\x1b"
	enterScreen = esc + "[?1049h" + esc + "[?25l"
	leaveScreen = esc + "[0m" + esc + "[?25h" + esc + "[?1049l"

	colDino      = esc + "[38;5;40m"
	colCactus    = esc + "[38;5;28m"
	colBird      = esc + "[38;5;178m"
	colCloud     = esc + "[38;5;250m"
	colGround    = esc + "[38;5;137m"
	colHud       = esc + "[1;97m"
	colHudDim    = esc + "[38;5;245m"
	colOverTitle = esc + "[1;38;5;196m"
	colOverText  = esc + "[97m"
	colReset     = esc + "[0m"
)

type cellLine struct {
	text  string
	color string
}

type Renderer struct {
	chars, prevChars   [][]rune
	colors, prevColors [][]string
	cols, rows         int
	groundRow          int
	lastTooSmall       string
}

func NewRenderer() *Renderer { return &Renderer{} }

func (r *Renderer) Frame(g *Game, cols, rows int) {
	r.lastTooSmall = ""
	r.cols, r.rows = cols, rows
	r.groundRow = rows - 2
	r.chars = make([][]rune, rows)
	r.colors = make([][]string, rows)
	for y := range r.chars {
		r.chars[y] = make([]rune, cols)
		for x := range r.chars[y] {
			r.chars[y][x] = ' '
		}
		r.colors[y] = make([]string, cols)
	}

	r.drawGround(g.Distance)
	for _, c := range g.Clouds {
		r.draw(cloudSprite, int(c.X), c.Bottom, colCloud)
	}
	for _, o := range g.Obstacles {
		spr, col := o.Spr, colCactus
		if o.Bird {
			spr, col = birdFrames[int(g.AnimT/0.15)%2], colBird
		}
		r.draw(spr, int(o.X), o.Bottom, col)
	}
	r.draw(g.DinoSprite(), dinoX, int(g.DinoY+0.5), colDino)
	r.drawHud(g)
	switch g.State {
	case StateDead:
		r.drawGameOver(g)
	case StatePaused:
		r.drawPaused()
	}

	r.flush()
}

func (r *Renderer) TooSmall(cols, rows int) {
	msg := fmt.Sprintf("Terminal too small (%dx%d). Minimum: 60x16.", cols, rows)
	if msg == r.lastTooSmall {
		return // tránh flicker do vẽ lại mỗi frame
	}
	r.lastTooSmall = msg
	r.prevChars = nil // màn hình bị xóa → frame kế tiếp phải vẽ lại đủ
	os.Stdout.WriteString(esc + "[2J" + esc + "[H" + colHud + msg + colReset)
}

func (r *Renderer) draw(s Sprite, left, bottom int, color string) {
	top := r.groundRow - bottom - s.H
	for row := 0; row < s.H; row++ {
		y := top + row
		if y < 0 || y >= r.rows {
			continue
		}
		for c, ch := range s.Rows[row] {
			x := left + c
			if x < 0 || x >= r.cols || ch == ' ' {
				continue
			}
			r.chars[y][x] = ch
			r.colors[y][x] = color
		}
	}
}

func (r *Renderer) drawGround(distance float64) {
	for x := 0; x < r.cols; x++ {
		r.chars[r.groundRow][x] = '─'
		r.colors[r.groundRow][x] = colGround
		// Sỏi đá lăn theo quãng đường để tạo cảm giác chuyển động
		worldX := x + int(distance)
		if worldX%7 == 0 && r.groundRow+1 < r.rows {
			r.chars[r.groundRow+1][x] = '·'
			r.colors[r.groundRow+1][x] = colGround
		}
	}
}

func (r *Renderer) drawHud(g *Game) {
	r.writeText(0, 1, "SPACE/↑ jump · ↓ duck · P pause · Q quit", colHudDim, false)
	r.writeText(1, 1, fmt.Sprintf("LV %d", g.Level()), colHudDim, false)
	r.writeText(1, r.cols-18, fmt.Sprintf("HI %05d", g.HiScore), colHudDim, false)
	r.writeText(1, r.cols-8, fmt.Sprintf("%05d", g.Score), colHud, false)
}

func (r *Renderer) drawGameOver(g *Game) {
	armed := g.RestartPresses == 1
	hint := cellLine{"SPACE ×2 / R: restart  Q: quit", colOverText}
	if armed {
		hint = cellLine{"press SPACE again to restart", colOverTitle}
	}
	r.overlayBox([]cellLine{
		{"G A M E  O V E R", colOverTitle},
		{fmt.Sprintf("Score: %05d", g.Score), colOverText},
		hint,
	})
}

func (r *Renderer) drawPaused() {
	r.overlayBox([]cellLine{
		{"P A U S E D", colOverTitle},
		{"P: resume  Q: quit", colOverText},
	})
}

func (r *Renderer) overlayBox(content []cellLine) {
	const inner = 30
	center := func(text string) string {
		pad := inner - len([]rune(text))
		if pad < 0 {
			pad = 0
		}
		left := pad / 2
		return "│" + strings.Repeat(" ", left) + text + strings.Repeat(" ", pad-left) + "│"
	}
	lines := make([]cellLine, 0, len(content)+2)
	lines = append(lines, cellLine{"╭" + strings.Repeat("─", inner) + "╮", colOverText})
	for _, c := range content {
		lines = append(lines, cellLine{center(c.text), c.color})
	}
	lines = append(lines, cellLine{"╰" + strings.Repeat("─", inner) + "╯", colOverText})

	left := (r.cols - inner - 2) / 2
	if left < 0 {
		left = 0
	}
	top := (r.rows - len(lines)) / 2
	if top < 0 {
		top = 0
	}
	for i, line := range lines {
		r.writeText(top+i, left, line.text, line.color, true)
	}
}

func (r *Renderer) writeText(y, x int, text, color string, overwriteSpaces bool) {
	if y < 0 || y >= r.rows {
		return
	}
	for i, ch := range []rune(text) {
		px := x + i
		if px < 0 || px >= r.cols {
			continue
		}
		if ch == ' ' && !overwriteSpaces {
			continue
		}
		r.chars[y][px] = ch
		r.colors[y][px] = color
	}
}

// Chỉ gửi những cell thay đổi so với frame trước; vẽ lại toàn màn hình
// mỗi frame khiến terminal không kịp xử lý và gây giật/tearing.
func (r *Renderer) flush() {
	full := r.prevChars == nil || len(r.prevChars) != r.rows ||
		len(r.prevChars[0]) != r.cols
	var out strings.Builder
	current := "\x00" // sentinel: luôn set màu ở cell đầu tiên
	emit := func(y, x int) {
		if c := r.colors[y][x]; c != current {
			if c == "" {
				out.WriteString(colReset)
			} else {
				out.WriteString(c)
			}
			current = c
		}
		out.WriteRune(r.chars[y][x])
	}

	if full {
		out.WriteString(esc + "[2J" + esc + "[H")
		for y := 0; y < r.rows; y++ {
			for x := 0; x < r.cols; x++ {
				emit(y, x)
			}
			if y < r.rows-1 {
				out.WriteString("\r\n")
			}
		}
	} else {
		for y := 0; y < r.rows; y++ {
			for x := 0; x < r.cols; {
				if r.chars[y][x] == r.prevChars[y][x] &&
					r.colors[y][x] == r.prevColors[y][x] {
					x++
					continue
				}
				fmt.Fprintf(&out, esc+"[%d;%dH", y+1, x+1)
				for x < r.cols && (r.chars[y][x] != r.prevChars[y][x] ||
					r.colors[y][x] != r.prevColors[y][x]) {
					emit(y, x)
					x++
				}
			}
		}
	}

	r.prevChars, r.prevColors = r.chars, r.colors
	if out.Len() > 0 {
		os.Stdout.WriteString(out.String() + colReset)
	}
}
