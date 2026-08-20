package main

import (
	"math"
	"math/rand"
)

type GameState int

const (
	StatePlaying GameState = iota
	StatePaused
	StateDead
)

const (
	dinoX     = 4
	baseSpeed = 20.0 // cột/giây
	speedStep = 2.0  // cộng thêm mỗi 100 điểm
	maxSpeed  = 44.0
	// Đỉnh nhảy ≈ v²/2g ≈ 7.5 hàng, airtime ≈ 0.94s. Ràng buộc: thời gian dino
	// ở trên đỉnh cactus cao nhất (4 hàng) phải DÀI hơn thời gian hai hitbox
	// chồng nhau theo trục ngang ở tốc độ chậm nhất, nếu không cây cao trở
	// thành không thể né.
	jumpVelocity = 32.0 // hàng/giây
	gravity      = 68.0 // hàng/giây²
	birdMinScore = 150
	// Phải dài hơn initial key-repeat delay của macOS (~500ms), nếu không dino
	// đứng dậy giữa lần nhấn ↓ đầu tiên và lúc key-repeat bắt đầu.
	duckHoldMs = 600.0
)

type Obstacle struct {
	X      float64 // mép trái, tính bằng cột
	Bottom int     // số hàng phía trên mặt đất
	Spr    Sprite
	Bird   bool
}

type CloudPos struct {
	X      float64
	Bottom int
}

type Box struct {
	X, Y, W, H float64 // Y = bottom, hàng phía trên mặt đất
}

func boxesOverlap(a, b Box) bool {
	return a.X < b.X+b.W && b.X < a.X+a.W &&
		a.Y < b.Y+b.H && b.Y < a.Y+a.H
}

type Game struct {
	State     GameState
	Width     int
	DinoY     float64 // độ cao chân dino so với mặt đất
	VelY      float64
	Ducking   bool
	Obstacles []Obstacle
	Clouds    []CloudPos
	Distance  float64
	Score     int
	HiScore   int
	AnimT     float64 // đồng hồ animation, giây
	// Phím nhảy kiêm restart: khi đã chết, nhấn 2 lần liên tiếp mới chơi lại
	// để tránh restart oan do đang spam space lúc chết
	RestartPresses int

	duckMs   float64
	nextBird bool
	nextGap  float64
}

func NewGame(width int) *Game {
	g := &Game{Width: width}
	g.nextGap = g.rollNext()
	return g
}

func (g *Game) Speed() float64 {
	return math.Min(baseSpeed+float64(g.Score/100)*speedStep, maxSpeed)
}

func (g *Game) Level() int { return g.Score/100 + 1 }

func (g *Game) DinoSprite() Sprite {
	frames := dinoRun
	if g.Ducking {
		frames = dinoDuck
	}
	// Chỉ đảo chân khi đang chạy trên mặt đất
	frame := 0
	if g.DinoY == 0 {
		frame = int(g.AnimT/0.15) % 2
	}
	return frames[frame]
}

func (g *Game) JumpKey() {
	if g.State == StateDead {
		g.RestartPresses++
		if g.RestartPresses >= 2 {
			g.Reset()
		}
		return
	}
	g.Jump()
}

func (g *Game) Jump() {
	if g.State != StatePlaying {
		return
	}
	if g.DinoY == 0 {
		g.VelY = jumpVelocity
		g.duckMs = 0
	}
}

func (g *Game) Duck() {
	if g.State != StatePlaying {
		return
	}
	if g.DinoY > 0 {
		// Đang trên không: nhấn xuống để rơi nhanh như Chrome dino
		g.VelY = math.Min(g.VelY, -jumpVelocity*1.5)
	} else {
		// Terminal không có sự kiện nhả phím; key-repeat khi giữ ↓ sẽ
		// liên tục gia hạn bộ đếm này nên "giữ để cúi" vẫn hoạt động.
		g.duckMs = duckHoldMs
	}
}

func (g *Game) TogglePause() {
	switch g.State {
	case StatePlaying:
		g.State = StatePaused
	case StatePaused:
		g.State = StatePlaying
	}
}

func (g *Game) Reset() {
	g.State = StatePlaying
	g.RestartPresses = 0
	g.DinoY = 0
	g.VelY = 0
	g.Ducking = false
	g.duckMs = 0
	g.Obstacles = nil
	g.Clouds = nil
	g.Distance = 0
	g.Score = 0
	g.AnimT = 0
	g.nextGap = g.rollNext()
}

