"""Aggregates over the nationwide accident CSV (dataset 1) with JSON caching."""
import json
import os
from pathlib import Path

import pandas as pd

REPO_ROOT = Path(__file__).resolve().parents[3]
DEFAULT_CSV = Path(os.environ.get(
    "RAILGUARD_ACCIDENT_CSV",
    REPO_ROOT / "dataset" / "1_ข้อมูลอุบัติเหตุทางรถยนต์ในประเทศไทย" / "thai_accidental_dataset.csv",
))
CACHE_DIR = REPO_ROOT / "data" / "stats_cache"


def compute_stats(csv_path=None, use_cache=True) -> dict:
    csv_path = Path(csv_path or DEFAULT_CSV)
    cache_file = CACHE_DIR / f"{csv_path.stem}.json"
    if use_cache and cache_file.exists():
        return json.loads(cache_file.read_text())

    df = pd.read_csv(csv_path)
    df["time"] = pd.to_datetime(df["time"], errors="coerce")
    df["fatalities"] = pd.to_numeric(df["fatalities"], errors="coerce").fillna(0)
    df["injuries"] = pd.to_numeric(df["injuries"], errors="coerce").fillna(0)

    def top_counts(col, n=10):
        s = df[col].dropna()
        s = s[s.astype(str).str.strip() != ""]
        return [{"name": k, "count": int(v)} for k, v in s.value_counts().head(n).items()]

    by_hour = df["time"].dt.hour.value_counts().sort_index()
    monthly = df.set_index("time").resample("MS").size()

    stats = {
        "total_accidents": int(len(df)),
        "total_fatalities": int(df["fatalities"].sum()),
        "total_injuries": int(df["injuries"].sum()),
        "top_provinces": top_counts("province"),
        "top_causes": top_counts("cause"),
        "by_vehicle": top_counts("first_vehicle"),
        "by_weather": top_counts("weather"),
        "by_hour": [{"hour": int(h), "count": int(c)} for h, c in by_hour.items()],
        "monthly": [
            {"month": ts.strftime("%Y-%m"), "count": int(c)}
            for ts, c in monthly.items() if not pd.isna(ts)
        ],
    }
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_file.write_text(json.dumps(stats, ensure_ascii=False))
    return stats
