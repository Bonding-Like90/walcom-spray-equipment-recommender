const TIP_ALLOWED = new Set([0.5, 1.0, 1.2, 1.3, 1.4, 1.7, 1.9, 2.0, 2.5]);

export function normalizeDigitalLevel(digitalLevel) {
  if (digitalLevel === "NON_DIGITAL") return "NON_DIGITAL";
  // DIGITAL_PRO treated as DIGITAL mode for matching
  return "DIGITAL";
}

function computeDistance(a, requestedTip) {
  return Math.abs(requestedTip - a.tip_size);
}

export function distanceRank(candidates, requestedTip) {
  for (const c of candidates) {
    c._distance = computeDistance(c, requestedTip);
  }

  // Exact matches
  const exact = candidates.filter(c => c._distance === 0);
  if (exact.length > 0) {
    // Top 1 for exact match: digital_mode, then id
    exact.sort((x, y) => {
      const dm = x.digital_mode.localeCompare(y.digital_mode);
      if (dm !== 0) return dm;
      return x.walcom_item_id.localeCompare(y.walcom_item_id);
    });
    return [exact[0]];
  }

  // Otherwise Top 3:
  // distance asc, then digital mode asc, then item id asc
  const sorted = candidates.slice().sort((x, y) => {
    if (x._distance !== y._distance) return x._distance - y._distance;
    if (x.digital_mode !== y.digital_mode) return x.digital_mode.localeCompare(y.digital_mode);
    return x.walcom_item_id.localeCompare(y.walcom_item_id);
  });

  return sorted.slice(0, 3);
}

export function recommendWalcom({ walcomItems, addons, input }) {
  const {
    haloFamily,
    digitalLevel, // NON_DIGITAL / DIGITAL / DIGITAL_PRO
    baseClear,    // BASE / CLEAR
    needleSize
  } = input;

  const digitalMode = normalizeDigitalLevel(digitalLevel);

  // Add-on logic:
  // - NON_DIGITAL => analogue regulator
  // - DIGITAL or DIGITAL_PRO => digital regulator+gauge set
  const addonKey = (digitalLevel === "NON_DIGITAL") ? "NON_DIGITAL" : "DIGITAL";
  const addon = addons?.[addonKey] ?? null;

  // Strict filter (family + base/clear + digital mode)
  const strict = walcomItems.filter(i =>
    i.halo_family === haloFamily &&
    i.variant_group === baseClear &&
    i.digital_mode === digitalMode
  );

  let candidates = strict;
  let baseClearRelaxed = false;

  // Relax BASE/CLEAR if strict empty
  if (candidates.length === 0) {
    candidates = walcomItems.filter(i =>
      i.halo_family === haloFamily &&
      i.digital_mode === digitalMode &&
      (i.variant_group === "BASE" || i.variant_group === "CLEAR")
    );
    baseClearRelaxed = true;
  }

  const ranked = distanceRank(candidates, needleSize);

  const halo_recommendations = ranked.map((c, idx) => ({
    rank: idx + 1,
    walcom_item_id: c.walcom_item_id,
    halo_family: c.halo_family,
    variant_group: c.variant_group,
    digital_mode: c.digital_mode,
    tip_size: c.tip_size,
    match: {
      exact: c._distance === 0,
      distance: c._distance
    },
    why: [
      `HALO family fixed by user = ${haloFamily}`,
      `digitalLevel=${digitalLevel} → digital_mode=${digitalMode}`,
      `variant_group tried=${baseClear}${baseClearRelaxed ? " (relaxed if empty)" : ""}`,
      `needle tip requested=${needleSize}, candidate tip=${c.tip_size}`
    ]
  }));

  return {
    addon_recommendation: addon,
    halo_recommendations,
    meta: {
      base_clear_relaxed: baseClearRelaxed,
      returned: halo_recommendations.length,
      rule: "Exact tip match => Top 1; else Top 3 by distance, then digital_mode, then item id"
    }
  };
}