func (g *Game) Tick(dt float64) {
	if g.State != StatePlaying {
		return
	}
	g.AnimT += dt
	g.Distance += g.Speed() * dt
	g.Score = int(g.Distance / 5)

	if g.DinoY > 0 || g.VelY > 0 {
		g.DinoY += g.VelY * dt
		g.VelY -= gravity * dt
		if g.DinoY <= 0 {
			g.DinoY = 0
			g.VelY = 0
		}
	}
	g.duckMs = math.Max(0, g.duckMs-dt*1000)
	g.Ducking = g.duckMs > 0 && g.DinoY == 0

	for i := range g.Obstacles {
		// Chim bay nhanh hơn nền một chút cho giống Chrome
		m := 1.0
		if g.Obstacles[i].Bird {
			m = 1.15
		}
		g.Obstacles[i].X -= g.Speed() * dt * m
	}
	kept := g.Obstacles[:0]
	for _, o := range g.Obstacles {
		if o.X+float64(o.Spr.W) > -2 {
			kept = append(kept, o)
		}
	}
	g.Obstacles = kept
	g.maybeSpawnObstacle()

	for i := range g.Clouds {
		g.Clouds[i].X -= g.Speed() * dt * 0.25
	}
	keptC := g.Clouds[:0]
	for _, c := range g.Clouds {
		if c.X > -8 {
			keptC = append(keptC, c)
		}
	}
	g.Clouds = keptC
	g.maybeSpawnCloud()

	if g.hitsObstacle() {
		g.State = StateDead
		if g.Score > g.HiScore {
			g.HiScore = g.Score
		}
	}
}

func (g *Game) MinGap() float64 {
	// Khoảng cách tối thiểu scale theo tốc độ: airtime 0.94s + quỹ phản xạ
	// ~0.4s để hai vật cản liên tiếp luôn né được
	return g.Speed() * 1.35
}

// Quyết định loại vật cản KẾ TIẾP ngay khi roll gap: chim bay nhanh hơn
// nền 15% nên thu hẹp khoảng cách với vật cản phía trước tối đa
// ~0.13 × bề rộng màn hình — nếu là chim thì đòi gap dài hơn từ đầu,
// tránh tạo cặp vật cản không thể né.
func (g *Game) rollNext() float64 {
	g.nextBird = g.Score >= birdMinScore && rand.Float64() < 0.25
	margin := 0.0
	if g.nextBird {
		margin = float64(g.Width) * 0.15
	}
	return g.MinGap() + margin + rand.Float64()*40
}

func (g *Game) maybeSpawnObstacle() {
	gapNow := math.Inf(1)
	if n := len(g.Obstacles); n > 0 {
		gapNow = float64(g.Width) - g.Obstacles[n-1].X
	}
	if gapNow < g.nextGap {
		return
	}

	if g.nextBird {
		// bottom 1: chim thấp phải nhảy; bottom 3: chim ngang đầu phải cúi
		bottom := 3
		if rand.Float64() < 0.5 {
			bottom = 1
		}
		g.Obstacles = append(g.Obstacles, Obstacle{
			X: float64(g.Width), Bottom: bottom, Spr: birdFrames[0], Bird: true,
		})
	} else {
		g.Obstacles = append(g.Obstacles, Obstacle{
			X: float64(g.Width), Spr: cacti[rand.Intn(len(cacti))],
		})
	}
	g.nextGap = g.rollNext()
}

func (g *Game) maybeSpawnCloud() {
	if len(g.Clouds) >= 3 || rand.Float64() > 0.01 {
		return
	}
	g.Clouds = append(g.Clouds, CloudPos{
		X: float64(g.Width), Bottom: 7 + rand.Intn(6),
	})
}

func (g *Game) DinoBox() Box {
	s := g.DinoSprite()
	// Thu hẹp 2 cột mỗi bên: hitbox khoan dung kiểu Chrome, đồng thời nới
	// cửa sổ thời gian để nhảy qua cactus cao/rộng ở tốc độ chậm
	return Box{
		X: dinoX + 2,
		Y: math.Round(g.DinoY),
		W: float64(s.W - 4),
		H: float64(s.H),
	}
}

func (g *Game) hitsObstacle() bool {
	dino := g.DinoBox()
	for _, o := range g.Obstacles {
		// Vật cản cũng thu 1 cột mỗi bên: sượt mép gai không tính chết
		if boxesOverlap(dino, Box{
			X: o.X + 1,
			Y: float64(o.Bottom),
			W: float64(o.Spr.W - 2),
			H: float64(o.Spr.H),
		}) {
			return true
		}
	}
	return false
}
