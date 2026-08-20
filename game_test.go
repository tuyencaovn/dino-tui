package main

import (
	"math"
	"testing"
)

func TestBoxesOverlap(t *testing.T) {
	a := Box{X: 0, Y: 0, W: 4, H: 4}
	if !boxesOverlap(a, Box{X: 2, Y: 2, W: 4, H: 4}) {
		t.Error("chồng lấn phải trả true")
	}
	if boxesOverlap(a, Box{X: 4, Y: 0, W: 4, H: 4}) {
		t.Error("chạm mép không tính là va chạm")
	}
	if boxesOverlap(a, Box{X: 10, Y: 0, W: 2, H: 2}) {
		t.Error("tách rời phải trả false")
	}
	if boxesOverlap(a, Box{X: 0, Y: 4, W: 4, H: 4}) {
		t.Error("tách theo trục dọc phải trả false")
	}
}

func TestJumpRisesAndLands(t *testing.T) {
	g := NewGame(80)
	g.Jump()
	peak, landed := 0.0, false
	for i := 0; i < 100; i++ {
		g.Tick(0.033)
		g.Obstacles = nil // cô lập physics khỏi spawn ngẫu nhiên
		peak = math.Max(peak, g.DinoY)
		if i > 5 && g.DinoY == 0 {
			landed = true
			break
		}
	}
	if peak < 6.5 {
		t.Errorf("đỉnh nhảy phải ≥ 6.5 hàng để dư sức qua cactus 4 hàng, được %.2f", peak)
	}
	if !landed {
		t.Error("dino phải rơi về mặt đất")
	}
}

func TestAllCactiClearable(t *testing.T) {
	for _, spr := range cacti {
		survivors := 0
		for delay := 0.0; delay <= 1.4; delay += 0.016 {
			g := NewGame(100)
			g.Obstacles = []Obstacle{{X: 30, Spr: spr}}
			jumped, dead := false, false
			for tt := 0.0; tt < 3; tt += 0.016 {
				if tt >= delay && !jumped {
					g.Jump()
					jumped = true
				}
				g.Tick(0.016)
				// Cô lập kịch bản: bỏ vật cản spawn ngẫu nhiên, chỉ giữ mục tiêu
				if len(g.Obstacles) > 1 {
					g.Obstacles = g.Obstacles[:1]
				}
				if g.State == StateDead {
					dead = true
					break
				}
				if len(g.Obstacles) > 0 && g.Obstacles[0].X+float64(spr.W) < dinoX-1 {
					break
				}
			}
			if !dead {
				survivors++
			}
		}
		// ≥ 6 nhịp 16ms sống sót ⇒ cửa sổ né ≥ ~0.1s, con người bấm được
		if survivors < 6 {
			t.Errorf("cactus %dx%d: chỉ %d thời điểm nhảy sống sót — gần như không thể né",
				spr.W, spr.H, survivors)
		}
	}
}

func TestBotSelfPlay(t *testing.T) {
	g := NewGame(100)
	deaths := 0
	for tt := 0.0; tt < 120; tt += 0.016 {
		var nearest *Obstacle
		for i := range g.Obstacles {
			o := &g.Obstacles[i]
			if o.X+float64(o.Spr.W) < dinoX {
				continue
			}
			if nearest == nil || o.X < nearest.X {
				nearest = o
			}
		}
		if nearest != nil {
			closing := g.Speed()
			if nearest.Bird {
				closing *= 1.15
			}
			// tti tính theo mép hitbox (vật cản thu 1 cột, dino thu 2 cột)
			tti := (nearest.X + 1 - (dinoX + 2 + 4)) / closing
			if tti <= 0.2 {
				if nearest.Bird && nearest.Bottom >= 3 {
					g.Duck()
				} else {
					g.Jump()
				}
			}
		}
		g.Tick(0.016)
		if g.State == StateDead {
			deaths++
			g.Reset()
		}
	}
	best := g.Score
	if g.HiScore > best {
		best = g.HiScore // HiScore chỉ ghi lúc chết
	}
	if best < 300 {
		t.Errorf("bot phải đạt ≥ 300 điểm (chim xuất hiện từ 150), được %d", best)
	}
	if deaths > 1 {
		t.Errorf("bot phản xạ 0.2s chết %d lần — game không công bằng", deaths)
	}
}

