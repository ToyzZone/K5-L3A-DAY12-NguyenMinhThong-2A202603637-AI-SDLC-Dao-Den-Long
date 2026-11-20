// Số liệu game. TUNING phải khớp game.contract.json (test contract.test.mjs bắt lệch).
export const TUNING = {
  player_speed: 6,
  carry_capacity: 10,
  lantern_cost: 5,
  lantern_count_night1: 5,
  pickup_radius: 1.5,
  interact_radius: 3,
  pulse_cost: 2,
  pulse_radius: 6,
  night1_duration_s: 300,
  flames: 3,
  invuln_s: 1.5,
  hit_drop_ratio: 0.5,
  pulse_stun_s: 2.5,
  pulse_push_m: 4,
  pulse_cooldown_s: 1,
  safe_radius: 5,
  shade_speed: 3.5,
  shade_hit_radius: 1,
  fall_enabled: false,
  score: { per_mote: 10, per_lantern: 100, per_stun: 25, per_second_left: 2, per_flame_left: 50 },
};

// Số không có trong contract, ghi trong README.
export const WORLD = {
  island_radius: 40,
  lantern_ring_radius: 25,
  motes_target: 20,
  mote_spawn_radius: 37,
  mote_min_dist_from_player: 8,
  shade_start_count: 2,
  shade_spawn_radius: 38,
  shade_spawn_every_s: 45,
  shade_max: 6,
  shade_min_dist_from_player: 15,
  shade_y: 1,
  jump_speed: 6,
  gravity: 20,
};

export const TPS = 60;