func TestNoDoubleJump(t *testing.T) {
	g := NewGame(80)
	g.Jump()
	g.Tick(0.033)
	velBefore := g.VelY
	g.Jump()
	if g.VelY != velBefore {
		t.Error("jump giữa không trung không được đổi vận tốc")
	}
	if g.VelY >= jumpVelocity {
		t.Error("vận tốc phải đã giảm do trọng lực")
	}
}

func TestSpeedCurve(t *testing.T) {
	g := NewGame(80)
	if g.Speed() != baseSpeed {
		t.Error("tốc độ khởi đầu phải là baseSpeed")
	}
	g.Score = 100
	if g.Speed() <= baseSpeed {
		t.Error("tốc độ phải tăng ở mốc 100 điểm")
	}
	g.Score = 99999
	if g.Speed() != maxSpeed {
		t.Error("tốc độ phải bị chặn ở maxSpeed")
	}
}

func TestDuck(t *testing.T) {
	g := NewGame(80)
	standing := g.DinoBox().H
	g.Duck()
	g.Tick(0.033)
	if !g.Ducking {
		t.Fatal("phải ở trạng thái cúi ngay sau khi nhấn")
	}
	if g.DinoBox().H >= standing {
		t.Error("hitbox cúi phải thấp hơn đứng")
	}
	g.Tick(0.7) // quá thời hạn giữ phím (duckHoldMs = 600)
	if g.Ducking {
		t.Error("phải đứng dậy khi không còn nhấn ↓")
	}
}

func TestSpawnGaps(t *testing.T) {
	g := NewGame(120)
	for i := 0; i < 3000; i++ {
		g.Tick(0.033)
		if g.State == StateDead {
			g.Reset()
		}
		for j := 1; j < len(g.Obstacles); j++ {
			gap := g.Obstacles[j].X - g.Obstacles[j-1].X
			// Bird-safe-gap khi spawn đã bù phần chim bay nhanh hơn nền
			if gap < g.MinGap()-2 {
				t.Fatalf("khoảng cách %.1f nhỏ hơn tối thiểu %.1f", gap, g.MinGap())
			}
		}
	}
}

func TestSpaceTwiceRestart(t *testing.T) {
	g := NewGame(80)
	g.JumpKey()
	if g.VelY != jumpVelocity {
		t.Error("đang chơi thì phím space phải là nhảy")
	}

	g.State = StateDead
	g.JumpKey()
	if g.State != StateDead {
		t.Error("nhấn space 1 lần chưa được restart")
	}
	if g.RestartPresses != 1 {
		t.Error("phải ghi nhận lần nhấn đầu")
	}
	g.JumpKey()
	if g.State != StatePlaying {
		t.Error("nhấn space lần 2 phải restart")
	}
	if g.RestartPresses != 0 {
		t.Error("bộ đếm phải về 0 sau restart")
	}
}

func TestPause(t *testing.T) {
	g := NewGame(80)
	g.TogglePause()
	if g.State != StatePaused {
		t.Fatal("P phải chuyển sang paused")
	}
	distBefore := g.Distance
	g.Tick(0.5)
	g.Jump()
	if g.Distance != distBefore {
		t.Error("khi pause quãng đường không được tăng")
	}
	if g.VelY != 0 {
		t.Error("khi pause không được nhảy")
	}
	g.TogglePause()
	if g.State != StatePlaying {
		t.Error("P lần nữa phải resume")
	}
	g.State = StateDead
	g.TogglePause()
	if g.State != StateDead {
		t.Error("chết rồi thì không pause được")
	}
}

func TestReset(t *testing.T) {
	g := NewGame(80)
	g.Score = 250
	g.HiScore = 250
	g.State = StateDead
	g.Reset()
	if g.State != StatePlaying {
		t.Error("reset phải quay lại playing")
	}
	if g.Score != 0 {
		t.Error("điểm phải về 0")
	}
	if g.HiScore != 250 {
		t.Error("hi-score phải được giữ qua các ván")
	}
	if len(g.Obstacles) != 0 {
		t.Error("vật cản phải bị xóa")
	}
}
